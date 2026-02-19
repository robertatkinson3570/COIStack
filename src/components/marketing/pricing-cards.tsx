"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ContactSalesDialog } from "@/components/marketing/contact-sales-dialog";

const plans = [
  {
    name: "Starter",
    price: 99,
    vendors: "Up to 100",
    team: "3 members",
    popular: false,
    features: [
      "AI extraction",
      "Compliance scoring",
      "Expiry reminders",
      "Audit export",
      "Email support",
    ],
    cta: "Start Free Trial",
    href: "/auth/register",
  },
  {
    name: "Growth",
    price: 249,
    vendors: "Up to 250",
    team: "10 members",
    popular: true,
    features: [
      "Everything in Starter",
      "Custom templates",
      "Regression detection",
      "AI helpdesk (50/day)",
      "API access",
    ],
    cta: "Start Free Trial",
    href: "/auth/register",
  },
  {
    name: "Pro",
    price: 449,
    vendors: "Up to 500",
    team: "Unlimited",
    popular: false,
    features: [
      "Everything in Growth",
      "Vendor self-service portal",
      "Bulk COI upload",
      "Portfolio analytics",
      "AI helpdesk (200/day)",
    ],
    cta: "Start Free Trial",
    href: "/auth/register",
  },
  {
    name: "Scale",
    price: 749,
    vendors: "Unlimited",
    team: "Unlimited",
    popular: false,
    features: [
      "Everything in Pro",
      "SSO & integrations",
      "Unlimited AI helpdesk",
      "Dedicated support",
      "Priority onboarding",
    ],
    cta: "Contact Sales",
    href: "#",
  },
];

export function PricingCards() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {plans.map((plan) => (
        <Card
          key={plan.name}
          className={cn(
            "relative flex flex-col",
            plan.popular && "border-primary shadow-lg"
          )}
        >
          {plan.popular && (
            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
              Most Popular
            </Badge>
          )}
          <CardHeader>
            <CardTitle className="text-lg">{plan.name}</CardTitle>
            <div className="mt-2">
              <span className="text-3xl font-bold">${plan.price}</span>
              <span className="text-muted-foreground">/mo</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {plan.vendors} vendors &middot; {plan.team}
            </p>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <ul className="flex-1 space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="size-4 text-primary shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            {plan.name === "Scale" ? (
              <ContactSalesDialog>
                <Button className="mt-6 w-full" variant="outline">
                  Contact Sales
                </Button>
              </ContactSalesDialog>
            ) : (
              <Button
                className="mt-6 w-full"
                variant={plan.popular ? "default" : "outline"}
                asChild
              >
                <Link href={plan.href}>
                  {plan.cta}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
