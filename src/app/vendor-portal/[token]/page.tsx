'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';

interface PortalInfo {
  vendor_name: string;
  vendor_trade: string;
  org_name: string;
  org_logo: string | null;
}

export default function VendorPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<PortalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');

  useEffect(() => {
    async function loadPortalInfo() {
      try {
        const res = await fetch(`/api/vendor-portal/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Invalid portal link');
          return;
        }
        const data = await res.json();
        setInfo(data);
      } catch {
        setError('Failed to load portal information');
      } finally {
        setLoading(false);
      }
    }
    loadPortalInfo();
  }, [token]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setUploadMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/vendor-portal/${token}/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadMessage(data.error || 'Upload failed');
        return;
      }

      setSuccess(true);
      setUploadMessage(data.message || 'Upload successful!');
    } catch {
      setUploadMessage('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <AlertCircle className="size-12 text-destructive" />
          <h2 className="text-xl font-semibold">Portal Unavailable</h2>
          <p className="text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <CheckCircle className="size-12 text-green-600" />
          <h2 className="text-xl font-semibold">Certificate Uploaded</h2>
          <p className="text-muted-foreground">{uploadMessage}</p>
          <p className="text-sm text-muted-foreground">
            {info?.org_name} will review your certificate and follow up if needed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="vendor-portal-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">
          Upload Certificate of Insurance
        </h1>
        <p className="mt-1 text-muted-foreground">
          <span className="font-medium text-foreground">{info?.org_name}</span> has
          requested an updated COI for{' '}
          <span className="font-medium text-foreground">{info?.vendor_name}</span>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload your COI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary/50"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            data-testid="vendor-portal-drop-zone"
          >
            {file ? (
              <div className="flex items-center gap-3">
                <FileText className="size-8 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <Upload className="size-10 text-muted-foreground" />
                <p className="mt-3 font-medium">
                  Drag and drop your COI PDF here
                </p>
                <p className="text-sm text-muted-foreground">
                  or click below to browse
                </p>
                <label>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button variant="outline" size="sm" className="mt-3" asChild>
                    <span>Browse Files</span>
                  </Button>
                </label>
              </>
            )}
          </div>

          {uploadMessage && !success && (
            <p className="text-sm text-destructive">{uploadMessage}</p>
          )}

          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? 'Uploading & Processing...' : 'Upload Certificate'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            PDF files only, up to 4MB. Your document will be securely processed
            and analyzed for compliance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
