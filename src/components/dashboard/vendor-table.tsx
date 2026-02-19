'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { StatusBadge } from './status-badge';
import { format } from 'date-fns';
import { Link2, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface VendorRow {
  vendor_id: string;
  vendor_name: string;
  trade_type: string;
  status: string;
  reasons: string[];
  next_expiry_date: string | null;
  last_upload_date: string | null;
}

interface VendorTableProps {
  vendors: VendorRow[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function PortalLinkButton({ vendorId }: { vendorId: string }) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generateLink() {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendors/${vendorId}/portal-link`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to generate link');
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(data.url);
      } else {
        // Fallback for non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = data.url;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success('Portal link copied to clipboard');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Failed to generate portal link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={generateLink} disabled={loading} aria-label="Generate vendor upload link" title="Generate vendor upload link">
      {loading ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : copied ? (
        <Check className="size-3.5 text-green-600" />
      ) : (
        <Link2 className="size-3.5" />
      )}
    </Button>
  );
}

export function VendorTable({ vendors }: VendorTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vendor</TableHead>
          <TableHead>Trade</TableHead>
          <TableHead>Expiry</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Missing / Issues</TableHead>
          <TableHead>Last Upload</TableHead>
          <TableHead className="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vendors.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              No vendors found. Upload a COI to get started.
            </TableCell>
          </TableRow>
        )}
        {vendors.map((v) => (
          <TableRow key={v.vendor_id}>
            <TableCell>
              <Link
                href={`/vendors/${v.vendor_id}`}
                className="font-medium text-foreground hover:text-primary transition-colors hover:underline"
              >
                {v.vendor_name}
              </Link>
            </TableCell>
            <TableCell>{v.trade_type}</TableCell>
            <TableCell>{formatDate(v.next_expiry_date)}</TableCell>
            <TableCell>
              <StatusBadge status={v.status} />
            </TableCell>
            <TableCell className="max-w-xs">
              {v.reasons.length > 0 ? (
                <span className="text-sm text-muted-foreground line-clamp-2" title={v.reasons.join('; ')}>
                  {v.reasons.join('; ')}
                </span>
              ) : (
                <span className="text-sm text-green-600 dark:text-green-400">OK</span>
              )}
            </TableCell>
            <TableCell>{formatDate(v.last_upload_date)}</TableCell>
            <TableCell>
              <PortalLinkButton vendorId={v.vendor_id} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
