import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

type ButtonVariantProps = VariantProps<typeof buttonVariants>;

export function LinkButton({
  href,
  className,
  variant,
  size,
  children,
  ...props
}: ComponentProps<typeof Link> & ButtonVariantProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </Link>
  );
}

export function AnchorButton({
  href,
  className,
  variant,
  size,
  children,
  ...props
}: ComponentProps<"a"> & ButtonVariantProps) {
  return (
    <a
      href={href}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </a>
  );
}
