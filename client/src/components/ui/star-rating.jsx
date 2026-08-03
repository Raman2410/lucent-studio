import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StarRating — read-only star display.
 * value: number 0-5, can be fractional (e.g. 4.3) for averages.
 */
export function StarRating({ value = 0, count, size = "sm", className }) {
  const sizeClass = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = value >= i + 1;
          const half = !filled && value > i && value < i + 1;
          return (
            <span key={i} className="relative inline-block">
              <Star className={cn(sizeClass, "text-line-strong")} strokeWidth={1.5} />
              {(filled || half) && (
                <Star
                  className={cn(sizeClass, "absolute inset-0 text-signature fill-signature")}
                  strokeWidth={1.5}
                  style={half ? { clipPath: "inset(0 50% 0 0)" } : undefined}
                />
              )}
            </span>
          );
        })}
      </div>
      {typeof count === "number" && (
        <span className="text-xs text-mist font-mono">
          {value > 0 ? value.toFixed(1) : "New"}
          {count > 0 && ` (${count})`}
        </span>
      )}
    </div>
  );
}

/**
 * StarRatingInput — interactive 1-5 picker for the review form.
 */
export function StarRatingInput({ value, onChange, size = "lg" }) {
  const sizeClass = size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const filled = starValue <= value;
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={filled}
            aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
            onClick={() => onChange(starValue)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              className={cn(sizeClass, filled ? "text-signature fill-signature" : "text-line-strong")}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}
