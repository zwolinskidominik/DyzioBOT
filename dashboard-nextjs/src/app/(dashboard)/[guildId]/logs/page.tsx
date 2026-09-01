"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Hash, Search, X, RotateCcw, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { SlideIn } from "@/components/ui/animated";
import EmbedColorPicker from "@/components/EmbedColorPicker";
import { cn } from "@/lib/utils";

function DeezySwitch({ className, ...props }: React.ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn(
        "deezy-switch h-6 w-11 border-0 bg-[#636a80] shadow-none data-[state=checked]:bg-[#3b82f6] data-[state=unchecked]:bg-[#636a80] [&>span]:h-4 [&>span]:w-4 [&>span]:translate-x-1 [&>span]:bg-white [&>span]:shadow-none [&>span]:data-[state=checked]:translate-x-6 [&>span]:data-[state=unchecked]:translate-x-1",
        className
      )}
      {...props}
    />
  );
}

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface LogEventConfig {
  name: string;
  description: string;
  color: number;
  /** Klucz przykładowych pól pokazywanych w podglądzie na żywo — patrz PREVIEW_FIELDS. */
  fieldsKey: string;
  /** Nagłówek pokazywany w podglądzie na żywo, gdy różni się od `name` (bo tak wygląda realny embed bota). */
  previewHeading?: string;
  /** Czy realny embed bota ma miniaturkę z avatarem użytkownika (prawy górny róg) — pokazujemy ją też w podglądzie. */
  previewAvatar?: boolean;
  /** Dodatkowa notka pod podglądem — np. gdy realny embed ma kilka wariantów treści (różne tytuły/pola). */
  previewNote?: string;
  /** Dodatkowy fragment tekstu (bez etykiety pola) pokazywany pod nagłówkiem — np. cytowana treść usuniętej wiadomości. */
  previewBody?: string;
}

interface LogConfig {
  guildId: string;
  enabled?: boolean;
  logChannels: Record<string, string>;
  enabledEvents: Record<string, boolean>;
  colorOverrides: Record<string, string>;
}

