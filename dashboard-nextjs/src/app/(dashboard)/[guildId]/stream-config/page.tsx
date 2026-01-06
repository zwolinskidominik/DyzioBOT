'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Trash2, ArrowLeft, Hash, Plus, Edit2, X, MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { fetchGuildData } from '@/lib/cache';
import { SlideIn } from '@/components/ui/animated';

interface Channel {
  id: string;
  name: string;
  type: number;
}

interface StreamConfig {
  guildId: string;
  enabled?: boolean;
  channelId: string | null;
}

interface Streamer {
  _id: string;
  guildId: string;
  twitchChannel: string;
  userId: string;
  isLive: boolean;
  active: boolean;
}

interface GuildMember {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export default function StreamConfigPage() {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;

  const [config, setConfig] = useState<StreamConfig | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  const [streamers, setStreamers] = useState<Streamer[]>([]);
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [newTwitchChannel, setNewTwitchChannel] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTwitchChannel, setEditTwitchChannel] = useState('');
  const [editUserId, setEditUserId] = useState('');
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [configRes, channelsData, streamersRes, membersData] = await Promise.all([
          fetch(`/api/guild/${guildId}/stream-config`),
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
          fetch(`/api/guild/${guildId}/streamers`),
          fetchGuildData<GuildMember[]>(guildId, 'members', `/api/discord/guild/${guildId}/members`),
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          if (configData.channelId) {
            setSelectedChannelId(configData.channelId);
          }
          setEnabled(configData.enabled !== undefined ? configData.enabled : true);
        }

        const textChannels = channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5);
        setChannels(textChannels);

        if (streamersRes.ok) {
          const streamersData = await streamersRes.json();
          setStreamers(streamersData);
        }

        setMembers(membersData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError("Nie udało się załadować danych stream-config. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [guildId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSave = async () => {
    if (!selectedChannelId) {
      toast.error('Wybierz kanał powiadomień');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/guild/${guildId}/stream-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          channelId: selectedChannelId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save configuration');
      }

      const updatedConfig = await response.json();
      setConfig(updatedConfig);
      toast.success('Konfiguracja zapisana!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Błąd podczas zapisywania konfiguracji');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Czy na pewno chcesz usunąć konfigurację powiadomień o streamach?')) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/guild/${guildId}/stream-config`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete configuration');
      }

