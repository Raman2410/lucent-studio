import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the shared axios instance so every service test asserts *which*
// endpoint/method it calls, without hitting a real network.
vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(() => Promise.resolve({ data: [] })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    patch: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

import api from "@/lib/api";
import bookingService from "./bookingService";
import packageService from "./packageService";
import cameraService from "./cameraService";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("bookingService", () => {
  it("create posts to /bookings with the payload", () => {
    const payload = { packageId: "p1" };
    bookingService.create(payload);
    expect(api.post).toHaveBeenCalledWith("/bookings", payload);
  });

  it("getMyBookings gets /bookings/my with params", () => {
    bookingService.getMyBookings({ status: "Pending" });
    expect(api.get).toHaveBeenCalledWith("/bookings/my", { params: { status: "Pending" } });
  });

  it("getById gets /bookings/:id", () => {
    bookingService.getById("abc123");
    expect(api.get).toHaveBeenCalledWith("/bookings/abc123");
  });

  it("reschedule patches /bookings/:id/reschedule with new date/time", () => {
    bookingService.reschedule("abc123", { newDate: "2026-08-01", newTime: "10:00" });
    expect(api.patch).toHaveBeenCalledWith("/bookings/abc123/reschedule", {
      newDate: "2026-08-01",
      newTime: "10:00",
    });
  });

  it("cancel patches /bookings/:id/cancel, defaulting reason to an empty string", () => {
    bookingService.cancel("abc123");
    expect(api.patch).toHaveBeenCalledWith("/bookings/abc123/cancel", { reason: "" });
  });

  it("cancel forwards a given reason", () => {
    bookingService.cancel("abc123", "Change of plans");
    expect(api.patch).toHaveBeenCalledWith("/bookings/abc123/cancel", {
      reason: "Change of plans",
    });
  });

  it("remove deletes /bookings/:id", () => {
    bookingService.remove("abc123");
    expect(api.delete).toHaveBeenCalledWith("/bookings/abc123");
  });
});

describe("packageService", () => {
  it("getAll gets /packages with params", () => {
    packageService.getAll({ category: "wedding" });
    expect(api.get).toHaveBeenCalledWith("/packages", { params: { category: "wedding" } });
  });

  it("getByCategory gets /packages/category/:category", () => {
    packageService.getByCategory("portrait");
    expect(api.get).toHaveBeenCalledWith("/packages/category/portrait");
  });

  it("create posts to /packages", () => {
    const payload = { name: "Gold Package" };
    packageService.create(payload);
    expect(api.post).toHaveBeenCalledWith("/packages", payload);
  });

  it("update patches /packages/:id", () => {
    packageService.update("pkg1", { price: 5000 });
    expect(api.patch).toHaveBeenCalledWith("/packages/pkg1", { price: 5000 });
  });

  it("remove deletes /packages/:id (soft delete on the server)", () => {
    packageService.remove("pkg1");
    expect(api.delete).toHaveBeenCalledWith("/packages/pkg1");
  });
});

describe("cameraService", () => {
  it("getAvailability gets /cameras/:id/availability with the month param", () => {
    cameraService.getAvailability("cam1", "2026-08");
    expect(api.get).toHaveBeenCalledWith("/cameras/cam1/availability", {
      params: { month: "2026-08" },
    });
  });

  it("calculateCost posts to /cameras/:id/calculate", () => {
    const payload = { startDate: "2026-08-01", endDate: "2026-08-03" };
    cameraService.calculateCost("cam1", payload);
    expect(api.post).toHaveBeenCalledWith("/cameras/cam1/calculate", payload);
  });

  it("create builds multipart form data with the image and accessories", () => {
    cameraService.create({
      name: "R6",
      brand: "Canon",
      image: new File(["x"], "cam.jpg", { type: "image/jpeg" }),
      accessories: [{ name: "Tripod", description: "Sturdy", additionalCharge: 500 }],
      accessoryImages: [],
    });
    expect(api.post).toHaveBeenCalledWith(
      "/cameras",
      expect.any(FormData),
      expect.objectContaining({ headers: { "Content-Type": "multipart/form-data" } })
    );
    const fd = api.post.mock.calls[0][1];
    expect(fd.get("name")).toBe("R6");
    expect(fd.get("brand")).toBe("Canon");
    expect(JSON.parse(fd.get("accessories"))).toEqual([
      { name: "Tripod", description: "Sturdy", additionalCharge: 500 },
    ]);
  });

  it("toggleAvailability patches with no body when no reason given", () => {
    cameraService.toggleAvailability("cam1");
    expect(api.patch).toHaveBeenCalledWith("/cameras/cam1/toggle-availability", {});
  });

  it("toggleAvailability includes the reason when given", () => {
    cameraService.toggleAvailability("cam1", "Under repair");
    expect(api.patch).toHaveBeenCalledWith("/cameras/cam1/toggle-availability", {
      reason: "Under repair",
    });
  });

  it("remove deletes /cameras/:id", () => {
    cameraService.remove("cam1");
    expect(api.delete).toHaveBeenCalledWith("/cameras/cam1");
  });
});
