import { Socket } from 'net';

/**
 * Minimalny klient RCON tylko do whitelisty. Z zewnątrz da się wysłać WYŁĄCZNIE
 * `whitelist add <nick>` i `whitelist remove <nick>` ze sprawdzonym nickiem - nigdy surową komendę.
 *
 * Protokół (Source RCON): pakiet = int32 LE długość reszty, int32 LE id, int32 LE typ, treść
 * zakończona \0 i pusty bajt \0. Typ 3 = logowanie, 2 = komenda, 0 = odpowiedź. Logowanie
 * odrzucone = odpowiedź z id -1.
 */

export const RCON_TIMEOUT_MS = 5_000;
export const MINECRAFT_NICK = /^[A-Za-z0-9_]{3,16}$/;

const TYPE_RESPONSE = 0;
const TYPE_COMMAND = 2;
const TYPE_LOGIN = 3;
const LOGIN_ID = 1;
const COMMAND_ID = 2;

export function encodeRconPacket(id: number, type: number, body: string): Buffer {
  const bodyBytes = Buffer.from(body, 'utf8');
  const packet = Buffer.alloc(4 + 4 + 4 + bodyBytes.length + 2);
  packet.writeInt32LE(packet.length - 4, 0);
  packet.writeInt32LE(id, 4);
  packet.writeInt32LE(type, 8);
  bodyBytes.copy(packet, 12);
  return packet;
}

export interface RconPacket {
  id: number;
  type: number;
  body: string;
}

/** Wyciąga kompletne pakiety z bufora; zwraca je i resztę bajtów (niepełny pakiet). */
export function decodeRconPackets(buffer: Buffer): { packets: RconPacket[]; rest: Buffer } {
  const packets: RconPacket[] = [];
  let offset = 0;
  while (buffer.length - offset >= 4) {
    const length = buffer.readInt32LE(offset);
    if (length < 10 || length > 4_110) throw new Error('Nieprawidłowa długość pakietu RCON');
    if (buffer.length - offset - 4 < length) break;
    const id = buffer.readInt32LE(offset + 4);
    const type = buffer.readInt32LE(offset + 8);
    const body = buffer.subarray(offset + 12, offset + 4 + length - 2).toString('utf8');
    packets.push({ id, type, body });
    offset += 4 + length;
  }
  return { packets, rest: buffer.subarray(offset) };
}

export type WhitelistAction = 'add' | 'remove';

export type RconResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'unreachable' | 'auth' | 'timeout' | 'invalid_nick' };

export interface RconTarget {
  host: string;
  port: number;
  password: string;
}

/**
 * Wysyła `whitelist add|remove <nick>`. Odrzucone połączenie / brak odpowiedzi to normalna sytuacja,
 * gdy Minecraft się jeszcze ładuje - wywołujący po prostu spróbuje w następnym cyklu.
 */
export function runWhitelistCommand(
  target: RconTarget,
  action: WhitelistAction,
  nick: string,
  timeoutMs = RCON_TIMEOUT_MS
): Promise<RconResult> {
  if (!MINECRAFT_NICK.test(nick)) return Promise.resolve({ ok: false, reason: 'invalid_nick' });
  const command = `whitelist ${action} ${nick}`;

  return new Promise((resolve) => {
    const socket = new Socket();
    let buffer: Buffer = Buffer.alloc(0);
    let loggedIn = false;
    let settled = false;

    const finish = (result: RconResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => finish({ ok: false, reason: 'timeout' }), timeoutMs);
    timer.unref?.();

    socket.once('error', () => finish({ ok: false, reason: 'unreachable' }));
    socket.once('close', () => finish({ ok: false, reason: 'unreachable' }));
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      let decoded: { packets: RconPacket[]; rest: Buffer };
      try {
        decoded = decodeRconPackets(buffer);
      } catch {
        return finish({ ok: false, reason: 'unreachable' });
      }
      buffer = decoded.rest;
      for (const packet of decoded.packets) {
        if (!loggedIn) {
          if (packet.id === -1) return finish({ ok: false, reason: 'auth' });
          if (packet.id === LOGIN_ID && packet.type === TYPE_COMMAND) {
            loggedIn = true;
            socket.write(encodeRconPacket(COMMAND_ID, TYPE_COMMAND, command));
          }
          continue;
        }
        if (packet.id === COMMAND_ID && packet.type === TYPE_RESPONSE) {
          return finish({ ok: true, text: packet.body });
        }
      }
    });

    socket.connect(target.port, target.host, () => {
      socket.write(encodeRconPacket(LOGIN_ID, TYPE_LOGIN, target.password));
    });
  });
}

export type WhitelistOutcome = 'done' | 'no_such_player' | 'unknown';

/**
 * Znaczenie odpowiedzi serwera (Minecraft 1.20.1):
 * - add:    „Added X to the whitelist” / „Player is already whitelisted” → done,
 *           „That player does not exist” → no_such_player (nick nie istnieje w Minecrafcie);
 * - remove: „Removed X from the whitelist” / „Player is not whitelisted” → done
 *           (także „That player does not exist” - nie ma czego usuwać).
 */
export function classifyWhitelistResponse(action: WhitelistAction, text: string): WhitelistOutcome {
  const clean = text.replace(/§[0-9a-fk-or]/gi, '').trim().toLowerCase();
  if (action === 'add') {
    if (clean.startsWith('added ') && clean.includes('whitelist')) return 'done';
    if (clean.includes('already whitelisted')) return 'done';
    if (clean.includes('player does not exist')) return 'no_such_player';
    return 'unknown';
  }
  if (clean.startsWith('removed ') && clean.includes('whitelist')) return 'done';
  if (clean.includes('not whitelisted')) return 'done';
  if (clean.includes('player does not exist')) return 'done';
  return 'unknown';
}
