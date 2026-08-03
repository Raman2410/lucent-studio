import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * On-brand empty / error state — the dashed-border block already used
 * across Portfolio, MyBookings, Packages, HelpCenter, etc, consolidated
 * into one component so every list gets the same look and the same
 * gentle entrance animation.
 *
 *   <EmptyState
 *     icon={CalendarDays}
 *     title="No bookings yet"
 *     description="Book a photography session or camera rental to get started."
 *     action={<Button asChild variant="signature"><Link to="/packages">Browse packages</Link></Button>}
 *   />
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "empty", // "empty" | "error"
  size = "md", // "sm" | "md" | "lg"
  className,
}) {
  const padding = { sm: "py-12", md: "py-16 sm:py-20", lg: "py-24" }[size];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "border border-dashed border-line-strong rounded-2xl text-center px-6 bg-paper-dim/40",
        padding,
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "mx-auto mb-4 h-11 w-11 rounded-full flex items-center justify-center",
            tone === "error" ? "bg-red-50" : "bg-signature-tint"
          )}
        >
          <Icon
            className={cn("h-5 w-5", tone === "error" ? "text-red-500" : "text-signature")}
            strokeWidth={1.5}
          />
        </div>
      )}
      {title && <p className="font-display text-xl text-ink mb-2">{title}</p>}
      {description && (
        <p className="text-sm text-mist font-light max-w-sm mx-auto">{description}</p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </motion.div>
  );
}
