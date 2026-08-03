import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Sparkles,
  Award,
  Zap,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroSlideshow from "@/components/home/HeroSlideshow";
import photoService from "@/services/photoService";
import packageService from "@/services/packageService";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const HIGHLIGHTS = [
  {
    icon: <Camera className="h-5 w-5 text-signature" />,
    title: "Medium Format & 35mm",
    desc: "Shot on high-resolution digital sensors & classic analog film stocks.",
  },
  {
    icon: <Zap className="h-5 w-5 text-signature" />,
    title: "48-Hour Previews",
    desc: "Receive your initial curated teaser set within two days of the shoot.",
  },
  {
    icon: <ShieldCheck className="h-5 w-5 text-signature" />,
    title: "Secure S3 Private Vault",
    desc: "1-year access to high-res downloads & password-protected client galleries.",
  },
  {
    icon: <Award className="h-5 w-5 text-signature" />,
    title: "Tailored Color Grading",
    desc: "Handcrafted color profiles tuned specifically for skin tones & natural light.",
  },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [photosRes, packagesRes] = await Promise.allSettled([
          photoService.getFeatured(),
          packageService.getPopular(),
        ]);
        if (cancelled) return;

        if (photosRes.status === "fulfilled") setFeatured(photosRes.value.data ?? []);
        if (packagesRes.status === "fulfilled") setPackages(packagesRes.value.data ?? []);
        if (photosRes.status === "rejected" && packagesRes.status === "rejected") {
          setErrored(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* ── HERO SECTION ──────────────────────── */}
      <HeroSlideshow>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="flex items-center gap-2 mb-4"
        >
          <span className="h-2 w-2 rounded-full bg-signature-tint animate-ping" />
          <p className="meta-caption text-white/80 tracking-widest">
            Lucent Studio · Photography &amp; Camera Rentals
          </p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-white text-[12vw] leading-[0.92] sm:text-6xl lg:text-[5.5rem] max-w-4xl font-normal tracking-tight"
        >
          Photographs that hold their light.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.6 }}
          className="text-white/70 mt-6 text-base sm:text-lg max-w-xl font-light leading-relaxed"
        >
          Documenting quiet elegance across weddings, portraits, and outdoor lifestyle sessions — with precision gear available for rental.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-wrap items-center gap-4 mt-9"
        >
          <Button variant="signature" size="lg" className="rounded-full shadow-lg" asChild>
            <Link to="/packages">
              Book a Session
              <ArrowUpRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="rounded-full !border-white/40 !text-white hover:!bg-white hover:!text-black transition-all"
            asChild
          >
            <Link to="/portfolio">Explore Portfolio</Link>
          </Button>
        </motion.div>
      </HeroSlideshow>

      {/* ── CRAFT HIGHLIGHTS STRIP ─────────────── */}
      <section className="bg-paper-dim border-y border-line py-16">
        <div className="container-page">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HIGHLIGHTS.map((item, i) => (
              <motion.div
                key={item.title}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                variants={fadeUp}
                transition={{ delay: i * 0.08 }}
                className="flex flex-col items-start p-6 rounded-xl bg-paper border border-line/80 shadow-subtle hover:shadow-card transition-all duration-300"
              >
                <div className="h-10 w-10 rounded-lg bg-signature-tint flex items-center justify-center mb-4">
                  {item.icon}
                </div>
                <h3 className="font-display text-lg text-ink font-medium mb-1.5">{item.title}</h3>
                <p className="text-sm text-mist leading-relaxed font-light">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED SESSIONS ──────────────────── */}
      <section className="container-page py-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-signature" />
              <p className="meta-caption text-signature">Curated Showcase</p>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl text-ink font-normal">
              Featured Sessions
            </h2>
          </div>
          <Link
            to="/portfolio"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-signature hover:underline underline-offset-4"
          >
            View Full Portfolio <ArrowUpRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {loading ? (
          <PhotoGridSkeleton />
        ) : featured.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {featured.slice(0, 8).map((photo, i) => (
              <motion.div
                key={photo._id || i}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.3 }}
                variants={fadeUp}
                transition={{ delay: (i % 4) * 0.06 }}
                className={i % 5 === 0 ? "col-span-2 row-span-2" : ""}
              >
                <Link to="/portfolio" className="block group relative overflow-hidden rounded-lg print-frame">
                  <div className="overflow-hidden aspect-[4/5] bg-paper-dim">
                    <img
                      src={photo.imageUrl || photo.url}
                      alt={photo.title || "Portfolio photograph"}
                      className="w-full h-full object-cover transition-transform duration-700 ease-signature group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-paper-dark/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5 text-white">
                    <p className="meta-caption !text-white/70 mb-1">{photo.category}</p>
                    <p className="font-display text-lg text-white">{photo.title || "Untitled Photograph"}</p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Camera className="h-6 w-6 text-signature" />}
            title="Portfolio Coming Into View"
            body={
              errored
                ? "We couldn't connect to the backend server. Please verify it is running on port 5000."
                : "Photographs will appear here once added to the studio archive."
            }
          />
        )}
      </section>

      {/* ── PACKAGES TEASER SECTION ────────────── */}
      {packages.length > 0 && (
        <section className="bg-paper-dim/60 border-y border-line py-24">
          <div className="container-page">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              variants={fadeUp}
              className="text-center max-w-2xl mx-auto mb-16"
            >
              <p className="meta-caption text-signature mb-2">Tailored Experiences</p>
              <h2 className="font-display text-3xl sm:text-5xl text-ink font-normal mb-4">
                Popular Photography Packages
              </h2>
              <p className="text-mist text-sm sm:text-base font-light">
                Transparent pricing with complete digital rights, edited high-resolution files &amp; prompt delivery.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {packages.slice(0, 3).map((pkg, i) => (
                <motion.div
                  key={pkg._id || i}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.3 }}
                  variants={fadeUp}
                  transition={{ delay: i * 0.08 }}
                  className={`bg-paper border rounded-2xl p-8 flex flex-col justify-between relative shadow-subtle hover:shadow-card transition-all duration-300 ${
                    pkg.isPopular ? "border-signature ring-1 ring-signature/30" : "border-line"
                  }`}
                >
                  {pkg.isPopular && (
                    <span className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-signature text-paper meta-caption !text-[10px]">
                      Most Popular
                    </span>
                  )}

                  <div>
                    <span className="meta-caption text-mist mb-2 block">{pkg.category}</span>
                    <h3 className="font-display text-2xl text-ink font-medium mb-2">{pkg.name}</h3>
                    <p className="text-sm text-mist leading-relaxed font-light mb-6">
                      {pkg.tagline || pkg.description}
                    </p>

                    {pkg.includes && pkg.includes.length > 0 && (
                      <div className="space-y-2.5 mb-8 pt-6 border-t border-line">
                        {pkg.includes.slice(0, 4).map((inc, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs text-ink-soft">
                            <CheckCircle2 className="h-4 w-4 text-signature shrink-0 mt-0.5" />
                            <span>{inc}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-6 border-t border-line flex items-end justify-between">
                    <div>
                      <div className="font-display text-3xl text-ink font-medium">
                        ₹{pkg.price?.amount?.toLocaleString?.("en-IN") ?? pkg.price?.amount}
                      </div>
                      <span className="text-xs text-mist font-mono">{pkg.price?.unit}</span>
                    </div>
                    <Button variant="signature" size="sm" className="rounded-full" asChild>
                      <Link to="/packages">Book Package</Link>
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button variant="outline" size="lg" className="rounded-full border-line hover:border-signature" asChild>
                <Link to="/packages">View All Photography &amp; Rental Packages</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIAL / REVIEWS ───────────────── */}
      <section className="container-page py-24 border-b border-line">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-1 mb-4 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-amber-500 text-amber-500" />
            ))}
          </div>
          <blockquote className="font-display text-2xl sm:text-4xl text-ink leading-snug font-light italic mb-6">
            &ldquo;Lucent Studio captured our wedding with such quiet restraint and timeless color work. Looking through our gallery feels like stepping back into the light of that day.&rdquo;
          </blockquote>
          <p className="meta-caption text-ink font-medium">Aarav &amp; Ananya Mehta</p>
          <p className="text-xs text-mist font-mono mt-1">Udaipur Destination Wedding · October 2025</p>
        </div>
      </section>

      {/* ── CLOSING CALL TO ACTION ─────────────── */}
      <section className="container-page py-28 text-center">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          className="max-w-2xl mx-auto"
        >
          <h2 className="font-display text-3xl sm:text-5xl text-ink font-normal mb-4">
            Have a date in mind? Let&apos;s put it on the calendar.
          </h2>
          <p className="text-mist text-base font-light mb-8">
            Reach out to discuss your event, schedule a portrait session, or reserve premium camera equipment.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button variant="signature" size="lg" className="rounded-full shadow-lg" asChild>
              <Link to="/packages">Start Your Booking</Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full border-line" asChild>
              <Link to="/cameras">Rent Camera Gear</Link>
            </Button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function PhotoGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="print-frame rounded-lg skeleton-shimmer aspect-[4/5]" />
      ))}
    </div>
  );
}

function EmptyState({ icon, title, body }) {
  return (
    <div className="border border-dashed border-line-strong rounded-2xl py-20 flex flex-col items-center text-center px-6 bg-paper-dim/40">
      <div className="h-12 w-12 rounded-full bg-signature-tint flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="font-display text-xl text-ink mb-2 font-normal">{title}</p>
      <p className="text-sm text-mist max-w-md font-light leading-relaxed">{body}</p>
    </div>
  );
}
