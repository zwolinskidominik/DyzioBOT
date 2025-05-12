import { GuildMember } from 'discord.js';
import { BirthdayModel, BirthdayDocument } from '../../models/Birthday';
import { TwitchStreamerModel, TwitchStreamerDocument } from '../../models/TwitchStreamer';
import logger from '../../utils/logger';
import type { ReturnModelType, DocumentType } from '@typegoose/typegoose';
import type { FilterQuery, UpdateQuery } from 'mongoose';

export default async function run(member: GuildMember): Promise<void> {
  try {
    if (!member.guild) return;
    const guildId = member.guild.id;
    const userId = member.user.id;

    await reactivateEntry(
      BirthdayModel as ReturnModelType<typeof BirthdayModel, BirthdayDocument>,
      'birthday',
      {
        guildId,
        userId,
      }
    );
    await reactivateEntry(
      TwitchStreamerModel as ReturnModelType<typeof TwitchStreamerModel, TwitchStreamerDocument>,
      'twitch',
      {
        guildId,
        userId,
      }
    );
  } catch (error) {
    logger.error(
      `Wystąpił błąd podczas ponownej aktywacji wpisów userId=${member.user.id}: ${error}`
    );
  }
}

async function reactivateEntry<TDoc extends { active?: boolean }>(
  model: ReturnModelType<any, DocumentType<TDoc>>,
  modelName: string,
  filter: FilterQuery<DocumentType<TDoc>>
): Promise<void> {
  const entry = await model.findOne(filter).exec();

  if (entry && entry.active === false) {
    const update: UpdateQuery<DocumentType<TDoc>> = { $set: { active: true } };
    await model.findOneAndUpdate(filter, update).exec();
    logger.debug(`Reaktywowano wpis ${modelName} dla userId=${filter['userId']}`);
  }
}
