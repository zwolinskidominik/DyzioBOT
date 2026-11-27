import type { Client, Guild, Message } from 'discord.js';
import { getMinecraftConfig, type MinecraftConfig } from '../../config/minecraft';
import { MinecraftStateModel } from '../../models/MinecraftState';
import { buildPanel, type PanelExtras, type StartedBy } from '../../utils/minecraftEmbeds';
import logger from '../../utils/logger';
import { ControlClient } from './controlClient';
import { MinecraftMonitor, type MonitorSnapshot } from './monitor';
import { duringStart, StartController } from './startController';
import { RenameLimiter, applyStatsChannelName, ensureStatsChannel } from './statsChannel';
import { channelNameFor, type ServerView } from './serverState';
import { reconcileWhitelist } from './whitelistService';
import { MinecraftStatsService } from './statsService';

/**
 * Jeden komplet obiektów funkcji Minecraft na proces bota (stan w pamięci: ostatnie IP, cooldown
 * startu, limiter zmian nazwy licznika). `null` = funkcja wyłączona (brak/błąd konfiguracji).
 */
export interface MinecraftRuntime {
  config: MinecraftConfig;
  monitor: MinecraftMonitor;
  starter: StartController;
  limiter: RenameLimiter;
  /** Statystyki graczy (GET /stats w gamezone-control). */
  stats: MinecraftStatsService;
  /** Kto włączył serwer (kopia z bazy; `undefined` = jeszcze nie wczytano po restarcie bota). */
  startedBy: StartedBy | null | undefined;
}

let runtime: MinecraftRuntime | null | undefined;

export function getMinecraftRuntime(): MinecraftRuntime | null {
  if (runtime !== undefined) return runtime;
  const config = getMinecraftConfig();
  if (!config) {
    runtime = null;
    return runtime;
  }
  const monitor = new MinecraftMonitor(config, new ControlClient(config));
  runtime = {
    config,
    monitor,
    starter: new StartController(monitor),
    limiter: new RenameLimiter(),
    stats: new MinecraftStatsService(config),
    startedBy: undefined,
  };
  return runtime;
}

/* ── Kto włączył serwer ──────────────────────────────────────── */

async function loadStartedBy(rt: MinecraftRuntime): Promise<void> {
  if (rt.startedBy !== undefined) return;
  const state = await MinecraftStateModel.findOne({ guildId: rt.config.guildId }).lean();
  rt.startedBy = state?.startedBy && state.startedAt ? { userId: state.startedBy, at: state.startedAt } : null;
}

/** Zapamiętuje (albo czyści - `null`) osobę, która włączyła serwer. */
export async function setStartedBy(rt: MinecraftRuntime, value: StartedBy | null): Promise<void> {
  rt.startedBy = value;
  await MinecraftStateModel.updateOne(
    { guildId: rt.config.guildId },
    value ? { $set: { startedBy: value.userId, startedAt: value.at } } : { $unset: { startedBy: 1, startedAt: 1 } },
    { upsert: true }
  ).catch((err: unknown) => logger.warn(`[MC] Nie udało się zapisać, kto włączył serwer: ${err}`));
}

/** Stan do pokazania: w trakcie startu „wyłączona” maszyna to po prostu „startuje”. */
export function visibleView(rt: MinecraftRuntime, snapshot: MonitorSnapshot): ServerView {
  return rt.starter.inProgress ? duringStart(snapshot).view : snapshot.view;
}

export function panelPayload(rt: MinecraftRuntime, view: ServerView, extras: PanelExtras = {}) {
  return buildPanel(view, rt.config.displayHost, { startInProgress: rt.starter.inProgress, startedBy: rt.startedBy, ...extras });
}

/* ── Stały panel ─────────────────────────────────────────────── */

async function fetchPanelMessage(guild: Guild, channelId: string, messageId: string): Promise<Message | null> {
  const channel = guild.channels.cache.get(channelId);
  if (!channel || !channel.isTextBased()) return null;
  return channel.messages.fetch(messageId).catch(() => null);
}

/** Zapamiętuje nowy stały panel; poprzedni (na innym kanale albo starszy) usuwa. */
export async function registerPanel(guild: Guild, message: Message): Promise<void> {
  const state =
    (await MinecraftStateModel.findOne({ guildId: guild.id })) ?? new MinecraftStateModel({ guildId: guild.id });
  if (state.panelChannelId && state.panelMessageId && state.panelMessageId !== message.id) {
    const old = await fetchPanelMessage(guild, state.panelChannelId, state.panelMessageId);
    await old?.delete().catch((err: unknown) => logger.warn(`[MC] Nie udało się usunąć starego panelu: ${err}`));
  }
  state.panelChannelId = message.channelId;
  state.panelMessageId = message.id;
  await state.save();
}

/** Odświeża stały panel. Jeśli ktoś go usunął - zapomina o nim (bez zakładania nowego). */
export async function refreshPanel(
  guild: Guild,
  rt: MinecraftRuntime,
  view: ServerView,
  extras: PanelExtras = {},
  /** Wiadomość już odświeżona przez interakcję - nie edytuj jej drugi raz. */
  skipMessageId?: string | undefined
): Promise<void> {
  const state = await MinecraftStateModel.findOne({ guildId: guild.id });
  if (!state?.panelChannelId || !state.panelMessageId) return;
  if (state.panelMessageId === skipMessageId) return;
  const message = await fetchPanelMessage(guild, state.panelChannelId, state.panelMessageId);
  if (!message) {
    state.panelChannelId = undefined;
    state.panelMessageId = undefined;
    await state.save();
    return;
  }
  await message.edit(panelPayload(rt, view, extras)).catch((err: unknown) => logger.warn(`[MC] Nie udało się odświeżyć panelu: ${err}`));
}

/* ── Cykl co minutę ──────────────────────────────────────────── */

/** Licznik: zapamiętaj nową nazwę i ustaw, jeśli limit zmian pozwala. */
export async function updateStatsChannel(guild: Guild, rt: MinecraftRuntime, view: ServerView): Promise<void> {
  const channel = await ensureStatsChannel(guild);
  if (!channel) return;
  rt.limiter.request(channelNameFor(view));
  await applyStatsChannelName(channel, rt.limiter);
}

export async function runMinecraftCycle(client: Client): Promise<void> {
  const rt = getMinecraftRuntime();
  if (!rt) return;
  const guild = client.guilds.cache.get(rt.config.guildId);
  if (!guild) return;

  await loadStartedBy(rt);
  const snapshot = await rt.monitor.refresh();
  const view = visibleView(rt, snapshot);
  // Maszyna wyłączona - następne włączenie (może spoza Discorda) nie powinno pokazywać starej osoby.
  if (rt.startedBy && !rt.starter.inProgress && (view.kind === 'offline' || view.kind === 'stopping')) {
    await setStartedBy(rt, null);
  }

  await updateStatsChannel(guild, rt, view);
  // W trakcie startu panel odświeża StartController (z opisem etapu) - tu by go nadpisał.
  if (!rt.starter.inProgress) await refreshPanel(guild, rt, view);

  if (view.kind === 'online' && snapshot.ip) {
    const summary = await reconcileWhitelist(guild.id, { host: snapshot.ip, port: rt.config.rconPort, password: rt.config.rconPassword });
    if (summary.applied > 0) logger.info(`[MC] Whitelista: wykonano ${summary.applied} zmian.`);
  }
}
