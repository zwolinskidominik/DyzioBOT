"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, ArrowLeft, Gift, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { SlideIn } from "@/components/ui/animated";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface RoleMultiplier {
  roleId: string;
  multiplier: number;
}

interface GiveawayConfig {
  guildId: string;
  enabled: boolean;
  additionalNote: string;
  roleMultipliers: RoleMultiplier[];
}

export default function GiveawayConfigPage() {
  const params = useParams();
  const guildId = params.guildId as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<any[]>([]);
  
  const [config, setConfig] = useState<GiveawayConfig>({
    guildId,
    enabled: false,
    additionalNote: '',
    roleMultipliers: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const [configResponse, rolesResponse] = await Promise.all([
          fetchWithAuth(`/api/guild/${guildId}/giveaway/config`),
          fetchWithAuth(`/api/guild/${guildId}/roles`)
        ]);
        
        if (configResponse.ok) {
          const data = await configResponse.json();
          setConfig(data);
        }

        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json();
          setRoles(rolesData);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading giveaway config:', error);
        setError('Nie udało się załadować konfiguracji giveawayów');
        setLoading(false);
      }
    };

    if (guildId) {
      fetchData();
    }
  }, [guildId]);

  const handleSave = async () => {
    try {
      setSaving(true);

      const response = await fetch(`/api/guild/${guildId}/giveaway/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error('Failed to save giveaway config');
      }

      const savedConfig = await response.json();
      setConfig(savedConfig);
      toast.success('Konfiguracja giveawayów została zapisana!');
    } catch (error) {
      console.error('Error saving giveaway config:', error);
      toast.error('Nie udało się zapisać konfiguracji giveawayów');
    } finally {
      setSaving(false);
    }
  };

  const addRoleMultiplier = () => {
    setConfig({
      ...config,
      roleMultipliers: [...config.roleMultipliers, { roleId: '', multiplier: 2 }]
    });
  };

  const removeRoleMultiplier = (index: number) => {
    const updated = config.roleMultipliers.filter((_, i) => i !== index);
    setConfig({ ...config, roleMultipliers: updated });
  };

  const updateRoleMultiplier = (index: number, field: 'roleId' | 'multiplier', value: string | number) => {
    const updated = [...config.roleMultipliers];
    updated[index] = { ...updated[index], [field]: value };
    setConfig({ ...config, roleMultipliers: updated });
  };

  const getRoleName = (roleId: string) => {
    return roles.find(r => r.id === roleId)?.name || 'Nieznana rola';
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
            title="Nie udało się załadować konfiguracji giveawayów"
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
          
          <Card className="backdrop-blur mb-6">
            <CardHeader>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </CardHeader>
            <CardContent className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-10 w-32" />
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
                  <Gift className="w-6 h-6" />
                  <span className="bg-gradient-to-r from-bot-light to-bot-primary bg-clip-text text-transparent">
                    Konfiguracja Giveawayów
                  </span>
                </CardTitle>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                  className="data-[state=checked]:bg-bot-primary"
                  style={{ transform: 'scale(1.5)' }}
                />
              </div>
              <CardDescription>
                Konfiguruj dodatkowe ustawienia dla giveawayów
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Additional Note */}
              <div className="space-y-2">
                <Label htmlFor="additionalNote">
                  Dodatkowa notatka
                </Label>
                <Textarea
                  id="additionalNote"
                  value={config.additionalNote}
                  onChange={(e) => setConfig({ ...config, additionalNote: e.target.value })}
                  placeholder="Opcjonalny tekst dodawany do każdego giveawaya..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Ten tekst będzie automatycznie dodawany na końcu każdej wiadomości giveawaya
                </p>
              </div>

              {/* Role Multipliers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mnożniki dla ról</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Użytkownicy z tymi rolami otrzymają więcej wpisów w giveawayu
                    </p>
                  </div>
                  <Button
                    onClick={addRoleMultiplier}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Dodaj mnożnik
                  </Button>
                </div>

                {config.roleMultipliers.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    Brak skonfigurowanych mnożników. Kliknij "Dodaj mnożnik" aby dodać rolę.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {config.roleMultipliers.map((multiplier, index) => (
                      <div key={index} className="flex gap-3 items-end">
                        <div className="flex-1 space-y-2">
                          <Label htmlFor={`role-${index}`} className="text-sm">Rola</Label>
                          <Select
                            value={multiplier.roleId}
                            onValueChange={(value) => updateRoleMultiplier(index, 'roleId', value)}
                          >
                            <SelectTrigger id={`role-${index}`}>
                              <SelectValue placeholder="Wybierz rolę" />
                            </SelectTrigger>
                            <SelectContent>
                              {roles
                                .filter(role => role.name !== '@everyone')
                                .map((role) => (
                                  <SelectItem key={role.id} value={role.id}>
                                    {role.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="w-32 space-y-2">
                          <Label htmlFor={`multiplier-${index}`} className="text-sm">Mnożnik</Label>
                          <Input
                            id={`multiplier-${index}`}
                            type="number"
                            min="1"
                            max="100"
                            value={multiplier.multiplier}
                            onChange={(e) => updateRoleMultiplier(index, 'multiplier', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <Button
                          onClick={() => removeRoleMultiplier(index)}
                          variant="destructive"
                          size="icon"
                          className="mb-0.5"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Multipliers Display */}
              {config.roleMultipliers.length > 0 && config.roleMultipliers.some(m => m.roleId) && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-sm font-medium mb-2">Aktywne mnożniki:</p>
                  <div className="space-y-1">
                    {config.roleMultipliers
                      .filter(m => m.roleId)
                      .map((m, i) => (
                        <div key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                          <span className="font-medium">{getRoleName(m.roleId)}</span>
                          <span>→</span>
                          <span className="text-bot-primary font-semibold">×{m.multiplier}</span>
                          <span>wpisów</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Save Button */}
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
