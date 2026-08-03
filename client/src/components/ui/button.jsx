import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button — the one interactive primitive every CTA in the site
 * is built from. Deliberately quiet: no drop shadows, no heavy
 * rounding. Corners use --radius-sm to match the hairline-frame
 * language set in index.css. Motion is a simple color/border
 * transition — reserved animation budget goes to scroll reveals.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap " +
    "font-sans text-sm font-medium tracking-tight " +
    "transition-colors duration-200 ease-out " +
    "disabled:pointer-events-none disabled:opacity-40 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signature focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
  {
    variants: {
      variant: {
        primary:
          "bg-ink text-paper hover:bg-signature rounded-[2px]",
        outline:
          "border border-ink text-ink hover:bg-ink hover:text-paper rounded-[2px]",
        ghost:
          "text-ink underline underline-offset-4 decoration-line-strong hover:decoration-signature hover:text-signature",
        signature:
          "bg-signature text-paper hover:bg-signature-soft rounded-[2px]",
      },
      size: {
        default: "h-11 px-6",
        sm: "h-9 px-4 text-[13px]",
        lg: "h-13 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? React.Fragment : "button";
    if (asChild) {
      // Allow composing with <Link> etc. by cloning the single child
      return React.cloneElement(props.children, {
        className: cn(buttonVariants({ variant, size }), className),
        ref,
      });
    }
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