const LOG_EVENT_CONFIGS: Record<string, LogEventConfig> = {
  memberBan: { name: 'Zbanowanie członka', description: 'Użytkownik został zbanowany', color: 0xFF0000, fieldsKey: 'ban', previewHeading: '✈️ <@PrzykladowyUser> został zbanowany na serwerze.', previewAvatar: true },
  memberUnban: { name: 'Odbanowanie członka', description: 'Użytkownik został odbanowany', color: 0xFAA61A, fieldsKey: 'unban', previewHeading: '🛬 <@PrzykladowyUser> został odbanowany.', previewAvatar: true },
  memberKick: { name: 'Wyrzucenie członka', description: 'Użytkownik został wyrzucony', color: 0xFF4444, fieldsKey: 'kick', previewHeading: '👋 <@PrzykladowyUser> został wyrzucony.', previewAvatar: true },
  memberTimeout: { name: 'Wyciszenie', description: 'Wyciszenie (nadane/usunięte)', color: 0xFF8800, fieldsKey: 'timeout', previewHeading: '🔇 <@PrzykladowyUser> został wyciszony na czas 15 minut.', previewAvatar: true, previewNote: 'Przy usunięciu wyciszenia nagłówek to „🔊 Usunięto timeout dla <@Uzytkownik>." — pole Moderator zostaje.' },
  moderationCommand: { name: 'Komenda moderacyjna', description: 'Użyto komendy moderacyjnej', color: 0xFFAA00, fieldsKey: 'modcmd', previewHeading: '⚖️ Użyto komendy /warn wobec <@PrzykladowyUser>.', previewNote: '/warn-remove pokazuje zamiast tego pole „ID ostrzeżenia" + Moderator. Auto-ban po limicie ostrzeżeń zamienia Kara/Ostrzeżenia na jedno pole „Kara: PERMANENTNY BAN".' },
  antiSpam: { name: 'Anti-Spam', description: 'Wykryto spam — podjęto automatyczną akcję', color: 0xE74C3C, fieldsKey: 'none', previewHeading: '🛡️ Wykryto zbyt szybkie wiadomości', previewBody: '**Użytkownik:** <@PrzykladowyUser> (PrzykladowyUser#0001)\n**Kanał:** <#ogólny>\n**Wykryto:** 8 wiadomości w 5s\n**Akcja:** Wyciszenie na 5 min', previewNote: 'Cała treść (Użytkownik/Kanał/Powód/Akcja) jest w opisie embeda, nie w polach. Tytuł i treść zależą od reguły, która zadziałała: zbyt szybkie wiadomości, zaproszenia, wzmianki lub powtórzenia — każda ma inny nagłówek.' },

  messageDelete: { name: 'Usunięcie wiadomości', description: 'Wiadomość została usunięta', color: 0xFF6B6B, fieldsKey: 'msgDelete', previewHeading: '🗑️ Wiadomość wysłana przez <@PrzykladowyUser> została usunięta na kanale <#ogólny>.', previewBody: 'Hejka, czy ktoś wie kiedy startuje event? 🎉', previewNote: 'Komenda /clear (masowe usuwanie) loguje się też pod tym zdarzeniem, ale w innym formacie: ma tytuł „🗑️ Masowe usunięcie wiadomości" i zwykły opis (Moderator/Kanał/Ilość/Filtr) bez pól ani avatara.' },
  messageEdit: { name: 'Edycja wiadomości', description: 'Wiadomość została zedytowana', color: 0x4A90E2, fieldsKey: 'msgEdit', previewHeading: '✏️ Wiadomość wysłana przez <@PrzykladowyUser> została edytowana na kanale <#ogólny>. Przejdź do wiadomości' },

  memberJoin: { name: 'Członek dołączył', description: 'Nowy członek dołączył do serwera', color: 0x43B581, fieldsKey: 'memberJoin', previewHeading: '📥 Użytkownik <@PrzykladowyUser> dołączył do serwera.' },
  memberLeave: { name: 'Członek opuścił', description: 'Członek opuścił serwer', color: 0xFAA61A, fieldsKey: 'memberLeave', previewHeading: '📤 Użytkownik <@PrzykladowyUser> opuścił serwer.' },
  memberNicknameChange: { name: 'Zmiana pseudonimu', description: 'Zmieniono pseudonim', color: 0x95A5A6, fieldsKey: 'nick', previewHeading: '📝 <@PrzykladowyUser> zmienił pseudonim.' },
  memberRoleAdd: { name: 'Nadanie roli', description: 'Nadano rolę', color: 0x3498DB, fieldsKey: 'roleAdd', previewHeading: '➕ Rola użytkownika <@PrzykladowyUser> została zaktualizowana.' },
  memberRoleRemove: { name: 'Usunięcie roli', description: 'Usunięto rolę', color: 0xE74C3C, fieldsKey: 'roleRemove', previewHeading: '➖ Rola użytkownika <@PrzykladowyUser> została zaktualizowana.' },

  voiceJoin: { name: 'Dołączył do VC', description: 'Dołączył do kanału głosowego', color: 0x9B59B6, fieldsKey: 'none', previewHeading: '🔊 <@PrzykladowyUser> dołączył do kanału głosowego <#Ogólny>.' },
  voiceLeave: { name: 'Opuścił VC', description: 'Opuścił kanał głosowy', color: 0xE91E63, fieldsKey: 'none', previewHeading: '🔇 <@PrzykladowyUser> wyszedł z kanału głosowego <#Ogólny>.' },
  voiceMove: { name: 'Przełączył kanał VC', description: 'Przełączył się między kanałami głosowymi', color: 0x8E44AD, fieldsKey: 'none', previewHeading: '🔀 <@PrzykladowyUser> przeniósł się z kanału <#Ogólny> na <#Muzyka>.' },
  voiceDisconnect: { name: 'Odłączony od VC', description: 'Odłączony od kanału głosowego (force)', color: 0xC0392B, fieldsKey: 'vcMod', previewHeading: '⚡ <@PrzykladowyUser> został odłączony od kanału głosowego <#Ogólny>.' },
  voiceMemberMove: { name: 'Przeniesiony do VC', description: 'Przeniesiony do innego kanału (moderator)', color: 0xD35400, fieldsKey: 'vcMod', previewHeading: '👉 <@PrzykladowyUser> został przeniesiony z <#Ogólny> na <#Muzyka>.' },
  voiceStateChange: { name: 'Stan głosu', description: 'Stan głosu (mute/deaf/stream/camera)', color: 0x7F8C8D, fieldsKey: 'none', previewHeading: '🎤 <@PrzykladowyUser> zmienił stan głosu na <#Ogólny>.', previewBody: '• 🔇 Wyciszył mikrofon' },

  channelCreate: { name: 'Utworzenie kanału', description: 'Utworzono kanał', color: 0x1ABC9C, fieldsKey: 'chanCreate', previewHeading: '📁 Utworzono kanał <#ogłoszenia>.' },
  channelDelete: { name: 'Usunięcie kanału', description: 'Usunięto kanał', color: 0xE67E22, fieldsKey: 'chanDelete', previewHeading: '🗑️ Usunięto kanał `ogłoszenia`.' },
  channelUpdate: { name: 'Aktualizacja kanału', description: 'Zaktualizowano kanał', color: 0x16A085, fieldsKey: 'chanUpdate', previewHeading: '✏️ Zaktualizowano nazwę kanału <#ogloszenia-wazne>.', previewNote: 'Treść zależy od tego, co się zmieniło: nazwa lub temat kanału — każdy wariant ma inny nagłówek i pola (zmiana uprawnień to osobne zdarzenie „Aktualizacja uprawnień").' },
  channelPermissionUpdate: { name: 'Aktualizacja uprawnień', description: 'Zaktualizowano uprawnienia kanału', color: 0x2C3E50, fieldsKey: 'modOnly', previewHeading: '🔐 Aktualizacja uprawnień kanału: <#ogólny>', previewBody: '**Permissions:**\n↘️ <@&Moderatorzy>\n✅ Manage Messages\n❌ Mention Everyone' },

  threadCreate: { name: 'Tworzenie wątku', description: 'Utworzono wątek', color: 0x5DADE2, fieldsKey: 'threadCreate', previewHeading: '🧵 Utworzono wątek <#pomoc-z-userbotem>.' },
  threadDelete: { name: 'Usuwanie wątku', description: 'Usunięto wątek', color: 0xF39C12, fieldsKey: 'threadDelete', previewHeading: '🗑️ Usunięto wątek `pomoc-z-userbotem`.' },
  threadUpdate: { name: 'Aktualizacja wątku', description: 'Zaktualizowano wątek', color: 0x3498DB, fieldsKey: 'threadUpdate', previewHeading: '✏️ Zaktualizowano nazwę wątku <#pomoc-nowa>.', previewNote: 'Treść zależy od zmiany: nazwa, archiwizacja lub zablokowanie wątku — każdy wariant ma inny nagłówek.' },

  roleCreate: { name: 'Utworzenie roli', description: 'Utworzono rolę', color: 0xF1C40F, fieldsKey: 'roleCreate', previewHeading: '🎭 Utworzono rolę <@&VIP>.' },
  roleDelete: { name: 'Usunięcie roli', description: 'Usunięto rolę', color: 0xE74C3C, fieldsKey: 'roleDelete', previewHeading: '🗑️ Usunięto rolę `VIP`.' },
  roleUpdate: { name: 'Aktualizacja roli', description: 'Zaktualizowano rolę', color: 0xE67E22, fieldsKey: 'roleUpdate', previewHeading: '✏️ Zaktualizowano nazwę roli <@&VIP>.', previewNote: 'Treść zależy od zmiany: nazwa, kolor, uprawnienia, wyświetlanie osobno lub możliwość oznaczania — każdy wariant ma inny nagłówek.' },

  guildUpdate: { name: 'Aktualizacja serwera', description: 'Zaktualizowano serwer', color: 0x2C3E50, fieldsKey: 'guildUpdate', previewHeading: '🏠 Zaktualizowano nazwę serwera.', previewNote: 'Treść zależy od zmiany: nazwa, ikona, baner, poziom weryfikacji lub kanał systemowy — każdy wariant ma inny nagłówek i pola.' },
  inviteCreate: { name: 'Wysłano zaproszenie', description: 'Utworzono zaproszenie', color: 0x1F8B4C, fieldsKey: 'invite', previewHeading: '📨 Utworzono zaproszenie.' },
};

