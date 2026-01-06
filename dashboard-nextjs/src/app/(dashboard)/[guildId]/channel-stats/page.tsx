"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, Activity, Users, Bot, Ban, UserPlus, AlertCircle, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import VariableInserter from "@/components/VariableInserter";

interface ChannelInfo {
  channelId?: string;
  template?: string;
  member?: string;
}

interface ChannelsConfig {
  lastJoined?: ChannelInfo;
  users?: ChannelInfo;
  bots?: ChannelInfo;
  bans?: ChannelInfo;
}

interface ChannelStatsConfig {
  guildId: string;
  channels: ChannelsConfig;
}

export default function ChannelStatsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState<string | null>(null);
  
  const [config, setConfig] = useState<ChannelStatsConfig>({
    guildId,
    channels: {
      lastJoined: { template: '👤 Ostatni: {member}' },
      users: { template: '👥 Użytkownicy: {count}' },
      bots: { template: '🤖 Boty: {count}' },
      bans: { template: '🔨 Bany: {count}' },
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const configRes = await fetchWithAuth(`/api/guild/${guildId}/channel-stats/config`, { 
          next: { revalidate: 600 } 
        });

        if (configRes.ok) {
          const configData = await configRes.json();
          
          const defaultTemplates = {
            lastJoined: '👤 Ostatni: {member}',
            users: '👥 Użytkownicy: {count}',
            bots: '🤖 Boty: {count}',
            bans: '🔨 Bany: {count}',
          };
          
          Object.keys(defaultTemplates).forEach((key) => {
            if (!configData.channels[key]) {
              configData.channels[key] = {};
            }
            if (configData.channels[key].template) {
              configData.channels[key].template = configData.channels[key].template
                .replace(/<count>/g, '{count}')
                .replace(/<member>/g, '{member}')
                .replace(/<value>/g, '{value}');
            }
            if (!configData.channels[key].template) {
              configData.channels[key].template = defaultTemplates[key as keyof typeof defaultTemplates];
            }
          });
          
          const validateRes = await fetch(`/api/guild/${guildId}/channel-stats/validate`, {
            method: "POST",
          });
          
          if (validateRes.ok) {
            const validatedData = await validateRes.json();
            
            Object.keys(defaultTemplates).forEach((key) => {
              if (!validatedData.channels[key]) {
                validatedData.channels[key] = {};
              }
              if (!validatedData.channels[key].template) {
                validatedData.channels[key].template = configData.channels[key]?.template || defaultTemplates[key as keyof typeof defaultTemplates];
              }
            });
            
            setConfig(validatedData);
          } else {
            setConfig(configData);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading channel stats data:", error);
        setError("Nie udało się załadować danych statystyk kanałów. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/guild/${guildId}/channel-stats/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      toast.success("Konfiguracja została zapisana! Bot utworzy kanały w ciągu kilku sekund.");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const updateChannelInfo = (category: keyof ChannelsConfig, field: keyof ChannelInfo, value: string) => {
    setConfig({
      ...config,
      channels: {
        ...config.channels,
        [category]: {
          ...config.channels[category],
          [field]: value || undefined,
        },
      },
    });
  };

  const handleCreateChannel = async (category: keyof ChannelsConfig) => {
    try {
      setCreatingChannel(category);
      
      const categoryData = config.channels[category] || {};
      const template = categoryData.template;
      
      if (!template) {
        toast.error("Szablon nie może być pusty");
        return;
      }

      const response = await fetch(`/api/guild/${guildId}/channel-stats/create-channel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category, template }),
      });

      if (!response.ok) {
        throw new Error("Failed to create channel");
      }

      const data = await response.json();
      
      setConfig({
        ...config,
        channels: {
          ...config.channels,
          [category]: {
            ...config.channels[category],
            channelId: data.channelId,
          },
        },
      });

      toast.success(`Kanał został utworzony: ${data.channelName}`);
    } catch (error) {
      console.error("Error creating channel:", error);
      toast.error("Nie udało się utworzyć kanału");
    } finally {
      setCreatingChannel(null);
    }
  };

  if (error) {
    return <ErrorState message={error} onRetry={handleRetry} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-4xl">
          <Skeleton className="h-10 w-48 mb-6" />
          <Card className="backdrop-blur">
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 mt-2" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statCategories = [
    {
      key: 'lastJoined' as const,
      name: 'Ostatnio Dołączył',
      icon: UserPlus,
      description: 'Wyświetla ostatniego użytkownika, który dołączył do serwera',
      color: 'text-green-500',
      presets: [
        'Ostatnio: {member}',
        '👤 Ostatni: {member}',
        '🆕 Nowy: {member}',
        'Witaj {member}!',
      ],
      variables: [
        { name: 'Użytkownik', display: 'Użytkownik', value: '{member}', description: 'Nazwa ostatniego użytkownika' },
      ],
    },
    {
      key: 'users' as const,
      name: 'Liczba Użytkowników',
      icon: Users,
      description: 'Wyświetla aktualną liczbę użytkowników na serwerze',
      color: 'text-blue-500',
      presets: [
        '👥 Użytkownicy: {count}',
        'Użytkowników: {count}',
        '👤 Members: {count}',
        'Users: {count}',
      ],
      variables: [
        { name: 'Liczba', display: 'Liczba', value: '{count}', description: 'Liczba użytkowników' },
      ],
    },
    {
      key: 'bots' as const,
      name: 'Liczba Botów',
      icon: Bot,
      description: 'Wyświetla aktualną liczbę botów na serwerze',
      color: 'text-purple-500',
      presets: [
        '🤖 Boty: {count}',
        'Botów: {count}',
        '⚙️ Bots: {count}',
        'Bots: {count}',
      ],
      variables: [
        { name: 'Liczba', display: 'Liczba', value: '{count}', description: 'Liczba botów' },
      ],
    },
    {
      key: 'bans' as const,
      name: 'Liczba Banów',
      icon: Ban,
      description: 'Wyświetla aktualną liczbę zbanowanych użytkowników',
      color: 'text-red-500',
      presets: [
        '🔨 Bany: {count}',
        'Banów: {count}',
        '⛔ Bans: {count}',
        'Bans: {count}',
      ],
      variables: [
        { name: 'Liczba', display: 'Liczba', value: '{count}', description: 'Liczba banów' },
      ],
    },
  ];

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

        <SlideIn direction="up" delay={100}>
          <Card className="backdrop-blur" style={{
            backgroundColor: 'rgba(189, 189, 189, .05)',
            boxShadow: '0 0 10px #00000026',
            border: '1px solid transparent'
          }}>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Activity className="w-6 h-6 text-bot-primary" />
                Kanały z licznikami
              </CardTitle>
              <CardDescription>
                Konfiguracja automatycznych statystyk wyświetlanych na kanałach głosowych
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Info Box */}
              <div className="flex gap-3 p-4 rounded-lg bg-bot-primary/10 border border-bot-primary/20">
                <AlertCircle className="w-5 h-5 text-bot-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Jak to działa?</p>
                  <p className="text-xs text-muted-foreground">
                    Bot automatycznie utworzy nowe kanały głosowe i będzie aktualizował ich nazwy co 10 minut zgodnie z ustawionym szablonem.
                    Użyj zmiennych: <code className="px-1 py-0.5 rounded bg-background/50">&#123;count&#125;</code> dla liczby,
                    <code className="px-1 py-0.5 rounded bg-background/50 ml-1">&#123;member&#125;</code> dla nazwy użytkownika.
                  </p>
                </div>
              </div>

              {/* Categories */}
              {statCategories.map((category, index) => {
                const Icon = category.icon;
                const categoryData = config.channels[category.key] || {};
                
                return (
                  <SlideIn key={category.key} direction="up" delay={150 + index * 50}>
                    <Card className="backdrop-blur bg-background/30">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Icon className={`w-5 h-5 ${category.color}`} />
                          {category.name}
                        </CardTitle>
                        <CardDescription>{category.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Presets */}
                        <div className="space-y-2">
                          <Label>Gotowe elementy</Label>
                          <div className="flex flex-wrap gap-2">
                            {category.presets.map((preset, idx) => (
                              <Button
                                key={idx}
                                onClick={() => {
                                  setConfig({
                                    ...config,
                                    channels: {
                                      ...config.channels,
                                      [category.key]: {
                                        ...config.channels[category.key],
                                        template: preset,
                                      },
                                    },
                                  });
                                }}
                                variant="outline"
                                size="sm"
                                className="text-xs"
                              >
                                {preset}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {/* Template */}
                        <div className="space-y-2">
                          <Label htmlFor={`${category.key}-template`}>
                            Szablon nazwy kanału
                          </Label>
                          <div className="flex gap-2 items-start">
                            <div className="flex-1">
                              <VariableInserter
                                value={categoryData.template || ''}
                                onChange={(value) => updateChannelInfo(category.key, 'template', value)}
                                variables={category.variables}
                                placeholder={category.presets[0]}
                                rows={1}
                              />
                            </div>
                            <Button
                              onClick={() => handleCreateChannel(category.key)}
                              disabled={!categoryData.template || creatingChannel === category.key || !!categoryData.channelId}
                              variant="outline"
                              size="icon"
                              title={categoryData.channelId ? "Kanał już istnieje" : "Utwórz kanał głosowy"}
                            >
                              {creatingChannel === category.key ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Plus className="w-4 h-4" />
                              )}
                            </Button>
                          </div>
                          {categoryData.channelId && (
                            <p className="text-xs text-green-600 dark:text-green-400">
                              ✓ Kanał został utworzony i jest automatycznie aktualizowany
                            </p>
                          )}
                          {!categoryData.channelId && (
                            <p className="text-xs text-muted-foreground">
                              Kliknij +, aby utworzyć nowy kanał głosowy z tym szablonem.
                            </p>
                          )}
                        </div>

                      </CardContent>
                    </Card>
                  </SlideIn>
                );
              })}

              <Button 
                onClick={handleSave} 
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
            </CardContent>
          </Card>
        </SlideIn>
      </div>
    </div>
  );
}
