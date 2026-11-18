/**
 * Whitelista na prawdziwej bazie (mongodb-memory-server z globalSetup) - RCON zamockowany.
 */
import { MinecraftLinkModel } from '../../../src/models/MinecraftLink';
import {
  listWhitelist,
  reconcileWhitelist,
  removeFromWhitelist,
  setWhitelistNick,
  type RconRunner,
} from '../../../src/services/minecraft/whitelistService';

const GID = '123456789012345678';
const ADMIN = '900000000000000001';
const KUBA = '900000000000000002';
const OLA = '900000000000000003';
const TARGET = { host: '127.0.0.1', port: 25_575, password: 'x' };

function rcon(answers: Record<string, string>): { run: RconRunner; sent: string[] } {
  const sent: string[] = [];
  const run: RconRunner = async (_target, action, nick) => {
    const command = `${action} ${nick}`;
    sent.push(command);
    return { ok: true, text: answers[command] ?? (action === 'add' ? `Added ${nick} to the whitelist` : `Removed ${nick} from the whitelist`) };
  };
  return { run, sent };
}

beforeEach(async () => {
  await MinecraftLinkModel.deleteMany({});
});

describe('setWhitelistNick', () => {
  it('adds a person as pending and rejects an invalid nick', async () => {
    const added = await setWhitelistNick(GID, KUBA, 'Kuba_1', ADMIN);
    expect(added.ok && added.data.entry).toEqual({ userId: KUBA, nick: 'Kuba_1', status: 'pending' });
    const invalid = await setWhitelistNick(GID, KUBA, 'Kuba 1', ADMIN);
    expect(invalid.ok).toBe(false);
  });

  it('one nick per server, case-insensitive', async () => {
    await setWhitelistNick(GID, KUBA, 'Kuba', ADMIN);
    const taken = await setWhitelistNick(GID, OLA, 'kuba', ADMIN);
    expect(taken.ok).toBe(false);
    if (!taken.ok) expect(taken.code).toBe('NICK_TAKEN');
  });

  it('changing the nick of an added person schedules removal of the old one', async () => {
    await setWhitelistNick(GID, KUBA, 'Old', ADMIN);
    await MinecraftLinkModel.updateOne({ guildId: GID, userId: KUBA }, { status: 'added' });
    await setWhitelistNick(GID, KUBA, 'New', ADMIN);
    const doc = await MinecraftLinkModel.findOne({ guildId: GID, userId: KUBA }).lean();
    expect(doc).toMatchObject({ nick: 'New', status: 'pending', previousNick: 'Old' });
  });
});

describe('reconcileWhitelist', () => {
  it('adds pending players and marks them as added', async () => {
    await setWhitelistNick(GID, KUBA, 'Kuba', ADMIN);
    const { run, sent } = rcon({});
    expect(await reconcileWhitelist(GID, TARGET, run)).toEqual({ applied: 1, deferred: false });
    expect(sent).toEqual(['add Kuba']);
    const list = await listWhitelist(GID);
    expect(list.ok && list.data[0]?.status).toBe('added');
  });

  it('marks a nick Minecraft does not know and does not retry it', async () => {
    await setWhitelistNick(GID, KUBA, 'NoSuchGuy', ADMIN);
    const { run, sent } = rcon({ 'add NoSuchGuy': 'That player does not exist' });
    await reconcileWhitelist(GID, TARGET, run);
    await reconcileWhitelist(GID, TARGET, run);
    expect(sent).toEqual(['add NoSuchGuy']);
    const doc = await MinecraftLinkModel.findOne({ guildId: GID, userId: KUBA }).lean();
    expect(doc?.status).toBe('no_such_player');
  });

  it('removes the old nick first, then adds the new one', async () => {
    await setWhitelistNick(GID, KUBA, 'Old', ADMIN);
    await MinecraftLinkModel.updateOne({ guildId: GID, userId: KUBA }, { status: 'added' });
    await setWhitelistNick(GID, KUBA, 'New', ADMIN);
    const { run, sent } = rcon({});
    await reconcileWhitelist(GID, TARGET, run);
    expect(sent).toEqual(['remove Old', 'add New']);
    const doc = await MinecraftLinkModel.findOne({ guildId: GID, userId: KUBA }).lean();
    expect(doc).toMatchObject({ nick: 'New', status: 'added' });
    expect(doc?.previousNick).toBeUndefined();
  });

  it('removes a person from the server and then from the database', async () => {
    await setWhitelistNick(GID, KUBA, 'Kuba', ADMIN);
    await MinecraftLinkModel.updateOne({ guildId: GID, userId: KUBA }, { status: 'added' });
    const removed = await removeFromWhitelist(GID, KUBA);
    expect(removed.ok && removed.data.status).toBe('removing');
    const { run, sent } = rcon({ 'remove Kuba': 'Player is not whitelisted' });
    await reconcileWhitelist(GID, TARGET, run);
    expect(sent).toEqual(['remove Kuba']);
    expect(await MinecraftLinkModel.countDocuments({ guildId: GID })).toBe(0);
  });

  it('removing a person who was never added deletes the entry right away', async () => {
    await setWhitelistNick(GID, KUBA, 'Kuba', ADMIN);
    const removed = await removeFromWhitelist(GID, KUBA);
    expect(removed.ok).toBe(true);
    expect(await MinecraftLinkModel.countDocuments({ guildId: GID })).toBe(0);
  });

  it('stops when the server refuses the connection (Minecraft still loading) and keeps the entry pending', async () => {
    await setWhitelistNick(GID, KUBA, 'Kuba', ADMIN);
    const run: RconRunner = async () => ({ ok: false, reason: 'unreachable' });
    expect(await reconcileWhitelist(GID, TARGET, run)).toEqual({ applied: 0, deferred: true });
    const doc = await MinecraftLinkModel.findOne({ guildId: GID, userId: KUBA }).lean();
    expect(doc?.status).toBe('pending');
  });

  it('never touches entries of another server', async () => {
    await setWhitelistNick('223456789012345678', OLA, 'Ola', ADMIN);
    const { run, sent } = rcon({});
    await reconcileWhitelist(GID, TARGET, run);
    expect(sent).toEqual([]);
  });
});
