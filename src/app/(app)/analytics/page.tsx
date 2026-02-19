'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ComplianceTrendChart } from '@/components/analytics/compliance-trend-chart';
import { StatusDistributionChart } from '@/components/analytics/status-distribution-chart';
import { ExpirationForecast } from '@/components/analytics/expiration-forecast';
import { NonCompliantTable } from '@/components/analytics/non-compliant-table';
import { ShieldCheck, Clock, AlertTriangle, Building2 } from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsData {
  summary: {
    totalVendors: number;
    complianceRate: number;
    green: number;
    yellow: number;
    red: number;
  };
  statusDistribution: { name: string; value: number; color: string }[];
  tradeBreakdown: { trade: string; green: number; yellow: number; red: number }[];
  trend: { month: string; complianceRate: number }[];
  expirations: { month: string; count: number }[];
  nonCompliant: {
    vendor_id: string;
    vendor_name: string;
    trade_type: string;
    reasons: string[];
    next_expiry_date: string | null;
  }[];
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/analytics/portfolio');
        if (res.ok) {
          setData(await res.json());
        } else if (res.status === 403) {
          setUpgradeNeeded(true);
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error || 'Failed to load analytics');
        }
      } catch {
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <AnalyticsSkeleton />;

  if (upgradeNeeded) {
    return (
      <div className="space-y-6" data-testid="analytics-page">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Portfolio Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Compliance overview across your entire vendor portfolio
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="size-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Portfolio Analytics requires Pro or Scale</h2>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              Upgrade your plan to access compliance trend charts, status distribution, expiration forecasts, and vendor analytics across your entire portfolio.
            </p>
            <a href="/pricing" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              View Plans
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6" data-testid="analytics-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Portfolio Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Compliance overview across your entire vendor portfolio
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="size-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{data.summary.totalVendors}</div>
              <p className="text-xs text-muted-foreground">Total Vendors</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
              <ShieldCheck className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{data.summary.complianceRate}%</div>
              <p className="text-xs text-muted-foreground">Compliance Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30">
              <Clock className="size-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{data.summary.yellow}</div>
              <p className="text-xs text-muted-foreground">Expiring Soon</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{data.summary.red}</div>
              <p className="text-xs text-muted-foreground">Non-Compliant</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceTrendChart data={data.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDistributionChart data={data.statusDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Expiration forecast */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expiration Forecast (Next 90 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ExpirationForecast data={data.expirations} />
        </CardContent>
      </Card>

      {/* Non-compliant vendors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top Non-Compliant Vendors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <NonCompliantTable vendors={data.nonCompliant} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
