"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Trash2, Plus, Hash, HelpCircle, Loader2, Save, ArrowLeft, Calendar, Pencil, Search, RotateCcw } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import EmojiPicker from "@/components/EmojiPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { useSession } from "next-auth/react";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmojiList, hasExternalEmoji } from "@/components/EmojiDisplay";
import { OWNER_IDS } from "@/lib/owner";

const qotdSchema = z.object({
  enabled: z.boolean().default(true),
  questionChannelId: z.string().min(1, "Wybierz kanał"),
  pingRoleId: z.string().optional(),
});

type QOTDFormData = z.infer<typeof qotdSchema>;

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

export default function QOTDPage() {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const isOwner = status !== 'loading' && OWNER_IDS.includes(currentUserId ?? '');

  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
  const [showCustomEmojiOnly, setShowCustomEmojiOnly] = useState(false);
  const [botEmojiIds, setBotEmojiIds] = useState<ReadonlySet<string> | null>(null);

  const [usedQuestions, setUsedQuestions] = useState<Question[]>([]);
  const [loadingUsed, setLoadingUsed] = useState(true);
  const [usedSearchQuery, setUsedSearchQuery] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<QOTDFormData>({
    resolver: zodResolver(qotdSchema),
    defaultValues: {
      enabled: false,
      questionChannelId: "",
      pingRoleId: "",
    },
  });

  const selectedChannel = watch("questionChannelId");
  const selectedRole = watch("pingRoleId");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [channelsData, rolesData, configRes, questionsRes, usedQuestionsRes, botEmojisRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/guild/${guildId}/channels`),
          fetchGuildData<Role[]>(guildId, 'roles', `/api/guild/${guildId}/roles`),
          fetchWithAuth(`/api/guild/${guildId}/qotd/config`),
          fetchWithAuth(`/api/guild/${guildId}/qotd/questions`),
          fetchWithAuth(`/api/guild/${guildId}/qotd/questions?disabled=true`),
          fetchWithAuth(`/api/discord/bot-emojis`).catch(() => null),
        ]);

        const textChannels = channelsData.filter(
          (ch: Channel) => ch.type === 0 || ch.type === 5
        );
        setChannels(textChannels);
        setRoles(rolesData);

        if (configRes.ok) {
          const config = await configRes.json();
          reset({
            enabled: config.enabled !== undefined ? config.enabled : false,
            questionChannelId: config.questionChannelId || "",
            pingRoleId: config.pingRoleId || "",
          });
        }

        if (questionsRes.ok) {
          const questionsData = await questionsRes.json();
          setQuestions(questionsData);
        }

        if (usedQuestionsRes.ok) {
          const usedData = await usedQuestionsRes.json();
          setUsedQuestions(usedData);
        }
        setLoadingUsed(false);

        if (botEmojisRes && botEmojisRes.ok) {
          const { emojiIds } = await botEmojisRes.json();
          setBotEmojiIds(new Set<string>(emojiIds));
        } else {
          // API failed or unavailable — empty set triggers conservative fallback in hasExternalEmoji
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

  const onSubmit = async (data: QOTDFormData) => {
    setSaving(true);
    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/qotd/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
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
  };

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

  const toggleSelectAll = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(questions.map(q => q.questionId)));
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
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do panelu
            </Link>
          </Button>
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
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <Skeleton className="h-10 w-40 mb-6" />
          
          <Card
            className="backdrop-blur mb-6"
            style={{
              backgroundColor: 'rgba(189, 189, 189, .05)',
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="w-11 h-6 rounded-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>
          
          <Card
            className="backdrop-blur"
            style={{
              backgroundColor: 'rgba(189, 189, 189, .05)',
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <Skeleton className="h-7 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-2">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          <Skeleton className="h-10 w-full mt-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 md:p-8 max-w-4xl">
        <SlideIn direction="left">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do panelu
            </Link>
          </Button>
        </SlideIn>

        {/* Configuration */}
        <SlideIn direction="up" delay={100}>
          <Card
          className="backdrop-blur mb-6"
          style={{
            backgroundColor: 'rgba(189, 189, 189, .05)',
            boxShadow: '0 0 10px #00000026',
            border: '1px solid transparent'
          }}
        >
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="text-2xl flex items-center gap-2">
                <span>❓</span>
                <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                  Konfiguracja Pytania Dnia
                </span>
              </CardTitle>
              <Switch
                checked={watch("enabled") || false}
                onCheckedChange={(checked) => setValue("enabled", checked)}
                className="data-[state=checked]:bg-bot-primary"
                style={{ transform: 'scale(1.5)' }}
              />
            </div>
            <CardDescription>
              Codzienne pytania wysyłane o 10:00 rano
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="questionChannelId">
                  Kanał pytań <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedChannel}
                  onValueChange={(value) => setValue("questionChannelId", value)}
                >
                  <SelectTrigger id="questionChannelId" className="w-full">
                    <SelectValue placeholder="Wybierz kanał..." />
                  </SelectTrigger>
                  <SelectContent>
                    {channels.map((channel) => (
                      <SelectItem key={channel.id} value={channel.id}>
                        <div className="flex items-center gap-2">
                          <Hash className="h-4 w-4 text-muted-foreground" />
                          {channel.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.questionChannelId && (
                  <p className="text-sm text-destructive">
                    {errors.questionChannelId.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Kanał, na którym będą wysyłane pytania dnia
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pingRoleId">Rola do oznaczenia (opcjonalna)</Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedRole}
                    onValueChange={(value) => setValue("pingRoleId", value)}
                  >
                    <SelectTrigger id="pingRoleId" className="w-full">
                      <SelectValue placeholder="Brak roli" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: getRoleColor(role.color) }}
                            />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRole && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setValue("pingRoleId", "")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Rola, która zostanie oznaczona przy każdym pytaniu
                </p>
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="btn-gradient hover:scale-105 w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Zapisywanie...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 w-4 h-4" />
                    Zapisz konfigurację
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        </SlideIn>

        {/* Questions Management — owner only */}
        {isOwner && <SlideIn direction="up" delay={200}>
          <Card
            className="backdrop-blur"
            style={{
              backgroundColor: 'rgba(189, 189, 189, .05)',
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <HelpCircle className="w-6 h-6" />
              <span>Pula pytań</span>
            </CardTitle>
            <CardDescription>
              Zarządzaj pytaniami wybieranymi losowo każdego dnia o 10:00
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add new question form */}
            <div className="space-y-4 p-4 rounded-lg bg-background/50">
              <div className="space-y-2">
                <Label htmlFor="newQuestion">
                  Nowe pytanie <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="newQuestion"
                  placeholder="Jakie jest twoje ulubione hobby?"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reactions">Reakcje (emoji oddzielone przecinkami)</Label>
                {newReactions.trim() && (
                  <div className="mb-2 flex items-center gap-1 flex-wrap p-2 rounded-md bg-muted/50">
                    <span className="text-xs text-muted-foreground">Podgląd:</span>
                    <EmojiList emojis={newReactions.split(",").map(r => r.trim()).filter(r => r)} size={20} />
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    ref={reactionsInputRef}
                    id="reactions"
                    placeholder="👍, 👎, 🤔"
                    value={newReactions}
                    onChange={(e) => setNewReactions(e.target.value)}
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
                <p className="text-xs text-muted-foreground">
                  Te reakcje zostaną automatycznie dodane do pytania
                </p>
              </div>

              <Button 
                type="button" 
                onClick={handleAddQuestion}
                className="btn-gradient hover:scale-105"
              >
                <Plus className="mr-2 w-4 h-4" />
                Dodaj pytanie
              </Button>
            </div>

            {/* Questions tabs: Aktywne / Użyte */}
            <Tabs defaultValue="active">
              <TabsList className="mb-4">
                <TabsTrigger value="active">
                  Aktywne ({questions.length})
                </TabsTrigger>
                <TabsTrigger value="used">
                  Użyte ({usedQuestions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">
                  Aktualne pytania ({
                    questions.filter((q) => {
                      const matchSearch = !searchQuery.trim() || q.content.toLowerCase().includes(searchQuery.toLowerCase());
                      const matchCustom = !showCustomEmojiOnly || hasExternalEmoji(q.reactions, botEmojiIds);
                      return matchSearch && matchCustom;
                    }).length
                  })
                  {showCustomEmojiOnly && (
                    <span className="text-sm font-normal text-orange-400 ml-2">• zewnętrzne emoji</span>
                  )}
                  {searchQuery.trim() && <span className="text-sm font-normal text-muted-foreground ml-2">(wyniki dla: "{searchQuery}")</span>}
                </h3>
                {questions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={toggleSelectAll}
                    >
                      {selectedQuestions.size === questions.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                    </Button>
                    {selectedQuestions.size > 0 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Usuń zaznaczone ({selectedQuestions.size})
                      </Button>
                    )}
                  </div>
                )}
              </div>
              
              {questions.length > 0 && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="Szukaj w pytaniach..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-full"
                    />
                  </div>
                  <Button
                    type="button"
                    variant={showCustomEmojiOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowCustomEmojiOnly((v) => !v)}
                    title="Pokaż tylko pytania z emoji z zewnętrznych serwerów (bot może nie móc ich użyć)"
                    className={showCustomEmojiOnly ? "btn-gradient shrink-0" : "shrink-0"}
                  >
                    🔗 Zewnętrzne
                  </Button>
                </div>
              )}
              
              <div className="space-y-2">
              {questions.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                    <HelpCircle className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">Brak pytań w puli</h3>
                  <p className="text-sm text-muted-foreground">
                    Dodaj pytania za pomocą formularza powyżej. Bot będzie wybierał jedno losowo każdego dnia.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const filtered = questions.filter((question) => {
                      const matchSearch = !searchQuery.trim() || question.content.toLowerCase().includes(searchQuery.toLowerCase());
                      const matchCustom = !showCustomEmojiOnly || hasExternalEmoji(question.reactions, botEmojiIds);
                      return matchSearch && matchCustom;
                    });

                    if (filtered.length === 0 && (searchQuery.trim() || showCustomEmojiOnly)) {
                      return (
                        <div className="text-center py-12 px-4">
                          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                            <Search className="w-8 h-8 text-muted-foreground" />
                          </div>
                          <h3 className="font-semibold mb-2">Brak wyników</h3>
                          <p className="text-sm text-muted-foreground">
                            Nie znaleziono pytań pasujących do wybranych filtrów
                          </p>
                        </div>
                      );
                    }

                    return filtered.map((question, index) => (
                    <SlideIn key={question.questionId} direction="up" delay={index * 50}>
                    <div
                      className="p-3 rounded-lg bg-background/50 border border-transparent hover:bg-background/70 hover:shadow-lg hover:shadow-bot-primary/15 hover:border-bot-primary/30 transition-all duration-300"
                    >
                      {editingId === question.questionId ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor={`edit-content-${question.questionId}`}>Treść pytania</Label>
                            <Textarea
                              id={`edit-content-${question.questionId}`}
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`edit-reactions-${question.questionId}`}>Reakcje</Label>
                            <div className="mb-2 flex items-center gap-1 flex-wrap">
                              <span className="text-xs text-muted-foreground">Podgląd:</span>
                              <EmojiList emojis={editReactions.split(",").map(r => r.trim()).filter(r => r)} size={18} />
                            </div>
                            <div className="flex gap-2">
                              <Input
                                ref={editReactionsInputRef}
                                id={`edit-reactions-${question.questionId}`}
                                value={editReactions}
                                onChange={(e) => setEditReactions(e.target.value)}
                                placeholder="👍, 👎, 🤔"
                              />
                              <EmojiPicker
                                hideTabs={["custom"]}
                                onEmojiSelect={(emoji) => {
                                  const input = editReactionsInputRef.current;
                                  if (!input) {
                                    setEditReactions(prev => prev ? `${prev}, ${emoji}` : emoji);
                                    return;
                                  }

                                  const cursorPos = input.selectionStart || 0;
                                  const textBefore = editReactions.substring(0, cursorPos);
                                  const textAfter = editReactions.substring(cursorPos);

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

                                  setEditReactions(newValue);
                                  
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
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleEditQuestion(question.questionId)}
                              className="btn-gradient hover:scale-105"
                            >
                              <Save className="mr-2 h-4 w-4" />
                              Zapisz
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingId(null);
                                setEditContent("");
                                setEditReactions("");
                              }}
                            >
                              Anuluj
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={selectedQuestions.has(question.questionId)}
                            onChange={() => toggleSelectQuestion(question.questionId)}
                            className="mt-1 h-4 w-4 rounded appearance-none border-2 border-gray-500/40 bg-gray-700/30 transition-all duration-200 cursor-pointer hover:border-bot-primary/60 hover:bg-gray-600/30 focus:outline-none focus:ring-2 focus:ring-bot-primary/40 checked:bg-bot-primary checked:border-bot-primary checked:hover:bg-bot-blue"
                            style={{
                              backgroundImage: selectedQuestions.has(question.questionId) 
                                ? "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")"
                                : 'none',
                              backgroundSize: '100% 100%',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat'
                            }}
                          />
                          <div className="flex-1 space-y-1">
                            <p className="text-sm">{question.content}</p>
                            {question.reactions.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                                <span>Reakcje:</span>
                                <EmojiList emojis={question.reactions} size={16} />
                                {hasExternalEmoji(question.reactions, botEmojiIds) && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                    zewnętrzne emoji
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingId(question.questionId);
                                setEditContent(question.content);
                                setEditReactions(question.reactions.join(", "));
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteQuestion(question.questionId)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    </SlideIn>
                  ))})()}
                </div>
              )}
              </div>
            </div>
              </TabsContent>

              <TabsContent value="used">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                      Użyte pytania ({
                        usedQuestions.filter((q) =>
                          !usedSearchQuery.trim() || q.content.toLowerCase().includes(usedSearchQuery.toLowerCase())
                        ).length
                      })
                    </h3>
                  </div>

                  {usedQuestions.length > 0 && (
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Szukaj w użytych pytaniach..."
                        value={usedSearchQuery}
                        onChange={(e) => setUsedSearchQuery(e.target.value)}
                        className="pl-9 w-full"
                      />
                    </div>
                  )}

                  {loadingUsed ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                    </div>
                  ) : usedQuestions.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                      <p className="text-sm text-muted-foreground">
                        Brak użytych pytań. Pojawią się tutaj po tym jak bot je wywoła.
                      </p>
                    </div>
                  ) : (() => {
                    const filtered = usedQuestions.filter((q) =>
                      !usedSearchQuery.trim() || q.content.toLowerCase().includes(usedSearchQuery.toLowerCase())
                    );
                    if (filtered.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <p className="text-sm text-muted-foreground">
                            Nie znaleziono pytań pasujących do filtrów
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {filtered.map((question) => (
                        <div
                            key={question.questionId}
                            className="p-3 rounded-lg bg-background/50 border border-transparent opacity-70 hover:opacity-90 transition-opacity"
                          >
                            {editingId === question.questionId ? (
                              <div className="space-y-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-used-content-${question.questionId}`}>Treść pytania</Label>
                                  <Textarea
                                    id={`edit-used-content-${question.questionId}`}
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    rows={3}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor={`edit-used-reactions-${question.questionId}`}>Reakcje</Label>
                                  <div className="mb-2 flex items-center gap-1 flex-wrap">
                                    <span className="text-xs text-muted-foreground">Podgląd:</span>
                                    <EmojiList emojis={editReactions.split(",").map(r => r.trim()).filter(r => r)} size={18} />
                                  </div>
                                  <div className="flex gap-2">
                                    <Input
                                      ref={editReactionsInputRef}
                                      id={`edit-used-reactions-${question.questionId}`}
                                      value={editReactions}
                                      onChange={(e) => setEditReactions(e.target.value)}
                                      placeholder="👍, 👎, 🤔"
                                    />
                                    <EmojiPicker
                                      hideTabs={["custom"]}
                                      onEmojiSelect={(emoji) => {
                                        const input = editReactionsInputRef.current;
                                        if (!input) {
                                          setEditReactions(prev => prev ? `${prev}, ${emoji}` : emoji);
                                          return;
                                        }
                                        const cursorPos = input.selectionStart || 0;
                                        const textBefore = editReactions.substring(0, cursorPos);
                                        const textAfter = editReactions.substring(cursorPos);
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
                                        setEditReactions(newValue);
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
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleEditUsedQuestion(question.questionId)}
                                    className="btn-gradient hover:scale-105"
                                  >
                                    <Save className="mr-2 h-4 w-4" />
                                    Zapisz
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditContent("");
                                      setEditReactions("");
                                    }}
                                  >
                                    Anuluj
                                  </Button>
                                </div>
                              </div>
                            ) : (
                            <div className="flex items-start gap-3">
                              <div className="flex-1 space-y-1">
                                <p className="text-sm">{question.content}</p>
                                {question.reactions.length > 0 && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-wrap">
                                    <span>Reakcje:</span>
                                    <EmojiList emojis={question.reactions} size={16} />
                                    {hasExternalEmoji(question.reactions, botEmojiIds) && (
                                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                        zewnętrzne emoji
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingId(question.questionId);
                                    setEditContent(question.content);
                                    setEditReactions(question.reactions.join(", "));
                                  }}
                                  title="Edytuj pytanie"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRestoreQuestion(question.questionId)}
                                  disabled={restoringId === question.questionId}
                                  title="Przywróć pytanie do puli aktywnych"
                                >
                                  {restoringId === question.questionId ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <RotateCcw className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        </SlideIn>}
      </div>
    </div>
  );
}
