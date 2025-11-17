import { Client, ChannelType } from 'discord.js';
import { createEventHarness, resetEventHarness, EventHarness } from '../../discord/eventHarness';
import { setupDatabase, cleanDatabase, teardownDatabase } from '../../setup/db';
import logger from '../../../../src/utils/logger';
import runGoodbye from '../../../../src/events/guildMemberRemove/goodbyeCard';
import runStats from '../../../../src/events/guildMemberRemove/updateRemoveMemberStats';
import { GreetingsConfigurationModel } from '../../../../src/models/GreetingsConfiguration';
jest.mock('../../../../src/utils/embedHelpers', () => ({ createBaseEmbed: (o: any) => ({ ...o }) }));
jest.mock('../../../../src/config/bot', () => ({ getBotConfig: () => ({ emojis: { greetings: { bye: '👋' } } }) }));
const updateChannelStats = jest.fn(async () => {});
jest.mock('../../../../src/utils/cooldownHelpers', () => ({ debounce: (_: any, fn: any) => fn() }));
jest.mock('../../../../src/utils/channelHelpers', () => ({ updateChannelStats: (...args: any[]) => (updateChannelStats as any)(...args) }));

function makeGuildWithChannel(sendImpl?: any) {
  const send = sendImpl || jest.fn(async () => ({}));
  const permissions = { has: jest.fn().mockReturnValue(true) };
  const channel: any = { id: 'greet', type: ChannelType.GuildText, send, permissionsFor: jest.fn().mockReturnValue(permissions) };
  const channelsCache = new Map([[ 'greet', channel ]]);
  const botMember = { id: 'botId' };
  const membersCache = new Map([['botId', botMember]]);
  const client = { user: { id: 'botId' } };
  const guild: any = {
    id: 'guild-1',
    name: 'Guild',
    channels: { cache: channelsCache },
    members: { cache: membersCache },
    client,
  };
  return { guild, channel, send } as const;
}

function makeMember(guild: any, userId = 'user-1') {
  return {
    user: { id: userId, tag: 'User#0001', displayAvatarURL: () => 'https://avatar' },
    client: { user: { id: 'botId' } },
    guild,
  } as any;
}

describe('guildMemberRemove: goodbye (E2E)', () => {
  let harness: EventHarness;
  let client: Client;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeAll(async () => {
    await setupDatabase();
  }, 30000);

  afterAll(async () => {
    await teardownDatabase();
  }, 30000);

  beforeEach(async () => {
    await cleanDatabase();
    resetEventHarness();
    harness = createEventHarness();
    client = new Client({ intents: [] });
    harness.setClient(client);

    client.on('guildMemberRemove', async (member) => {
      await runGoodbye(member as any);
      await runStats(member as any);
    });

    warnSpy = jest.spyOn(logger, 'warn').mockImplementation((() => logger) as any);
    errorSpy = jest.spyOn(logger, 'error').mockImplementation((() => logger) as any);
    jest.spyOn(logger, 'info').mockImplementation((() => logger) as any);
  });

  afterEach(() => {
    client.removeAllListeners();
    jest.restoreAllMocks();
  });

  it('with config: sends message and updates stats', async () => {
    const { guild, send } = makeGuildWithChannel();
    await GreetingsConfigurationModel.create({ guildId: guild.id, greetingsChannelId: 'greet' });

    const member = makeMember(guild);
  await harness.emitGuildMemberRemove(member as any);
  await new Promise((r) => setTimeout(r, 60));

    expect(send).toHaveBeenCalled();
    expect(updateChannelStats).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  }, 15000);

  it('without config: no-op (silent)', async () => {
    const { guild, send } = makeGuildWithChannel();
    const member = makeMember(guild);

  await harness.emitGuildMemberRemove(member as any);
  await new Promise((r) => setTimeout(r, 60));

    expect(send).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  }, 15000);

  it('missing permissions to send (send throws) -> logs error, no crash', async () => {
    const send = jest.fn(async () => { const e: any = new Error('Missing Permissions'); e.code = 50013; throw e; });
    const permissions = { has: jest.fn().mockReturnValue(false) };
    const channel: any = { id: 'greet', type: ChannelType.GuildText, send, permissionsFor: jest.fn().mockReturnValue(permissions) };
    const channelsCache = new Map([[ 'greet', channel ]]);
    const botMember = { id: 'botId' };
    const membersCache = new Map([['botId', botMember]]);
    const client = { user: { id: 'botId' } };
    const guild: any = {
      id: 'guild-1',
      name: 'Guild',
      channels: { cache: channelsCache },
      members: { cache: membersCache },
      client,
    };
    await GreetingsConfigurationModel.create({ guildId: guild.id, greetingsChannelId: 'greet' });

    const member = makeMember(guild);
  await harness.emitGuildMemberRemove(member as any);
  await new Promise((r) => setTimeout(r, 60));

    expect(send).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  }, 15000);
});
