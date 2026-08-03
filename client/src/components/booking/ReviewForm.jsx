import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRatingInput } from "@/components/ui/star-rating";
import reviewService from "@/services/reviewService";

/**
 * ReviewForm — POST /api/reviews { bookingId, rating, comment }
 * Rendered on BookingDetail for the booking owner once status is
 * "Completed" and booking.hasReview is still false (see review.controller.js
 * -> createReview for the same eligibility rules enforced server-side).
 */
export default function ReviewForm({ bookingId, itemName, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (rating < 1) {
      setError("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      await reviewService.create({ bookingId, rating, comment });
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setError(err.message || "Couldn't submit your review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2.5 text-[14px] text-signature">
        <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        Thanks — your review has been posted.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-[14px] text-ink mb-2">
          How was {itemName ? <strong>{itemName}</strong> : "your experience"}?
        </p>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      <Textarea
        placeholder="Share a few words about your experience (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={1000}
        rows={3}
      />

      {error && (
        <p className="text-xs font-mono text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
          {error}
        </p>
      )}

      <Button type="submit" variant="signature" size="default" disabled={submitting} className="rounded-full">
        {submitting ? "Submitting…" : "Submit Review"}
      </Button>
    </form>
  );
}
