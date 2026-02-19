'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Vendor, TradeType } from '@/lib/types/database';
import { Plus } from 'lucide-react';

export interface UploadResult {
  extraction_id: string;
  extracted_json: Record<string, unknown>;
  confidence: number;
  needs_review: boolean;
  compliance: {
    status: 'green' | 'yellow' | 'red';
    reasons: string[];
  };
  diff: {
    has_regression: boolean;
    regressions: string[];
  } | null;
}

interface UploadFormProps {
  onResult: (result: UploadResult) => void;
}

type Stage = 'idle' | 'uploading' | 'extracting' | 'done' | 'error';

const TRADE_TYPES: { value: TradeType; label: string }[] = [
  { value: 'GC', label: 'General Contractor' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'PLUMBING', label: 'Plumbing' },
  { value: 'ROOFING', label: 'Roofing' },
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'OTHER', label: 'Other' },
];

export function UploadForm({ onResult }: UploadFormProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  // New vendor form state
  const [showNewVendor, setShowNewVendor] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [newVendorEmail, setNewVendorEmail] = useState('');
  const [newVendorTrade, setNewVendorTrade] = useState<TradeType>('GC');
  const [creatingVendor, setCreatingVendor] = useState(false);

  useEffect(() => {
    fetch('/api/vendors')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load vendors');
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setVendors(data);
          if (data.length === 0) setShowNewVendor(true);
        }
      })
      .catch(() => setError('Failed to load vendors'));
  }, []);

  async function createVendor() {
    if (!newVendorName.trim()) return;
    setCreatingVendor(true);
    setError(null);

    try {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newVendorName.trim(),
          email: newVendorEmail.trim() || undefined,
          trade_type: newVendorTrade,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create vendor');
      }

      const vendor = await res.json();
      setVendors((prev) => [...prev, vendor]);
      setVendorId(vendor.id);
      setShowNewVendor(false);
      setNewVendorName('');
      setNewVendorEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vendor');
    } finally {
      setCreatingVendor(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendorId || !file) return;

    setError(null);
    setStage('uploading');

    try {
      // Step 1: Upload
      const formData = new FormData();
      formData.append('vendor_id', vendorId);
      formData.append('file', file);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || 'Upload failed');
      }

      const { document_id, is_duplicate } = await uploadRes.json();

      if (is_duplicate) {
        setError('This document has already been uploaded for this vendor.');
        setStage('idle');
        return;
      }

      // Step 2: Extract + Score
      setStage('extracting');
      const extractRes = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id }),
      });

      if (!extractRes.ok) {
        const err = await extractRes.json();
        throw new Error(err.error || 'Extraction failed');
      }

      const result: UploadResult = await extractRes.json();
      setStage('done');
      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStage('error');
    }
  }

  return (
    <Card data-testid="upload-form-card">
      <CardHeader>
        <CardTitle>Upload Certificate of Insurance</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="upload-form">
          <div className="space-y-2">
            <Label>Vendor</Label>
            {!showNewVendor ? (
              <div className="space-y-2">
                <Select value={vendorId} onValueChange={setVendorId}>
                  <SelectTrigger aria-label="Select vendor">
                    <SelectValue placeholder="Select a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} ({v.trade_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowNewVendor(true)}
                >
                  <Plus className="size-3 mr-1" />
                  Add new vendor
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                <div className="space-y-1">
                  <Label htmlFor="new-vendor-name" className="text-xs">Vendor Name</Label>
                  <Input
                    id="new-vendor-name"
                    placeholder="e.g. Acme Construction"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-vendor-email" className="text-xs">Email (optional)</Label>
                  <Input
                    id="new-vendor-email"
                    type="email"
                    placeholder="vendor@example.com"
                    value={newVendorEmail}
                    onChange={(e) => setNewVendorEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Trade Type</Label>
                  <Select value={newVendorTrade} onValueChange={(v) => setNewVendorTrade(v as TradeType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRADE_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={createVendor}
                    disabled={!newVendorName.trim() || creatingVendor}
                  >
                    {creatingVendor ? 'Creating...' : 'Create Vendor'}
                  </Button>
                  {vendors.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowNewVendor(false)}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="coi-file">COI Document (PDF)</Label>
            <Input
              id="coi-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file && file.size > 4 * 1024 * 1024 && (
              <p className="text-sm text-destructive">
                File exceeds 4MB limit. Please use a smaller file.
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={!vendorId || !file || stage === 'uploading' || stage === 'extracting'}
            className="w-full"
          >
            {stage === 'uploading' && 'Uploading...'}
            {stage === 'extracting' && 'Extracting & Scoring...'}
            {(stage === 'idle' || stage === 'done' || stage === 'error') && 'Upload & Analyze'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
