import type { Client, Guild, Message } from 'discord.js';
import { getMinecraftConfig, type MinecraftConfig } from '../../config/minecraft';
import { MinecraftStateModel } from '../../models/MinecraftState';
import { buildPanel, type PanelExtras } from '../../utils/minecraftEmbeds';
import logger from '../../utils/logger';
import { ControlClient } from './controlClient';
import { MinecraftMonitor, type MonitorSnapshot } from './monitor';
import { duringStart, StartController } from './startController';
import { RenameLimiter, applyStatsChannelName, ensureStatsChannel } from './statsChannel';
import { channelNameFor, type ServerView } from './serverState';
import { reconcileWhitelist } from './whitelistService';

/**
 * Jeden komplet obiektów funkcji Minecraft na proces bota (stan w pamięci: ostatnie IP, cooldown
 * startu, limiter zmian nazwy licznika). `null` = funkcja wyłączona (brak/błąd konfiguracji).
 */
export interface MinecraftRuntime {
  config: MinecraftConfig;
  monitor: MinecraftMonitor;
  starter: StartController;
  limiter: RenameLimiter;
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
  runtime = { config, monitor, starter: new StartController(monitor), limiter: new RenameLimiter() };
  return runtime;
}

/** Stan do pokazania: w trakcie startu „wyłączona” maszyna to po prostu „startuje”. */
export function visibleView(rt: MinecraftRuntime, snapshot: MonitorSnapshot): ServerView {
  return rt.starter.inProgress ? duringStart(snapshot).view : snapshot.view;
}

export function panelPayload(rt: MinecraftRuntime, view: ServerView, extras: PanelExtras = {}) {
  return buildPanel(view, rt.config.displayHost, { startInProgress: rt.starter.inProgress, ...extras });
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

  const snapshot = await rt.monitor.refresh();
  const view = visibleView(rt, snapshot);

  await updateStatsChannel(guild, rt, view);
  // W trakcie startu panel odświeża StartController (z opisem etapu) - tu by go nadpisał.
  if (!rt.starter.inProgress) await refreshPanel(guild, rt, view);

  if (view.kind === 'online' && snapshot.ip) {
    const summary = await reconcileWhitelist(guild.id, { host: snapshot.ip, port: rt.config.rconPort, password: rt.config.rconPassword });
    if (summary.applied > 0) logger.info(`[MC] Whitelista: wykonano ${summary.applied} zmian.`);
  }
}
