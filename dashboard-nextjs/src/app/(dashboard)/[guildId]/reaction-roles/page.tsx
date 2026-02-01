"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Send, ArrowLeft, Plus, Trash2, Hash, Smile } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import EmojiPicker from "@/components/EmojiPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmojiDisplay } from "@/components/EmojiDisplay";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { SlideIn } from "@/components/ui/animated";

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

interface ReactionMapping {
  emoji: string;
  roleId: string;
  description?: string;
}

interface ReactionRole {
  _id: string;
  guildId: string;
  channelId: string;
  messageId: string;
  title?: string;
  reactions: ReactionMapping[];
}

export default function ReactionRolesPage() {
  const params = useParams();
  const guildId = params?.guildId as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [reactionRoles, setReactionRoles] = useState<ReactionRole[]>([]);

  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [title, setTitle] = useState("");
  const [reactions, setReactions] = useState<ReactionMapping[]>([]);
  const [currentEmoji, setCurrentEmoji] = useState("");
  const [currentRoleId, setCurrentRoleId] = useState("");
  const [currentDescription, setCurrentDescription] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchChannels(),
        fetchRoles(),
        fetchReactionRoles(),
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
      setError("Nie udało się załadować danych reaction-roles. Sprawdź połączenie z internetem i spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  const fetchChannels = async () => {
    try {
      const data = await fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`);
      setChannels(data.filter((ch: Channel) => ch.type === 0 || ch.type === 5));
    } catch (error) {
      console.error("Error fetching channels:", error);
      toast.error("Nie udało się pobrać kanałów");
    }
  };

  const fetchRoles = async () => {
    try {
      const data = await fetchGuildData<Role[]>(guildId, 'roles', `/api/discord/guild/${guildId}/roles`);
      setRoles(data.filter((r: Role) => r.id !== guildId && r.name !== "@everyone"));
    } catch (error) {
      console.error("Error fetching roles:", error);
      toast.error("Nie udało się pobrać ról");
    }
  };

  const fetchReactionRoles = async () => {
    try {
      const response = await fetch(`/api/guild/${guildId}/reaction-roles`);
      if (!response.ok) throw new Error("Failed to fetch reaction roles");
      const data = await response.json();
      setReactionRoles(data);
    } catch (error) {
      console.error("Error fetching reaction roles:", error);
      toast.error("Nie udało się pobrać reaction roles");
    }
  };

  const addReaction = () => {
    if (!currentEmoji || !currentRoleId) {
      toast.error("Wybierz emoji i rolę");
      return;
    }

    const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
    const emojiMatches = currentEmoji.match(emojiRegex);
    
    if (!emojiMatches || emojiMatches.length === 0) {
      toast.error("Wprowadź prawidłowe emoji");
      return;
    }
    
    if (emojiMatches.length > 1) {
      toast.error("Maksymalnie jedno emoji");
      return;
    }

    if (reactions.length >= 20) {
      toast.error("Maksymalnie 20 reakcji na wiadomość");
      return;
    }

    if (reactions.some(r => r.emoji === currentEmoji)) {
      toast.error("To emoji jest już używane");
      return;
    }

    if (reactions.some(r => r.roleId === currentRoleId)) {
      toast.error("Ta rola jest już przypisana");
      return;
    }

    setReactions([...reactions, {
      emoji: currentEmoji,
      roleId: currentRoleId,
      description: currentDescription || undefined,
    }]);

    setCurrentEmoji("");
    setCurrentRoleId("");
    setCurrentDescription("");
  };

  const removeReaction = (index: number) => {
    setReactions(reactions.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!selectedChannelId) {
      toast.error("Wybierz kanał");
      return;
    }

    if (reactions.length === 0) {
      toast.error("Dodaj przynajmniej jedną reakcję");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/guild/${guildId}/reaction-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: selectedChannelId,
          title: title || undefined,
          reactions,
        }),
      });

      if (!response.ok) throw new Error("Failed to create reaction role");

      toast.success("Wiadomość z reakcjami została wysłana!");
      
      setSelectedChannelId("");
      setTitle("");
      setReactions([]);
      
      await fetchReactionRoles();
    } catch (error) {
      console.error("Error creating reaction role:", error);
      toast.error("Nie udało się wysłać wiadomości");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć tę wiadomość z reakcjami?")) {
      return;
    }

    try {
      const response = await fetchWithAuth(`/api/guild/${guildId}/reaction-roles?messageId=${messageId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete reaction role");

      toast.success("Wiadomość została usunięta");
      await fetchReactionRoles();
    } catch (error) {
      console.error("Error deleting reaction role:", error);
      toast.error("Nie udało się usunąć wiadomości");
    }
  };

  const getRoleName = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.name : roleId;
  };

  const getChannelName = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId);
    return channel ? channel.name : channelId;
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
            title="Nie udało się załadować reaction-roles"
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
              <Skeleton className="h-8 w-56 mb-2" />
              <Skeleton className="h-4 w-full max-w-xl" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
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
                {[1, 2].map((i) => (
                  <div key={i} className="p-4 border rounded-lg space-y-3">
                    <Skeleton className="h-6 w-40" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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

        <div className="space-y-6">
          {/* Create New Reaction Role */}
          <SlideIn direction="up" delay={100}>
          <Card
            className="backdrop-blur"
            style={{
              backgroundColor: 'rgba(189, 189, 189, .05)',
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Plus className="w-6 h-6" />
                  <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                    Role za reakcje
                  </span>
                </CardTitle>
                <Switch
                  checked={enabled}
                  onCheckedChange={setEnabled}
                  className="data-[state=checked]:bg-bot-primary"
                  style={{ transform: 'scale(1.5)' }}
                />
              </div>
              <CardDescription>
                Dodaj wiadomość z reakcjami, które przypisują role użytkownikom
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Channel Select */}
              <div className="space-y-2">
                <Label htmlFor="channel">
                  Kanał docelowy <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                  <SelectTrigger id="channel" className="w-full">
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
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Tytuł embeda (opcjonalnie)</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Wybierz swoją rolę"
                  maxLength={256}
                />
              </div>

              {/* Add Reaction */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                <h3 className="font-semibold">Dodaj reakcję</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emoji">Emoji</Label>
                    <div className="flex gap-2">
                      <Input
                        id="emoji"
                        value={currentEmoji}
                        onChange={(e) => setCurrentEmoji(e.target.value)}
                        placeholder="Lub wpisz własne emoji"
                        maxLength={10}
                        className="flex-1"
                      />
                      <div className="[&_button]:h-10 [&_button]:flex [&_button]:items-center [&_button]:justify-center">
                        <EmojiPicker 
                          onEmojiSelect={setCurrentEmoji}
                          buttonText={currentEmoji}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Maksymalnie jedno emoji</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="role">Rola</Label>
                    <Select value={currentRoleId} onValueChange={setCurrentRoleId}>
                      <SelectTrigger id="role">
                        <SelectValue placeholder="Wybierz rolę..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Opis (opcjonalnie)</Label>
                    <Input
                      id="description"
                      value={currentDescription}
                      onChange={(e) => setCurrentDescription(e.target.value)}
                      placeholder="Opcjonalny opis..."
                      maxLength={100}
                    />
                  </div>
                </div>

                <Button onClick={addReaction} variant="outline" className="w-full">
                  <Plus className="mr-2 w-4 h-4" />
                  Dodaj reakcję
                </Button>
              </div>

              {/* Reactions List */}
              {reactions.length > 0 && (
                <div className="space-y-2">
                  <Label>Skonfigurowane reakcje ({reactions.length}/20)</Label>
                  <div className="space-y-2">
                    {reactions.map((reaction, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 hover:shadow-lg hover:shadow-bot-primary/10 hover:scale-105 hover:border-bot-primary/30 transition-all duration-300">
                        <div className="flex items-center gap-3">
                          <EmojiDisplay emoji={reaction.emoji} size={24} />
                          <div>
                            <div className="font-medium">{getRoleName(reaction.roleId)}</div>
                            {reaction.description && (
                              <div className="text-sm text-muted-foreground">{reaction.description}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => removeReaction(index)}
                          variant="ghost"
                          size="sm"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Send Button */}
              <Button 
                onClick={handleSend} 
                disabled={saving || !selectedChannelId || reactions.length === 0}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 w-4 h-4" />
                    Wyślij wiadomość
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
          </SlideIn>

          {/* Existing Reaction Roles */}
          <SlideIn direction="up" delay={200}>
          <Card
            className="backdrop-blur"
            style={{
              backgroundColor: 'rgba(189, 189, 189, .05)',
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <CardTitle className="text-xl">Istniejące Role za Reakcje</CardTitle>
              <CardDescription>
                Zarządzaj utworzonymi wiadomościami z reakcjami
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              {reactionRoles.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
                    <Smile className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Brak wiadomości z reakcjami</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Utwórz pierwszą wiadomość z reakcjami powyżej. Użytkownicy będą mogli przypisać sobie role reagując na wiadomość.
                  </p>
                </div>
              ) : (
                reactionRoles.map((rr, index) => (
                  <SlideIn key={rr._id} direction="up" delay={index * 50}>
                  <div className="p-4 border rounded-lg space-y-3 bg-muted/30 hover:bg-muted/50 hover:shadow-xl hover:shadow-bot-primary/20 hover:scale-[1.02] hover:border-bot-primary/40 transition-all duration-300">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold">{rr.title || "Wybierz swoją rolę"}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Hash className="w-3 h-3" />
                          {getChannelName(rr.channelId)}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDelete(rr.messageId)}
                        variant="destructive"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2">
                      {rr.reactions.map((reaction, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-sm">
                          <EmojiDisplay emoji={reaction.emoji} size={20} />
                          <span className="font-medium">{getRoleName(reaction.roleId)}</span>
                          {reaction.description && (
                            <span className="text-muted-foreground">• {reaction.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  </SlideIn>
                ))
              )}
            </CardContent>
          </Card>
          </SlideIn>
        </div>
      </div>
    </div>
  );
}
