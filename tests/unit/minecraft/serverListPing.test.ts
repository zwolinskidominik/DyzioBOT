import { createServer, type Server } from 'net';
import {
  buildHandshake,
  encodeVarInt,
  extractStatusJson,
  flattenDescription,
  isExpectedServer,
  parseStatusJson,
  pingServer,
  readVarInt,
} from '../../../src/services/minecraft/serverListPing';

function statusFrame(json: string): Buffer {
  const jsonBytes = Buffer.from(json, 'utf8');
  const body = Buffer.concat([encodeVarInt(0x00), encodeVarInt(jsonBytes.length), jsonBytes]);
  return Buffer.concat([encodeVarInt(body.length), body]);
}

const GAMEZONE_STATUS = JSON.stringify({
  version: { name: '1.20.1', protocol: 763 },
  players: { max: 20, online: 2, sample: [{ name: 'Kuba_123', id: 'a' }, { name: '§cAnonymous Player', id: 'b' }, { name: 'Ola', id: 'c' }] },
  description: { text: '', extra: [{ text: '§aGameZone ' }, { text: 'Pack v5', extra: [{ text: ' - witamy' }] }] },
  forgeData: { mods: [] },
});

describe('VarInt', () => {
  it.each([0, 1, 127, 128, 255, 25_565, 2_097_151])('round-trips %i', (value) => {
    const encoded = encodeVarInt(value);
    expect(readVarInt(encoded, 0)).toEqual({ value, size: encoded.length });
  });

  it('encodes -1 as five bytes (protocol "any")', () => {
    const encoded = encodeVarInt(-1);
    expect(encoded).toEqual(Buffer.from([0xff, 0xff, 0xff, 0xff, 0x0f]));
    expect(readVarInt(encoded, 0)).toEqual({ value: -1, size: 5 });
  });

  it('returns null when bytes are missing and throws on too long VarInt', () => {
    expect(readVarInt(Buffer.from([0x80]), 0)).toBeNull();
    expect(() => readVarInt(Buffer.from([0x80, 0x80, 0x80, 0x80, 0x80, 0x01]), 0)).toThrow();
  });
});

describe('buildHandshake', () => {
  it('contains handshake (next state = status) followed by an empty status request', () => {
    const packet = buildHandshake('1.2.3.4', 25_565);
    const first = readVarInt(packet, 0)!;
    const handshake = packet.subarray(first.size, first.size + first.value);
    expect(handshake[0]).toBe(0x00);
    expect(handshake.includes(Buffer.from('1.2.3.4'))).toBe(true);
    expect(handshake.readUInt16BE(handshake.length - 3)).toBe(25_565);
    expect(handshake[handshake.length - 1]).toBe(1);
    expect(packet.subarray(first.size + first.value)).toEqual(Buffer.from([0x01, 0x00]));
  });
});

describe('extractStatusJson', () => {
  it('waits for the full frame', () => {
    const frame = statusFrame(GAMEZONE_STATUS);
    expect(extractStatusJson(frame.subarray(0, 10))).toBeNull();
    expect(extractStatusJson(frame)).toBe(GAMEZONE_STATUS);
  });

  it('rejects an unexpected packet id', () => {
    const body = Buffer.concat([encodeVarInt(0x05), encodeVarInt(2), Buffer.from('{}')]);
    expect(() => extractStatusJson(Buffer.concat([encodeVarInt(body.length), body]))).toThrow();
  });
});

describe('parseStatusJson', () => {
  it('parses players, keeps only real nicks and flattens the MOTD without formatting codes', () => {
    expect(parseStatusJson(GAMEZONE_STATUS)).toEqual({
      versionName: '1.20.1',
      online: 2,
      max: 20,
      players: ['Kuba_123', 'Ola'],
      motd: 'GameZone Pack v5 - witamy',
    });
  });

  it('accepts a plain string description and a missing sample', () => {
    const parsed = parseStatusJson(JSON.stringify({ version: { name: 'Forge 1.20.1', protocol: 763 }, players: { max: 20, online: 0 }, description: 'GameZone Pack v5' }));
    expect(parsed).toMatchObject({ players: [], motd: 'GameZone Pack v5', online: 0 });
  });

  it('returns null for invalid JSON or a wrong shape', () => {
    expect(parseStatusJson('not json')).toBeNull();
    expect(parseStatusJson(JSON.stringify({ players: { online: 'x' } }))).toBeNull();
  });

  it('flattens nested chat components', () => {
    expect(flattenDescription({ text: 'a', extra: ['b', { text: 'c', extra: [{ text: 'd' }] }] })).toBe('abcd');
  });
});

describe('isExpectedServer (protection against a recycled IP)', () => {
  const ours = parseStatusJson(GAMEZONE_STATUS)!;

  it('accepts our server', () => {
    expect(isExpectedServer(ours, 'GameZone Pack v5', '1.20.1')).toBe(true);
  });

  it('rejects another server with a different MOTD', () => {
    expect(isExpectedServer({ ...ours, motd: 'A Minecraft Server' }, 'GameZone Pack v5', '1.20.1')).toBe(false);
  });

  it('rejects a server with our MOTD but another version', () => {
    expect(isExpectedServer({ ...ours, versionName: '1.21.4' }, 'GameZone Pack v5', '1.20.1')).toBe(false);
  });
});

describe('pingServer (fake TCP server)', () => {
  let server: Server;
  let port = 0;

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  function listen(onData: (socket: import('net').Socket) => void): Promise<void> {
    server = createServer((socket) => {
      socket.once('data', () => onData(socket));
    });
    return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      port = typeof address === 'object' && address ? address.port : 0;
      resolve();
    }));
  }

  it('reads a status split into several chunks', async () => {
    await listen((socket) => {
      const frame = statusFrame(GAMEZONE_STATUS);
      socket.write(frame.subarray(0, 7));
      setTimeout(() => socket.end(frame.subarray(7)), 20);
    });
    await expect(pingServer('127.0.0.1', port)).resolves.toMatchObject({ online: 2, motd: 'GameZone Pack v5 - witamy' });
  });

  it('returns null when the server never answers (timeout)', async () => {
    await listen(() => undefined);
    await expect(pingServer('127.0.0.1', port, 100)).resolves.toBeNull();
  });

  it('returns null when the connection is refused', async () => {
    await listen(() => undefined);
    const closedPort = port;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    await expect(pingServer('127.0.0.1', closedPort, 1000)).resolves.toBeNull();
  });
});
