import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ChatInputCommandInteraction,
  Guild,
  MessageFlags,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelSelectMenuInteraction,
  ButtonInteraction,
  GuildBasedChannel,
  RoleSelectMenuBuilder,
  RoleSelectMenuInteraction,
} from 'discord.js';
import { BirthdayConfigurationModel } from '../../models/BirthdayConfiguration';
import type { IBirthdayConfiguration } from '../../interfaces/Models';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  CHANNEL_SELECT: 'birthday-channel-select',
  ROLE_SELECT: 'birthday-role-select',
  ROLE_REMOVE: 'birthday-role-remove',
  CONFIRM: 'birthday-confirm',
  CANCEL: 'birthday-cancel',
  STEP_ROLE: 'birthday-step-role',
};

const COLLECTION_TIMEOUT = 60_000;

export const data = new SlashCommandBuilder()
  .setName('config-birthday')
  .setDescription('Skonfiguruj ustawienia urodzin.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub.setName('set').setDescription('Konfiguruje kanał i rolę urodzinową.')
  )
  .addSubcommand((sub) =>
    sub.setName('remove').setDescription('Usuwa całą konfigurację urodzin.')
  )
  .addSubcommand((sub) =>
    sub.setName('show').setDescription('Wyświetla aktualną konfigurację urodzin.')
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
    logger.error(`Błąd podczas konfiguracji kanału urodzinowego: ${err}`);
    await replyWithError(interaction, 'Wystąpił błąd podczas konfiguracji kanału urodzinowego.');
  }
}

async function handleSetup(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.CHANNEL_SELECT)
    .setPlaceholder('Wybierz kanał urodzinowy')
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(1)
    .setMaxValues(1);

  const nextBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.STEP_ROLE)
    .setLabel('Dalej - wybór roli')
    .setStyle(ButtonStyle.Primary);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Danger);

  const menuRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelMenu);
  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(nextBtn, cancelBtn);

  const response = await interaction.editReply({
    content: '**Krok 1/2:** Wybierz kanał, na który bot będzie wysyłał życzenia urodzinowe:',
    components: [menuRow, btnRow],
  });

  const collector = response.createMessageComponentCollector({
    filter: (i): i is ChannelSelectMenuInteraction | ButtonInteraction =>
      i.user.id === interaction.user.id,
    time: COLLECTION_TIMEOUT,
  });

  let selectedChannelId: string | null = null;

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: 'Tylko osoba, która uruchomiła komendę może używać tych elementów.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await i.deferUpdate();

    if (i.isChannelSelectMenu()) {
      selectedChannelId = i.values[0];
      return;
    } else if (i.isButton()) {
      if (i.customId === CUSTOM_ID.CANCEL) {
        await interaction.editReply({ content: 'Konfiguracja anulowana.', components: [] });
        collector.stop();
        return;
      } else if (i.customId === CUSTOM_ID.STEP_ROLE) {
        if (!selectedChannelId) {
          await interaction.editReply({
            content: '**Krok 1/2:** Musisz wybrać kanał przed przejściem dalej.',
            components: [menuRow, btnRow],
          });
          return;
        }
        
        const channel = guild.channels.cache.get(selectedChannelId) as TextChannel | undefined;
        if (!channel) {
          await replyWithError(
            interaction,
            'Nie udało się znaleźć wybranego kanału. Spróbuj ponownie.'
          );
          collector.stop();
          return;
        }

        collector.stop();
        await handleRoleSetup(interaction, guild, channel);
      }
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      await interaction
        .editReply({
          content: 'Czas na wybór minął. Spróbuj ponownie.',
          components: [],
        })
        .catch(logger.error);
    }
  });
}

async function handleRoleSetup(interaction: ChatInputCommandInteraction, guild: Guild, selectedChannel: TextChannel): Promise<void> {
  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.ROLE_SELECT)
    .setPlaceholder('Wybierz rolę urodzinową (opcjonalnie)');

  const confirmBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CONFIRM)
    .setLabel('Zatwierdź konfigurację')
    .setStyle(ButtonStyle.Success);

  const noRoleBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.ROLE_REMOVE)
    .setLabel('Bez roli')
    .setStyle(ButtonStyle.Secondary);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Danger);

  const menuRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleMenu);
  const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, noRoleBtn, cancelBtn);

  const response = await interaction.editReply({
    content: `**Krok 2/2:** Wybierz rolę urodzinową (opcjonalnie):\n\n` +
             `✅ **Kanał:** <#${selectedChannel.id}>\n` +
             `🎭 **Rola:** Wybierz poniżej lub kliknij "Bez roli"`,
    components: [menuRow, btnRow],
  });

  const collector = response.createMessageComponentCollector({
    filter: (i): i is RoleSelectMenuInteraction | ButtonInteraction =>
      i.user.id === interaction.user.id,
    time: COLLECTION_TIMEOUT,
  });

  let selectedRoleId: string | null = null;

  collector.on('collect', async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: 'Tylko osoba, która uruchomiła komendę może używać tych elementów.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await i.deferUpdate();

    if (i.isRoleSelectMenu()) {
      selectedRoleId = i.values[0];
      const role = selectedRoleId ? guild.roles.cache.get(selectedRoleId) : null;
      
      await interaction.editReply({
        content: `**Krok 2/2:** Wybierz rolę urodzinową (opcjonalnie):\n\n` +
                 `✅ **Kanał:** <#${selectedChannel.id}>\n` +
                 `✅ **Rola:** ${role ? `<@&${role.id}>` : 'Nieznana rola'}`,
        components: [menuRow, btnRow],
      });
      return;
    } else if (i.isButton()) {
      if (i.customId === CUSTOM_ID.CANCEL) {
        await interaction.editReply({ content: 'Konfiguracja anulowana.', components: [] });
        collector.stop();
        return;
      } else if (i.customId === CUSTOM_ID.ROLE_REMOVE) {
        selectedRoleId = null;
        await interaction.editReply({
          content: `**Krok 2/2:** Wybierz rolę urodzinową (opcjonalnie):\n\n` +
                   `✅ **Kanał:** <#${selectedChannel.id}>\n` +
                   `✅ **Rola:** Bez roli urodzinowej`,
          components: [menuRow, btnRow],
        });
        return;
      } else if (i.customId === CUSTOM_ID.CONFIRM) {
        await finalizeConfiguration(interaction, guild, selectedChannel, selectedRoleId);
        collector.stop();
      }
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'time') {
      await interaction
        .editReply({
          content: 'Czas na wybór minął. Spróbuj ponownie.',
          components: [],
        })
        .catch(logger.error);
    }
  });
}

