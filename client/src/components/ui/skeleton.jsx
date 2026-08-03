import { cn } from "@/lib/utils";

/**
 * Base shimmer block. Compose the pieces below for common shapes,
 * or drop this in directly with a custom className for one-offs.
 */
export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md", className)}
      aria-hidden="true"
      {...props}
    />
  );
}

/** A block of placeholder text lines, last line shorter by default. */
export function SkeletonText({ lines = 2, className, lastLineWidth = "60%" }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5"
          style={i === lines - 1 && lines > 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

/** Portrait/landscape media card — mirrors the print-frame photo cards. */
export function SkeletonCard({ aspect = "aspect-[4/5]", className }) {
  return <Skeleton className={cn("print-frame rounded-xl", aspect, className)} />;
}

/** Grid of skeleton cards, e.g. photo/package/camera grids. */
export function SkeletonGrid({
  count = 6,
  cols = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  gap = "gap-6 sm:gap-8",
  aspect = "aspect-[4/5]",
  className,
}) {
  return (
    <div className={cn("grid", cols, gap, className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} aspect={aspect} />
      ))}
    </div>
  );
}

/** A single bordered row placeholder — mirrors booking/query list rows. */
export function SkeletonRow({ className }) {
  return (
    <div className={cn("border border-line rounded-xl p-5 sm:p-6", className)}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-5 w-20 rounded-full shrink-0" />
      </div>
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

/** Stacked list of row placeholders. */
export function SkeletonList({ count = 3, className }) {
  return (
    <div className={cn("space-y-4", className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/**
 * Table body placeholder. Renders `rows` <tr> elements with `cols` shimmer
 * cells, so it can be dropped straight inside an existing <table>/<tbody>.
 */
export function SkeletonTable({ rows = 5, cols = 4, className }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className={cn("border-b border-line", className)}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="py-4 px-4">
              <Skeleton className="h-3.5" style={{ width: c === 0 ? "70%" : "50%" }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Compact placeholder for stat/metric cards (e.g. admin dashboard tiles). */
export function SkeletonStat({ className }) {
  return (
    <div className={cn("border border-line rounded-xl p-5", className)}>
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-16" />
    </div>
  );
}
