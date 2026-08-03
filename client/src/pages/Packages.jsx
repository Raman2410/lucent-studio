import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { CheckCircle2, Sparkles, ArrowUpRight, HelpCircle, ShieldCheck, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { SearchBar } from "@/components/ui/search-bar";
import ReviewsModal from "@/components/reviews/ReviewsModal";
import { cn } from "@/lib/utils";
import packageService from "@/services/packageService";

const CATEGORIES = [
  { value: "", label: "All Packages" },
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "commercial", label: "Commercial" },
  { value: "nature", label: "Nature & Architecture" },
];

export default function Packages() {
  const location = useLocation();
  const preselectedDate = location.state?.preselectedDate ?? null;

  const [packages, setPackages] = useState([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewsModalPkg, setReviewsModalPkg] = useState(null); // package object or null
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const request = category
      ? packageService.getByCategory(category)
      : packageService.getAll();

    request
      .then((res) => {
        if (!cancelled) {
          setPackages(res.data ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Couldn't load pricing packages.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  // client-side search — the category filter already round-trips to
  // the API, but the full category's packages are in memory by the
  // time someone types, so filtering here avoids a request per keystroke
  const visiblePackages = search.trim()
    ? packages.filter((pkg) => {
        const haystack = `${pkg.name} ${pkg.tagline ?? ""} ${pkg.description ?? ""} ${pkg.category} ${pkg.type}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      })
    : packages;

  return (
    <div className="container-page py-16 sm:py-24">

      {/* pre-selected date banner — only shown when arriving from /availability */}
      {preselectedDate && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-8 px-4 py-3 bg-signature-tint border border-signature/25"
        >
          <CalendarDays className="h-4 w-4 text-signature shrink-0" strokeWidth={1.5} />
          <p className="text-[13.5px] text-signature-soft">
            <strong>{new Date(preselectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</strong>
            {" "}is available — choose a package to book it.
          </p>
        </motion.div>
      )}

      {/* Page Header */}
      <div className="mb-14 max-w-3xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-signature" />
          <p className="meta-caption text-signature">Transparent Pricing</p>
        </div>
        <h1 className="font-display text-4xl sm:text-6xl text-ink font-normal tracking-tight">
          Photography Packages &amp; Sessions
        </h1>
        <p className="text-mist mt-4 text-base leading-relaxed font-light">
          Every session includes full digital licensing, hand-retouched high-resolution images, and direct download links via private S3 vault.
        </p>
      </div>

      {/* Category Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3 mb-12 pb-4 border-b border-line">
        <div className="flex items-center gap-3 overflow-x-auto pb-1 sm:pb-0 flex-1">
          {CATEGORIES.map((cat) => {
            const active = category === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  "px-5 py-2.5 text-xs font-mono uppercase tracking-wider rounded-full transition-all duration-200 shrink-0 border",
                  active
                    ? "bg-signature text-paper border-signature shadow-sm font-semibold"
                    : "bg-paper text-ink-soft border-line hover:border-signature/50 hover:text-ink"
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search packages…" />
      </div>

      {/* Packages Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-96 rounded-2xl border border-line skeleton-shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="border border-dashed border-line-strong rounded-2xl py-20 text-center px-6 bg-paper-dim/40">
          <p className="font-display text-xl text-ink mb-2">Couldn&apos;t load packages</p>
          <p className="text-sm text-mist">{error}</p>
        </div>
      ) : visiblePackages.length === 0 ? (
        <div className="border border-dashed border-line-strong rounded-2xl py-20 text-center px-6 bg-paper-dim/40">
          <p className="font-display text-xl text-ink mb-2">
            {search.trim() ? "No packages match your search" : "No packages found for this category"}
          </p>
          <p className="text-sm text-mist">
            {search.trim() ? "Try a different term or clear the search." : "Please select another category tab above."}
          </p>
        </div>
      ) : (
        <motion.div
          key={category || "all"}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {visiblePackages.map((pkg) => (
            <div
              key={pkg._id}
              className={cn(
                "bg-paper border rounded-2xl p-8 flex flex-col justify-between relative shadow-subtle hover:shadow-card transition-all duration-300",
                pkg.isPopular ? "border-signature ring-1 ring-signature/30" : "border-line"
              )}
            >
              {pkg.isPopular && (
                <span className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-signature text-paper meta-caption !text-[10px]">
                  Most Popular
                </span>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="meta-caption text-signature">{pkg.category}</span>
                  <span className="text-xs font-mono text-mist uppercase">{pkg.type}</span>
                </div>
                <h3 className="font-display text-2xl text-ink font-normal mb-2">{pkg.name}</h3>
                <button
                  type="button"
                  onClick={() => setReviewsModalPkg(pkg)}
                  className="flex items-center gap-1.5 mb-3 hover:opacity-70 transition-opacity"
                >
                  <StarRating value={pkg.ratingsAverage} count={pkg.ratingsCount} />
                </button>
                <p className="text-sm text-mist font-light leading-relaxed mb-6">
                  {pkg.tagline || pkg.description}
                </p>

                {/* Included Features */}
                {pkg.includes && pkg.includes.length > 0 && (
                  <div className="space-y-3 mb-8 pt-6 border-t border-line">
                    <p className="text-xs font-mono text-ink uppercase tracking-wider mb-2">What&apos;s Included:</p>
                    {pkg.includes.map((inc, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-xs text-ink-soft">
                        <CheckCircle2 className="h-4 w-4 text-signature shrink-0 mt-0.5" />
                        <span>{inc}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Price & Action */}
              <div className="pt-6 border-t border-line flex items-end justify-between gap-4">
                <div>
                  <div className="font-display text-3xl text-ink font-medium">
                    ₹{pkg.price?.amount?.toLocaleString?.("en-IN") ?? pkg.price?.amount}
                  </div>
                  <span className="text-xs text-mist font-mono">{pkg.price?.unit}</span>
                </div>
                <Button variant="signature" size="default" className="rounded-full" asChild>
                  <Link
                    to={`/book/session/${pkg._id}`}
                    state={preselectedDate ? { preselectedDate } : undefined}
                  >
                    Book Session <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Trust & FAQ Strip */}
      <div className="mt-24 p-8 rounded-2xl bg-paper-dim/80 border border-line flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-signature/10 flex items-center justify-center text-signature shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-display text-lg text-ink font-medium">Need a Custom Commission?</h4>
            <p className="text-xs text-mist font-light">Custom wedding itineraries, commercial rights, &amp; multi-day shoots tailored to your vision.</p>
          </div>
        </div>
        <a
          href="mailto:hello@lucentstudio.com"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ink text-paper text-xs font-medium hover:bg-ink-soft transition-all"
        >
          <HelpCircle className="h-4 w-4" /> Request Custom Quote
        </a>
      </div>

      <ReviewsModal
        open={!!reviewsModalPkg}
        onClose={() => setReviewsModalPkg(null)}
        targetType="package"
        targetId={reviewsModalPkg?._id}
        title={reviewsModalPkg?.name}
      />
    </div>
  );
}
