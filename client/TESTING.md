# Testing

Stack: **Vitest** + **React Testing Library** + **jsdom**, coverage via `@vitest/coverage-v8`.

## Running

```bash
npm test               # run once
npm run test:watch     # watch mode
npm run test:coverage  # run + generate coverage/ (html, lcov, json-summary)
```

## Honest current state

**85 tests, all passing.** Coverage is uneven on purpose — it's deep on the
pieces that are cheap to get right and high-value to protect, and empty on
the pieces that need a different kind of test to be worth writing.

| Area | Coverage | Notes |
|---|---|---|
| `src/lib/utils.js`, `src/lib/calendarUtils.js` | ~100% | Pure functions — cheapest, highest-confidence tests in the repo |
| `src/components/ui/*` | ~88% | Button, Modal/ConfirmDialog, FormField, Input, Select, Skeleton, EmptyState, StatusBadge |
| `src/context/ThemeContext.jsx` | ~80% | Persistence, OS-preference fallback, cross-tab sync untested |
| `src/services/bookingService.js`, `cameraService.js`, `packageService.js` | partial | Endpoint/payload wiring, mocked axios — no real HTTP |
| **Pages** (`src/pages/**`) | **0%** | Booking flow, admin CRUD screens, auth — the actual business logic |
| `AuthContext`, `NotificationContext` | 0% | |
| `hooks/useBookingSocket.js`, `services/socketService.js` | 0% | Socket.io — needs a mock server or event-emitter stub |

Repo-wide: **~6% statement coverage.** A README badge claiming 80%+ across
the whole app would be false — that number only applies if you scope it to
`lib/` + `components/ui/`, which is what today's tests actually target.

## Why pages are untested (and what it'd take)

Pages mix data-fetching, form state, and UI in one file, so testing them
properly means: mock the relevant `services/*.js` module, render the page,
and assert on user-visible behavior (loading → data → interaction), not
implementation details. That's a different, heavier kind of test than the
pure-function and component tests here. Recommended order of attack, easiest
and highest-value first:

1. `Packages.jsx` / `Cameras.jsx` — fetch → render list → filter, minimal state
2. `MyBookings.jsx` — fetch → cancel/delete flow, mock `bookingService`
3. `AdminBookings.jsx` / `AdminPackages.jsx` / `AdminCameras.jsx` — CRUD + modals
4. `Booking.jsx` — the multi-step flow with cost calculation, most complex
5. `AuthContext` — login/logout/token persistence, mock `authService`

## Conventions for new tests

- Co-locate: `Component.jsx` → `Component.test.jsx` in the same folder.
- Mock `@/lib/api` (see `src/services/services.test.js`) rather than hitting
  a real backend — every service is a thin wrapper around it.
- Use `@testing-library/user-event`, not `fireEvent`, for anything
  simulating a real interaction (typing, clicking, selecting).
- Query by role/label text (`getByRole`, `getByLabelText`), not by class
  name or test id, so tests break when behavior breaks, not when styling
  changes.
