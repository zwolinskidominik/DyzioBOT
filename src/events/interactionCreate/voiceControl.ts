import {
  Interaction,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  VoiceChannel,
  PermissionFlagsBits,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
} from 'discord.js';
import {
  validateOwnership as serviceValidateOwnership,
  transferOwnership as serviceTransferOwnership,
  getTempChannel,
  type TempChannelData,
} from '../../services/tempChannelService';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { safeSetChannelName } from '../../utils/channelHelpers';
import logger from '../../utils/logger';

// ── Helpers ────────────────────────────────────────────────────────

type AnyVoiceInteraction = ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;

/** Reply or editReply depending on interaction state. */
async function safeErrorReply(interaction: AnyVoiceInteraction, message: string): Promise<void> {
  if (!interaction.replied && !interaction.deferred) {
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
  } else {
    await interaction.editReply({ content: message });
  }
}

/** Validate guild context, temp channel existence & ownership. Returns data or null (after replying with error). */
async function validateOwnership(interaction: ButtonInteraction): Promise<TempChannelData | null> {
  if (!interaction.inGuild() || !interaction.channel || !interaction.guild) {
    await interaction.reply({
      content: 'Ta interakcja może być użyta tylko na serwerze.',
      flags: MessageFlags.Ephemeral,
    });
    return null;
  }

  const result = await serviceValidateOwnership(interaction.channelId!, interaction.user.id);

  if (!result.ok) {
    const msg = result.code === 'NOT_FOUND'
      ? '❌ To nie jest tymczasowy kanał głosowy.'
      : '❌ Tylko właściciel kanału może zarządzać tym kanałem.';
    await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    return null;
  }

  return result.data;
}

/** Fetch a VoiceChannel by ID, returning null if not found. */
async function fetchVoiceChannel(
  interaction: AnyVoiceInteraction,
  channelId: string,
): Promise<VoiceChannel | null> {
  const channel = await interaction.guild?.channels.fetch(channelId);
  if (!channel || !(channel instanceof VoiceChannel)) return null;
  return channel;
}

/** Get voice channel members excluding the owner. */
function getOtherMembers(channel: VoiceChannel, ownerId: string): GuildMember[] {
  return Array.from(channel.members.values()).filter((m) => m.id !== ownerId);
}

/** Build a select menu listing voice channel members. */
function buildMemberSelect(
  members: GuildMember[],
  customId: string,
  placeholder: string,
): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      members.slice(0, 25).map((m) => ({
        label: m.displayName,
        description: `@${m.user.username}`,
        value: m.id,
        emoji: '👤',
      })),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/** Build the standard voice control panel button rows. Shared with tempChannel.ts. */
export function createControlPanelButtons(): [
  ActionRowBuilder<ButtonBuilder>,
  ActionRowBuilder<ButtonBuilder>,
] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('voice_limit').setLabel('Limit').setEmoji('🔢').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('voice_name').setLabel('Nazwa').setEmoji('✏️').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('voice_lock').setLabel('Lock').setEmoji('🔒').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('voice_kick').setLabel('Kick').setEmoji('⚡').setStyle(ButtonStyle.Danger),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('voice_transfer').setLabel('Transfer').setEmoji('👑').setStyle(ButtonStyle.Success),
  );
  return [row1, row2];
}

// ── Main router ────────────────────────────────────────────────────

export default async function run(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isButton()) {
      switch (interaction.customId) {
        case 'voice_limit':    return handleLimitButton(interaction);
        case 'voice_name':     return handleNameButton(interaction);
        case 'voice_lock':     return handleLockButton(interaction);
        case 'voice_kick':     return handleKickButton(interaction);
        case 'voice_transfer': return handleTransferButton(interaction);
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('voice_limit_modal_')) return handleLimitModal(interaction);
      if (interaction.customId.startsWith('voice_name_modal_'))  return handleNameModal(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('voice_kick_select_'))     return handleKickSelectMenu(interaction);
      if (interaction.customId.startsWith('voice_transfer_select_')) return handleTransferSelectMenu(interaction);
    }
  } catch (error) {
    logger.error(`Błąd w voice control handler: ${error}`);
  }
}

