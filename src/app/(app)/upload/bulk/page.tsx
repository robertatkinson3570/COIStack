'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BulkUploadForm } from '@/components/upload/bulk-upload-form';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  name: string;
}

export default function BulkUploadPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVendors() {
      try {
        const res = await fetch('/api/compliance');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setVendors(
              data.map((v: { vendor_id: string; vendor_name: string }) => ({
                id: v.vendor_id,
                name: v.vendor_name,
              }))
            );
          }
        }
      } catch {
        toast.error('Failed to load vendors');
      } finally {
        setLoading(false);
      }
    }
    loadVendors();
  }, []);

  return (
    <div className="space-y-6" data-testid="bulk-upload-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Bulk Upload</h1>
        <p className="text-sm text-muted-foreground">
          Upload up to 50 COI PDFs at once with vendor mapping
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload Files</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : vendors.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No vendors found. Add vendors first by uploading individual COIs.
            </p>
          ) : (
            <BulkUploadForm vendors={vendors} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
