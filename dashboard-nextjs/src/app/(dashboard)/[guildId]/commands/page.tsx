"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Search, X, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { SlideIn } from "@/components/ui/animated";
import { useDirtyState } from "@/components/DirtyStateProvider";
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

interface UtilityCommand {
  name: string;
  description: string;
  category: "fun" | "misc" | "admin";
}

interface CommandsConfig {
  guildId: string;
  enabled: boolean;
  disabledCommands: string[];
}

interface SavedConfigState {
  enabled: boolean;
  disabledCommands: string[];
}

/**
 * Wszystkie komendy z folderów fun/ i misc/ (bez podfolderu misc/birthdays/ — te komendy
 * mają już własny przełącznik w module Urodziny) + 3 komendy z admin/, które konceptualnie
 * należą do Narzędzi (say, role, emoji-steal — patrz src/validations/commandToggle.ts,
 * ADDITIONAL_UTILITY_COMMANDS). Reszta admin/ (giveaway, xp) i moderacja (moderation/) mają
 * WŁASNE gate'y (moduleToggle.ts / moduleKonfiguracja Moderacji) i celowo NIE wchodzą tutaj.
 * kalendarz-adwentowy również pominięty — dostępny wyłącznie na oficjalnych serwerach
 * bota (restrictedGuildIds), nie ma sensu jako pojedynczy toggle per-server. warnings
 * pominięte — to komenda moderacyjna (mimo że fizycznie leży w misc/), nie utility.
 */
const UTILITY_COMMANDS: UtilityCommand[] = [
  // fun/
  { name: "dog", description: "Losowe zdjęcie psa na poprawę humoru 🐶", category: "fun" },
  { name: "cat", description: "Losowe zdjęcie kota, bo czemu nie? 🐱", category: "fun" },
  { name: "ciekawostka", description: "Poznaj losową ciekawostkę ze świata 🌎", category: "fun" },
  { name: "8ball", description: "Zadaj pytanie, a magiczna kula wyda wyrok 🔮", category: "fun" },
  { name: "kamien-papier-nozyce", description: "Zmierz się z Deezy w Kamień, Papier, Nożyce ✊", category: "fun" },
  { name: "pogoda", description: "Sprawdź aktualną pogodę w dowolnym mieście ☁️", category: "fun" },
  { name: "dowcip", description: "Deezy ma dla Ciebie losowy dowcip. Oby był dobry. 🤡", category: "fun" },
  { name: "meme", description: "Wylosuj mema z różnych zakątków internetu 🗿", category: "fun" },
  { name: "wisielec", description: "Odgadnij ukryte słowo, zanim będzie za późno 💀", category: "fun" },
  { name: "wisielec-top", description: "Sprawdź, kto najlepiej radzi sobie z Wisielcem 🏆", category: "fun" },
  { name: "wordle", description: "Odgadnij ukryte polskie słowo w 6 próbach 🟩", category: "fun" },
  { name: "wordle-top", description: "Sprawdź najlepszych graczy Wordle na serwerze 🏆", category: "fun" },
  // misc/
  { name: "help", description: "Sprawdź dostępne komendy i dowiedz się, jak ich używać", category: "misc" },
  { name: "ping", description: "Sprawdź, czy Deezy żyje i jak szybko odpowiada 🏓", category: "misc" },
  { name: "embed", description: "Stwórz własną wiadomość embed", category: "misc" },
  { name: "emoji", description: "Wyświetl wszystkie emoji dostępne na serwerze", category: "misc" },
  { name: "avatar", description: "Wyświetl avatar użytkownika w pełnym rozmiarze", category: "misc" },
  { name: "faceit", description: "Sprawdź statystyki gracza z FACEIT", category: "misc" },
  { name: "serverinfo", description: "Wyświetl najważniejsze informacje o serwerze", category: "misc" },
  { name: "wrozba", description: "Sprawdź, co los przyniósł Ci na dziś 🔮", category: "misc" },
  { name: "roll", description: "Wylosuj liczbę — domyślnie od 1 do 6 🎲", category: "misc" },
  // admin/ (tylko te 3 — reszta admin/ ma własne gate'y)
  { name: "say", description: "Wyślij wiadomość na wybranym kanale jako Deezy", category: "admin" },
  { name: "role", description: "Nadaj, odbierz lub ustaw czasową rolę użytkownika", category: "admin" },
  { name: "emoji-steal", description: "Dodaj emoji z innego serwera do tego serwera", category: "admin" },
];

