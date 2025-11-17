import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  RoleSelectMenuBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Guild,
  Message,
  MessageFlags,
} from 'discord.js';
import { LevelConfigModel } from '../../models/LevelConfig';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

const CUSTOM_ID = {
  ROLE_SELECT: 'reward-role-select',
  CONFIRM: 'reward-confirm',
  CANCEL: 'reward-cancel',
};
const COLLECTOR_TIMEOUT = 60_000;

export const data = new SlashCommandBuilder()
  .setName('config-level-roles')
  .setDescription('Zarządzaj rolami-nagrodami za osiągnięcie poziomów')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)

  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Dodaj lub zaktualizuj rolę za konkretny poziom')
      .addIntegerOption((opt) =>
        opt.setName('poziom').setDescription('Numer poziomu').setRequired(true).setMinValue(1)
      )
  )

  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Usuń rolę-nagrodę dla podanego poziomu')
      .addIntegerOption((opt) =>
        opt.setName('poziom').setDescription('Numer poziomu').setRequired(true)
      )
  )

  .addSubcommand((sub) =>
    sub.setName('show').setDescription('Wyświetl wszystkie skonfigurowane role-nagrody')
  );

export const options = {
  userPermissions: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.ManageRoles],
};

export async function run({ interaction }: ICommandOptions) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (!interaction.guild) {
      return interaction.editReply('Ta komenda musi być użyta na serwerze.');
    }

    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'show') {
      return showAll(interaction, guild);
    }

    if (sub === 'remove') {
      const lvl = interaction.options.getInteger('poziom', true);
      return removeReward(interaction, guild, lvl);
    }

    const lvl = interaction.options.getInteger('poziom', true);
    return setupReward(interaction, guild, lvl);
  } catch (err) {
    logger.error(`config-level-roles error: ${err}`);
    interaction.editReply('❌ Wystąpił błąd przy konfiguracji nagród-ról.');
  }
}

async function showAll(inter: ChatInputCommandInteraction, guild: Guild) {
  const cfg = await LevelConfigModel.findOne({ guildId: guild.id }).lean();
  if (!cfg || cfg.roleRewards.length === 0) {
    return inter.editReply('⚠️ Brak skonfigurowanych nagród-ról.');
  }

  const list = cfg.roleRewards
    .sort((a, b) => a.level - b.level)
    .map((r) => `Poziom **${r.level}** ➜ <@&${r.roleId}>`)
    .join('\n');

  return inter.editReply(list);
}

async function removeReward(inter: ChatInputCommandInteraction, guild: Guild, level: number) {
  const cfg =
    (await LevelConfigModel.findOne({ guildId: guild.id })) ??
    new LevelConfigModel({ guildId: guild.id });

  const before = cfg.roleRewards.length;
  cfg.roleRewards = cfg.roleRewards.filter((r) => r.level !== level);
  await cfg.save();

  return inter.editReply(
    before === cfg.roleRewards.length
      ? `⚠️ Nie znaleziono nagrody dla poziomu ${level}.`
      : `✅ Usunięto rolę-nagrodę dla poziomu ${level}.`
  );
}

async function setupReward(inter: ChatInputCommandInteraction, guild: Guild, level: number) {
  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.ROLE_SELECT)
    .setPlaceholder('Wybierz dokładnie 1 rolę jako nagrodę')
    .setMinValues(1)
    .setMaxValues(1);

  const confirmBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CONFIRM)
    .setLabel('Zapisz')
    .setStyle(ButtonStyle.Success);

  const cancelBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.CANCEL)
    .setLabel('Anuluj')
    .setStyle(ButtonStyle.Danger);

  const msg = (await inter.editReply({
    content: `🔧 **Ustawiam nagrodę za poziom ${level}**\nWybierz rolę:`,
    components: [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleMenu),
      new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn),
    ],
  })) as Message;

  const col = msg.createMessageComponentCollector({
    time: COLLECTOR_TIMEOUT,
    filter: (i) =>
      i.user.id === inter.user.id &&
      [CUSTOM_ID.ROLE_SELECT, CUSTOM_ID.CONFIRM, CUSTOM_ID.CANCEL].includes(i.customId),
  });

  let pickedRoleId: string | null = null;

  col.on('collect', async (i) => {
    await i.deferUpdate();

    if (i.isRoleSelectMenu()) {
      pickedRoleId = i.values[0];
      return;
    }

    if (i.customId === CUSTOM_ID.CANCEL) {
      await inter.editReply({ content: 'Anulowano.', components: [] });
      col.stop();
      return;
    }

    if (!pickedRoleId) {
      await inter.editReply({
        content: '❌ Musisz wybrać rolę przed zatwierdzeniem.',
        components: [],
      });
      col.stop();
      return;
    }

    const cfg =
      (await LevelConfigModel.findOne({ guildId: guild.id })) ??
      new LevelConfigModel({ guildId: guild.id });

    cfg.roleRewards = cfg.roleRewards.filter((r) => r.level !== level);
    cfg.roleRewards.push({ level, roleId: pickedRoleId });
    await cfg.save();

    const embed = createBaseEmbed({
      title: '🔔 Nagroda-rola ustawiona',
      description: `Poziom **${level}** ➜ <@&${pickedRoleId}>`,
    });

    await inter.editReply({ embeds: [embed], components: [] });
    col.stop();
  });

  col.on('end', (_, reason) => {
    if (reason === 'time') {
      inter
        .editReply({ content: '⏱ Czas na konfigurację minął.', components: [] })
        .catch(logger.error);
    }
  });
}
