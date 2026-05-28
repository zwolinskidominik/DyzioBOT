"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { OWNER_IDS } from "@/lib/owner";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SlideIn } from "@/components/ui/animated";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Upload,
  SmilePlus,
  Search,
  ImageIcon,
} from "lucide-react";

/* ── Types ────────────────────────────────────────────────── */

interface DiscordEmoji {
  id: string;
  name: string;
  animated: boolean;
  managed: boolean;
  require_colons: boolean;
}

/* ── Helpers ──────────────────────────────────────────────── */

function emojiUrl(emoji: DiscordEmoji): string {
  const ext = emoji.animated ? "gif" : "png";
  return `https://cdn.discordapp.com/emojis/${emoji.id}.${ext}?size=64&quality=lossless`;
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Component ────────────────────────────────────────────── */

export default function BotEmojisPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const { data: session, status } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;

  const [emojis, setEmojis] = useState<DiscordEmoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [emojiName, setEmojiName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = status !== "loading" && OWNER_IDS.includes(currentUserId ?? "");

  /* ── Data fetching ── */

  const fetchEmojis = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/bot-emojis/manage`);
      if (!res.ok) throw new Error(await res.text());
      const data: DiscordEmoji[] = await res.json();
      setEmojis(data);
    } catch {
      toast.error("Nie udało się pobrać emoji");
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => {
    if (isOwner) fetchEmojis();
  }, [isOwner, fetchEmojis]);

  /* ── File pick ── */

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Dozwolone formaty: PNG, JPG, GIF, WebP");
      return;
    }
    if (file.size > 262144) {
      toast.error("Plik jest za duży (max 256 KB)");
      return;
    }

    try {
      const uri = await fileToDataUri(file);
      setImageData(uri);
      setPreviewUrl(uri);
    } catch {
      toast.error("Nie udało się odczytać pliku");
    }
  };

  /* ── Upload ── */

  const handleUpload = async () => {
    if (!emojiName || !imageData) {
      toast.error("Podaj nazwę i wybierz plik");
      return;
    }
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(emojiName)) {
      toast.error("Nazwa: 2–32 znaki, tylko litery / cyfry / podkreślenie");
      return;
    }

    setUploading(true);
    try {
      const res = await fetchWithAuth("/api/bot-emojis/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: emojiName, image: imageData }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Błąd API" })) as { error?: string };
        toast.error(err.error ?? "Nie udało się dodać emoji");
        return;
      }

      toast.success(`Emoji :${emojiName}: zostało dodane!`);
      setEmojiName("");
      setImageData(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchEmojis();
    } catch {
      toast.error("Błąd połączenia");
    } finally {
      setUploading(false);
    }
  };

  /* ── Access guards ── */

  if (status === "loading") {
    return (
      <div className="min-h-screen">
        <div className="w-full">
          <Skeleton className="h-10 w-40 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        <div className="text-6xl">🔒</div>
        <h1 className="text-2xl font-bold">Moduł niedostępny</h1>
        <p className="text-muted-foreground text-center">
          Ta funkcja jest dostępna wyłącznie dla właścicieli bota.
        </p>
      </div>
    );
  }



  /* ── Filtered list ── */

  const filtered = search
    ? emojis.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    : emojis;

  const staticCount = emojis.filter((e) => !e.animated).length;
  const animatedCount = emojis.filter((e) => e.animated).length;

  /* ── Render ── */

  return (
    <div className="min-h-screen">
      <div className="w-full">


        <div className="space-y-6">
          {/* Upload card */}
          <SlideIn direction="up" delay={100}>
            <Card
              className="backdrop-blur"
              style={{
                boxShadow: "0 0 10px #00000026",
                border: "1px solid transparent",
              }}
            >
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <SmilePlus className="w-6 h-6 text-bot-primary" />
                  <span className="text-white/90">
                    Emoji Bota
                  </span>
                </CardTitle>
                <CardDescription>
                  Dodaj niestandardowe emoji do zasobów bota. Emoji są dostępne we
                  wszystkich komendach i modułach.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-6 pt-2">
                {/* Upload form */}
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Dodaj nowe emoji
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div className="space-y-2">
                      <Label htmlFor="emoji-name">
                        Nazwa <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="emoji-name"
                        value={emojiName}
                        onChange={(e) => setEmojiName(e.target.value)}
                        placeholder="np. dyzio_gg"
                        maxLength={32}
                      />
                      <p className="text-xs text-muted-foreground">
                        2–32 znaki: litery, cyfry, podkreślenie (_)
                      </p>
                    </div>

                    {/* File */}
                    <div className="space-y-2">
                      <Label htmlFor="emoji-file">
                        Obraz <span className="text-destructive">*</span>
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="emoji-file"
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="flex-1"
                        />
                        {previewUrl && (
                          <div className="w-10 h-10 border rounded flex items-center justify-center overflow-hidden bg-muted/40 flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt="podgląd"
                              className="w-8 h-8 object-contain"
                            />
                          </div>
                        )}
                        {!previewUrl && (
                          <div className="w-10 h-10 border rounded flex items-center justify-center bg-muted/40 flex-shrink-0">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG, GIF, WebP — max 256 KB
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleUpload}
                    disabled={uploading || !emojiName || !imageData}
                    className="w-full"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Dodawanie...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 w-4 h-4" />
                        Dodaj emoji
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </SlideIn>

          {/* Emoji list card */}
          <SlideIn direction="up" delay={200}>
            <Card
              className="backdrop-blur"
              style={{
                boxShadow: "0 0 10px #00000026",
                border: "1px solid transparent",
              }}
            >
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-xl">
                    Emoji bota
                  </CardTitle>
                  <div className="flex gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline">{staticCount} statyczne</Badge>
                    <Badge variant="outline">{animatedCount} animowane</Badge>
                  </div>
                </div>
                <CardDescription>
                  Aktualnie załadowane emoji dostępne dla bota
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2 space-y-4">
                {/* Search */}
                {emojis.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Szukaj emoji po nazwie..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                )}

                {/* Loading state */}
                {loading && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 w-full rounded-lg" />
                    ))}
                  </div>
                )}

                {/* Empty state */}
                {!loading && emojis.length === 0 && (
                  <div className="text-center py-16 px-4">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
                      <SmilePlus className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Brak emoji</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Dodaj pierwsze emoji korzystając z formularza powyżej.
                    </p>
                  </div>
                )}

                {/* No search results */}
                {!loading && emojis.length > 0 && filtered.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Nie znaleziono emoji pasujących do &quot;{search}&quot;
                  </p>
                )}

                {/* Emoji grid */}
                {!loading && filtered.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filtered.map((emoji) => (
                      <div
                        key={emoji.id}
                        className="group relative flex flex-col items-center gap-2 p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 hover:border-bot-primary/30 hover:shadow-lg hover:shadow-bot-primary/10 transition-all duration-300"
                      >
                        {/* Preview */}
                        <div className="w-12 h-12 flex items-center justify-center">
                          <Image
                            src={emojiUrl(emoji)}
                            alt={emoji.name}
                            width={48}
                            height={48}
                            unoptimized
                            className="object-contain"
                          />
                        </div>

                        {/* Name */}
                        <p
                          className="text-xs font-medium text-center truncate w-full"
                          title={emoji.name}
                        >
                          :{emoji.name}:
                        </p>

                        {/* Badges */}
                        <div className="flex gap-1">
                          {emoji.animated && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              GIF
                            </Badge>
                          )}
                          {emoji.managed && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              managed
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </SlideIn>
        </div>

      </div>
    </div>
  );
}
