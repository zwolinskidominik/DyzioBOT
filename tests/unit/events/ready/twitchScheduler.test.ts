let run: any;

let scheduled: { expr:string, cb: Function }[] = [];
jest.mock('node-cron', () => ({ schedule: (expr:string, cb:Function)=> { scheduled.push({ expr, cb }); return {}; } }));

const error = jest.fn(); const warn = jest.fn(); const info = jest.fn();
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: { error: (...a:any)=>error(a.join? a.join(' '): a), warn: (...a:any)=>warn(a.join? a.join(' '): a), info: (...a:any)=>info(a.join? a.join(' '): a) } }));
jest.mock('../../../../src/config', () => ({ env: () => ({ TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'secret' }) }));
jest.mock('@twurple/auth', () => ({ AppTokenAuthProvider: class {} }));

const getUserByName = jest.fn();
const getStreamByUserId = jest.fn();
jest.mock('@twurple/api', () => ({ ApiClient: class { users = { getUserByName: (...a:any[])=> getUserByName(...a) }; streams = { getStreamByUserId: (...a:any[])=> getStreamByUserId(...a) }; constructor(){} } }));

const fsOps: any = { access: jest.fn(async()=>{}), mkdir: jest.fn(async()=>{}), writeFile: jest.fn(async()=>{}), readdir: jest.fn(async()=>[]), stat: jest.fn(async()=> ({ mtime: new Date() })), unlink: jest.fn(async()=>{}) };
jest.mock('fs', () => ({ promises: fsOps }));
const fetchMock = jest.fn(async (..._a:any[]) => ({ ok: true, arrayBuffer: async ()=> new ArrayBuffer(0) }));
jest.mock('undici', () => ({ fetch: (url:any, opts?:any) => (fetchMock as any)(url, opts) }));
jest.mock('../../../../src/utils/embedHelpers', () => ({ createBaseEmbed: (o:any)=> ({ ...o, setImage(){return this;}, }) }));
jest.mock('../../../../src/config/constants/colors', () => ({ COLORS: { TWITCH: 0xaa00ff } }));

let streamers: any[] = [];
let streamCfg: any[] = [];
const streamerFind = jest.fn(() => ({ exec: async () => streamers }));
const cfgFind = jest.fn(() => ({ lean: () => ({ exec: async () => streamCfg }) }));
jest.mock('../../../../src/models/TwitchStreamer', () => ({ TwitchStreamerModel: { find: () => streamerFind() } }));
jest.mock('../../../../src/models/StreamConfiguration', () => ({ StreamConfigurationModel: { find: () => cfgFind() } }));

function makeClient(){
  const send = jest.fn(async ()=>({}));
  const channel = { send };
  const guild = { channels: { cache: { get: (id:string)=> id==='liveChan'? channel : null } } };
  const guilds = { cache: new Map([[ 'g1', guild ]]) };
  return { guilds, user: { username: 'Bot', displayAvatarURL: ()=> 'url' } } as any;
}

