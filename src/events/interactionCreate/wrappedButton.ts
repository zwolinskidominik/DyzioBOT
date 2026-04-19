import { ButtonInteraction, AttachmentBuilder, MessageFlags } from 'discord.js';
import { collectPersonalWrappedData, renderPersonalWrappedCanvas } from '../../services/serverWrappedService';
import logger from '../../utils/logger';

export default async function run(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'wrapped:personal') return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const member = await interaction.guild!.members.fetch(interaction.user.id);

    const data = await collectPersonalWrappedData(member);
    const imageBuffer = await renderPersonalWrappedCanvas(data);

    const file = new AttachmentBuilder(imageBuffer, { name: 'wrapped.png' });
    await interaction.editReply({ files: [file] });
  } catch (err) {
    logger.error(`[WRAPPED] Błąd personal wrapped dla ${interaction.user.id}: ${err}`);
    await interaction.editReply({ content: '❌ Nie udało się wygenerować Twojego wrapped. Spróbuj ponownie.' });
  }
}
