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
} from 'discord.js';
import { TempChannelModel } from '../../models/TempChannel';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

export default async function run(interaction: Interaction): Promise<void> {
  try {
    // Handle button interactions
    if (interaction.isButton()) {
      switch (interaction.customId) {
        case 'voice_limit':
          await handleLimitButton(interaction);
          break;
        case 'voice_name':
          await handleNameButton(interaction);
          break;
        case 'voice_lock':
          await handleLockButton(interaction);
          break;
        case 'voice_kick':
          await handleKickButton(interaction);
          break;
        case 'voice_transfer':
          await handleTransferButton(interaction);
          break;
      }
    }

    // Handle modal submissions
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('voice_limit_modal_')) {
        await handleLimitModal(interaction);
      } else if (interaction.customId.startsWith('voice_name_modal_')) {
        await handleNameModal(interaction);
      }
    }

    // Handle select menu interactions
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId.startsWith('voice_kick_select_')) {
        await handleKickSelectMenu(interaction);
      } else if (interaction.customId.startsWith('voice_transfer_select_')) {
        await handleTransferSelectMenu(interaction);
      }
    }
  } catch (error) {
    logger.error(`Błąd w voice control handler: ${error}`);
  }
}

// ============================================================================
// LIMIT BUTTON & MODAL
// ============================================================================

