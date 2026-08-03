import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IndianRupee,
  CalendarClock,
  Clock,
  Users,
  Camera as CameraIcon,
  Package as PackageIcon,
  RefreshCw,
  Inbox,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import adminService from "@/services/adminService";
import socket from "@/services/socketService";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton, SkeletonStat, SkeletonList } from "@/components/ui/skeleton";

// ─────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────
const money = (n) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n || 0);

const periodLabel = (period, monthly) => {
  if (monthly) {
    const [y, m] = period.split("-");
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short" });
  }
  return new Date(period).toLocaleDateString("en-IN", { weekday: "short" });
};

const periodDate = (period, monthly) => {
  if (monthly) {
    const [y, m] = period.split("-");
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }
  return new Date(period).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const timeAgo = (iso) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const RANGES = [
  { key: "7", label: "7d", days: 7 },
  { key: "30", label: "30d", days: 30 },
  { key: "180", label: "6m", days: 180 },
  { key: "365", label: "12m", days: 365 },
];

// ─────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4 shadow-subtle">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-mono uppercase tracking-wide text-mist">
          {label}
        </span>
        <Icon className="h-4 w-4 text-signature" />
      </div>
      <div className="text-2xl font-display font-medium text-ink">{value}</div>
      {sub && <div className="text-[11px] text-mist mt-1">{sub}</div>}
    </div>
  );
}

