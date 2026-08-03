import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { send, getCurrencyConfig } from '../../services/economyService';
import { createSendEmbed } from '../../utils/economyEmbeds';
import { createErrorEmbed } from '../../utils/embedHelpers';

export const data = new SlashCommandBuilder()
  .setName('send')
  .setDescription('Wyślij monety do innego użytkownika')
  .addUserOption((o) =>
    o.setName('uzytkownik').setDescription('Odbiorca przelewu').setRequired(true),
  )
  .addIntegerOption((o) =>
    o
      .setName('kwota')
      .setDescription('Kwota do wysłania (całkowita liczba > 0)')
      .setRequired(true)
      .setMinValue(1),
  );

export const options = { guildOnly: true, cooldown: 5 };

export async function run({ interaction }: { interaction: ChatInputCommandInteraction }) {
  await interaction.deferReply();

  const guildId = interaction.guildId!;
  const sender = interaction.user;
  const receiver = interaction.options.getUser('uzytkownik', true);
  const amount = interaction.options.getInteger('kwota', true);

  if (receiver.bot) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie możesz wysyłać monet do botów.')],
    });
    return;
  }

  if (receiver.id === sender.id) {
    await interaction.editReply({
      embeds: [createErrorEmbed('Nie możesz wysłać monet do siebie.')],
    });
    return;
  }

  const [result, cfg] = await Promise.all([
    send(guildId, sender.id, receiver.id, amount),
    getCurrencyConfig(guildId),
  ]);

  if (!result.ok) {
    await interaction.editReply({ embeds: [createErrorEmbed(result.message)] });
    return;
  }

  await interaction.editReply({
    embeds: [
      createSendEmbed(sender, receiver, amount, result.data.senderWallet, cfg.currencySymbol),
    ],
  });
}
