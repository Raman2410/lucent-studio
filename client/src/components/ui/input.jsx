import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input — underline-style field rather than a boxed one, to keep
 * forms feeling like the rest of the paper/print aesthetic instead
 * of dropping in a generic bordered box. Label + error are handled
 * by the consuming form (FormField), this is just the control.
 */
const Input = React.forwardRef(({ className, type = "text", error, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "w-full bg-transparent border-0 border-b py-2.5 text-[15px] text-ink",
        "placeholder:text-mist-light",
        "focus:outline-none focus:ring-0 transition-colors duration-200",
        error ? "border-b-red-400" : "border-b-line-strong focus:border-b-signature",
        className
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
