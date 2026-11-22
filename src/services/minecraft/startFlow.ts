import type { Guild } from 'discord.js';
import { panelPayload, refreshPanel, setStartedBy, updateStatsChannel, type MinecraftRuntime } from './runtime';
import { progressText, type StartOutcome } from './startController';

type PanelMessage = ReturnType<typeof panelPayload>;

export interface StartFlowUi {
  /** Edycja wiadomości, z której kliknięto ▶️ (panel albo jego kopia). Brak = tylko stały panel. */
  editOwn?: ((payload: PanelMessage) => Promise<unknown>) | undefined;
  /** ID tej wiadomości - żeby stałego panelu nie edytować drugi raz. */
  ownMessageId?: string | undefined;
}

/**
 * Wspólny przebieg startu dla przycisku ▶️ i komendy Claude'a: zapamiętuje, kto włącza, pokazuje
 * etapy w panelu i licznik, a przy nieudanym zleceniu wraca do poprzedniej osoby w polu „Włączył”.
 */
export async function runServerStart(guild: Guild, rt: MinecraftRuntime, starterId: string, ui: StartFlowUi = {}): Promise<StartOutcome> {
  void updateStatsChannel(guild, rt, { kind: 'starting', phase: 'machine' }).catch(() => undefined);
  const previousStarter = rt.startedBy ?? null;
  await setStartedBy(rt, { userId: starterId, at: new Date() });

  const show = async (payload: PanelMessage, view: Parameters<typeof panelPayload>[1], extras: Parameters<typeof panelPayload>[2]) => {
    await ui.editOwn?.(payload).catch(() => undefined);
    await refreshPanel(guild, rt, view, extras, ui.ownMessageId).catch(() => undefined);
  };

  const outcome = await rt.starter.start(async (snapshot) => {
    const extras = { progress: progressText(snapshot.view), startInProgress: true };
    await show(panelPayload(rt, snapshot.view, extras), snapshot.view, extras);
  });

  if (outcome.kind !== 'ready' && outcome.kind !== 'timeout') {
    await setStartedBy(rt, previousStarter);
    return outcome;
  }

  const finalText =
    outcome.kind === 'ready'
      ? `✅ Serwer gotowy - wchodźcie: \`${rt.config.displayHost}\``
      : '❌ Serwer nie wystartował w ciągu 5 minut. Kliknij „Odśwież” za chwilę, a jeśli dalej nic - daj znać administratorowi.';
  const extras = { progress: finalText, startInProgress: false };
  await show(panelPayload(rt, outcome.view, extras), outcome.view, extras);
  void updateStatsChannel(guild, rt, outcome.view).catch(() => undefined);
  return outcome;
}
