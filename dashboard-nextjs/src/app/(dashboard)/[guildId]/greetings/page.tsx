"use client";

import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, ArrowLeft, Hash, Upload, Trash2, Image as ImageIcon, Eye, EyeOff, Hand } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { fetchGuildData } from "@/lib/cache";
import { SlideIn } from "@/components/ui/animated";
import VariableInserter from "@/components/VariableInserter";
import { OWNER_IDS } from "@/lib/owner";

const DEFAULT_WELCOME_MESSAGE = `### Witaj {user} na {server}

**Witamy na pokładzie!**
Gratulacje, właśnie wbiłeś/aś do miejsca, w którym gry są poważniejsze niż życie… prawie.

➔ Przeczytaj {rulesChannel}
➔ Wybierz role {rolesChannel}
➔ Przywitaj się z nami {chatChannel}

**Rozgość się i znajdź ekipę do grania.**`;

const DEFAULT_GOODBYE_MESSAGE = `Dziękujemy za wspólnie spędzony czas. Do zobaczenia! 👋`;

const greetingsSchema = z.object({
  enabled: z.boolean().default(true),
  greetingsChannelId: z.string().min(1, "Wybierz kanał powitalny"),
  rulesChannelId: z.string().optional(),
  rolesChannelId: z.string().optional(),
  chatChannelId: z.string().optional(),
  welcomeEnabled: z.boolean().default(true),
  goodbyeEnabled: z.boolean().default(true),
  dmEnabled: z.boolean().default(false),
  welcomeMessage: z.string().optional(),
  goodbyeMessage: z.string().optional(),
});

type GreetingsFormData = z.infer<typeof greetingsSchema>;

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface GifFile {
  name: string;
  url: string;
}

