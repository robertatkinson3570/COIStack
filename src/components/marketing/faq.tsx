"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "What is a Certificate of Insurance?",
    answer:
      "A Certificate of Insurance (COI) is a document issued by an insurance company that summarizes a vendor's insurance coverage. Property managers collect COIs from vendors to verify they have adequate coverage before allowing them to work on properties.",
  },
  {
    question: "How does the AI extraction work?",
    answer:
      "COIStack uses AI vision capabilities to read your COI PDF. The AI identifies key fields like policy limits, expiration dates, workers' compensation coverage, additional insured endorsements, and waiver of subrogation clauses. The extracted data is then compared against your compliance rules.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Yes. All data is stored in a secure Supabase database with row-level security. Each organization's data is completely isolated — no user can ever see another organization's documents, vendors, or compliance information. PDFs are stored in encrypted object storage.",
  },
  {
    question: "Can I invite my team?",
    answer:
      "Absolutely. COIStack supports team collaboration with role-based access. Owners can invite admins, members, and viewers. Each role has different permissions — for example, viewers can see the dashboard but can't upload new COIs.",
  },
  {
    question: "What file formats do you support?",
    answer:
      "Currently COIStack accepts PDF files up to 4MB. Most COIs are provided as PDFs, so this covers the vast majority of use cases. We plan to add image support (JPG, PNG) in the future.",
  },
  {
    question: "Do you offer a free trial?",
    answer:
      "Yes! Every plan includes a 14-day free trial with no credit card required. You get full access to all features during your trial so you can evaluate COIStack with your actual vendor COIs.",
  },
  {
    question: "Can vendors upload their own COIs?",
    answer:
      "Yes! COIStack's Vendor Self-Service Portal lets you generate a unique upload link for each vendor. They upload their COI directly — no account needed — and it's automatically extracted and scored against your compliance rules. Available on Pro and Scale plans.",
  },
  {
    question: "Does COIStack integrate with property management software?",
    answer:
      "We're building integrations with AppFolio, Yardi, and Buildium. You can join the waitlist from Settings → Integrations to be notified when your integration is ready. Our API is also available on Growth plans and above for custom integrations.",
  },
  {
    question: "Can I upload COIs in bulk?",
    answer:
      "Yes. COIStack supports bulk upload on Pro and Scale plans — upload up to 50 COIs at once with optional vendor mapping. Each document goes through the same AI extraction and compliance scoring pipeline. Perfect for initial onboarding or large portfolio acquisitions.",
  },
];

export function FAQ() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 lg:px-6">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about COIStack
          </p>
        </div>

        <Accordion type="single" collapsible className="mt-12">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>{faq.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
