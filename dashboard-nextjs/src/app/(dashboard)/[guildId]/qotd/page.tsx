"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Trash2, Plus, Hash, HelpCircle, Loader2, Save, Pencil, Search, RotateCcw,
  ChevronDown, Settings, EyeOff, Sparkles, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import EmojiPicker from "@/components/EmojiPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { useSession } from "next-auth/react";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { EmojiList, hasExternalEmoji } from "@/components/EmojiDisplay";
import { OWNER_IDS } from "@/lib/owner";
import { cn } from "@/lib/utils";
import { useDirtyState } from "@/components/DirtyStateProvider";

const qotdSchema = z.object({
  enabled: z.boolean().default(true),
  questionChannelId: z.string().min(1, "Wybierz kanał"),
  pingRoleId: z.string().optional(),
});

type QOTDFormData = z.infer<typeof qotdSchema>;

const DEFAULT_FORM_VALUES: QOTDFormData = {
  enabled: false,
  questionChannelId: "",
  pingRoleId: "",
};

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface Role {
  id: string;
  name: string;
  color: number;
}

interface Question {
  _id: string;
  questionId: string;
  authorId: string;
  content: string;
  reactions: string[];
  disabled?: boolean;
}

interface TodayQuestion {
  questionId: string;
  content: string;
  reactions: string[];
  usedAt: string;
}

const MONTHS_GENITIVE = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

function formatDateLabel(date: Date): string {
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** Rozkłada datę na komponenty czasu warszawskiego (odporne na DST). */
function getWarsawParts(date: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  return fmt.formatToParts(date).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
}

function isSameWarsawDay(a: Date, b: Date): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" });
  return fmt.format(a) === fmt.format(b);
}

/** Najbliższy przyszły termin wysyłki (10:00 czasu warszawskiego). */
function nextQuestionTime(now: Date): Date {
  const parts = getWarsawParts(now);
  const warsawNowAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second)
  );
  const offsetMs = now.getTime() - warsawNowAsUtc;

  let targetWarsawWallAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 10, 0, 0);
  if (targetWarsawWallAsUtc <= warsawNowAsUtc) {
    targetWarsawWallAsUtc += 24 * 60 * 60 * 1000;
  }
  return new Date(targetWarsawWallAsUtc + offsetMs);
}

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const inputClass =
  "h-11 border border-[#3f4455] bg-dark-900 text-white/90 placeholder:text-[#9aa2b8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0 data-[placeholder]:text-[#9aa2b8]";
const textareaClass =
  "min-h-[84px] resize-none rounded-md border border-[#3f4455] bg-dark-900 text-sm leading-6 text-white/90 placeholder:text-[#9aa2b8] focus-visible:border-[#3b82f6] focus-visible:ring-[#3b82f6]/30 focus-visible:ring-offset-0";
const labelClass = "text-xs font-semibold text-[#c4cad8]";
const iconButtonClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-dark-900 hover:text-white";
const iconButtonDangerClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-red-500/10 hover:text-red-400";

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

