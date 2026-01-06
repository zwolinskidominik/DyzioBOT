import { Client, Guild } from 'discord.js';
import { BirthdayConfigurationModel } from '../../models/BirthdayConfiguration';
import { GreetingsConfigurationModel } from '../../models/GreetingsConfiguration';
import { LevelConfigModel } from '../../models/LevelConfig';
import { MonthlyStatsConfigModel } from '../../models/MonthlyStatsConfig';
import { QuestionConfigurationModel } from '../../models/QuestionConfiguration';
import { SuggestionConfigurationModel } from '../../models/SuggestionConfiguration';
import { TicketConfigModel } from '../../models/TicketConfig';
import { StreamConfigurationModel } from '../../models/StreamConfiguration';
import { ReactionRoleModel } from '../../models/ReactionRole';
import { LogConfigurationModel } from '../../models/LogConfiguration';
import { TournamentConfigModel } from '../../models/TournamentConfig';
import { AutoRoleModel } from '../../models/AutoRole';
import logger from '../../utils/logger';

export default async (_client: Client, guild: Guild) => {
  try {
    const guildId = guild.id;
    logger.info(`Bot joined new guild: ${guild.name} (${guildId}). Initializing module configurations...`);

    await Promise.allSettled([
      BirthdayConfigurationModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      GreetingsConfigurationModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      LevelConfigModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      MonthlyStatsConfigModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false, topCount: 10 },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      QuestionConfigurationModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      SuggestionConfigurationModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      TicketConfigModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      StreamConfigurationModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      ReactionRoleModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      LogConfigurationModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      TournamentConfigModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),

      AutoRoleModel.findOneAndUpdate(
        { guildId },
        { guildId, enabled: false },
        { upsert: true, setDefaultsOnInsert: true }
      ),
    ]);

    logger.info(`Successfully initialized module configurations for guild: ${guild.name} (${guildId})`);
  } catch (error) {
    logger.error('Error initializing guild configurations:', error);
  }
};
