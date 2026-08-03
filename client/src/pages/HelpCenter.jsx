import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageCircleQuestion, Plus, X, AlertCircle, Sparkles,
  Bot, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import queryService from "@/services/queryService";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "booking", label: "Booking" },
  { value: "packages", label: "Packages" },
  { value: "rental", label: "Camera rental" },
  { value: "payment", label: "Payment" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
];

const STATUS_TABS = ["All", "Open", "In Review", "Resolved", "Closed"];

const STATUS_META = {
  "Open":       { color: "text-amber-600",   bg: "bg-amber-50",      border: "border-amber-200" },
  "In Review":  { color: "text-blue-600",    bg: "bg-blue-50",       border: "border-blue-200" },
  "Resolved":   { color: "text-signature",   bg: "bg-signature-tint",border: "border-signature/20" },
  "Closed":     { color: "text-mist",        bg: "bg-paper-dim",     border: "border-line" },
};

/**
 * HelpCenter — frontend for /api/queries, which previously had no
 * UI at all despite being a fully built backend module (AI-answered
 * help tickets with team follow-up). Users can submit a new query
 * here and see the status/AI response of ones they've already sent.
 * The chat widget in the header handles instant Q&A; this page is
 * for the "leave a message, get a tracked answer" flow.
 */
export default function HelpCenter() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "general", message: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(null); // queryRef

  const loadQueries = (status) => {
    setLoading(true);
    setError("");
    queryService
      .getMyQueries(status && status !== "All" ? { status } : {})
      .then((res) => setQueries(res.data ?? []))
      .catch((err) => setError(err.message || "Couldn't load your queries."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQueries(statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const validate = () => {
    const errs = {};
    if (form.subject.trim().length < 5) errs.subject = "Subject must be at least 5 characters";
    if (form.message.trim().length < 10) errs.message = "Please add a bit more detail (10+ characters)";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await queryService.create(form);
      setJustSubmitted(res.data.queryRef);
      setForm({ subject: "", category: "general", message: "" });
      setShowForm(false);
      loadQueries(statusFilter);
      setTimeout(() => setJustSubmitted(null), 6000);
    } catch (err) {
      setSubmitError(err.message || "Couldn't submit your query. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page py-16 sm:py-20">
      <div className="max-w-3xl mx-auto">

        {/* header */}
        <div className="flex items-start justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageCircleQuestion className="h-4 w-4 text-signature" strokeWidth={1.5} />
              <p className="meta-caption text-signature">Help Center</p>
            </div>
            <h1 className="font-display text-4xl text-ink">Your queries</h1>
            <p className="text-mist mt-2 text-sm max-w-md">
              Submit a question and our AI answers instantly — our team follows up
              by email if it needs a closer look.
            </p>
          </div>

          <Button
            variant={showForm ? "outline" : "signature"}
            size="sm"
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0"
          >
            {showForm ? (
              <><X className="h-3.5 w-3.5" strokeWidth={1.5} /> Cancel</>
            ) : (
              <><Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New query</>
            )}
          </Button>
        </div>

        {/* success banner */}
        <AnimatePresence>
          {justSubmitted && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 mb-8 px-4 py-3 border border-signature/20 bg-signature-tint text-signature-soft text-[13.5px]"
            >
              <Sparkles className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.5} />
              <span>
                Query <span className="font-mono">{justSubmitted}</span> submitted.
                Our AI is preparing a response now.
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* new query form */}
        <AnimatePresence initial={false}>
          {showForm && (
            <motion.form
              onSubmit={handleSubmit}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden mb-10"
              noValidate
            >
              <div className="border border-line p-6 sm:p-7 flex flex-col gap-5">
                <FormField
                  id="subject"
                  label="Subject"
                  placeholder="e.g. Does the premium package include drone shots?"
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  error={fieldErrors.subject}
                />

                {/* category pills */}
                <div className="flex flex-col gap-1.5">
                  <span className="meta-caption">Category</span>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => {
                      const active = form.category === cat.value;
                      return (
                        <button
                          key={cat.value}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, category: cat.value }))}
                          className={cn(
                            "px-3.5 py-1.5 text-[12px] font-mono uppercase tracking-wider rounded-full transition-all duration-200 border",
                            active
                              ? "bg-signature text-paper border-signature font-semibold"
                              : "bg-paper text-ink-soft border-line hover:border-signature/50 hover:text-ink"
                          )}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <FormField
                  id="message"
                  label="Message"
                  as="textarea"
                  rows={5}
                  placeholder="Tell us what's going on — the more detail, the better our AI (and team) can help."
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  error={fieldErrors.message}
                />

                {submitError && (
                  <p className="text-[13px] text-red-500/90 font-mono">{submitError}</p>
                )}

                <div className="flex items-center gap-3">
                  <Button type="submit" variant="signature" disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit query"}
                  </Button>
                  <span className="text-[12.5px] text-mist-light flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Usually answered within seconds
                  </span>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* status tabs */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-1 border-b border-line">
          {STATUS_TABS.map((s) => {
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-4 py-2 text-xs font-mono uppercase tracking-wider rounded-full transition-all duration-200 shrink-0 border",
                  active
                    ? "bg-ink text-paper border-ink font-semibold"
                    : "bg-paper text-ink-soft border-line hover:border-signature/50 hover:text-ink"
                )}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border border-line p-6 animate-pulse">
                <div className="h-4 bg-line rounded w-1/3 mb-3" />
                <div className="h-3 bg-line rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="border border-dashed border-line-strong py-16 text-center">
            <AlertCircle className="h-6 w-6 text-mist mx-auto mb-3" strokeWidth={1.5} />
            <p className="font-display text-lg text-ink mb-1">Couldn't load your queries</p>
            <p className="text-sm text-mist">{error}</p>
          </div>
        ) : queries.length === 0 ? (
          <div className="border border-dashed border-line-strong py-20 text-center">
            <MessageCircleQuestion className="h-6 w-6 text-mist mx-auto mb-4" strokeWidth={1.5} />
            <p className="font-display text-xl text-ink mb-2">No queries yet</p>
            <p className="text-sm text-mist mb-6">
              Have a question about a booking, package, or rental? Submit one and we'll get back to you.
            </p>
            <Button variant="signature" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New query
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {queries.map((q) => {
              const meta = STATUS_META[q.status] ?? STATUS_META["Open"];
              return (
                <Link
                  key={q._id}
                  to={`/help/${q._id}`}
                  className="flex items-center justify-between gap-4 border border-line p-5 hover:border-signature/40 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <p className="font-display text-[16px] text-ink truncate">{q.subject}</p>
                      <span className={cn("px-2 py-0.5 text-[11px] font-mono border shrink-0", meta.bg, meta.border, meta.color)}>
                        {q.status}
                      </span>
                      {q.aiResponse?.content && (
                        <span className="flex items-center gap-1 text-[11px] text-mist font-mono shrink-0">
                          <Bot className="h-3 w-3" strokeWidth={1.5} /> AI replied
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-mist truncate max-w-md">{q.message}</p>
                    <p className="meta-caption mt-2">
                      {q.queryRef} · {new Date(q.createdAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-mist shrink-0 group-hover:text-signature transition-colors" strokeWidth={1.5} />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
