import { Collection, Message, PartialMessage } from 'discord.js';
import { LogConfigurationModel } from '../../../src/models/LogConfiguration';
import { MessageSnapshotModel, MESSAGE_SNAPSHOT_TTL_SECONDS } from '../../../src/models/MessageSnapshot';
import {
  storeMessageSnapshot,
  getMessageSnapshot,
  deleteMessageSnapshot,
  clearSnapshotConfigCache,
} from '../../../src/services/messageSnapshotService';

jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: jest.fn().mockResolvedValue(undefined),
  truncate: jest.fn((s: string, len: number) => s?.slice(0, len) ?? ''),
  moderatorField: jest.fn((id: string) => ({ name: 'Moderator:', value: `<@${id}>`, inline: true })),
}));
jest.mock('../../../src/utils/auditLogHelpers', () => ({ getModerator: jest.fn().mockResolvedValue(null) }));
jest.mock('../../../src/services/suggestionService', () => ({
  deleteSuggestionByMessageId: jest.fn().mockResolvedValue(undefined),
}));

import { sendLog } from '../../../src/utils/logHelpers';
import logMessageDelete from '../../../src/events/messageDelete/logMessageDelete';
import logMessageEdit from '../../../src/events/messageUpdate/logMessageEdit';

const G = 'guild-1';

function userMessage(overrides: Record<string, unknown> = {}): Message {
  return {
    id: 'm1',
    guildId: G,
    guild: { id: G },
    channelId: 'c1',
    partial: false,
    content: 'hello',
    url: 'https://discord.com/channels/guild-1/c1/m1',
    author: { id: 'u1', tag: 'user#0', bot: false, displayAvatarURL: () => 'https://cdn/avatar.png' },
    attachments: new Collection([['a1', { url: 'https://cdn/file.png' }]]),
    ...overrides,
  } as unknown as Message;
}

/** Tak discord.js oddaje wiadomość spoza cache (np. sprzed restartu bota). */
function partialMessage(): PartialMessage {
  return {
    id: 'm1',
    guildId: G,
    guild: { id: G },
    channelId: 'c1',
    partial: true,
    content: null,
    author: null,
    url: 'https://discord.com/channels/guild-1/c1/m1',
    attachments: new Collection(),
  } as unknown as PartialMessage;
}

async function enableLogs(events: Record<string, boolean>, ignoredChannels: string[] = []) {
  await LogConfigurationModel.create({ guildId: G, enabled: true, enabledEvents: events, ignoredChannels });
}

beforeEach(async () => {
  await MessageSnapshotModel.deleteMany({});
  await LogConfigurationModel.deleteMany({});
  clearSnapshotConfigCache();
  jest.clearAllMocks();
});

describe('messageSnapshotService', () => {
  it('stores nothing when delete/edit logs are off', async () => {
    await enableLogs({ memberJoin: true });
    expect(await storeMessageSnapshot(userMessage())).toEqual({ ok: true, data: false });
    expect(await MessageSnapshotModel.countDocuments()).toBe(0);
  });

  it('stores nothing in channels ignored by logs', async () => {
    await enableLogs({ messageDelete: true }, ['c1']);
    expect(await storeMessageSnapshot(userMessage())).toEqual({ ok: true, data: false });
  });

  it('stores and reads back author, content and attachments', async () => {
    await enableLogs({ messageDelete: true });
    await storeMessageSnapshot(userMessage());
    const res = await getMessageSnapshot(G, 'm1');
    expect(res).toEqual({
      ok: true,
      data: {
        authorId: 'u1',
        authorTag: 'user#0',
        authorAvatarUrl: 'https://cdn/avatar.png',
        content: 'hello',
        attachmentUrls: ['https://cdn/file.png'],
      },
    });
  });

  it('never stores bot messages', async () => {
    await enableLogs({ messageDelete: true });
    const bot = userMessage({ author: { id: 'b', tag: 'bot#0', bot: true, displayAvatarURL: () => '' } });
    expect(await storeMessageSnapshot(bot)).toEqual({ ok: true, data: false });
  });

  it('expires copies after 30 days (TTL index)', async () => {
    await MessageSnapshotModel.syncIndexes();
    const indexes = await MessageSnapshotModel.collection.indexes();
    const ttl = indexes.find((i) => i.key?.storedAt === 1);
    expect(ttl?.expireAfterSeconds).toBe(MESSAGE_SNAPSHOT_TTL_SECONDS);
    expect(MESSAGE_SNAPSHOT_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
  });

  it('deleteMessageSnapshot removes the copy', async () => {
    await enableLogs({ messageDelete: true });
    await storeMessageSnapshot(userMessage());
    expect(await deleteMessageSnapshot(G, 'm1')).toEqual({ ok: true, data: true });
    expect(await getMessageSnapshot(G, 'm1')).toEqual({ ok: true, data: null });
  });
});

describe('logs after a bot restart (message not in cache)', () => {
  it('delete log shows the real author and content from the stored copy, then drops the copy', async () => {
    await enableLogs({ messageDelete: true });
    await storeMessageSnapshot(userMessage());

    await logMessageDelete(partialMessage(), {} as never);

    const data = (sendLog as jest.Mock).mock.calls[0][3];
    expect(data.description).toContain('<@u1>');
    expect(data.description).toContain('hello');
    expect(data.description).toContain('https://cdn/file.png');
    expect(data.authorName).toBe('user#0');
    expect(await MessageSnapshotModel.countDocuments()).toBe(0);
  });

  it('delete log says the content is unknown (not "empty") when there is no copy', async () => {
    await logMessageDelete(partialMessage(), {} as never);
    const data = (sendLog as jest.Mock).mock.calls[0][3];
    expect(data.description).toContain('Treść nieznana');
    expect(data.description).not.toContain('Brak treści');
  });

  it('edit log uses the stored copy as the old content and keeps the copy up to date', async () => {
    await enableLogs({ messageEdit: true });
    await storeMessageSnapshot(userMessage());

    await logMessageEdit(partialMessage(), userMessage({ content: 'hello edited' }), {} as never);

    const data = (sendLog as jest.Mock).mock.calls[0][3];
    expect(data.fields[0].value).toContain('hello');
    expect(data.fields[0].value).not.toContain('nieznana');
    expect(data.fields[1].value).toContain('hello edited');
    const res = await getMessageSnapshot(G, 'm1');
    expect(res.ok && res.data?.content).toBe('hello edited');
  });

  it('skips the edit log when only the link preview changed (same content as the copy)', async () => {
    await enableLogs({ messageEdit: true });
    await storeMessageSnapshot(userMessage());
    await logMessageEdit(partialMessage(), userMessage(), {} as never);
    expect(sendLog).not.toHaveBeenCalled();
  });
});
