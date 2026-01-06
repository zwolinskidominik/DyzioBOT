"use client";

import { useParams, useRouter } from "next/navigation";
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
import { Loader2, Save, ArrowLeft, Hash, Crown, Trash2, Edit, Calendar, Pencil, Cake } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchGuildData } from "@/lib/cache";
import VariableInserter from "@/components/VariableInserter";

const MONTH_NAMES = [
  "Stycznia", "Lutego", "Marca", "Kwietnia", "Maja", "Czerwca",
  "Lipca", "Sierpnia", "Września", "Października", "Listopada", "Grudnia"
];

const MONTHS = [
  { value: "1", label: "Styczeń" },
  { value: "2", label: "Luty" },
  { value: "3", label: "Marzec" },
  { value: "4", label: "Kwiecień" },
  { value: "5", label: "Maj" },
  { value: "6", label: "Czerwiec" },
  { value: "7", label: "Lipiec" },
  { value: "8", label: "Sierpień" },
  { value: "9", label: "Wrzesień" },
  { value: "10", label: "Październik" },
  { value: "11", label: "Listopad" },
  { value: "12", label: "Grudzień" },
];

const birthdaySchema = z.object({
  birthdayChannelId: z.string().min(1, "Wybierz kanał urodzinowy"),
  roleId: z.string().optional(),
  message: z.string().min(1, "Wpisz wiadomość urodzinową"),
  enabled: z.boolean().default(false),
});

type BirthdayFormData = z.infer<typeof birthdaySchema>;

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

interface UserBirthday {
  _id: string;
  userId: string;
  guildId: string;
  date: string;
  yearSpecified?: boolean;
  active?: boolean;
  username?: string;
  discriminator?: string;
  avatar?: string;
}

