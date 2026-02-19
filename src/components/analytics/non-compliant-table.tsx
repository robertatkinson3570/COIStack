'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface NonCompliantVendor {
  vendor_id: string;
  vendor_name: string;
  trade_type: string;
  reasons: string[];
  next_expiry_date: string | null;
}

interface NonCompliantTableProps {
  vendors: NonCompliantVendor[];
}

export function NonCompliantTable({ vendors }: NonCompliantTableProps) {
  if (vendors.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        All vendors are compliant!
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vendor</TableHead>
          <TableHead>Trade</TableHead>
          <TableHead>Issues</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vendors.map((v) => (
          <TableRow key={v.vendor_id}>
            <TableCell>
              <Link
                href={`/vendors/${v.vendor_id}`}
                className="font-medium hover:underline"
              >
                {v.vendor_name}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{v.trade_type}</Badge>
            </TableCell>
            <TableCell className="max-w-xs">
              <span className="text-sm text-muted-foreground">
                {v.reasons.join('; ')}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
