"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { CreditCard, ExternalLink, ArrowUpRight, Building2 } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { PLAN_LIMITS } from "@/lib/types/database";
import type { PlanTier } from "@/lib/types/database";
import { toast } from "sonner";
import Link from "next/link";
import { ContactSalesDialog } from "@/components/marketing/contact-sales-dialog";

const PLAN_PRICES: Record<string, string> = {
  starter: "$99/mo",
  growth: "$249/mo",
  pro: "$449/mo",
  scale: "$749/mo",
};

export default function BillingPage() {
  const { org, role, loading: userLoading } = useUser();
  const [portalLoading, setPortalLoading] = useState(false);

  const isOwner = role === "owner";
  const planTier = (org?.plan_tier || "starter") as PlanTier;
  const limits = PLAN_LIMITS[planTier] ?? PLAN_LIMITS.starter;
  const vendorLimit = limits.vendors;
  const teamLimit = limits.teamMembers;
  const vendorCount = org?.vendor_count || 0;
  const usagePercent = vendorLimit > 0 ? Math.min((vendorCount / vendorLimit) * 100, 100) : 0;

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      if (!res.ok) throw new Error("Failed to open billing portal");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error("Failed to open billing portal. Stripe may not be configured.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-6" data-testid="billing-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-5" />
            Current Plan
          </CardTitle>
          <CardDescription>Your organization&apos;s subscription details</CardDescription>
        </CardHeader>
        <CardContent>
          {userLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : !org ? (
            <div className="text-center py-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Unable to load organization details. Please try refreshing the page.
              </p>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                Refresh
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold capitalize">{planTier}</span>
                <Badge variant="secondary" className="capitalize">
                  {org.subscription_status || "trialing"}
                </Badge>
                {PLAN_PRICES[planTier] && (
                  <span className="text-sm text-muted-foreground">{PLAN_PRICES[planTier]}</span>
                )}
              </div>

              {/* Usage */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vendor Usage</span>
                  <span className="font-medium">
                    {vendorCount} / {vendorLimit >= 9999 ? "Unlimited" : vendorLimit}
                  </span>
                </div>
                <Progress value={usagePercent} className="h-2" />
              </div>

              {org.trial_ends_at && org.subscription_status === "trialing" && (
                <p className="text-sm text-muted-foreground">
                  Trial ends on{" "}
                  <span className="font-medium text-foreground">
                    {new Date(org.trial_ends_at).toLocaleDateString("en-US")}
                  </span>
                </p>
              )}

              {isOwner && (
                <div className="flex flex-wrap gap-3 pt-2">
                  <Button onClick={openPortal} disabled={portalLoading} variant="outline">
                    <ExternalLink className="size-4 mr-2" />
                    {portalLoading ? "Opening..." : "Manage Billing"}
                  </Button>
                  {planTier !== "scale" && (
                    <Button asChild>
                      <Link href="/pricing">
                        <ArrowUpRight className="size-4 mr-2" />
                        Upgrade Plan
                      </Link>
                    </Button>
                  )}
                  {planTier === "scale" && (
                    <ContactSalesDialog>
                      <Button variant="outline">
                        <Building2 className="size-4 mr-2" />
                        Contact Sales
                      </Button>
                    </ContactSalesDialog>
                  )}
                </div>
              )}

              {!isOwner && (
                <p className="text-sm text-muted-foreground">
                  Only the organization owner can manage billing. Contact your admin to upgrade.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Features */}
      {org && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Vendors</span>
                <span className="font-medium">{vendorLimit >= 9999 ? "Unlimited" : `Up to ${vendorLimit}`}</span>
              </div>
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Team Members</span>
                <span className="font-medium">
                  {teamLimit === Infinity ? "Unlimited" : `Up to ${teamLimit}`}
                </span>
              </div>
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Vendor Portal</span>
                <span className="font-medium">{planTier === "pro" || planTier === "scale" ? "Included" : "Pro+"}</span>
              </div>
              <div className="flex justify-between rounded-lg border p-3">
                <span className="text-muted-foreground">Analytics</span>
                <span className="font-medium">{planTier === "pro" || planTier === "scale" ? "Included" : "Pro+"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
