import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Select — underline-style dropdown matching Input/Textarea.
 * Pass <option> children as usual.
 */
const Select = React.forwardRef(({ className, error, children, ...props }, ref) => {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full appearance-none bg-transparent border-0 border-b py-2.5 pr-6 text-[15px] text-ink",
          "focus:outline-none focus:ring-0 transition-colors duration-200",
          error ? "border-b-red-400" : "border-b-line-strong focus:border-b-signature",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-mist" />
    </div>
  );
});
Select.displayName = "Select";

export { Select };