interface SettingRowProps {
  title: string;
  description?: string;
  icon: React.ReactNode;
  isOpen?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

function SettingRow({ title, description, icon, isOpen = false, onToggle, children }: SettingRowProps) {
  const isExpandable = Boolean(children && onToggle);

  return (
    <section className="overflow-hidden rounded-md bg-dark-800 shadow-[0_8px_18px_rgba(8,10,16,0.16)]">
      <div className={cn("flex min-h-[68px] items-center gap-4 border border-transparent px-5 py-3 transition-colors", isOpen && "border-[#2f3341] bg-dark-800")}>
        <button
          type="button"
          onClick={isExpandable ? onToggle : undefined}
          className={cn("flex min-w-0 flex-1 items-center gap-3 text-left", isExpandable ? "cursor-pointer" : "cursor-default")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-dark-900 text-[#aab2c8]">{icon}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white/90">{title}</span>
            {description ? <span className="mt-1 block truncate text-xs text-[#8d94a8]">{description}</span> : null}
          </span>
        </button>

        {isExpandable ? (
          <button type="button" onClick={onToggle} aria-label={isOpen ? "Zwiń sekcję" : "Rozwiń sekcję"} className="flex h-8 w-8 items-center justify-center rounded-md text-[#9aa2b8] transition-colors hover:bg-dark-900 hover:text-white">
            <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
          </button>
        ) : null}
      </div>

      {isOpen && children ? <div className="border-x border-b border-[#2f3341] bg-dark-800 p-5">{children}</div> : null}
    </section>
  );
}

/** Podgląd wiadomości bota w stylu Discorda dla nowo wpisywanego pytania. */
function QOTDPreview({ content, reactions, roleName, channelName }: { content: string; reactions: string[]; roleName?: string; channelName?: string }) {
  return (
    <div className="flex items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/deezy.png" alt="" className="mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-white">Deezy</span>
          <span className="rounded bg-[#5865f2] px-1 py-px text-[10px] font-semibold uppercase text-white">Bot</span>
          <span className="text-[11px] text-[#80848e]">10:00</span>
        </p>
        {roleName ? (
          <p className="mt-1">
            <span className="rounded bg-[#3f4270] px-1 font-medium text-[#c9cdfb]">@{roleName}</span>
          </p>
        ) : null}
        <p className="mt-1 break-words text-sm leading-6 text-[#dbdee1]">
          <strong className="font-bold">Pytanie dnia:</strong>
          <br />
          {content.trim() ? content : <span className="italic text-[#80848e]">Wpisz pytanie, aby zobaczyć podgląd</span>}
        </p>
        {reactions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {reactions.map((reaction, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-full border border-[#3f4455] bg-dark-900 px-2 py-0.5 text-xs text-[#c4cad8]">
                <EmojiList emojis={[reaction]} size={14} />
                <span>0</span>
              </span>
            ))}
          </div>
        )}
        {channelName ? <p className="mt-1.5 text-[11px] text-[#6f7690]">na kanale #{channelName}</p> : null}
      </div>
    </div>
  );
}

type ViewMode = "active" | "used" | "external";

export default function QOTDPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const isOwner = status !== 'loading' && OWNER_IDS.includes(currentUserId ?? '');
  const { registerDirtyController } = useDirtyState();

  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);

  const [newQuestion, setNewQuestion] = useState("");
  const [newReactions, setNewReactions] = useState("");
  const reactionsInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editReactions, setEditReactions] = useState("");
  const editReactionsInputRef = useRef<HTMLInputElement>(null);

  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("active");
  const [botEmojiIds, setBotEmojiIds] = useState<ReadonlySet<string> | null>(null);

  const [usedQuestions, setUsedQuestions] = useState<Question[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [markingUsedId, setMarkingUsedId] = useState<string | null>(null);

  const [todayQuestion, setTodayQuestion] = useState<TodayQuestion | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const savedValuesRef = useRef<QOTDFormData>(DEFAULT_FORM_VALUES);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm<QOTDFormData>({
    resolver: zodResolver(qotdSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const values = watch();
  const selectedChannel = channels.find((c) => c.id === values.questionChannelId);
  const selectedRole = roles.find((r) => r.id === values.pingRoleId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [channelsData, rolesData, configRes, questionsRes, usedQuestionsRes, appEmojisRes, todayRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/guild/${guildId}/channels`),
          fetchGuildData<Role[]>(guildId, 'roles', `/api/guild/${guildId}/roles`),
          fetchWithAuth(`/api/guild/${guildId}/qotd/config`),
          fetchWithAuth(`/api/guild/${guildId}/qotd/questions`),
          fetchWithAuth(`/api/guild/${guildId}/qotd/questions?disabled=true`),
          fetch(`/api/bot-emojis/list`).catch(() => null),
          fetchWithAuth(`/api/guild/${guildId}/qotd/today`).catch(() => null),
        ]);

        const textChannels = channelsData.filter(
          (ch: Channel) => ch.type === 0 || ch.type === 5
        );
        setChannels(textChannels);
        setRoles(rolesData);

        if (configRes.ok) {
          const config = await configRes.json();
          const nextValues: QOTDFormData = {
            enabled: config.enabled !== undefined ? config.enabled : false,
            questionChannelId: config.questionChannelId || "",
            pingRoleId: config.pingRoleId || "",
          };
          savedValuesRef.current = nextValues;
          reset(nextValues, { keepDirty: false });
        }

        if (questionsRes.ok) {
          const questionsData = await questionsRes.json();
          setQuestions(questionsData);
        }

        if (usedQuestionsRes.ok) {
          const usedData = await usedQuestionsRes.json();
          setUsedQuestions(usedData);
        }

        if (todayRes && todayRes.ok) {
          const todayData = await todayRes.json();
          setTodayQuestion(todayData);
        }

        if (appEmojisRes && appEmojisRes.ok) {
          const appEmojis: { id: string }[] = await appEmojisRes.json();
          setBotEmojiIds(new Set(appEmojis.map((e) => e.id)));
        } else {
          // Endpoint niedostępny — pusty Set (flaguj wszystkie custom emoji)
          setBotEmojiIds(new Set());
        }
      } catch (error) {
        console.error("Error loading QOTD data:", error);
        setError("Nie udało się załadować danych QOTD. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId, reset]);

  const handleRestoreQuestion = async (questionId: string) => {
    setRestoringId(questionId);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/qotd/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, disabled: false }),
      });
      if (response.ok) {
        const restored = await response.json();
        setUsedQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
        setQuestions((prev) => [...prev, { ...restored, disabled: false }]);
        toast.success("Pytanie przywrócone do puli aktywnych!");
      } else {
        toast.error("Nie udało się przywrócić pytania");
      }
    } catch {
      toast.error("Nie udało się przywrócić pytania");
    } finally {
      setRestoringId(null);
    }
  };

  const handleMarkAsUsed = async (questionId: string) => {
    setMarkingUsedId(questionId);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/qotd/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, disabled: true }),
      });
      if (response.ok) {
        const used = await response.json();
        setQuestions((prev) => prev.filter((q) => q.questionId !== questionId));
        setUsedQuestions((prev) => [{ ...used, disabled: true }, ...prev]);
        toast.success("Pytanie oznaczone jako użyte na tym serwerze!");
      } else {
        toast.error("Nie udało się oznaczyć pytania jako użyte");
      }
    } catch {
      toast.error("Nie udało się oznaczyć pytania jako użyte");
    } finally {
      setMarkingUsedId(null);
    }
  };

  const onSubmit = useCallback(async (data: QOTDFormData) => {
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/qotd/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        savedValuesRef.current = data;
        reset(data, { keepDirty: false });
        toast.success("Konfiguracja została zapisana!");
      } else {
        toast.error("Nie udało się zapisać konfiguracji");
      }
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  }, [guildId, reset]);

  const handleCancel = useCallback(() => {
    reset(savedValuesRef.current, { keepDirty: false });
  }, [reset]);

  const submitFromDirtyBar = useCallback(() => {
    void handleSubmit(onSubmit, () => setConfigOpen(true))();
  }, [handleSubmit, onSubmit]);

  useEffect(() => registerDirtyController({
    id: `qotd-${guildId}`,
    isDirty,
    isSaving: saving,
    label: "Pytanie Dnia",
    onSave: submitFromDirtyBar,
    onCancel: handleCancel,
  }), [guildId, handleCancel, isDirty, registerDirtyController, saving, submitFromDirtyBar]);

  const handleAddQuestion = async () => {
    if (!newQuestion.trim()) {
      toast.error("Treść pytania jest wymagana");
      return;
    }

    try {
      const reactions = newReactions
        .split(",")
        .map((r) => r.trim())
        .filter((r) => r);

      const invalidCustom = reactions.filter((r) => {
        const m = r.match(/^<a?:(\w+):(\d+)>$/);
        return m && !botEmojiIds?.has(m[2]);
      });
      if (invalidCustom.length > 0) {
        toast.error("Można używać tylko standardowych emoji lub emoji bota");
        return;
      }

      const response = await fetchWithAuth(`/api/guild/${guildId}/qotd/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newQuestion,
          reactions,
        }),
      });

      if (response.ok) {
        const question = await response.json();
        setQuestions([...questions, question]);
        setNewQuestion("");
        setNewReactions("");
        toast.success("Pytanie zostało dodane!");
      } else {
        toast.error("Nie udało się dodać pytania");
      }
    } catch (error) {
      console.error("Error adding question:", error);
      toast.error("Nie udało się dodać pytania");
    }
  };

  const handleEditQuestion = async (questionId: string) => {
    if (!editContent.trim()) {
      toast.error("Treść pytania jest wymagana");
      return;
    }

    try {
      const reactions = editReactions
        .split(",")
        .map((r) => r.trim())
        .filter((r) => r);

      const invalidCustom = reactions.filter((r) => {
        const m = r.match(/^<a?:(\w+):(\d+)>$/);
        return m && !botEmojiIds?.has(m[2]);
      });
      if (invalidCustom.length > 0) {
        toast.error("Można używać tylko standardowych emoji lub emoji bota");
        return;
      }

      const response = await fetchWithAuth(`/api/guild/${guildId}/qotd/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          content: editContent,
          reactions,
        }),
      });

      if (response.ok) {
        const updatedQuestion = await response.json();
        setQuestions(questions.map((q) =>
          q.questionId === questionId ? updatedQuestion : q
        ));
        setEditingId(null);
        setEditContent("");
        setEditReactions("");
        toast.success("Pytanie zostało zaktualizowane!");
      } else {
        toast.error("Nie udało się zaktualizować pytania");
      }
    } catch (error) {
      console.error("Error updating question:", error);
      toast.error("Nie udało się zaktualizować pytania");
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to pytanie?")) return;

    try {
      const response = await fetchWithAuth(
        `/api/guild/${guildId}/qotd/questions?questionId=${questionId}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setQuestions(questions.filter((q) => q.questionId !== questionId));
        toast.success("Pytanie zostało usunięte!");
      } else {
        toast.error("Nie udało się usunąć pytania");
      }
    } catch (error) {
      console.error("Error deleting question:", error);
      toast.error("Nie udało się usunąć pytania");
    }
  };

  const handleEditUsedQuestion = async (questionId: string) => {
    if (!editContent.trim()) {
      toast.error("Treść pytania jest wymagana");
      return;
    }
    try {
      const reactions = editReactions
        .split(",")
        .map((r) => r.trim())
        .filter((r) => r);

      const invalidCustom = reactions.filter((r) => {
        const m = r.match(/^<a?:(\w+):(\d+)>$/);
        return m && !botEmojiIds?.has(m[2]);
      });
      if (invalidCustom.length > 0) {
        toast.error("Można używać tylko standardowych emoji lub emoji bota");
        return;
      }

      const response = await fetchWithAuth(`/api/guild/${guildId}/qotd/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, content: editContent, reactions }),
      });
      if (response.ok) {
        const updated = await response.json();
        setUsedQuestions((prev) =>
          prev.map((q) => (q.questionId === questionId ? { ...updated, disabled: true } : q))
        );
        setEditingId(null);
        setEditContent("");
        setEditReactions("");
        toast.success("Pytanie zostało zaktualizowane!");
      } else {
        toast.error("Nie udało się zaktualizować pytania");
      }
    } catch (error) {
      console.error("Error updating used question:", error);
      toast.error("Nie udało się zaktualizować pytania");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedQuestions.size === 0) return;

    if (!confirm("Czy na pewno chcesz usunąć " + selectedQuestions.size + " pytań?")) return;

    setIsDeleting(true);
    try {
      const deletePromises = Array.from(selectedQuestions).map(questionId =>
        fetchWithAuth(
          "/api/guild/" + guildId + "/qotd/questions?questionId=" + questionId,
          { method: "DELETE" }
        )
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.ok).length;

      if (successCount > 0) {
        setQuestions(questions.filter((q) => !selectedQuestions.has(q.questionId)));
        setSelectedQuestions(new Set());
        toast.success("Usunięto " + successCount + " pytań!");
      }

      if (successCount < selectedQuestions.size) {
        toast.error("Nie udało się usunąć " + (selectedQuestions.size - successCount) + " pytań");
      }
    } catch (error) {
      console.error("Error bulk deleting questions:", error);
      toast.error("Nie udało się usunąć pytań");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleSelectAll = (visible: Question[]) => {
    if (visible.every((q) => selectedQuestions.has(q.questionId)) && visible.length > 0) {
      const next = new Set(selectedQuestions);
      visible.forEach((q) => next.delete(q.questionId));
      setSelectedQuestions(next);
    } else {
      const next = new Set(selectedQuestions);
      visible.forEach((q) => next.add(q.questionId));
      setSelectedQuestions(next);
    }
  };

  const toggleSelectQuestion = (questionId: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  };

  const getRoleColor = (color: number) => {
    if (color === 0) return "#99AAB5";
    return `#${color.toString(16).padStart(6, "0")}`;
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  if (error) {
    return (
      <div className="min-h-full">
        <div className="w-full">
          <ErrorState
            title="Nie udało się załadować QOTD"
            message={error}
            onRetry={handleRetry}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="w-full space-y-5">
          <div className="flex items-start justify-between gap-6 pb-2">
            <div className="space-y-3"><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-[420px] max-w-full" /></div>
            <div className="flex items-center gap-3"><Skeleton className="h-4 w-12" /><Skeleton className="h-5 w-9 rounded-full" /></div>
          </div>
          <Skeleton className="h-28 w-full rounded-md bg-dark-800" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
            <Skeleton className="h-20 w-full rounded-md bg-dark-800" />
          </div>
          <Skeleton className="h-[68px] w-full rounded-md bg-dark-800" />
          <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-14 w-full rounded-md bg-dark-800" />)}</div>
        </div>
      </div>
    );
  }

  const isTodaySent = Boolean(todayQuestion && isSameWarsawDay(new Date(todayQuestion.usedAt), now));
  const nextSendAt = nextQuestionTime(now);
  const countdown = formatCountdown(nextSendAt.getTime() - now.getTime());
  const nextInPool = questions[0] ?? null;

  const activeExternalCount = questions.filter((q) => hasExternalEmoji(q.reactions, botEmojiIds)).length;

  const query = searchQuery.trim().toLowerCase();
  const activeFiltered = questions.filter((q) => !query || q.content.toLowerCase().includes(query));
  const externalFiltered = activeFiltered.filter((q) => hasExternalEmoji(q.reactions, botEmojiIds));
  const usedFiltered = usedQuestions.filter((q) => !query || q.content.toLowerCase().includes(query));

  const visibleActive = viewMode === "external" ? externalFiltered : activeFiltered;
  const configSummary = values.questionChannelId
    ? `# ${selectedChannel?.name ?? "nieznany kanał"}${selectedRole ? ` • @${selectedRole.name}` : ""}`
    : "Nie skonfigurowano jeszcze";

  return (
    <div className="min-h-full pb-32">
      <div className="w-full space-y-5">
        <SlideIn direction="up" delay={100}>
          <header className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl font-semibold text-white">Pytanie Dnia</h1>
              <p className="max-w-2xl text-sm leading-6 text-[#969db0]">
                Codzienne pytania wysyłane o 10:00 rano na wybrany kanał.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white/80">
              <span>{values.enabled ? "Aktywne" : "Nieaktywne"}</span>
              <DeezySwitch
                checked={values.enabled || false}
                onCheckedChange={(checked) => setValue("enabled", checked, { shouldDirty: true })}
                aria-label="Włącz lub wyłącz pytanie dnia"
              />
            </div>
          </header>
        </SlideIn>

        {!values.enabled ? (
          <SlideIn direction="up" delay={130}>
            <div className="flex items-start gap-2 rounded-md border border-[#3a3f4e] bg-dark-900 px-4 py-3 text-xs text-[#9aa2b8]">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Moduł pytania dnia jest <span className="font-semibold text-white/80">globalnie wyłączony</span>. Możesz edytować konfigurację i pulę pytań, ale bot nie wyśle pytania, dopóki nie włączysz przełącznika <span className="font-semibold text-white/80">Aktywne</span> u góry i nie zapiszesz konfiguracji.
              </span>
            </div>
          </SlideIn>
        ) : null}

        <SlideIn direction="up" delay={150}>
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: "10px",
              background: "linear-gradient(120deg, #2b2350 0%, #1F2129 55%, #1F2129 100%)",
              border: "1px solid rgba(99,102,241,0.35)",
              padding: "20px 24px",
            }}
          >
            <div
              className="pointer-events-none absolute -right-5 -top-5 h-40 w-40 rounded-full"
              style={{ background: "radial-gradient(circle, rgba(236,72,153,0.25), transparent 70%)" }}
            />

            <div className="relative flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#b3a6ff]">
                  Dzisiejsze pytanie • {formatDateLabel(now)}
                </p>
                {isTodaySent && todayQuestion ? (
                  <>
                    <p className="mt-2.5 text-base font-bold leading-snug text-white">{todayQuestion.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#9aa2b8]">
                      {todayQuestion.reactions.length > 0 ? (
                        <span className="flex items-center gap-1.5">
                          Reakcje: <EmojiList emojis={todayQuestion.reactions} size={16} />
                        </span>
                      ) : null}
                      {selectedChannel ? (
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: "rgba(34,197,94,0.15)", color: "#86efac" }}>
                          wysłane na #{selectedChannel.name}
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-2.5 text-sm text-[#9aa2b8]">
                    {questions.length > 0
                      ? "Pierwsze pytanie pojawi się dziś o 10:00."
                      : "Pula pytań jest pusta — dodaj pytania poniżej."}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[26px] font-extrabold leading-none" style={{ color: "#ec4899" }}>{countdown}</p>
                <p className="mt-0.5 text-[11px] text-[#8d94a8]">do następnego pytania</p>
              </div>
            </div>

            {nextInPool ? (
              <div className="relative mt-4 pt-3" style={{ borderTop: "1px solid rgba(99,102,241,0.25)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">
                    Następne pytanie ({isTodaySent ? "jutro" : "dziś"})
                  </span>
                  <span className="shrink-0 text-[11px] text-[#8d94a8]">{formatDateLabel(nextSendAt)}, 10:00</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-[#d8dbe6]">
                  <span className="min-w-0 truncate">{nextInPool.content}</span>
                  {nextInPool.reactions.length > 0 ? <EmojiList emojis={nextInPool.reactions} size={14} /> : null}
                </div>
              </div>
            ) : null}
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={180}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-white">{questions.length}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">aktywnych pytań</p>
            </div>
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-[#818cf8]">{usedQuestions.length}</p>
              <p className="mt-1 text-xs text-[#8d94a8]">użytych pytań</p>
            </div>
            <div className="rounded-md bg-dark-800 p-4">
              <p className="text-2xl font-bold text-pink-400">~{questions.length} dni</p>
              <p className="mt-1 text-xs text-[#8d94a8]">zapasu w puli</p>
            </div>
          </div>
        </SlideIn>

        <SlideIn direction="up" delay={210}>
          <SettingRow
            title="Konfiguracja — kanał, rola ping"
            description={configSummary}
            icon={<Settings className="h-4 w-4" />}
            isOpen={configOpen}
            onToggle={() => setConfigOpen((open) => !open)}
          >
            <div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className={labelClass}>
                    Kanał pytań <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={values.questionChannelId || ""}
                    onValueChange={(value) => setValue("questionChannelId", value, { shouldDirty: true })}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue
                        placeholder={
                          <div className="flex items-center gap-2 text-[#9aa2b8]">
                            <Hash className="h-4 w-4" />
                            <span>Wybierz kanał...</span>
                          </div>
                        }
                      >
                        {values.questionChannelId ? (
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-[#8d94a8]" />
                            {selectedChannel?.name ?? "Wybierz kanał..."}
                          </div>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="border-[#2f3341] bg-dark-900">
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          <div className="flex items-center gap-2">
                            <Hash className="h-4 w-4 text-[#8d94a8]" />
                            {channel.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.questionChannelId && (
                    <p className="text-xs text-destructive">{errors.questionChannelId.message}</p>
                  )}
                  <p className="text-[11px] text-[#8d94a8]">Kanał, na którym będą wysyłane pytania dnia</p>
                </div>

                <div className="space-y-2">
                  <Label className={labelClass}>Rola do oznaczenia (opcjonalna)</Label>
                  <div className="flex gap-2">
                    <Select
                      value={values.pingRoleId || undefined}
                      onValueChange={(value) => setValue("pingRoleId", value, { shouldDirty: true })}
                    >
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Brak roli" />
                      </SelectTrigger>
                      <SelectContent className="border-[#2f3341] bg-dark-900">
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: getRoleColor(role.color) }}
                              />
                              {role.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {values.pingRoleId ? (
                      <button
                        type="button"
                        onClick={() => setValue("pingRoleId", "", { shouldDirty: true })}
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#3f4455] text-[#9aa2b8] transition-colors hover:border-red-500/50 hover:text-red-400"
                        aria-label="Usuń rolę ping"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[#8d94a8]">Rola, która zostanie oznaczona przy każdym pytaniu</p>
                </div>
              </div>
            </div>
          </SettingRow>
        </SlideIn>

        {isOwner ? (
          <>
            <SlideIn direction="up" delay={240}>
              <div className="grid grid-cols-1 gap-6 rounded-md bg-dark-800 p-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <Label className={labelClass}>
                    Nowe pytanie <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    placeholder="Jakie jest twoje ulubione hobby?"
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    rows={3}
                    className={textareaClass}
                  />

                  <Label className={labelClass}>Reakcje (emoji oddzielone przecinkami)</Label>
                  {newReactions.trim() && (
                    <div className="flex flex-wrap items-center gap-1 rounded-md bg-dark-900 p-2">
                      <span className="text-xs text-[#8d94a8]">Podgląd:</span>
                      <EmojiList emojis={newReactions.split(",").map((r) => r.trim()).filter((r) => r)} size={20} />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex flex-1 gap-2">
                      <Input
                        ref={reactionsInputRef}
                        placeholder="👍, 👎, 🤔"
                        value={newReactions}
                        onChange={(e) => setNewReactions(e.target.value)}
                        className={cn(inputClass, "flex-1")}
                      />
                      <EmojiPicker
                        hideTabs={["custom"]}
                        onEmojiSelect={(emoji) => {
                          const input = reactionsInputRef.current;
                          if (!input) {
                            setNewReactions(prev => prev ? `${prev}, ${emoji}` : emoji);
                            return;
                          }

                          const cursorPos = input.selectionStart || 0;
                          const textBefore = newReactions.substring(0, cursorPos);
                          const textAfter = newReactions.substring(cursorPos);

                          let newValue = "";
                          let cursorOffset = 0;

                          if (!textBefore && !textAfter) {
                            newValue = emoji;
                            cursorOffset = emoji.length;
                          } else if (!textBefore) {
                            newValue = emoji + ", " + textAfter;
                            cursorOffset = emoji.length;
                          } else if (textBefore.trimEnd().endsWith(',')) {
                            const needsSpace = !textBefore.endsWith(' ');
                            newValue = textBefore + (needsSpace ? ' ' : '') + emoji + (textAfter ? ", " + textAfter : "");
                            cursorOffset = textBefore.length + (needsSpace ? 1 : 0) + emoji.length;
                          } else if (!textAfter) {
                            newValue = textBefore + ", " + emoji;
                            cursorOffset = textBefore.length + 2 + emoji.length;
                          } else {
                            newValue = textBefore + ", " + emoji + ", " + textAfter;
                            cursorOffset = textBefore.length + 2 + emoji.length;
                          }

                          setNewReactions(newValue);

                          setTimeout(() => {
                            input.setSelectionRange(cursorOffset, cursorOffset);
                            input.focus();
                          }, 0);
                        }}
                        buttonText="Emoji"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddQuestion}
                      className="bg-[#3b82f6] text-white hover:bg-[#2563eb] sm:shrink-0"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Dodaj pytanie
                    </Button>
                  </div>
                  <p className="text-[11px] text-[#6f7690]">Te reakcje zostaną automatycznie dodane do pytania</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8d94a8]">Podgląd na żywo</p>
                  <div className="rounded-md border border-[#2f3341] bg-[#313338] p-4">
                    <QOTDPreview
                      content={newQuestion}
                      reactions={newReactions.split(",").map((r) => r.trim()).filter((r) => r)}
                      roleName={selectedRole?.name}
                      channelName={selectedChannel?.name}
                    />
                  </div>
                </div>
              </div>
            </SlideIn>

            <SlideIn direction="up" delay={270}>
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setViewMode("active")}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                        viewMode === "active" ? "bg-[#3b82f6] text-white" : "bg-dark-800 text-[#9aa2b8] hover:text-white"
                      )}
                    >
                      Aktywne {questions.length}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("used")}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                        viewMode === "used" ? "bg-[#3b82f6] text-white" : "bg-dark-800 text-[#9aa2b8] hover:text-white"
                      )}
                    >
                      Użyte {usedQuestions.length}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("external")}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                        viewMode === "external" ? "bg-[#3b82f6] text-white" : "bg-dark-800 text-orange-400 hover:text-orange-300"
                      )}
                    >
                      ⚠️ Zewnętrzne {activeExternalCount}
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative sm:w-64">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d94a8]" />
                      <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Szukaj w pytaniach..."
                        className="h-9 border-transparent bg-dark-800 pl-9 text-sm text-white/90 placeholder:text-[#8d94a8] focus-visible:ring-[#3b82f6]/50 focus-visible:ring-offset-0"
                      />
                    </div>
                    {viewMode !== "used" && visibleActive.length > 0 ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => toggleSelectAll(visibleActive)} className="shrink-0">
                        {visibleActive.every((q) => selectedQuestions.has(q.questionId)) ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                {selectedQuestions.size > 0 && viewMode !== "used" ? (
                  <div className="flex items-center justify-between rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2.5">
                    <p className="text-xs text-red-300">Zaznaczono {selectedQuestions.size} pytań</p>
                    <Button type="button" variant="destructive" size="sm" onClick={handleBulkDelete} disabled={isDeleting}>
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Usuń zaznaczone
                    </Button>
                  </div>
                ) : null}

                {viewMode === "used" ? (
                  usedFiltered.length === 0 ? (
                    <div className="rounded-md bg-dark-800 py-12 text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dark-900">
                        <HelpCircle className="h-8 w-8 text-[#8d94a8]" />
                      </div>
                      <h3 className="text-sm font-semibold text-white/90">
                        {usedQuestions.length === 0 ? "Brak użytych pytań" : "Nie znaleziono wyników"}
                      </h3>
                      <p className="mx-auto mt-1 max-w-sm text-xs text-[#8d94a8]">
                        {usedQuestions.length === 0
                          ? "Pojawią się tutaj po tym jak bot je wywoła."
                          : `Nie znaleziono pytań pasujących do „${searchQuery.trim()}".`}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {usedFiltered.map((question) => (
                        <div key={question.questionId} className="rounded-md bg-dark-800 p-3 opacity-70 transition-opacity hover:opacity-100">
                          {editingId === question.questionId ? (
                            <QuestionEditForm
                              content={editContent}
                              reactions={editReactions}
                              onContentChange={setEditContent}
                              onReactionsChange={setEditReactions}
                              onSave={() => handleEditUsedQuestion(question.questionId)}
                              onCancel={() => { setEditingId(null); setEditContent(""); setEditReactions(""); }}
                              inputRef={editReactionsInputRef}
                            />
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-white/90">{question.content}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                {question.reactions.length > 0 ? <EmojiList emojis={question.reactions} size={16} /> : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => { setEditingId(question.questionId); setEditContent(question.content); setEditReactions(question.reactions.join(", ")); }}
                                  className={iconButtonClass}
                                  aria-label="Edytuj pytanie"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRestoreQuestion(question.questionId)}
                                  disabled={restoringId === question.questionId}
                                  className={iconButtonClass}
                                  aria-label="Przywróć pytanie do puli aktywnych"
                                >
                                  {restoringId === question.questionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                ) : visibleActive.length === 0 ? (
                  <div className="rounded-md bg-dark-800 py-12 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-dark-900">
                      {viewMode === "external" ? <Sparkles className="h-8 w-8 text-[#8d94a8]" /> : <HelpCircle className="h-8 w-8 text-[#8d94a8]" />}
                    </div>
                    <h3 className="text-sm font-semibold text-white/90">
                      {questions.length === 0 ? "Brak pytań w puli" : "Nie znaleziono wyników"}
                    </h3>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-[#8d94a8]">
                      {questions.length === 0
                        ? "Dodaj pytania za pomocą formularza powyżej. Bot będzie wybierał jedno losowo każdego dnia."
                        : viewMode === "external"
                          ? "Żadne aktywne pytanie nie używa emoji spoza zasobów bota."
                          : `Nie znaleziono pytań pasujących do „${searchQuery.trim()}".`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleActive.map((question, index) => {
                      const external = hasExternalEmoji(question.reactions, botEmojiIds);
                      return (
                        <SlideIn key={question.questionId} direction="up" delay={Math.min(index * 40, 320)}>
                          <div className="rounded-md bg-dark-800 p-3 transition-colors hover:bg-[#2e3140]">
                            {editingId === question.questionId ? (
                              <QuestionEditForm
                                content={editContent}
                                reactions={editReactions}
                                onContentChange={setEditContent}
                                onReactionsChange={setEditReactions}
                                onSave={() => handleEditQuestion(question.questionId)}
                                onCancel={() => { setEditingId(null); setEditContent(""); setEditReactions(""); }}
                                inputRef={editReactionsInputRef}
                              />
                            ) : (
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedQuestions.has(question.questionId)}
                                  onChange={() => toggleSelectQuestion(question.questionId)}
                                  className="h-4 w-4 shrink-0 rounded appearance-none border-2 border-[#3f4455] bg-dark-900 transition-all duration-200 cursor-pointer hover:border-[#3b82f6]/60 focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/40 checked:border-[#3b82f6] checked:bg-[#3b82f6]"
                                  style={{
                                    backgroundImage: selectedQuestions.has(question.questionId)
                                      ? "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")"
                                      : 'none',
                                    backgroundSize: '100% 100%',
                                    backgroundPosition: 'center',
                                    backgroundRepeat: 'no-repeat',
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm text-white/90">
                                    {question.content}
                                    {external ? (
                                      <span className="ml-2 rounded border border-red-500/40 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400">
                                        ⚠️ emoji z serwera
                                      </span>
                                    ) : null}
                                  </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1.5">
                                  {question.reactions.length > 0 ? <EmojiList emojis={question.reactions} size={16} /> : null}
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMarkAsUsed(question.questionId)}
                                    disabled={markingUsedId === question.questionId}
                                    className={iconButtonClass}
                                    aria-label="Oznacz jako użyte na tym serwerze"
                                  >
                                    {markingUsedId === question.questionId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setEditingId(question.questionId); setEditContent(question.content); setEditReactions(question.reactions.join(", ")); }}
                                    className={iconButtonClass}
                                    aria-label="Edytuj pytanie"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteQuestion(question.questionId)}
                                    className={iconButtonDangerClass}
                                    aria-label="Usuń pytanie"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </SlideIn>
                      );
                    })}
                  </div>
                )}
              </div>
            </SlideIn>
          </>
        ) : null}
      </div>

      <style jsx global>{`
        .deezy-switch span { position: relative; }
        .deezy-switch span[data-state="checked"]::after { content: ""; position: absolute; inset: 5px; border-radius: 9999px; background: #3b82f6; }
      `}</style>
    </div>
  );
}

/** Inline formularz edycji treści i reakcji pytania (współdzielony przez pulę aktywną i użytą). */
function QuestionEditForm({
  content, reactions, onContentChange, onReactionsChange, onSave, onCancel, inputRef,
}: {
  content: string;
  reactions: string;
  onContentChange: (value: string) => void;
  onReactionsChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className={labelClass}>Treść pytania</Label>
        <Textarea value={content} onChange={(e) => onContentChange(e.target.value)} rows={3} className={textareaClass} />
      </div>
      <div className="space-y-1.5">
        <Label className={labelClass}>Reakcje</Label>
        {reactions.trim() && (
          <div className="flex flex-wrap items-center gap-1 rounded-md bg-dark-900 p-2">
            <span className="text-xs text-[#8d94a8]">Podgląd:</span>
            <EmojiList emojis={reactions.split(",").map((r) => r.trim()).filter((r) => r)} size={18} />
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={reactions}
            onChange={(e) => onReactionsChange(e.target.value)}
            placeholder="👍, 👎, 🤔"
            className={cn(inputClass, "flex-1")}
          />
          <EmojiPicker
            hideTabs={["custom"]}
            onEmojiSelect={(emoji) => {
              const input = inputRef.current;
              if (!input) {
                onReactionsChange(reactions ? `${reactions}, ${emoji}` : emoji);
                return;
              }
              const cursorPos = input.selectionStart || 0;
              const textBefore = reactions.substring(0, cursorPos);
              const textAfter = reactions.substring(cursorPos);
              let newValue = "";
              let cursorOffset = 0;
              if (!textBefore && !textAfter) {
                newValue = emoji; cursorOffset = emoji.length;
              } else if (!textBefore) {
                newValue = emoji + ", " + textAfter; cursorOffset = emoji.length;
              } else if (textBefore.trimEnd().endsWith(',')) {
                const needsSpace = !textBefore.endsWith(' ');
                newValue = textBefore + (needsSpace ? ' ' : '') + emoji + (textAfter ? ", " + textAfter : "");
                cursorOffset = textBefore.length + (needsSpace ? 1 : 0) + emoji.length;
              } else if (!textAfter) {
                newValue = textBefore + ", " + emoji; cursorOffset = textBefore.length + 2 + emoji.length;
              } else {
                newValue = textBefore + ", " + emoji + ", " + textAfter; cursorOffset = textBefore.length + 2 + emoji.length;
              }
              onReactionsChange(newValue);
              setTimeout(() => {
                input.setSelectionRange(cursorOffset, cursorOffset);
                input.focus();
              }, 0);
            }}
            buttonText="Emoji"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={onSave} className="bg-[#3b82f6] text-white hover:bg-[#2563eb]">
          <Save className="mr-2 h-4 w-4" />
          Zapisz
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Anuluj
        </Button>
      </div>
    </div>
  );
}