      setConfig({ guildId, channelId: null });
      setSelectedChannelId('');
      toast.success('Konfiguracja usunięta!');
    } catch (error) {
      console.error('Error deleting configuration:', error);
      toast.error('Błąd podczas usuwania konfiguracji');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddStreamer = async () => {
    if (!newTwitchChannel.trim() || !newUserId) {
      toast.error('Podaj kanał Twitch i wybierz użytkownika Discord');
      return;
    }

    try {
      const response = await fetch(`/api/guild/${guildId}/streamers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitchChannel: newTwitchChannel.trim(),
          userId: newUserId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add streamer');
      }

      const streamer = await response.json();
      setStreamers([...streamers, streamer]);
      setNewTwitchChannel('');
      setNewUserId('');
      toast.success('Streamer został dodany!');
    } catch (error) {
      console.error('Error adding streamer:', error);
      toast.error('Błąd podczas dodawania streamera');
    }
  };

  const handleEditStreamer = async (streamerId: string) => {
    if (!editTwitchChannel.trim() || !editUserId) {
      toast.error('Podaj kanał Twitch i wybierz użytkownika Discord');
      return;
    }

    try {
      const response = await fetch(`/api/guild/${guildId}/streamers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamerId,
          twitchChannel: editTwitchChannel.trim(),
          userId: editUserId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update streamer');
      }

      const updatedStreamer = await response.json();
      setStreamers(streamers.map((s) => (s._id === streamerId ? updatedStreamer : s)));
      setEditingId(null);
      setEditTwitchChannel('');
      setEditUserId('');
      toast.success('Streamer został zaktualizowany!');
    } catch (error) {
      console.error('Error updating streamer:', error);
      toast.error('Błąd podczas aktualizacji streamera');
    }
  };

  const handleDeleteStreamer = async (streamerId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego streamera?')) return;

    try {
      const response = await fetch(`/api/guild/${guildId}/streamers?streamerId=${streamerId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete streamer');
      }

      setStreamers(streamers.filter((s) => s._id !== streamerId));
      toast.success('Streamer został usunięty!');
    } catch (error) {
      console.error('Error deleting streamer:', error);
      toast.error('Błąd podczas usuwania streamera');
    }
  };

  const getMemberDisplay = (userId: string) => {
    const member = members.find((m) => m.id === userId);
    if (member) {
      return member.discriminator === '0' 
        ? member.username 
        : `${member.username}#${member.discriminator}`;
    }
    return userId;
  };

  const filteredMembers = members.filter((member) => {
    const display = member.discriminator === '0' 
      ? member.username 
      : `${member.username}#${member.discriminator}`;
    return display.toLowerCase().includes(userSearch.toLowerCase());
  }).slice(0, 10);

  const handleSelectUser = (userId: string) => {
    setNewUserId(userId);
    const member = members.find(m => m.id === userId);
    if (member) {
      setUserSearch(member.discriminator === '0' ? member.username : `${member.username}#${member.discriminator}`);
    }
    setShowUserDropdown(false);
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
            title="Nie udało się załadować konfiguracji streamów"
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
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="w-11 h-6 rounded-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
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
              <Skeleton className="h-7 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
                
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-9 w-20" />
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

        {/* Configuration Card */}
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
                <span>📺</span>
                <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                  Konfiguracja Powiadomień Twitch
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
              Skonfiguruj kanał, na którym będą publikowane powiadomienia o rozpoczętych streamach
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="channel-select">
                Kanał powiadomień <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger id="channel-select" className="w-full">
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
              <p className="text-xs text-muted-foreground">
                Kanał, na którym będą wysyłane powiadomienia o streamach
              </p>
            </div>

            {config?.channelId && (
              <div className="rounded-lg bg-background/50 p-4 space-y-2">
                <p className="text-sm font-medium">Aktualnie skonfigurowany kanał:</p>
                <p className="text-sm text-muted-foreground">
                  {channels.find((ch) => ch.id === config.channelId)?.name ? (
                    <span className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      {channels.find((ch) => ch.id === config.channelId)?.name}
                    </span>
                  ) : (
                    <span className="text-destructive">Kanał nie znaleziony (może został usunięty)</span>
                  )}
                </p>
              </div>
            )}

            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
              <p className="text-sm font-medium mb-2">💡 Jak to działa?</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Wybierz kanał, na którym mają się pojawiać powiadomienia</li>
                <li>Bot będzie automatycznie sprawdzać status streamerów</li>
                <li>Gdy streamer rozpocznie stream, pojawi się powiadomienie</li>
                <li>Aby dodać streamerów do śledzenia, użyj sekcji poniżej</li>
              </ul>
            </div>

            <Button 
              onClick={handleSave} 
              disabled={saving || !selectedChannelId}
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

        {/* Streamers Management Card */}
        <SlideIn direction="up" delay={200}>
        <Card
          className="backdrop-blur mt-6"
          style={{
            backgroundColor: 'rgba(189, 189, 189, .05)',
            boxShadow: '0 0 10px #00000026',
            border: '1px solid transparent'
          }}
        >
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span>🎮</span>
              <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                Streamerzy
              </span>
            </CardTitle>
            <CardDescription>
              Zarządzaj listą streamerów Twitch dla tego serwera
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add new streamer form */}
            <div className="space-y-4 p-4 rounded-lg bg-background/50">
              <div className="space-y-2">
                <Label htmlFor="twitchChannel">
                  Kanał Twitch <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="twitchChannel"
                  placeholder="Nazwa kanału"
                  value={newTwitchChannel}
                  onChange={(e) => setNewTwitchChannel(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Nazwa kanału Twitch (bez https://twitch.tv/)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="discordUser">
                  Użytkownik Discord <span className="text-destructive">*</span>
                </Label>
                <div className="relative" ref={dropdownRef}>
                  <Input
                    id="discordUser"
                    placeholder="Wyszukaj użytkownika..."
                    value={userSearch}
                    onChange={(e) => {
                      setUserSearch(e.target.value);
                      setShowUserDropdown(true);
                      setNewUserId('');
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                  />
                  {showUserDropdown && filteredMembers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredMembers.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                          onClick={() => handleSelectUser(member.id)}
                        >
                          {member.discriminator === '0' 
                            ? member.username 
                            : `${member.username}#${member.discriminator}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Użytkownik Discord powiązany ze streamerem
                </p>
              </div>

              <Button 
                type="button" 
                onClick={handleAddStreamer}
                className="btn-gradient hover:scale-105"
              >
                <Plus className="mr-2 w-4 h-4" />
                Dodaj streamera
              </Button>
            </div>

            {/* Streamers list */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">
                Aktywni streamerzy ({streamers.length})
              </h3>
              {streamers.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/50 mb-4">
                    <MessagesSquare className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">Brak streamerów</h3>
                  <p className="text-sm text-muted-foreground">
                    Dodaj streamerów Twitch za pomocą formularza powyżej, aby otrzymywać powiadomienia o streamach.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {streamers.map((streamer, index) => (
                    <SlideIn key={streamer._id} direction="up" delay={index * 50}>
                    <div
                      className="p-3 rounded-lg bg-background/50 hover:bg-background/70 transition-colors"
                    >
                      {editingId === streamer._id ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor={`edit-channel-${streamer._id}`}>Kanał Twitch</Label>
                            <Input
                              id={`edit-channel-${streamer._id}`}
                              value={editTwitchChannel}
                              onChange={(e) => setEditTwitchChannel(e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`edit-user-${streamer._id}`}>Użytkownik Discord</Label>
                            <Select value={editUserId} onValueChange={setEditUserId}>
                              <SelectTrigger id={`edit-user-${streamer._id}`}>
                                <SelectValue placeholder="Wybierz użytkownika..." />
                              </SelectTrigger>
                              <SelectContent>
                                {members.map((member) => (
                                  <SelectItem key={member.id} value={member.id}>
                                    {member.discriminator === '0' 
                                      ? member.username 
                                      : `${member.username}#${member.discriminator}`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleEditStreamer(streamer._id)}
                              className="btn-gradient hover:scale-105"
                            >
                              <Save className="mr-1 h-3 w-3" />
                              Zapisz
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(null);
                                setEditTwitchChannel('');
                                setEditUserId('');
                              }}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Anuluj
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">twitch.tv/{streamer.twitchChannel}</span>
                              {streamer.isLive && (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-500 text-white">
                                  🔴 LIVE
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Użytkownik: <span className="font-medium">{getMemberDisplay(streamer.userId)}</span>
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(streamer._id);
                                setEditTwitchChannel(streamer.twitchChannel);
                                setEditUserId(streamer.userId);
                              }}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteStreamer(streamer._id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    </SlideIn>
                  ))}
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