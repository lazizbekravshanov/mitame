import { useState } from "react";
import { CheckIcon } from "../icons/check";
import { Button } from "../ui/button";
import { Card, CardBody, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import { Switch } from "../ui/switch";

export interface Plan {
  name: string;
  monthly: number;
  description: string;
  features: string[];
  cta?: string;
  featured?: boolean;
}

export const defaultPlans: Plan[] = [
  { name: "Hobby", monthly: 0, description: "For side projects and weekends.", features: ["1 project", "Community support", "All components"], cta: "Start free" },
  { name: "Pro", monthly: 12, description: "For people who ship.", features: ["Unlimited projects", "Email support", "All themes", "Early access to new eras"], cta: "Go Pro", featured: true },
  { name: "Team", monthly: 39, description: "For a whole design system.", features: ["Everything in Pro", "5 seats", "Shared theme tokens", "Priority support"], cta: "Start trial" },
];

export interface PricingProps {
  plans?: Plan[];
  /** Yearly billing takes two months off, so 10x the monthly price. */
  yearlyMultiplier?: number;
  onSelect?: (plan: Plan, yearly: boolean) => void;
}

export default function Pricing({ plans = defaultPlans, yearlyMultiplier = 10, onSelect }: PricingProps) {
  const [yearly, setYearly] = useState(false);

  return (
    <section className="mi-block mi-block-section">
      <div className="mi-block-head">
        <h2 className="mi-block-title">Simple pricing</h2>
        <p className="mi-block-lede">Every plan includes every component and every theme. Upgrade when your team does.</p>
      </div>

      <div className="mi-price-toggle">
        <Switch checked={yearly} onChange={(e) => setYearly(e.currentTarget.checked)}>
          Yearly billing <span className="mi-block-muted mi-block-small">(2 months free)</span>
        </Switch>
      </div>

      <div className="mi-price-grid">
        {plans.map((plan) => {
          const price = yearly ? plan.monthly * yearlyMultiplier : plan.monthly;
          return (
            <Card key={plan.name}>
              <CardHeader>
                {plan.featured && <span className="mi-price-tag">Most popular</span>}
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <p className="mi-price-amount">
                  <span className="mi-price-number">${price}</span>
                  <span className="mi-block-muted mi-block-small">{price === 0 ? "forever" : yearly ? "per year" : "per month"}</span>
                </p>
              </CardHeader>
              <CardBody>
                <ul className="mi-price-list">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <CheckIcon aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardBody>
              <CardFooter>
                <Button
                  variant={plan.featured ? "primary" : "secondary"}
                  style={{ width: "100%" }}
                  onClick={() => onSelect?.(plan, yearly)}
                >
                  {plan.cta ?? "Choose"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
