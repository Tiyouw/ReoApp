# Reo v2 — Design Spec

**Date:** 2026-05-17
**Goal:** Transform Reo from a basic nudger into a full productivity intelligence system for JuaraVibeCoding competition.
**Deadline:** ~2 weeks (May 31, 2026)

---

## 1. Persistence Layer

**Provider:** Supabase (free tier)
**Auth:** None — single-user identified by device token in `chrome.storage.local`

### Tables

```sql
-- User settings
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT UNIQUE NOT NULL,
  persona TEXT NOT NULL DEFAULT 'jowo',
  task TEXT DEFAULT '',
  blocked_sites TEXT[] DEFAULT ARRAY['youtube.com','twitter.com','x.com','instagram.com','tiktok.com','reddit.com'],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Every nudge event
CREATE TABLE nudge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT NOT NULL,
  site_url TEXT NOT NULL,
  site_domain TEXT NOT NULL,
  persona TEXT NOT NULL,
  escalation_level INT NOT NULL DEFAULT 0,  -- 0=gentle, 1=firm, 2=savage
  ai_message TEXT NOT NULL,
  time_on_site_seconds INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Focus/Pomodoro sessions
CREATE TABLE focus_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT NOT NULL,
  task TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI daily summaries
CREATE TABLE daily_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT NOT NULL,
  summary_date DATE NOT NULL,
  total_nudges INT DEFAULT 0,
  total_focus_minutes INT DEFAULT 0,
  top_distracting_sites JSONB DEFAULT '[]',
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(device_token, summary_date)
);
```

### Device Token Strategy

- Generated on first visit to web dashboard: `crypto.randomUUID()`
- Stored in `localStorage` (web) and `chrome.storage.local` (extension)
- Passed as `x-device-token` header on all API calls
- Extension gets token from web dashboard via a "Link Extension" flow or manual paste

---

## 2. Backend API

Base: Express on Cloud Run (existing). Add Supabase JS client.

### Existing endpoints (modified)

| Method | Path | Changes |
|--------|------|---------|
| GET | `/api/reo/state` | Read from Supabase instead of memory. Requires `x-device-token`. |
| POST | `/api/reo/state` | Write to Supabase. Accepts `persona`, `task`, `blocked_sites`. |
| POST | `/api/reo/chat` | Enhanced prompt with user context (task, persona, recent nudges). |

### New endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/reo/nudge` | Log nudge event + generate AI message. Input: `{ site_url, time_on_site_seconds, escalation_level }`. Returns: `{ message, escalation_level }`. |
| GET | `/api/reo/stats` | Aggregated stats. Query: `?range=1d|7d|30d`. Returns: `{ total_nudges, total_focus_minutes, streak_days, nudges_by_day[], top_sites[] }`. |
| POST | `/api/reo/focus/start` | Create focus session. Input: `{ task }`. Returns: `{ session_id }`. |
| POST | `/api/reo/focus/end` | End focus session. Input: `{ session_id, completed }`. Returns: `{ duration_minutes }`. |
| GET | `/api/reo/summary/today` | Get or generate today's AI summary. Auto-generates if not exists and enough data. |
| POST | `/api/reo/device/register` | Register new device token. Returns settings (creates defaults if new). |

### AI Prompt Enhancements

The `/api/reo/nudge` endpoint builds a richer prompt:

```
System: You are Reo, a productivity companion.
Persona: [jowo|jaksel|professional] — [persona description]
Escalation: [gentle|firm|savage] — adjust tone accordingly.

Context:
- User's task: "[task]"
- Currently on: [site_url]
- Time wasted so far: [X] seconds
- Today's nudge count: [N]
- Today's focus time: [M] minutes

Generate a 1-2 sentence reprimand matching the persona and escalation level.
```

---

## 3. Chrome Extension Upgrades

### Progressive Nudging

```
Time on site    | Escalation | Behavior
0–30 seconds    | 0 (gentle) | Soft reminder, friendly tone
30s–2 minutes   | 1 (firm)   | Stronger warning, task mentioned
2+ minutes      | 2 (savage) | Full persona unleashed, guilt trip
```