const EVENT_CATEGORIES: Record<string, string[]> = {
  'Moderacja': ['memberBan', 'memberUnban', 'memberKick', 'memberTimeout', 'moderationCommand', 'antiSpam'],
  'Wiadomości': ['messageDelete', 'messageEdit'],
  'Członkowie': ['memberJoin', 'memberLeave', 'memberNicknameChange', 'memberRoleAdd', 'memberRoleRemove'],
  'Kanały głosowe': ['voiceJoin', 'voiceLeave', 'voiceMove', 'voiceDisconnect', 'voiceMemberMove', 'voiceStateChange'],
  'Kanały': ['channelCreate', 'channelDelete', 'channelUpdate', 'channelPermissionUpdate'],
  'Wątki': ['threadCreate', 'threadDelete', 'threadUpdate'],
  'Role': ['roleCreate', 'roleDelete', 'roleUpdate'],
  'Serwer': ['guildUpdate', 'inviteCreate'],
};

const ALL_EVENTS = Object.values(EVENT_CATEGORIES).flat();
const FIRST_CATEGORY = Object.keys(EVENT_CATEGORIES)[0];
const FIRST_EVENT = EVENT_CATEGORIES[FIRST_CATEGORY][0];

interface PreviewField {
  k: string;
  v: string;
  /** Pole pełnej szerokości (odpowiednik `inline: false` w realnym embedzie bota) — nie paruje się z sąsiednim polem. */
  wide?: boolean;
  /** Wartość pokazana jako blok kodu (monospace, ciemne tło) — tak jak stare/nowe treści w logu edycji wiadomości. */
  code?: boolean;
}

