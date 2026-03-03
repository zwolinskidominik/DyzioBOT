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
}

export function DiscordMessagePreview({
  content,
  botName = "DyzioBOT",
  avatarUrl,
  roles = {},
  users = {},
  channels = {},
}: DiscordMessagePreviewProps) {
  const rendered = useMemo(() => {
    // Set lookup maps for the inline renderer
    _lookups = { roles, users, channels };
    const lines = content.split("\n");
    return lines.map((line, i) => renderLine(line, i));
  }, [content, roles, users, channels]);

  const now = new Date();
  const timestamp = `Dzisiaj o ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return (
    <div className="rounded-lg bg-[#313338] p-4 font-[Whitney,Helvetica_Neue,Helvetica,Arial,sans-serif] text-sm text-[#dbdee1]">
      {/* Author row */}
      <div className="flex items-center gap-2 mb-1">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={botName}
            className="h-10 w-10 rounded-full"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5865f2] text-white text-xs font-bold select-none">
            {botName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-[#f2f3f5] leading-none">{botName}</span>
          <span className="rounded bg-[#5865f2] px-1 py-[1px] text-[10px] font-medium text-white leading-none">
            BOT
          </span>
          <span className="text-[11px] text-[#949ba4] leading-none">{timestamp}</span>
        </div>
      </div>

      {/* Message body */}
      <div className="pl-12">{rendered}</div>
    </div>
  );
}
