import type { Metadata } from "next";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { PricingCards } from "@/components/marketing/pricing-cards";

export const metadata: Metadata = {
  title: "Pricing — Plans from $99/mo",
  description:
    "Simple, transparent COI compliance pricing for property managers. Plans from $99/mo for up to 100 vendors. 14-day free trial, no credit card required.",
  keywords: [
    "COI software pricing",
    "insurance compliance cost",
    "COI tracking pricing",
    "vendor compliance software price",
  ],
  openGraph: {
    title: "COIStack Pricing — Plans from $99/mo",
    description:
      "Simple, transparent COI compliance pricing. Plans from $99/mo. 14-day free trial.",
    url: "/pricing",
  },
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingPage() {
  return (
    <>
      <MarketingNav />
      <main className="py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 lg:px-6">
          <div className="text-center">
            <h1 className="font-serif text-3xl font-semibold sm:text-4xl">
              Simple pricing that scales with you
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Start free for 14 days. No credit card required.
            </p>
          </div>
          <div className="mt-16">
            <PricingCards />
          </div>
          <p className="mt-10 text-center text-sm text-muted-foreground">
            All plans include a 14-day free trial. Cancel anytime.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
