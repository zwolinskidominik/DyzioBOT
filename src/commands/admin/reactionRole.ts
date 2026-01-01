import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ButtonInteraction,
  ComponentType,
  TextChannel,
  Message,
  MessageFlags,
} from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { ReactionRoleModel } from '../../models/ReactionRole';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  ADD_REACTION: 'RR_ADD_REACTION',
  REMOVE_REACTION: 'RR_REMOVE_REACTION',
  SEND: 'RR_SEND',
  CANCEL: 'RR_CANCEL',
};

const COLLECTION_TIMEOUT = 1_800_000; // 15 min
const MAX_REACTIONS = 20;

export const data = new SlashCommandBuilder()
  .setName('reaction-role')
  .setDescription('Zarządzaj systemem reakcji → role')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setDMPermission(false)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('create')
      .setDescription('Utwórz nową wiadomość z reakcjami do ról')
      .addStringOption((option) =>
        option
          .setName('title')
          .setDescription('Tytuł embeda (opcjonalnie)')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('delete')
      .setDescription('Usuń wiadomość z reakcjami do ról')
      .addStringOption((option) =>
        option
          .setName('message-id')
          .setDescription('ID wiadomości do usunięcia')
          .setRequired(true)
      )
  );

export const options = {
  userPermissions: [PermissionFlagsBits.ManageRoles],
  botPermissions: [PermissionFlagsBits.ManageRoles],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  switch (subcommand) {
    case 'create':
      await handleCreate(interaction);
      break;
    case 'delete':
      await handleDelete(interaction);
      break;
  }
}

