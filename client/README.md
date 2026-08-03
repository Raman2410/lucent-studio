# Lumio — Photography Business Platform (Client)

![tests](https://img.shields.io/badge/tests-85%20passing-brightgreen)
![coverage: lib + ui kit](https://img.shields.io/badge/coverage%20(lib%2Fui--kit)-~90%25-brightgreen)
![coverage: overall](https://img.shields.io/badge/coverage%20(whole%20app)-~6%25-red)

The customer- and admin-facing web app for Lumio, a full-stack photography
business platform: browse a photographer's portfolio, book sessions or rent
camera gear, pay online, and track bookings in real time. Built with React 19
and Vite, styled around a custom "paper & darkroom" design system.

This repo is the frontend only. It talks to a separate Node/Express +
MongoDB API — see [Backend setup](#backend-setup) below.

## Features

**Public**
- Portfolio gallery with category filters and a keyboard-navigable lightbox
- Photography package browsing and camera gear rental catalog
- Live availability calendar (blocked dates, fully-booked days)
- Multi-step booking flow with real-time cost calculation
- Razorpay checkout for session and rental payments
- Help center with a support-query thread

**Account**
- Email/password auth with forgot/reset password flow
- Booking history with status tracking, cancellation, and live status
  updates over Socket.io
- Profile and password management

**Admin**
- Live dashboard: revenue, requests, pending bookings, camera utilization,
  and a real-time activity feed
- Booking management with search, filters, and quick status actions
- Package, camera, and photo CRUD with image upload
- Calendar-based date blocking for availability control

**Platform-wide**
- Light/dark mode (persisted, system-aware)
- Toast notifications and in-app notification center
- Responsive down to mobile, with skeleton loaders and empty states across
  every data-driven view

## Screenshots

> Screenshots aren't checked into this repo yet. Run the app locally
> (`npm run dev`) and drop your own into a `docs/screenshots/` folder — the
> portfolio grid, booking flow, and admin dashboard are the best three to
> capture for a README.

| Page | Description |
|---|---|
| Home | Hero, featured portfolio grid, package teasers |
| Portfolio | Filterable gallery with lightbox |
| Booking flow | Package/camera selection → cost breakdown → payment |
| Admin dashboard | Live revenue, bookings, and activity feed |

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4, custom design tokens (`src/index.css`) |
| Animation | Motion (Framer Motion successor) |
| Icons | Lucide React |
| Real-time | Socket.io client |
| HTTP | Axios |
| Utility | class-variance-authority, clsx, tailwind-merge |
| Smooth scroll | Lenis |
| Linting | Oxlint |

## Installation

Requires Node.js 18+ and a running instance of the [backend API](#backend-setup).

```bash
git clone <repo-url>
cd novelverse-client   # or wherever this client folder lives
npm install
cp .env.example .env   # then fill in your values, see below
npm run dev
```

The app runs at `http://localhost:5173` by default.

### Available scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run Oxlint |

## Environment variables

Create a `.env` file in the project root (see `.env.example`):

| Variable | Description | Default (dev) |
|---|---|---|
| `VITE_API_URL` | Base URL of the backend REST API | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | Base URL of the backend Socket.io server | `http://localhost:5000` |

For a production build, point both at your deployed backend (e.g.
`https://api.yourdomain.com/api` and `https://api.yourdomain.com`).

## Folder structure

```
src/
├── assets/                # Static images, fonts, illustrations
├── components/
│   ├── booking/            # Calendar, cost breakdown, step indicators
│   ├── chat/                # Support-query chat UI
│   ├── home/                 # Landing-page-only sections
│   ├── layout/               # Header, Footer, AdminLayout shell
│   ├── notifications/        # Toasts, notification center
│   ├── routing/               # ProtectedRoute, AdminRoute guards
│   └── ui/                     # Design-system primitives (Button, Modal,
│                                 Select, StatusBadge, Skeleton, EmptyState…)
├── context/                # AuthContext, ThemeContext, NotificationContext
├── hooks/                  # Shared custom hooks
├── lib/                    # api.js (Axios instance), utils.js (cn helper),
│                              calendarUtils.js
├── pages/                  # One file per route (Home, Portfolio, Booking…)
│   └── admin/                # Admin-only routes (Dashboard, Bookings…)
├── services/                # One file per backend resource — thin wrappers
│                              around the Axios instance (bookingService.js,
│                              cameraService.js, adminService.js…)
├── App.jsx                 # Route definitions
├── index.css                # Design tokens, base styles, dark mode
└── main.jsx                 # Entry point
```

**Conventions worth knowing:**
- Every API call goes through a `services/*.js` file, never a raw `axios`
  call inside a component or page.
- Design tokens (colors, fonts, radii, shadows) live entirely in
  `index.css` under `@theme`; dark mode overrides the same custom
  properties inside a `.dark` block, so components never need `dark:`
  utility variants.
- Loading and empty states use the shared `Skeleton` / `EmptyState`
  components in `components/ui/` rather than one-off spinners or text.

## Backend setup

This client expects a compatible Node/Express API exposing REST endpoints
under `/api/*` and a Socket.io server for real-time booking/notification
updates (bookings, availability, packages, cameras, photos, auth, admin,
payments via Razorpay). Clone and run that repo separately, then point
`VITE_API_URL` / `VITE_SOCKET_URL` at it.

## Testing

85 tests currently pass, covering the pure-logic utilities and the shared
`components/ui/` kit at ~90%. Pages and services aren't covered yet — see
[`TESTING.md`](./TESTING.md) for the honest per-area breakdown, why pages are
the hard/unstarted part, and the recommended order to tackle them.

```bash
npm test               # run once
npm run test:coverage  # run + write an HTML report to coverage/
```
