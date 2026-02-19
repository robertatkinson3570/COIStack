import type { Metadata } from 'next';
import { MarketingNav } from '@/components/layout/marketing-nav';
import { MarketingFooter } from '@/components/layout/marketing-footer';
import { GraderUploadForm } from '@/components/grader/grader-upload-form';
import {
  ShieldCheck,
  Clock,
  DollarSign,
  Users,
  FileCheck,
  Scale,
  Car,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Free COI Compliance Grader',
  description:
    'Upload a Certificate of Insurance and get an instant compliance grade. Check GL limits, workers comp, additional insured, and more — free, no signup required.',
  keywords: [
    'COI grader',
    'certificate of insurance checker',
    'free COI compliance check',
    'insurance certificate grader',
    'COI verification tool',
  ],
  openGraph: {
    title: 'Free COI Compliance Grader — COIStack',
    description:
      'Upload a COI and get an instant compliance grade. Check GL limits, workers comp, additional insured — free, no signup.',
    url: '/coi-grader',
  },
  alternates: {
    canonical: '/coi-grader',
  },
};

const checks = [
  { icon: Clock, label: 'Policy expiration date' },
  { icon: DollarSign, label: 'GL each occurrence limit' },
  { icon: DollarSign, label: 'GL aggregate limit' },
  { icon: Users, label: "Workers' compensation" },
  { icon: FileCheck, label: 'Additional insured endorsement' },
  { icon: Scale, label: 'Waiver of subrogation' },
  { icon: Car, label: 'Auto liability (upgrade for tracking)' },
];

export default function CoiGraderPage() {
  return (
    <>
      <MarketingNav />
      <main className="py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-4 lg:px-6">
          {/* Hero */}
          <div className="text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-primary" />
              Free compliance check
            </div>
            <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
              Is this COI compliant?
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Upload a Certificate of Insurance and get an instant compliance
              grade against industry-standard requirements.
            </p>
          </div>

          {/* Upload form */}
          <div className="mt-12">
            <GraderUploadForm />
          </div>

          {/* Trust line */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No signup required to see your compliance score. Enter your email to
            unlock the full detailed breakdown.
          </p>

          {/* What we check */}
          <div className="mt-16">
            <h2 className="font-serif text-xl font-semibold text-center">
              What we check
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {checks.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3"
                  >
                    <Icon className="size-5 shrink-0 text-primary" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="mt-16 text-center text-xs text-muted-foreground">
            This tool provides an automated compliance assessment for
            informational purposes only. It does not constitute legal or
            insurance advice. Always consult a licensed insurance professional
            for binding compliance decisions.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
