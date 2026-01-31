import { GuildMember } from 'discord.js';
import { BirthdayModel, BirthdayDocument } from '../../models/Birthday';
import { TwitchStreamerModel, TwitchStreamerDocument } from '../../models/TwitchStreamer';
import { LevelModel } from '../../models/Level';
import logger from '../../utils/logger';
import type { ReturnModelType, DocumentType } from '@typegoose/typegoose';
import type { UpdateQuery } from 'mongoose';

export default async function run(member: GuildMember): Promise<void> {
  if (!member.guild) return;
  const guildId = member.guild.id;
  const userId = member.user.id;

  try {
    await deactivateEntry(
      BirthdayModel as ReturnModelType<typeof BirthdayModel, BirthdayDocument>,
      { guildId, userId }
    );
    await deactivateEntry(
      TwitchStreamerModel as ReturnModelType<typeof TwitchStreamerModel, TwitchStreamerDocument>,
      { guildId, userId }
    );
    
    await resetUserLevel(guildId, userId);
  } catch (err) {
    logger.error(`Błąd podczas dezaktywacji wpisów userId=${userId}: ${err}`);
  }
}

async function deactivateEntry<TDoc extends { active?: boolean }>(
  model: ReturnModelType<any, DocumentType<TDoc>>,
  filter: Record<string, any>
): Promise<void> {
  const entry = await model.findOne(filter).exec();

  if (entry && entry.active !== false) {
    const update: UpdateQuery<DocumentType<TDoc>> = { $set: { active: false } };
    await model.findOneAndUpdate(filter, update).exec();
  }
}

async function resetUserLevel(guildId: string, userId: string): Promise<void> {
  const levelEntry = await LevelModel.findOne({ guildId, userId }).exec();

  if (levelEntry) {
    await LevelModel.deleteOne({ guildId, userId }).exec();
  }
}