export default function GreetingsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const guildId = params.guildId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [gifs, setGifs] = useState<GifFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewGif, setPreviewGif] = useState<string | null>(null);
  const currentUserId = session?.user.id;
  const isOwner = status !== "loading" && OWNER_IDS.includes(currentUserId ?? "");

  const form = useForm<GreetingsFormData>({
    resolver: zodResolver(greetingsSchema),
    defaultValues: {
      enabled: false,
      greetingsChannelId: "",
      rulesChannelId: "",
      rolesChannelId: "",
      chatChannelId: "",
      welcomeEnabled: true,
      goodbyeEnabled: true,
      dmEnabled: false,
      welcomeMessage: "",
      goodbyeMessage: "",
    },
  });

  const { handleSubmit, setValue, watch, reset, formState: { errors } } = form;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, gifsRes, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/guild/${guildId}/channels`),
          fetch(`/api/guild/${guildId}/greetings/gifs`),
          fetch(`/api/guild/${guildId}/greetings`)
        ]);

        const textChannels = channelsData.filter(
          (ch: Channel) => ch.type === 0 || ch.type === 5
        );
        setChannels(textChannels);

        if (gifsRes.ok) {
          const gifsData = await gifsRes.json();
          setGifs(gifsData);
        }

        if (configRes.ok) {
          const config = await configRes.json();
          if (config) {
            setValue("enabled", config.enabled !== undefined ? config.enabled : false);
            setValue("greetingsChannelId", config.greetingsChannelId || "");
            setValue("rulesChannelId", config.rulesChannelId || "");
            setValue("rolesChannelId", config.rolesChannelId || "");
            setValue("chatChannelId", config.chatChannelId || "");
            setValue("welcomeEnabled", config.welcomeEnabled !== undefined ? config.welcomeEnabled : true);
            setValue("goodbyeEnabled", config.goodbyeEnabled !== undefined ? config.goodbyeEnabled : true);
            setValue("dmEnabled", config.dmEnabled !== undefined ? config.dmEnabled : false);
            setValue("welcomeMessage", config.welcomeMessage || DEFAULT_WELCOME_MESSAGE);
            setValue("goodbyeMessage", config.goodbyeMessage || DEFAULT_GOODBYE_MESSAGE);
          } else {
            setValue("welcomeMessage", DEFAULT_WELCOME_MESSAGE);
            setValue("goodbyeMessage", DEFAULT_GOODBYE_MESSAGE);
          }
        } else {
          setValue("welcomeMessage", DEFAULT_WELCOME_MESSAGE);
          setValue("goodbyeMessage", DEFAULT_GOODBYE_MESSAGE);
        }
      } catch (error) {
        setError("Nie udało się załadować danych greetings. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId, reset]);

  const onSubmit = async (data: GreetingsFormData) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/guild/${guildId}/greetings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      toast.success("Konfiguracja została zapisana!");
    } catch (error) {
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadGif = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('gif')) {
      toast.error("Plik musi być w formacie GIF");
      return;
    }

    const formData = new FormData();
    formData.append('gif', file);

    setUploading(true);
    try {
      const response = await fetch(`/api/guild/${guildId}/greetings/gifs`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload GIF");
      }

      const newGif = await response.json();
      setGifs([...gifs, newGif]);
      toast.success("GIF został dodany!");
    } catch (error) {
      toast.error("Nie udało się dodać GIF-a");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteGif = async (gifName: string) => {
    const message = isOwner
      ? "Czy na pewno chcesz trwale usunąć ten GIF?"
      : "Czy na pewno chcesz ukryć ten GIF z rotacji powitań na tym serwerze?";

    if (!confirm(message)) return;

    try {
      const response = await fetch(`/api/guild/${guildId}/greetings/gifs?name=${gifName}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete GIF");
      }

      const result = await response.json();

      setGifs(gifs.filter(g => g.name !== gifName));
      toast.success(result.mode === "hard" ? "GIF został usunięty!" : "GIF został ukryty z rotacji!");
    } catch (error) {
      toast.error("Nie udało się usunąć GIF-a");
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="w-full">
          <ErrorState
            title="Nie udało się załadować greetings"
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
        <div className="w-full">
          <Skeleton className="h-10 w-40 mb-6" />
          
          <Card
            className="backdrop-blur mb-6"
            style={{
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <Skeleton className="h-8 w-56 mb-2" />
              <Skeleton className="h-4 w-full max-w-xl" />
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
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
              
              <div className="space-y-4">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
          
          <Card
            className="backdrop-blur"
            style={{
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <Skeleton className="h-7 w-32" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32 w-full" />
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
      <div className="w-full">


        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Main Configuration */}
          <SlideIn direction="up" delay={100}>
          <Card 
            className="backdrop-blur"
            style={{
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Hand className="w-6 h-6 text-bot-primary" />
                  <span className="text-white/90">
                    Konfiguracja Greetings
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
                Skonfiguruj wiadomości powitalne i pożegnalne dla członków serwera
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-background/50">
                  <div className="space-y-0.5">
                    <Label htmlFor="dmEnabled" className="text-base font-medium">
                      Wiadomości prywatne
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Wyślij wiadomość powitalną w prywatnej wiadomości
                    </p>
                  </div>
                  <Switch
                    id="dmEnabled"
                    checked={watch("dmEnabled") || false}
                    onCheckedChange={(checked) => setValue("dmEnabled", checked)}
                  />
                </div>
              </div>

              {/* Channels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="greetingsChannelId">
                    Kanał powitalny <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={watch("greetingsChannelId") || ""}
                    onValueChange={(value) => setValue("greetingsChannelId", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue 
                        placeholder="Wybierz kanał..." 
                        className={!watch("greetingsChannelId") ? "text-muted-foreground" : ""}
                      >
                        {watch("greetingsChannelId") ? 
                          channels.find(ch => ch.id === watch("greetingsChannelId"))?.name || "Wybierz kanał..." 
                          : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Hash className="w-4 h-4" />
                              <span>Wybierz kanał...</span>
                            </div>
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-muted-foreground" />
                            {channel.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.greetingsChannelId && (
                    <p className="text-sm text-destructive">{errors.greetingsChannelId.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rulesChannelId">Kanał regulaminu</Label>
                  <Select
                    value={watch("rulesChannelId") || ""}
                    onValueChange={(value) => setValue("rulesChannelId", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {watch("rulesChannelId") ? 
                          channels.find(ch => ch.id === watch("rulesChannelId"))?.name || "Wybierz kanał..." 
                          : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Hash className="w-4 h-4" />
                              <span>Wybierz kanał...</span>
                            </div>
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-muted-foreground" />
                            {channel.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rolesChannelId">Kanał ról</Label>
                  <Select
                    value={watch("rolesChannelId") || ""}
                    onValueChange={(value) => setValue("rolesChannelId", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {watch("rolesChannelId") ? 
                          channels.find(ch => ch.id === watch("rolesChannelId"))?.name || "Wybierz kanał..." 
                          : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Hash className="w-4 h-4" />
                              <span>Wybierz kanał...</span>
                            </div>
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-muted-foreground" />
                            {channel.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chatChannelId">Kanał czatu</Label>
                  <Select
                    value={watch("chatChannelId") || ""}
                    onValueChange={(value) => setValue("chatChannelId", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {watch("chatChannelId") ? 
                          channels.find(ch => ch.id === watch("chatChannelId"))?.name || "Wybierz kanał..." 
                          : (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Hash className="w-4 h-4" />
                              <span>Wybierz kanał...</span>
                            </div>
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((channel) => (
                        <SelectItem key={channel.id} value={channel.id}>
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-muted-foreground" />
                            {channel.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Messages */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="welcomeMessage">Wiadomość powitalna</Label>
                    <Switch
                      id="welcomeEnabled"
                      checked={watch("welcomeEnabled") || false}
                      onCheckedChange={(checked) => setValue("welcomeEnabled", checked)}
                    />
                  </div>
                  <VariableInserter
                    value={watch("welcomeMessage") || ""}
                    onChange={(value) => setValue("welcomeMessage", value)}
                    variables={[
                      { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
                      { name: "Nazwa użytkownika", display: "Nazwa użytkownika", value: "{username}", description: "Nazwa użytkownika bez wzmianki" },
                      { name: "Serwer", display: "Serwer", value: "{server}", description: "Nazwa serwera" },
                      { name: "Liczba członków", display: "Liczba członków", value: "{memberCount}", description: "Liczba członków na serwerze" },
                      { name: "Regulamin", display: "Regulamin", value: "{rulesChannel}", description: "Kanał z regulaminem" },
                      { name: "Role", display: "Role", value: "{rolesChannel}", description: "Kanał z rolami" },
                      { name: "Czat", display: "Czat", value: "{chatChannel}", description: "Kanał czatu" },
                    ]}
                    rows={8}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="goodbyeMessage">Wiadomość pożegnalna</Label>
                    <Switch
                      id="goodbyeEnabled"
                      checked={watch("goodbyeEnabled") || false}
                      onCheckedChange={(checked) => setValue("goodbyeEnabled", checked)}
                    />
                  </div>
                  <VariableInserter
                    value={watch("goodbyeMessage") || ""}
                    onChange={(value) => setValue("goodbyeMessage", value)}
                    variables={[
                      { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
                      { name: "Nazwa użytkownika", display: "Nazwa użytkownika", value: "{username}", description: "Nazwa użytkownika bez wzmianki" },
                      { name: "Serwer", display: "Serwer", value: "{server}", description: "Nazwa serwera" },
                      { name: "Liczba członków", display: "Liczba członków", value: "{memberCount}", description: "Liczba członków na serwerze" },
                    ]}
                    rows={4}
                  />
                </div>
              </div>

              <Button type="submit" disabled={saving} className="btn-gradient hover:scale-105 w-full">
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
            </CardContent>
          </Card>
          </SlideIn>
        </form>

        {/* GIFs Section */}
        <SlideIn direction="up" delay={200}>
        <Card 
          className="backdrop-blur mt-6"
          style={{
            boxShadow: '0 0 10px #00000026',
            border: '1px solid transparent'
          }}
        >
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ImageIcon className="w-6 h-6 text-bot-primary" />
              <span>Zarządzaj GIF-ami powitalnymi</span>
            </CardTitle>
            <CardDescription>
              Dodawaj i usuwaj GIF-y wyświetlane w wiadomościach powitalnych
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="gif-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-lg p-6 hover:border-primary transition-colors text-center">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Kliknij aby dodać GIF
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Maksymalny rozmiar: 8MB
                  </p>
                </div>
                <input
                  id="gif-upload"
                  type="file"
                  accept=".gif"
                  className="hidden"
                  onChange={handleUploadGif}
                  disabled={uploading}
                />
              </Label>
            </div>

            {gifs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Brak dodanych GIF-ów
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gifs.map((gif, index) => (
                  <SlideIn key={gif.name} direction="up" delay={index * 50}>
                  <div
                    key={gif.name}
                    className="relative group rounded-lg overflow-hidden bg-background/50 border border-border"
                  >
                    <img
                      src={gif.url}
                      alt={gif.name}
                      className="w-full h-32 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPreviewGif(gif.url)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      {isOwner ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteGif(gif.name)}
                          title="Usuń trwale"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDeleteGif(gif.name)}
                          title="Ukryj z rotacji"
                        >
                          <EyeOff className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  </SlideIn>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </SlideIn>

        {/* Preview Modal */}
        {previewGif && (
          <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setPreviewGif(null)}
          >
            <div className="max-w-3xl max-h-[80vh]">
              <img src={previewGif} alt="Preview" className="max-w-full max-h-full rounded-lg" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
