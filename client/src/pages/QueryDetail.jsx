import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Loader2, AlertCircle, Bot, ThumbsUp, ThumbsDown,
  CheckCircle2, XCircle, History, UserCog,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import queryService from "@/services/queryService";
import { cn } from "@/lib/utils";

const STATUS_META = {
  "Open":       { color: "text-amber-600",   bg: "bg-amber-50",      border: "border-amber-200" },
  "In Review":  { color: "text-blue-600",    bg: "bg-blue-50",       border: "border-blue-200" },
  "Resolved":   { color: "text-signature",   bg: "bg-signature-tint",border: "border-signature/20" },
  "Closed":     { color: "text-mist",        bg: "bg-paper-dim",     border: "border-line" },
};

const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" }) : "—";

/**
 * QueryDetail — single-query view at GET /api/queries/:id. Shows the
 * original message, the AI's response (with a thumbs up/down rating
 * that hits PATCH /:id/rate), any team follow-up, and a close action
 * for resolved queries the user is done with.
 */
export default function QueryDetail() {
  const { id } = useParams();

  const [query, setQuery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    queryService
      .getById(id)
      .then((res) => { if (!cancelled) setQuery(res.data); })
      .catch((err) => { if (!cancelled) setError(err.message || "Couldn't load this query."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [id]);

  const handleRate = async (wasHelpful) => {
    setRating(true);
    setActionError("");
    try {
      await queryService.rate(id, wasHelpful);
      setQuery((q) => ({ ...q, aiResponse: { ...q.aiResponse, wasHelpful } }));
    } catch (err) {
      setActionError(err.message || "Couldn't save your rating.");
    } finally {
      setRating(false);
    }
  };

  const handleClose = async () => {
    if (!window.confirm("Close this query? You won't be able to reopen it.")) return;
    setClosing(true);
    setActionError("");
    try {
      const res = await queryService.close(id);
      setQuery((q) => ({ ...q, status: res.data.status }));
    } catch (err) {
      setActionError(err.message || "Couldn't close this query.");
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex items-center justify-center text-mist-light">
        <Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} />
      </div>
    );
  }

  if (error || !query) {
    return (
      <div className="container-page py-24 text-center">
        <AlertCircle className="h-6 w-6 text-mist mx-auto mb-3" strokeWidth={1.5} />
        <p className="font-display text-xl text-ink mb-2">Couldn't load this query</p>
        <p className="text-sm text-mist mb-6">{error}</p>
        <Button variant="outline" asChild>
          <Link to="/help">Back to Help Center</Link>
        </Button>
      </div>
    );
  }

  const meta = STATUS_META[query.status] ?? STATUS_META["Open"];
  const canClose = query.status !== "Closed";
  const hasRated = query.aiResponse?.wasHelpful !== null && query.aiResponse?.wasHelpful !== undefined;

  return (
    <div className="container-page py-16 sm:py-20">
      <div className="max-w-2xl mx-auto">
        <Link
          to="/help"
          className="inline-flex items-center gap-1.5 text-[13px] text-mist hover:text-signature transition-colors mb-8"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          Help Center
        </Link>

        {/* header */}
        <div className="mb-8 pb-8 border-b border-line">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <p className="meta-caption">{query.queryRef}</p>
            <span className={cn("px-2 py-0.5 text-[11.5px] font-mono border", meta.bg, meta.border, meta.color)}>
              {query.status}
            </span>
            <span className="px-2 py-0.5 text-[11.5px] font-mono border border-line text-mist capitalize">
              {query.category}
            </span>
          </div>
          <h1 className="font-display text-3xl text-ink mb-2">{query.subject}</h1>
          <p className="text-mist text-sm">Submitted {formatDateTime(query.createdAt)}</p>
        </div>

        {/* original message */}
        <div className="mb-8 pb-8 border-b border-line">
          <p className="meta-caption mb-3">Your message</p>
          <p className="text-[14.5px] text-ink leading-relaxed whitespace-pre-wrap">{query.message}</p>
          {query.relatedBooking?.bookingRef && (
            <p className="mt-4 text-[13px] text-mist">
              Related booking:{" "}
              <Link to={`/bookings/${query.relatedBooking._id}`} className="font-mono text-signature hover:underline">
                {query.relatedBooking.bookingRef}
              </Link>
            </p>
          )}
        </div>

        {/* AI response */}
        {query.aiResponse?.content ? (
          <div className="mb-8 pb-8 border-b border-line">
            <p className="meta-caption mb-3 flex items-center gap-2">
              <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
              AI response
            </p>
            <div className="bg-paper-dim border border-line p-5">
              <p className="text-[14.5px] text-ink leading-relaxed whitespace-pre-wrap">
                {query.aiResponse.content}
              </p>
            </div>

            {/* rating */}
            <div className="flex items-center gap-3 mt-4">
              {hasRated ? (
                <p className="text-[13px] text-mist flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-signature" strokeWidth={1.5} />
                  You marked this as {query.aiResponse.wasHelpful ? "helpful" : "not helpful"}
                </p>
              ) : (
                <>
                  <span className="text-[13px] text-mist">Was this helpful?</span>
                  <button
                    type="button"
                    onClick={() => handleRate(true)}
                    disabled={rating}
                    className="p-1.5 border border-line hover:border-signature/50 hover:text-signature transition-colors disabled:opacity-40"
                    aria-label="Helpful"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRate(false)}
                    disabled={rating}
                    className="p-1.5 border border-line hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-40"
                    aria-label="Not helpful"
                  >
                    <ThumbsDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                </>
              )}
            </div>

            {query.aiResponse.escalated && (
              <p className="mt-3 text-[12.5px] text-mist-light flex items-center gap-1.5">
                <UserCog className="h-3.5 w-3.5" strokeWidth={1.5} />
                This was flagged for our team to follow up personally.
              </p>
            )}
          </div>
        ) : (
          <div className="mb-8 pb-8 border-b border-line">
            <p className="meta-caption mb-3 flex items-center gap-2">
              <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
              AI response
            </p>
            <p className="text-[13.5px] text-mist-light italic">
              Our AI is still preparing a response — refresh in a moment.
            </p>
          </div>
        )}

        {/* team response */}
        {query.teamResponse?.content && (
          <div className="mb-8 pb-8 border-b border-line">
            <p className="meta-caption mb-3 flex items-center gap-2">
              <UserCog className="h-3.5 w-3.5" strokeWidth={1.5} />
              Team response
            </p>
            <div className="bg-signature-tint border border-signature/20 p-5">
              <p className="text-[14.5px] text-ink leading-relaxed whitespace-pre-wrap">
                {query.teamResponse.content}
              </p>
            </div>
            <p className="text-[12.5px] text-mist-light mt-2">
              {formatDateTime(query.teamResponse.respondedAt)}
            </p>
          </div>
        )}

        {/* status history */}
        {query.statusHistory?.length > 0 && (
          <div className="mb-10">
            <p className="meta-caption mb-4 flex items-center gap-2">
              <History className="h-3.5 w-3.5" strokeWidth={1.5} />
              History
            </p>
            <div className="space-y-3">
              {query.statusHistory.map((h, i) => (
                <div key={i} className="flex items-baseline justify-between text-[13.5px]">
                  <span className="text-ink">{h.status}{h.note ? ` · ${h.note}` : ""}</span>
                  <span className="text-mist-light font-mono text-[12px] shrink-0 ml-4">{formatDateTime(h.changedAt)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {actionError && (
          <p className="text-[13px] text-red-500/90 font-mono mb-4">{actionError}</p>
        )}

        {/* actions */}
        {canClose && (
          <button
            type="button"
            onClick={handleClose}
            disabled={closing}
            className="flex items-center gap-1.5 text-[13px] text-mist hover:text-signature transition-colors disabled:opacity-40"
          >
            <XCircle className="h-4 w-4" strokeWidth={1.5} />
            {closing ? "Closing…" : "Close this query"}
          </button>
        )}
      </div>
    </div>
  );
}