The extension tracks elapsed time via `setInterval` (1s ticks) and triggers nudge API at each threshold.

### Site Time Tracking

- `content.tsx` starts a timer when page loads on a blocked site
- Sends time data with each nudge event
- Time resets when user navigates away

### Configurable Blocked Sites

- Default list: youtube.com, twitter.com, x.com, instagram.com, tiktok.com, reddit.com
- Users add/remove via web dashboard → saved to Supabase → extension syncs on startup and periodically (every 5 min)

### Extension Popup

Clicking the extension icon shows a mini panel:
- Current task (editable inline)
- Quick persona toggle (3 buttons)
- Today's stats: nudges / focus time
- Focus timer start/stop button
- "Open Dashboard" link

### Focus Mode Integration

When a focus session is active:
- Extension shows a subtle blue dot indicator on the mascot
- Nudges trigger immediately on any blocked site (no 30s grace period)
- More aggressive escalation curve

---

## 4. Web Dashboard Sections

### Section A: Home (existing, refined)

- Hero card with mascot, greeting, task input, persona picker
- Now includes blocked sites management (tag-style chips with add/remove)
- Save syncs to Supabase

### Section B: Stats Panel

- **Stat cards row:** Today's nudges | Focus time | Current streak (days)
- **7-day nudge chart:** Inline SVG bar chart, one bar per day
- **Top distracting sites:** Ranked list with visit counts
- All data from `/api/reo/stats?range=7d`

### Section C: Focus Timer

- Large circular timer display (25:00 default)
- Start / Pause / Reset controls
- Task label shown during session
- Session history list (today's completed sessions)
- Timer runs client-side; start/end events sent to API

### Section D: Chat with Reo

- Simple message thread UI
- User types message → POST to `/api/reo/chat` → AI response shown
- Messages stored in React state only (not persisted)
- Suggested quick messages: "Motivate me", "Roast me", "How am I doing today?"

### Section E: AI Daily Summary

- Card that shows today's AI-generated recap
- Fetched from `/api/reo/summary/today`
- Shows: nudge count, focus time, top sites, AI narrative
- If no data yet: "Start your first focus session to see your daily summary!"

### Navigation

- Simple horizontal tab bar below the header: **Home | Stats | Focus | Chat**
- Daily summary embedded in Stats section
- No routing library — just React state toggle (single-page)

---

## 5. Onboarding Flow

First-time visitors (no device token in localStorage) see a 3-step wizard:

1. **Welcome** — "Meet Reo, your productivity buddy" + mascot animation
2. **Setup** — Task input + persona picker (same as home, but in a focused card)
3. **Extension** — "Install the Chrome extension" with link to Chrome Web Store (or manual load instructions) + device token pairing

On completion:
- Device token generated and saved
- Settings saved to Supabase via `/api/reo/device/register`
- Redirects to full dashboard

---

## 6. Tech Stack Additions

| Addition | Package | Why |
|----------|---------|-----|
| Supabase client | `@supabase/supabase-js` | Database access from backend |
| Charts | Hand-rolled SVG | No dependency, full design control, competition judges appreciate no-library solutions |
| UUID generation | `crypto.randomUUID()` (built-in) | Device tokens |
| Date handling | Native `Intl.DateTimeFormat` | Following web-design-guidelines |

### No new infrastructure

- Supabase free tier handles DB (no separate DB to deploy)
- Backend stays on Cloud Run (just add SUPABASE_URL and SUPABASE_KEY env vars)
- Extension stays the same build pipeline

---

## 7. Out of Scope

- User accounts / multi-user auth
- Mobile app
- Browser history deep analysis
- Team/group features
- Push notifications beyond extension
- Data export

---

## 8. Risks

| Risk | Mitigation |
|------|-----------|
| Supabase free tier limits | Single user = negligible usage |
| Extension review time (Chrome Web Store) | Provide manual sideload instructions |
| Gemini API rate limits | Cache daily summary, debounce nudges (min 30s between API calls) |
| Scope creep | This spec is the ceiling — cut from bottom up if needed |
