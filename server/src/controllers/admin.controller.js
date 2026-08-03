"use strict";

const Booking = require("../models/Booking.model");
const Camera = require("../models/Camera.model");
const Package = require("../models/Package.model");
const User = require("../models/User.model");
const { sendSuccess, STATUS } = require("../utils/apiResponse");

// statuses that count as actual revenue (payment has landed)
const PAID_STATUSES = [
  "Payment Done",
  "Confirmed",
  "In Progress",
  "Completed",
];

// above this many days, group the trend by month instead of by day
// (180 daily bars is unreadable — monthly buckets make more sense)
const MONTHLY_THRESHOLD_DAYS = 31;

// ─────────────────────────────────────────
// GET OVERVIEW
// GET /api/admin/overview
// admin only — top-line stat cards
// ─────────────────────────────────────────
const getOverview = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      revenueAgg,
      revenueTodayAgg,
      revenue7dAgg,
      totalBookings,
      pendingBookings,
      requestsTodayByType,
      customers,
      totalCameras,
      totalPackages,
      rentedNowCount,
    ] = await Promise.all([
      Booking.aggregate([
        { $match: { status: { $in: PAID_STATUSES } } },
        { $group: { _id: null, total: { $sum: "$amount.total" } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            status: { $in: PAID_STATUSES },
            createdAt: { $gte: startOfToday },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount.total" } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            status: { $in: PAID_STATUSES },
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount.total" } } },
      ]),
      Booking.countDocuments({}),
      Booking.countDocuments({ status: "Pending" }),
      // ALL bookings created today, regardless of status — this is
      // "requests coming in today", split by package vs camera
      Booking.aggregate([
        { $match: { createdAt: { $gte: startOfToday } } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      // "customers" excludes admin/staff accounts on purpose —
      // an admin logging in shouldn't inflate the customer count
      User.countDocuments({ role: { $ne: "admin" } }),
      Camera.countDocuments({}),
      Package.countDocuments({}),
      Booking.countDocuments({
        type: "rental",
        status: { $in: ["Confirmed", "In Progress"] },
      }),
    ]);

    const requestsToday = requestsTodayByType.reduce(
      (sum, r) => sum + r.count,
      0,
    );
    const packageRequestsToday =
      requestsTodayByType.find((r) => r._id === "photography")?.count || 0;
    const rentalRequestsToday =
      requestsTodayByType.find((r) => r._id === "rental")?.count || 0;

    return sendSuccess(res, STATUS.OK, "Overview fetched", {
      totalRevenue: revenueAgg[0]?.total || 0,
      revenueToday: revenueTodayAgg[0]?.total || 0,
      revenueLast7Days: revenue7dAgg[0]?.total || 0,
      totalBookings,
      pendingBookings,
      requestsToday,
      packageRequestsToday,
      rentalRequestsToday,
      customers,
      totalCameras,
      totalPackages,
      camerasRentedOut: rentedNowCount,
      camerasAvailable: Math.max(totalCameras - rentedNowCount, 0),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// helper — build a filled, bucketed timeline
// (day buckets for <=31 days, month buckets beyond that)
// ─────────────────────────────────────────
const buildTimeline = (days) => {
  const monthly = days > MONTHLY_THRESHOLD_DAYS;
  const start = new Date();

  if (monthly) {
    const months = Math.ceil(days / 30);
    start.setDate(1);
    start.setMonth(start.getMonth() - (months - 1));
    start.setHours(0, 0, 0, 0);
    return { monthly, start, buckets: months };
  }

  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { monthly, start, buckets: days };
};

const bucketKey = (date, monthly) =>
  monthly ? date.toISOString().slice(0, 7) : date.toISOString().slice(0, 10);

// ─────────────────────────────────────────
// GET SALES TREND
// GET /api/admin/sales-trend?days=7
// admin only — PAID revenue + booking count per period,
// split by booking type (photography vs rental)
// days: 7, 30 -> daily buckets | 180, 365 -> monthly buckets
// ─────────────────────────────────────────
const getSalesTrend = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 365);
    const { monthly, start, buckets } = buildTimeline(days);
    const dateFormat = monthly ? "%Y-%m" : "%Y-%m-%d";

    const rows = await Booking.aggregate([
      {
        $match: {
          status: { $in: PAID_STATUSES },
          createdAt: { $gte: start },
        },
      },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: dateFormat, date: "$createdAt" } },
            type: "$type",
          },
          revenue: { $sum: "$amount.total" },
          bookings: { $sum: 1 },
        },
      },
    ]);

    const rowMap = new Map();
    for (const r of rows) {
      const existing = rowMap.get(r._id.period) || {
        revenue: 0,
        bookings: 0,
        photographyRevenue: 0,
        rentalRevenue: 0,
        photographyBookings: 0,
        rentalBookings: 0,
      };
      existing.revenue += r.revenue;
      existing.bookings += r.bookings;
      if (r._id.type === "photography") {
        existing.photographyRevenue += r.revenue;
        existing.photographyBookings += r.bookings;
      } else if (r._id.type === "rental") {
        existing.rentalRevenue += r.revenue;
        existing.rentalBookings += r.bookings;
      }
      rowMap.set(r._id.period, existing);
    }

    const trend = [];
    for (let i = 0; i < buckets; i++) {
      const d = new Date(start);
      if (monthly) d.setMonth(d.getMonth() + i);
      else d.setDate(d.getDate() + i);
      const key = bucketKey(d, monthly);
      const found = rowMap.get(key);
      trend.push({
        period: key,
        revenue: found?.revenue || 0,
        bookings: found?.bookings || 0,
        photographyRevenue: found?.photographyRevenue || 0,
        rentalRevenue: found?.rentalRevenue || 0,
        photographyBookings: found?.photographyBookings || 0,
        rentalBookings: found?.rentalBookings || 0,
      });
    }

    return sendSuccess(res, STATUS.OK, "Sales trend fetched", {
      monthly,
      points: trend,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET REQUESTS TREND
// GET /api/admin/requests-trend?days=7
// admin only — ALL bookings (any status) per period, split by type.
// This is "demand" — every request that came in, paid or not —
// as opposed to sales-trend which is confirmed/paid revenue only.
// ─────────────────────────────────────────
const getRequestsTrend = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 365);
    const { monthly, start, buckets } = buildTimeline(days);
    const dateFormat = monthly ? "%Y-%m" : "%Y-%m-%d";

    const rows = await Booking.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: dateFormat, date: "$createdAt" } },
            type: "$type",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const rowMap = new Map();
    for (const r of rows) {
      const existing = rowMap.get(r._id.period) || {
        total: 0,
        packageRequests: 0,
        rentalRequests: 0,
      };
      existing.total += r.count;
      if (r._id.type === "photography") existing.packageRequests += r.count;
      else if (r._id.type === "rental") existing.rentalRequests += r.count;
      rowMap.set(r._id.period, existing);
    }

    const trend = [];
    for (let i = 0; i < buckets; i++) {
      const d = new Date(start);
      if (monthly) d.setMonth(d.getMonth() + i);
      else d.setDate(d.getDate() + i);
      const key = bucketKey(d, monthly);
      const found = rowMap.get(key);
      trend.push({
        period: key,
        total: found?.total || 0,
        packageRequests: found?.packageRequests || 0,
        rentalRequests: found?.rentalRequests || 0,
      });
    }

    return sendSuccess(res, STATUS.OK, "Requests trend fetched", {
      monthly,
      points: trend,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET CAMERA RENTAL STATUS
// GET /api/admin/cameras-status
// admin only — every camera + who has it right now (if anyone)
// ─────────────────────────────────────────
const getCameraRentalStatus = async (req, res, next) => {
  try {
    const cameras = await Camera.find({}).sort({ displayOrder: 1 }).lean();

    const activeBookings = await Booking.find({
      type: "rental",
      status: { $in: ["Confirmed", "In Progress"] },
    })
      .populate("user", "name email phone")
      .sort({ date: 1 })
      .lean();

    // bookings that were requested but haven't been paid/confirmed yet —
    // these don't take the camera "out" but the admin still needs to see
    // that demand exists for it
    const pendingBookings = await Booking.find({
      type: "rental",
      status: { $in: ["Pending", "Payment Done"] },
    })
      .select("camera")
      .lean();

    // camera id -> earliest active booking for it
    const activeByCamera = new Map();
    for (const b of activeBookings) {
      const camId = b.camera?.toString();
      if (!camId) continue;
      if (!activeByCamera.has(camId)) activeByCamera.set(camId, b);
    }

    // camera id -> count of pending requests
    const pendingCountByCamera = new Map();
    for (const b of pendingBookings) {
      const camId = b.camera?.toString();
      if (!camId) continue;
      pendingCountByCamera.set(camId, (pendingCountByCamera.get(camId) || 0) + 1);
    }

    const result = cameras.map((cam) => {
      const active = activeByCamera.get(cam._id.toString());
      const pendingCount = pendingCountByCamera.get(cam._id.toString()) || 0;
      return {
        cameraId: cam._id,
        name: cam.name,
        brand: cam.brand,
        model: cam.model,
        imageUrl: cam.image?.url || "",
        isAvailable: cam.isAvailable,
        isRented: !!active,
        pendingRequests: pendingCount,
        renter: active
          ? {
              name: active.user?.name || "Unknown",
              email: active.user?.email || "",
              phone: active.user?.phone || "",
              bookingRef: `BK-${active._id.toString().slice(-8).toUpperCase()}`,
              status: active.status,
              date: active.date,
              rentalType: active.rentalType,
            }
          : null,
      };
    });

    const rentedCount = result.filter((c) => c.isRented).length;
    const pendingRequestsTotal = result.reduce((s, c) => s + c.pendingRequests, 0);

    return sendSuccess(res, STATUS.OK, "Camera rental status fetched", {
      cameras: result,
      totalCameras: result.length,
      rentedCount,
      availableCount: result.length - rentedCount,
      pendingRequestsTotal,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────
// GET RECENT BOOKINGS
// GET /api/admin/bookings/recent?limit=10
// admin only — latest activity across all users
// ─────────────────────────────────────────
const getRecentBookings = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const bookings = await Booking.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("user", "name email")
      .select(
        "type status date time amount packageSnapshot cameraSnapshot createdAt bookingRef",
      )
      .lean();

    const rows = bookings.map((b) => ({
      bookingId: b._id,
      bookingRef: `BK-${b._id.toString().slice(-8).toUpperCase()}`,
      customer: b.user?.name || "Unknown",
      email: b.user?.email || "",
      type: b.type,
      item:
        b.type === "photography"
          ? b.packageSnapshot?.name
          : b.cameraSnapshot?.name,
      status: b.status,
      amount: b.amount?.total || 0,
      date: b.date,
      createdAt: b.createdAt,
    }));

    return sendSuccess(res, STATUS.OK, "Recent bookings fetched", rows);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/bookings — full admin bookings list.
 * Supports:
 *   ?search=      matches customer name, email, item name, or
 *                 booking ref (BK-XXXXXXXX, case-insensitive)
 *   ?status=      exact match on booking status
 *   ?type=        "photography" | "rental"
 *   ?dateFrom=    ISO date — bookings on/after this session date
 *   ?dateTo=      ISO date — bookings on/before this session date
 *   ?page=        default 1
 *   ?limit=       default 20, max 100
 *
 * Built as an aggregation (not a simple .find()) because search
 * needs to match across the populated user's name/email as well as
 * the booking's own fields — a plain Mongoose query can't do that
 * without a separate lookup step first.
 */
const getAllBookings = async (req, res, next) => {
  try {
    const {
      search = "",
      status,
      type,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = req.query;

    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const safePage = Math.max(parseInt(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    const matchStage = {};
    if (status) matchStage.status = status;
    if (type) matchStage.type = type;
    if (dateFrom || dateTo) {
      matchStage.date = {};
      if (dateFrom) matchStage.date.$gte = new Date(dateFrom);
      if (dateTo) matchStage.date.$lte = new Date(dateTo);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userInfo",
        },
      },
      { $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
    ];

    // search across customer name/email, item name, and booking ref
    // (bookingRef is a virtual — BK- + last 8 hex chars of _id — so we
    // rebuild it with $concat to make it searchable in the aggregation)
    if (search.trim()) {
      const regex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      pipeline.push({
        $addFields: {
          bookingRefComputed: {
            $concat: [
              "BK-",
              { $toUpper: { $substrCP: [{ $toString: "$_id" }, 16, 8] } },
            ],
          },
        },
      });
      pipeline.push({
        $match: {
          $or: [
            { "userInfo.name": regex },
            { "userInfo.email": regex },
            { "packageSnapshot.name": regex },
            { "cameraSnapshot.name": regex },
            { bookingRefComputed: regex },
          ],
        },
      });
    }

    pipeline.push({ $sort: { createdAt: -1 } });

    // $facet runs the paginated results and the total count in one
    // round trip instead of two separate queries
    pipeline.push({
      $facet: {
        rows: [
          { $skip: skip },
          { $limit: safeLimit },
          {
            $project: {
              _id: 1,
              type: 1,
              status: 1,
              date: 1,
              time: 1,
              amount: 1,
              createdAt: 1,
              packageSnapshot: 1,
              cameraSnapshot: 1,
              "userInfo.name": 1,
              "userInfo.email": 1,
            },
          },
        ],
        totalCount: [{ $count: "count" }],
      },
    });

    const [result] = await Booking.aggregate(pipeline);
    const total = result.totalCount[0]?.count || 0;

    const rows = result.rows.map((b) => ({
      bookingId: b._id,
      bookingRef: `BK-${b._id.toString().slice(-8).toUpperCase()}`,
      customer: b.userInfo?.name || "Unknown",
      email: b.userInfo?.email || "",
      type: b.type,
      item:
        b.type === "photography"
          ? b.packageSnapshot?.name
          : b.cameraSnapshot?.name,
      status: b.status,
      amount: b.amount?.total || 0,
      date: b.date,
      time: b.time,
      createdAt: b.createdAt,
    }));

    const meta = {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
      hasNextPage: safePage * safeLimit < total,
      hasPrevPage: safePage > 1,
    };

    return sendSuccess(res, STATUS.OK, "Bookings fetched", rows, meta);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getOverview,
  getSalesTrend,
  getRequestsTrend,
  getCameraRentalStatus,
  getRecentBookings,
  getAllBookings,
};
