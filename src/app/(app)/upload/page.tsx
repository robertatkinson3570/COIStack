'use client';

import { useState } from 'react';
import { UploadForm, UploadResult } from '@/components/upload/upload-form';
import { ExtractionResult } from '@/components/upload/extraction-result';

export default function UploadPage() {
  const [result, setResult] = useState<UploadResult | null>(null);

  return (
    <div className="space-y-6" data-testid="upload-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Upload COI</h1>
        <p className="text-sm text-muted-foreground">
          Upload a Certificate of Insurance for AI-powered extraction and compliance scoring
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <UploadForm onResult={setResult} />
        {result && <ExtractionResult result={result} />}
      </div>
    </div>
  );
}
