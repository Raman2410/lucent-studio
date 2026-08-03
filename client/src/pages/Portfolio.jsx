import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X, Maximize2, Sparkles, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchBar } from "@/components/ui/search-bar";
import photoService from "@/services/photoService";

const CATEGORIES = [
  { value: "", label: "All Work" },
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "commercial", label: "Commercial" },
  { value: "nature", label: "Nature" },
  { value: "street", label: "Street" },
];

export default function Portfolio() {
  const [photos, setPhotos] = useState([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const request = category
      ? photoService.getByCategory(category, { page: 1, limit: 50 })
      : photoService.getAll({ page: 1, limit: 50 });

    request
      .then((res) => {
        if (!cancelled) {
          setPhotos(res.data ?? []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || "Couldn't load the portfolio.");
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

  // client-side search over the already-fetched category's photos —
  // title/tags/category only, since getAllPhotos' .select() doesn't
  // return `description` (see Photo.model.js -> getAllPhotos)
  const visiblePhotos = search.trim()
    ? photos.filter((photo) => {
        const haystack = `${photo.title ?? ""} ${photo.category ?? ""} ${(photo.tags ?? []).join(" ")}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      })
    : photos;

  const activePhoto = lightboxIndex !== null ? visiblePhotos[lightboxIndex] : null;

  const nextLightbox = useCallback(() => {
    if (visiblePhotos.length === 0) return;
    setLightboxIndex((prev) => (prev !== null ? (prev + 1) % visiblePhotos.length : 0));
  }, [visiblePhotos.length]);

  const prevLightbox = useCallback(() => {
    if (visiblePhotos.length === 0) return;
    setLightboxIndex((prev) => (prev !== null ? (prev - 1 + visiblePhotos.length) % visiblePhotos.length : 0));
  }, [visiblePhotos.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") nextLightbox();
      if (e.key === "ArrowLeft") prevLightbox();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, nextLightbox, prevLightbox]);

  return (
    <div className="container-page py-16 sm:py-24">
      {/* Header */}
      <div className="mb-12 max-w-3xl">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-signature" />
          <p className="meta-caption text-signature">Studio Archive</p>
        </div>
        <h1 className="font-display text-4xl sm:text-6xl text-ink font-normal tracking-tight">
          Selected Portfolio
        </h1>
        <p className="text-mist mt-4 text-base leading-relaxed font-light">
          A curated collection of sessions across weddings, editorial portraits, commercial brand campaigns, and natural landscapes.
        </p>
      </div>

      {/* Category Filter Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-3 mb-10 pb-4 border-b border-line">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none flex-1">
          <Filter className="h-4 w-4 text-mist shrink-0 mr-1" />
          {CATEGORIES.map((cat) => {
            const active = category === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={cn(
                  "relative px-5 py-2 text-xs font-mono uppercase tracking-wider rounded-full transition-all duration-200 shrink-0 border",
                  active
                    ? "bg-signature text-paper border-signature shadow-sm font-medium"
                    : "bg-paper text-ink-soft border-line hover:border-signature/50 hover:text-ink"
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
        <SearchBar value={search} onChange={setSearch} placeholder="Search photos, tags…" />
      </div>

      {/* Photo Grid */}
      {loading ? (
        <GridSkeleton />
      ) : error ? (
        <ErrorState message={error} />
      ) : visiblePhotos.length === 0 ? (
        <EmptyState category={category} searching={!!search.trim()} />
      ) : (
        <motion.div
          key={category || "all"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
        >
          {visiblePhotos.map((photo, i) => (
            <motion.button
              key={photo._id || photo.id || i}
              type="button"
              onClick={() => setLightboxIndex(i)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: (i % 6) * 0.04,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="text-left group relative focus:outline-none"
            >
              <div className="print-frame overflow-hidden rounded-xl bg-paper">
                <div className="overflow-hidden aspect-[4/5] relative">
                  <img
                    src={photo.url || photo.imageUrl}
                    alt={photo.title || `${photo.category} photograph`}
                    className="w-full h-full object-cover transition-transform duration-700 ease-signature group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-paper-dark/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="h-10 w-10 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-black shadow-lg">
                      <Maximize2 className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-baseline justify-between mt-3 px-1">
                <span className="meta-caption text-signature font-medium">{photo.category}</span>
                {photo.title && (
                  <p className="text-xs text-mist font-light truncate ml-3 max-w-[200px]">
                    {photo.title}
                  </p>
                )}
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {activePhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-paper-dark/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
            onClick={() => setLightboxIndex(null)}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute top-6 right-6 z-20 h-10 w-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Prev / Next Arrows */}
            {visiblePhotos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevLightbox();
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextLightbox();
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 h-12 w-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            <div className="relative max-w-5xl max-h-[85vh] flex flex-col items-center">
              <motion.img
                key={activePhoto._id || lightboxIndex}
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                src={activePhoto.url || activePhoto.imageUrl}
                alt={activePhoto.title || activePhoto.category}
                className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              />

              <div className="mt-4 text-center max-w-xl">
                {activePhoto.title && (
                  <p className="font-display text-white text-xl font-normal">
                    {activePhoto.title}
                  </p>
                )}
                {activePhoto.description && (
                  <p className="text-xs text-white/70 font-light mt-1">
                    {activePhoto.description}
                  </p>
                )}
                <div className="flex items-center justify-center gap-3 mt-2">
                  <span className="meta-caption !text-white/50">{activePhoto.category}</span>
                  <span className="text-white/40">·</span>
                  <span className="text-xs font-mono text-white/50">
                    {lightboxIndex + 1} of {visiblePhotos.length}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="print-frame rounded-xl skeleton-shimmer aspect-[4/5]" />
      ))}
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="border border-dashed border-line-strong rounded-2xl py-20 text-center px-6 bg-paper-dim/40">
      <p className="font-display text-xl text-ink mb-2">Couldn&apos;t load the portfolio</p>
      <p className="text-sm text-mist font-light">{message}</p>
    </div>
  );
}

function EmptyState({ category, searching = false }) {
  return (
    <div className="border border-dashed border-line-strong rounded-2xl py-20 text-center px-6 bg-paper-dim/40">
      <p className="font-display text-xl text-ink mb-2">
        {searching
          ? "No photos match your search"
          : category
          ? `No ${category} photographs yet`
          : "Portfolio is empty"}
      </p>
      <p className="text-sm text-mist font-light">
        {searching ? "Try a different term or clear the search." : "Check back soon or explore another category tab."}
      </p>
    </div>
  );
}
