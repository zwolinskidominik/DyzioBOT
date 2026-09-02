"use client";

import { cn } from "@/lib/utils";

export type GreetingMessageMode = "embed" | "text";
export type GreetingImageMode = "gifs" | "custom" | "none";
export type GreetingThumbnailMode = "avatar" | "custom" | "none";
export type GreetingAuthorIconMode = "avatar" | "none";
export type GreetingImageSlot = "thumbnail" | "image" | "headerIcon" | "footerIcon";
export type GreetingModuleKey = "welcome" | "dm" | "goodbye";

/** Sample avatar used in previews to represent the joining/leaving member. */
export const SAMPLE_MEMBER_AVATAR = "/deezy.png";

export interface GreetingVariable {
  name: string;
  display: string;
  value: string;
  description: string;
}

export const GREETING_VARIABLES: GreetingVariable[] = [
  { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
  { name: "Nazwa", display: "Nazwa użytkownika", value: "{username}", description: "Nazwa użytkownika bez wzmianki" },
  { name: "Serwer", display: "Serwer", value: "{server}", description: "Nazwa serwera" },
  { name: "Członkowie", display: "Liczba członków", value: "{memberCount}", description: "Liczba członków na serwerze" },
  { name: "Regulamin", display: "Regulamin", value: "{rulesChannel}", description: "Kanał z regulaminem" },
  { name: "Role", display: "Role", value: "{rolesChannel}", description: "Kanał z rolami" },
  { name: "Czat", display: "Czat", value: "{chatChannel}", description: "Kanał czatu" },
];

const DISCORD_FONT_FAMILY = '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';

export function renderGreetingMessagePreview(message: string): string {
  return message
    .replace(/{user}/g, "@NowyUzytkownik")
    .replace(/{username}/g, "NowyUzytkownik")
    .replace(/{server}/g, "GameZone")
    .replace(/{memberCount}/g, "1 337")
    .replace(/{rulesChannel}/g, "#regulamin")
    .replace(/{rolesChannel}/g, "#role")
    .replace(/{chatChannel}/g, "#czat")
    .replace(/^###\s*/gm, "");
}

/** Discord-style pill for user/role mentions and channel mentions in the preview. */
function MentionChip({ kind, children }: { kind: "mention" | "channel"; children: React.ReactNode }) {
  return (
    <span
      className="rounded-[3px] font-medium"
      style={{ backgroundColor: "rgba(88, 101, 242, 0.3)", color: "#c9cdfb" }}
    >
      {kind === "channel" ? "#" : "@"}
      {children}
    </span>
  );
}

const RICH_VARIABLE_MAP: Record<string, { text: string; chip: "mention" | "channel" | null }> = {
  "{user}": { text: "NowyUzytkownik", chip: "mention" },
  "{username}": { text: "NowyUzytkownik", chip: null },
  "{server}": { text: "GameZone", chip: null },
  "{memberCount}": { text: "1 337", chip: null },
  "{rulesChannel}": { text: "regulamin", chip: "channel" },
  "{rolesChannel}": { text: "role", chip: "channel" },
  "{chatChannel}": { text: "czat", chip: "channel" },
};

const RICH_VARIABLE_PATTERN = new RegExp(
  `(${Object.keys(RICH_VARIABLE_MAP)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})`,
  "g"
);

/** Same substitution as renderGreetingMessagePreview, but mentions/channels render as Discord-style chips. */
function renderGreetingRichText(text: string): React.ReactNode {
  const clean = text.replace(/^###\s*/gm, "");
  if (!clean) return null;

  return clean.split(RICH_VARIABLE_PATTERN).map((part, index) => {
    const mapped = RICH_VARIABLE_MAP[part];
    if (!mapped) return <span key={index}>{part}</span>;
    if (!mapped.chip) return <span key={index}>{mapped.text}</span>;
    return (
      <MentionChip key={index} kind={mapped.chip}>
        {mapped.text}
      </MentionChip>
    );
  });
}

interface GreetingMessagePreviewProps {
  messageMode: GreetingMessageMode;
  titleText: string;
  message: string;
  embedColor: string;
  headerText: string;
  footerText: string;
  thumbnailUrl: string | null;
  headerIconUrl: string | null;
  footerIconUrl: string | null;
  imageUrl: string | null;
  onClick?: () => void;
}

export function GreetingMessagePreview({
  messageMode,
  titleText,
  message,
  embedColor,
  headerText,
  footerText,
  thumbnailUrl,
  headerIconUrl,
  footerIconUrl,
  imageUrl,
  onClick,
}: GreetingMessagePreviewProps) {
  const renderedTitle = renderGreetingMessagePreview(titleText);
  const renderedMessage = renderGreetingMessagePreview(message);
  const renderedHeader = renderGreetingMessagePreview(headerText);
  const renderedFooter = renderGreetingMessagePreview(footerText);
  const hasHeader = renderedHeader.trim().length > 0;
  const hasFooter = renderedFooter.trim().length > 0;

  if (messageMode === "text") {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-[432px] max-w-full rounded-md bg-dark-900 p-3 text-left text-[14px] leading-[20px] text-discord-text transition-colors hover:bg-[#1b1d24]"
        style={{ fontFamily: DISCORD_FONT_FAMILY }}
      >
        <p className="whitespace-pre-line break-words">{renderGreetingRichText(message)}</p>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="grid w-[432px] max-w-full cursor-pointer overflow-hidden rounded-[4px] border-l-[4px] bg-dark-900 text-left text-discord-text shadow-none whitespace-pre-wrap break-words text-[16px] leading-[22px]"
      style={{ borderLeftColor: embedColor, fontFamily: DISCORD_FONT_FAMILY }}
    >
      <div className="box-content w-[399px] max-w-[calc(100%_-_28px)] pt-2 pr-4 pb-4 pl-3">
        <div
          className={cn(
            "grid w-[399px] max-w-full grid-cols-[minmax(0,399px)]",
            thumbnailUrl && "grid-cols-[minmax(0,303px)_96px]"
          )}
        >
          <div className={cn("min-w-0", thumbnailUrl ? "w-[303px]" : "w-[399px]")}>
            {hasHeader ? (
              <div className="flex items-center gap-2 text-[12px] leading-4 text-discord-muted">
                {headerIconUrl ? <img src={headerIconUrl} alt="Ikona headera" className="h-8 w-8 rounded-[3px] object-cover" /> : null}
                <span>{renderGreetingRichText(headerText)}</span>
              </div>
            ) : null}

            {renderedTitle.trim().length > 0 ? (
              <p className={cn("font-semibold text-white text-base leading-5", hasHeader && "mt-2")}>{renderGreetingRichText(titleText)}</p>
            ) : null}

            <p className={cn("whitespace-pre-line break-words text-[14px] leading-[18px] text-discord-text", renderedTitle.trim().length > 0 && "mt-2")}>
              {renderGreetingRichText(message)}
            </p>
          </div>

          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="Miniatura embeda" className="ml-4 mt-2 h-20 w-20 shrink-0 rounded-[3px] object-cover" />
          ) : null}
        </div>

        {imageUrl ? (
          <img src={imageUrl} alt="Obraz embeda" className="mt-4 h-[213px] w-[399px] max-w-[400px] rounded-[3px] object-cover" />
        ) : null}

        {hasFooter ? (
          <div className="mt-4 flex items-center gap-2 text-[12px] leading-4 text-discord-muted">
            {footerIconUrl ? <img src={footerIconUrl} alt="Ikona footera" className="h-8 w-8 rounded-[3px] object-cover" /> : null}
            <span>{renderGreetingRichText(footerText)}</span>
          </div>
        ) : null}
      </div>
    </button>
  );
}
