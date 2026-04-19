/**
 * Integration tests for ALL Mongoose/Typegoose models.
 * Ensures each model can be imported, creates documents with defaults,
 * and validates required fields.
 */
import { ActivityBucketModel } from '../../../src/models/ActivityBucket';
import { AdventCalendarModel } from '../../../src/models/AdventCalendar';
import { AuditLogModel } from '../../../src/models/AuditLog';
import { AutoRoleModel } from '../../../src/models/AutoRole';
import { BirthdayModel } from '../../../src/models/Birthday';
import { BirthdayConfigurationModel } from '../../../src/models/BirthdayConfiguration';
import { ChannelStatsModel } from '../../../src/models/ChannelStats';
import { FortuneModel, FortuneUsageModel } from '../../../src/models/Fortune';
import { GiveawayModel } from '../../../src/models/Giveaway';
import { GiveawayConfigModel } from '../../../src/models/GiveawayConfig';
import { GreetingsConfigurationModel } from '../../../src/models/GreetingsConfiguration';
import { LevelModel } from '../../../src/models/Level';
import { LevelConfigModel } from '../../../src/models/LevelConfig';
import { LogConfigurationModel } from '../../../src/models/LogConfiguration';
import { MonthlyStatsModel } from '../../../src/models/MonthlyStats';
import { MonthlyStatsConfigModel } from '../../../src/models/MonthlyStatsConfig';
import { QuestionModel } from '../../../src/models/Question';
import { QuestionConfigurationModel } from '../../../src/models/QuestionConfiguration';
import { ReactionRoleModel } from '../../../src/models/ReactionRole';
import { StreamConfigurationModel } from '../../../src/models/StreamConfiguration';
import { SuggestionModel } from '../../../src/models/Suggestion';
import { SuggestionConfigurationModel } from '../../../src/models/SuggestionConfiguration';
import { TempChannelModel } from '../../../src/models/TempChannel';
import { TempChannelConfigurationModel } from '../../../src/models/TempChannelConfiguration';
import { TicketConfigModel } from '../../../src/models/TicketConfig';
import { TicketStateModel } from '../../../src/models/TicketState';
import { TicketStatsModel } from '../../../src/models/TicketStats';
import { TournamentConfigModel } from '../../../src/models/TournamentConfig';
import { TwitchStreamerModel } from '../../../src/models/TwitchStreamer';
import { UsedQuestionModel } from '../../../src/models/UsedQuestion';
import { WarnModel } from '../../../src/models/Warn';

const GID = 'model-test-guild';

