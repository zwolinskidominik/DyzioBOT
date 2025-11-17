import {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  ChatInputCommandInteraction,
  Guild,
  GuildBasedChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ButtonInteraction,
  Message,
} from 'discord.js';
import { GreetingsConfigurationModel } from '../../models/GreetingsConfiguration';
import type { IGreetingsConfiguration } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  GREETINGS_SELECT: 'lobby-greetings-select',
  RULES_SELECT: 'lobby-rules-select',
  ROLES_SELECT: 'lobby-roles-select',
  CHAT_SELECT: 'lobby-chat-select',
  CONFIRM: 'lobby-confirm',
  CANCEL: 'lobby-cancel',
  STEP_RULES: 'lobby-step-rules',
  STEP_ROLES: 'lobby-step-roles',
  STEP_CHAT: 'lobby-step-chat',
};

const COLLECTION_TIMEOUT = 60_000;



export const data = new SlashCommandBuilder()
  .setName('config-lobby')
  .setDescription('Skonfiguruj system powitań (lobby).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub.setName('set').setDescription('Konfiguruje kanały systemu powitań.')
  )
  .addSubcommand((sub) => 
    sub.setName('remove').setDescription('Usuwa konfigurację systemu powitań.')
  )
  .addSubcommand((sub) =>
    sub.setName('show').setDescription('Wyświetla aktualną konfigurację systemu powitań.')
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],
};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
      await replyWithError(interaction, 'Ta komenda może być używana tylko na serwerze.');
      return;
    }

    const guild = interaction.guild;
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'set':
        await handleSetup(interaction, guild);
        break;
      case 'remove':
        await handleClear(interaction, guild);
        break;
      case 'show':
        await handleShow(interaction, guild);
        break;
    }
  } catch (err) {
    logger.error(`Błąd podczas konfiguracji kanału powitań: ${err}`);
    await replyWithError(interaction, 'Wystąpił błąd podczas konfiguracji kanału powitań.');
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  let greetingsChannelId: string | null = null;
  let rulesChannelId: string | null = null;
  let chatChannelId: string | null = null;
  let currentStep: 'greetings' | 'rules' | 'chat' = 'greetings';
  const rolesChannelId = 'customize-community';

  const updateMessage = async () => {
    const menus: ActionRowBuilder<ChannelSelectMenuBuilder>[] = [];
    const buttons: ButtonBuilder[] = [];

    if (currentStep === 'greetings') {
      const menu = new ChannelSelectMenuBuilder()
        .setCustomId(CUSTOM_ID.GREETINGS_SELECT)
        .setPlaceholder('Wybierz kanał powitań')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);
      menus.push(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu));

      buttons.push(
        new ButtonBuilder()
          .setCustomId(CUSTOM_ID.STEP_RULES)
          .setLabel('Dalej →')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!greetingsChannelId),
        new ButtonBuilder()
          .setCustomId(CUSTOM_ID.CANCEL)
          .setLabel('Anuluj')
          .setStyle(ButtonStyle.Danger)
      );
    } else if (currentStep === 'rules') {
      const menu = new ChannelSelectMenuBuilder()
        .setCustomId(CUSTOM_ID.RULES_SELECT)
        .setPlaceholder('Wybierz kanał regulaminu (opcjonalnie)')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(0)
        .setMaxValues(1);
      menus.push(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu));

      buttons.push(
        new ButtonBuilder()
          .setCustomId(CUSTOM_ID.STEP_CHAT)
          .setLabel('Dalej →')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(CUSTOM_ID.CANCEL)
          .setLabel('Anuluj')
          .setStyle(ButtonStyle.Danger)
      );
    } else if (currentStep === 'chat') {
      const menu = new ChannelSelectMenuBuilder()
        .setCustomId(CUSTOM_ID.CHAT_SELECT)
        .setPlaceholder('Wybierz główny kanał czatu (opcjonalnie)')
        .addChannelTypes(ChannelType.GuildText)
        .setMinValues(0)
        .setMaxValues(1);
      menus.push(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu));

      buttons.push(
        new ButtonBuilder()
          .setCustomId(CUSTOM_ID.CONFIRM)
          .setLabel('✓ Zatwierdź')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(CUSTOM_ID.CANCEL)
          .setLabel('Anuluj')
          .setStyle(ButtonStyle.Danger)
      );
    }

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    const components = [...menus, buttonRow];

    let description = '**Krok 1/3:** Wybierz kanał, na który będą wysyłane wiadomości powitalne\n\n';
    if (currentStep === 'rules') {
      description = '**Krok 2/3:** Wybierz kanał z regulaminem (opcjonalnie)\n\n';
    } else if (currentStep === 'chat') {
      description = '**Krok 3/3:** Wybierz główny kanał czatu (opcjonalnie)\n\n';
    }

    description += `📬 Kanał powitań: ${greetingsChannelId ? `<#${greetingsChannelId}>` : '❌ Nie wybrano'}\n`;
    description += `📜 Kanał regulaminu: ${rulesChannelId ? `<#${rulesChannelId}>` : '➖ Pominięto'}\n`;
    description += `🎭 Kanał wyboru ról: <id:customize>\n`;
    description += `💬 Główny czat: ${chatChannelId ? `<#${chatChannelId}>` : '➖ Pominięto'}`;

    await interaction.editReply({
      embeds: [createBaseEmbed({ title: '🎮 Konfiguracja Lobby', description })],
      components,
    });
  };

  await updateMessage();

  const reply = (await interaction.fetchReply()) as Message;
  const collector = reply.createMessageComponentCollector({
    filter: (i): i is ChannelSelectMenuInteraction | ButtonInteraction =>
      i.user.id === interaction.user.id,
    time: COLLECTION_TIMEOUT,
  });

  collector.on('collect', async (i) => {
    await i.deferUpdate();

    if (i.isChannelSelectMenu()) {
      if (i.customId === CUSTOM_ID.GREETINGS_SELECT) {
        greetingsChannelId = i.values[0] || null;
      } else if (i.customId === CUSTOM_ID.RULES_SELECT) {
        rulesChannelId = i.values[0] || null;
      } else if (i.customId === CUSTOM_ID.CHAT_SELECT) {
        chatChannelId = i.values[0] || null;
      }
      await updateMessage();
      return;
    }

    if (i.isButton()) {
      if (i.customId === CUSTOM_ID.STEP_RULES) {
        currentStep = 'rules';
        await updateMessage();
      } else if (i.customId === CUSTOM_ID.STEP_CHAT) {
        currentStep = 'chat';
        await updateMessage();
      } else if (i.customId === CUSTOM_ID.CONFIRM) {
        if (!greetingsChannelId) {
          await interaction.editReply({
            embeds: [createBaseEmbed({ isError: true, description: 'Musisz wybrać kanał powitań!' })],
            components: [],
          });
          collector.stop();
          return;
        }

        await GreetingsConfigurationModel.findOneAndUpdate(
          { guildId: guild.id },
          {
            guildId: guild.id,
            greetingsChannelId,
            rulesChannelId,
            rolesChannelId,
            chatChannelId,
          },
          { upsert: true, new: true }
        );

        const fields = [
          { name: 'Kanał powitań', value: `<#${greetingsChannelId}>`, inline: false },
        ];
        if (rulesChannelId) fields.push({ name: 'Kanał regulaminu', value: `<#${rulesChannelId}>`, inline: true });
        fields.push({ name: 'Kanał wyboru ról', value: '<id:customize>', inline: true });
        if (chatChannelId) fields.push({ name: 'Główny czat', value: `<#${chatChannelId}>`, inline: true });

        await interaction.editReply({
          embeds: [
            createBaseEmbed({
              title: '✅ Konfiguracja zapisana!',
              description: 'System lobby został pomyślnie skonfigurowany.',
              footerText: guild.name,
              footerIcon: guild.iconURL() || undefined,
            }).addFields(fields),
          ],
          components: [],
        });
        collector.stop();
      } else if (i.customId === CUSTOM_ID.CANCEL) {
        await interaction.editReply({
          embeds: [createBaseEmbed({ description: 'Konfiguracja anulowana.' })],
          components: [],
        });
        collector.stop();
      }
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      await interaction.editReply({
        embeds: [createBaseEmbed({ isError: true, description: 'Czas na konfigurację minął. Spróbuj ponownie.' })],
        components: [],
      });
    }
  });
}