async function handleLimitButton(interaction: ButtonInteraction): Promise<void> {
  try {
    if (!interaction.inGuild() || !interaction.channel) {
      await interaction.reply({
        content: 'Ta interakcja może być użyta tylko na serwerze.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Sprawdź czy to kanał tymczasowy i czy użytkownik jest właścicielem
    const tempChannel = await TempChannelModel.findOne({
      channelId: interaction.channelId,
    });

    if (!tempChannel) {
      await interaction.reply({
        content: '❌ To nie jest tymczasowy kanał głosowy.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (tempChannel.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ Tylko właściciel kanału może zarządzać tym kanałem.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Pokaż modal z inputem limitu
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

    const row = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(limitInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  } catch (error) {
    logger.error(`Błąd w voice_limit button: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas przetwarzania żądania.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleLimitModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    const limitValue = interaction.fields.getTextInputValue('limit_value');
    const limit = parseInt(limitValue, 10);

    if (isNaN(limit) || limit < 0 || limit > 99) {
      await interaction.reply({
        content: '❌ Limit musi być liczbą od 0 do 99.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Defer reply PRZED operacją setUserLimit
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.customId.split('_')[3];
    const channel = await interaction.guild?.channels.fetch(channelId);

    if (!channel || !(channel instanceof VoiceChannel)) {
      await interaction.editReply({
        content: '❌ Nie znaleziono kanału głosowego.',
      });
      return;
    }

    await channel.setUserLimit(limit);

    await interaction.editReply({
      content: `✅ Limit użytkowników został zmieniony na: ${limit === 0 ? 'brak limitu' : limit}`,
    });
  } catch (error) {
    logger.error(`Błąd w voice_limit modal: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas zmiany limitu.',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({
        content: '❌ Wystąpił błąd podczas zmiany limitu.',
      });
    }
  }
}

// ============================================================================
// NAME BUTTON & MODAL
// ============================================================================

async function handleNameButton(interaction: ButtonInteraction): Promise<void> {
  try {
    if (!interaction.inGuild() || !interaction.channel) {
      await interaction.reply({
        content: 'Ta interakcja może być użyta tylko na serwerze.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const tempChannel = await TempChannelModel.findOne({
      channelId: interaction.channelId,
    });

    if (!tempChannel) {
      await interaction.reply({
        content: '❌ To nie jest tymczasowy kanał głosowy.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (tempChannel.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ Tylko właściciel kanału może zarządzać tym kanałem.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

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

    const row = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(nameInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
  } catch (error) {
    logger.error(`Błąd w voice_name button: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas przetwarzania żądania.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleNameModal(interaction: ModalSubmitInteraction): Promise<void> {
  try {
    const newName = interaction.fields.getTextInputValue('name_value');
    
    // Defer reply PRZED operacją setName
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    
    const channelId = interaction.customId.split('_')[3];
    const channel = await interaction.guild?.channels.fetch(channelId);

    if (!channel || !(channel instanceof VoiceChannel)) {
      await interaction.editReply({
        content: '❌ Nie znaleziono kanału głosowego.',
      });
      return;
    }

    await channel.setName(newName);

    await interaction.editReply({
      content: `✅ Nazwa kanału została zmieniona na: **${newName}**`,
    });
  } catch (error) {
    logger.error(`Błąd w voice_name modal: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas zmiany nazwy.',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({
        content: '❌ Wystąpił błąd podczas zmiany nazwy.',
      });
    }
  }
}

// ============================================================================
// LOCK BUTTON
// ============================================================================

async function handleLockButton(interaction: ButtonInteraction): Promise<void> {
  try {
    if (!interaction.inGuild() || !interaction.channel || !interaction.guild) {
      await interaction.reply({
        content: 'Ta interakcja może być użyta tylko na serwerze.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const tempChannel = await TempChannelModel.findOne({
      channelId: interaction.channelId,
    });

    if (!tempChannel) {
      await interaction.reply({
        content: '❌ To nie jest tymczasowy kanał głosowy.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (tempChannel.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ Tylko właściciel kanału może zarządzać tym kanałem.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Defer reply PRZED długimi operacjami
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = await interaction.guild.channels.fetch(tempChannel.channelId);

    if (!channel || !(channel instanceof VoiceChannel)) {
      await interaction.editReply({
        content: '❌ Nie znaleziono kanału głosowego.',
      });
      return;
    }

    // Sprawdź aktualny stan blokady
    const everyonePermission = channel.permissionOverwrites.cache.get(interaction.guild.id);
    const isLocked = everyonePermission?.deny.has(PermissionFlagsBits.Connect);

    if (isLocked) {
      // Odblokuj kanał głosowy - usuń TYLKO Connect deny dla wszystkich
      const guildId = interaction.guild.id;
      
      // Usuń Connect deny dla @everyone (pozostaw inne uprawnienia)
      const everyoneOverwrite = channel.permissionOverwrites.cache.get(guildId);
      if (everyoneOverwrite && everyoneOverwrite.deny.has(PermissionFlagsBits.Connect)) {
        await channel.permissionOverwrites.edit(guildId, {
          Connect: null, // null = usuń override, przywróć domyślne
        });
      }
      
      // Usuń Connect deny/allow dla wszystkich ról które były zablokowane
      const roleOverwrites = channel.permissionOverwrites.cache.filter(
        overwrite => overwrite.type === 0 && overwrite.id !== guildId
      );
      
      await Promise.all(
        roleOverwrites.map(overwrite => {
          // Jeśli rola miała tylko Connect override, usuń całą overwrite
          // W przeciwnym razie usuń tylko Connect
          const permissions = overwrite.allow.toArray().length + overwrite.deny.toArray().length;
          if (permissions === 1 && overwrite.deny.has(PermissionFlagsBits.Connect)) {
            return channel.permissionOverwrites.delete(overwrite.id);
          } else {
            return channel.permissionOverwrites.edit(overwrite.id, { Connect: null });
          }
        })
      );
      
      // Usuń override właściciela jeśli miał tylko Connect
      const ownerOverwrite = channel.permissionOverwrites.cache.get(interaction.user.id);
      if (ownerOverwrite) {
        const ownerPerms = ownerOverwrite.allow.toArray().length + ownerOverwrite.deny.toArray().length;
        if (ownerPerms === 1 && ownerOverwrite.allow.has(PermissionFlagsBits.Connect)) {
          await channel.permissionOverwrites.delete(interaction.user.id);
        } else {
          await channel.permissionOverwrites.edit(interaction.user.id, { Connect: null });
        }
      }
      
      await interaction.editReply({
        content: '🔓 Kanał głosowy został odblokowany. Wszyscy mogą dołączyć.',
      });
    } else {
      // Zablokuj dołączanie głosowe dla WSZYSTKICH ról i użytkowników
      const guildId = interaction.guild.id;
      
      // 1. Zablokuj @everyone (pozostaw inne uprawnienia)
      await channel.permissionOverwrites.edit(guildId, {
        Connect: false,
      });
      
      // 2. Zablokuj WSZYSTKIE role (type 0 = Role)
      const rolesToBlock = channel.permissionOverwrites.cache.filter(
        overwrite => overwrite.type === 0 && overwrite.id !== guildId
      );
      
      await Promise.all(
        rolesToBlock.map(overwrite =>
          channel.permissionOverwrites.edit(overwrite.id, { Connect: false })
        )
      );
      
      // 3. Właściciel może dołączyć (nadpisuje wszystko)
      await channel.permissionOverwrites.edit(interaction.user.id, {
        Connect: true,
      });
      
      await interaction.editReply({
        content: '🔒 Kanał głosowy został zablokowany. Tylko Ty możesz dołączyć.',
      });
    }
  } catch (error) {
    logger.error(`Błąd w voice_lock button: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas zmiany blokady kanału.',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.editReply({
        content: '❌ Wystąpił błąd podczas zmiany blokady kanału.',
      });
    }
  }
}

// ============================================================================
// KICK BUTTON & SELECT MENU
// ============================================================================

async function handleKickButton(interaction: ButtonInteraction): Promise<void> {
  try {
    if (!interaction.inGuild() || !interaction.channel || !interaction.guild) {
      await interaction.reply({
        content: 'Ta interakcja może być użyta tylko na serwerze.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const tempChannel = await TempChannelModel.findOne({
      channelId: interaction.channelId,
    });

    if (!tempChannel) {
      await interaction.reply({
        content: '❌ To nie jest tymczasowy kanał głosowy.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (tempChannel.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ Tylko właściciel kanału może zarządzać tym kanałem.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = await interaction.guild.channels.fetch(tempChannel.channelId);

    if (!channel || !(channel instanceof VoiceChannel)) {
      await interaction.reply({
        content: '❌ Nie znaleziono kanału głosowego.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Pobierz członków kanału (bez właściciela)
    const members = Array.from(channel.members.values()).filter(
      (member) => member.id !== tempChannel.ownerId
    );

    if (members.length === 0) {
      await interaction.reply({
        content: '❌ Brak użytkowników do wyrzucenia.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Stwórz ładny embed z listą użytkowników
    const embed = createBaseEmbed({
      title: '🚪 Wyrzuć użytkownika',
      description: 'Wybierz użytkownika, którego chcesz wyrzucić z kanału głosowego:',
      timestamp: false,
    });

    // Stwórz select menu z lepszym formatowaniem
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`voice_kick_select_${tempChannel.channelId}`)
      .setPlaceholder('🎯 Wybierz użytkownika...')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        members.slice(0, 25).map((member) => ({
          label: member.displayName,
          description: `@${member.user.username}`,
          value: member.id,
          emoji: '👤',
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(`Błąd w voice_kick button: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas przetwarzania żądania.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleKickSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  try {
    const userId = interaction.values[0];
    const channelId = interaction.customId.split('_')[3];

    const channel = await interaction.guild?.channels.fetch(channelId);

    if (!channel || !(channel instanceof VoiceChannel)) {
      await interaction.update({
        content: '❌ Nie znaleziono kanału głosowego.',
        components: [],
      });
      return;
    }

    const member = channel.members.get(userId);

    if (!member) {
      await interaction.update({
        content: '❌ Użytkownik nie jest już na kanale.',
        components: [],
      });
      return;
    }

    await member.voice.disconnect();

    await interaction.update({
      content: `✅ Wyrzucono ${member.user.tag} z kanału.`,
      components: [],
    });
  } catch (error) {
    logger.error(`Błąd w voice_kick select menu: ${error}`);
    await interaction.update({
      content: '❌ Wystąpił błąd podczas wyrzucania użytkownika.',
      components: [],
    });
  }
}

// ============================================================================
// TRANSFER BUTTON & SELECT MENU
// ============================================================================

async function handleTransferButton(interaction: ButtonInteraction): Promise<void> {
  try {
    if (!interaction.inGuild() || !interaction.channel || !interaction.guild) {
      await interaction.reply({
        content: 'Ta interakcja może być użyta tylko na serwerze.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const tempChannel = await TempChannelModel.findOne({
      channelId: interaction.channelId,
    });

    if (!tempChannel) {
      await interaction.reply({
        content: '❌ To nie jest tymczasowy kanał głosowy.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (tempChannel.ownerId !== interaction.user.id) {
      await interaction.reply({
        content: '❌ Tylko właściciel kanału może zarządzać tym kanałem.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = await interaction.guild.channels.fetch(tempChannel.channelId);

    if (!channel || !(channel instanceof VoiceChannel)) {
      await interaction.reply({
        content: '❌ Nie znaleziono kanału głosowego.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Pobierz członków kanału (bez właściciela)
    const members = Array.from(channel.members.values()).filter(
      (member) => member.id !== tempChannel.ownerId
    );

    if (members.length === 0) {
      await interaction.reply({
        content: '❌ Brak użytkowników, którym można przekazać własność.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Stwórz ładny embed
    const embed = createBaseEmbed({
      title: '👑 Przekaż Własność',
      description: 
        '⚠️ **Uwaga!** Po przekazaniu własności stracisz kontrolę nad tym kanałem.\n\n' +
        'Wybierz użytkownika, któremu chcesz przekazać własność kanału:',
      timestamp: false,
    });

    // Stwórz select menu z lepszym formatowaniem
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`voice_transfer_select_${tempChannel.channelId}`)
      .setPlaceholder('👤 Wybierz nowego właściciela...')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        members.slice(0, 25).map((member) => ({
          label: member.displayName,
          description: `@${member.user.username}`,
          value: member.id,
          emoji: '👤',
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  } catch (error) {
    logger.error(`Błąd w voice_transfer button: ${error}`);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Wystąpił błąd podczas przetwarzania żądania.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

async function handleTransferSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
  try {
    const newOwnerId = interaction.values[0];
    const channelId = interaction.customId.split('_')[3];

    const tempChannel = await TempChannelModel.findOne({
      channelId,
    });

    if (!tempChannel) {
      await interaction.update({
        content: '❌ Nie znaleziono kanału tymczasowego.',
        components: [],
      });
      return;
    }

    const channel = await interaction.guild?.channels.fetch(channelId);

    if (!channel || !(channel instanceof VoiceChannel)) {
      await interaction.update({
        content: '❌ Nie znaleziono kanału głosowego.',
        components: [],
      });
      return;
    }

    const newOwner = channel.members.get(newOwnerId);

    if (!newOwner) {
      await interaction.update({
        content: '❌ Nowy właściciel nie jest już na kanale.',
        components: [],
      });
      return;
    }

    // Zaktualizuj właściciela w bazie
    const oldOwnerId = tempChannel.ownerId;
    tempChannel.ownerId = newOwnerId;
    await tempChannel.save();

    // Zaktualizuj uprawnienia kanału - nowy właściciel dostaje pełen dostęp
    await channel.permissionOverwrites.edit(newOwnerId, {
      ViewChannel: true,
      Connect: true,
      Speak: true,
      Stream: true,
    });

    // Usuń specjalne uprawnienia starego właściciela (jeśli nie jest @everyone)
    if (oldOwnerId !== interaction.guild?.id) {
      try {
        await channel.permissionOverwrites.delete(oldOwnerId);
      } catch (err) {
        // Ignoruj błąd jeśli nie ma uprawnień do usunięcia
      }
    }

    // Zaktualizuj panel kontrolny
    if (tempChannel.controlMessageId) {
      try {
        const controlMessage = await channel.messages.fetch(tempChannel.controlMessageId);

        const embed = createBaseEmbed({
          title: '🎛️ Panel Zarządzania Kanałem',
          description:
            `<@${newOwnerId}> - Witaj w swoim tymczasowym kanale!\n\n` +
            `Użyj przycisków poniżej, aby zarządzać tym kanałem głosowym.`,
          timestamp: false,
        });

        const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('voice_limit')
            .setLabel('Limit')
            .setEmoji('🔢')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('voice_name')
            .setLabel('Nazwa')
            .setEmoji('✏️')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId('voice_lock')
            .setLabel('Lock')
            .setEmoji('🔒')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('voice_kick')
            .setLabel('Kick')
            .setEmoji('⚡')
            .setStyle(ButtonStyle.Danger)
        );

        const buttons2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId('voice_transfer')
            .setLabel('Transfer')
            .setEmoji('👑')
            .setStyle(ButtonStyle.Success)
        );

        await controlMessage.edit({
          content: `<@${newOwnerId}>`,
          embeds: [embed],
          components: [buttons, buttons2],
        });
      } catch (err) {
        logger.error(`Błąd podczas aktualizacji panelu kontrolnego: ${err}`);
      }
    }

    await interaction.update({
      content: `✅ Własność kanału została przekazana ${newOwner.user.tag}`,
      components: [],
    });

    // Wyślij powiadomienie na kanale
    await channel.send({
      content: `👑 <@${oldOwnerId}> przekazał własność kanału użytkownikowi <@${newOwnerId}>`,
    });
  } catch (error) {
    logger.error(`Błąd w voice_transfer select menu: ${error}`);
    await interaction.update({
      content: '❌ Wystąpił błąd podczas przekazywania własności.',
      components: [],
    });
  }
}
