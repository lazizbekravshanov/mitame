import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

type DivProps = HTMLAttributes<HTMLDivElement>;

/** The glass surface everything else sits on. */
export function Card({ className, ...props }: DivProps) {
  return <div data-slot="card" className={cn("mi-card", className)} {...props} />;
}

export function CardHeader({ className, ...props }: DivProps) {
  return <div data-slot="card-header" className={className} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 data-slot="card-title" className={className} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p data-slot="card-description" className={className} {...props} />;
}

export function CardBody({ className, ...props }: DivProps) {
  return <div data-slot="card-body" className={className} {...props} />;
}

export function CardFooter({ className, ...props }: DivProps) {
  return <div data-slot="card-footer" className={className} {...props} />;
}
