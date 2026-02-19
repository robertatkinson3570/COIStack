'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VendorTable, VendorRow } from '@/components/dashboard/vendor-table';
import { toast } from 'sonner';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/compliance');
        if (!res.ok) {
          const data = await res.json();
          toast.error(data?.error || 'Failed to load vendors');
          return;
        }
        const data = await res.json();
        if (Array.isArray(data)) {
          setVendors(data);
        }
      } catch {
        toast.error('Failed to load vendors');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6" data-testid="vendors-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Vendors</h1>
        <p className="text-sm text-muted-foreground">
          View and manage all your vendors and their compliance status
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vendors ({vendors.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : vendors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No vendors yet. Upload a COI to create your first vendor.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6 px-6">
              <VendorTable vendors={vendors} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
