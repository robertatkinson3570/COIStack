'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Building2, Mail, Copy, Check, Bell } from 'lucide-react';
import type { IntegrationProvider } from '@/lib/types/database';

const providers: { id: IntegrationProvider; name: string; description: string }[] = [
  {
    id: 'appfolio',
    name: 'AppFolio',
    description: 'Sync vendors and properties from AppFolio Property Manager.',
  },
  {
    id: 'yardi',
    name: 'Yardi Voyager',
    description: 'Import vendor data and push compliance status to Yardi.',
  },
  {
    id: 'buildium',
    name: 'Buildium',
    description: 'Connect your Buildium account for automated vendor sync.',
  },
];

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState<string[]>([]);
  const [ingestEmail, setIngestEmail] = useState<string | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/integrations');
        if (res.ok) {
          const data = await res.json();
          setInterests(data.interests ?? []);
          setIngestEmail(data.email_ingest?.ingest_email ?? null);
        }
      } catch {
        toast.error('Failed to load integrations');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleNotify(provider: IntegrationProvider) {
    if (!notifyEmail) {
      toast.error('Please enter your email address');
      return;
    }
    setSubmitting(provider);
    try {
      const res = await fetch('/api/settings/integrations/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, email: notifyEmail }),
      });
      if (res.ok) {
        setInterests((prev) => [...prev, provider]);
        toast.success(`We'll notify you when ${providers.find((p) => p.id === provider)?.name} is ready!`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to register interest');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setSubmitting(null);
    }
  }

  async function copyIngestEmail() {
    if (!ingestEmail) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(ingestEmail);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = ingestEmail;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
    } catch {
      toast.error('Failed to copy');
      return;
    }
    setCopied(true);
    toast.success('Email address copied');
    setTimeout(() => setCopied(false), 3000);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="integrations-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect COIStack to your property management software
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {providers.map((provider) => {
          const isRegistered = interests.includes(provider.id);
          return (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-5 text-primary" />
                    <CardTitle className="text-base">{provider.name}</CardTitle>
                  </div>
                  <Badge variant="secondary">Coming Soon</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {provider.description}
                </p>
                {isRegistered ? (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Check className="size-4" />
                    <span>We&apos;ll notify you when ready</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      onClick={() => handleNotify(provider.id)}
                      disabled={submitting === provider.id}
                    >
                      <Bell className="mr-2 size-3.5" />
                      {submitting === provider.id ? 'Submitting...' : 'Notify Me'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Email ingest address */}
      {ingestEmail && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="size-5 text-primary" />
              <CardTitle className="text-base">Email Forwarding</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Forward COI emails to this address and we&apos;ll automatically process attached PDFs.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
                {ingestEmail}
              </code>
              <Button variant="outline" size="sm" onClick={copyIngestEmail}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