/** Przykładowe wartości pól embeda pokazywane w panelu podglądu — wyłącznie ilustracyjne. */
const PREVIEW_FIELDS: Record<string, PreviewField[]> = {
  ban: [{ k: 'Moderator:', v: '<@Administrator>' }, { k: 'Powód:', v: 'spam w <#general>' }],
  unban: [{ k: 'Moderator:', v: '<@Administrator>' }],
  kick: [{ k: 'Moderator:', v: '<@Administrator>' }, { k: 'Powód:', v: 'spam w <#general>' }],
  timeout: [{ k: 'Moderator:', v: '<@Administrator>' }],
  modcmd: [
    { k: 'Powód', v: 'spam w <#general>', wide: true },
    { k: 'Kara', v: 'Wyciszenie do 18:45' },
    { k: 'Ostrzeżenia', v: '2/4' },
    { k: 'Moderator:', v: '<@Administrator>' },
  ],
  msgDelete: [],
  msgEdit: [
    { k: 'Stare', v: 'Najgorzej że to pewnie kawa z cukrem :/', wide: true, code: true },
    { k: 'Nowe', v: 'Najgorzej że to pewnie kawa z cukrem 🥺', wide: true, code: true },
  ],

  none: [],
  vcMod: [{ k: 'Moderator:', v: '<@Administrator>' }],

  memberJoin: [{ k: '👤 Konto utworzone', v: '3 dni temu' }, { k: '🔢 Liczba członków', v: '128' }],
  memberLeave: [{ k: '⏱️ Czas na serwerze', v: '2 miesiące temu' }, { k: '🔢 Liczba członków', v: '127' }],
  nick: [{ k: 'Stary', v: 'Brak' }, { k: 'Nowy', v: 'PrzykladowyUser :D' }],
  roleAdd: [{ k: 'Role', v: '✅ <@&VIP>', wide: true }, { k: 'Moderator:', v: '<@Administrator>' }],
  roleRemove: [{ k: 'Role', v: '❌ <@&VIP>', wide: true }, { k: 'Moderator:', v: '<@Administrator>' }],

  chanCreate: [{ k: 'Nazwa', v: 'ogłoszenia' }, { k: 'Typ', v: 'Tekstowy' }, { k: 'Moderator:', v: '<@Administrator>' }],
  chanDelete: [{ k: 'Typ', v: 'Tekstowy' }, { k: 'Moderator:', v: '<@Administrator>' }],
  chanUpdate: [{ k: 'Stara nazwa', v: 'ogłoszenia' }, { k: 'Nowa nazwa', v: 'ogloszenia-wazne' }, { k: 'Moderator:', v: '<@Administrator>' }],
  modOnly: [{ k: 'Moderator:', v: '<@Administrator>' }],

  threadCreate: [{ k: 'Nazwa', v: 'pomoc-z-userbotem' }, { k: 'Kanał nadrzędny', v: '<#pomoc>' }, { k: 'Moderator:', v: '<@Administrator>' }],
  threadDelete: [{ k: 'Kanał nadrzędny', v: '<#pomoc>' }, { k: 'Moderator:', v: '<@Administrator>' }],
  threadUpdate: [{ k: 'Stara nazwa', v: 'pomoc-stara' }, { k: 'Nowa nazwa', v: 'pomoc-nowa' }, { k: 'Moderator:', v: '<@Administrator>' }],

  roleCreate: [{ k: 'Nazwa', v: 'VIP' }, { k: 'Kolor', v: '#F1C40F' }, { k: 'Moderator:', v: '<@Administrator>' }],
  roleDelete: [{ k: 'Kolor', v: '#F1C40F' }, { k: 'Moderator:', v: '<@Administrator>' }],
  roleUpdate: [{ k: 'Stara nazwa', v: 'Czlonek' }, { k: 'Nowa nazwa', v: 'VIP' }, { k: 'Moderator:', v: '<@Administrator>' }],

  guildUpdate: [{ k: 'Stara nazwa', v: 'Moj Serwer' }, { k: 'Nowa nazwa', v: 'Super Serwer' }, { k: 'Moderator:', v: '<@Administrator>' }],
  invite: [
    { k: '🔗 Kod', v: 'abcd1234' },
    { k: '📁 Kanał', v: '<#ogólny>' },
    { k: '⏰ Wygasa', v: 'za 7 dni' },
    { k: '🔢 Maksymalne użycia', v: 'Nielimitowane' },
    { k: 'Zaproszający', v: '<@Administrator>' },
  ],
};

/**
 * Grupuje pola podglądu w wiersze tak jak realnie renderuje je Discord: `wide` (odpowiednik
 * `inline: false`) dostaje własny wiersz, reszta („inline: true") pakuje się po MAKSYMALNIE 3
 * w rzędzie — Discord embedy mieszczą do 3 pól inline obok siebie, dopiero 4. zawija się do
 * kolejnego wiersza.
 */
function buildPreviewRows(fields: PreviewField[]): PreviewField[][] {
  const rows: PreviewField[][] = [];
  let pending: PreviewField[] = [];
  const flushPending = () => {
    if (pending.length > 0) {
      rows.push(pending);
      pending = [];
    }
  };
  for (const field of fields) {
    if (field.wide) {
      flushPending();
      rows.push([field]);
      continue;
    }
    pending.push(field);
    if (pending.length === 3) flushPending();
  }
  flushPending();
  return rows;
}

/**
 * Renderuje tekst podglądu z uwzględnieniem wzmianek i pogrubień — w danych mockowych oznaczamy
 * je jak surową składnię Discorda: `<@Nazwa>` (użytkownik), `<@&Nazwa>` (rola), `<#Nazwa>` (kanał/wątek),
 * `**tekst**` (pogrubienie, tak jak w realnych opisach embedów np. Anti-Spam czy uprawnień kanału).
 * Dzięki temu podgląd wygląda tak samo jak realny embed bota, zamiast pokazywać gołą składnię markdown.
 * Kontener z tym tekstem powinien mieć `whitespace-pre-line`, żeby `\n` też renderowały się jak w Discordzie.
 */