async function finalizeConfiguration(
  interaction: ChatInputCommandInteraction, 
  guild: Guild, 
  channel: TextChannel, 
  roleId: string | null
): Promise<void> {
  const updateData: any = { 
    guildId: guild.id, 
    birthdayChannelId: channel.id 
  };

  if (roleId) {
    const role = guild.roles.cache.get(roleId);
    if (!role) {
      await replyWithError(
        interaction,
        'Nie udało się znaleźć wybranej roli. Spróbuj ponownie.'
      );
      return;
    }
    updateData.roleId = roleId;
  } else {
    await BirthdayConfigurationModel.findOneAndUpdate(
      { guildId: guild.id },
      { $unset: { roleId: 1 } }
    );
  }

  await BirthdayConfigurationModel.findOneAndUpdate(
    { guildId: guild.id },
    updateData,
    { upsert: true, new: true }
  );

  logger.info(`Skonfigurowano urodziny w guildId=${guild.id}, kanał=${channel.id}, rola=${roleId || 'brak'}`);

  const embed = createBaseEmbed({
    title: '🎂 Konfiguracja urodzin',
    description: 'Konfiguracja urodzin została pomyślnie zapisana!',
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
  });

  embed.addFields({
    name: 'Kanał urodzinowy',
    value: `<#${channel.id}>`,
  });

  if (roleId) {
    const role = guild.roles.cache.get(roleId);
    embed.addFields({
      name: 'Rola urodzinowa',
      value: role ? `<@&${role.id}>` : `⚠️ Rola nie istnieje (ID: ${roleId})`,
    });
  } else {
    embed.addFields({
      name: 'Rola urodzinowa',
      value: 'Nie skonfigurowana',
    });
  }

  await interaction.editReply({ content: '', embeds: [embed], components: [] });
}



async function handleClear(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const cfg = await BirthdayConfigurationModel.findOne({ guildId: guild.id })
    .lean<IBirthdayConfiguration>()
    .exec();

  if (!cfg) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanej konfiguracji urodzin.\n' +
        'Aby skonfigurować, uruchom `/config-birthday set-channel`.'
    );
    return;
  }

  await BirthdayConfigurationModel.deleteOne({ guildId: guild.id });
  logger.info(`Usunięto całą konfigurację urodzin w guildId=${guild.id}`);

  await replyWithSuccess(
    interaction,
    'Usunięto całą konfigurację urodzin (kanał i rolę).\n' +
      'Aby skonfigurować ponownie, użyj komend `/config-birthday set-channel` i `/config-birthday set-role`.'
  );
}

async function handleShow(interaction: ChatInputCommandInteraction, guild: Guild): Promise<void> {
  const cfg = await BirthdayConfigurationModel.findOne({ guildId: guild.id })
    .lean<IBirthdayConfiguration>()
    .exec();

  if (!cfg?.birthdayChannelId) {
    await replyWithError(
      interaction,
      'Brak skonfigurowanego kanału do wysyłania życzeń urodzinowych.\n' +
        'Aby skonfigurować, uruchom `/config-birthday set`.'
    );
    return;
  }

  const channel = guild.channels.cache.get(cfg.birthdayChannelId) as GuildBasedChannel | undefined;
  if (!channel) {
    await replyWithError(interaction, 'Skonfigurowany kanał nie istnieje. Skonfiguruj ponownie.');
    return;
  }

  const embed = createBaseEmbed({
    title: '🎂 Konfiguracja urodzin',
    description: 'Aktualna konfiguracja urodzin:',
    footerText: guild?.name || '',
    footerIcon: guild?.iconURL() || undefined,
  });

  embed.addFields({
    name: 'Kanał urodzinowy',
    value: `<#${channel.id}>`,
  });

  if (cfg.roleId) {
    const role = guild.roles.cache.get(cfg.roleId);
    embed.addFields({
      name: 'Rola urodzinowa',
      value: role ? `<@&${role.id}>` : `⚠️ Rola nie istnieje (ID: ${cfg.roleId})`,
    });
  } else {
    embed.addFields({
      name: 'Rola urodzinowa',
      value: 'Nie skonfigurowana',
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function replyWithError(
  interaction: ChatInputCommandInteraction,
  msg: string
): Promise<void> {
  await interaction.editReply({ embeds: [createBaseEmbed({ isError: true, description: msg })] });
}

async function replyWithSuccess(
  interaction: ChatInputCommandInteraction,
  msg: string
): Promise<void> {
  await interaction.editReply({ embeds: [createBaseEmbed({ description: msg })] });
}
