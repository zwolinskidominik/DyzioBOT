import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  MessageFlags,
  type ButtonInteraction,
  type Interaction,
  type ModalSubmitInteraction,
  type UserSelectMenuInteraction,
} from 'discord.js';
import { z } from 'zod';
import { createErrorEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';
import { MC_IDS, buildWhitelistEmbed, parseMcCustomId } from '../../utils/minecraftEmbeds';
import { canManageWhitelist, canStartServer, memberRoleIds, type InteractionActor } from '../../services/minecraft/permissions';
import {
  getMinecraftRuntime,
  panelPayload,
  refreshPanel,
  updateStatsChannel,
  visibleView,
  type MinecraftRuntime,
} from '../../services/minecraft/runtime';
import { progressText } from '../../services/minecraft/startController';
import {
  listWhitelist,
  reconcileWhitelist,
  removeFromWhitelist,
  setWhitelistNick,
} from '../../services/minecraft/whitelistService';
import { MinecraftLinkModel } from '../../models/MinecraftLink';
import { MINECRAFT_NICK } from '../../services/minecraft/rconClient';
import { roleSyncNote, syncStarterRole } from '../../services/minecraft/playerRole';

/**
 * Przyciski, menu wyboru osoby i okienko z nickiem panelu /minecraft. Wszystkie customId mają
 * prefiks `mc:` i są walidowane Zodem; serwer i osoba zawsze z interakcji.
 */

type McInteraction = ButtonInteraction | UserSelectMenuInteraction | ModalSubmitInteraction;

const SnowflakeSchema = z.string().regex(/^\d{17,20}$/);

function actorOf(interaction: McInteraction): InteractionActor {
  return {
    userId: interaction.user.id,
    guildOwnerId: interaction.guild?.ownerId ?? null,
    permissions: interaction.memberPermissions,
    roleIds: memberRoleIds(interaction.member),
  };
}

async function replyEphemeral(interaction: McInteraction, text: string, isError = true): Promise<void> {
  const payload = isError
    ? { embeds: [createErrorEmbed(text)], flags: MessageFlags.Ephemeral as const }
    : { content: text, flags: MessageFlags.Ephemeral as const };
  if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
  else await interaction.reply(payload);
}

const NO_PERMISSION = 'Brak uprawnień.';

function formatCooldown(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.ceil((ms % 60_000) / 1000);
  return minutes > 0 ? `${minutes} min ${seconds} s` : `${seconds} s`;
}

/** Gdy serwer działa, wyrównaj whitelistę od razu (a nie dopiero w cyklu co minutę). */
function syncWhitelistSoon(rt: MinecraftRuntime, guildId: string): void {
  const snapshot = rt.monitor.snapshot;
  if (snapshot?.view.kind !== 'online' || !snapshot.ip) return;
  void reconcileWhitelist(guildId, { host: snapshot.ip, port: rt.config.rconPort, password: rt.config.rconPassword }).catch(
    (err: unknown) => logger.warn(`[MC] Natychmiastowe wyrównanie whitelisty nie powiodło się: ${err}`)
  );
}

/* ── Przyciski ───────────────────────────────────────────────── */

async function handleRefresh(interaction: ButtonInteraction, rt: MinecraftRuntime): Promise<void> {
  await interaction.deferUpdate();
  const snapshot = await rt.monitor.refresh();
  await interaction.editReply(panelPayload(rt, visibleView(rt, snapshot)));
}

async function handleStart(interaction: ButtonInteraction, rt: MinecraftRuntime): Promise<void> {
  if (!canStartServer(actorOf(interaction), rt.config.starterRoleId)) {
    await replyEphemeral(interaction, NO_PERMISSION);
    return;
  }
  if (rt.starter.inProgress) {
    await replyEphemeral(interaction, 'Serwer właśnie się uruchamia.', false);
    return;
  }
  const cooldown = rt.starter.cooldownRemaining();
  if (cooldown > 0) {
    await replyEphemeral(interaction, `Serwer był uruchamiany przed chwilą. Spróbuj za ${formatCooldown(cooldown)}.`, false);
    return;
  }

  await interaction.deferUpdate();
  const guild = interaction.guild!;
  const messageId = interaction.message.id;
  // Licznik od razu na „startuje” (jeśli pozwala limit zmian nazwy).
  void updateStatsChannel(guild, rt, { kind: 'starting', phase: 'machine' }).catch(() => undefined);

  const outcome = await rt.starter.start(async (snapshot) => {
    const extras = { progress: progressText(snapshot.view), startInProgress: true };
    await interaction.editReply(panelPayload(rt, snapshot.view, extras)).catch(() => undefined);
    await refreshPanel(guild, rt, snapshot.view, extras, messageId).catch(() => undefined);
  });

  if (outcome.kind === 'unavailable') {
    await replyEphemeral(interaction, 'Nie udało się uruchomić serwera, spróbuj za chwilę.');
    return;
  }
  if (outcome.kind === 'busy' || outcome.kind === 'cooldown') return;

  const finalText =
    outcome.kind === 'ready'
      ? `✅ Serwer gotowy - wchodźcie: \`${rt.config.displayHost}\``
      : '❌ Serwer nie wystartował w ciągu 5 minut. Kliknij „Odśwież” za chwilę, a jeśli dalej nic - daj znać administratorowi.';
  const extras = { progress: finalText, startInProgress: false };
  await interaction.editReply(panelPayload(rt, outcome.view, extras)).catch(() => undefined);
  await refreshPanel(guild, rt, outcome.view, extras, messageId).catch(() => undefined);
  void updateStatsChannel(guild, rt, outcome.view).catch(() => undefined);
}

async function handleList(interaction: ButtonInteraction, rt: MinecraftRuntime): Promise<void> {
  const result = await listWhitelist(rt.config.guildId);
  if (!result.ok) {
    await replyEphemeral(interaction, result.message);
    return;
  }
  await interaction.reply({ embeds: [buildWhitelistEmbed(result.data)], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
}

async function handleUserPicker(interaction: ButtonInteraction, mode: 'add' | 'remove'): Promise<void> {
  if (!canManageWhitelist(actorOf(interaction))) {
    await replyEphemeral(interaction, NO_PERMISSION);
    return;
  }
  const select = new UserSelectMenuBuilder()
    .setCustomId(mode === 'add' ? MC_IDS.addUserSelect : MC_IDS.removeUserSelect)
    .setPlaceholder(mode === 'add' ? 'Wybierz osobę do dodania' : 'Wybierz osobę do usunięcia')
    .setMinValues(1)
    .setMaxValues(1);
  await interaction.reply({
    content: mode === 'add' ? 'Kogo dodać do whitelisty? Potem wpiszesz jego nick z Minecrafta.' : 'Kogo usunąć z whitelisty?',
    components: [new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  });
}

/* ── Menu wyboru osoby ───────────────────────────────────────── */

async function handleUserSelected(interaction: UserSelectMenuInteraction, rt: MinecraftRuntime, mode: 'add' | 'remove'): Promise<void> {
  if (!canManageWhitelist(actorOf(interaction))) {
    await replyEphemeral(interaction, NO_PERMISSION);
    return;
  }
  const userId = SnowflakeSchema.safeParse(interaction.values[0]);
  if (!userId.success) {
    await replyEphemeral(interaction, 'Nie wybrano osoby.');
    return;
  }
  const user = interaction.users.get(userId.data);
  if (user?.bot) {
    await replyEphemeral(interaction, 'Bota nie da się dodać do whitelisty.');
    return;
  }

  if (mode === 'remove') {
    const result = await removeFromWhitelist(rt.config.guildId, userId.data);
    if (!result.ok) {
      await interaction.update({ content: `❌ ${result.message}`, components: [] });
      return;
    }
    const when = result.data.status === 'removing' ? ' Z serwera zniknie przy najbliższym włączeniu.' : '';
    const role = await syncStarterRole(interaction.guild!, userId.data, rt.config.starterRoleId, false);
    const roleText = role === 'done' ? ` Ranga <@&${rt.config.starterRoleId}> zabrana.` : roleSyncNote(role, false);
    await interaction.update({
      content: `🗑️ Usunięto <@${userId.data}> (**${result.data.nick}**) z whitelisty.${when}${roleText}`,
      components: [],
      allowedMentions: { parse: [] },
    });
    syncWhitelistSoon(rt, rt.config.guildId);
    return;
  }

  const existing = await MinecraftLinkModel.findOne({ guildId: rt.config.guildId, userId: userId.data }).lean();
  const nickInput = new TextInputBuilder()
    .setCustomId(MC_IDS.nickInput)
    .setLabel('Nick w Minecrafcie')
    .setStyle(TextInputStyle.Short)
    .setMinLength(3)
    .setMaxLength(16)
    .setRequired(true);
  if (existing?.nick && MINECRAFT_NICK.test(existing.nick)) nickInput.setValue(existing.nick);

  const modal = new ModalBuilder()
    .setCustomId(`${MC_IDS.addModalPrefix}${userId.data}`)
    .setTitle(`Whitelista: ${(user?.username ?? 'gracz').slice(0, 30)}`)
    .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nickInput));
  await interaction.showModal(modal);
}

/* ── Okienko z nickiem ───────────────────────────────────────── */

async function handleNickSubmitted(interaction: ModalSubmitInteraction, rt: MinecraftRuntime, userId: string): Promise<void> {
  if (!canManageWhitelist(actorOf(interaction))) {
    await replyEphemeral(interaction, NO_PERMISSION);
    return;
  }
  const nick = interaction.fields.getTextInputValue(MC_IDS.nickInput);
  const result = await setWhitelistNick(rt.config.guildId, userId, nick, interaction.user.id);
  if (!result.ok) {
    await interaction.reply({ embeds: [createErrorEmbed(result.message)], flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
    return;
  }
  // Nadanie rangi to dodatkowe zapytania do Discorda - nie ryzykujemy limitu 3 s na odpowiedź.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const { entry, changed } = result.data;
  const online = rt.monitor.snapshot?.view.kind === 'online';
  const status = !changed
    ? 'Ten nick już jest na whiteliście.'
    : online
      ? 'Dopisuję go na serwer.'
      : 'Zostanie dopisany przy najbliższym włączeniu serwera.';
  // Ranga do włączania serwera idzie razem z whitelistą (nadawana też przy samej zmianie nicka - nic nie szkodzi).
  const role = await syncStarterRole(interaction.guild!, entry.userId, rt.config.starterRoleId, true);
  const roleText = role === 'done' ? ` Ma rangę <@&${rt.config.starterRoleId}>.` : roleSyncNote(role, true);
  await interaction.editReply({
    content: `➕ <@${entry.userId}> → **${entry.nick}**. ${status}${roleText}`,
    allowedMentions: { parse: [] },
  });
  if (changed) syncWhitelistSoon(rt, rt.config.guildId);
}

/* ── Rozdzielnik ─────────────────────────────────────────────── */

export default async function run(interaction: Interaction): Promise<boolean | void> {
  if (!interaction.isButton() && !interaction.isUserSelectMenu() && !interaction.isModalSubmit()) return;
  if (!interaction.customId.startsWith('mc:')) return;

  const id = parseMcCustomId(interaction.customId);
  const rt = getMinecraftRuntime();
  if (!id || !rt || interaction.guildId !== rt.config.guildId || !interaction.guild) {
    await replyEphemeral(interaction, 'Ta funkcja nie działa na tym serwerze.').catch(() => undefined);
    return true;
  }

  try {
    if (interaction.isButton()) {
      if (id.kind === MC_IDS.refresh) await handleRefresh(interaction, rt);
      else if (id.kind === MC_IDS.start) await handleStart(interaction, rt);
      else if (id.kind === MC_IDS.list) await handleList(interaction, rt);
      else if (id.kind === MC_IDS.add) await handleUserPicker(interaction, 'add');
      else if (id.kind === MC_IDS.remove) await handleUserPicker(interaction, 'remove');
    } else if (interaction.isUserSelectMenu()) {
      if (id.kind === MC_IDS.addUserSelect) await handleUserSelected(interaction, rt, 'add');
      else if (id.kind === MC_IDS.removeUserSelect) await handleUserSelected(interaction, rt, 'remove');
    } else if (id.kind === MC_IDS.addModalPrefix) {
      await handleNickSubmitted(interaction, rt, id.userId);
    }
  } catch (err) {
    logger.error(`[MC] Błąd obsługi ${interaction.customId}: ${err}`);
    await replyEphemeral(interaction, 'Coś poszło nie tak. Spróbuj za chwilę.').catch(() => undefined);
  }
  return true;
}
