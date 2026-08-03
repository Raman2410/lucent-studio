import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Search, ChevronLeft, ChevronRight, Package as PackageIcon,
  Camera as CameraIcon, X, CheckCircle2, PlayCircle, Loader2,
  XCircle, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import adminService from "@/services/adminService";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatusBanner } from "@/components/ui/status-banner";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";

const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const STATUS_OPTIONS = [
  "", "Pending", "Payment Done", "Confirmed", "In Progress", "Completed", "Cancelled",
];
const TYPE_OPTIONS = ["", "photography", "rental"];
const LIMIT = 20;

// admin can only push a booking forward along these two transitions —
// matches the server's validTransitions map exactly (see
// booking.controller.js -> updateBookingStatus)
const NEXT_ACTION = {
  Confirmed: { label: "Start session", toStatus: "In Progress", icon: PlayCircle },
  "In Progress": { label: "Mark completed", toStatus: "Completed", icon: CheckCircle2 },
};

// statuses an admin is allowed to cancel from (mirrors the server's
// own isCancellable virtual exactly — see Booking.model.js)
const CANCELLABLE_STATUSES = ["Pending", "Payment Done", "Confirmed"];

// only fully-resolved bookings can be permanently deleted
const DELETABLE_STATUSES = ["Completed", "Cancelled"];

/**
 * AdminBookings — searchable, filterable, paginated bookings list for
 * admins, backed by GET /api/admin/bookings (aggregation pipeline with
 * $facet for combined results + count).
 *
 * Debounces search input by 400ms so we're not firing a request on
 * every keystroke — typing "wedding" fires 1 request, not 7.
 */
