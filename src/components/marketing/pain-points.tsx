import { Clock, DollarSign, AlertTriangle, SearchX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const stats = [
  {
    icon: Clock,
    metric: "13 Hours/Week",
    title: "Wasted on Manual Tracking",
    description:
      "Property managers spend over a full business day every week chasing COI paperwork, checking limits, and updating spreadsheets.",
  },
  {
    icon: DollarSign,
    metric: "$250K/Year",
    title: "In Avoidable Claims",
    description:
      "The average 200-vendor firm faces $250,000 annually in compliance-related claims tied directly to poor COI tracking.",
  },
  {
    icon: AlertTriangle,
    metric: "41%",
    title: "Suffer Financial Losses",
    description:
      "41% of businesses have experienced direct financial losses from inaccurate or expired certificates of insurance.",
  },
  {
    icon: SearchX,
    metric: "Failed Audits",
    title: "Cost You Contracts",
    description:
      "Insurance carrier audits are increasing. Firms that can't demonstrate vendor compliance face premium hikes and lost management agreements.",
  },
];

export function PainPoints() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 lg:px-6">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
            The real cost of manual COI management
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Spreadsheets and email don&apos;t scale. The numbers prove it.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {stats.map((stat) => (
            <Card
              key={stat.title}
              className="transition-shadow hover:shadow-md"
            >
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive" aria-hidden="true">
                    <stat.icon className="size-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight">
                      {stat.metric}
                    </p>
                    <p className="font-semibold">{stat.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {stat.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
