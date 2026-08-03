import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Camera, Sliders, CheckCircle2, ShieldCheck, ArrowUpRight, Zap, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/ui/star-rating";
import { SearchBar } from "@/components/ui/search-bar";
import ReviewsModal from "@/components/reviews/ReviewsModal";
import cameraService from "@/services/cameraService";

export default function Cameras() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rateType, setRateType] = useState("daily"); // "hourly" | "daily" | "weekend"
  const [reviewsModalCam, setReviewsModalCam] = useState(null); // camera object or null
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    cameraService
      .getAll()
      .then((res) => {
        if (!cancelled) setCameras(res.data ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Couldn't load camera equipment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const visibleCameras = search.trim()
    ? cameras.filter((cam) => {
        const haystack = `${cam.brand} ${cam.name} ${cam.description ?? ""} ${cam.specs?.sensorType ?? ""} ${cam.specs?.mountType ?? ""}`.toLowerCase();
        return haystack.includes(search.trim().toLowerCase());
      })
    : cameras;

  return (
    <div className="container-page py-16 sm:py-24">
      {/* Header */}
      <div className="mb-14 max-w-3xl">
        <div className="flex items-center gap-2 mb-2">
          <Camera className="h-4 w-4 text-signature" />
          <p className="meta-caption text-signature">Studio Gear Vault</p>
        </div>
        <h1 className="font-display text-4xl sm:text-6xl text-ink font-normal tracking-tight">
          Camera Body &amp; Lens Rentals
        </h1>
        <p className="text-mist mt-4 text-base leading-relaxed font-light">
          Rent flagship full-frame &amp; medium format cameras, prime lenses, and power kits for your independent productions and photo sessions.
        </p>
      </div>

      {/* Rate Type Selector + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12 pb-6 border-b border-line">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-mist" />
          <span className="text-xs font-mono text-ink uppercase tracking-wider">Rental Duration Rate:</span>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 bg-paper-dim rounded-full border border-line">
            {["hourly", "daily", "weekend"].map((type) => (
              <button
                key={type}
                onClick={() => setRateType(type)}
                className={`px-4 py-1.5 text-xs font-mono capitalize rounded-full transition-all ${
                  rateType === type
                    ? "bg-signature text-paper font-medium shadow-sm"
                    : "text-mist hover:text-ink"
                }`}
              >
                {type} Rate
              </button>
            ))}
          </div>
          <SearchBar value={search} onChange={setSearch} placeholder="Search gear…" />
        </div>
      </div>

      {/* Equipment Grid */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 rounded-2xl border border-line skeleton-shimmer" />
          ))}
        </div>
      ) : error ? (
        <div className="border border-dashed border-line-strong rounded-2xl py-20 text-center px-6 bg-paper-dim/40">
          <p className="font-display text-xl text-ink mb-2">Couldn&apos;t load camera gear</p>
          <p className="text-sm text-mist">{error}</p>
        </div>
      ) : visibleCameras.length === 0 ? (
        <div className="border border-dashed border-line-strong rounded-2xl py-20 text-center px-6 bg-paper-dim/40">
          <p className="font-display text-xl text-ink mb-2">
            {search.trim() ? "No gear matches your search" : "No cameras currently available for rental"}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {visibleCameras.map((cam) => (
            <div
              key={cam._id}
              className="bg-paper border border-line rounded-2xl overflow-hidden shadow-subtle hover:shadow-card transition-all duration-300 flex flex-col"
            >
              <div className="flex flex-col sm:flex-row">
                {/* Camera photo — side panel */}
                <div className="sm:w-2/5 shrink-0 relative aspect-[4/3] sm:aspect-auto bg-paper-dim">
                  {cam.image?.url ? (
                    <img
                      src={cam.image.url}
                      alt={cam.fullName || `${cam.brand} ${cam.name}`}
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Camera className="h-8 w-8 text-mist-light" strokeWidth={1.25} />
                    </div>
                  )}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-paper/90 backdrop-blur-sm text-emerald-700 border border-emerald-200 text-[11px] font-mono flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Available
                  </span>
                </div>

                {/* Details */}
                <div className="flex-1 p-6 sm:p-7 flex flex-col">
                  <div className="mb-4">
                    <span className="meta-caption text-signature">{cam.brand}</span>
                    <h3 className="font-display text-2xl text-ink font-normal mt-1">{cam.name}</h3>
                    <button
                      type="button"
                      onClick={() => setReviewsModalCam(cam)}
                      className="flex items-center gap-1.5 mt-1.5 hover:opacity-70 transition-opacity"
                    >
                      <StarRating value={cam.ratingsAverage} count={cam.ratingsCount} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-5 p-4 rounded-xl bg-paper-dim/60 border border-line/60">
                    <div>
                      <span className="text-[10px] font-mono text-mist uppercase">Sensor</span>
                      <p className="text-xs font-medium text-ink truncate">{cam.specs?.sensorType || "Full Frame"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-mist uppercase">Resolution</span>
                      <p className="text-xs font-medium text-ink">{cam.specs?.megapixels} MP</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-mist uppercase">Video Spec</span>
                      <p className="text-xs font-medium text-ink truncate">{cam.specs?.videoResolution || "4K 60p"}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-mist uppercase">Mount</span>
                      <p className="text-xs font-medium text-ink truncate">{cam.specs?.mountType}</p>
                    </div>
                  </div>

                  <p className="text-sm text-mist font-light leading-relaxed">
                    {cam.description}
                  </p>
                </div>
              </div>

              {/* Accessories — visual strip so the renter can see exactly what's included */}
              {cam.accessories && cam.accessories.length > 0 && (
                <div className="px-6 sm:px-7 py-5 border-t border-line bg-paper-dim/30">
                  <p className="text-xs font-mono text-ink uppercase tracking-wider mb-3">
                    Available Lenses &amp; Kits
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
                    {cam.accessories
                      .filter((acc) => acc.isAvailable !== false)
                      .map((acc, idx) => (
                        <div
                          key={idx}
                          className="shrink-0 w-32 rounded-xl border border-line bg-paper overflow-hidden group"
                          title={acc.description || acc.name}
                        >
                          <div className="relative h-20 w-full bg-paper-dim">
                            {acc.image?.url ? (
                              <img
                                src={acc.image.url}
                                alt={acc.name}
                                className="absolute inset-0 h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-mist-light" strokeWidth={1.25} />
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-[11px] font-medium text-ink leading-tight line-clamp-2 min-h-[2.2em]">
                              {acc.name}
                            </p>
                            <p className="text-[10px] font-mono text-mist mt-1">
                              {acc.additionalCharge > 0 ? (
                                `+₹${acc.additionalCharge}`
                              ) : (
                                <span className="flex items-center gap-1 text-signature">
                                  <CheckCircle2 className="h-3 w-3" /> Included
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Price & Action */}
              <div className="px-6 sm:px-7 py-5 border-t border-line flex items-end justify-between gap-4">
                <div>
                  <div className="font-display text-3xl text-ink font-medium">
                    ₹{cam.rentalRates?.[rateType]?.toLocaleString?.("en-IN") ?? cam.rentalRates?.[rateType]}
                  </div>
                  <span className="text-xs text-mist font-mono">per {rateType}</span>
                </div>
                <Button variant="signature" size="default" className="rounded-full" asChild>
                  <Link to={`/book/rental/${cam._id}`}>
                    Reserve Gear <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Security Terms Banner */}
      <div className="mt-20 p-8 rounded-2xl bg-paper-dim/80 border border-line flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-signature/10 flex items-center justify-center text-signature shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-display text-lg text-ink font-medium">Rental Checklist &amp; Policy</h4>
            <p className="text-xs text-mist font-light">Valid Government ID &amp; refundable security deposit required upon pickup. Sanitized &amp; tested before every handover.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-signature font-medium">
          <Zap className="h-4 w-4" /> Express Pickup Available
        </div>
      </div>

      <ReviewsModal
        open={!!reviewsModalCam}
        onClose={() => setReviewsModalCam(null)}
        targetType="camera"
        targetId={reviewsModalCam?._id}
        title={reviewsModalCam?.name}
      />
    </div>
  );
}