async function handleClear(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const cfg = await GreetingsConfigurationModel.findOne({ guildId: guild.id })
    .lean<IGreetingsConfiguration>()
    .exec();

  if (!cfg) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału powitań.\n' + 'Aby skonfigurować, uruchom `/config-lobby set`.'
    );
    return;
  }

  await GreetingsConfigurationModel.deleteOne({ guildId: guild.id });
  await replyWithSuccess(
    interaction,
    'Kanał powitań został wyłączony.\n' + 'Aby skonfigurować ponownie, uruchom `/config-lobby set`.'
  );
}

async function handleShow(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const cfg = await GreetingsConfigurationModel.findOne({ guildId: guild.id })
    .lean<IGreetingsConfiguration>()
    .exec();

  if (!cfg?.greetingsChannelId) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału powitań.\n' + 'Aby skonfigurować, uruchom `/config-lobby set`.'
    );
    return;
  }

  const channel = guild.channels.cache.get(cfg.greetingsChannelId) as GuildBasedChannel | undefined;
  if (!channel) {
    await replyWithError(interaction, 'Skonfigurowany kanał nie istnieje. Skonfiguruj ponownie.');
    return;
  }

  const fields = [
    { name: 'Kanał powitań', value: `<#${cfg.greetingsChannelId}>`, inline: false },
  ];

  if (cfg.rulesChannelId) {
    fields.push({ name: 'Kanał regulaminu', value: `<#${cfg.rulesChannelId}>`, inline: true });
  }
  fields.push({ name: 'Kanał wyboru ról', value: '<id:customize>', inline: true });
  if (cfg.chatChannelId) {
    fields.push({ name: 'Główny czat', value: `<#${cfg.chatChannelId}>`, inline: true });
  }

  const embed = createBaseEmbed({
    title: '🎮 Konfiguracja Lobby',
    description: 'Aktualna konfiguracja systemu powitań:',
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
  }).addFields(fields);

  await interaction.editReply({ embeds: [embed] });
}

async function replyWithError(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  await interaction.editReply({
    embeds: [createBaseEmbed({ isError: true, description: message })],
  });
}

async function replyWithSuccess(
  interaction: ChatInputCommandInteraction,
  message: string
): Promise<void> {
  await interaction.editReply({
    embeds: [createBaseEmbed({ description: message })],
  });
}
