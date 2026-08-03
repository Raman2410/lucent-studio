import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Image as ImageIcon,
  Package as PackageIcon,
  Camera as CameraIcon,
  CalendarClock,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarClock },
  { to: "/admin/availability", label: "Availability", icon: CalendarDays },
  { to: "/admin/photos", label: "Photos", icon: ImageIcon },
  { to: "/admin/packages", label: "Packages", icon: PackageIcon },
  { to: "/admin/cameras", label: "Cameras", icon: CameraIcon },
];

export default function AdminLayout() {
  return (
    <div>
      <div className="container-page pt-6">
        <nav className="flex items-center gap-1 border-b border-line overflow-x-auto">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-mono whitespace-nowrap border-b-2 -mb-px transition-colors",
                  isActive
                    ? "border-signature text-ink"
                    : "border-transparent text-mist hover:text-ink"
                )
              }
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
