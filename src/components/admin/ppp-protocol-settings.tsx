'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/hooks/use-toast';
import { getPppSystemConfig, updatePppSystemConfig } from '@/lib/data.client';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function PppProtocolSettings() {
  const { toast } = useToast();
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      setLoading(true);
      try {
        const config = await getPppSystemConfig();
        if (!active) return;
        setEnabled(config.enabled);
        setDraftEnabled(config.enabled);
      } catch (error: any) {
        if (!active) return;
        toast({
          variant: 'destructive',
          title: 'PPP settings unavailable',
          description: error?.message || 'Could not load PPP configuration.',
        });
      } finally {
        if (active) setLoading(false);
      }
    }

    loadConfig();
    return () => {
      active = false;
    };
  }, [toast]);

  const dirty = draftEnabled !== enabled;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updatePppSystemConfig(draftEnabled);
      setEnabled(result.enabled);
      setDraftEnabled(result.enabled);
      if (user) {
        setUser({
          ...user,
          ppp_enabled: result.enabled,
          ppp_level: typeof user.ppp_level === 'number' ? user.ppp_level : 1,
          ppp_progress_percentage: typeof user.ppp_progress_percentage === 'number' ? user.ppp_progress_percentage : 0,
          ppp_badge: typeof user.ppp_badge === 'string' ? user.ppp_badge : 'ppp-lvl-1',
          ppp_abandonment_counter: typeof user.ppp_abandonment_counter === 'number' ? user.ppp_abandonment_counter : 0,
          ppp_lessons_passed: user.ppp_lessons_passed || { lvl1: [] },
          ppp_certified: user.ppp_certified === true,
        });
      }
      toast({
        title: `PPP ${result.enabled ? 'Enabled' : 'Disabled'}`,
        description: result.enabled
          ? `Profit Protection Protocol is now active. ${result.updatedUsers ?? 0} user profiles were updated.`
          : `Profit Protection Protocol is now hidden. ${result.updatedUsers ?? 0} user profiles were updated.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'PPP update failed',
        description: error?.message || 'Could not save PPP settings.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Profit Protection Protocol (PPP)
        </CardTitle>
        <CardDescription>
          Mastery certification system toggle. When disabled, PPP is hidden from all dashboards and PPP XP logic is paused.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size="sm" /> Loading PPP configuration...
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 rounded-md border p-4">
              <div>
                <p className="text-sm font-medium">Enable Profit Protection Protocol</p>
                <p className="text-xs text-muted-foreground">
                  Controls PPP visibility and certification progression for all users.
                </p>
              </div>
              <Switch
                checked={draftEnabled}
                onCheckedChange={setDraftEnabled}
                disabled={saving}
                aria-label="Enable Profit Protection Protocol"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="w-full sm:w-auto"
            >
              {saving ? <Spinner size="sm" /> : 'Save PPP Setting'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
