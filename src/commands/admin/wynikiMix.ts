import {
  SlashCommandBuilder,
  Collection,
  GuildMember,
  GuildMemberRoleManager,
  TextChannel,
  EmbedBuilder,
} from 'discord.js';
import { ClipModel, ClipDocument } from '../../models/Clip';
import type { IClipResult } from '../../interfaces/Models';
import { JURY_ROLE_ID, OWNER_ROLE_ID, SEPARATOR_GIF_URL } from '../../config/constants/clipSystem';
import type { ICommandOptions } from '../../interfaces/Command';
import { createBaseEmbed } from '../../utils/embedHelpers';
import { COLORS } from '../../config/constants/colors';
import logger from '../../utils/logger';

export const data = new SlashCommandBuilder()
  .setName('wyniki-mix')
  .setDescription('Wyświetla wyniki coponiedziałkowych mixów CS2')
  .setDMPermission(false);

export const options = {};

export async function run({ interaction }: ICommandOptions): Promise<void> {
  try {
    await interaction.deferReply();

    const memberRoles = (interaction.member as GuildMember)?.roles as GuildMemberRoleManager;
    if (!hasRequiredRole(memberRoles)) {
      await interaction.editReply({ content: 'Nie masz uprawnień do wyświetlania wyników!' });
      return;
    }

    const clips = (await ClipModel.find().exec()) as ClipDocument[];
    if (clips.length === 0) {
      await interaction.editReply({ content: 'Nie znaleziono żadnych zgłoszonych klipów!' });
      return;
    }

    const juryRole = interaction.guild?.roles.cache.get(JURY_ROLE_ID);
    if (!juryRole) {
      await interaction.editReply({ content: 'Nie znaleziono roli jurora!' });
      return;
    }

    const juryMembers: Collection<string, GuildMember> = juryRole.members;
    const juryIds: string[] = Array.from(juryMembers.keys());

    if (!allJuryMembersVoted(clips, juryIds)) {
      await interaction.editReply({
        content: 'Nie wszyscy członkowie jury oddali swoje głosy na wszystkie klipy!',
      });
      return;
    }

    const results = calculateResults(clips);

    const topWinners = results.slice(0, 3);
    const remainingClips = results.slice(3);

    const luckyLoser = selectRandomLuckyLoser(remainingClips);

    await interaction.followUp({ files: [SEPARATOR_GIF_URL] });

    const resultsEmbed = createResultsEmbed(topWinners, luckyLoser);
    await interaction.editReply({ embeds: [resultsEmbed] });

    if (interaction.channel instanceof TextChannel) {
      await interaction.channel.send({ files: [SEPARATOR_GIF_URL] });
    }

    await ClipModel.clearAll();
  } catch (error) {
    logger.error(`Błąd podczas wykonywania komendy /wyniki-mix: ${error}`);
    await interaction.editReply({ content: 'Wystąpił błąd podczas wykonywania komendy.' });
  }
}

function hasRequiredRole(memberRoles: GuildMemberRoleManager | null): boolean {
  if (!memberRoles) return false;
  return memberRoles.cache.has(JURY_ROLE_ID) || memberRoles.cache.has(OWNER_ROLE_ID);
}

function allJuryMembersVoted(clips: ClipDocument[], juryIds: string[]): boolean {
  return clips.every((clip) =>
    juryIds.every((juryId) => clip.votes.some((vote) => vote.juryId === juryId))
  );
}

function calculateResults(clips: ClipDocument[]): IClipResult[] {
  const results: IClipResult[] = clips.map((clip) => ({
    clip,
    averageScore: clip.getAverageScore(),
  }));

  return results.sort((a, b) => b.averageScore - a.averageScore);
}

function selectRandomLuckyLoser(remainingClips: IClipResult[]): IClipResult | null {
  if (remainingClips.length === 0) return null;
  return remainingClips[Math.floor(Math.random() * remainingClips.length)];
}

function createResultsEmbed(
  topWinners: IClipResult[],
  luckyLoser: IClipResult | null
): EmbedBuilder {
  const resultsEmbed = createBaseEmbed({
    title: '🏆 Wyniki coponiedziałkowych mixów CS2',
    color: COLORS.CS2_MIX,
  });

  topWinners.forEach((result, index) => {
    resultsEmbed.addFields({
      name: `#${index + 1} Miejsce`,
      value: `<@!${result.clip.authorId}> - Średnia ocena: ${result.averageScore.toFixed(2)} - [Link do klipu](${result.clip.messageLink})`,
    });
  });

  if (luckyLoser) {
    resultsEmbed.addFields({
      name: '🎲 Lucky Loser',
      value: `<@!${luckyLoser.clip.authorId}> - Średnia ocena: ${luckyLoser.averageScore.toFixed(2)} - [Link do klipu](${luckyLoser.clip.messageLink})`,
    });
  }

  return resultsEmbed;
}
