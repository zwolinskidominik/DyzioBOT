interface BotInvitePopupOptions {
  onComplete?: () => void;
  onClosed?: () => void;
}

interface BotInviteCompleteMessage {
  type: "deezy:bot-invite-complete";
  success?: boolean;
  guildId?: string | null;
}

function isBotInviteCompleteMessage(value: unknown): value is BotInviteCompleteMessage {
  if (!value || typeof value !== "object") return false;
  return "type" in value && value.type === "deezy:bot-invite-complete";
}

export function buildBotInviteUrl(guildId: string, origin: string): string {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? "";
  const inviteUrl = new URL("https://discord.com/oauth2/authorize");

  inviteUrl.searchParams.set("client_id", clientId);
  inviteUrl.searchParams.set("permissions", "8");
  inviteUrl.searchParams.set("scope", "bot applications.commands");
  inviteUrl.searchParams.set("guild_id", guildId);
  inviteUrl.searchParams.set("disable_guild_select", "true");
  inviteUrl.searchParams.set("redirect_uri", `${origin}/bot-invite/callback`);
  inviteUrl.searchParams.set("response_type", "code");
  inviteUrl.searchParams.set("state", `bot_invite:${guildId}`);

  return inviteUrl.toString();
}

export function openBotInvitePopup(guildId: string, options: BotInvitePopupOptions = {}): void {
  const popupWidth = 540;
  const popupHeight = 760;
  const popupLeft = window.screenX + Math.max(0, (window.outerWidth - popupWidth) / 2);
  const popupTop = window.screenY + Math.max(0, (window.outerHeight - popupHeight) / 2);
  const inviteUrl = buildBotInviteUrl(guildId, window.location.origin);

  let closeWatcher: number | undefined;

  const cleanup = () => {
    window.removeEventListener("message", handleMessage);
    if (closeWatcher !== undefined) window.clearInterval(closeWatcher);
  };

  const handleComplete = () => {
    cleanup();
    options.onComplete?.();
  };

  function handleMessage(event: MessageEvent) {
    if (event.origin !== window.location.origin) return;
    if (!isBotInviteCompleteMessage(event.data)) return;
    if (event.data.guildId && event.data.guildId !== guildId) return;

    handleComplete();
  }

  const popup = window.open(
    inviteUrl,
    "deezy-bot-invite",
    `popup=yes,width=${popupWidth},height=${popupHeight},left=${Math.round(popupLeft)},top=${Math.round(popupTop)},resizable=yes,scrollbars=yes`,
  );

  if (!popup) {
    window.location.href = inviteUrl;
    return;
  }

  window.addEventListener("message", handleMessage);
  popup.focus();

  closeWatcher = window.setInterval(() => {
    if (!popup.closed) return;

    cleanup();
    options.onClosed?.();
  }, 800);
}
