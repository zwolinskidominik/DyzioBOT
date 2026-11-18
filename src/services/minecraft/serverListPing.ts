import { Socket } from 'net';
import { z } from 'zod';

/**
 * Server List Ping (protokół statusu Minecrafta 1.7+): handshake + zapytanie o status, odpowiedź
 * to JSON z wersją, liczbą graczy i opisem (MOTD). Własna, mała implementacja - gotowe biblioteki
 * nie są aktualizowane od lat. Limit czasu 5 s, odpowiedź walidowana Zodem.
 */

export const PING_TIMEOUT_MS = 5_000;
/** Odpowiedź Forge z listą modów bywa duża, ale nie powinna przekraczać kilku MB. */
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
/** -1 = „dowolna wersja” - serwer i tak zwraca swój status. */
const PROTOCOL_ANY = -1;

/* ── VarInt / ramki ──────────────────────────────────────────── */

export function encodeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    bytes.push(byte);
  } while (v !== 0);
  return Buffer.from(bytes);
}

/** `null` = za mało bajtów (ramka jeszcze nie doszła w całości). */
export function readVarInt(buffer: Buffer, offset: number): { value: number; size: number } | null {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    if (offset + i >= buffer.length) return null;
    const byte = buffer[offset + i]!;
    value |= (byte & 0x7f) << (7 * i);
    if ((byte & 0x80) === 0) return { value: value | 0, size: i + 1 };
  }
  throw new Error('VarInt dłuższy niż 5 bajtów');
}

function packet(id: number, payload: Buffer): Buffer {
  const body = Buffer.concat([encodeVarInt(id), payload]);
  return Buffer.concat([encodeVarInt(body.length), body]);
}

export function buildHandshake(host: string, port: number): Buffer {
  const hostBytes = Buffer.from(host, 'utf8');
  const portBytes = Buffer.alloc(2);
  portBytes.writeUInt16BE(port);
  const payload = Buffer.concat([
    encodeVarInt(PROTOCOL_ANY),
    encodeVarInt(hostBytes.length),
    hostBytes,
    portBytes,
    encodeVarInt(1), // następny stan: status
  ]);
  return Buffer.concat([packet(0x00, payload), packet(0x00, Buffer.alloc(0))]);
}

/**
 * Wyciąga tekst JSON z ramki odpowiedzi statusu. `null` = ramka niekompletna (czekamy na więcej
 * danych). Rzuca, gdy dane nie wyglądają na odpowiedź statusu.
 */
export function extractStatusJson(buffer: Buffer): string | null {
  const length = readVarInt(buffer, 0);
  if (!length) return null;
  if (length.value <= 0 || length.value > MAX_RESPONSE_BYTES) throw new Error('Nieprawidłowa długość ramki');
  if (buffer.length < length.size + length.value) return null;

  let offset = length.size;
  const packetId = readVarInt(buffer, offset);
  if (!packetId || packetId.value !== 0x00) throw new Error('Nieoczekiwany pakiet odpowiedzi');
  offset += packetId.size;

  const jsonLength = readVarInt(buffer, offset);
  if (!jsonLength) throw new Error('Brak długości JSON');
  offset += jsonLength.size;
  if (jsonLength.value < 0 || offset + jsonLength.value > length.size + length.value) {
    throw new Error('Nieprawidłowa długość JSON');
  }
  return buffer.subarray(offset, offset + jsonLength.value).toString('utf8');
}

/* ── JSON statusu ────────────────────────────────────────────── */

type ChatComponent = string | { text?: string | undefined; extra?: ChatComponent[] | undefined };

const ChatComponentSchema: z.ZodType<ChatComponent> = z.lazy(() =>
  z.union([
    z.string(),
    z.object({
      text: z.string().optional(),
      extra: z.array(ChatComponentSchema).optional(),
    }),
  ])
);

const StatusSchema = z.object({
  version: z.object({ name: z.string(), protocol: z.number() }),
  players: z.object({
    max: z.number().int().nonnegative(),
    online: z.number().int().nonnegative(),
    sample: z.array(z.object({ name: z.string(), id: z.string().optional() })).optional(),
  }),
  description: ChatComponentSchema.optional(),
});

export interface PingResponse {
  versionName: string;
  online: number;
  max: number;
  /** Nicki z próbki (serwer podaje najwyżej kilkanaście; mody mogą je ukrywać). */
  players: string[];
  motd: string;
}

/** Usuwa kody formatowania Minecrafta (§a, §l…). */
export function stripFormatting(text: string): string {
  return text.replace(/§[0-9a-fk-or]/gi, '');
}

export function flattenDescription(component: ChatComponent | undefined): string {
  if (component === undefined) return '';
  if (typeof component === 'string') return component;
  return `${component.text ?? ''}${(component.extra ?? []).map(flattenDescription).join('')}`;
}

/** Tylko prawdziwe nicki Minecrafta (część serwerów wkleja w próbkę tekst albo „Anonymous Player”). */
const NICK_PATTERN = /^[A-Za-z0-9_]{3,16}$/;

export function parseStatusJson(json: string): PingResponse | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  const parsed = StatusSchema.safeParse(raw);
  if (!parsed.success) return null;
  const status = parsed.data;
  return {
    versionName: status.version.name,
    online: status.players.online,
    max: status.players.max,
    players: (status.players.sample ?? []).map((p) => p.name).filter((name) => NICK_PATTERN.test(name)),
    motd: stripFormatting(flattenDescription(status.description)).replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Czy odpowiedź pochodzi z NASZEGO serwera. IP po wyłączeniu maszyny może dostać ktoś inny (też
 * z serwerem MC) - bez tej kontroli bot pokazałby fałszywe 🟢.
 */
export function isExpectedServer(response: PingResponse, expectedMotd: string, expectedVersion: string): boolean {
  return (
    response.motd.toLowerCase().includes(expectedMotd.toLowerCase()) &&
    response.versionName.includes(expectedVersion)
  );
}

/* ── Połączenie ──────────────────────────────────────────────── */

/** Pinguje serwer. `null` = brak odpowiedzi, przekroczony czas albo odpowiedź nie do odczytania. */
export function pingServer(host: string, port: number, timeoutMs = PING_TIMEOUT_MS): Promise<PingResponse | null> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let received: Buffer = Buffer.alloc(0);
    let settled = false;

    const finish = (result: PingResponse | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);
    timer.unref?.();

    socket.once('error', () => finish(null));
    socket.once('close', () => finish(null));
    socket.on('data', (chunk: Buffer) => {
      received = Buffer.concat([received, chunk]);
      if (received.length > MAX_RESPONSE_BYTES + 16) return finish(null);
      try {
        const json = extractStatusJson(received);
        if (json !== null) finish(parseStatusJson(json));
      } catch {
        finish(null);
      }
    });

    socket.connect(port, host, () => {
      socket.write(buildHandshake(host, port));
    });
  });
}
