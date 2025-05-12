import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder().setName('ping').setDescription('Pong!');

export const options = {
  cooldown: 1,
};

export async function run({ interaction, client }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply();
    const reply = await interaction.fetchReply();

    const clientPing = reply.createdTimestamp - interaction.createdTimestamp;
    const websocketPing = client.ws.ping;

    const pingEmbed = createPingEmbed(clientPing, websocketPing);
    await interaction.editReply({ embeds: [pingEmbed] });
  } catch (error) {
    logger.error(`Błąd podczas wykonywania komendy /ping: ${error}`);
    const errorEmbed = createErrorEmbed();
    await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
  }
}

function formatPingDescription(clientPing: number, websocketPing: number): string {
  return `**Klient:** ${clientPing}ms\n**Websocket:** ${websocketPing}ms`;
}

function createPingEmbed(clientPing: number, websocketPing: number): EmbedBuilder {
  return createBaseEmbed({
    title: '🏓 Pong!',
    description: formatPingDescription(clientPing, websocketPing),
  });
}

function createErrorEmbed(): EmbedBuilder {
  return createBaseEmbed({
    isError: true,
    description: 'Wystąpił błąd podczas wykonywania komendy.',
  });
}
