import type { Metadata } from "next";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { Hero } from "@/components/marketing/hero";
import { PainPoints } from "@/components/marketing/pain-points";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Features } from "@/components/marketing/features";
import { FAQ } from "@/components/marketing/faq";
import { CTASection } from "@/components/marketing/cta-section";

export const metadata: Metadata = {
  title: "COI Compliance Software for Property Managers | COIStack",
  description:
    "Stop wasting 13 hours/week on manual COI tracking. COIStack automates certificate of insurance compliance with AI extraction, real-time monitoring, and vendor self-service. Start free.",
  keywords: [
    "COI tracking software",
    "certificate of insurance management",
    "vendor insurance compliance",
    "property management COI",
    "automated COI tracking",
    "insurance certificate verification",
    "vendor risk management",
    "COI expiration tracking",
  ],
  openGraph: {
    title: "COIStack — Insurance Compliance on Autopilot",
    description:
      "Stop wasting 13 hours/week on manual COI tracking. Automate certificate of insurance compliance with AI extraction and real-time monitoring.",
    url: "/",
  },
  alternates: {
    canonical: "/",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "COIStack",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Automated COI compliance management for property managers. Upload certificates, extract data with AI, score compliance instantly.",
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "99",
    highPrice: "749",
    priceCurrency: "USD",
    offerCount: "4",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "50",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is a Certificate of Insurance?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A Certificate of Insurance (COI) is a document issued by an insurance company that summarizes a vendor's insurance coverage. Property managers collect COIs from vendors to verify they have adequate coverage before allowing them to work on properties.",
      },
    },
    {
      "@type": "Question",
      name: "How does the AI extraction work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "COIStack uses AI vision capabilities to read your COI PDF. The AI identifies key fields like policy limits, expiration dates, workers' compensation coverage, additional insured endorsements, and waiver of subrogation clauses.",
      },
    },
    {
      "@type": "Question",
      name: "Can vendors upload their own COIs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! COIStack's Vendor Self-Service Portal lets you generate a unique upload link for each vendor. They upload their COI directly — no account needed — and it's automatically extracted and scored against your compliance rules.",
      },
    },
    {
      "@type": "Question",
      name: "Do you offer a free trial?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Every plan includes a 14-day free trial with no credit card required. You get full access to all features during your trial so you can evaluate COIStack with your actual vendor COIs.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <MarketingNav />
      <main>
        <Hero />
        <PainPoints />
        <HowItWorks />
        <Features />
        <FAQ />
        <CTASection />
      </main>
      <MarketingFooter />
    </>
  );
}
