import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarDays, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import AvailabilityCalendar from "@/components/booking/AvailabilityCalendar";
import { useAuth } from "@/context/AuthContext";

/**
 * Availability — public-facing page where anyone can browse the
 * photographer's schedule before deciding to book. No login needed
 * (the availability endpoints are public — see availability.routes.js).
 *
 * Flow:
 *   1. User browses the calendar (GET /api/availability/:month)
 *   2. Clicks a date → real-time check (GET /api/availability/check)
 *   3. If available → "Book this date" CTA appears, linking straight
 *      into /packages with the date pre-set via URL state so the
 *      booking form can skip the calendar step.
 *   4. If not authenticated → ProtectedRoute on /book/* handles the
 *      login redirect with return-to preserved.
 */
export default function Availability() {
  const [selectedDate, setSelectedDate] = useState(null);
  const { isAuthenticated } = useAuth();

  const formattedDate = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="container-page py-16 sm:py-20">
      <div className="max-w-2xl mx-auto">

        {/* page header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mb-10"
        >
          <p className="meta-caption mb-3">Check availability</p>
          <h1 className="font-display text-4xl sm:text-5xl text-ink mb-4">
            When would you like to shoot?
          </h1>
          <p className="text-mist text-[15px] leading-relaxed">
            Browse open dates and check real-time slot availability before choosing a package.
            Bookings require at least 48 hours notice.
          </p>
        </motion.div>

        {/* calendar */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <AvailabilityCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </motion.div>

        {/* CTA — appears once a valid date is selected */}
        {selectedDate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 border border-signature/30 bg-signature-tint p-6"
          >
            <div className="flex items-start gap-3 mb-5">
              <CheckCircle2
                className="h-5 w-5 text-signature mt-0.5 shrink-0"
                strokeWidth={1.5}
              />
              <div>
                <p className="text-[15px] font-medium text-ink">
                  {formattedDate} is available
                </p>
                <p className="text-[13.5px] text-mist mt-0.5">
                  Choose a package to continue — your selected date will carry over.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="signature" size="default" asChild>
                <Link
                  to="/packages"
                  state={{ preselectedDate: selectedDate }}
                >
                  Browse packages
                  <ArrowRight className="ml-1.5 h-4 w-4" strokeWidth={1.5} />
                </Link>
              </Button>

              {!isAuthenticated && (
                <p className="flex items-center gap-1.5 text-[12.5px] text-mist self-center">
                  <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  You'll be asked to sign in when you book
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* info cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-12 grid sm:grid-cols-2 gap-4"
        >
          <InfoCard
            icon={<CalendarDays className="h-4 w-4" strokeWidth={1.5} />}
            title="48-hour notice required"
            body="All sessions must be booked at least 48 hours in advance to allow preparation time."
          />
          <InfoCard
            icon={<CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />}
            title="Up to 3 sessions per day"
            body="The studio accepts up to 3 bookings per day. Dates with 1 slot left are highlighted."
          />
        </motion.div>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, body }) {
  return (
    <div className="border border-line p-5">
      <div className="flex items-center gap-2 text-signature mb-2">
        {icon}
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
      </div>
      <p className="text-[13px] text-mist leading-relaxed">{body}</p>
    </div>
  );
}
