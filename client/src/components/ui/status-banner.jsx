import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StatusBanner — inline success/error feedback for admin CRUD actions.
 * Pass `status` = { type: "success" | "error", message } | null.
 */
export function StatusBanner({ status, onDismiss }) {
  if (!status) return null;

  const isError = status.type === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-md border px-3.5 py-2.5 text-[13px]",
        isError
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-signature-tint text-signature border-signature/25"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{status.message}</span>
      <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
