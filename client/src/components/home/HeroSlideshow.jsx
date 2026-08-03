import { useEffect, useState, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Sliders } from "lucide-react";
import { cn } from "@/lib/utils";
import photoService from "@/services/photoService";

const GENRES = [
  {
    caption: "Mountains & High Range",
    query: { tag: "mountain" },
    exif: "F/5.6 · 1/1000s · ISO 100",
    fallback:
      "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=1800&auto=format&fit=crop",
  },
  {
    caption: "Rivers & Waterscapes",
    query: { tag: "river" },
    exif: "F/8.0 · 1/250s · ISO 200",
    fallback:
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1800&auto=format&fit=crop",
  },
  {
    caption: "Wild Avian Life",
    query: { tag: "bird" },
    exif: "F/4.0 · 1/2000s · ISO 400",
    fallback:
      "https://images.unsplash.com/photo-1444464666168-49d633b86797?q=80&w=1800&auto=format&fit=crop",
  },
  {
    caption: "Weddings & Ceremonies",
    query: { category: "wedding" },
    exif: "F/1.8 · 1/500s · ISO 160",
    fallback:
      "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1800&auto=format&fit=crop",
  },
  {
    caption: "Personal Portraits",
    query: { category: "portrait" },
    exif: "F/1.4 · 1/320s · ISO 100",
    fallback:
      "https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=1800&auto=format&fit=crop",
  },
];

const AUTOPLAY_MS = 6000;

export default function HeroSlideshow({ children }) {
  const [slides, setSlides] = useState(null);
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSlides() {
      try {
        const results = await Promise.allSettled(
          GENRES.map((g) => photoService.getAll({ limit: 1, ...g.query }))
        );

        const built = GENRES.map((genre, i) => {
          const res = results[i];
          const photo =
            res.status === "fulfilled" ? res.value.data?.[0] : undefined;

          return {
            caption: genre.caption,
            image: photo?.url || genre.fallback,
            meta: photo?.title || photo?.description || Object.values(genre.query)[0],
            exif: genre.exif,
            isPlaceholder: !photo,
          };
        });

        if (!cancelled) setSlides(built);
      } catch {
        if (!cancelled) {
          setSlides(
            GENRES.map((g) => ({
              caption: g.caption,
              image: g.fallback,
              meta: Object.values(g.query)[0],
              exif: g.exif,
              isPlaceholder: true,
            }))
          );
        }
      }
    }

    loadSlides();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const goTo = useCallback(
    (i) => {
      if (!slides) return;
      setIndex((i + slides.length) % slides.length);
    },
    [slides]
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  useEffect(() => {
    if (reducedMotion || !slides) return;
    timerRef.current = setTimeout(next, AUTOPLAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [index, next, reducedMotion, slides]);

  const restartAutoplay = () => {
    clearTimeout(timerRef.current);
  };

  if (!slides) {
    return (
      <section className="relative h-[88vh] min-h-[580px] w-full overflow-hidden bg-ink">
        <div className="absolute inset-0 skeleton-shimmer opacity-20" />
        <div className="relative z-10 h-full container-page flex flex-col justify-end pb-32">
          {children}
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative h-[90vh] min-h-[620px] w-full overflow-hidden bg-ink"
      aria-roledescription="carousel"
      aria-label="Studio work by genre"
    >
      {/* Slides with smooth crossfade */}
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <motion.img
            src={slides[index].image}
            alt={`${slides[index].caption} — studio photography sample`}
            initial={reducedMotion ? false : { scale: 1 }}
            animate={reducedMotion ? {} : { scale: 1.07 }}
            transition={{ duration: AUTOPLAY_MS / 1000 + 1, ease: "linear" }}
            className="h-full w-full object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Dark overlay gradients — uses paper-dark (always near-black,
          in both light AND dark theme) rather than ink, which flips to
          near-white in dark mode. Using ink here made the scrim turn
          into a light haze over the photos whenever dark mode was on. */}
      <div className="absolute inset-0 bg-gradient-to-t from-paper-dark via-paper-dark/30 to-paper-dark/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-paper-dark/60 via-transparent to-paper-dark/40 pointer-events-none" />

      {/* Prev / Next controls — fixed white/black (not the ink/paper
          tokens) since these always sit on a dark photo scrim and
          must look the same regardless of site theme. */}
      <button
        type="button"
        onClick={() => {
          restartAutoplay();
          prev();
        }}
        aria-label="Previous slide"
        className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-20 h-12 w-12 flex items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md text-white transition-all duration-300 hover:bg-white hover:text-black hover:scale-105"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
      </button>
      <button
        type="button"
        onClick={() => {
          restartAutoplay();
          next();
        }}
        aria-label="Next slide"
        className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-20 h-12 w-12 flex items-center justify-center rounded-full border border-white/20 bg-black/40 backdrop-blur-md text-white transition-all duration-300 hover:bg-white hover:text-black hover:scale-105"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
      </button>

      {/* Hero copy passed in from Home.jsx */}
      <div className="relative z-10 h-full container-page flex flex-col justify-end pb-32 sm:pb-28">
        {children}
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-8 left-0 right-0 z-10">
        <div className="container-page flex items-end justify-between gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-[10px] font-mono text-white/90 uppercase tracking-widest">
                  {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
                </span>
                <span className="text-xs font-mono text-white/60 flex items-center gap-1.5">
                  <Sliders className="h-3 w-3 text-signature-tint" />
                  {slides[index].exif}
                </span>
              </div>
              <h2 className="font-display text-white text-2xl sm:text-4xl font-normal">
                {slides[index].caption}
              </h2>
            </motion.div>
          </AnimatePresence>

          {/* Slide dots */}
          <div className="hidden sm:flex items-center gap-2 pb-1.5">
            {slides.map((slide, i) => (
              <button
                key={slide.caption}
                type="button"
                onClick={() => {
                  restartAutoplay();
                  goTo(i);
                }}
                aria-label={`Show ${slide.caption} slide`}
                className="group relative h-6 w-6 flex items-center justify-center"
              >
                <span
                  className={cn(
                    "block rounded-full transition-all duration-300",
                    i === index
                      ? "h-2 w-7 bg-white shadow-glow"
                      : "h-2 w-2 bg-white/40 group-hover:bg-white/70"
                  )}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
