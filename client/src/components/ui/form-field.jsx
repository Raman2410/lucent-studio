import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * FormField — label + Input + inline error, the unit every auth
 * and booking form is built from. Error text uses the same mono
 * caption styling as everywhere else, kept small and factual
 * rather than alarming (no red boxes, no icons).
 *
 * Pass `as="textarea"` to render a Textarea instead of Input for
 * longer free-text fields (query message, notes, etc.).
 */
export function FormField({ label, error, id, as = "input", ...inputProps }) {
  const Control = as === "textarea" ? Textarea : Input;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="meta-caption">
        {label}
      </label>
      <Control id={id} error={!!error} {...inputProps} />
      {error && (
        <p className="text-[12.5px] text-red-500/90 font-mono">{error}</p>
      )}
    </div>
  );
}