export default function AdminBookings() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banner, setBanner] = useState(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState(""); // debounced value actually sent to API
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [actingOn, setActingOn] = useState(null); // bookingId currently being updated
  const [cancellingOn, setCancellingOn] = useState(null); // bookingId currently being cancelled
  const [deletingOn, setDeletingOn] = useState(null); // bookingId currently being deleted

  const debounceRef = useRef(null);

  // debounce search input -> search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1); // reset to page 1 whenever the search term changes
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput]);

  // reset to page 1 whenever any filter changes
  useEffect(() => { setPage(1); }, [status, type, dateFrom, dateTo]);

  const fetchBookings = useCallback(() => {
    setLoading(true);
    setError("");
    adminService
      .getAllBookings({
        search: search || undefined,
        status: status || undefined,
        type: type || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: LIMIT,
      })
      .then((res) => {
        setRows(res.data ?? []);
        setMeta(res.meta ?? null);
      })
      .catch((err) => setError(err.message || "Couldn't load bookings."))
      .finally(() => setLoading(false));
  }, [search, status, type, dateFrom, dateTo, page]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setType("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const hasActiveFilters = search || status || type || dateFrom || dateTo;

  const handleQuickAction = async (bookingId, toStatus) => {
    setActingOn(bookingId);
    try {
      await adminService.updateBookingStatus(bookingId, {
        status: toStatus,
        note: `Marked as ${toStatus} by admin`,
      });
      setRows((prev) =>
        prev.map((r) => (r.bookingId === bookingId ? { ...r, status: toStatus } : r))
      );
      setBanner({ type: "success", message: `Booking marked as ${toStatus}.` });
    } catch (err) {
      setBanner({ type: "error", message: err.message || "Couldn't update status." });
    } finally {
      setActingOn(null);
      setTimeout(() => setBanner(null), 4000);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm("Cancel this booking? Any eligible payment will be refunded automatically.")) return;
    setCancellingOn(bookingId);
    try {
      await adminService.cancelBooking(bookingId, "Cancelled by admin");
      setRows((prev) =>
        prev.map((r) => (r.bookingId === bookingId ? { ...r, status: "Cancelled" } : r))
      );
      setBanner({ type: "success", message: "Booking cancelled." });
    } catch (err) {
      setBanner({ type: "error", message: err.message || "Couldn't cancel booking." });
    } finally {
      setCancellingOn(null);
      setTimeout(() => setBanner(null), 4000);
    }
  };

  const handleDelete = async (bookingId) => {
    if (!window.confirm("Permanently delete this booking? This cannot be undone.")) return;
    setDeletingOn(bookingId);
    try {
      await adminService.deleteBooking(bookingId);
      setRows((prev) => prev.filter((r) => r.bookingId !== bookingId));
      setMeta((prev) => (prev ? { ...prev, total: Math.max(0, prev.total - 1) } : prev));
      setBanner({ type: "success", message: "Booking deleted." });
    } catch (err) {
      setBanner({ type: "error", message: err.message || "Couldn't delete booking." });
    } finally {
      setDeletingOn(null);
      setTimeout(() => setBanner(null), 4000);
    }
  };

  return (
    <div className="container-page py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Bookings</h1>
        {meta && (
          <p className="text-[12px] font-mono text-mist">
            {meta.total} total
          </p>
        )}
      </div>

      {banner && <StatusBanner status={banner} onDismiss={() => setBanner(null)} />}

      {/* search + filters */}
      <div className="rounded-lg border border-line bg-paper p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-mist-light" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by customer name, email, item, or booking ref…"
            className="w-full pl-9 pr-3 py-2.5 text-[13.5px] bg-paper-dim border border-line rounded-md focus:outline-none focus:border-signature transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-auto min-w-[150px]"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s || "All statuses"}</option>
            ))}
          </Select>

          <Select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-auto min-w-[140px]"
          >
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === "" ? "All types" : t === "photography" ? "Photography" : "Rental"}
              </option>
            ))}
          </Select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-2 text-[12.5px] font-mono bg-paper-dim border border-line rounded-md focus:outline-none focus:border-signature"
            />
            <span className="text-mist-light text-[12px]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-2 text-[12.5px] font-mono bg-paper-dim border border-line rounded-md focus:outline-none focus:border-signature"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-[12.5px] text-mist hover:text-signature transition-colors ml-auto"
            >
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
      </div>

      {/* results */}
      <div className="rounded-lg border border-line bg-paper overflow-hidden">
        {loading ? (
          <SkeletonList count={5} className="p-4" />
        ) : error ? (
          <div className="py-16 text-center text-[13px] text-red-500 font-mono">{error}</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Search}
            size="sm"
            title="No bookings found"
            description={`No bookings match ${hasActiveFilters ? "these filters" : "your search"}.`}
            className="rounded-none border-0"
          />
        ) : (
          <div className="divide-y divide-line">
            {rows.map((b) => {
              const action = NEXT_ACTION[b.status];
              const isActing = actingOn === b.bookingId;
              const isCancelling = cancellingOn === b.bookingId;
              const isDeleting = deletingOn === b.bookingId;
              const canCancel = CANCELLABLE_STATUSES.includes(b.status);
              const canDelete = DELETABLE_STATUSES.includes(b.status);

              return (
                <div key={b.bookingId} className="flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-paper-dim/50 transition-colors">
                  <div className="h-9 w-9 rounded-full bg-signature/10 border border-signature/20 shrink-0 flex items-center justify-center">
                    {b.type === "rental" ? (
                      <CameraIcon className="h-4 w-4 text-signature" />
                    ) : (
                      <PackageIcon className="h-4 w-4 text-signature" />
                    )}
                  </div>

                  <Link to={`/bookings/${b.bookingId}`} className="min-w-0 flex-1 basis-40 group">
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-medium text-ink group-hover:text-signature transition-colors truncate">
                        {b.customer}
                      </span>
                      <span className="text-[11px] text-mist-light font-mono shrink-0">{b.bookingRef}</span>
                    </div>
                    <div className="text-[12px] text-mist truncate">
                      {b.item} · {b.email}
                    </div>
                  </Link>

                  <div className="text-right shrink-0 ml-[52px] sm:ml-0">
                    <div className="text-[12.5px] font-mono text-ink">{money(b.amount)}</div>
                    <div className="text-[11px] text-mist-light">
                      {new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>

                  <StatusBadge status={b.status} className="shrink-0" />

                  {/* actions — quick-forward action (if any), cancel (while
                      still active), delete (once resolved) */}
                  <div className="shrink-0 flex items-center justify-end gap-1.5 ml-auto sm:ml-0 w-full sm:w-auto">
                    {action && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isActing}
                        onClick={() => handleQuickAction(b.bookingId, action.toStatus)}
                        className="flex items-center gap-1.5 !text-[12px] whitespace-nowrap"
                      >
                        {isActing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <action.icon className="h-3.5 w-3.5" />
                        )}
                        {action.label}
                      </Button>
                    )}

                    {canCancel && (
                      <button
                        type="button"
                        title="Cancel booking"
                        aria-label="Cancel booking"
                        disabled={isCancelling}
                        onClick={() => handleCancel(b.bookingId)}
                        className="h-8 w-8 flex items-center justify-center rounded-md border border-line text-red-500/80 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isCancelling ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
                        )}
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        title="Delete booking"
                        aria-label="Delete booking"
                        disabled={isDeleting}
                        onClick={() => handleDelete(b.bookingId)}
                        className="h-8 w-8 flex items-center justify-center rounded-md border border-line text-mist hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-mono text-mist">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={!meta.hasPrevPage}
              className="h-8 w-8 flex items-center justify-center border border-line rounded-md text-ink-soft hover:border-signature hover:text-signature disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={!meta.hasNextPage}
              className="h-8 w-8 flex items-center justify-center border border-line rounded-md text-ink-soft hover:border-signature hover:text-signature disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