describe('Model integration tests', () => {
  /* ── ActivityBucket ─────────────────────────────── */
  describe('ActivityBucketModel', () => {
    it('creates with defaults', async () => {
      const doc = await ActivityBucketModel.create({
        guildId: GID, userId: 'u1', bucketStart: new Date(),
      });
      expect(doc.msgCount).toBe(0);
      expect(doc.vcMin).toBe(0);
    });
  });

  /* ── AdventCalendar ─────────────────────────────── */
  describe('AdventCalendarModel', () => {
    it('creates with defaults', async () => {
      const doc = await AdventCalendarModel.create({
        guildId: GID, userId: 'u1',
      });
      expect(doc.openedDays).toEqual([]);
      expect(doc.totalXP).toBe(0);
    });
  });

  /* ── AuditLog ───────────────────────────────────── */
  describe('AuditLogModel', () => {
    it('creates with required fields', async () => {
      const doc = await AuditLogModel.create({
        guildId: GID, userId: 'u1', username: 'Test',
        action: 'CREATE', module: 'test',
      });
      expect(doc.action).toBe('CREATE');
      expect(doc.createdAt).toBeDefined();
    });
  });

  /* ── AutoRole ───────────────────────────────────── */
  describe('AutoRoleModel', () => {
    it('creates with defaults', async () => {
      const doc = await AutoRoleModel.create({ guildId: GID });
      expect(doc.roleIds).toEqual([]);
      expect(doc.enabled).toBe(false);
    });
  });

  /* ── Birthday ───────────────────────────────────── */
  describe('BirthdayModel', () => {
    it('creates with all fields', async () => {
      const doc = await BirthdayModel.create({
        guildId: GID, userId: 'u1', date: new Date(2000, 0, 15),
      });
      expect(doc.yearSpecified).toBe(true);
      expect(doc.active).toBe(true);
    });
  });

  /* ── BirthdayConfiguration ──────────────────────── */
  describe('BirthdayConfigurationModel', () => {
    it('creates with required fields', async () => {
      const doc = await BirthdayConfigurationModel.create({
        guildId: GID, birthdayChannelId: 'ch-1',
      });
      expect(doc.birthdayChannelId).toBe('ch-1');
    });
  });

  /* ── ChannelStats ───────────────────────────────── */
  describe('ChannelStatsModel', () => {
    it('creates with nested channels config', async () => {
      const doc = await ChannelStatsModel.create({
        guildId: GID, channels: { users: { channelId: 'ch-1', template: 'Users: {count}' } },
      });
      expect(doc.channels.users?.channelId).toBe('ch-1');
    });
  });

  /* ── Fortune ────────────────────────────────────── */
  describe('FortuneModel', () => {
    it('creates fortune', async () => {
      const doc = await FortuneModel.create({ content: 'You will have a great day!' });
      expect(doc.content).toBe('You will have a great day!');
    });
  });

  describe('FortuneUsageModel', () => {
    it('creates fortune usage', async () => {
      const doc = await FortuneUsageModel.create({ userId: 'u1', targetId: 'u2' });
      expect(doc.dailyUsageCount).toBe(0);
    });
  });

  /* ── Giveaway ───────────────────────────────────── */
  describe('GiveawayModel', () => {
    it('creates with required fields', async () => {
      const doc = await GiveawayModel.create({
        giveawayId: 'g1', guildId: GID, channelId: 'ch-1', messageId: 'msg-1',
        prize: 'Nitro', description: 'Win!', winnersCount: 1,
        endTime: new Date(Date.now() + 86400000), hostId: 'u1',
      });
      expect(doc.active).toBe(true);
      expect(doc.participants).toEqual([]);
      expect(doc.finalized).toBe(false);
    });
  });

  /* ── GiveawayConfig ─────────────────────────────── */
  describe('GiveawayConfigModel', () => {
    it('creates with defaults', async () => {
      const doc = await GiveawayConfigModel.create({ guildId: GID });
      expect(doc.enabled).toBe(false);
      expect(doc.roleMultipliers).toEqual([]);
    });
  });

  /* ── GreetingsConfiguration ─────────────────────── */
  describe('GreetingsConfigurationModel', () => {
    it('creates with defaults', async () => {
      const doc = await GreetingsConfigurationModel.create({
        guildId: GID, greetingsChannelId: 'ch-1',
      });
      expect(doc.welcomeEnabled).toBe(true);
      expect(doc.goodbyeEnabled).toBe(true);
      expect(doc.dmEnabled).toBe(false);
    });
  });

  /* ── Level ──────────────────────────────────────── */
  describe('LevelModel', () => {
    it('creates with defaults', async () => {
      const doc = await LevelModel.create({ guildId: GID, userId: 'u1' });
      expect(doc.xp).toBe(0);
      expect(doc.level).toBe(1);
    });
  });

  /* ── LevelConfig ────────────────────────────────── */
  describe('LevelConfigModel', () => {
    it('creates with defaults', async () => {
      const doc = await LevelConfigModel.create({ guildId: GID });
      expect(doc.enabled).toBe(false);
      expect(doc.xpPerMsg).toBe(5);
      expect(doc.xpPerMinVc).toBe(10);
      expect(doc.cooldownSec).toBe(0);
      expect(doc.roleRewards).toEqual([]);
      expect(doc.roleMultipliers).toEqual([]);
      expect(doc.channelMultipliers).toEqual([]);
      expect(doc.ignoredChannels).toEqual([]);
      expect(doc.ignoredRoles).toEqual([]);
    });

    it('has correct levelUpMessage default', async () => {
      const doc = await LevelConfigModel.create({ guildId: GID + '-lc2' });
      expect(doc.levelUpMessage).toContain('{user}');
      expect(doc.levelUpMessage).toContain('{level}');
    });
  });

  /* ── LogConfiguration ───────────────────────────── */
  describe('LogConfigurationModel', () => {
    it('creates with required fields', async () => {
      const doc = await LogConfigurationModel.create({ guildId: GID });
      expect(doc.enabled).toBe(false);
    });
  });

  /* ── MonthlyStats ───────────────────────────────── */
  describe('MonthlyStatsModel', () => {
    it('creates with defaults', async () => {
      const doc = await MonthlyStatsModel.create({
        guildId: GID, userId: 'u1', month: '2026-02',
      });
      expect(doc.messageCount).toBe(0);
      expect(doc.voiceMinutes).toBe(0);
      expect(doc.updatedAt).toBeDefined();
    });
  });

  /* ── MonthlyStatsConfig ─────────────────────────── */
  describe('MonthlyStatsConfigModel', () => {
    it('creates with defaults', async () => {
      const doc = await MonthlyStatsConfigModel.create({ guildId: GID });
      expect(doc.enabled).toBe(false);
      expect(doc.topCount).toBe(10);
    });
  });

  /* ── Question ───────────────────────────────────── */
  describe('QuestionModel', () => {
    it('creates with defaults', async () => {
      const doc = await QuestionModel.create({ authorId: 'u1', content: 'What?' });
      expect(doc.questionId).toBeDefined();
      expect(doc.reactions).toEqual([]);
      expect(doc.disabled).toBe(false);
    });
  });

  /* ── QuestionConfiguration ──────────────────────── */
  describe('QuestionConfigurationModel', () => {
    it('creates with required fields', async () => {
      const doc = await QuestionConfigurationModel.create({
        guildId: GID, questionChannelId: 'ch-1',
      });
      expect(doc.enabled).toBe(false);
    });
  });

  /* ── ReactionRole ───────────────────────────────── */
  describe('ReactionRoleModel', () => {
    it('creates with defaults', async () => {
      const doc = await ReactionRoleModel.create({
        guildId: GID, channelId: 'ch-1', messageId: 'msg-1',
      });
      expect(doc.enabled).toBe(false);
      expect(doc.reactions).toEqual([]);
    });
  });

  /* ── StreamConfiguration ────────────────────────── */
  describe('StreamConfigurationModel', () => {
    it('creates with required fields', async () => {
      const doc = await StreamConfigurationModel.create({
        guildId: GID, channelId: '123456789',
      });
      expect(doc.enabled).toBe(false);
    });
  });

  /* ── Suggestion ─────────────────────────────────── */
  describe('SuggestionModel', () => {
    it('creates with defaults', async () => {
      const doc = await SuggestionModel.create({
        authorId: 'u1', guildId: GID, messageId: 'msg-sug-1', content: 'Idea!',
      });
      expect(doc.suggestionId).toBeDefined();
      expect(doc.upvotes).toEqual([]);
      expect(doc.downvotes).toEqual([]);
    });
  });

  /* ── SuggestionConfiguration ────────────────────── */
  describe('SuggestionConfigurationModel', () => {
    it('creates with required fields', async () => {
      const doc = await SuggestionConfigurationModel.create({
        guildId: GID, suggestionChannelId: 'ch-1',
      });
      expect(doc.enabled).toBe(false);
    });
  });

  /* ── TempChannel ────────────────────────────────── */
  describe('TempChannelModel', () => {
    it('creates with required fields', async () => {
      const doc = await TempChannelModel.create({
        guildId: GID, parentId: 'cat-1', channelId: 'ch-temp-1', ownerId: 'u1',
      });
      expect(doc.channelId).toBe('ch-temp-1');
    });
  });

  /* ── TempChannelConfiguration ───────────────────── */
  describe('TempChannelConfigurationModel', () => {
    it('creates with defaults', async () => {
      const doc = await TempChannelConfigurationModel.create({
        guildId: GID,
      });
      expect(doc.channelIds).toEqual([]);
    });
  });

  /* ── TicketConfig ───────────────────────────────── */
  describe('TicketConfigModel', () => {
    it('creates with required fields', async () => {
      const doc = await TicketConfigModel.create({
        guildId: GID, categoryId: 'cat-ticket',
      });
      expect(doc.enabled).toBe(false);
    });
  });

  /* ── TicketState ────────────────────────────────── */
  describe('TicketStateModel', () => {
    it('creates with required fields', async () => {
      const doc = await TicketStateModel.create({ channelId: 'ch-ticket-1' });
      expect(doc.channelId).toBe('ch-ticket-1');
    });
  });

  /* ── TicketStats ────────────────────────────────── */
  describe('TicketStatsModel', () => {
    it('creates with defaults', async () => {
      const doc = await TicketStatsModel.create({ guildId: GID, userId: 'u1' });
      expect(doc.count).toBe(0);
    });
  });

  /* ── TournamentConfig ───────────────────────────── */
  describe('TournamentConfigModel', () => {
    it('creates with defaults', async () => {
      const doc = await TournamentConfigModel.create({ guildId: GID });
      expect(doc.enabled).toBe(false);
      expect(doc.messageTemplate).toContain('Zasady');
      expect(doc.cronSchedule).toBe('25 20 * * 1');
      expect(doc.reactionEmoji).toBe('🎮');
    });
  });

  /* ── TwitchStreamer ─────────────────────────────── */
  describe('TwitchStreamerModel', () => {
    it('creates with defaults', async () => {
      const doc = await TwitchStreamerModel.create({
        guildId: GID, twitchChannel: 'TestStreamer', userId: 'u1',
      });
      expect(doc.twitchChannel).toBe('teststreamer'); // lowercase via pre-save
      expect(doc.isLive).toBe(false);
      expect(doc.active).toBe(true);
    });
  });

  /* ── UsedQuestion ───────────────────────────────── */
  describe('UsedQuestionModel', () => {
    it('creates with defaults', async () => {
      const doc = await UsedQuestionModel.create({
        guildId: GID, questionId: 'q1',
      });
      expect(doc.usedAt).toBeDefined();
    });
  });

  /* ── Warn ───────────────────────────────────────── */
  describe('WarnModel', () => {
    it('creates with defaults', async () => {
      const doc = await WarnModel.create({ userId: 'u1', guildId: GID });
      expect(doc.warnings).toEqual([]);
    });

    it('can add warnings entries', async () => {
      const doc = await WarnModel.create({
        userId: 'u2', guildId: GID,
        warnings: [{ reason: 'Spam', moderatorId: 'mod-1' }],
      });
      expect(doc.warnings.length).toBe(1);
      expect(doc.warnings[0].reason).toBe('Spam');
    });
  });
});
