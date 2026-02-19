'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { HistoryTimeline } from '@/components/compliance/history-timeline';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ArrowLeft } from 'lucide-react';
import type { ComplianceSnapshot } from '@/lib/types/database';

interface VendorDetail {
  vendor_id: string;
  vendor_name: string;
  trade_type: string;
  status: string;
  reasons: string[];
  next_expiry_date: string | null;
  last_upload_date: string | null;
}

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [vendor, setVendor] = useState<VendorDetail | null>(null);
  const [snapshots, setSnapshots] = useState<ComplianceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Load compliance data to find this vendor
        const [compRes, histRes] = await Promise.all([
          fetch('/api/compliance'),
          fetch(`/api/compliance/history?vendor_id=${id}`),
        ]);

        if (compRes.ok) {
          const vendors = await compRes.json();
          const found = vendors.find((v: VendorDetail) => v.vendor_id === id);
          if (found) setVendor(found);
        }

        if (histRes.ok) {
          const data = await histRes.json();
          setSnapshots(data);
        }
      } catch {
        toast.error('Failed to load vendor details');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">Vendor not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="vendor-detail-page">
      <div>
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-serif font-semibold">{vendor.vendor_name}</h1>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="secondary">{vendor.trade_type}</Badge>
          <StatusBadge status={vendor.status} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Compliance</span>
              <StatusBadge status={vendor.status} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Next Expiry</span>
              <span>
                {vendor.next_expiry_date
                  ? format(new Date(vendor.next_expiry_date), 'MMM d, yyyy')
                  : '-'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Upload</span>
              <span>
                {vendor.last_upload_date
                  ? format(new Date(vendor.last_upload_date), 'MMM d, yyyy')
                  : '-'}
              </span>
            </div>
            {vendor.reasons.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Issues</p>
                <ul className="space-y-1">
                  {vendor.reasons.map((r, i) => (
                    <li key={i} className="text-sm text-destructive">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Compliance History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Compliance History</CardTitle>
          </CardHeader>
          <CardContent>
            <HistoryTimeline snapshots={snapshots} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
