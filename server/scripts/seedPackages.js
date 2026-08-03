"use strict";

/**
 * seedPackages.js — populates the Package collection with rich photography packages
 * across wedding, portrait, commercial, nature, and street categories.
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";
dotenv.config({ path: path.resolve(__dirname, "..", envFile) });

const Package = require("../src/models/Package.model");

const SEED_PACKAGES = [
  // ── WEDDING ──────────────────────────────
  {
    name: "Golden Hour Wedding Suite",
    tagline: "Full ceremony & reception coverage with dual shooters",
    category: "wedding",
    type: "fixed",
    price: { amount: 85000, currency: "INR", unit: "per wedding" },
    description: "Complete documentative & fine-art wedding coverage from morning preparations to late night celebrations. Includes aerial drone shots and custom photo album.",
    includes: [
      "10 hours full event coverage",
      "2 senior photographers + 1 drone pilot",
      "600+ high-res edited photographs",
      "Private online gallery valid for 1 year",
      "Handcrafted 30-page heirloom photo book",
      "Teaser set delivered within 72 hours"
    ],
    excludes: ["Outstation travel & lodging beyond 50km"],
    duration: { value: 10, unit: "hours" },
    deliverables: { editedPhotos: 600, videos: 1, onlineGallery: true, printableFiles: true, turnaroundDays: 14 },
    isPopular: true,
    displayOrder: 1
  },
  {
    name: "Intimate Elopement Session",
    tagline: "Quiet, romantic coverage for micro-weddings and vows",
    category: "wedding",
    type: "fixed",
    price: { amount: 35000, currency: "INR", unit: "per session" },
    description: "Tailored for small gatherings (up to 30 guests) or destination vow exchanges. Focuses on authentic emotions and cinematic portraits.",
    includes: [
      "4 hours intimate coverage",
      "1 lead photographer",
      "250+ edited high-resolution images",
      "Online password-protected gallery",
      "Full print rights included"
    ],
    excludes: ["Hair & makeup services"],
    duration: { value: 4, unit: "hours" },
    deliverables: { editedPhotos: 250, videos: 0, onlineGallery: true, printableFiles: true, turnaroundDays: 10 },
    isPopular: false,
    displayOrder: 2
  },

  // ── PORTRAIT ─────────────────────────────
  {
    name: "Signature Editorial Portrait",
    tagline: "Studio & outdoor natural light portraiture",
    category: "portrait",
    type: "fixed",
    price: { amount: 18000, currency: "INR", unit: "per session" },
    description: "Designed for creatives, executives, and individuals looking for magazine-quality portraits. Includes color grading & professional retouching.",
    includes: [
      "2 hours shooting session (Studio or Outdoor)",
      "3 wardrobe looks",
      "30 fully retouched high-res photos",
      "Moodboard & styling consultation beforehand",
      "High & web resolution exports"
    ],
    excludes: ["Studio rental fee if specialized location requested"],
    duration: { value: 2, unit: "hours" },
    deliverables: { editedPhotos: 30, videos: 0, onlineGallery: true, printableFiles: true, turnaroundDays: 7 },
    isPopular: true,
    displayOrder: 3
  },
  {
    name: "Personal Brand & Headshots",
    tagline: "Modern portraits for LinkedIn, founders & press",
    category: "portrait",
    type: "hourly",
    price: { amount: 8000, currency: "INR", unit: "per hour" },
    description: "Quick, crisp professional headshots captured on location at your workspace or in studio.",
    includes: [
      "1 hour dedicated shoot",
      "2 wardrobe changes",
      "12 signature retouched headshots",
      "Same-week digital delivery"
    ],
    excludes: [],
    duration: { value: 1, unit: "hours" },
    deliverables: { editedPhotos: 12, videos: 0, onlineGallery: true, printableFiles: false, turnaroundDays: 5 },
    isPopular: false,
    displayOrder: 4
  },

  // ── COMMERCIAL ───────────────────────────
  {
    name: "Brand Campaign & Product Suite",
    tagline: "High-end product, lifestyle & commercial visuals",
    category: "commercial",
    type: "fixed",
    price: { amount: 55000, currency: "INR", unit: "per day" },
    description: "Full-day commercial photography production for apparel, cosmetics, tech products, or hospitality brands.",
    includes: [
      "Full 8-hour production day",
      "Studio lighting setup & assistant",
      "Up to 25 hero product shots + flat lays",
      "Commercial usage licensing rights",
      "High resolution raw & color-graded TIF/PNG files"
    ],
    excludes: ["Model agency fees & prop purchasing"],
    duration: { value: 1, unit: "days" },
    deliverables: { editedPhotos: 50, videos: 0, onlineGallery: true, printableFiles: true, turnaroundDays: 10 },
    isPopular: true,
    displayOrder: 5
  },

  // ── NATURE & STREET ──────────────────────
  {
    name: "Architectural & Interior Showcase",
    tagline: "Precision tilt-shift capture for spaces and nature architecture",
    category: "nature",
    type: "custom",
    price: { amount: 28000, currency: "INR", unit: "starting from" },
    description: "Artistic documentation of luxury interior spaces, architectural landmarks, and outdoor eco-resorts.",
    includes: [
      "HDR twilight & daytime bracketed photography",
      "Wide angle perspective control shots",
      "20 architectural hero images",
      "Full digital rights for marketing & web"
    ],
    excludes: [],
    duration: { value: 5, unit: "hours" },
    deliverables: { editedPhotos: 20, videos: 0, onlineGallery: true, printableFiles: true, turnaroundDays: 7 },
    isPopular: false,
    displayOrder: 6
  }
];

async function seed() {
  console.log("→ Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected");

  await Package.deleteMany({});
  console.log("→ Cleared existing packages");

  const inserted = await Package.insertMany(SEED_PACKAGES);
  console.log(`✅ Seeded ${inserted.length} packages successfully.`);

  await mongoose.disconnect();
  console.log("✅ Disconnected.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed packages failed:", err.message);
  process.exit(1);
});
