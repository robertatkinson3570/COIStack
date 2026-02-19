import {
  Sparkles,
  Settings,
  Bell,
  TrendingDown,
  Download,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Extraction",
    description:
      "AI vision reads your COI PDFs and extracts key fields automatically — limits, endorsements, dates, and more.",
  },
  {
    icon: Settings,
    title: "Trade-Specific Rules",
    description:
      "Define different compliance requirements for each trade type. GC, HVAC, electrical — each gets its own template.",
  },
  {
    icon: Bell,
    title: "Expiry Reminders",
    description:
      "Automated reminder stages at 30, 14, 7, and 1 day before expiration, plus weekly expired notices.",
  },
  {
    icon: TrendingDown,
    title: "Regression Detection",
    description:
      "Automatically detects when a renewed COI has lower limits or missing endorsements compared to the previous version.",
  },
  {
    icon: Download,
    title: "Audit Export",
    description:
      "Export a complete audit package — CSV summary plus all vendor COI PDFs in a single ZIP file.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Invite your team with role-based access. Owners, admins, members, and viewers each see what they need.",
  },
];

export function Features() {
  return (
    <section id="features" className="bg-card py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 lg:px-6">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
            Everything you need for COI compliance
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built for property managers who manage dozens to hundreds of vendor
            relationships
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="transition-shadow hover:shadow-md"
            >
              <CardContent className="pt-6">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                  <feature.icon className="size-5" />
                </div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Compliance scores are informational and do not constitute legal or
          insurance advice. Always verify coverage with a licensed professional.
        </p>
      </div>
    </section>
  );
}
