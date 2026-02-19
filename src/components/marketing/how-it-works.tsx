import { Upload, CheckCircle, Bell } from "lucide-react";

const steps = [
  {
    icon: Upload,
    title: "Upload COIs",
    description:
      "Drop a PDF and our AI reads it in seconds. No manual data entry.",
  },
  {
    icon: CheckCircle,
    title: "Instant Compliance Scoring",
    description:
      "Every certificate is scored against your requirements. Red, yellow, or green — instantly.",
  },
  {
    icon: Bell,
    title: "Never Miss an Expiry",
    description:
      "Automated reminders at 30, 14, 7, and 1 day before expiration. Audit-ready exports anytime.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 lg:px-6">
        <div className="text-center">
          <h2 className="font-serif text-3xl font-semibold sm:text-4xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Three simple steps to automated compliance
          </p>
        </div>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="relative mx-auto w-fit">
                <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-6" />
                </div>
                <div className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {i + 1}
                </div>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
