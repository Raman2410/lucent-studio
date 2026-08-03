import { Camera, MapPin, Mail, Phone, Sparkles, Award, Sliders, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function About() {
  return (
    <div className="container-page py-16 sm:py-24">
      {/* Header */}
      <div className="max-w-3xl mb-16">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-signature" />
          <p className="meta-caption text-signature">Studio Philosophy</p>
        </div>
        <h1 className="font-display text-4xl sm:text-6xl text-ink font-normal tracking-tight">
          Crafting Images That Hold Their Light.
        </h1>
        <p className="text-mist mt-6 text-base sm:text-lg leading-relaxed font-light">
          Lucent Studio was founded on a singular principle: capturing authentic human emotion with quiet restraint, natural color fidelity, and medium format precision.
        </p>
      </div>

      {/* Hero Image Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
        <div className="print-frame rounded-2xl overflow-hidden aspect-[4/5] bg-paper-dim md:col-span-2">
          <img
            src="https://images.unsplash.com/photo-1542038784456-1ea8e935640e?q=80&w=1600&auto=format&fit=crop"
            alt="Studio photography in action"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex flex-col gap-6">
          <div className="print-frame rounded-2xl overflow-hidden aspect-[4/5] bg-paper-dim">
            <img
              src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?q=80&w=1200&auto=format&fit=crop"
              alt="Medium format camera craft"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-8 rounded-2xl bg-signature text-paper flex flex-col justify-between flex-1">
            <p className="meta-caption !text-paper/60">Craft Statement</p>
            <p className="font-display text-xl text-paper font-light italic mt-4">
              &ldquo;We don&apos;t pose moments; we build an atmosphere where authentic light happens.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Values Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-24 pb-16 border-b border-line">
        <div className="p-8 rounded-2xl bg-paper-dim/60 border border-line">
          <div className="h-10 w-10 rounded-lg bg-signature-tint flex items-center justify-center mb-4 text-signature">
            <Sliders className="h-5 w-5" />
          </div>
          <h3 className="font-display text-xl text-ink font-medium mb-2">Intentional Light</h3>
          <p className="text-sm text-mist font-light leading-relaxed">
            Every shadow and highlight is composed with care to preserve natural skin tones and organic depth.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-paper-dim/60 border border-line">
          <div className="h-10 w-10 rounded-lg bg-signature-tint flex items-center justify-center mb-4 text-signature">
            <Camera className="h-5 w-5" />
          </div>
          <h3 className="font-display text-xl text-ink font-medium mb-2">Precision Optics</h3>
          <p className="text-sm text-mist font-light leading-relaxed">
            We shoot on Hasselblad medium format &amp; Sony G-Master prime lenses to render unrivaled image resolution.
          </p>
        </div>

        <div className="p-8 rounded-2xl bg-paper-dim/60 border border-line">
          <div className="h-10 w-10 rounded-lg bg-signature-tint flex items-center justify-center mb-4 text-signature">
            <Award className="h-5 w-5" />
          </div>
          <h3 className="font-display text-xl text-ink font-medium mb-2">Heirloom Delivery</h3>
          <p className="text-sm text-mist font-light leading-relaxed">
            Your final gallery is color-graded, archived on secure cloud servers, and printed on fine-art archival paper.
          </p>
        </div>
      </div>

      {/* Contact & Studio Location */}
      <div className="max-w-4xl mx-auto p-10 rounded-3xl bg-paper border border-line shadow-card flex flex-col md:flex-row items-center justify-between gap-8">
        <div>
          <span className="meta-caption text-signature mb-1 block">Studio Base</span>
          <h3 className="font-display text-3xl text-ink font-normal mb-2">Visit Or Connect</h3>
          <p className="text-sm text-mist font-light leading-relaxed mb-6">
            Our studio space is open for pre-wedding consultations, gear handovers, and portrait sessions by appointment.
          </p>
          <div className="space-y-2 text-xs font-mono text-ink-soft">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-signature" /> Bangalore · Indiranagar 100ft Rd
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-signature" /> hello@lucentstudio.com
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-signature" /> +91 98765 43210
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-auto shrink-0">
          <Button variant="signature" size="lg" className="rounded-full shadow-md" asChild>
            <Link to="/packages">Book a Photography Session</Link>
          </Button>
          <Button variant="outline" size="lg" className="rounded-full border-line" asChild>
            <Link to="/cameras">Explore Camera Rentals</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
