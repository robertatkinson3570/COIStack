"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Shield, Lock, AlertTriangle } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";

export default function SecuritySettingsPage() {
  const { role, loading: userLoading } = useUser();
  const [mfaEnforced, setMfaEnforced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = role === "owner" || role === "admin";

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/settings/mfa");
        if (!res.ok) return;
        const data = await res.json();
        setMfaEnforced(data.mfa_enforced ?? false);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleMfa(enabled: boolean) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/mfa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfa_enforced: enabled }),
      });
      if (!res.ok) throw new Error("Failed to update");
      setMfaEnforced(enabled);
      toast.success(enabled ? "MFA enforcement enabled" : "MFA enforcement disabled");
    } catch {
      toast.error("Failed to update MFA settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="security-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Security</h1>
        <p className="text-sm text-muted-foreground">
          Manage security settings for your organization
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Multi-Factor Authentication
          </CardTitle>
          <CardDescription>
            Require all team members to use MFA when signing in
          </CardDescription>
        </CardHeader>
        <CardContent>
          {userLoading || loading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Lock className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Enforce MFA for all members</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-6">
                    When enabled, team members will be required to set up MFA on their next login.
                  </p>
                </div>
                <Switch
                  checked={mfaEnforced}
                  onCheckedChange={toggleMfa}
                  disabled={!isAdmin || saving}
                  aria-label="Toggle MFA enforcement"
                />
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={mfaEnforced ? "default" : "secondary"}>
                  {mfaEnforced ? "Enforced" : "Optional"}
                </Badge>
              </div>

              {!isAdmin && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="size-4" />
                  Only organization owners and admins can change security settings.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Shield className="size-4 shrink-0 mt-0.5 text-primary" />
              Enable MFA to protect against unauthorized access to sensitive compliance data.
            </li>
            <li className="flex items-start gap-2">
              <Shield className="size-4 shrink-0 mt-0.5 text-primary" />
              Review team member access regularly and remove inactive users.
            </li>
            <li className="flex items-start gap-2">
              <Shield className="size-4 shrink-0 mt-0.5 text-primary" />
              Use role-based access control to limit who can manage vendors and billing.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