// ── Button handlers ────────────────────────────────────────────────

async function handleLimitButton(interaction: ButtonInteraction): Promise<void> {
  try {
    if (!await validateOwnership(interaction)) return;

    const modal = new ModalBuilder()
      .setCustomId(`voice_limit_modal_${interaction.channelId}`)
      .setTitle('Zmiana limitu użytkowników');

    const limitInput = new TextInputBuilder()
      .setCustomId('limit_value')
      .setLabel('Limit użytkowników (0 = brak limitu)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Wprowadź liczbę od 0 do 99')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2);

    modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(limitInput));
    await interaction.showModal(modal);
  } catch (error) {
    logger.error(`Błąd w voice_limit button: ${error}`);
    await safeErrorReply(interaction, '❌ Wystąpił błąd podczas przetwarzania żądania.');
  }
}

async function handleNameButton(interaction: ButtonInteraction): Promise<void> {
  try {
    if (!await validateOwnership(interaction)) return;

    const modal = new ModalBuilder()
      .setCustomId(`voice_name_modal_${interaction.channelId}`)
      .setTitle('Zmiana nazwy kanału');

    const nameInput = new TextInputBuilder()
      .setCustomId('name_value')
      .setLabel('Nowa nazwa kanału')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Wprowadź nową nazwę kanału')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(100);

    modal.addComponents(new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput));
    await interaction.showModal(modal);
  } catch (error) {
    logger.error(`Błąd w voice_name button: ${error}`);
    await safeErrorReply(interaction, '❌ Wystąpił błąd podczas przetwarzania żądania.');
  }
}

async function handleLockButton(interaction: ButtonInteraction): Promise<void> {
  try {
    const tempChannel = await validateOwnership(interaction);
    if (!tempChannel) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = await fetchVoiceChannel(interaction, tempChannel.channelId);
    if (!channel) {
      await interaction.editReply({ content: '❌ Nie znaleziono kanału głosowego.' });
      return;
    }

    const guildId = interaction.guild!.id;
    const everyoneOverwrite = channel.permissionOverwrites.cache.get(guildId);
    const isLocked = everyoneOverwrite?.deny.has(PermissionFlagsBits.Connect);

    if (isLocked) {
      await unlockChannel(channel, guildId, interaction.user.id);
      await interaction.editReply({ content: '🔓 Kanał głosowy został odblokowany. Wszyscy mogą dołączyć.' });
    } else {
      await lockChannel(channel, guildId, interaction.user.id);
      await interaction.editReply({ content: '🔒 Kanał głosowy został zablokowany. Tylko Ty możesz dołączyć.' });
    }
  } catch (error) {
    logger.error(`Błąd w voice_lock button: ${error}`);
    await safeErrorReply(interaction, '❌ Wystąpił błąd podczas zmiany blokady kanału.');
  }
}

