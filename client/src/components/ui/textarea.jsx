import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea — same underline-field language as Input, for the
 * longer free-text fields (query message, cancellation reason, etc.)
 */
const Textarea = React.forwardRef(({ className, error, rows = 4, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full bg-transparent border-0 border-b py-2.5 text-[15px] text-ink resize-none",
        "placeholder:text-mist-light",
        "focus:outline-none focus:ring-0 transition-colors duration-200",
        error ? "border-b-red-400" : "border-b-line-strong focus:border-b-signature",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
