"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, ArrowLeft, UserPlus, Trash2, Bot, User as UserIcon, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";

const autoRoleSchema = z.object({
  roleIds: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});

type AutoRoleFormData = z.infer<typeof autoRoleSchema>;

interface Role {
  id: string;
  name: string;
  color: number;
  position: number;
}

export default function AutoRolePage() {
  const params = useParams();
  const guildId = params.guildId as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedBotRole, setSelectedBotRole] = useState<string>("");
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<boolean>(true);

  const form = useForm<AutoRoleFormData>({
    resolver: zodResolver(autoRoleSchema),
    defaultValues: {
      roleIds: [],
      enabled: true,
    },
  });

  const { handleSubmit, setValue } = form;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Check cache for roles (1 min TTL)
        const cacheKey = `roles_${guildId}`;
        const cached = localStorage.getItem(cacheKey);
        let rolesPromise;
        
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < 60 * 1000) { // 1 minute
            rolesPromise = Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
          } else {
            rolesPromise = fetch(`/api/guild/${guildId}/roles`);
          }
        } else {
          rolesPromise = fetch(`/api/guild/${guildId}/roles`);
        }

        // Fetch data in parallel
        const [rolesRes, configRes] = await Promise.all([
          rolesPromise,
          fetch(`/api/guild/${guildId}/autoroles`)
        ]);

        if (rolesRes.ok) {
          const rolesData = await rolesRes.json();
          setRoles(rolesData);
          
          if (!cached || Date.now() - JSON.parse(cached).timestamp >= 60 * 1000) {
            localStorage.setItem(cacheKey, JSON.stringify({
              data: rolesData,
              timestamp: Date.now()
            }));
          }
        }

        if (configRes.ok) {
          const config = await configRes.json();
          if (config.roleIds && config.roleIds.length > 0) {
            setSelectedBotRole(config.roleIds[0] || "");
            setSelectedUserRoles(config.roleIds.slice(1) || []);
          }
          setEnabled(config.enabled !== undefined ? config.enabled : true);
        }
      } catch (error) {
        setError("Nie udało się załadować danych autoroles. Sprawdź połączenie z internetem i spróbuj ponownie.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guildId]);

  const onSubmit = async () => {
    setSaving(true);
    try {
      // Always put bot role first (or empty string if none selected)
      // Then user roles
      const roleIds = [
        selectedBotRole || "",
        ...selectedUserRoles
      ];

      const response = await fetch(`/api/guild/${guildId}/autoroles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roleIds, enabled }),
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

  const addUserRole = (roleId: string) => {
    if (roleId && !selectedUserRoles.includes(roleId) && roleId !== selectedBotRole) {
      setSelectedUserRoles([...selectedUserRoles, roleId]);
    }
  };

  const removeUserRole = (roleId: string) => {
    setSelectedUserRoles(selectedUserRoles.filter(id => id !== roleId));
  };

  const getRoleColor = (color: number) => {
    if (color === 0) return "#99AAB5";
    return `#${color.toString(16).padStart(6, "0")}`;
  };

  const getRoleName = (roleId: string) => {
    return roles.find(r => r.id === roleId)?.name || "Nieznana rola";
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
            title="Nie udało się załadować autoroles"
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
            className="backdrop-blur"
            style={{
              backgroundColor: 'rgba(189, 189, 189, .05)',
              boxShadow: '0 0 10px #00000026',
              border: '1px solid transparent'
            }}
          >
            <CardHeader>
              <Skeleton className="h-8 w-40 mb-2" />
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
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-10 flex-1" />
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                  <UserPlus className="w-6 h-6" />
                  <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                    Auto Role
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
                Automatyczne przypisywanie ról nowym członkom i botom
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bot Role */}
              <div className="space-y-2">
                <Label htmlFor="botRole" className="flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Rola dla botów
                </Label>
                <div className="flex gap-2">
                  <Select
                    value={selectedBotRole}
                    onValueChange={setSelectedBotRole}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {selectedBotRole ? (
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: getRoleColor(roles.find(r => r.id === selectedBotRole)?.color || 0) }}
                            />
                            {getRoleName(selectedBotRole)}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Wybierz rolę...</span>
                        )}
                      </SelectValue>
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
                  {selectedBotRole && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setSelectedBotRole("")}
                      className="shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Ta rola zostanie automatycznie przypisana nowym botom dołączającym do serwera. Pozostaw puste jeśli nie chcesz przypisywać roli botom.
                </p>
              </div>

              {/* User Roles */}
              <div className="space-y-2">
                <Label htmlFor="userRoles" className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4" />
                  Role dla użytkowników
                </Label>
                
                {/* Selected Roles List */}
                {selectedUserRoles.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {selectedUserRoles.map((roleId, index) => {
                      const role = roles.find(r => r.id === roleId);
                      if (!role) return null;
                      
                      return (
                        <SlideIn key={roleId} direction="up" delay={index * 50}>
                        <div 
                          className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border hover:bg-background/70 hover:shadow-lg hover:shadow-bot-primary/15 hover:scale-[1.02] hover:border-bot-primary/30 transition-all duration-300"
                        >
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: getRoleColor(role.color) }}
                            />
                            <span className="font-medium">{role.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUserRole(roleId)}
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

                {/* Add Role Select */}
                <div className="relative">
                  <Select
                    value=""
                    onValueChange={addUserRole}
                  >
                    <SelectTrigger className="w-full border-dashed hover:bg-accent/50">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="w-4 h-4" />
                        <span>Dodaj rolę...</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {roles
                        .filter(role => !selectedUserRoles.includes(role.id) && role.id !== selectedBotRole)
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
                <p className="text-xs text-muted-foreground">
                  Te role zostaną automatycznie przypisane nowym użytkownikom dołączającym do serwera
                </p>
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
      </div>
    </div>
  );
}
