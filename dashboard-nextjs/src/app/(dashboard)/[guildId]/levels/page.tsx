"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, ArrowLeft, TrendingUp, Hash, Trophy, Plus, Trash2, Award, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import VariableInserter from "@/components/VariableInserter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

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

interface RoleReward {
  level: number;
  roleId: string;
  rewardMessage?: string;
}

interface ChannelMultiplier {
  channelId: string;
  multiplier: number;
}

interface RoleMultiplier {
  roleId: string;
  multiplier: number;
}

interface LevelConfig {
  guildId: string;
  enabled?: boolean;
  xpPerMsg: number;
  xpPerMinVc: number;
  cooldownSec: number;
  notifyChannelId?: string;
  enableLevelUpMessages: boolean;
  levelUpMessage: string;
  rewardMessage: string;
  roleRewards: RoleReward[];
  roleMultipliers: RoleMultiplier[];
  ignoredChannels: string[];
  ignoredRoles: string[];
}

interface LeaderboardUser {
  userId: string;
  level: number;
  xp: number;
}

interface GuildMember {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
}

export default function LevelsPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<GuildMember[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  
  const [config, setConfig] = useState<LevelConfig>({
    guildId,
    enabled: false,
    xpPerMsg: 5,
    xpPerMinVc: 10,
    cooldownSec: 0,
    enableLevelUpMessages: false,
    levelUpMessage: '{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏',
    rewardMessage: '{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!',
    roleRewards: [],
    roleMultipliers: [],
    ignoredChannels: [],
    ignoredRoles: [],
  });

  const [newRewardLevel, setNewRewardLevel] = useState('');
  const [newRewardRoleId, setNewRewardRoleId] = useState('');
  const [newRewardMessage, setNewRewardMessage] = useState('');
  
  const [channelMultipliers, setChannelMultipliers] = useState<ChannelMultiplier[]>([]);
  const [newMultiplierChannelId, setNewMultiplierChannelId] = useState('');
  const [newMultiplierValue, setNewMultiplierValue] = useState('1.5');
  
  const [roleMultipliers, setRoleMultipliers] = useState<RoleMultiplier[]>([]);
  const [newRoleMultiplierRoleId, setNewRoleMultiplierRoleId] = useState('');
  const [newRoleMultiplierValue, setNewRoleMultiplierValue] = useState('1.5');
  
  const [selectedIgnoredChannel, setSelectedIgnoredChannel] = useState('');
  const [selectedIgnoredRole, setSelectedIgnoredRole] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        const [channelsData, rolesData, configRes, leaderboardRes, multipliersRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
          fetchGuildData<Role[]>(guildId, 'roles', `/api/discord/guild/${guildId}/roles`),
          fetchWithAuth(`/api/guild/${guildId}/levels/config`, { next: { revalidate: 600 } }),
          fetchWithAuth(`/api/guild/${guildId}/levels/leaderboard?limit=10`, { next: { revalidate: 300 } }),
          fetchWithAuth(`/api/guild/${guildId}/levels/channel-multipliers`, { next: { revalidate: 600 } }),
        ]);

        if (channelsData) {
          setChannels(channelsData);
        }

        if (rolesData) {
          setRoles(rolesData);
        }

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
          if (configData.roleMultipliers) {
            setRoleMultipliers(configData.roleMultipliers);
          }
        }

        if (leaderboardRes.ok) {
          const leaderboardData = await leaderboardRes.json();
          setLeaderboard(leaderboardData.users || []);
        }
        
        if (multipliersRes.ok) {
          const multipliersData = await multipliersRes.json();
          setChannelMultipliers(multipliersData);
        }
        
        setLoading(false);

        fetchGuildData<GuildMember[]>(guildId, 'members', `/api/discord/guild/${guildId}/members`)
          .then(membersData => {
            if (membersData) {
              setMembers(membersData);
            }
          })
          .catch(err => console.error('Failed to load members:', err));

      } catch (error) {
        console.error("Error loading levels data:", error);
        setError("Nie udało się załadować danych systemu poziomów. Sprawdź połączenie z internetem i spróbuj ponownie.");
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

      const response = await fetch(`/api/guild/${guildId}/levels/config`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      toast.success("Konfiguracja została zapisana!");
    } catch (error) {
      console.error("Error saving config:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const addRoleReward = () => {
    const level = parseInt(newRewardLevel);
    if (!level || level < 1 || !newRewardRoleId) {
      toast.error("Podaj poprawny poziom (min. 1) i wybierz rolę");
      return;
    }

    if (config.roleRewards.some(r => r.level === level)) {
      toast.error("Nagroda za ten poziom już istnieje");
      return;
    }

    setConfig({
      ...config,
      roleRewards: [
        ...config.roleRewards,
        {
          level,
          roleId: newRewardRoleId,
          rewardMessage: newRewardMessage || undefined,
        },
      ].sort((a, b) => a.level - b.level),
    });

    setNewRewardLevel('');
    setNewRewardRoleId('');
    setNewRewardMessage('');
    toast.success("Dodano nagrodę!");
  };

  const removeRoleReward = (level: number) => {
    setConfig({
      ...config,
      roleRewards: config.roleRewards.filter(r => r.level !== level),
    });
    toast.success("Usunięto nagrodę!");
  };

  const handleAddMultiplier = async () => {
    if (!newMultiplierChannelId) {
      toast.error("Wybierz kanał");
      return;
    }

    const multiplierValue = parseFloat(newMultiplierValue);
    if (isNaN(multiplierValue) || multiplierValue < 0.1 || multiplierValue > 10) {
      toast.error("Mnożnik musi być liczbą między 0.1 a 10");
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`/api/guild/${guildId}/levels/channel-multipliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: newMultiplierChannelId, multiplier: multiplierValue }),
      });

      if (!response.ok) {
        throw new Error("Failed to add multiplier");
      }

      const existingIndex = channelMultipliers.findIndex(m => m.channelId === newMultiplierChannelId);
      if (existingIndex >= 0) {
        const updated = [...channelMultipliers];
        updated[existingIndex].multiplier = multiplierValue;
        setChannelMultipliers(updated);
      } else {
        setChannelMultipliers([...channelMultipliers, { channelId: newMultiplierChannelId, multiplier: multiplierValue }]);
      }

      setNewMultiplierChannelId("");
      setNewMultiplierValue("1.5");
      toast.success("Mnożnik został dodany!");
    } catch (error) {
      console.error("Error adding multiplier:", error);
      toast.error("Nie udało się dodać mnożnika");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMultiplier = async (channelId: string) => {
    try {
      const response = await fetch(`/api/guild/${guildId}/levels/channel-multipliers?channelId=${channelId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete multiplier");
      }

      setChannelMultipliers(channelMultipliers.filter(m => m.channelId !== channelId));
      toast.success("Mnożnik został usunięty!");
    } catch (error) {
      console.error("Error deleting multiplier:", error);
      toast.error("Nie udało się usunąć mnożnika");
    }
  };

  const handleAddRoleMultiplier = () => {
    if (!newRoleMultiplierRoleId) {
      toast.error("Wybierz rolę");
      return;
    }

    const multiplierValue = parseFloat(newRoleMultiplierValue);
    if (isNaN(multiplierValue) || multiplierValue < 0.1 || multiplierValue > 10) {
      toast.error("Mnożnik musi być liczbą między 0.1 a 10");
      return;
    }

    const existingIndex = roleMultipliers.findIndex(m => m.roleId === newRoleMultiplierRoleId);
    if (existingIndex >= 0) {
      const updated = [...roleMultipliers];
      updated[existingIndex].multiplier = multiplierValue;
      setRoleMultipliers(updated);
      setConfig({ ...config, roleMultipliers: updated });
    } else {
      const updated = [...roleMultipliers, { roleId: newRoleMultiplierRoleId, multiplier: multiplierValue }];
      setRoleMultipliers(updated);
      setConfig({ ...config, roleMultipliers: updated });
    }

    setNewRoleMultiplierRoleId("");
    setNewRoleMultiplierValue("1.5");
    toast.success("Mnożnik roli został dodany!");
  };

  const handleDeleteRoleMultiplier = (roleId: string) => {
    const updated = roleMultipliers.filter(m => m.roleId !== roleId);
    setRoleMultipliers(updated);
    setConfig({ ...config, roleMultipliers: updated });
    toast.success("Mnożnik roli został usunięty!");
  };

  const handleAddIgnoredChannel = () => {
    if (!selectedIgnoredChannel) {
      toast.error("Wybierz kanał");
      return;
    }
    if (config.ignoredChannels.includes(selectedIgnoredChannel)) {
      toast.error("Ten kanał jest już ignorowany");
      return;
    }
    setConfig({ ...config, ignoredChannels: [...config.ignoredChannels, selectedIgnoredChannel] });
    setSelectedIgnoredChannel('');
    toast.success("Kanał został dodany do listy ignorowanych!");
  };

  const handleRemoveIgnoredChannel = (channelId: string) => {
    setConfig({ ...config, ignoredChannels: config.ignoredChannels.filter(id => id !== channelId) });
    toast.success("Kanał został usunięty z listy ignorowanych!");
  };

  const handleAddIgnoredRole = () => {
    if (!selectedIgnoredRole) {
      toast.error("Wybierz rolę");
      return;
    }
    if (config.ignoredRoles.includes(selectedIgnoredRole)) {
      toast.error("Ta rola jest już ignorowana");
      return;
    }
    setConfig({ ...config, ignoredRoles: [...config.ignoredRoles, selectedIgnoredRole] });
    setSelectedIgnoredRole('');
    toast.success("Rola została dodana do listy ignorowanych!");
  };

  const handleRemoveIgnoredRole = (roleId: string) => {
    setConfig({ ...config, ignoredRoles: config.ignoredRoles.filter(id => id !== roleId) });
    toast.success("Rola została usunięta z listy ignorowanych!");
  };

  const getChannelName = (channelId: string) => {
    return channels.find(c => c.id === channelId)?.name || 'Nieznany kanał';
  };

  const getRoleName = (roleId: string) => {
    return roles.find(r => r.id === roleId)?.name || 'Nieznana rola';
  };

  const getRoleColor = (color: number) => {
    if (color === 0) return '#99AAB5';
    return `#${color.toString(16).padStart(6, '0')}`;
  };

  const getMemberDisplay = (userId: string) => {
    const member = members.find(m => m.id === userId);
    if (member) {
      return member.discriminator === '0' 
        ? member.username 
        : `${member.username}#${member.discriminator}`;
    }
    return `User ${userId.slice(0, 8)}`;
  };

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="w-full">
          <ErrorState
            title="Błąd ładowania danych"
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
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="backdrop-blur">
                <CardHeader>
                  <Skeleton className="h-8 w-64 mb-2" />
                  <Skeleton className="h-4 w-96" />
                </CardHeader>
                <CardContent className="space-y-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
            
            <div>
              <Card className="backdrop-blur">
                <CardHeader>
                  <Skeleton className="h-7 w-32" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="w-full">


        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Config Card */}
            <SlideIn direction="up" delay={100}>
              <Card className="backdrop-blur" style={{
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-bot-primary" />
                      <span className="text-white/90">
                        Konfiguracja Systemu Poziomów
                      </span>
                    </CardTitle>
                    <Switch
                      checked={config.enabled ?? false}
                      onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                      className="data-[state=checked]:bg-bot-primary"
                      style={{ transform: 'scale(1.5)' }}
                    />
                  </div>
                  <CardDescription>
                    Ustaw nagrody za XP i poziomy dla aktywnych członków
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* XP Settings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="xpPerMsg">XP za wiadomość</Label>
                      <Input
                        id="xpPerMsg"
                        type="number"
                        min="0"
                        value={config.xpPerMsg}
                        onChange={(e) => setConfig({ ...config, xpPerMsg: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Ile XP dostaje użytkownik za każdą wiadomość
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="xpPerMinVc">XP za minutę na VC</Label>
                      <Input
                        id="xpPerMinVc"
                        type="number"
                        min="0"
                        value={config.xpPerMinVc}
                        onChange={(e) => setConfig({ ...config, xpPerMinVc: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Ile XP za minutę spędzoną na kanale głosowym
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cooldownSec">Cooldown (sekundy)</Label>
                      <Input
                        id="cooldownSec"
                        type="number"
                        min="0"
                        value={config.cooldownSec}
                        onChange={(e) => setConfig({ ...config, cooldownSec: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Minimalna przerwa między zdobywaniem XP z wiadomości
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notifyChannel">Kanał powiadomień</Label>
                      <Select
                        value={config.notifyChannelId || "none"}
                        onValueChange={(value) => setConfig({ ...config, notifyChannelId: value === "none" ? undefined : value })}
                      >
                        <SelectTrigger id="notifyChannel">
                          <SelectValue placeholder="Brak (DM)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Brak (wiadomość prywatna)</SelectItem>
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
                        Gdzie wysyłać powiadomienia o awansie
                      </p>
                    </div>
                  </div>

                  {/* Level Up Messages */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-background/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="enableLevelUpMessages" className="text-base font-medium">
                          Wiadomości o awansie
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Wysyłaj powiadomienie gdy użytkownik zdobędzie poziom
                        </p>
                      </div>
                      <Switch
                        id="enableLevelUpMessages"
                        checked={config.enableLevelUpMessages}
                        onCheckedChange={(checked) => setConfig({ ...config, enableLevelUpMessages: checked })}
                        className="data-[state=checked]:bg-bot-primary"
                      />
                    </div>

                    {config.enableLevelUpMessages && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="levelUpMessage">Wiadomość o poziomie</Label>
                          <VariableInserter
                            value={config.levelUpMessage}
                            onChange={(value) => setConfig({ ...config, levelUpMessage: value })}
                            variables={[
                              { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
                              { name: "Poziom", display: "Poziom", value: "{level}", description: "Numer poziomu" },
                            ]}
                            rows={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="rewardMessage">Wiadomość o nagrodzie</Label>
                          <VariableInserter
                            value={config.rewardMessage}
                            onChange={(value) => setConfig({ ...config, rewardMessage: value })}
                            variables={[
                              { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
                              { name: "Rola", display: "Rola", value: "{roleId}", description: "Wzmianka roli nagrody" },
                            ]}
                            rows={2}
                          />
                        </div>
                      </>
                    )}
                  </div>

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

            {/* Role Rewards Card */}
            <SlideIn direction="up" delay={200}>
              <Card className="backdrop-blur" style={{
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Award className="w-5 h-5 text-bot-primary" />
                    Nagrody za poziomy
                  </CardTitle>
                  <CardDescription>
                    Przypisz role, które użytkownicy otrzymają za osiągnięcie poziomu
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" defaultValue={config.roleRewards.length > 0 ? ["rewards"] : []}>
                    <AccordionItem value="rewards">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Award className="w-4 h-4" />
                          <span>Nagrody za poziomy{config.roleRewards.length > 0 ? ` (${config.roleRewards.length})` : ''}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                      {/* Add new reward */}
                      <div className="p-4 rounded-lg bg-background/50 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="newLevel">Poziom</Label>
                              <Input
                                id="newLevel"
                                type="number"
                                min="1"
                                placeholder="10"
                                value={newRewardLevel}
                                onChange={(e) => setNewRewardLevel(e.target.value)}
                              />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                              <Label htmlFor="newRole">Rola nagrody</Label>
                              <Select value={newRewardRoleId} onValueChange={setNewRewardRoleId}>
                                <SelectTrigger id="newRole">
                                  <SelectValue placeholder="Wybierz rolę..." />
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
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="newRewardMessage">Wiadomość (opcjonalna)</Label>
                            <Input
                              id="newRewardMessage"
                              placeholder="Gratulacje! Zdobyłeś specjalną rolę!"
                              value={newRewardMessage}
                              onChange={(e) => setNewRewardMessage(e.target.value)}
                            />
                          </div>

                          <Button 
                            onClick={addRoleReward}
                            variant="outline"
                            className="w-full"
                          >
                            <Plus className="mr-2 w-4 h-4" />
                            Dodaj nagrodę
                          </Button>
                        </div>

                        {/* Existing rewards */}
                        {config.roleRewards.length === 0 ? (
                          <div className="text-center py-8 px-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                              <Award className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium mb-1">Brak nagród</h3>
                            <p className="text-sm text-muted-foreground">
                              Dodaj nagrody za osiągnięcie poziomów
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {config.roleRewards.map((reward, index) => (
                              <div key={reward.level} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border hover:bg-background/70 hover:shadow-lg hover:shadow-bot-primary/15 hover:scale-[1.02] hover:border-bot-primary/30 transition-all duration-300">
                                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-bot-primary/10 text-bot-primary font-bold">
                                  {reward.level}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div 
                                      className="w-3 h-3 rounded-full flex-shrink-0" 
                                      style={{ 
                                        backgroundColor: getRoleColor(
                                          roles.find(r => r.id === reward.roleId)?.color || 0
                                        ) 
                                      }}
                                    />
                                    <span className="font-medium truncate">{getRoleName(reward.roleId)}</span>
                                  </div>
                                  {reward.rewardMessage && (
                                    <p className="text-sm text-muted-foreground truncate">
                                      {reward.rewardMessage}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeRoleReward(reward.level)}
                                  className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </SlideIn>

            {/* Channel Multipliers Card */}
            <SlideIn direction="up" delay={300}>
              <Card className="backdrop-blur" style={{
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Hash className="w-5 h-5 text-bot-primary" />
                    Mnożniki XP dla Kanałów
                  </CardTitle>
                  <CardDescription>
                    Ustaw niestandardowe mnożniki XP dla wybranych kanałów (0.1x - 10x)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" defaultValue={channelMultipliers.length > 0 ? ["channel-multipliers"] : []}>
                    <AccordionItem value="channel-multipliers">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          <span>Mnożniki XP - Kanały{channelMultipliers.length > 0 ? ` (${channelMultipliers.length})` : ''}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                      {/* Add new multiplier */}
                      <div className="p-4 rounded-lg bg-background/50 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="newMultiplierChannel">Kanał</Label>
                              <Select value={newMultiplierChannelId} onValueChange={setNewMultiplierChannelId}>
                                <SelectTrigger id="newMultiplierChannel">
                                  <SelectValue placeholder="Wybierz kanał..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {channels
                                    .filter(ch => ch.type === 0 || ch.type === 5)
                                    .map((channel) => (
                                      <SelectItem key={channel.id} value={channel.id}>
                                        # {channel.name}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="newMultiplierValue">Mnożnik</Label>
                              <Input
                                id="newMultiplierValue"
                                type="number"
                                min="0.1"
                                max="10"
                                step="0.1"
                                placeholder="1.5"
                                value={newMultiplierValue}
                                onChange={(e) => setNewMultiplierValue(e.target.value)}
                              />
                            </div>
                          </div>

                          <Button 
                            onClick={handleAddMultiplier}
                            variant="outline"
                            className="w-full"
                            disabled={saving}
                          >
                            <Plus className="mr-2 w-4 h-4" />
                            Dodaj mnożnik
                          </Button>
                        </div>

                        {/* Existing multipliers */}
                        {channelMultipliers.length === 0 ? (
                          <div className="text-center py-8 px-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                              <Hash className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium mb-1">Brak mnożników</h3>
                            <p className="text-sm text-muted-foreground">
                              Dodaj mnożniki XP dla kanałów
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {channelMultipliers.map((multiplier, index) => (
                              <div key={multiplier.channelId} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border hover:bg-background/70 hover:shadow-lg hover:shadow-bot-primary/15 hover:scale-[1.02] hover:border-bot-primary/30 transition-all duration-300">
                                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-bot-primary/10 text-bot-primary font-bold text-sm">
                                  {multiplier.multiplier}x
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <span className="font-medium truncate">{getChannelName(multiplier.channelId)}</span>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteMultiplier(multiplier.channelId)}
                                  className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </SlideIn>

            {/* Role Multipliers Card */}
            <SlideIn direction="up" delay={350}>
              <Card className="backdrop-blur" style={{
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Users className="w-5 h-5 text-bot-primary" />
                    Mnożniki XP dla Ról
                  </CardTitle>
                  <CardDescription>
                    Ustaw niestandardowe mnożniki XP dla wybranych ról (0.1x - 10x). Użytkownik otrzymuje najwyższy mnożnik z posiadanych ról.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" defaultValue={roleMultipliers.length > 0 ? ["role-multipliers"] : []}>
                    <AccordionItem value="role-multipliers">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Mnożniki XP - Role{roleMultipliers.length > 0 ? ` (${roleMultipliers.length})` : ''}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                      {/* Add new role multiplier */}
                      <div className="p-4 rounded-lg bg-background/50 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="newRoleMultiplierRole">Rola</Label>
                              <Select value={newRoleMultiplierRoleId} onValueChange={setNewRoleMultiplierRoleId}>
                                <SelectTrigger id="newRoleMultiplierRole">
                                  <SelectValue placeholder="Wybierz rolę..." />
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
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="newRoleMultiplierValue">Mnożnik</Label>
                              <Input
                                id="newRoleMultiplierValue"
                                type="number"
                                min="0.1"
                                max="10"
                                step="0.1"
                                placeholder="1.5"
                                value={newRoleMultiplierValue}
                                onChange={(e) => setNewRoleMultiplierValue(e.target.value)}
                              />
                            </div>
                          </div>

                          <Button 
                            onClick={handleAddRoleMultiplier}
                            variant="outline"
                            className="w-full"
                          >
                            <Plus className="mr-2 w-4 h-4" />
                            Dodaj mnożnik roli
                          </Button>
                        </div>

                        {/* Existing role multipliers */}
                        {roleMultipliers.length === 0 ? (
                          <div className="text-center py-8 px-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                              <Users className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <h3 className="font-medium mb-1">Brak mnożników dla ról</h3>
                            <p className="text-sm text-muted-foreground">
                              Dodaj mnożniki XP dla ról
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {roleMultipliers.map((multiplier, index) => (
                              <div key={multiplier.roleId} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border hover:bg-background/70 hover:shadow-lg hover:shadow-bot-primary/15 hover:scale-[1.02] hover:border-bot-primary/30 transition-all duration-300">
                                <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-bot-primary/10 text-bot-primary font-bold text-sm">
                                  {multiplier.multiplier}x
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-3 h-3 rounded-full flex-shrink-0" 
                                      style={{ 
                                        backgroundColor: getRoleColor(
                                          roles.find(r => r.id === multiplier.roleId)?.color || 0
                                        ) 
                                      }}
                                    />
                                    <span className="font-medium truncate">{getRoleName(multiplier.roleId)}</span>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteRoleMultiplier(multiplier.roleId)}
                                  className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </SlideIn>

            {/* Ignored Channels Card */}
            <SlideIn direction="up" delay={400}>
              <Card className="backdrop-blur" style={{
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Hash className="w-5 h-5 text-red-500" />
                    Ignorowane Kanały
                  </CardTitle>
                  <CardDescription>
                    Użytkownicy nie będą zdobywać XP za wiadomości na tych kanałach
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" defaultValue={config.ignoredChannels.length > 0 ? ["ignored-channels"] : []}>
                    <AccordionItem value="ignored-channels">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4" />
                          <span>Ignorowane kanały{config.ignoredChannels.length > 0 ? ` (${config.ignoredChannels.length})` : ''}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                      {/* Add ignored channel */}
                      <div className="p-4 rounded-lg bg-background/50 space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="selectIgnoredChannel">Wybierz kanał</Label>
                            <Select value={selectedIgnoredChannel} onValueChange={setSelectedIgnoredChannel}>
                              <SelectTrigger id="selectIgnoredChannel">
                                <SelectValue placeholder="Wybierz kanał..." />
                              </SelectTrigger>
                              <SelectContent>
                                {channels
                                  .filter(ch => (ch.type === 0 || ch.type === 5) && !config.ignoredChannels.includes(ch.id))
                                  .map((channel) => (
                                    <SelectItem key={channel.id} value={channel.id}>
                                      # {channel.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <Button 
                            onClick={handleAddIgnoredChannel}
                            variant="outline"
                            className="w-full"
                          >
                            <Plus className="mr-2 w-4 h-4" />
                            Dodaj kanał do ignorowanych
                          </Button>
                        </div>

                        {/* List of ignored channels */}
                        {config.ignoredChannels.length === 0 ? (
                          <div className="text-center py-8 px-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                              <Hash className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Brak ignorowanych kanałów
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {config.ignoredChannels.map((channelId, index) => (
                              <div key={channelId} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border hover:bg-background/70 hover:shadow-lg hover:shadow-red-500/15 hover:scale-[1.02] hover:border-red-500/30 transition-all duration-300">
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <span className="font-medium truncate">{getChannelName(channelId)}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveIgnoredChannel(channelId)}
                                  className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </SlideIn>

            {/* Ignored Roles Card */}
            <SlideIn direction="up" delay={450}>
              <Card className="backdrop-blur" style={{
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Users className="w-5 h-5 text-red-500" />
                    Ignorowane Role
                  </CardTitle>
                  <CardDescription>
                    Użytkownicy z tymi rolami nie będą zdobywać XP
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" defaultValue={config.ignoredRoles.length > 0 ? ["ignored-roles"] : []}>
                    <AccordionItem value="ignored-roles">
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Ignorowane role{config.ignoredRoles.length > 0 ? ` (${config.ignoredRoles.length})` : ''}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-4 pt-4">
                      {/* Add ignored role */}
                      <div className="p-4 rounded-lg bg-background/50 space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="selectIgnoredRole">Wybierz rolę</Label>
                            <Select value={selectedIgnoredRole} onValueChange={setSelectedIgnoredRole}>
                              <SelectTrigger id="selectIgnoredRole">
                                <SelectValue placeholder="Wybierz rolę..." />
                              </SelectTrigger>
                              <SelectContent>
                                {roles
                                  .filter(role => !config.ignoredRoles.includes(role.id))
                                  .map((role) => (
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
                          </div>

                          <Button 
                            onClick={handleAddIgnoredRole}
                            variant="outline"
                            className="w-full"
                          >
                            <Plus className="mr-2 w-4 h-4" />
                            Dodaj rolę do ignorowanych
                          </Button>
                        </div>

                        {/* List of ignored roles */}
                        {config.ignoredRoles.length === 0 ? (
                          <div className="text-center py-8 px-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                              <Users className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Brak ignorowanych ról
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {config.ignoredRoles.map((roleId, index) => (
                              <div key={roleId} className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border hover:bg-background/70 hover:shadow-lg hover:shadow-red-500/15 hover:scale-[1.02] hover:border-red-500/30 transition-all duration-300">
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                  <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0" 
                                    style={{ 
                                      backgroundColor: getRoleColor(
                                        roles.find(r => r.id === roleId)?.color || 0
                                      ) 
                                    }}
                                  />
                                  <span className="font-medium truncate">{getRoleName(roleId)}</span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveIgnoredRole(roleId)}
                                  className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </SlideIn>
          </div>

          {/* Leaderboard Sidebar */}
          <div>
            <SlideIn direction="up" delay={300}>
              <Card className="backdrop-blur sticky top-4" style={{
                boxShadow: '0 0 10px #00000026',
                border: '1px solid transparent'
              }}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Top 10 Ranking
                  </CardTitle>
                  <CardDescription>Najbardziej aktywni użytkownicy</CardDescription>
                </CardHeader>
                <CardContent>
                  {leaderboard.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                        <Users className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Brak danych rankingowych
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 overflow-hidden">
                      {leaderboard.map((user, index) => (
                        <SlideIn key={user.userId} direction="up" delay={index * 30}>
                          <div className={`flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-transparent hover:bg-background/70 hover:shadow-lg hover:shadow-bot-primary/15 transition-all duration-300 ${
                            index < 3 ? 'hover:border-yellow-500/30' : 'hover:border-bot-primary/30'
                          }`}>
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                              index === 0 ? 'bg-yellow-500 text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              index === 2 ? 'bg-orange-600 text-white' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              #{index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">
                                {getMemberDisplay(user.userId)}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <TrendingUp className="w-3 h-3" />
                                  Lvl {user.level}
                                </span>
                                <span>•</span>
                                <span>{user.xp.toLocaleString()} XP</span>
                              </div>
                            </div>
                          </div>
                        </SlideIn>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </SlideIn>
          </div>
        </div>
      </div>
    </div>
  );
}
