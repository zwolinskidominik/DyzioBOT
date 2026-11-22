import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbedField,
} from 'discord.js';
import { z } from 'zod';
import { isMachineUp, type ServerView } from '../services/minecraft/serverState';
import type { WhitelistEntry } from '../services/minecraft/whitelistService';

/** Identyfikatory przycisków, menu i okienek panelu /minecraft - zawsze z prefiksem `mc:`. */
export const MC_IDS = {
  refresh: 'mc:refresh',
  start: 'mc:start',
  list: 'mc:list',
  add: 'mc:add',
  remove: 'mc:remove',
  addUserSelect: 'mc:add-user',
  removeUserSelect: 'mc:remove-user',
  addModalPrefix: 'mc:add-modal:',
  nickInput: 'mc:nick',
} as const;

const StaticIdSchema = z.enum([
  MC_IDS.refresh,
  MC_IDS.start,
  MC_IDS.list,
  MC_IDS.add,
  MC_IDS.remove,
  MC_IDS.addUserSelect,
  MC_IDS.removeUserSelect,
]);
const AddModalIdSchema = z
  .string()
  .regex(/^mc:add-modal:\d{17,20}$/)
  .transform((id) => id.slice(MC_IDS.addModalPrefix.length));

export type McInteractionId =
  | { kind: z.infer<typeof StaticIdSchema> }
  | { kind: typeof MC_IDS.addModalPrefix; userId: string };

/** Rozpoznaje customId funkcji Minecraft. `null` = nie nasz albo nieprawidłowy. */
export function parseMcCustomId(customId: string): McInteractionId | null {
  const staticId = StaticIdSchema.safeParse(customId);
  if (staticId.success) return { kind: staticId.data };
  const modal = AddModalIdSchema.safeParse(customId);
  if (modal.success) return { kind: MC_IDS.addModalPrefix, userId: modal.data };
  return null;
}

export const MC_VERSION_LABEL = '1.20.1 Forge';
const MAX_LISTED_PLAYERS = 20;

const COLORS = {
  online: 0x57f287,
  starting: 0xfee75c,
  warning: 0xe67e22,
  offline: 0xed4245,
  unknown: 0x4c4c54,
} as const;

export interface PanelExtras {
  /** Etap uruchamiania („Maszyna startuje…”) albo komunikat końcowy. */
  progress?: string | undefined;
  startInProgress?: boolean | undefined;
  /** Kto włączył serwer przyciskiem ▶️ - pokazywane, dopóki maszyna działa. */
  startedBy?: StartedBy | null | undefined;
}

/** Specjalna wartość `startedBy.userId`: serwer włączył Claude (komenda właściciela bota), a nie osoba z Discorda. */
export const CLAUDE_STARTER = 'claude';

export interface StartedBy {
  userId: string;
  at: Date;
}

function stateLine(view: ServerView): { text: string; color: number } {
  switch (view.kind) {
    case 'online':
      return { text: '🟢 Online', color: COLORS.online };
    case 'starting':
      return {
        text: view.phase === 'machine' ? '🟡 Uruchamia się (maszyna startuje)' : '🟡 Uruchamia się (Minecraft się ładuje)',
        color: COLORS.starting,
      };
    case 'unresponsive':
      return { text: '⚠️ Serwer nie odpowiada', color: COLORS.warning };
    case 'stopping':
      return { text: '🔴 Wyłącza się', color: COLORS.offline };
    case 'offline':
      return { text: '🔴 Wyłączony', color: COLORS.offline };
    case 'unknown':
      return { text: '❔ Nie udało się sprawdzić stanu, spróbuj za chwilę', color: COLORS.unknown };
  }
}

/** Nicki są tylko [A-Za-z0-9_] (sprawdzone przy pingu), ale `_` w markdownie Discorda trzeba uciec. */
function escapeNick(nick: string): string {
  return nick.replace(/_/g, '\\_');
}

function playersValue(view: ServerView, maxPlayers: number): string {
  if (view.kind !== 'online') return `0/${maxPlayers}`;
  const count = `${view.online}/${view.max}`;
  if (view.online === 0) return count;
  if (view.players.length === 0) return count;
  const shown = view.players.slice(0, MAX_LISTED_PLAYERS).map(escapeNick).join(', ');
  const more = view.online > view.players.length ? ` i ${view.online - view.players.length} więcej` : '';
  return `${count}\n${shown}${more}`;
}

export function buildPanelEmbed(view: ServerView, host: string, extras: PanelExtras = {}): EmbedBuilder {
  const state = stateLine(view);
  const fields: APIEmbedField[] = [
    { name: 'Stan', value: state.text, inline: false },
    { name: 'Gracze', value: playersValue(view, 20), inline: true },
    { name: 'Adres', value: `\`${host}\``, inline: true },
    { name: 'Wersja', value: MC_VERSION_LABEL, inline: true },
  ];
  if (extras.startedBy && isMachineUp(view)) {
    // Wzmianka w embedzie nikogo nie pinguje; <t:…:R> Discord pokazuje jako „5 minut temu”.
    const unix = Math.floor(extras.startedBy.at.getTime() / 1000);
    const who = extras.startedBy.userId === CLAUDE_STARTER ? '🤖 Claude (AI)' : `<@${extras.startedBy.userId}>`;
    fields.push({ name: 'Włączył', value: `${who} <t:${unix}:R>`, inline: false });
  }
  const embed = new EmbedBuilder()
    .setColor(state.color)
    .setTitle('⛏️ Serwer Minecraft GameZone')
    .addFields(fields)
    .setFooter({ text: 'Serwer wyłącza się sam po 10 min bez graczy.' })
    .setTimestamp();
  if (extras.progress) embed.setDescription(extras.progress);
  return embed;
}

export function buildPanelButtons(view: ServerView, extras: PanelExtras = {}): ActionRowBuilder<ButtonBuilder>[] {
  const startDisabled = isMachineUp(view) || extras.startInProgress === true;
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(MC_IDS.refresh).setLabel('Odśwież').setEmoji('📊').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(MC_IDS.start)
        .setLabel('Uruchom serwer')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Success)
        .setDisabled(startDisabled),
      new ButtonBuilder().setCustomId(MC_IDS.list).setLabel('Whitelista').setEmoji('📋').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(MC_IDS.add).setLabel('Dodaj do whitelisty').setEmoji('➕').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(MC_IDS.remove).setLabel('Usuń z whitelisty').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
    ),
  ];
}

export function buildPanel(view: ServerView, host: string, extras: PanelExtras = {}) {
  return { embeds: [buildPanelEmbed(view, host, extras)], components: buildPanelButtons(view, extras) };
}

const STATUS_LABELS: Record<WhitelistEntry['status'], string> = {
  added: 'dodany',
  pending: 'czeka na włączenie serwera',
  no_such_player: '⚠️ błąd: nie ma takiego gracza w Minecrafcie',
  removing: 'usuwany (przy najbliższym włączeniu serwera)',
};

export function buildWhitelistEmbed(entries: WhitelistEntry[]): EmbedBuilder {
  const lines = entries.map((e) => `- <@${e.userId}> - **${escapeNick(e.nick)}** (${STATUS_LABELS[e.status]})`);
  return new EmbedBuilder()
    .setColor(COLORS.unknown)
    .setTitle('📋 Whitelista serwera GameZone')
    .setDescription(lines.length ? lines.join('\n').slice(0, 4000) : 'Nikt nie jest jeszcze na whiteliście.');
}