export default function BirthdaysPage() {
  const params = useParams();
  const router = useRouter();
  const guildId = params.guildId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [birthdays, setBirthdays] = useState<UserBirthday[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<any[]>([]);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDay, setEditDay] = useState("");
  const [editMonth, setEditMonth] = useState("");
  const [editYear, setEditYear] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BirthdayFormData>({
    resolver: zodResolver(birthdaySchema),
    defaultValues: {
      birthdayChannelId: "",
      roleId: "",
      message: "🎉 Wszystkiego najlepszego z okazji urodzin, {user}! 🎂",
      enabled: false,
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [channelsData, rolesData, birthdaysRes, configRes] = await Promise.all([
          fetchGuildData<Channel[]>(guildId, 'channels', `/api/discord/guild/${guildId}/channels`),
          fetchGuildData<Role[]>(guildId, 'roles', `/api/discord/guild/${guildId}/roles`),
          fetch(`/api/guild/${guildId}/birthdays/users`),
          fetch(`/api/guild/${guildId}/birthdays`)
        ]);

        setChannels(channelsData.filter((ch: Channel) => ch.type === 0 || ch.type === 5));
        setRoles(rolesData);

        if (birthdaysRes.ok) {
          const birthdaysData = await birthdaysRes.json();
          setBirthdays(birthdaysData);
        }

        if (configRes.ok) {
          const config = await configRes.json();
          if (config && config.birthdayChannelId) {
            reset({
              birthdayChannelId: config.birthdayChannelId,
              roleId: config.roleId || "",
              message: config.message || "🎉 Wszystkiego najlepszego z okazji urodzin, {user}! 🎂",
              enabled: config.enabled !== undefined ? config.enabled : false,
            });
          }
        }

        fetch(`/api/guild/${guildId}/birthdays/upcoming`)
          .then(res => res.ok ? res.json() : [])
          .then(data => setUpcomingBirthdays(data))
          .catch(err => console.error('Failed to load upcoming birthdays:', err));
      } catch (error) {
        console.error('Error loading birthdays data:', error);
        setError("Nie udało się załadować danych urodzin. Sprawdź połączenie z internetem i spróbuj ponownie.");
        toast.error("Nie udało się załadować danych");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId, reset]);

  const onSubmit = async (data: BirthdayFormData) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/guild/${guildId}/birthdays`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to save configuration");
      }

      const result = await response.json();
      console.log("Saved result:", result);
      toast.success("Konfiguracja urodzin została zapisana!");
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Nie udało się zapisać konfiguracji");
    } finally {
      setSaving(false);
    }
  };

  const handleEditBirthday = async (userId: string) => {
    const day = parseInt(editDay);
    const month = parseInt(editMonth);
    const year = editYear ? parseInt(editYear) : undefined;

    if (!day || !month || day < 1 || day > 31 || month < 1 || month > 12) {
      toast.error("Nieprawidłowa data");
      return;
    }

    if (year && (year < 1900 || year > new Date().getFullYear())) {
      toast.error("Nieprawidłowy rok");
      return;
    }

    try {
      const response = await fetch(`/api/guild/${guildId}/birthdays/users`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, day, month, year }),
      });

      if (!response.ok) {
        throw new Error("Failed to update birthday");
      }

      const updated = await response.json();
      setBirthdays(birthdays.map(b => 
        b.userId === userId 
          ? { ...b, date: new Date(year || 2000, month - 1, day).toISOString(), yearSpecified: !!year }
          : b
      ));
      setEditingId(null);
      setEditDay("");
      setEditMonth("");
      setEditYear("");
      toast.success("Urodziny zostały zaktualizowane!");
    } catch (error) {
      console.error("Failed to update birthday:", error);
      toast.error("Nie udało się zaktualizować urodzin");
    }
  };

  const handleDeleteBirthday = async (userId: string) => {
    if (!confirm("Czy na pewno chcesz usunąć te urodziny?")) return;

    try {
      const response = await fetch(`/api/guild/${guildId}/birthdays/users?userId=${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete birthday");
      }

      setBirthdays(birthdays.filter(b => b.userId !== userId));
      toast.success("Urodziny zostały usunięte!");
    } catch (error) {
      console.error("Failed to delete birthday:", error);
      toast.error("Nie udało się usunąć urodzin");
    }
  };

  const formatBirthday = (dateString: string, yearSpecified?: boolean) => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    const monthName = MONTHS.find(m => m.value === month.toString())?.label || month.toString();
    
    return yearSpecified 
      ? `${day} ${monthName} ${year}`
      : `${day} ${monthName}`;
  };

  const getAvatarUrl = (userId: string, avatar?: string) => {
    if (avatar) {
      return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=64`;
    }
    return `https://cdn.discordapp.com/embed/avatars/${parseInt(userId) % 5}.png`;
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    window.location.reload();
  };

  if (error) {
    return (
      <div className="min-h-screen">
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do panelu
            </Link>
          </Button>
          <ErrorState
            title="Nie udało się załadować urodzin"
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
        <div className="container mx-auto p-4 md:p-8 max-w-6xl">
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
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-32 w-full" />
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
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                    <Skeleton className="w-12 h-12 rounded-full" />
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
      <div className="container mx-auto p-4 md:p-8 max-w-6xl">
        <SlideIn direction="left">
          <Button asChild variant="outline" className="mb-6">
            <Link href={`/${guildId}`}>
              <ArrowLeft className="mr-2 w-4 h-4" />
              Powrót do panelu
            </Link>
          </Button>
        </SlideIn>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
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
                <span>🎂</span>
                <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                  Konfiguracja Urodzin
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
              Skonfiguruj system automatycznych życzeń urodzinowych dla członków serwera
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="birthdayChannelId">
                  Kanał urodzinowy <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("birthdayChannelId") || ""}
                  onValueChange={(value) => setValue("birthdayChannelId", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Wybierz kanał..." />
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
                {errors.birthdayChannelId && (
                  <p className="text-sm text-destructive">{errors.birthdayChannelId.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Kanał, na którym będą wysyłane wiadomości urodzinowe
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="roleId">Rola urodzinowa (opcjonalna)</Label>
                <div className="flex gap-2">
                  <Select
                    value={watch("roleId") || undefined}
                    onValueChange={(value) => setValue("roleId", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Brak roli" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5' }}
                            />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {watch("roleId") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setValue("roleId", "")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {errors.roleId && (
                  <p className="text-sm text-destructive">{errors.roleId.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Rola nadawana użytkownikowi w dniu urodzin (zostanie usunięta następnego dnia)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">
                  Wiadomość urodzinowa <span className="text-destructive">*</span>
                </Label>
                <VariableInserter
                  value={watch("message") || ""}
                  onChange={(value) => setValue("message", value)}
                  variables={[
                    { name: "Użytkownik", display: "Użytkownik", value: "{user}", description: "Wzmianka użytkownika" },
                  ]}
                  placeholder="🎉 Wszystkiego najlepszego z okazji urodzin, {user}! 🎂"
                  rows={4}
                />
                {errors.message && (
                  <p className="text-sm text-destructive">{errors.message.message}</p>
                )}
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

        {/* Birthdays List */}
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
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calendar className="w-6 h-6" />
              <span>Zapisane urodziny</span>
            </CardTitle>
            <CardDescription>
              Lista urodzin użytkowników na serwerze
            </CardDescription>
          </CardHeader>
          <CardContent>
            {birthdays.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mb-4">
                  <Cake className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg mb-2">Brak zapisanych urodzin</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Użytkownicy mogą ustawić swoje urodziny za pomocą komendy. Wszystkie urodziny pojawią się tutaj.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {birthdays.map((birthday, index) => {
                  const date = birthday.date ? new Date(birthday.date) : null;
                  return (
                    <SlideIn key={birthday._id} direction="up" delay={index * 50}>
                      <div
                        className="p-3 rounded-lg bg-background/50 hover:bg-background/70 transition-colors"
                      >
                      {editingId === birthday.userId ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3 mb-3">
                            <img
                              src={getAvatarUrl(birthday.userId, birthday.avatar)}
                              alt={birthday.username || "User"}
                              className="w-10 h-10 rounded-full"
                            />
                            <p className="text-sm font-medium">
                              {birthday.username || `ID: ${birthday.userId}`}
                            </p>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor={`day-${birthday.userId}`} className="text-xs">Dzień</Label>
                              <Input
                                id={`day-${birthday.userId}`}
                                type="number"
                                min="1"
                                max="31"
                                placeholder="DD"
                                value={editDay}
                                onChange={(e) => setEditDay(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`month-${birthday.userId}`} className="text-xs">Miesiąc</Label>
                              <Select
                                value={editMonth}
                                onValueChange={(value) => setEditMonth(value)}
                              >
                                <SelectTrigger id={`month-${birthday.userId}`}>
                                  <SelectValue placeholder="Wybierz miesiąc..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {MONTHS.map((month) => (
                                    <SelectItem key={month.value} value={month.value}>
                                      {month.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`year-${birthday.userId}`} className="text-xs">Rok (opcjonalny)</Label>
                              <Input
                                id={`year-${birthday.userId}`}
                                type="number"
                                min="1900"
                                max={new Date().getFullYear()}
                                placeholder="YYYY"
                                value={editYear}
                                onChange={(e) => setEditYear(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleEditBirthday(birthday.userId)}
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
                                setEditDay("");
                                setEditMonth("");
                                setEditYear("");
                              }}
                            >
                              Anuluj
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <img
                              src={getAvatarUrl(birthday.userId, birthday.avatar)}
                              alt={birthday.username || "User"}
                              className="w-10 h-10 rounded-full"
                            />
                            <div>
                              <p className="text-sm font-medium">
                                {birthday.username || `ID: ${birthday.userId}`}
                              </p>
                              <p className="text-sm font-medium text-bot-primary">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                {birthday.date 
                                  ? formatBirthday(birthday.date, birthday.yearSpecified)
                                  : "Brak daty"}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingId(birthday.userId);
                                if (date) {
                                  setEditDay(date.getDate().toString());
                                  setEditMonth((date.getMonth() + 1).toString());
                                  setEditYear(birthday.yearSpecified ? date.getFullYear().toString() : "");
                                }
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteBirthday(birthday.userId)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    </SlideIn>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </SlideIn>
        </div>

        {/* Sidebar - Upcoming Birthdays */}
        <div>
          <SlideIn direction="up" delay={300}>
            <Card className="backdrop-blur sticky top-4" style={{
              backgroundColor: 'rgba(189, 189, 189, .05)',
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cake className="w-5 h-5 text-pink-500" />
                  Nadchodzące Urodziny
                </CardTitle>
                <CardDescription>10 najbliższych urodzin</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingBirthdays.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted/50 mb-3">
                      <Cake className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Brak nadchodzących urodzin
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 overflow-hidden">
                    {upcomingBirthdays.map((birthday, index) => (
                      <SlideIn key={birthday.userId} direction="up" delay={index * 30}>
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-transparent hover:bg-background/70 hover:shadow-lg hover:shadow-pink-500/15 transition-all duration-300">
                          <img
                            src={birthday.avatar 
                              ? `https://cdn.discordapp.com/avatars/${birthday.userId}/${birthday.avatar}.png`
                              : `https://cdn.discordapp.com/embed/avatars/${parseInt(birthday.userId) % 5}.png`
                            }
                            alt={birthday.username || "User"}
                            className="w-10 h-10 rounded-full"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {birthday.username || `ID: ${birthday.userId.slice(0, 8)}`}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{birthday.day} {MONTH_NAMES[birthday.month - 1]}</span>
                              <span>•</span>
                              <span className={birthday.daysUntil === 0 ? "text-pink-500 font-semibold" : ""}>
                                {birthday.daysUntil === 0 ? "Dzisiaj! 🎉" : 
                                 birthday.daysUntil === 1 ? "Jutro" : 
                                 `Za ${birthday.daysUntil} dni`}
                              </span>
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
