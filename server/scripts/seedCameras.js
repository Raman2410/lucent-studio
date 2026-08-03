"use strict";

/**
 * seedCameras.js — populates the Camera collection with high-end camera body & lens rental gear.
 */

const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

const envFile =
  process.env.NODE_ENV === "production"
    ? ".env.production"
    : ".env.development";
dotenv.config({ path: path.resolve(__dirname, "..", envFile) });

const Camera = require("../src/models/Camera.model");

const SEED_CAMERAS = [
  {
    name: "Sony Alpha A7 IV",
    brand: "Sony",
    model: "ILCE-7M4",
    description: "The ultimate hybrid full-frame camera. 33MP Exmor R sensor, 4K 60p 10-bit recording, and industry-leading real-time eye AF.",
    image: {
      url: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop",
      s3Key: "cameras/sony-a7iv.jpg"
    },
    specs: {
      sensorType: "33.0 MP Full-Frame Exmor R CMOS",
      megapixels: 33,
      videoResolution: "4K 60p 10-Bit 4:2:2",
      isoRange: "100 - 51,200 (Expandable to 204,800)",
      autofocusPoints: 759,
      batteryLife: "~580 shots per NP-FZ100 battery",
      bodyType: "Mirrorless",
      mountType: "Sony E-Mount"
    },
    rentalRates: {
      hourly: 450,
      daily: 2500,
      weekend: 4200
    },
    accessories: [
      { name: "Sony FE 24-70mm f/2.8 GM II", description: "Flagship standard zoom lens", additionalCharge: 1200, isAvailable: true, image: { url: "https://images.unsplash.com/photo-1617005082133-3ac67ca24f0f?q=80&w=600&auto=format&fit=crop", s3Key: "cameras/accessories/sony-24-70.jpg" } },
      { name: "Sony FE 85mm f/1.4 GM", description: "Ultra-sharp portrait prime", additionalCharge: 1000, isAvailable: true, image: { url: "https://images.unsplash.com/photo-1519638831568-d9897f54ed69?q=80&w=600&auto=format&fit=crop", s3Key: "cameras/accessories/sony-85.jpg" } },
      { name: "Extra NP-FZ100 Battery Pair + Dual Charger", description: "All-day power kit", additionalCharge: 300, isAvailable: true, image: { url: "https://images.unsplash.com/photo-1620503374956-c942862f0372?q=80&w=600&auto=format&fit=crop", s3Key: "cameras/accessories/battery-kit.jpg" } }
    ],
    photographerAddon: { available: true, chargePerHour: 600 },
    isAvailable: true,
    displayOrder: 1
  },
  {
    name: "Canon EOS R5",
    brand: "Canon",
    model: "EOS R5",
    description: "45MP full-frame mirrorless powerhouse with 8K RAW video capture, 12 fps mechanical shutter, and 8-stop IBIS image stabilization.",
    image: {
      url: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?q=80&w=1200&auto=format&fit=crop",
      s3Key: "cameras/canon-r5.jpg"
    },
    specs: {
      sensorType: "45.0 MP Full-Frame CMOS",
      megapixels: 45,
      videoResolution: "8K 30p RAW & 4K 120p",
      isoRange: "100 - 51,200",
      autofocusPoints: 1053,
      batteryLife: "~490 shots per LP-E6NH battery",
      bodyType: "Mirrorless",
      mountType: "Canon RF Mount"
    },
    rentalRates: {
      hourly: 600,
      daily: 3500,
      weekend: 5800
    },
    accessories: [
      { name: "Canon RF 70-200mm f/2.8L IS USM", description: "Telephoto zoom lens", additionalCharge: 1500, isAvailable: true, image: { url: "https://images.unsplash.com/photo-1617005082133-548c4dd27f35?q=80&w=600&auto=format&fit=crop", s3Key: "cameras/accessories/canon-70-200.jpg" } },
      { name: "Canon RF 50mm f/1.2L USM", description: "Ultra-fast prime lens", additionalCharge: 1400, isAvailable: true, image: { url: "https://images.unsplash.com/photo-1606986601887-c5d5b8555a2c?q=80&w=600&auto=format&fit=crop", s3Key: "cameras/accessories/canon-50.jpg" } }
    ],
    photographerAddon: { available: true, chargePerHour: 750 },
    isAvailable: true,
    displayOrder: 2
  },
  {
    name: "Fujifilm X-T5",
    brand: "Fujifilm",
    model: "X-T5",
    description: "Photographer-first APS-C camera featuring a 40.2MP X-Trans CMOS 5 HR sensor, classic dial controls, and iconic film simulations.",
    image: {
      url: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?q=80&w=1200&auto=format&fit=crop",
      s3Key: "cameras/fuji-xt5.jpg"
    },
    specs: {
      sensorType: "40.2 MP APS-C X-Trans CMOS 5 HR",
      megapixels: 40,
      videoResolution: "6.2K 30p & 4K 60p",
      isoRange: "125 - 12,800",
      autofocusPoints: 425,
      batteryLife: "~700 shots per NP-W235 battery",
      bodyType: "Mirrorless",
      mountType: "Fujifilm X-Mount"
    },
    rentalRates: {
      hourly: 350,
      daily: 1900,
      weekend: 3200
    },
    accessories: [
      { name: "Fujinon XF 35mm f/1.4 R", description: "Classic character prime lens", additionalCharge: 600, isAvailable: true, image: { url: "https://images.unsplash.com/photo-1617005082133-6ba5019f9e3f?q=80&w=600&auto=format&fit=crop", s3Key: "cameras/accessories/fuji-35.jpg" } },
      { name: "Fujinon XF 16-55mm f/2.8 R LM WR", description: "Pro weather-sealed zoom", additionalCharge: 800, isAvailable: true, image: { url: "https://images.unsplash.com/photo-1617005082133-3ac67ca24f0f?q=80&w=600&auto=format&fit=crop", s3Key: "cameras/accessories/fuji-16-55.jpg" } }
    ],
    photographerAddon: { available: true, chargePerHour: 500 },
    isAvailable: true,
    displayOrder: 3
  },
  {
    name: "Hasselblad X2D 100C",
    brand: "Hasselblad",
    model: "X2D 100C",
    description: "Medium format masterpiece. 100MP BSI CMOS sensor delivering 15 stops of dynamic range and 16-bit color depth.",
    image: {
      url: "https://images.unsplash.com/photo-1617005082133-548c4dd27f35?q=80&w=1200&auto=format&fit=crop",
      s3Key: "cameras/hasselblad-x2d.jpg"
    },
    specs: {
      sensorType: "100 MP Medium Format BSI CMOS",
      megapixels: 100,
      videoResolution: "Stills Only Focus",
      isoRange: "64 - 25,600",
      autofocusPoints: 294,
      batteryLife: "~420 shots per battery",
      bodyType: "Medium Format",
      mountType: "Hasselblad X-System"
    },
    rentalRates: {
      hourly: 1500,
      daily: 8500,
      weekend: 14000
    },
    accessories: [
      { name: "Hasselblad XCD 55mm f/2.5 V Lens", description: "High-resolution prime lens", additionalCharge: 2500, isAvailable: true, image: { url: "https://images.unsplash.com/photo-1519638831568-d9897f54ed69?q=80&w=600&auto=format&fit=crop", s3Key: "cameras/accessories/hasselblad-55.jpg" } }
    ],
    photographerAddon: { available: true, chargePerHour: 1200 },
    isAvailable: true,
    displayOrder: 4
  }
];

async function seed() {
  console.log("→ Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected");

  await Camera.deleteMany({});
  console.log("→ Cleared existing cameras");

  const inserted = await Camera.insertMany(SEED_CAMERAS);
  console.log(`✅ Seeded ${inserted.length} cameras successfully.`);

  await mongoose.disconnect();
  console.log("✅ Disconnected.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed cameras failed:", err.message);
  process.exit(1);
});
