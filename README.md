This file provides guidance when working with code in this repository. The README.md should ALWAYS serve as an accurate, comprehensive piece of documentation for this project. It should describe the broader goals and purpose of this repository along with the technical implementation details. If any aspect of the project changes, the README.md should be updated to reflect that.

# Project Notes

Routa is a daily rhythm product for anyone who wants a structured day. It is the app homepage and is designed mobile-first.

V2 includes:
- Template-based onboarding, including a 13-checkpoint Builder rhythm
- A routine editor for times, titles, tasks, repeat days, and reminders
- Daily notes and progress against the live routine (X / 13 when Builder is used)
- Browser notifications while the app is open (not native phone Clock alarms)
- Local persistence on the current device

Existing Daymark V2 data is copied forward to Routa keys (`routa:v2:*`) without wiping the old `daymark:v2:*` keys, so returning users keep their routine, progress, notes, and reminder settings. V1 keys (`daymark-done`, `daymark-tasks`, `daymark-alarms`, `daymark-note-*`) still migrate when no V2 data exists.

The lime incomplete-circle mark is unchanged. Only the wordmark and product name changed from Daymark to Routa.

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
├── public/                # Static assets (favicon, reminder worker)
│   ├── favicon.svg
│   └── daymark-sw.js         # Reminder service worker (legacy path, kept)
├── src/
│   ├── main.tsx
│   ├── App.tsx               # Router: Routa at /, demos at /data-demo and /_design
│   ├── styles.css
│   ├── pages/daymark.tsx     # Routa shell (DaymarkProvider + DaymarkScreen)
│   ├── components/daymark/   # Landing, onboarding, today, routine, progress, settings, editor
│   └── lib/daymark/          # Store, templates, storage/migration, reminders
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

- Do not rebuild from scratch. Current V2 is the source of truth.
- Keep the existing logo mark exactly (`DaymarkMark` in `src/lib/daymark/icons.tsx` and `public/favicon.svg`).
- Keep technical identifiers (`DaymarkProvider`, `useDaymark`, `src/lib/daymark`, `/daymark-sw.js`) unless a migration requires a new key.
- User-facing copy should say Routa, not Daymark.
- Persistence keys: `routa:v2:{profile,routine,progress,notes,settings}` with legacy `daymark:v2:*` copy-forward.
- Reminders are in-browser notifications while the page is open.
- The Builder template has 13 checkpoints. Do not revert to the old 9-session dashboard.

## Scripts

- `bunx tsc --noEmit` - Type check
- `bun run build` - Production Vite build

## Deployment

The site exports `{ fetch, port }` from `server.ts` for Zo's deployment system. `vercel.json` and `netlify.toml` are also present for hosting the Vite build. Do not change `zosite.json` system fields (`local_port`, `published_port`, entrypoints).