describe('ready/twitchScheduler', () => {
  beforeEach(async ()=> { scheduled=[]; error.mockReset(); warn.mockReset(); info.mockReset(); getUserByName.mockReset(); getStreamByUserId.mockReset(); streamers=[]; streamCfg=[]; fsOps.readdir.mockReset(); fsOps.unlink.mockReset(); fsOps.stat.mockReset().mockImplementation(async()=> ({ mtime: new Date() })); if(!run){ run = (await import('../../../../src/events/ready/twitchScheduler')).default; } });

  test('registers two crons and processes live streamer (success path)', async () => {
    const client = makeClient();
    streamers = [{ active: true, isLive: false, twitchChannel: 'chan', guildId: 'g1', save: jest.fn(async function(){ this.saved=true; }) }];
    streamCfg = [{ guildId: 'g1', channelId: 'liveChan' }];
    getUserByName.mockResolvedValue({ id: 'u1', displayName: 'Chan', profilePictureUrl: 'purl' });
    getStreamByUserId.mockResolvedValue({ id: 's1', title: 'Live Title', gameName: 'Game', thumbnailUrl: 'http://thumb/{width}x{height}' });
  await run(client);
    expect(scheduled.length).toBe(2);
    await scheduled[1].cb();
    const streamer = streamers[0];
    expect(streamer.isLive).toBe(true);
  });

  test('error in streamer processing logs error', async () => {
    const client = makeClient();
    streamers = [{ active: true, isLive: false, twitchChannel: 'chan', guildId: 'g1', save: jest.fn(async function(){}) }];
    streamCfg = [{ guildId: 'g1', channelId: 'liveChan' }];
    getUserByName.mockImplementation(()=> { throw new Error('apiFail'); });
  await run(client);
    await scheduled[1].cb();
    const hit = error.mock.calls.find(c=> (c[0]||'').includes('Streamer chan'));
    expect(hit).toBeTruthy();
  });

  test('already live streamer with stream again -> no duplicate notification', async () => {
    const client = makeClient();
    streamers = [{ active: true, isLive: true, twitchChannel: 'chan', guildId: 'g1', save: jest.fn(async function(){ this.saved=true; }) }];
    streamCfg = [{ guildId: 'g1', channelId: 'liveChan' }];
    getUserByName.mockResolvedValue({ id: 'u1', displayName: 'Chan', profilePictureUrl: 'purl' });
    getStreamByUserId.mockResolvedValue({ id: 's1', title: 'Still Live', gameName: 'Game', thumbnailUrl: 'http://thumb/{width}x{height}' });
    await run(client);
    await scheduled[1].cb();
    const channel = client.guilds.cache.get('g1').channels.cache.get('liveChan');
    expect(channel.send).not.toHaveBeenCalled();
    expect(streamers[0].saved).toBeUndefined();
  });

  test('live -> offline transition sets isLive false and saves', async () => {
    const client = makeClient();
    const save = jest.fn(async function(){ this.saved=true; });
    streamers = [{ active: true, isLive: true, twitchChannel: 'chan', guildId: 'g1', save }];
    streamCfg = [{ guildId: 'g1', channelId: 'liveChan' }];
    getUserByName.mockResolvedValue({ id: 'u1', displayName: 'Chan', profilePictureUrl: 'purl' });
    getStreamByUserId.mockResolvedValue(null);
    await run(client);
    await scheduled[1].cb();
    expect(streamers[0].isLive).toBe(false);
    expect(save).toHaveBeenCalled();
  });

  test('no streamers -> silent skip (no warn/error)', async () => {
    const client = makeClient();
    streamers = []; streamCfg = [];
    await run(client);
    await scheduled[1].cb();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  test('thumbnail fetch fail falls back to remote image (no files property)', async () => {
    const client = makeClient();
    streamers = [{ active: true, isLive: false, twitchChannel: 'chan', guildId: 'g1', save: jest.fn(async function(){ this.isLive=true; }) }];
    streamCfg = [{ guildId: 'g1', channelId: 'liveChan' }];
    getUserByName.mockResolvedValue({ id: 'u1', displayName: 'Chan', profilePictureUrl: 'purl' });
    getStreamByUserId.mockResolvedValue({ id: 's1', title: 'Live', gameName: 'Game', thumbnailUrl: 'http://thumb/{width}x{height}' });
  fetchMock.mockResolvedValueOnce({ ok: false, arrayBuffer: async ()=> new ArrayBuffer(0) } as any);
    await run(client);
    await scheduled[1].cb();
    const channel = client.guilds.cache.get('g1').channels.cache.get('liveChan');
    const firstCallArg = channel.send.mock.calls[0][0];
    expect(firstCallArg.files).toBeUndefined();
    const thumbError = error.mock.calls.find(c=> (c[0]||'').includes('Błąd pobierania miniatury'));
    expect(thumbError).toBeTruthy();
  });

  test('thumbnail write failure falls back to remote image', async () => {
    const client = makeClient();
    streamers = [{ active: true, isLive: false, twitchChannel: 'chan', guildId: 'g1', save: jest.fn(async function(){ this.isLive=true; }) }];
    streamCfg = [{ guildId: 'g1', channelId: 'liveChan' }];
    getUserByName.mockResolvedValue({ id: 'u1', displayName: 'Chan', profilePictureUrl: 'purl' });
    getStreamByUserId.mockResolvedValue({ id: 's1', title: 'Live', gameName: 'Game', thumbnailUrl: 'http://thumb/{width}x{height}' });
    fetchMock.mockResolvedValueOnce({ ok: true, arrayBuffer: async ()=> new ArrayBuffer(0) });
    fsOps.writeFile.mockRejectedValueOnce(new Error('diskFail'));
    await run(client);
    await scheduled[1].cb();
    const channel = client.guilds.cache.get('g1').channels.cache.get('liveChan');
    const arg = channel.send.mock.calls[0][0];
    expect(arg.files).toBeUndefined();
    const writeErr = error.mock.calls.find(c=> (c[0]||'').includes('Błąd pobierania miniatury'));
    expect(writeErr).toBeTruthy();
  });

  test('cleanupOldThumbnails removes extra files', async () => {
    const client = makeClient();
    const files = Array.from({ length: 105 }, (_, i)=> `f${i}.jpg`);
    fsOps.readdir.mockResolvedValueOnce(files);
    fsOps.stat.mockImplementation(async (p:string)=> { const m = p.match(/f(\d+)\.jpg$/); const num = m ? parseInt(m[1]) : 0; return { mtime: { getTime: () => num } }; });
    await run(client);
    scheduled[0].cb();
    await Promise.resolve();
    await new Promise(r=> setTimeout(r,0));
  const unlinked = fsOps.unlink.mock.calls.map((c: any[])=> c[0] as string);
    expect(unlinked.length).toBe(5);
  expect(unlinked.filter((p: string)=> /f[0-4]\.jpg$/.test(p)).length).toBe(5);
  });

  test('ensureThumbnailsDirectory creates folders when access fails', async () => {
    const client = makeClient();
    // First two access calls fail (assets and thumbnails), then succeed subsequently
    fsOps.access
      .mockRejectedValueOnce(new Error('no assets'))
      .mockRejectedValueOnce(new Error('no thumbs'));
    await run(client);
    // Called twice for creating both directories with recursive flag
    expect(fsOps.mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    expect(fsOps.mkdir).toHaveBeenCalledTimes(2);
  });

  test('sendStreamNotification: first send fails -> warn and fallback send without file', async () => {
    const client = makeClient();
    const guild = client.guilds.cache.get('g1');
    const channel = guild.channels.cache.get('liveChan');
    // First send (with thumbnail file) fails, second send (fallback) succeeds
    channel.send.mockRejectedValueOnce(new Error('network'));

    streamers = [{ active: true, isLive: false, twitchChannel: 'chan', guildId: 'g1', save: jest.fn(async function(){ this.isLive=true; }) }];
    streamCfg = [{ guildId: 'g1', channelId: 'liveChan' }];
    getUserByName.mockResolvedValue({ id: 'u1', displayName: 'Chan', profilePictureUrl: 'purl' });
    getStreamByUserId.mockResolvedValue({ id: 's1', title: 'Live', gameName: 'Game', thumbnailUrl: 'http://thumb/{width}x{height}' });
    // Ensure thumbnail download succeeds so first attempted send uses files
    fetchMock.mockResolvedValueOnce({ ok: true, arrayBuffer: async ()=> new ArrayBuffer(0) });

    await run(client);
    await scheduled[1].cb();

    // First call attempted with files, failed; second call should be without files
    expect(channel.send).toHaveBeenCalledTimes(2);
    const firstArg = channel.send.mock.calls[0][0];
    const secondArg = channel.send.mock.calls[1][0];
    expect(firstArg.files).toBeDefined();
    expect(secondArg.files).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Błąd wysyłania powiadomienia'));
  });

  test('cleanupOldThumbnails: readdir error is logged', async () => {
    const client = makeClient();
    fsOps.readdir.mockRejectedValueOnce(new Error('readdirFail'));
    await run(client);
    // Trigger daily cleanup cron
    await scheduled[0].cb();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas czyszczenia miniatur'));
  });

  test('sendStreamNotification: guild not found -> warns and no save', async () => {
    const client = makeClient();
    // Streamer references non-existing guild
    streamers = [{ active: true, isLive: false, twitchChannel: 'chan', guildId: 'gX', save: jest.fn(async function(){ this.isLive=true; }) }];
    streamCfg = [{ guildId: 'gX', channelId: 'liveChan' }];
    getUserByName.mockResolvedValue({ id: 'u1', displayName: 'Chan', profilePictureUrl: 'purl' });
    getStreamByUserId.mockResolvedValue({ id: 's1', title: 'Live', gameName: 'Game', thumbnailUrl: 'http://thumb/{width}x{height}' });
    await run(client);
    await scheduled[1].cb();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Nie znaleziono serwera o ID: gX'));
    expect((streamers[0] as any).isLive).toBe(false);
  });

  test('sendStreamNotification: channel not found -> warns and no save', async () => {
    const client = makeClient();
    // Guild exists but channel ID mismatches
    streamers = [{ active: true, isLive: false, twitchChannel: 'chan', guildId: 'g1', save: jest.fn(async function(){ this.isLive=true; }) }];
    streamCfg = [{ guildId: 'g1', channelId: 'missingChan' }];
    getUserByName.mockResolvedValue({ id: 'u1', displayName: 'Chan', profilePictureUrl: 'purl' });
    getStreamByUserId.mockResolvedValue({ id: 's1', title: 'Live', gameName: 'Game', thumbnailUrl: 'http://thumb/{width}x{height}' });
    await run(client);
    await scheduled[1].cb();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Nie znaleziono kanału o ID: missingChan'));
    expect((streamers[0] as any).isLive).toBe(false);
  });

  test('ensureThumbnailsDirectory failure is caught and logged on startup', async () => {
    const client = makeClient();
    // Make mkdir throw on first attempt to simulate fatal fs error
    fsOps.access.mockRejectedValueOnce(new Error('no assets'));
    fsOps.mkdir.mockRejectedValueOnce(new Error('mkdir fail'));
    await run(client);
    // Should log the startup error
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Błąd podczas tworzenia katalogu miniatur'));
    // Cron jobs still scheduled
    expect(scheduled.length).toBe(2);
  });

  test('sendStreamNotification: channel exists but is not text (no send) -> warns and returns false', async () => {
    const client = makeClient();
    // Replace the channel getter to return an object without send
    (client.guilds.cache.get('g1') as any).channels.cache.get = (id: string) =>
      id === 'notText' ? ({ id: 'notText' } as any) : null;
    streamers = [{ active: true, isLive: false, twitchChannel: 'chan', guildId: 'g1', save: jest.fn(async function(){ this.isLive=true; }) }];
    streamCfg = [{ guildId: 'g1', channelId: 'notText' }];
    getUserByName.mockResolvedValue({ id: 'u1', displayName: 'Chan', profilePictureUrl: 'purl' });
    getStreamByUserId.mockResolvedValue({ id: 's1', title: 'Live', gameName: 'Game', thumbnailUrl: 'http://thumb/{width}x{height}' });
    await run(client);
    await scheduled[1].cb();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('nie jest to kanał tekstowy'));
    expect((streamers[0] as any).isLive).toBe(false);
  });
});