async function handleKickButton(interaction: ButtonInteraction): Promise<void> {
  try {
    const tempChannel = await validateOwnership(interaction);
    if (!tempChannel) return;

    const channel = await fetchVoiceChannel(interaction, tempChannel.channelId);
    if (!channel) {
      await interaction.reply({ content: '❌ Nie znaleziono kanału głosowego.', flags: MessageFlags.Ephemeral });
      return;
    }

    const members = getOtherMembers(channel, tempChannel.ownerId);
    if (members.length === 0) {
      await interaction.reply({ content: '❌ Brak użytkowników do wyrzucenia.', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = createBaseEmbed({
      title: '🚪 Wyrzuć użytkownika',
      description: 'Wybierz użytkownika, którego chcesz wyrzucić z kanału głosowego:',
      timestamp: false,
    });

    const row = buildMemberSelect(members, `voice_kick_select_${tempChannel.channelId}`, '🎯 Wybierz użytkownika...');
    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  } catch (error) {
    logger.error(`Błąd w voice_kick button: ${error}`);
    await safeErrorReply(interaction, '❌ Wystąpił błąd podczas przetwarzania żądania.');
  }
}

async function handleTransferButton(interaction: ButtonInteraction): Promise<void> {
  try {
    const tempChannel = await validateOwnership(interaction);
    if (!tempChannel) return;

    const channel = await fetchVoiceChannel(interaction, tempChannel.channelId);
    if (!channel) {
      await interaction.reply({ content: '❌ Nie znaleziono kanału głosowego.', flags: MessageFlags.Ephemeral });
      return;
    }

    const members = getOtherMembers(channel, tempChannel.ownerId);
    if (members.length === 0) {
      await interaction.reply({
        content: '❌ Brak użytkowników, którym można przekazać własność.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const embed = createBaseEmbed({
      title: '👑 Przekaż Własność',
      description:
        '⚠️ **Uwaga!** Po przekazaniu własności stracisz kontrolę nad tym kanałem.\n\n' +
        'Wybierz użytkownika, któremu chcesz przekazać własność kanału:',
      timestamp: false,
    });

    const row = buildMemberSelect(members, `voice_transfer_select_${tempChannel.channelId}`, '👤 Wybierz nowego właściciela...');
    await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
  } catch (error) {
    logger.error(`Błąd w voice_transfer button: ${error}`);
    await safeErrorReply(interaction, '❌ Wystąpił błąd podczas przetwarzania żądania.');
  }
}

// ── Lock / Unlock helpers ──────────────────────────────────────────

async function lockChannel(channel: VoiceChannel, guildId: string, ownerId: string): Promise<void> {
  await channel.permissionOverwrites.edit(guildId, { Connect: false });

  const rolesToBlock = channel.permissionOverwrites.cache.filter(
    (ow) => ow.type === 0 && ow.id !== guildId,
  );
  await Promise.all(
    rolesToBlock.map((ow) => channel.permissionOverwrites.edit(ow.id, { Connect: false })),
  );

  await channel.permissionOverwrites.edit(ownerId, { Connect: true });
}

async function unlockChannel(channel: VoiceChannel, guildId: string, ownerId: string): Promise<void> {
  const everyoneOverwrite = channel.permissionOverwrites.cache.get(guildId);
  if (everyoneOverwrite?.deny.has(PermissionFlagsBits.Connect)) {
    await channel.permissionOverwrites.edit(guildId, { Connect: null });
  }

  const roleOverwrites = channel.permissionOverwrites.cache.filter(
    (ow) => ow.type === 0 && ow.id !== guildId,
  );
  await Promise.all(
    roleOverwrites.map((ow) => {
      const perms = ow.allow.toArray().length + ow.deny.toArray().length;
      if (perms === 1 && ow.deny.has(PermissionFlagsBits.Connect)) {
        return channel.permissionOverwrites.delete(ow.id);
      }
      return channel.permissionOverwrites.edit(ow.id, { Connect: null });
    }),
  );

  const ownerOverwrite = channel.permissionOverwrites.cache.get(ownerId);
  if (ownerOverwrite) {
    const ownerPerms = ownerOverwrite.allow.toArray().length + ownerOverwrite.deny.toArray().length;
    if (ownerPerms === 1 && ownerOverwrite.allow.has(PermissionFlagsBits.Connect)) {
      await channel.permissionOverwrites.delete(ownerId);
    } else {
      await channel.permissionOverwrites.edit(ownerId, { Connect: null });
    }
  }
}

// ── Modal handlers ─────────────────────────────────────────────────

async function handleLimitModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    const limitValue = interaction.fields.getTextInputValue('limit_value');
    const limit = parseInt(limitValue, 10);

    if (isNaN(limit) || limit < 0 || limit > 99) {
      await interaction.reply({ content: '❌ Limit musi być liczbą od 0 do 99.', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = await fetchVoiceChannel(interaction, interaction.customId.split('_')[3]);
    if (!channel) {
      await interaction.editReply({ content: '❌ Nie znaleziono kanału głosowego.' });
      return;
    }

    await channel.setUserLimit(limit);
    await interaction.editReply({
      content: `✅ Limit użytkowników został zmieniony na: ${limit === 0 ? 'brak limitu' : limit}`,
    });
  } catch (error) {
    logger.error(`Błąd w voice_limit modal: ${error}`);
    await safeErrorReply(interaction, '❌ Wystąpił błąd podczas zmiany limitu.');
  }
}

async function handleNameModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    const newName = interaction.fields.getTextInputValue('name_value');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = await fetchVoiceChannel(interaction, interaction.customId.split('_')[3]);
    if (!channel) {
      await interaction.editReply({ content: '❌ Nie znaleziono kanału głosowego.' });
      return;
    }

    await safeSetChannelName(channel, newName);
    await interaction.editReply({ content: `✅ Nazwa kanału została zmieniona na: **${newName}**` });
  } catch (error) {
    logger.error(`Błąd w voice_name modal: ${error}`);
    await safeErrorReply(interaction, '❌ Wystąpił błąd podczas zmiany nazwy.');
  }
}

// ── Select menu handlers ───────────────────────────────────────────

async function handleKickSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  try {
    const userId = interaction.values[0];
    const channel = await fetchVoiceChannel(interaction, interaction.customId.split('_')[3]);

    if (!channel) {
      await interaction.update({ content: '❌ Nie znaleziono kanału głosowego.', components: [] });
      return;
    }

    const member = channel.members.get(userId);
    if (!member) {
      await interaction.update({ content: '❌ Użytkownik nie jest już na kanale.', components: [] });
      return;
    }

    await member.voice.disconnect();
    await interaction.update({ content: `✅ Wyrzucono ${member.user.tag} z kanału.`, components: [] });
  } catch (error) {
    logger.error(`Błąd w voice_kick select menu: ${error}`);
    await interaction.update({ content: '❌ Wystąpił błąd podczas wyrzucania użytkownika.', components: [] });
  }
}

async function handleTransferSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  try {
    const newOwnerId = interaction.values[0];
    const channelId = interaction.customId.split('_')[3];

    const tcResult = await getTempChannel(channelId);
    const tempChannelData = tcResult.ok ? tcResult.data : null;
    if (!tempChannelData) {
      await interaction.update({ content: '❌ Nie znaleziono kanału tymczasowego.', components: [] });
      return;
    }

    const channel = await fetchVoiceChannel(interaction, channelId);
    if (!channel) {
      await interaction.update({ content: '❌ Nie znaleziono kanału głosowego.', components: [] });
      return;
    }

    const newOwner = channel.members.get(newOwnerId);
    if (!newOwner) {
      await interaction.update({ content: '❌ Nowy właściciel nie jest już na kanale.', components: [] });
      return;
    }

    const transferResult = await serviceTransferOwnership(channelId, newOwnerId);
    if (!transferResult.ok) {
      await interaction.update({ content: '❌ Wystąpił błąd podczas przekazywania własności.', components: [] });
      return;
    }
    const { oldOwnerId } = transferResult.data;

    await channel.permissionOverwrites.edit(newOwnerId, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      Stream: true,
    });

    if (oldOwnerId !== interaction.guild?.id) {
      await channel.permissionOverwrites.delete(oldOwnerId).catch(() => {});
    }

    if (tempChannelData.controlMessageId) {
      try {
        const controlMessage = await channel.messages.fetch(tempChannelData.controlMessageId);
        const embed = createBaseEmbed({
          title: '🎛️ Panel Zarządzania Kanałem',
          description:
            `<@${newOwnerId}> - Witaj w swoim tymczasowym kanale!\n\n` +
            'Użyj przycisków poniżej, aby zarządzać tym kanałem głosowym.',
          timestamp: false,
        });
        const [buttons, buttons2] = createControlPanelButtons();
        await controlMessage.edit({ content: `<@${newOwnerId}>`, embeds: [embed], components: [buttons, buttons2] });
      } catch (err) {
        logger.error(`Błąd podczas aktualizacji panelu kontrolnego: ${err}`);
      }
    }

    await interaction.update({ content: `✅ Własność kanału została przekazana ${newOwner.user.tag}`, components: [] });
    await channel.send({ content: `👑 <@${oldOwnerId}> przekazał własność kanału użytkownikowi <@${newOwnerId}>` });
  } catch (error) {
    logger.error(`Błąd w voice_transfer select menu: ${error}`);
    await interaction.update({ content: '❌ Wystąpił błąd podczas przekazywania własności.', components: [] });
  }
}
