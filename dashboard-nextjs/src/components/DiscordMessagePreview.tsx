"use client";

import React, { useMemo } from "react";

/* ------------------------------------------------------------------ */
/*  Tiny Discord-Markdown → React renderer                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Lookup context – role & user name resolution                      */
/* ------------------------------------------------------------------ */

/** Maps passed via props so the renderer can resolve IDs → names. */
interface LookupMaps {
  roles: Record<string, { name: string; color?: string }>;
  users: Record<string, string>;
  channels: Record<string, string>;
}

let _lookups: LookupMaps = { roles: {}, users: {}, channels: {} };

/** Regex patterns for inline elements (order matters – longest match first). */
const INLINE_RULES: { pattern: RegExp; render: (m: RegExpMatchArray, key: number) => React.ReactNode }[] = [
  // wstawiona zmienna (np. Invite Trackera) — owinięta w niewidoczny sentinel …,
  // renderowana jako wzmianka Discorda. Musi być pierwsza w tablicy, żeby wygrywać remisy
  // na tym samym indeksie z innymi regułami (np. bold wewnątrz podstawionej wartości).
  {
    pattern: /([\s\S]*?)/,
    render: (m, k) => (
      <span key={k} className="rounded bg-[#3f4270] px-1 font-medium text-[#c9cdfb] cursor-default">
        {m[1]}
      </span>
    ),
  },
  // role mention  <@&ROLE_ID>
  {
    pattern: /<@&(\d+)>/,
    render: (m, k) => {
      const role = _lookups.roles[m[1]];
      const name = role?.name ?? "role";
      const color = role?.color ?? "#5865f2";
      return (
        <span
          key={k}
          className="rounded px-0.5 font-medium cursor-default"
          style={{
            backgroundColor: `${color}26`,
            color: color,
          }}
        >
          @{name}
        </span>
      );
    },
  },
  // user mention  <@USER_ID> or <@!USER_ID>
  {
    pattern: /<@!?(\d+)>/,
    render: (m, k) => {
      const name = _lookups.users[m[1]] ?? "user";
      return (
        <span
          key={k}
          className="rounded bg-[#5865f226] px-0.5 font-medium text-[#dee0fc] cursor-default hover:bg-[#5865f24d]"
        >
          @{name}
        </span>
      );
    },
  },
  // channel mention  <#CHANNEL_ID>
  {
    pattern: /<#(\d+)>/,
    render: (m, k) => {
      const name = _lookups.channels[m[1]] ?? "channel";
      return (
        <span
          key={k}
          className="rounded bg-[#5865f226] px-0.5 font-medium text-[#dee0fc] cursor-default hover:bg-[#5865f24d]"
        >
          #{name}
        </span>
      );
    },
  },
  // animated custom emoji  <a:name:id>
  {
    pattern: /<a?:(\w+):(\d+)>/,
    render: (m, k) => (
      <img
        key={k}
        src={`https://cdn.discordapp.com/emojis/${m[2]}.${m[0].startsWith("<a") ? "gif" : "webp"}?size=48&quality=lossless`}
        alt={`:${m[1]}:`}
        title={`:${m[1]}:`}
        className="inline-block h-6 w-6 align-middle -mt-0.5"
        draggable={false}
      />
    ),
  },
  // bold + italic  ***text***
  {
    pattern: /\*\*\*(.+?)\*\*\*/s,
    render: (m, k) => (
      <strong key={k}><em>{renderInline(m[1])}</em></strong>
    ),
  },
  // bold  **text**
  {
    pattern: /\*\*(.+?)\*\*/s,
    render: (m, k) => <strong key={k}>{renderInline(m[1])}</strong>,
  },
  // italic  *text*  or _text_
  {
    pattern: /(?:\*(.+?)\*|_(.+?)_)/s,
    render: (m, k) => <em key={k}>{renderInline(m[1] ?? m[2])}</em>,
  },
  // underline  __text__
  {
    pattern: /__(.+?)__/s,
    render: (m, k) => <u key={k}>{renderInline(m[1])}</u>,
  },
  // strikethrough  ~~text~~
  {
    pattern: /~~(.+?)~~/s,
    render: (m, k) => <s key={k}>{renderInline(m[1])}</s>,
  },
  // inline code  `text`
  {
    pattern: /`([^`]+)`/,
    render: (m, k) => (
      <code key={k} className="rounded bg-[#2b2d31] px-1 py-0.5 text-xs font-mono">
        {m[1]}
      </code>
    ),
  },
  // URL – plain link
  {
    pattern: /(https?:\/\/[^\s<>]+)/,
    render: (m, k) => (
      <a
        key={k}
        href={m[1]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#00aafc] hover:underline break-all"
      >
        {m[1]}
      </a>
    ),
  },
  // masked link  [text](url)
  {
    pattern: /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/,
    render: (m, k) => (
      <a
        key={k}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#00aafc] hover:underline"
      >
        {m[1]}
      </a>
    ),
  },
];

/** Recursively parse inline markdown and return React nodes. */
function renderInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  while (remaining.length > 0) {
    let earliestIndex = Infinity;
    let earliestRule: (typeof INLINE_RULES)[number] | null = null;
    let earliestMatch: RegExpMatchArray | null = null;

    for (const rule of INLINE_RULES) {
      const match = remaining.match(rule.pattern);
      if (match && match.index !== undefined && match.index < earliestIndex) {
        earliestIndex = match.index;
        earliestRule = rule;
        earliestMatch = match;
      }
    }

    if (!earliestRule || !earliestMatch || earliestIndex === Infinity) {
      nodes.push(remaining);
      break;
    }

    if (earliestIndex > 0) {
      nodes.push(remaining.slice(0, earliestIndex));
    }

    nodes.push(earliestRule.render(earliestMatch, keyIdx++));
    remaining = remaining.slice(earliestIndex + earliestMatch[0].length);
  }

  return nodes;
}

/** Render a single line, handling heading prefixes and sub-text. */
function renderLine(line: string, key: number): React.ReactNode {
  // -# sub-text (Discord small text)
  if (/^-#\s/.test(line)) {
    return (
      <p key={key} className="text-[11px] text-[#949ba4] leading-snug mt-0.5">
        {renderInline(line.slice(3))}
      </p>
    );
  }

  // ### Heading 3
  if (/^###\s/.test(line)) {
    return (
      <p key={key} className="text-base font-bold leading-snug mt-1">
        {renderInline(line.slice(4))}
      </p>
    );
  }

  // ## Heading 2
  if (/^##\s/.test(line)) {
    return (
      <p key={key} className="text-lg font-bold leading-snug mt-1">
        {renderInline(line.slice(3))}
      </p>
    );
  }

  // # Heading 1
  if (/^#\s/.test(line)) {
    return (
      <p key={key} className="text-xl font-bold leading-snug mt-1">
        {renderInline(line.slice(2))}
      </p>
    );
  }

  // empty line → spacer
  if (line.trim() === "") {
    return <div key={key} className="h-2" />;
  }

  // normal line
  return (
    <p key={key} className="leading-[1.375rem]">
      {renderInline(line)}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Public component                                                  */
/* ------------------------------------------------------------------ */

interface DiscordMessagePreviewProps {
  content: string;
  /** Bot name shown in the message header */
  botName?: string;
  /** Avatar URL – defaults to a Discord bot icon */
  avatarUrl?: string;
  /** Map of role ID → { name, color } for resolving <@&ID> mentions */
  roles?: Record<string, { name: string; color?: string }>;
  /** Map of user ID → display name for resolving <@ID> mentions */
  users?: Record<string, string>;
  /** Map of channel ID → name for resolving <#ID> mentions */
  channels?: Record<string, string>;
  /** When set, renders content inside a Discord embed box instead of as plain message text */
  embed?: { color: string; title?: string; footer?: string };
  /** Set to false when the bubble is directly followed by more same-background content (e.g. a reaction row) — avoids a rounded-corner gap revealing the page background behind. */
  roundBottom?: boolean;
  /** Tighter padding/avatar + top-aligned author row (mniej pustej przestrzeni nad nazwą bota i treścią — wzór: Urodziny). */
  compact?: boolean;
  /** Tylko w trybie compact: gdy false, pomija własną ramkę (border) — przydatne, gdy element nadrzędny
   * już rysuje wspólną ramkę wokół dymka i doklejonego pod nim elementu (np. rząd reakcji w Turnieju). */
  bordered?: boolean;
}

export function DiscordMessagePreview({
  content,
  botName = "Deezy",
  avatarUrl,
  roles = {},
  users = {},
  channels = {},
  embed,
  roundBottom = true,
  compact = false,
  bordered = true,
}: DiscordMessagePreviewProps) {
  const embedTitle = embed?.title;
  const embedFooter = embed?.footer;

  const { bodyNodes, titleNodes, footerNodes } = useMemo(() => {
    // Set lookup maps for the inline renderer
    _lookups = { roles, users, channels };
    const lines = content.split("\n");
    return {
      bodyNodes: lines.map((line, i) => renderLine(line, i)),
      titleNodes: embedTitle?.trim() ? renderInline(embedTitle) : null,
      footerNodes: embedFooter?.trim() ? renderInline(embedFooter) : null,
    };
  }, [content, roles, users, channels, embedTitle, embedFooter]);

  const now = new Date();
  const timestamp = `Dzisiaj o ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const bodyContent = embed ? (
    <div
      className="rounded-[4px] py-2 pr-4"
      style={{
        borderLeft: `4px solid ${embed.color}`,
        backgroundColor: "rgba(46,48,54,0.5)",
        paddingLeft: "12px",
      }}
    >
      {titleNodes && (
        <p className="mb-1 font-semibold text-[#f2f3f5]">{titleNodes}</p>
      )}
      <div>{bodyNodes}</div>
      {footerNodes && (
        <p className="mt-2 text-[11px] text-[#949ba4]">{footerNodes}</p>
      )}
    </div>
  ) : (
    bodyNodes
  );

  const authorLine = (
    <div className="flex items-center gap-1.5">
      <span className="font-medium text-[#f2f3f5] leading-none">{botName}</span>
      <span className="rounded bg-[#5865f2] px-1 py-0 text-[10px] font-medium leading-[14px] text-white">
        BOT
      </span>
      <span className="text-[11px] text-[#949ba4] leading-none">{timestamp}</span>
    </div>
  );

  if (compact) {
    // Struktura i klasy 1:1 wzorowane na lokalnym podglądzie z modułu Urodziny:
    // brak timestampu, avatar h-9 z object-cover, nazwa+treść w jednej kolumnie
    // obok avatara (bez osobnego "wiersza autora" o wysokości avatara).
    return (
      <div
        className={`${roundBottom ? "rounded-md" : "rounded-t-md"} ${bordered ? "border border-[#2f3341]" : ""} bg-[#313338] p-4 font-[Whitney,Helvetica_Neue,Helvetica,Arial,sans-serif] text-sm text-[#dbdee1]`}
      >
        <div className="flex items-start gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt={botName} className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#5865f2] text-white text-xs font-bold select-none">
              {botName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm">
              <span className="font-semibold text-white">{botName}</span>
              <span className="rounded bg-[#5865f2] px-1 py-0 text-[10px] font-semibold uppercase leading-[14px] text-white">Bot</span>
            </p>
            <div className="break-words text-sm leading-6 text-[#dbdee1]">{bodyContent}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${roundBottom ? "rounded-lg" : "rounded-t-lg"} bg-[#313338] p-4 font-[Whitney,Helvetica_Neue,Helvetica,Arial,sans-serif] text-sm text-[#dbdee1]`}
    >
      {/* Author row */}
      <div className="flex items-center gap-2 mb-1">
        {avatarUrl ? (
          <img src={avatarUrl} alt={botName} className="h-10 w-10 rounded-full" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5865f2] text-white text-xs font-bold select-none">
            {botName.slice(0, 2).toUpperCase()}
          </div>
        )}
        {authorLine}
      </div>

      {/* Message body */}
      <div className="pl-12">{bodyContent}</div>
    </div>
  );
}