const CATEGORY_LABELS: Record<UtilityCommand["category"], string> = {
  fun: "Rozrywka",
  misc: "Ogólne",
  admin: "Administracyjne",
};

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const sortedDisabled = (arr: string[]) => [...arr].sort().join(",");

export default function NarzedziaPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { registerDirtyController } = useDirtyState();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [disabledCommands, setDisabledCommands] = useState<string[]>([]);

  const savedRef = useRef<SavedConfigState>({ enabled: true, disabledCommands: [] });

  useEffect(() => {
    if (guildId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/commands/config`);
      if (res.ok) {
        const data: CommandsConfig = await res.json();
        const nextEnabled = data.enabled ?? true;
        const nextDisabled = data.disabledCommands ?? [];
        setEnabled(nextEnabled);
        setDisabledCommands(nextDisabled);
        savedRef.current = { enabled: nextEnabled, disabledCommands: nextDisabled };
      }
    } catch (err) {
      console.error("Error loading commands config:", err);
      setError("Nie udało się załadować konfiguracji Narzędzi. Sprawdź połączenie z internetem i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const isDirty =
    enabled !== savedRef.current.enabled ||
    sortedDisabled(disabledCommands) !== sortedDisabled(savedRef.current.disabledCommands);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/guild/${guildId}/commands/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, disabledCommands }),
      });
      if (!res.ok) throw new Error("Failed to save");
      savedRef.current = { enabled, disabledCommands };
      toast.success("Konfiguracja Narzędzi została zapisana!");
    } catch (err) {
      console.error("Error saving commands config:", err);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  }, [guildId, enabled, disabledCommands]);

  const handleCancel = useCallback(() => {
    setEnabled(savedRef.current.enabled);
    setDisabledCommands(savedRef.current.disabledCommands);
  }, []);

  useEffect(() => registerDirtyController({
    id: `commands-${guildId}`,
    isDirty,
    isSaving: saving,
    label: "Komendy",
    onSave: handleSave,
    onCancel: handleCancel,
  }), [guildId, isDirty, saving, handleSave, handleCancel, registerDirtyController]);

  const toggleCommand = (name: string) => {
    setDisabledCommands((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const toggleCategory = (category: UtilityCommand["category"]) => {
    const names = UTILITY_COMMANDS.filter((c) => c.category === category).map((c) => c.name);
    const allOn = names.every((n) => !disabledCommands.includes(n));
    setDisabledCommands((prev) => {
      const withoutCategory = prev.filter((n) => !names.includes(n));
      return allOn ? [...withoutCategory, ...names] : withoutCategory;
    });
  };

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState title="Nie udało się załadować Komend" message={error} onRetry={() => { setError(null); fetchData(); }} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const matches = (cmd: UtilityCommand) =>
    !q || `${cmd.name} ${cmd.description}`.toLowerCase().includes(q);

  const onCount = UTILITY_COMMANDS.filter((c) => !disabledCommands.includes(c.name)).length;
  const totalCount = UTILITY_COMMANDS.length;
  const shownTotal = UTILITY_COMMANDS.filter(matches).length;

  const groups = (["fun", "misc", "admin"] as const)
    .map((category) => ({
      category,
      rows: UTILITY_COMMANDS.filter((c) => c.category === category && matches(c)),
    }))
    .filter((g) => g.rows.length > 0);

  const categoryCount = new Set(UTILITY_COMMANDS.map((c) => c.category)).size;

  return (
    <div className="min-h-full">
      <div className="w-full space-y-4">

        <SlideIn direction="up" delay={100}>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-white">Komendy</h1>
              <p className="mt-2 max-w-[640px] text-sm leading-6 text-[#969db0]">
                {totalCount} {plural(totalCount, "komenda", "komendy", "komend")} rozrywkowych i ogólnych — włącz lub wyłącz pojedynczo albo cały moduł naraz.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-white/80">
              <span>{enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch checked={enabled} onCheckedChange={setEnabled} aria-label="Włącz lub wyłącz moduł Komendy" />
            </div>
          </div>
        </SlideIn>

        {!enabled && (
          <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-[#17181E] px-3 py-2 text-xs leading-6 text-[#9aa2b8]">
            <Wrench className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Moduł <span className="font-semibold text-white/80">Komendy</span> jest wyłączony — żadna z poniższych
              komend nie zadziała na tym serwerze, niezależnie od stanu przełączników poniżej.
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[10px] bg-[#1F2129] px-4 py-3.5">
            <div className="text-[22px] font-extrabold text-white">
              {onCount}<span className="text-[13px] font-semibold text-[#6b7280]">/{totalCount}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-[#8d94a8]">komend włączonych</div>
          </div>
          <div className="rounded-[10px] bg-[#1F2129] px-4 py-3.5">
            <div className="text-[22px] font-extrabold text-[#a5b4fc]">{categoryCount}</div>
            <div className="mt-0.5 text-[11px] text-[#8d94a8]">kategorie</div>
          </div>
        </div>

        <div className="rounded-[10px] bg-[#1F2129] px-3.5 py-3">
          <div className="flex h-9 items-center gap-2.5 rounded-md border border-[#2f3341] bg-[#17181E] px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#6b7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Szukaj komendy… (np. wordle, avatar, roll)"
              className="min-w-0 flex-1 bg-transparent text-xs text-[#d8dbe6] outline-none placeholder:text-[#6b7280]"
            />
            {q ? (
              <button type="button" onClick={() => setSearch("")} title="Wyczyść" className="text-[#6b7280] transition-colors hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          {q ? (
            <p className="mt-2 text-[11px] text-[#8d94a8]">
              {shownTotal} {plural(shownTotal, "komenda", "komendy", "komend")} pasuje do zapytania
            </p>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-[10px] bg-[#1F2129]">
          {groups.map(({ category, rows }) => {
            const names = UTILITY_COMMANDS.filter((c) => c.category === category).map((c) => c.name);
            const onN = names.filter((n) => !disabledCommands.includes(n)).length;
            const allOn = onN === names.length;
            return (
              <div key={category}>
                <div className="flex items-center gap-2.5 border-b border-[#2f3341] px-4 py-3">
                  <span className="text-sm font-bold text-white">{CATEGORY_LABELS[category]}</span>
                  <span className="text-[11px] text-[#6b7280]">
                    {names.length} {plural(names.length, "komenda", "komendy", "komend")} · {onN} włączonych
                  </span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="rounded-[5px] border border-[#2f3341] px-2.5 py-1 text-[10px] font-semibold text-[#8d94a8] transition-colors hover:border-bot-primary hover:text-white"
                  >
                    {allOn ? "Wyłącz wszystkie" : "Włącz wszystkie"}
                  </button>
                </div>

                <div className="flex flex-col gap-2 p-3.5">
                  {rows.map((cmd) => {
                    const isOn = !disabledCommands.includes(cmd.name);
                    return (
                      <div
                        key={cmd.name}
                        className="flex items-center gap-3 rounded-lg border border-transparent bg-[#17181E] p-3.5"
                      >
                        <div className="min-w-0 flex-1" style={{ opacity: isOn ? 1 : 0.5 }}>
                          <span className="block truncate text-base font-semibold text-white">/{cmd.name}</span>
                          <span className="block truncate text-sm text-[#8d94a8]">{cmd.description}</span>
                        </div>
                        <Switch
                          checked={isOn}
                          onCheckedChange={() => toggleCommand(cmd.name)}
                          className="shrink-0 data-[state=checked]:bg-[#3b82f6]"
                          style={{ transform: "scale(1.25)" }}
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
              Brak komend pasujących do „{search}".
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
