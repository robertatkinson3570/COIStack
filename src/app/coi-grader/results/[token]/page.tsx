import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MarketingNav } from '@/components/layout/marketing-nav';
import { MarketingFooter } from '@/components/layout/marketing-footer';
import { ResultsSummary } from '@/components/grader/results-summary';
import { CheckScorecard } from '@/components/grader/check-scorecard';
import { CheckDetails } from '@/components/grader/check-details';
import { EmailGate } from '@/components/grader/email-gate';
import { GraderCta } from '@/components/grader/grader-cta';
import { BenchmarkBar } from '@/components/grader/benchmark-bar';
import { ShareResults } from '@/components/grader/share-results';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { GRADER_TEMPLATES } from '@/lib/grader/templates';
import type { GraderTemplateKey, GraderCheckResult } from '@/lib/grader/types';
import type { CoiExtractedFields } from '@/lib/types/database';

export const metadata: Metadata = {
  title: 'COI Grading Results',
  description: 'Your Certificate of Insurance compliance grading results.',
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function GraderResultsPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = createServiceClient();

  // Fetch upload
  const { data: upload } = await supabase
    .from('cw_grader_uploads')
    .select('id, status, template_key, error_message')
    .eq('public_token', token)
    .single();

  if (!upload || upload.status === 'processing') {
    notFound();
  }

  if (upload.status === 'failed') {
    return (
      <>
        <MarketingNav />
        <main className="py-20 sm:py-24">
          <div className="mx-auto max-w-2xl px-4 text-center lg:px-6">
            <h1 className="font-serif text-2xl font-semibold">Processing Failed</h1>
            <p className="mt-4 text-muted-foreground">
              {upload.error_message || 'We could not process this certificate. Please try again with a different file.'}
            </p>
          </div>
        </main>
        <MarketingFooter />
      </>
    );
  }

  // Fetch result
  const { data: result } = await supabase
    .from('cw_grader_results')
    .select('*')
    .eq('upload_id', upload.id)
    .single();

  if (!result) {
    notFound();
  }

  // Check if the current visitor is authenticated — auto-unlock if so
  let emailUnlocked = result.email_unlocked;
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (user && !emailUnlocked) {
      // Auto-unlock for authenticated users
      await supabase
        .from('cw_grader_results')
        .update({
          email_unlocked: true,
          unlocked_by_user_id: user.id,
          unlocked_at: new Date().toISOString(),
        })
        .eq('id', result.id);
      emailUnlocked = true;
    }
  } catch {
    // Not authenticated — that's fine
  }

  const templateKey = upload.template_key as GraderTemplateKey;
  const templateName = GRADER_TEMPLATES[templateKey]?.name || 'Standard Commercial';
  const extracted = result.extracted_json as CoiExtractedFields;
  const checks = result.checks_json as GraderCheckResult[];

  return (
    <>
      <MarketingNav />
      <main className="py-20 sm:py-24">
        <div className="mx-auto max-w-2xl space-y-8 px-4 lg:px-6">
          {/* Summary — always visible */}
          <ResultsSummary
            grade={result.overall_grade}
            passCount={result.pass_count}
            failCount={result.fail_count}
            unknownCount={result.unknown_count}
            namedInsured={extracted?.named_insured ?? null}
            templateName={templateName}
          />

          {/* Share + Benchmark */}
          <ShareResults
            grade={result.overall_grade}
            passCount={result.pass_count}
            total={result.pass_count + result.fail_count + result.unknown_count}
            token={token}
          />
          <BenchmarkBar grade={result.overall_grade} />

          {/* Scorecard — always visible (icons only) */}
          <CheckScorecard checks={checks} />

          {/* Detailed results — gated */}
          <CheckDetails checks={emailUnlocked ? checks : undefined} locked={!emailUnlocked} />

          {/* Email gate — shown only when locked */}
          {!emailUnlocked && <EmailGate token={token} />}

          {/* CTA */}
          <GraderCta />
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
