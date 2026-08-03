import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal — bare-bones dialog primitive. No portal (not needed at this
 * app's scale — nothing else renders position:fixed at root), just
 * a fixed overlay + centered panel. Escape + backdrop click close it.
 */
export function Modal({ open, onClose, title, children, className }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-paper-dark/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative bg-paper border border-line rounded-lg shadow-card w-full max-w-lg max-h-[90vh] overflow-y-auto",
          className
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-paper z-10">
          <h2 className="text-base font-display font-medium text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="text-mist hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * ConfirmDialog — Modal preset for destructive confirmations
 * (delete photo, delete package, etc.)
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description,
  confirmLabel = "Delete",
  loading = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-sm">
      <div className="space-y-5">
        {description && <p className="text-sm text-mist">{description}</p>}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 h-9 text-[13px] font-medium text-ink border border-line rounded-[2px] hover:bg-paper-dim transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 h-9 text-[13px] font-medium text-paper bg-red-600 hover:bg-red-700 rounded-[2px] transition-colors disabled:opacity-40"
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
