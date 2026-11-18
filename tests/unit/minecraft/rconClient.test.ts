import { createServer, type Server, type Socket } from 'net';
import {
  classifyWhitelistResponse,
  decodeRconPackets,
  encodeRconPacket,
  runWhitelistCommand,
} from '../../../src/services/minecraft/rconClient';

describe('RCON packets', () => {
  it('round-trips a packet', () => {
    const packet = encodeRconPacket(7, 2, 'whitelist add Kuba');
    expect(packet.readInt32LE(0)).toBe(packet.length - 4);
    expect(decodeRconPackets(packet)).toEqual({ packets: [{ id: 7, type: 2, body: 'whitelist add Kuba' }], rest: Buffer.alloc(0) });
  });

  it('keeps an incomplete packet for later and decodes two packets at once', () => {
    const both = Buffer.concat([encodeRconPacket(1, 2, ''), encodeRconPacket(2, 0, 'ok')]);
    expect(decodeRconPackets(both).packets).toHaveLength(2);
    const partial = decodeRconPackets(both.subarray(0, both.length - 3));
    expect(partial.packets).toHaveLength(1);
    expect(partial.rest.length).toBeGreaterThan(0);
  });
});

describe('classifyWhitelistResponse', () => {
  it.each([
    ['add', 'Added Kuba to the whitelist', 'done'],
    ['add', 'Player is already whitelisted', 'done'],
    ['add', '§cThat player does not exist', 'no_such_player'],
    ['add', 'Unknown or incomplete command', 'unknown'],
    ['remove', 'Removed Kuba from the whitelist', 'done'],
    ['remove', 'Player is not whitelisted', 'done'],
    ['remove', 'That player does not exist', 'done'],
    ['remove', 'something else', 'unknown'],
  ] as const)('%s: "%s" → %s', (action, text, expected) => {
    expect(classifyWhitelistResponse(action, text)).toBe(expected);
  });
});

describe('runWhitelistCommand (fake RCON server)', () => {
  let server: Server;
  let port = 0;
  const received: string[] = [];

  function listen(password: string, answer: string): Promise<void> {
    received.length = 0;
    server = createServer((socket: Socket) => {
      let buffer: Buffer = Buffer.alloc(0);
      socket.on('data', (chunk: Buffer) => {
        buffer = Buffer.concat([buffer, chunk]);
        const { packets, rest } = decodeRconPackets(buffer);
        buffer = rest;
        for (const packet of packets) {
          if (packet.type === 3) {
            socket.write(encodeRconPacket(packet.body === password ? packet.id : -1, 2, ''));
          } else if (packet.type === 2) {
            received.push(packet.body);
            socket.write(encodeRconPacket(packet.id, 0, answer));
          }
        }
      });
    });
    return new Promise((resolve) =>
      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        port = typeof address === 'object' && address ? address.port : 0;
        resolve();
      })
    );
  }

  afterEach(async () => {
    if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('logs in and sends only the whitelist command with the validated nick', async () => {
    await listen('secret', 'Added Kuba_1 to the whitelist');
    const result = await runWhitelistCommand({ host: '127.0.0.1', port, password: 'secret' }, 'add', 'Kuba_1');
    expect(result).toEqual({ ok: true, text: 'Added Kuba_1 to the whitelist' });
    expect(received).toEqual(['whitelist add Kuba_1']);
  });

  it('reports a rejected password', async () => {
    await listen('secret', 'x');
    await expect(runWhitelistCommand({ host: '127.0.0.1', port, password: 'wrong' }, 'remove', 'Kuba')).resolves.toEqual({ ok: false, reason: 'auth' });
    expect(received).toEqual([]);
  });

  it('never sends anything for an invalid nick (no command injection)', async () => {
    await listen('secret', 'x');
    await expect(runWhitelistCommand({ host: '127.0.0.1', port, password: 'secret' }, 'add', 'Kuba; op Kuba')).resolves.toEqual({ ok: false, reason: 'invalid_nick' });
    expect(received).toEqual([]);
  });

  it('reports an unreachable server (e.g. Minecraft still loading)', async () => {
    await listen('secret', 'x');
    const closedPort = port;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await expect(runWhitelistCommand({ host: '127.0.0.1', port: closedPort, password: 'secret' }, 'add', 'Kuba')).resolves.toEqual({ ok: false, reason: 'unreachable' });
  });
});
