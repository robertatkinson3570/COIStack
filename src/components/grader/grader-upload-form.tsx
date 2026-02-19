'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { GRADER_TEMPLATES } from '@/lib/grader/templates';
import { GRADER_MAX_FILE_SIZE, GRADER_ACCEPTED_TYPES } from '@/lib/constants';
import type { GraderTemplateKey } from '@/lib/grader/types';

type UploadStage = 'idle' | 'uploading' | 'analyzing' | 'grading' | 'done';

const stageLabels: Record<UploadStage, string> = {
  idle: '',
  uploading: 'Uploading...',
  analyzing: 'Analyzing certificate...',
  grading: 'Grading compliance...',
  done: 'Redirecting...',
};

export function GraderUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [templateKey, setTemplateKey] = useState<GraderTemplateKey>('standard_commercial');
  const [stage, setStage] = useState<UploadStage>('idle');
  const [dragOver, setDragOver] = useState(false);

  const isProcessing = stage !== 'idle';

  const validateFile = useCallback((f: File): boolean => {
    if (!GRADER_ACCEPTED_TYPES.includes(f.type as typeof GRADER_ACCEPTED_TYPES[number])) {
      toast.error('Invalid file type. Please upload a PDF, PNG, or JPEG.');
      return false;
    }
    if (f.size > GRADER_MAX_FILE_SIZE) {
      toast.error('File too large. Maximum size is 10MB.');
      return false;
    }
    return true;
  }, []);

  const handleFile = useCallback(
    (f: File) => {
      if (validateFile(f)) {
        setFile(f);
      }
    },
    [validateFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  async function handleSubmit() {
    if (!file) return;

    try {
      setStage('uploading');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('template_key', templateKey);

      // Simulate stage progression (the API does all steps server-side)
      const stageTimer = setTimeout(() => setStage('analyzing'), 2000);
      const stageTimer2 = setTimeout(() => setStage('grading'), 5000);

      const res = await fetch('/api/coi-grader/uploads', {
        method: 'POST',
        body: formData,
      });

      clearTimeout(stageTimer);
      clearTimeout(stageTimer2);

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || 'Upload failed');
        setStage('idle');
        return;
      }

      const data = await res.json();
      setStage('done');
      router.push(`/coi-grader/results/${data.token}`);
    } catch {
      toast.error('Something went wrong. Please try again.');
      setStage('idle');
    }
  }

  return (
    <Card data-testid="grader-upload-card">
      <CardContent className="space-y-6 p-6">
        {/* Drop zone */}
        <div
          data-testid="grader-drop-zone"
          className={cn(
            'flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors',
            dragOver
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50',
            isProcessing && 'pointer-events-none opacity-60'
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            disabled={isProcessing}
          />

          {file ? (
            <div className="flex items-center gap-3">
              <FileText className="size-8 text-primary" />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          ) : (
            <>
              <Upload className="mb-3 size-10 text-muted-foreground" />
              <p className="text-sm font-medium">
                Drop your COI here or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, PNG, or JPEG up to 10MB
              </p>
            </>
          )}
        </div>

        {/* Template selector */}
        <div className="space-y-2">
          <Label htmlFor="template">Compliance Template</Label>
          <Select
            value={templateKey}
            onValueChange={(v) => setTemplateKey(v as GraderTemplateKey)}
            disabled={isProcessing}
          >
            <SelectTrigger id="template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(GRADER_TEMPLATES).map((t) => (
                <SelectItem key={t.key} value={t.key}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {GRADER_TEMPLATES[templateKey].description}
          </p>
        </div>

        {/* Submit */}
        <Button
          className="w-full"
          size="lg"
          disabled={!file || isProcessing}
          onClick={handleSubmit}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {stageLabels[stage]}
            </>
          ) : (
            'Grade This COI'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
