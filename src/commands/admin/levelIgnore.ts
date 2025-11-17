import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionsBitField,
} from 'discord.js';
import { LevelConfigModel } from '../../models/LevelConfig';

export const data = new SlashCommandBuilder()
  .setName('level-ignore')
  .setDescription('Zarządzaj ignorowanymi kanałami i rolami w systemie XP')
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addSubcommandGroup((group) =>
    group
      .setName('channel')
      .setDescription('Zarządzaj ignorowanymi kanałami')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Dodaj kanał do ignorowanych (XP nie będzie przyznawane)')
          .addChannelOption((o) =>
            o.setName('kanal').setDescription('Kanał do zignorowania').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Usuń kanał z ignorowanych')
          .addChannelOption((o) =>
            o.setName('kanal').setDescription('Kanał').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('Pokaż listę ignorowanych kanałów')
      )
  )
  .addSubcommandGroup((group) =>
    group
      .setName('role')
      .setDescription('Zarządzaj ignorowanymi rolami')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Dodaj rolę do ignorowanych (użytkownicy z tą rolą nie dostaną XP)')
          .addRoleOption((o) =>
            o.setName('rola').setDescription('Rola do zignorowania').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Usuń rolę z ignorowanych')
          .addRoleOption((o) =>
            o.setName('rola').setDescription('Rola').setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('Pokaż listę ignorowanych ról')
      )
  );

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  if (!interaction.inCachedGuild()) return;

  const guildId = interaction.guildId!;
  const group = interaction.options.getSubcommandGroup(true);
  const subcommand = interaction.options.getSubcommand(true);

  if (group === 'channel') {
    if (subcommand === 'add') {
      const channel = interaction.options.getChannel('kanal', true);

      await LevelConfigModel.findOneAndUpdate(
        { guildId },
        { $addToSet: { ignoredChannels: channel.id } },
        { upsert: true }
      );

      await interaction.reply({
        content: `✅ Kanał ${channel} został dodany do ignorowanych. Użytkownicy nie będą dostawać XP za wiadomości w tym kanale.`,
        flags: [64],
      });
    } else if (subcommand === 'remove') {
      const channel = interaction.options.getChannel('kanal', true);

      await LevelConfigModel.findOneAndUpdate(
        { guildId },
        { $pull: { ignoredChannels: channel.id } }
      );

      await interaction.reply({
        content: `✅ Kanał ${channel} został usunięty z ignorowanych.`,
        flags: [64],
      });
    } else if (subcommand === 'list') {
      const config = await LevelConfigModel.findOne({ guildId }).lean();

      if (!config?.ignoredChannels || config.ignoredChannels.length === 0) {
        await interaction.reply({
          content: '📋 Brak ignorowanych kanałów',
          flags: [64],
        });
        return;
      }

      const list = config.ignoredChannels.map((id) => `• <#${id}>`).join('\n');

      await interaction.reply({
        content: `📋 **Ignorowane kanały:**\n${list}`,
        flags: [64],
      });
    }
  } else if (group === 'role') {
    if (subcommand === 'add') {
      const role = interaction.options.getRole('rola', true);

      await LevelConfigModel.findOneAndUpdate(
        { guildId },
        { $addToSet: { ignoredRoles: role.id } },
        { upsert: true }
      );

      await interaction.reply({
        content: `✅ Rola ${role} została dodana do ignorowanych. Użytkownicy z tą rolą nie będą dostawać XP.`,
        flags: [64],
      });
    } else if (subcommand === 'remove') {
      const role = interaction.options.getRole('rola', true);

      await LevelConfigModel.findOneAndUpdate(
        { guildId },
        { $pull: { ignoredRoles: role.id } }
      );

      await interaction.reply({
        content: `✅ Rola ${role} została usunięta z ignorowanych.`,
        flags: [64],
      });
    } else if (subcommand === 'list') {
      const config = await LevelConfigModel.findOne({ guildId }).lean();

      if (!config?.ignoredRoles || config.ignoredRoles.length === 0) {
        await interaction.reply({
          content: '📋 Brak ignorowanych ról',
          flags: [64],
        });
        return;
      }

      const list = config.ignoredRoles.map((id) => `• <@&${id}>`).join('\n');

      await interaction.reply({
        content: `📋 **Ignorowane role:**\n${list}`,
        flags: [64],
      });
    }
  }
}
