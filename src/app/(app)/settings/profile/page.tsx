"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Shield, CreditCard } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { toast } from "sonner";
import Link from "next/link";

export default function ProfilePage() {
  const { profile, org, role, loading: userLoading } = useUser();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Profile updated");
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="profile-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Your account and organization details
        </p>
      </div>

      <div className="grid gap-6 max-w-2xl md:grid-cols-2">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
            <CardDescription>Update your name and view your account details</CardDescription>
          </CardHeader>
          <CardContent>
            {userLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile?.email || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                  />
                </div>
                <Button type="submit" disabled={saving} size="sm">
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Organization Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Organization</CardTitle>
            <CardDescription>Your organization and role details</CardDescription>
          </CardHeader>
          <CardContent>
            {userLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : org ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Building2 className="size-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Organization</p>
                    <p className="text-sm font-medium truncate">{org.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <Shield className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Your Role</p>
                    <Badge variant="secondary" className="capitalize mt-0.5">{role}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-lg border p-3">
                  <CreditCard className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="capitalize">{org.plan_tier}</Badge>
                      <Badge variant="secondary" className="capitalize text-xs">{org.subscription_status}</Badge>
                    </div>
                  </div>
                </div>
                {role === "owner" && (
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link href="/settings/billing">Manage Billing</Link>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No organization found. Please contact support.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