async function handleCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  const title = interaction.options.getString('title');
  const reactions: Array<{ emoji: string; roleId: string; description?: string }> = [];

  const previewEmbed = new EmbedBuilder()
    .setColor(COLORS.DEFAULT)
    .setTitle(title || 'Wybierz swoją rolę')
    .setDescription('_Brak skonfigurowanych reakcji. Użyj przycisku "Dodaj reakcję"._')
    .setFooter({ text: 'Kliknij reakcję, aby otrzymać rolę!' });

  const addButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.ADD_REACTION)
    .setLabel('Dodaj reakcję')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('➕');

  const removeButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.REMOVE_REACTION)
    .setLabel('Usuń reakcję')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('➖')
    .setDisabled(true);

  const sendButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.SEND)
    .setLabel('✓ Wyślij')
    .setStyle(ButtonStyle.Success)
    .setDisabled(true);

  const cancelButton = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    addButton,
    removeButton,
    sendButton,
    cancelButton
  );

  const replyData = await interaction.reply({
    content: '**Kreator wiadomości z reakcjami**\nDodaj reakcje i role, które użytkownicy będą mogli otrzymać.',
    embeds: [previewEmbed],
    components: [row],
    flags: MessageFlags.Ephemeral,
    withResponse: true,
  });

  const reply = replyData.resource?.message;
  if (!reply) return;

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: COLLECTION_TIMEOUT,
  });

  const updatePreview = async () => {
    const description = reactions.length
      ? reactions.map((r) => `${r.emoji} - <@&${r.roleId}>${r.description ? ` • ${r.description}` : ''}`).join('\n')
      : '_Brak skonfigurowanych reakcji. Użyj przycisku "Dodaj reakcję"._';

    previewEmbed.setDescription(description);
    previewEmbed.setFooter({ 
      text: `Kliknij reakcję, aby otrzymać rolę! | ${reactions.length}/${MAX_REACTIONS} reakcji` 
    });

    addButton.setDisabled(reactions.length >= MAX_REACTIONS);
    removeButton.setDisabled(reactions.length === 0);
    sendButton.setDisabled(reactions.length === 0);

    await interaction.editReply({
      embeds: [previewEmbed],
      components: [row],
    });
  };

  collector.on('collect', async (i: ButtonInteraction) => {
    if (i.customId === CUSTOM_ID.ADD_REACTION) {
      if (reactions.length >= MAX_REACTIONS) {
        await i.reply({
          content: `❌ Osiągnięto maksymalną liczbę reakcji (${MAX_REACTIONS}). Discord API ogranicza do 20 unikalnych reakcji na wiadomość.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await i.deferUpdate();
      
      await i.followUp({
        content: 'Podaj emoji, rolę i opcjonalny opis (format: `emoji @rola opis`)\nPrzykład: `👍 @Member Chcę być członkiem`',
        flags: MessageFlags.Ephemeral,
      });

      if (!interaction.channel || !('createMessageCollector' in interaction.channel)) return;

      const msgCollector = (interaction.channel as TextChannel).createMessageCollector({
        filter: (m: Message) => m.author.id === interaction.user.id,
        max: 1,
        time: 60_000,
      });

      msgCollector.on('collect', async (msg: Message) => {
        const parts = msg.content.trim().split(/\s+/);
        const emoji = parts[0];
        const roleMatch = parts[1]?.match(/<@&(\d+)>/) || parts[1]?.match(/(\d+)/);
        const description = parts.slice(2).join(' ');

        await msg.delete().catch(() => {});

        if (!emoji || !roleMatch) {
          await i.followUp({ 
            content: '❌ Nieprawidłowy format! Użyj: `emoji @rola opis`',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        const customEmojiMatch = emoji.match(/<a?:([^:]+):(\d+)>/);
        if (customEmojiMatch) {
          const emojiId = customEmojiMatch[2];
          const guildEmoji = interaction.guild?.emojis.cache.get(emojiId);
          if (!guildEmoji) {
            await i.followUp({ 
              content: '❌ To emoji nie istnieje na tym serwerze! Użyj emoji z tego serwera lub standardowego emoji.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        } else {
          try {
            if (interaction.channel && 'send' in interaction.channel) {
              const testMsg = await (interaction.channel as TextChannel).send('test');
              await testMsg.react(emoji);
              await testMsg.delete().catch(() => {});
            }
          } catch (error) {
            await i.followUp({ 
              content: '❌ Nieprawidłowe emoji! Użyj poprawnego emoji Unicode lub emoji z tego serwera.',
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        }

        const roleId = roleMatch[1];
        const role = interaction.guild?.roles.cache.get(roleId);

        if (!role) {
          await i.followUp({ 
            content: '❌ Nie znaleziono roli!',
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        reactions.push({ emoji, roleId, description: description || undefined });
        await updatePreview();
      });
    } else if (i.customId === CUSTOM_ID.REMOVE_REACTION) {
      const options = reactions.map((r, idx) => ({
        label: `${r.emoji} - Usuń tę reakcję`,
        value: idx.toString(),
        description: `Rola: ${interaction.guild?.roles.cache.get(r.roleId)?.name || r.roleId}`,
      }));

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('RR_SELECT_REMOVE')
        .setPlaceholder('Wybierz reakcję do usunięcia')
        .addOptions(options);

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await i.reply({
        content: 'Wybierz reakcję do usunięcia:',
        components: [selectRow],
        flags: MessageFlags.Ephemeral,
      });

      const selectCollector = i.channel?.createMessageComponentCollector({
        filter: (int) => int.user.id === interaction.user.id && int.customId === 'RR_SELECT_REMOVE',
        componentType: ComponentType.StringSelect,
        max: 1,
        time: 30_000,
      });

      selectCollector?.on('collect', async (selectInt: StringSelectMenuInteraction) => {
        const index = parseInt(selectInt.values[0]);
        reactions.splice(index, 1);
        await selectInt.update({ content: '✅ Reakcja usunięta!', components: [] });
        await updatePreview();
      });
    } else if (i.customId === CUSTOM_ID.SEND) {
      await i.deferUpdate();
      collector.stop('sent');

      const finalEmbed = new EmbedBuilder()
        .setColor(COLORS.DEFAULT)
        .setTitle(title || 'Wybierz swoją rolę')
        .setDescription(
          reactions.map((r) => `${r.emoji} - <@&${r.roleId}>${r.description ? ` • ${r.description}` : ''}`).join('\n')
        )
        .setFooter({ text: 'Kliknij reakcję, aby otrzymać rolę!' });

      if (!interaction.channel || !('send' in interaction.channel)) return;

      const message = await (interaction.channel as TextChannel).send({ embeds: [finalEmbed] });

      if (message) {
        for (const reaction of reactions) {
          await message.react(reaction.emoji).catch((err: Error) => {
            logger.error(`Nie można dodać reakcji ${reaction.emoji}: ${err}`);
          });
        }

        await ReactionRoleModel.create({
          guildId: interaction.guildId!,
          channelId: message.channelId,
          messageId: message.id,
          title: title || undefined,
          reactions: reactions.map((r) => ({
            emoji: r.emoji,
            roleId: r.roleId,
            description: r.description,
          })),
        });

        await interaction.editReply({
          content: `✅ Wiadomość z reakcjami została utworzona! [Przejdź do wiadomości](${message.url})`,
          embeds: [],
          components: [],
        });
      }
    } else if (i.customId === CUSTOM_ID.CANCEL) {
      await i.update({ content: '❌ Anulowano tworzenie wiadomości.', embeds: [], components: [] });
      collector.stop('cancelled');
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      await interaction.editReply({
        content: '⏱️ Upłynął czas na konfigurację.',
        components: [],
      });
    }
  });
}

async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  const messageId = interaction.options.getString('message-id', true);

  const reactionRole = await ReactionRoleModel.findOne({
    guildId: interaction.guildId!,
    messageId,
  });

  if (!reactionRole) {
    await interaction.reply({
      content: '❌ Nie znaleziono wiadomości z reakcjami o podanym ID.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const channel = interaction.guild?.channels.cache.get(reactionRole.channelId);
  if (channel && 'messages' in channel) {
    await channel.messages.delete(messageId).catch(() => {});
  }

  await ReactionRoleModel.deleteOne({ messageId });

  await interaction.reply({
    content: '✅ Wiadomość z reakcjami została usunięta.',
    flags: MessageFlags.Ephemeral,
  });
}
