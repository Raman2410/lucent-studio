import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * SearchBar — a rounded search pill matching the category-tab styling
 * used on Packages/Cameras/Portfolio. Purely a controlled input;
 * filtering happens client-side in the consuming page since these
 * lists are already fetched in full (see each page's useEffect).
 */
export function SearchBar({ value, onChange, placeholder = "Search…", className }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-4 h-10 rounded-full border border-line bg-paper focus-within:border-signature/50 transition-colors shrink-0 w-full sm:w-64",
        className
      )}
    >
      <Search className="h-3.5 w-3.5 text-mist shrink-0" strokeWidth={1.5} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent text-[13.5px] text-ink placeholder:text-mist-light focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-mist hover:text-ink transition-colors shrink-0"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
