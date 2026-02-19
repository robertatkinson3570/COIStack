'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export function ExportButton() {
  const [loading, setLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  async function handleExport() {
    setLoading(true);
    setDownloadUrl(null);
    try {
      const res = await fetch('/api/export', { method: 'POST' });
      if (!res.ok) {
        throw new Error('Export failed');
      }
      const data = await res.json();
      if (data.download_url) {
        setDownloadUrl(data.download_url);
      }
    } catch {
      toast.error('Failed to generate export');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" onClick={handleExport} disabled={loading}>
        {loading ? 'Generating...' : 'Export Audit'}
      </Button>
      {downloadUrl && (
        <a
          href={downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline"
        >
          Download ZIP
        </a>
      )}
    </div>
  );
}