function renderMentionText(text: string): React.ReactNode[] {
  const regex = /<(@&|@|#)([^>]+)>|\*\*([^*]+)\*\*/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [, prefix, label, bold] = match;
    if (bold !== undefined) {
      parts.push(
        <strong key={`bold-${key++}`} className="font-bold text-white">
          {bold}
        </strong>
      );
    } else {
      parts.push(
        <span
          key={`mention-${key++}`}
          className="rounded px-[3px] py-px font-medium"
          style={{ background: 'rgba(88,101,242,0.3)', color: '#c9cdfb' }}
        >
          {prefix === '#' ? `#${label}` : `@${label}`}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

const decimalToHex = (decimal: number): string => `#${decimal.toString(16).padStart(6, '0').toUpperCase()}`;

/** Polska odmiana liczebnikowa: 1 / 2-4 / 5+. */
function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function categoryOf(eventType: string): string {
  for (const [label, events] of Object.entries(EVENT_CATEGORIES)) {
    if (events.includes(eventType)) return label;
  }
  return FIRST_CATEGORY;
}

function LogsPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const guildId = params?.guildId as string;
  const highlightEvent = searchParams?.get('highlight');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(FIRST_CATEGORY);
  const [selectedEvent, setSelectedEvent] = useState<string>(FIRST_EVENT);
  const [config, setConfig] = useState<LogConfig>({
    guildId,
    enabled: true,
    logChannels: {},
    enabledEvents: {},
    colorOverrides: {},
  });

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  // Wejście z linku typu ?highlight=antiSpam — ustaw kategorię/zdarzenie i przewiń do wiersza.
  useEffect(() => {
    if (loading || !highlightEvent || !LOG_EVENT_CONFIGS[highlightEvent]) return;
    setActiveCategory(categoryOf(highlightEvent));
    setSelectedEvent(highlightEvent);
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, highlightEvent]);

  useEffect(() => {
    if (loading || !highlightEvent) return;
    const t = setTimeout(() => {
      document.getElementById(`log-event-${highlightEvent}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    return () => clearTimeout(t);
  }, [loading, highlightEvent, activeCategory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [channelsData, configRes] = await Promise.all([
        fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
        fetchWithAuth(`/api/guild/${guildId}/logs/config`)
      ]);

      setChannels(channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5));

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig({
          ...configData,
          guildId,
          enabled: configData.enabled ?? true,
          logChannels: configData.logChannels || {},
          enabledEvents: configData.enabledEvents || {},
          colorOverrides: configData.colorOverrides || {},
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Nie udało się załadować danych logów. Sprawdź połączenie z internetem i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/logs/config`);
      if (!response.ok) throw new Error("Failed to fetch config");
      const data = await response.json();
      setConfig({
        ...data,
        logChannels: data.logChannels || {},
        enabledEvents: data.enabledEvents || {},
        colorOverrides: data.colorOverrides || {},
      });
    } catch (error) {
      console.error("Error fetching config:", error);
      toast.error("Nie udało się pobrać konfiguracji");
    }
  };

  const handleSave = async () => {
    const missing = ALL_EVENTS.find((e) => config.enabledEvents[e] && !config.logChannels[e]);
    if (missing) {
      setActiveCategory(categoryOf(missing));
      setSelectedEvent(missing);
      setSearch('');
      toast.error(`Brak kanału dla: ${LOG_EVENT_CONFIGS[missing].name.toLowerCase()}`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/logs/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Failed to save config");

      toast.success("Konfiguracja logów została zapisana!");
      await fetchConfig();
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (eventType: string) => {
    setConfig((prev) => ({
      ...prev,
      enabledEvents: { ...prev.enabledEvents, [eventType]: !prev.enabledEvents[eventType] },
    }));
    setSelectedEvent(eventType);
  };

  const toggleAllInCategory = (category: string) => {
    const events = EVENT_CATEGORIES[category];
    const allOn = events.every((e) => config.enabledEvents[e]);
    setConfig((prev) => {
      const nextEnabled = { ...prev.enabledEvents };
      events.forEach((e) => { nextEnabled[e] = !allOn; });
      return { ...prev, enabledEvents: nextEnabled };
    });
    toast.success(`${allOn ? 'Wyłączono' : 'Włączono'} kategorię ${category.toLowerCase()}`);
  };

  const setEventChannel = (eventType: string, channelId: string) => {
    setConfig((prev) => ({
      ...prev,
      logChannels: { ...prev.logChannels, [eventType]: channelId },
    }));
  };

  const setEventColor = (eventType: string, color: string) => {
    setConfig((prev) => ({
      ...prev,
      colorOverrides: { ...prev.colorOverrides, [eventType]: color },
    }));
  };

  const resetEventColor = (eventType: string) => {
    setConfig((prev) => {
      const next = { ...prev.colorOverrides };
      delete next[eventType];
      return { ...prev, colorOverrides: next };
    });
    toast.success("Przywrócono domyślny kolor");
  };

  const getChannelName = (channelId: string) => channels.find((c) => c.id === channelId)?.name ?? 'Nieznany kanał';

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Nie udało się załadować logów" message={error} onRetry={handleRetry} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[214px_minmax(0,1fr)_430px]">
            <Skeleton className="h-64 w-full" />
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-80 w-full" />
            </div>
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const matches = (eventType: string) => {
    if (!q) return true;
    const cfg = LOG_EVENT_CONFIGS[eventType];
    return `${cfg.name} ${cfg.description} ${categoryOf(eventType)}`.toLowerCase().includes(q);
  };

  const onCount = ALL_EVENTS.filter((e) => config.enabledEvents[e]).length;
  const totalCount = ALL_EVENTS.length;
  const categoryCount = Object.keys(EVENT_CATEGORIES).length;
  const usedChannels = new Set(
    ALL_EVENTS.filter((e) => config.enabledEvents[e] && config.logChannels[e]).map((e) => config.logChannels[e])
  );
  const shownTotal = ALL_EVENTS.filter(matches).length;

  const headerSummary = `${totalCount} ${plural(totalCount, 'zdarzenie', 'zdarzenia', 'zdarzeń')} w ${categoryCount} ${plural(categoryCount, 'kategorii', 'kategoriach', 'kategoriach')}.`;

  const categoriesToShow = q ? Object.keys(EVENT_CATEGORIES) : [activeCategory];
  const renderedGroups = categoriesToShow
    .map((category) => {
      const rows = EVENT_CATEGORIES[category].filter(matches);
      return rows.length > 0 ? { category, rows } : null;
    })
    .filter((g): g is { category: string; rows: string[] } => g !== null);

  const selConfig = LOG_EVENT_CONFIGS[selectedEvent] ?? LOG_EVENT_CONFIGS[FIRST_EVENT];
  const selEventType = LOG_EVENT_CONFIGS[selectedEvent] ? selectedEvent : FIRST_EVENT;
  const selOn = !!config.enabledEvents[selEventType];
  const selChannelId = config.logChannels[selEventType] || '';
  const selChannelName = selChannelId ? getChannelName(selChannelId) : null;
  const selColor = config.colorOverrides[selEventType] || decimalToHex(selConfig.color);
  const selFields = PREVIEW_FIELDS[selConfig.fieldsKey] ?? [];
  const selFieldRows = buildPreviewRows(selFields);
  const selCategory = categoryOf(selEventType);
  const isEnabled = config.enabled ?? true;

  return (
    <div className="min-h-full">
      <div className="w-full space-y-4">

        <SlideIn direction="up" delay={100}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">System Logów</h1>
              <p className="mt-2 max-w-[640px] text-sm leading-6 text-[#969db0]">
                {headerSummary} Każde ma własny kanał i kolor embeda — kliknij wiersz, aby zobaczyć podgląd.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/80">
              <span>{isEnabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch
                checked={isEnabled}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, enabled: checked }))}
                aria-label="Włącz lub wyłącz system logów"
              />
            </div>
          </div>
        </SlideIn>

        {!isEnabled && (
          <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-[#17181E] px-3 py-2 text-xs leading-6 text-[#9aa2b8]">
            <ShieldOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              System logów jest <span className="font-semibold text-white/80">wyłączony</span>. Możesz konfigurować
              zdarzenia i zapisać ustawienia, ale bot nie wyśle logów, dopóki nie włączysz przełącznika{' '}
              <span className="font-semibold text-white/80">Aktywne</span> u góry.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[214px_minmax(0,1fr)_430px]">

          {/* Sidebar kategorii */}
          <div className="flex flex-col gap-[3px] rounded-[10px] bg-[#1F2129] p-2.5 lg:sticky lg:top-4">
            {Object.keys(EVENT_CATEGORIES).map((category) => {
              const events = EVENT_CATEGORIES[category];
              const onN = events.filter((e) => config.enabledEvents[e]).length;
              const active = !q && category === activeCategory;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => { setActiveCategory(category); setSearch(''); }}
                  className="flex items-center gap-2.5 rounded-lg py-2.5 pl-2.5 pr-2.5 text-left transition-colors hover:bg-[#23252f]"
                  style={{
                    borderLeft: `3px solid ${active ? '#6366f1' : 'transparent'}`,
                    background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
                  }}
                >
                  <span
                    className="min-w-0 flex-1 truncate text-xs"
                    style={{ color: active ? '#fff' : '#c4cad8', fontWeight: active ? 700 : 600 }}
                  >
                    {category}
                  </span>
                  <span
                    className="shrink-0 text-[10px] font-bold"
                    style={{ color: onN === events.length ? '#86efac' : onN === 0 ? '#6b7280' : '#fcd34d' }}
                  >
                    {onN}/{events.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Kolumna główna */}
          <div className="flex min-w-0 flex-col gap-3">

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[10px] bg-[#1F2129] px-4 py-3.5">
                <div className="text-[22px] font-extrabold text-white">
                  {onCount}<span className="text-[13px] font-semibold text-[#6b7280]">/{totalCount}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-[#8d94a8]">zdarzeń włączonych</div>
              </div>
              <div className="rounded-[10px] bg-[#1F2129] px-4 py-3.5">
                <div className="text-[22px] font-extrabold text-[#a5b4fc]">{usedChannels.size}</div>
                <div className="mt-0.5 text-[11px] text-[#8d94a8]">
                  {plural(usedChannels.size, 'kanał docelowy', 'kanały docelowe', 'kanałów docelowych')}
                </div>
              </div>
            </div>

            <div className="rounded-[10px] bg-[#1F2129] px-3.5 py-3">
              <div className="flex h-9 items-center gap-2.5 rounded-md border border-[#2f3341] bg-[#17181E] px-3">
                <Search className="h-3.5 w-3.5 shrink-0 text-[#6b7280]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Szukaj zdarzenia… (np. ban, rola, wątek)"
                  className="min-w-0 flex-1 bg-transparent text-xs text-[#d8dbe6] outline-none placeholder:text-[#6b7280]"
                />
                {q ? (
                  <button type="button" onClick={() => setSearch('')} title="Wyczyść" className="text-[#6b7280] transition-colors hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {q ? (
                <p className="mt-2 text-[11px] text-[#8d94a8]">
                  {shownTotal} {plural(shownTotal, 'zdarzenie', 'zdarzenia', 'zdarzeń')} pasuje do zapytania
                </p>
              ) : null}
            </div>

            <div className="overflow-hidden rounded-[10px] bg-[#1F2129]">
              {renderedGroups.map(({ category, rows }) => {
                const events = EVENT_CATEGORIES[category];
                const onN = events.filter((e) => config.enabledEvents[e]).length;
                const allOn = events.every((e) => config.enabledEvents[e]);
                return (
                  <div key={category}>
                    <div className="flex items-center gap-2.5 border-b border-[#2f3341] px-4 py-3">
                      <span className="text-sm font-bold text-white">{category}</span>
                      <span className="text-[11px] text-[#6b7280]">
                        {events.length} {plural(events.length, 'zdarzenie', 'zdarzenia', 'zdarzeń')} · {onN} włączonych
                      </span>
                      <span className="flex-1" />
                      <button
                        type="button"
                        onClick={() => toggleAllInCategory(category)}
                        className="rounded-[5px] border border-[#2f3341] px-2.5 py-1 text-[10px] font-semibold text-[#8d94a8] transition-colors hover:border-bot-primary hover:text-white"
                      >
                        {allOn ? 'Wyłącz wszystkie' : 'Włącz wszystkie'}
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 p-3.5">
                      {rows.map((eventType) => {
                        const eventConfig = LOG_EVENT_CONFIGS[eventType];
                        const isOn = !!config.enabledEvents[eventType];
                        const channelId = config.logChannels[eventType] || '';
                        const rowColor = config.colorOverrides[eventType] || decimalToHex(eventConfig.color);
                        const isSelected = eventType === selectedEvent;

                        return (
                          <div
                            key={eventType}
                            id={`log-event-${eventType}`}
                            className="flex flex-wrap items-center gap-2.5 rounded-lg border p-2.5 transition-colors"
                            style={{
                              background: isSelected ? 'rgba(99,102,241,0.12)' : '#17181E',
                              borderColor: isSelected ? 'rgba(99,102,241,0.5)' : 'transparent',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setSelectedEvent(eventType)}
                              title="Pokaż w podglądzie"
                              className="h-[30px] w-[3px] shrink-0 rounded-sm"
                              style={{ background: rowColor }}
                            />
                            <button
                              type="button"
                              onClick={() => setSelectedEvent(eventType)}
                              className="block min-w-[90px] flex-1 basis-[140px] overflow-hidden text-left"
                              style={{ opacity: isOn ? 1 : 0.5 }}
                            >
                              <span className="block truncate text-[13px] font-semibold" style={{ color: isOn ? '#fff' : '#b9c0d0' }}>
                                {eventConfig.name}
                              </span>
                              <span className="block truncate text-[11px] text-[#6b7280]">{eventConfig.description}</span>
                            </button>

                            <Select value={channelId} onValueChange={(value) => setEventChannel(eventType, value)}>
                              <SelectTrigger
                                className="h-8 flex-[0_1_190px] min-w-[110px] border text-xs"
                                style={{
                                  opacity: isOn ? 1 : 0.5,
                                  borderColor: isOn && !channelId ? 'rgba(239,68,68,0.55)' : '#2f3341',
                                }}
                              >
                                <SelectValue placeholder="— brak kanału —">
                                  {channelId ? (
                                    <div className="flex items-center gap-1.5">
                                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                      {getChannelName(channelId)}
                                    </div>
                                  ) : (
                                    "— brak kanału —"
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {channels.map((channel) => (
                                  <SelectItem key={channel.id} value={channel.id}>
                                    <div className="flex items-center gap-1.5">
                                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                                      {channel.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>

                            <Switch
                              checked={isOn}
                              onCheckedChange={() => toggleEvent(eventType)}
                              className="shrink-0 data-[state=checked]:bg-[#3b82f6]"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {q && shownTotal === 0 ? (
                <div className="px-4 py-8 text-center text-[13px] text-[#8d94a8]">
                  Brak zdarzeń pasujących do „{search}".
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex h-[46px] items-center justify-center gap-2 rounded-lg bg-[#6366f1] text-[13px] font-semibold text-white transition-colors hover:bg-[#818cf8] disabled:opacity-70"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Zapisywanie...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> Zapisz konfigurację
                </>
              )}
            </button>
          </div>

          {/* Podgląd na żywo */}
          <div className="rounded-[10px] bg-[#17181E] p-4 shadow-[0_8px_18px_rgba(8,10,16,0.16)] lg:sticky lg:top-4">
            <div className="mb-3 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#6b7280]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: selOn ? '#22c55e' : '#4b5563' }} />
              Podgląd na żywo
            </div>

            <div className="flex gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/deezy.png" alt="Deezy" className="h-10 w-10 shrink-0 rounded-full object-cover" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[15px] font-bold text-white">
                  Deezy <span className="rounded bg-[#5865F2] px-1.5 py-px text-[10px] font-bold text-white">BOT</span>
                </div>
                <div
                  className="mt-1.5 flex items-start justify-between gap-3 overflow-hidden rounded-[4px] bg-[#1F2129] py-3 pl-3.5 pr-3.5"
                  style={{ borderLeft: `4px solid ${selColor}` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-white">{renderMentionText(selConfig.previewHeading ?? selConfig.name)}</div>
                    {selConfig.previewBody ? (
                      <div className="mt-2 whitespace-pre-line text-xs leading-5 text-[#d8dbe6]">{renderMentionText(selConfig.previewBody)}</div>
                    ) : null}
                    <div className="mt-2 flex flex-col gap-1.5">
                      {selFieldRows.map((row, i) => (
                        <div
                          key={i}
                          className={
                            row.length > 1
                              ? `grid gap-x-3 ${row.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`
                              : 'flex flex-col gap-1.5'
                          }
                        >
                          {row.map((f) => (
                            <span key={f.k} className="min-w-0 text-xs text-[#d8dbe6]">
                              <span className="block text-[10px] font-bold text-white">{f.k}</span>
                              {f.code ? (
                                <span
                                  className="mt-1 block whitespace-pre-wrap rounded-md px-2.5 py-2 font-mono text-[11px] text-[#c4cad8]"
                                  style={{ background: '#111214', border: '1px solid #2f3341' }}
                                >
                                  {f.v}
                                </span>
                              ) : (
                                renderMentionText(f.v)
                              )}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                  {selConfig.previewAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="https://cdn.discordapp.com/embed/avatars/0.png"
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : null}
                </div>
                <div className="mt-1 text-[11px] text-[#6b7280]">
                  {selChannelName ? `→ # ${selChannelName}` : '→ brak kanału'}
                </div>
                {selConfig.previewNote ? (
                  <div className="mt-1.5 text-[11px] italic leading-5 text-[#8d94a8]">{selConfig.previewNote}</div>
                ) : null}
              </div>
            </div>

            {!selOn ? (
              <div className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-6" style={{ color: '#fcd34d' }}>
                <span className="shrink-0">⚠️</span>
                <span>To zdarzenie jest wyłączone — log nie zostanie wysłany.</span>
              </div>
            ) : null}
            {selOn && !selChannelId ? (
              <div className="mt-2.5 flex items-start gap-1.5 text-[11px] leading-6" style={{ color: '#fca5a5' }}>
                <span className="shrink-0">⚠️</span>
                <span>Brak kanału — wybierz go w kolumnie „Kanał", inaczej log nie ma gdzie trafić.</span>
              </div>
            ) : null}

            <div className="mt-3.5 border-t border-[#2f3341] pt-3">
              <div className="mb-2 flex items-baseline justify-between gap-2.5">
                <span className="text-[11px] font-semibold text-[#c4cad8]">Kolor embeda</span>
                <button
                  type="button"
                  onClick={() => resetEventColor(selEventType)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-[#8d94a8] transition-colors hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" /> Domyślny
                </button>
              </div>
              <div className="flex items-center gap-2">
                <EmbedColorPicker
                  value={selColor}
                  onChange={(color) => setEventColor(selEventType, color)}
                  className="h-9 w-9 border border-[#2f3341]"
                />
                <span className="font-mono text-xs text-[#b9c0d0]">{selColor.toUpperCase()}</span>
              </div>
            </div>

            <div className="mt-3.5 border-t border-[#2f3341] pt-3 text-[11px] leading-6 text-[#6b7280]">
              Kategoria: <span className="text-[#b9c0d0]">{selCategory}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense fallback={null}>
      <LogsPageContent />
    </Suspense>
  );
}
