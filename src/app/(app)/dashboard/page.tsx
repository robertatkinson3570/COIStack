'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VendorTable, VendorRow } from '@/components/dashboard/vendor-table';
import { ReminderButton } from '@/components/dashboard/reminder-button';
import { ExportButton } from '@/components/dashboard/export-button';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { LegalDisclaimer } from '@/components/ui/legal-disclaimer';
import { ComplianceSummary } from '@/components/dashboard/compliance-summary';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 pt-6">
              <Skeleton className="size-9 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-10" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-20" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DashboardPage() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/compliance');
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error || 'Failed to load compliance data');
        setVendors([]);
        return;
      }
      if (!Array.isArray(data)) {
        toast.error('Unexpected response format');
        setVendors([]);
        return;
      }
      setVendors(data);
    } catch {
      toast.error('Failed to load compliance data');
      setVendors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const greenCount = vendors.filter((v) => v.status === 'green').length;
  const yellowCount = vendors.filter((v) => v.status === 'yellow').length;
  const redCount = vendors.filter((v) => v.status === 'red').length;

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold">Compliance Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor vendor insurance compliance at a glance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading} aria-label="Refresh data">
            <RefreshCw className={`size-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <ReminderButton />
          <ExportButton />
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="summary-cards">
            <Card data-testid="card-compliant">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                  <ShieldCheck className="size-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{greenCount}</div>
                  <p className="text-sm text-muted-foreground">Compliant</p>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-expiring">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30">
                  <Clock className="size-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{yellowCount}</div>
                  <p className="text-sm text-muted-foreground">Expiring Soon</p>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-noncompliant">
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                  <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{redCount}</div>
                  <p className="text-sm text-muted-foreground">Non-Compliant</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <LegalDisclaimer variant="compliance" className="mt-2" />

          {/* AI Compliance Summary */}
          {vendors.length > 0 && <ComplianceSummary />}

          {/* Vendor table */}
          <Card data-testid="vendor-table-card">
            <CardHeader>
              <CardTitle>Vendors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <VendorTable vendors={vendors} />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
