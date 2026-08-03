import { Link } from "react-router-dom";
import { Aperture, AtSign, Mail, Phone, MapPin, ArrowUpRight } from "lucide-react";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-paper-dim/80 pt-16 pb-8">
      <div className="container-page">
        {/* Top Highlight Banner */}
        <div className="mb-14 p-8 rounded-2xl bg-ink text-paper flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-signature/20 blur-3xl pointer-events-none" />
          <div className="max-w-xl relative z-10">
            <span className="meta-caption !text-paper/60 mb-2 block">🟢 Studio Status</span>
            <h3 className="font-display text-2xl md:text-3xl text-paper font-normal">
              Accepting bookings for 2026 sessions &amp; camera rentals.
            </h3>
            <p className="text-sm text-paper/70 mt-2 font-light">
              Available for destination weddings, commercial campaigns &amp; studio portraits worldwide.
            </p>
          </div>
          <Link
            to="/packages"
            className="relative z-10 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-paper text-ink font-medium text-sm hover:bg-paper-dim transition-all duration-300 shadow-md group"
          >
            Check Availability
            <ArrowUpRight className="h-4 w-4 text-ink transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        </div>

        {/* 4-column Links Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 pb-16 border-b border-line">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <Aperture className="h-5 w-5 text-signature" strokeWidth={1.5} />
              <span className="font-display text-lg text-ink font-medium">Lucent Studio</span>
            </Link>
            <p className="text-sm text-mist leading-relaxed max-w-xs font-light">
              Fine-art photography &amp; medium format gear rentals for storytellers who notice light.
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs font-mono text-mist">
              <MapPin className="h-3.5 w-3.5 text-signature" />
              <span>Bangalore · Udaipur · Worldwide</span>
            </div>
          </div>

          {/* Explore */}
          <div>
            <p className="meta-caption mb-4 text-ink font-medium">Explore</p>
            <ul className="space-y-3">
              <li>
                <Link to="/portfolio" className="text-sm text-mist hover:text-signature transition-colors">
                  Selected Portfolio
                </Link>
              </li>
              <li>
                <Link to="/packages" className="text-sm text-mist hover:text-signature transition-colors">
                  Photography Packages
                </Link>
              </li>
              <li>
                <Link to="/cameras" className="text-sm text-mist hover:text-signature transition-colors">
                  Camera Gear Rentals
                </Link>
              </li>
            </ul>
          </div>

          {/* Studio */}
          <div>
            <p className="meta-caption mb-4 text-ink font-medium">Studio</p>
            <ul className="space-y-3">
              <li>
                <Link to="/about" className="text-sm text-mist hover:text-signature transition-colors">
                  About &amp; Philosophy
                </Link>
              </li>
              <li>
                <Link to="/my-bookings" className="text-sm text-mist hover:text-signature transition-colors">
                  Client Portal
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-sm text-mist hover:text-signature transition-colors">
                  Sign In
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <p className="meta-caption mb-4 text-ink font-medium">Connect</p>
            <ul className="space-y-3">
              <li>
                <a
                  href="mailto:hello@lucentstudio.com"
                  className="flex items-center gap-2.5 text-sm text-mist hover:text-signature transition-colors"
                >
                  <Mail className="h-4 w-4 text-signature/70" strokeWidth={1.5} /> hello@lucentstudio.com
                </a>
              </li>
              <li>
                <a
                  href="tel:+919876543210"
                  className="flex items-center gap-2.5 text-sm text-mist hover:text-signature transition-colors"
                >
                  <Phone className="h-4 w-4 text-signature/70" strokeWidth={1.5} /> +91 98765 43210
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 text-sm text-mist hover:text-signature transition-colors"
                >
                  <AtSign className="h-4 w-4 text-signature/70" strokeWidth={1.5} /> @lucentstudio
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-mist">
          <p>© {year} Lucent Studio — All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span>35mm &amp; Medium Format</span>
            <span>·</span>
            <span>Processed with Care</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