// ─────────────────────────────────────────
// GENERIC STACKED BAR CHART — plain SVG, no dependency
// data: [{ period, [seriesKey]: number, ... }]
// series: [{ key, label, color }]
// ─────────────────────────────────────────
function StackedBarChart({ data, series, monthly, valueFormatter, totalKey }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const totals = data.map((d) => series.reduce((s, ser) => s + (d[ser.key] || 0), 0));
  const max = Math.max(...totals, 1);
  const W = 700;
  const H = 220;
  const padBottom = 28;
  const barGap = data.length > 40 ? 2 : 10;
  const barWidth = data.length ? (W - barGap * (data.length - 1)) / data.length : 0;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-56" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={(H - padBottom) * (1 - f)}
            y2={(H - padBottom) * (1 - f)}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
        ))}
        {data.map((d, i) => {
          const x = i * (barWidth + barGap);
          const active = hoverIdx === i;
          let cursorY = H - padBottom;
          return (
            <g key={d.period}>
              {series.map((ser) => {
                const val = d[ser.key] || 0;
                const segH = max ? (val / max) * (H - padBottom - 8) : 0;
                cursorY -= segH;
                return (
                  <rect
                    key={ser.key}
                    x={x}
                    y={cursorY}
                    width={barWidth}
                    height={segH}
                    fill={active ? "var(--color-gold)" : ser.color}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                    className="transition-colors cursor-pointer"
                  />
                );
              })}
              {(data.length <= 31 || i % Math.ceil(data.length / 12) === 0) && (
                <text
                  x={x + barWidth / 2}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fontFamily="var(--font-mono)"
                  fill="var(--color-mist)"
                >
                  {periodLabel(d.period, monthly)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hoverIdx !== null && (
        <div className="absolute top-0 right-0 rounded-md border border-line bg-paper px-3 py-2 shadow-card font-mono text-xs space-y-0.5 min-w-[140px]">
          <div className="text-mist mb-1">{periodDate(data[hoverIdx].period, monthly)}</div>
          {series.map((ser) => (
            <div key={ser.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-mist">
                <span className="h-2 w-2 rounded-full" style={{ background: ser.color }} />
                {ser.label}
              </span>
              <span className="text-ink">{valueFormatter(data[hoverIdx][ser.key] || 0)}</span>
            </div>
          ))}
          {totalKey && (
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-line mt-1">
              <span className="text-mist">Total</span>
              <span className="text-ink font-medium">
                {valueFormatter(data[hoverIdx][totalKey] ?? totals[hoverIdx])}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChartLegend({ series }) {
  return (
    <div className="flex items-center gap-4">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5 text-[11px] font-mono text-mist">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────
export default function AdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [salesTrend, setSalesTrend] = useState({ monthly: false, points: [] });
  const [requestsTrend, setRequestsTrend] = useState({ monthly: false, points: [] });
  const [cameras, setCameras] = useState(null);
  const [recentBookings, setRecentBookings] = useState([]);
  const [range, setRange] = useState(RANGES[0]);
  const [bookingFilter, setBookingFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const flashTimeout = useRef(null);

  const loadAll = useCallback(async (rangeDays = range.days) => {
    const [ov, sales, requests, cam, recent] = await Promise.all([
      adminService.getOverview(),
      adminService.getSalesTrend(rangeDays),
      adminService.getRequestsTrend(rangeDays),
      adminService.getCameraStatus(),
      adminService.getRecentBookings(30),
    ]);
    setOverview(ov.data);
    setSalesTrend(sales.data);
    setRequestsTrend(requests.data);
    setCameras(cam.data);
    setRecentBookings(recent.data);
  }, [range]);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  // live updates via socket + 45s polling fallback
  useEffect(() => {
    const flash = () => {
      setLive(true);
      clearTimeout(flashTimeout.current);
      flashTimeout.current = setTimeout(() => setLive(false), 1200);
    };

    const onActivity = () => {
      flash();
      loadAll();
    };

    socket.on("admin:activity", onActivity);
    const poll = setInterval(() => loadAll(), 45000);

    return () => {
      socket.off("admin:activity", onActivity);
      clearInterval(poll);
      clearTimeout(flashTimeout.current);
    };
  }, [loadAll]);

  if (loading || !overview) {
    return (
      <div className="container-page py-8 space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <SkeletonList count={3} />
      </div>
    );
  }

  const salesSeries = [
    { key: "photographyRevenue", label: "Packages", color: "var(--color-signature)" },
    { key: "rentalRevenue", label: "Camera Rentals", color: "var(--color-gold)" },
  ];
  const requestsSeries = [
    { key: "packageRequests", label: "Packages", color: "var(--color-signature)" },
    { key: "rentalRequests", label: "Camera Rentals", color: "var(--color-gold)" },
  ];

  const filteredBookings =
    bookingFilter === "All"
      ? recentBookings
      : recentBookings.filter((b) => b.status === bookingFilter);

  return (
    <div className="container-page py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-medium text-ink">Dashboard</h1>
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border",
              live
                ? "border-signature text-signature bg-signature-tint"
                : "border-line text-mist",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                live ? "bg-signature animate-pulse" : "bg-mist-light",
              )}
            />
            Live
          </span>
          <button
            onClick={() => loadAll()}
            className="flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border border-line text-mist hover:text-ink hover:border-line-strong transition-colors"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <StatCard icon={IndianRupee} label="Total Revenue" value={money(overview.totalRevenue)} />
        <StatCard icon={IndianRupee} label="Revenue 7d" value={money(overview.revenueLast7Days)} />
        <StatCard
          icon={Inbox}
          label="Requests Today"
          value={overview.requestsToday}
          sub={`${overview.packageRequestsToday} pkg · ${overview.rentalRequestsToday} rental`}
        />
        <StatCard icon={Clock} label="Pending" value={overview.pendingBookings} />
        <StatCard
          icon={CameraIcon}
          label="Cameras Out"
          value={overview.camerasRentedOut}
          sub={`of ${overview.totalCameras} total`}
        />
        <StatCard icon={PackageIcon} label="Packages" value={overview.totalPackages} />
        <StatCard icon={CalendarClock} label="Total Bookings" value={overview.totalBookings} />
        <StatCard icon={Users} label="Customers" value={overview.customers} sub="excludes staff" />
      </div>

      {/* Range selector */}
      <div className="flex items-center justify-end gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-mono border transition-colors",
              range.key === r.key
                ? "bg-signature text-paper border-signature"
                : "border-line text-mist hover:text-ink",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Sales chart */}
      <div className="rounded-lg border border-line bg-paper p-5 shadow-subtle">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-ink">Sales</span>
          <ChartLegend series={salesSeries} />
        </div>
        <StackedBarChart
          data={salesTrend.points}
          series={salesSeries}
          monthly={salesTrend.monthly}
          valueFormatter={money}
          totalKey="revenue"
        />
      </div>

      {/* Requests chart */}
      <div className="rounded-lg border border-line bg-paper p-5 shadow-subtle">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-ink">Requests (all statuses, incl. pending)</span>
          <ChartLegend series={requestsSeries} />
        </div>
        <StackedBarChart
          data={requestsTrend.points}
          series={requestsSeries}
          monthly={requestsTrend.monthly}
          valueFormatter={(n) => `${n}`}
          totalKey="total"
        />
      </div>

      {/* Camera status + recent bookings */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Camera rental status */}
        <div className="rounded-lg border border-line bg-paper p-5 shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-ink">Camera Fleet</span>
            <span className="text-[11px] font-mono text-mist">
              {cameras.rentedCount} out · {cameras.availableCount} in
              {cameras.pendingRequestsTotal > 0 && (
                <> · {cameras.pendingRequestsTotal} requested</>
              )}
            </span>
          </div>
          <div className="divide-y divide-line max-h-96 overflow-y-auto">
            {cameras.cameras.map((c) => (
              <div key={c.cameraId} className="py-3 flex items-center gap-3">
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt={c.name}
                    className="h-9 w-9 rounded-md object-cover border border-line shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-md bg-paper-dim border border-line shrink-0 flex items-center justify-center">
                    <CameraIcon className="h-4 w-4 text-mist" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">
                    {c.brand} {c.name}
                  </div>
                  {c.isRented ? (
                    <div className="text-[11px] text-mist truncate">
                      {c.renter.name} · {c.renter.bookingRef}
                    </div>
                  ) : (
                    <div className="text-[11px] text-mist">
                      {c.isAvailable ? "In studio" : "Unavailable"}
                    </div>
                  )}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border",
                      c.isRented
                        ? "bg-gold-tint text-gold border-gold/30"
                        : c.isAvailable
                          ? "bg-signature-tint text-signature border-signature/25"
                          : "bg-red-50 text-red-600 border-red-200",
                    )}
                  >
                    {c.isRented ? "Rented" : c.isAvailable ? "Available" : "Down"}
                  </span>
                  {c.pendingRequests > 0 && (
                    <span className="text-[10px] font-mono text-mist">
                      {c.pendingRequests} pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent bookings */}
        <div className="rounded-lg border border-line bg-paper p-5 shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-ink">Recent Bookings</span>
            <div className="flex gap-1">
              {["All", "Pending", "Confirmed", "Completed"].map((f) => (
                <button
                  key={f}
                  onClick={() => setBookingFilter(f)}
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-mono border transition-colors",
                    bookingFilter === f
                      ? "bg-signature text-paper border-signature"
                      : "border-line text-mist hover:text-ink",
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="divide-y divide-line max-h-96 overflow-y-auto">
            {filteredBookings.length === 0 && (
              <div className="py-8 text-center text-[12px] text-mist font-mono">
                No {bookingFilter !== "All" ? bookingFilter.toLowerCase() : ""} bookings
              </div>
            )}
            {filteredBookings.map((b) => (
              <Link
                key={b.bookingId}
                to={`/bookings/${b.bookingId}`}
                className="py-3 flex items-center gap-3 group hover:bg-paper-dim/50 -mx-1 px-1 rounded-md transition-colors"
              >
                <div className="h-8 w-8 rounded-full bg-signature/10 border border-signature/20 shrink-0 flex items-center justify-center">
                  {b.type === "rental" ? (
                    <CameraIcon className="h-3.5 w-3.5 text-signature" />
                  ) : (
                    <PackageIcon className="h-3.5 w-3.5 text-signature" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink truncate">{b.customer}</div>
                  <div className="text-[11px] text-mist truncate">
                    {b.item} · {b.bookingRef} · {timeAgo(b.createdAt)}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-mono text-ink">{money(b.amount)}</div>
                  <StatusBadge status={b.status} />
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-mist-light shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
