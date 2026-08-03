import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Aperture, Menu, X, User, LogOut, Calendar, MessageCircleQuestion, LayoutDashboard } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ui/theme-toggle";
import NotificationBell from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const NAV_LINKS = [
  { label: "Portfolio", href: "/portfolio" },
  { label: "Packages", href: "/packages" },
  { label: "Camera Rentals", href: "/cameras" },
  { label: "Availability", href: "/availability" },
  { label: "Studio & About", href: "/about" },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    setUserDropdown(false);
    setMobileOpen(false);
    navigate("/");
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Close the profile dropdown on outside click/tap, and on Escape.
  // Replaces the old onMouseLeave-only approach, which closed the menu
  // prematurely whenever the cursor crossed the gap between the trigger
  // button and the absolutely-positioned menu below it (and never worked
  // at all on touch devices).
  useEffect(() => {
    if (!userDropdown) return;

    const handlePointerDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdown(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setUserDropdown(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [userDropdown]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-paper/85 backdrop-blur-md border-b border-line shadow-[0_4px_20px_rgba(0,0,0,0.03)] py-3"
          : "bg-paper border-b border-transparent py-4.5",
      )}
    >
      <div className="container-page flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-full bg-signature/10 flex items-center justify-center border border-signature/20 transition-all duration-500 group-hover:bg-signature group-hover:border-signature">
            <Aperture
              className="h-5 w-5 text-signature transition-transform duration-700 ease-signature group-hover:rotate-180 group-hover:text-paper"
              strokeWidth={1.5}
            />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg tracking-tight text-ink font-medium leading-none">
              Lucent
              <span className="italic text-signature font-normal">Studio</span>
            </span>
            <span className="meta-caption text-[9px] text-mist/80 tracking-widest mt-0.5">
              Photography &amp; Gear
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1 bg-paper-dim/60 p-1.5 rounded-full border border-line/60">
          {NAV_LINKS.map((link) => {
            const active = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "relative px-4 py-1.5 text-[13px] font-medium transition-all duration-200 rounded-full",
                  active
                    ? "text-paper font-semibold"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                {active && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-ink rounded-full z-0"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Actions */}
        <div className="hidden lg:flex items-center gap-3">
          <ThemeToggle />
          {isAuthenticated && <NotificationBell />}
          {isAuthenticated && (
            <Link
              to="/help"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-line hover:border-signature/40 hover:text-signature bg-paper text-[13px] font-medium text-ink-soft transition-all"
            >
              <MessageCircleQuestion className="h-3.5 w-3.5" strokeWidth={1.5} />
              Query
            </Link>
          )}

          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setUserDropdown((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-line hover:border-signature/40 bg-paper transition-all"
              >
                <div className="h-6 w-6 rounded-full bg-signature text-paper text-[11px] font-mono font-medium flex items-center justify-center">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <span className="text-[13px] font-medium text-ink truncate max-w-[100px]">
                  {user?.name?.split(" ")[0]}
                </span>
              </button>

              <AnimatePresence>
                {userDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-48 bg-paper border border-line rounded-lg shadow-lg p-2 z-50"
                  >
                    <Link
                      to="/my-bookings"
                      onClick={() => setUserDropdown(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink hover:bg-paper-dim rounded-md transition-colors"
                    >
                      <Calendar className="h-3.5 w-3.5 text-mist" />
                      My Bookings
                    </Link>
                    <Link
                      to="/account"
                      onClick={() => setUserDropdown(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink hover:bg-paper-dim rounded-md transition-colors"
                    >
                      <User className="h-3.5 w-3.5 text-mist" />
                      Account Settings
                    </Link>
                    {user?.role === "admin" && (
                      <Link
                        to="/admin"
                        onClick={() => setUserDropdown(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink hover:bg-paper-dim rounded-md transition-colors"
                      >
                        <LayoutDashboard className="h-3.5 w-3.5 text-mist" />
                        Admin Dashboard
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors text-left"
                    >
                      <LogOut className="h-3.5 w-3.5 text-red-500" />
                      Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Link
              to="/login"
              className="text-[13.5px] font-medium text-ink-soft hover:text-signature transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
          )}

          <Button
            variant="signature"
            size="sm"
            className="rounded-full shadow-sm"
            asChild
          >
            <Link to="/packages">Book a session</Link>
          </Button>
        </div>

        {/* Mobile Toggle */}
        <div className="lg:hidden flex items-center gap-1 -mr-2">
          <ThemeToggle />
          {isAuthenticated && <NotificationBell />}
          <button
            className="p-2 text-ink rounded-lg hover:bg-paper-dim transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden overflow-hidden border-t border-line bg-paper/95 backdrop-blur-md"
          >
            <nav className="container-page flex flex-col py-6 gap-2">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={cn(
                    "py-3 text-[15px] font-medium border-b border-line/60 last:border-none flex items-center justify-between",
                    location.pathname === link.href
                      ? "text-signature font-semibold"
                      : "text-ink",
                  )}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                  <span className="text-xs font-mono text-mist">→</span>
                </Link>
              ))}

              {isAuthenticated && (
                <>
                  <Link
                    to="/my-bookings"
                    className="py-3 text-[15px] font-medium text-ink border-b border-line/60"
                    onClick={() => setMobileOpen(false)}
                  >
                    My Bookings
                  </Link>
                  {user?.role === "admin" && (
                    <Link
                      to="/admin"
                      className="py-3 text-[15px] font-medium text-ink border-b border-line/60"
                      onClick={() => setMobileOpen(false)}
                    >
                      Admin Dashboard
                    </Link>
                  )}
                  <Link
                    to="/help"
                    className="py-3 text-[15px] font-medium text-ink border-b border-line/60"
                    onClick={() => setMobileOpen(false)}
                  >
                    Help Center
                  </Link>
                </>
              )}

              <div className="flex flex-col gap-3 pt-4">
                {isAuthenticated ? (
                  <button
                    onClick={handleLogout}
                    className="meta-caption text-left text-red-600 flex items-center gap-2 py-2"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="text-sm font-medium text-center text-ink hover:text-signature py-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign in to your account
                  </Link>
                )}
                <Button
                  variant="signature"
                  size="default"
                  className="w-full rounded-full"
                  asChild
                >
                  <Link to="/packages" onClick={() => setMobileOpen(false)}>
                    Book a session
                  </Link>
                </Button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
