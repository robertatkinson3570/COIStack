'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Upload, X, FileText, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface Vendor {
  id: string;
  name: string;
}

interface FileMapping {
  file: File;
  vendorId: string;
}

interface UploadResult {
  filename: string;
  status: 'success' | 'duplicate' | 'error';
  document_id?: string;
  error?: string;
}

interface BulkUploadFormProps {
  vendors: Vendor[];
}

export function BulkUploadForm({ vendors }: BulkUploadFormProps) {
  const [fileMappings, setFileMappings] = useState<FileMapping[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<UploadResult[] | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter(
        (f) => f.type === 'application/pdf'
      );
      const newMappings = files.map((file) => ({ file, vendorId: '' }));
      setFileMappings((prev) => [...prev, ...newMappings].slice(0, 50));
    },
    []
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(
      (f) => f.type === 'application/pdf'
    );
    const newMappings = files.map((file) => ({ file, vendorId: '' }));
    setFileMappings((prev) => [...prev, ...newMappings].slice(0, 50));
    e.target.value = '';
  };

  function removeFile(index: number) {
    setFileMappings((prev) => prev.filter((_, i) => i !== index));
  }

  function updateVendor(index: number, vendorId: string) {
    setFileMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, vendorId } : m))
    );
  }

  async function handleUpload() {
    const unmapped = fileMappings.filter((m) => !m.vendorId);
    if (unmapped.length > 0) {
      toast.error(`${unmapped.length} file(s) don't have a vendor assigned`);
      return;
    }

    setUploading(true);
    setProgress(10);

    try {
      const formData = new FormData();
      const vendorMapping: Record<string, string> = {};

      for (const mapping of fileMappings) {
        formData.append('files', mapping.file);
        vendorMapping[mapping.file.name] = mapping.vendorId;
      }

      formData.append('vendor_mapping', JSON.stringify(vendorMapping));
      setProgress(30);

      const res = await fetch('/api/upload/bulk', {
        method: 'POST',
        body: formData,
      });

      setProgress(90);
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Bulk upload failed');
        return;
      }

      setResults(data.results);
      toast.success(
        `Processed ${data.total} files: ${data.success} uploaded, ${data.duplicates} duplicates, ${data.errors} errors`
      );
    } catch {
      toast.error('Bulk upload failed');
    } finally {
      setUploading(false);
      setProgress(100);
    }
  }

  if (results) {
    return (
      <div className="space-y-4">
        <h3 className="font-semibold">Upload Results</h3>
        <div className="space-y-2">
          {results.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
            >
              {r.status === 'success' ? (
                <CheckCircle className="size-4 text-green-600 shrink-0" />
              ) : r.status === 'duplicate' ? (
                <Copy className="size-4 text-yellow-600 shrink-0" />
              ) : (
                <AlertCircle className="size-4 text-destructive shrink-0" />
              )}
              <span className="flex-1 truncate">{r.filename}</span>
              <span className="text-muted-foreground capitalize">{r.status}</span>
              {r.error && (
                <span className="text-xs text-destructive">{r.error}</span>
              )}
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setResults(null);
            setFileMappings([]);
            setProgress(0);
          }}
        >
          Upload More
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        data-testid="bulk-drop-zone"
      >
        <Upload className="size-10 text-muted-foreground" />
        <p className="mt-3 font-medium">Drop PDF files here</p>
        <p className="text-sm text-muted-foreground">
          Up to 50 files, 4MB each
        </p>
        <label>
          <input
            type="file"
            accept="application/pdf"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button variant="outline" size="sm" className="mt-3" asChild>
            <span>Browse Files</span>
          </Button>
        </label>
      </div>

      {/* File list with vendor mapping */}
      {fileMappings.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {fileMappings.length} file(s) — assign a vendor to each
          </p>
          {fileMappings.map((mapping, index) => (
            <Card key={index}>
              <CardContent className="flex items-center gap-3 py-2 px-3">
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate text-sm">{mapping.file.name}</span>
                <Select
                  value={mapping.vendorId}
                  onValueChange={(val) => updateVendor(index, val)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                >
                  <X className="size-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground text-center">
            Processing {fileMappings.length} files...
          </p>
        </div>
      )}

      {/* Upload button */}
      {fileMappings.length > 0 && !uploading && (
        <Button className="w-full" onClick={handleUpload}>
          Upload {fileMappings.length} File(s)
        </Button>
      )}
    </div>
  );
}
