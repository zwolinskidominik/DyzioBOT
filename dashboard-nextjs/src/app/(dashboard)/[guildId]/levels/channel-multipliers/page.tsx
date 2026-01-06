"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Save, ArrowLeft, Hash, TrendingUp, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface ChannelMultiplier {
  channelId: string;
  multiplier: number;
}

export default function ChannelMultipliersPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [multipliers, setMultipliers] = useState<ChannelMultiplier[]>([]);
  const [newChannelId, setNewChannelId] = useState("");
  const [newMultiplier, setNewMultiplier] = useState("1.5");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const cacheKey = `channels_${guildId}`;
        const cached = localStorage.getItem(cacheKey);
        let channelsPromise;
        
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < 60 * 1000) {
            channelsPromise = Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
          } else {
            channelsPromise = fetch(`/api/discord/guild/${guildId}/channels`);
          }
        } else {
          channelsPromise = fetch(`/api/discord/guild/${guildId}/channels`);
        }

        const [channelsRes, multipliersRes] = await Promise.all([
          channelsPromise,
          fetch(`/api/guild/${guildId}/levels/channel-multipliers`),
        ]);

        if (channelsRes.ok) {
          const channelsData = await channelsRes.json();
          const textChannels = channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 2 || ch.type === 5);
          setChannels(textChannels);
          
          if (!cached || Date.now() - JSON.parse(cached).timestamp >= 60 * 1000) {
            localStorage.setItem(cacheKey, JSON.stringify({
              data: channelsData,
              timestamp: Date.now()
            }));
          }
        }

        if (multipliersRes.ok) {
          const multipliersData = await multipliersRes.json();
          setMultipliers(multipliersData);
        }
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Nie udało się załadować danych. Sprawdź połączenie z internetem i spróbuj ponownie.");
        toast.error("Nie udało się załadować danych");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const handleAdd = async () => {
    if (!newChannelId) {
      toast.error("Wybierz kanał");
      return;
    }

    const multiplierValue = parseFloat(newMultiplier);
    if (isNaN(multiplierValue) || multiplierValue < 0.1 || multiplierValue > 10) {
      toast.error("Mnożnik musi być liczbą między 0.1 a 10");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/guild/${guildId}/levels/channel-multipliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId: newChannelId,
          multiplier: multiplierValue,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add multiplier");
      }

      const existingIndex = multipliers.findIndex(m => m.channelId === newChannelId);
      if (existingIndex >= 0) {
        const updated = [...multipliers];
        updated[existingIndex].multiplier = multiplierValue;
        setMultipliers(updated);
      } else {
        setMultipliers([...multipliers, { channelId: newChannelId, multiplier: multiplierValue }]);
      }

      setNewChannelId("");
      setNewMultiplier("1.5");
      toast.success("Mnożnik został dodany!");
    } catch (error) {
      console.error("Error adding multiplier:", error);
      toast.error("Nie udało się dodać mnożnika");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (channelId: string) => {
    try {
      const response = await fetch(`/api/guild/${guildId}/levels/channel-multipliers?channelId=${channelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete multiplier");
      }

      setMultipliers(multipliers.filter(m => m.channelId !== channelId));
      toast.success("Mnożnik został usunięty!");
    } catch (error) {
      console.error("Error deleting multiplier:", error);
      toast.error("Nie udało się usunąć mnożnika");
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
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}/levels`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do poziomów
            </Link>
          </Button>
          <ErrorState
            title="Nie udało się załadować mnożników"
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
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
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
            <Link href={`/${guildId}/levels`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do poziomów
            </Link>
          </Button>
        </SlideIn>

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
              <CardTitle className="text-2xl flex items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                  Mnożniki XP dla Kanałów
                </span>
              </CardTitle>
              <CardDescription>
                Ustaw niestandardowe mnożniki XP dla wybranych kanałów (np. 2.0 = podwójne XP, 0.5 = połowa XP)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add New Multiplier */}
              <div className="rounded-lg bg-background/50 p-4 space-y-4">
                <h3 className="font-semibold text-sm">Dodaj nowy mnożnik</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="channel">Kanał</Label>
                    <Select value={newChannelId} onValueChange={setNewChannelId}>
                      <SelectTrigger id="channel">
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
                  
                  <div className="space-y-2">
                    <Label htmlFor="multiplier">Mnożnik</Label>
                    <Input
                      id="multiplier"
                      type="number"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={newMultiplier}
                      onChange={(e) => setNewMultiplier(e.target.value)}
                      placeholder="1.5"
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleAdd} 
                  disabled={saving || !newChannelId}
                  className="btn-gradient hover:scale-105 w-full"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Dodawanie...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 w-4 h-4" />
                      Dodaj mnożnik
                    </>
                  )}
                </Button>
              </div>

              {/* Current Multipliers */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Aktualne mnożniki ({multipliers.length})</h3>
                {multipliers.length === 0 ? (
                  <div className="text-center py-8 px-4 rounded-lg bg-background/50">
                    <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Brak ustawionych mnożników dla kanałów
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {multipliers.map((multiplier, index) => {
                      const channel = channels.find(c => c.id === multiplier.channelId);
                      return (
                        <SlideIn key={multiplier.channelId} direction="up" delay={index * 50}>
                          <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-background/70 transition-colors">
                            <div className="flex items-center gap-3">
                              <Hash className="w-4 h-4 text-muted-foreground" />
                              <span className="font-medium">
                                {channel?.name || multiplier.channelId}
                              </span>
                              <span className="px-2 py-1 rounded-md bg-bot-primary/20 text-bot-light text-sm font-semibold">
                                {multiplier.multiplier}x
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(multiplier.channelId)}
                              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </SlideIn>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </SlideIn>
      </div>
    </div>
  );
}
