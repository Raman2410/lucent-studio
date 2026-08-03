import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { StarRating } from "@/components/ui/star-rating";
import reviewService from "@/services/reviewService";

/**
 * ReviewsModal — GET /api/reviews/package/:id or /api/reviews/camera/:id
 * Fetches lazily on open so browsing the Packages/Cameras grid never
 * fires a request per card — only when someone actually taps "reviews".
 */
export default function ReviewsModal({ open, onClose, targetType, targetId, title }) {
  const [state, setState] = useState({ loading: true, reviews: [], average: 0, count: 0, error: "" });

  useEffect(() => {
    if (!open || !targetId) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));

    const request = targetType === "camera"
      ? reviewService.getForCamera(targetId, { limit: 20 })
      : reviewService.getForPackage(targetId, { limit: 20 });

    request
      .then((res) => {
        if (cancelled) return;
        setState({
          loading: false,
          reviews: res.data?.reviews ?? [],
          average: res.data?.ratingsAverage ?? 0,
          count: res.data?.ratingsCount ?? 0,
          error: "",
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ loading: false, reviews: [], average: 0, count: 0, error: err.message || "Couldn't load reviews." });
        }
      });

    return () => { cancelled = true; };
  }, [open, targetType, targetId]);

  return (
    <Modal open={open} onClose={onClose} title={title || "Reviews"}>
      {state.loading ? (
        <div className="flex items-center justify-center py-12 text-mist-light">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
        </div>
      ) : state.error ? (
        <p className="text-sm text-mist text-center py-8">{state.error}</p>
      ) : (
        <>
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-line">
            <StarRating value={state.average} size="lg" />
            <span className="text-sm text-mist">
              {state.average > 0 ? state.average.toFixed(1) : "No ratings yet"}
              {state.count > 0 && ` · ${state.count} review${state.count === 1 ? "" : "s"}`}
            </span>
          </div>

          {state.reviews.length === 0 ? (
            <p className="text-sm text-mist text-center py-8">
              No reviews yet — be the first to book and share your experience.
            </p>
          ) : (
            <div className="space-y-5">
              {state.reviews.map((review) => (
                <div key={review._id} className="pb-5 border-b border-line last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13.5px] font-medium text-ink">
                      {review.userSnapshot?.name || "Verified customer"}
                    </span>
                    <StarRating value={review.rating} />
                  </div>
                  {review.comment && (
                    <p className="text-[13.5px] text-mist leading-relaxed">{review.comment}</p>
                  )}
                  <p className="text-[11px] text-mist-light font-mono mt-1.5">
                    {new Date(review.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
