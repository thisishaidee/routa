This file provides guidance when working with code in this repository. The README.md should ALWAYS serve as an accurate, comprehensive piece of documentation for this project. It should describe the broader goals and purpose of this repository along with the technical implementation details. If any aspect of the project changes, the README.md should be updated to reflect that.

# Project Notes

Routa is a daily rhythm product for anyone who wants a structured day. It is the app homepage and is designed mobile-first.

The lime incomplete-circle mark is unchanged. Only the wordmark and product name changed from Daymark to Routa.

## Current product (V4 + alarm architecture)

- Template-based onboarding, including a 13-checkpoint Builder rhythm
- A routine editor for times, titles, tasks, task order, repeat days, and reminders
- Daily completion lives on the day, never on the task definition
- Progress: remaining, missed, tasks, current/best streak, finished days, health, insights, suggestions
- JSON backup export/import (`app: "routa"`, snapshot version 4)
- PWA manifest for install; reminders still need the app open on web
- Local persistence on the current device. No accounts. No cloud.
- Missed sessions: Today offers a few choices (move only today, change the usual time, or leave it). Nothing moves until you pick. A today-only move is stored in `routa:v2:recovery` and does not rewrite the repeating checkpoint or past days.

### Reminders / alarms (honest)

Web / PWA:
- Browser notifications while Routa is open
- Web Push is detected, not subscribed (no server yet)
- Status is **On while open**, never **Scheduled**
- Never claims “Alarm added to your phone”
- Permission is requested only when the user turns reminders on
- If denied: **Reminders are disabled**

Native (prepared, not live in this web build):
- Platform-independent `AlarmScheduler` in `src/lib/daymark/alarms/`
- Android contract: AlarmManager exact next-occurrence + boot/timezone reschedule (`native/android`)
- iOS contract: AlarmKit weekly recurrence + notification fallback (`native/ios`)
- Native only reports **Scheduled** when `window.RoutaNativeAlarms` is injected and exact alarms are actually available
- ROUTA never writes into the Clock app

Routine is the source of truth. Desired alarms are derived from checkpoints. The local registry (`routa:v2:alarms`) is a cache, not an independent object.

Existing Daymark V2 data is copied forward to Routa keys (`routa:v2:*`) without wiping the old `daymark:v2:*` keys. V1 keys (`daymark-done`, `daymark-tasks`, `daymark-alarms`, `daymark-note-*`) still migrate when no V2 data exists.

The main Routa screen lives in `src/pages/daymark.tsx` and is mounted at `/` from `src/App.tsx`. The original starter data demo remains available at `/data-demo`, and the component gallery remains available at `/_design`.

---

# Documentation

This is a **Zo Site** - a web application running on a user's Zo computer that combines:
- **Backend**: Bun + Hono server with API routes
- **Frontend**: React + Vite with client-side routing, shadcn/ui components, and Tailwind CSS 4
- **Single Process**: Vite runs in middleware mode (no separate dev server)

## Architecture

### File Structure

```
.
├── server.ts              # Main server (Hono + Vite middleware)
├── index.html             # HTML entry point for React
├── vite.config.ts         # Vite configuration
├── package.json           # Dependencies and scripts
├── zosite.json            # Zo deployment config (ports, env vars)
├── public/                # Static assets (favicon, reminder worker, PWA manifest)
│   ├── favicon.svg
│   ├── manifest.webmanifest
│   └── daymark-sw.js         # Reminder service worker (legacy path, kept)
├── native/                # Android AlarmManager + iOS AlarmKit reference (not compiled here)
├── src/
│   ├── main.tsx
│   ├── App.tsx               # Router: Routa at /, demos at /data-demo and /_design
│   ├── styles.css
│   ├── pages/daymark.tsx     # Routa shell (DaymarkProvider + DaymarkScreen)
│   ├── components/daymark/   # Landing, onboarding, today, routine, progress, settings, editor
│   └── lib/daymark/          # Store, templates, storage, progress, insights, alarms
└── backend-lib/
```

### Development vs Production

**Development Mode** (`bun run dev`):
- Single Bun process running `server.ts`
- Vite in middleware mode transforms files on-the-fly
- API routes: `/api/*` handled by Hono
- React app: served via Vite transforms
- Client-side routing: any non-API, non-file route falls back to `index.html`

**Production Mode** (`bun run prod`):
- Builds React app to `dist/` using Vite
- Bun serves static files from `dist/` via `hono/bun` serveStatic
- API routes still handled by Hono
- SPA fallback: all non-API routes serve `dist/index.html`

NEVER use the scripts `bun run dev` or `bun run prod` from a Zo agent session. The Zo system handles running the site in the correct mode. All process management of the server is handled by Zo. Never restart or stop the server manually.

## Key Technologies

This application uses:
- **Bun** as the runtime (NOT Node.js)
- **Hono** as the web framework (NOT Express)
- **React + Vite** for the client
- **Tailwind CSS 4** for styling

Install packages with `bun add`. Typecheck with `bunx tsc --noEmit`.

## Routa product notes for agents

- Do not rebuild from scratch. Current V4 + alarm architecture is the source of truth.
- Keep the existing logo mark exactly (`DaymarkMark` in `src/lib/daymark/icons.tsx` and `public/favicon.svg`).
- Keep technical identifiers (`DaymarkProvider`, `useDaymark`, `src/lib/daymark`, `/daymark-sw.js`) unless a migration requires a new key.
- User-facing copy should say Routa, not Daymark.
- Persistence keys: `routa:v2:{profile,routine,progress,notes,settings,alarms}` with legacy `daymark:v2:*` copy-forward.
- Web reminders are in-browser notifications while the page is open. Do not fake Clock alarms.
- `scheduled` alarm status is native-only.
- The Builder template has 13 checkpoints. Do not revert to the old 9-session dashboard.

## Scripts

- `bunx tsc --noEmit` - Type check
- `bun run build` - Production Vite build

## Deployment

The site exports `{ fetch, port }` from `server.ts` for Zo's deployment system. `vercel.json` and `netlify.toml` are also present for hosting the Vite build. Do not change `zosite.json` system fields (`local_port`, `published_port`, entrypoints).
