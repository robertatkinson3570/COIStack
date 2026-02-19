import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="bg-primary py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 text-center lg:px-6">
        <h2 className="font-serif text-3xl font-semibold text-primary-foreground sm:text-4xl">
          Ready to put your COI compliance on autopilot?
        </h2>
        <p className="mt-4 text-lg text-primary-foreground/80">
          Join property managers who trust COIStack to keep their vendors
          compliant, automatically.
        </p>
        <div className="mt-10">
          <Button
            size="lg"
            variant="secondary"
            className="gap-2"
            asChild
          >
            <Link href="/auth/register">
              Start Free Trial
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <p className="mt-4 text-sm text-primary-foreground/60">
            No credit card required. 14-day free trial.
          </p>
        </div>
      </div>
    </section>
  );
}
