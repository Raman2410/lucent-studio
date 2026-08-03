"use strict";

/**
 * seedPhotos.js — populates the Photo collection with real,
 * viewable images so the frontend portfolio (and homepage hero
 * slideshow) has content to render before you've built/used the
 * admin upload flow.
 *
 * Inserts 5 photos per category (25 total), matching the enum in
 * Photo.model.js exactly: wedding, portrait, commercial, nature,
 * street. The 5 "nature" photos are tagged mountain/river/bird so
 * the homepage HeroSlideshow (which filters by ?tag=) picks them
 * up automatically too.
 *
 * These use Unsplash URLs, not your own S3 bucket — they're meant
 * to get the UI populated and working end-to-end right now. Swap
 * them out for real S3-hosted photos via your upload endpoints
 * whenever you have them; nothing else in the app needs to change,
 * since the frontend only ever reads `photo.url`.
 *
 * Safe to re-run: it removes only photos it previously seeded
 * (identified by s3Key starting with "seed/") before inserting,
 * so it never touches real uploaded photos.
 *
 * Usage:
 *   cd server
 *   node scripts/seedPhotos.js
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";
dotenv.config({ path: path.resolve(__dirname, "..", envFile) });

const Photo = require("../src/models/Photo.model");
const { connectRedis, cacheDelete, cacheDeletePattern, CACHE_KEYS } = require("../src/config/redis");

const SEED_PHOTOS = [
  // ── WEDDING ──────────────────────────────
  {
    category: "wedding",
    title: "First Look, Golden Hour",
    description:
      "An intimate first look shared just before the ceremony began.",
    url: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 1,
    isFeatured: true,
  },
  {
    category: "wedding",
    title: "The Aisle Walk",
    description: "Every eye in the room, on her.",
    url: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 2,
  },
  {
    category: "wedding",
    title: "Exchange of Vows",
    description: "The quiet part of a very loud day.",
    url: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 3,
  },
  {
    category: "wedding",
    title: "Reception Lights",
    description: "String lights and the first dance.",
    url: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 4,
  },
  {
    category: "wedding",
    title: "Rings & Details",
    description: "The small things worth slowing down for.",
    url: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?q=80&w=1600&auto=format&fit=crop&sat=-20",
    displayOrder: 5,
  },

  // ── PORTRAIT ─────────────────────────────
  {
    category: "portrait",
    title: "Studio Light Study",
    description: "A single softbox, a quiet expression.",
    url: "https://images.unsplash.com/photo-1520854221256-17451cc331bf?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 1,
    isFeatured: true,
  },
  {
    category: "portrait",
    title: "Golden Hour Portrait",
    description: "Shot on location as the light turned amber.",
    url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 2,
  },
  {
    category: "portrait",
    title: "Editorial Black & White",
    description: "Stripped of color, kept the mood.",
    url: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 3,
  },
  {
    category: "portrait",
    title: "Natural Light Session",
    description: "A window, a chair, an afternoon.",
    url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 4,
  },
  {
    category: "portrait",
    title: "Environmental Portrait",
    description: "Someone in the place that made them.",
    url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 5,
  },

  // ── COMMERCIAL ───────────────────────────
  {
    category: "commercial",
    title: "Product on Paper",
    description: "Clean product photography for a small-batch label.",
    url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 1,
    isFeatured: true,
  },
  {
    category: "commercial",
    title: "Studio Flat Lay",
    description: "Overhead composition for a seasonal catalogue.",
    url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 2,
  },
  {
    category: "commercial",
    title: "Interior — Cafe Brand Shoot",
    description: "Documenting a space for a hospitality client.",
    url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 3,
  },
  {
    category: "commercial",
    title: "Founder Headshots",
    description: "On-site corporate portraits for a startup team.",
    url: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 4,
  },
  {
    category: "commercial",
    title: "Menu Photography",
    description: "Plated dishes shot for a restaurant relaunch.",
    url: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 5,
  },

  // ── NATURE (tagged mountain / river / bird for the hero slideshow) ──
  {
    category: "nature",
    title: "Ridge Line at Dawn",
    description: "First light over the high range.",
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=1600&auto=format&fit=crop",
    tags: ["mountain", "landscape"],
    displayOrder: 1,
    isFeatured: true,
  },
  {
    category: "nature",
    title: "Snow Peaks",
    description: "Above the treeline, mid-winter.",
    url: "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?q=80&w=1600&auto=format&fit=crop",
    tags: ["mountain"],
    displayOrder: 2,
  },
  {
    category: "nature",
    title: "River Bend",
    description: "Where the current slows and the light pools.",
    url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1600&auto=format&fit=crop",
    tags: ["river", "water"],
    displayOrder: 3,
  },
  {
    category: "nature",
    title: "Rapids",
    description: "Fast water through granite.",
    url: "https://images.unsplash.com/photo-1502472584811-0a2f2feb8968?q=80&w=1600&auto=format&fit=crop",
    tags: ["river"],
    displayOrder: 4,
  },
  {
    category: "nature",
    title: "Kingfisher at Rest",
    description: "A quiet moment on the riverbank.",
    url: "https://images.unsplash.com/photo-1444464666168-49d633b86797?q=80&w=1600&auto=format&fit=crop",
    tags: ["bird", "wildlife"],
    displayOrder: 5,
  },

  // ── STREET ───────────────────────────────
  {
    category: "street",
    title: "Crosswalk, Rain",
    description: "Reflections after a storm downtown.",
    url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 1,
    isFeatured: true,
  },
  {
    category: "street",
    title: "Market Morning",
    description: "The stalls opening before the crowd arrives.",
    url: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 2,
  },
  {
    category: "street",
    title: "Alleyway Light",
    description: "A single shaft of sun between buildings.",
    url: "https://images.unsplash.com/photo-1519677100203-a0e668c92439?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 3,
  },
  {
    category: "street",
    title: "Night Market",
    description: "Neon and motion, handheld at 1/30s.",
    url: "https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 4,
  },
  {
    category: "street",
    title: "Commuters",
    description: "The city moving at its usual pace.",
    url: "https://images.unsplash.com/photo-1519677584237-752f8853252e?q=80&w=1600&auto=format&fit=crop",
    displayOrder: 5,
  },
];

async function seed() {
  console.log("→ Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected");

  // remove any photos this script previously inserted (identified by
  // the "seed/" s3Key prefix) so re-running doesn't create duplicates,
  // while never touching real uploaded photos
  const { deletedCount } = await Photo.deleteMany({
    s3Key: { $regex: "^seed/" },
  });
  if (deletedCount > 0) {
    console.log(`→ Removed ${deletedCount} previously seeded photo(s)`);
  }

  const docs = SEED_PHOTOS.map((photo, i) => ({
    ...photo,
    // s3Key is required by the schema but unused for these (they're
    // hosted on Unsplash, not your bucket) — the "seed/" prefix is
    // what lets this script find and clean them up on re-run
    s3Key: `seed/${photo.category}-${i}`,
  }));

  const inserted = await Photo.insertMany(docs);
  console.log(`✅ Inserted ${inserted.length} photos:`);

  const byCategory = inserted.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + 1;
    return acc;
  }, {});
  Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`   ${cat}: ${count}`);
  });

  // this script writes straight to MongoDB, bypassing the app entirely —
  // if any category was ever fetched with 0 photos before this ran, the
  // API cached that empty result for hours. Clear those caches now so
  // the seeded photos show up immediately instead of waiting on TTL.
  console.log("→ Clearing photo cache...");
  await connectRedis();
  await cacheDelete(CACHE_KEYS.allPhotos);
  await cacheDeletePattern("photos:category:*");
  console.log("✅ Photo cache cleared.");

  await mongoose.disconnect();
  console.log("✅ Done. Disconnected.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
