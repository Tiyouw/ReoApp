# Reo v3 — Ultimate Upgrade Design Spec

**Date:** 2026-05-18
**Goal:** Evolve Reo from a functional MVP into a robust, differentiated productivity intelligence platform.
**Timeline:** ~8 weeks (4 phases, each 1–2 weeks)
**Prerequisite:** Reo v2 (Supabase persistence, extension nudges, web dashboard) is deployed and working.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 1: STABILIZE                       │
│  Fix bugs, sync blocked_sites, persist tasks & chat, debounce    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                    PHASE 2: IDENTITY & REACH                     │
│  Supabase Auth, Web Push, Data Export, Mascot Moods              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                     PHASE 3: DIFFERENTIATE                       │
│  Smart Whitelisting, TTS Voice, Tab-block, Pomodoro cycle,       │
│  Productivity Score, Persona expansion, Weekly Recap             │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────┐
│                       PHASE 4: PLATFORM                          │
│  Tab-session timeline, Calendar, Hono migration, Observability,  │
│  (optional) Mobile wrapper, (optional) Team features             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. New Database Tables

Added on top of the existing v2 schema (`settings`, `nudge_events`, `focus_sessions`, `daily_summaries`).

```sql
-- Phase 1: Persist tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),  -- nullable until Phase 2
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 1: Persist chat messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_token TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),  -- nullable until Phase 2
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Phase 2: Push notification subscriptions
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Phase 4: Tab session tracking (reframed "browser history analysis")
CREATE TABLE tab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  domain TEXT NOT NULL,
  page_title TEXT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_seconds INT,
  was_productive BOOLEAN,  -- AI classification result
  task_context TEXT,       -- what user was supposed to be doing
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## 3. Backend API — New & Modified Endpoints

### Phase 1 additions

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/reo/tasks` | Get all tasks for device_token (ordered by position) |
| POST | `/api/reo/tasks` | Create task `{ title }` |
| PATCH | `/api/reo/tasks/:id` | Update task `{ title?, completed?, position? }` |
| DELETE | `/api/reo/tasks/:id` | Delete task |
| GET | `/api/reo/chat/history` | Get recent chat messages (last 50) |
| POST | `/api/reo/chat` | (modified) Now persists messages to `chat_messages` table |

### Phase 1 modifications

| Endpoint | Change |
|----------|--------|
| `POST /api/reo/nudge` | Add debounce: reject if last nudge for same domain < 60s ago |
| `GET /api/reo/state` | Include `blocked_sites` in response (for extension sync) |

### Phase 2 additions

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/reo/auth/register` | Register with email (Supabase Auth) |
| POST | `/api/reo/auth/login` | Login (magic link or OAuth) |
| POST | `/api/reo/auth/link-device` | Link existing device_token to authenticated user_id |
| POST | `/api/reo/push/subscribe` | Save push subscription |
| DELETE | `/api/reo/push/unsubscribe` | Remove push subscription |
| GET | `/api/reo/export` | Export user data as JSON or CSV (`?format=json|csv`) |

### Phase 3 additions

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/reo/classify` | AI classifies if current page is on-task. Input: `{ url, page_title, user_task }`. Returns: `{ productive: boolean, reason: string }` |
| GET | `/api/reo/score/today` | Get today's productivity score (0–100) |
| POST | `/api/reo/recap/weekly` | Trigger weekly recap generation (also callable via cron) |

### Phase 4 additions

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/reo/tab-session/start` | Record tab session start |
| POST | `/api/reo/tab-session/end` | Record tab session end with duration |
| GET | `/api/reo/tab-session/timeline` | Get timeline for date range |

---

## 4. Chrome Extension Upgrades

### Phase 1
- **Fix region URL bug:** Unify API base URL to a single env constant.
- **Sync blocked_sites:** On startup + every 5 minutes, fetch `GET /api/reo/state` and update local cache.
- **Nudge debounce client-side:** Don't fire nudge if last one was <60s ago (double protection with server).
- **Idle detection:** Use `document.hidden` + mouse/keyboard activity. If idle >5 min during focus session, pause timer and notify user on return.

### Phase 2
- **Auth-aware:** If user is logged in (has JWT in storage), send `Authorization: Bearer <token>` header instead of device-token.
- **Push subscription:** Register service worker for push notifications on extension install.

### Phase 3
- **Smart whitelist call:** Before showing nudge, call `/api/reo/classify` to check if the page is actually off-task. Cache results per (domain, task) for 24h locally.
- **TTS voice nudges:** Pipe AI nudge text to `window.speechSynthesis` with persona-appropriate voice settings.
- **Tab-blocking interstitial:** During active focus sessions, optionally block navigation to blocked sites with a full-page "Reo says no" overlay (user setting, default off).

### Phase 4
- **Tab session tracking via `chrome.alarms`:** Use alarms API (persists across tab switches) to track active tab duration. Send `tab-session/start` and `tab-session/end` events.

---

## 5. Web Dashboard Upgrades

### Phase 1
- **HomeTab:** Task list reads/writes from Supabase instead of localStorage.
- **ChatTab:** Load history on mount from `/api/reo/chat/history`. Persist new messages.
- **StatsTab:** Fix streak calculation. Add auto-refresh for daily summary.

### Phase 2
- **Auth UI:** Add login/register modal (email magic link + Google OAuth button). Show user avatar when logged in.
- **Settings tab (new):** Notification preferences, data export button, account management.
- **Mascot moods:** Reo mascot expression changes based on productivity state:
  - 😊 Happy: streak ≥3 days or just completed focus session
  - 😐 Idle: no activity for 2+ hours
  - 😤 Disappointed: >5 nudges today
  - 🔥 Angry: >10 nudges today and <15 min focus

### Phase 3
- **FocusTab:** Pomodoro break cycle UI (work → break → work, configurable intervals).
- **StatsTab:** Add daily productivity score display (0–100 with color indicator).
- **StatsTab:** Badge/achievement section.
- **ChatTab:** "Roast Mode" intensity slider.
- **Settings:** Persona expansion options (Sundanese, Batak, Corporate Buzzword).

### Phase 4
- **New "Timeline" tab:** Visual timeline of tab sessions for the day. Color-coded productive vs. distracting.
- **Calendar integration setup:** Connect Google Calendar, map `[focus]`-tagged events to auto-start sessions.

---

## 6. AI Prompt Enhancements

### Smart Whitelisting Prompt (Phase 3)

```
System: You are a productivity classifier. Determine if the user's current browsing is related to their stated task.

User's current task: "[task]"
Current URL: "[url]"
Page title: "[page_title]"

Respond with JSON only:
{ "productive": true/false, "reason": "one sentence explanation" }

Examples:
- Task "learn React", on youtube.com/watch?v=react-tutorial → productive
- Task "learn React", on youtube.com/watch?v=funny-cats → not productive
- Task "write report", on docs.google.com → productive
- Task "write report", on reddit.com/r/memes → not productive
```

### Productivity Score Formula (Phase 3)

```
score = (
  (focus_minutes / target_minutes) * 40 +      -- 40% weight: focus time
  (1 - nudges_today / max_nudges) * 30 +       -- 30% weight: fewer nudges = better
  (streak_bonus) * 15 +                         -- 15% weight: streak days
  (tasks_completed / tasks_total) * 15          -- 15% weight: task completion
) clamped to 0–100

Where:
  target_minutes = 120 (configurable)
  max_nudges = 20 (after 20, score contribution floors at 0)
  streak_bonus = min(streak_days / 7, 1.0)
```

### Weekly Recap Prompt (Phase 3)

```
System: You are Reo, the user's productivity companion. Write a brief, encouraging weekly recap.
Persona: [persona]

This week's data:
- Total focus time: [X] minutes across [Y] sessions
- Total nudges received: [N]
- Streak: [S] days
- Most distracting sites: [site1] ([count1]), [site2] ([count2])
- Best day: [day] with [minutes] min focus
- Productivity score average: [score]/100
- Tasks completed: [completed]/[total]

Write a 3-4 sentence recap that:
1. Celebrates a win from this week
2. Calls out one area to improve
3. Sets an encouraging tone for next week
Keep it under 100 words. Match the persona tone.
```

---

## 7. Push Notification Triggers (Phase 2)

| Trigger | Condition | Message |
|---------|-----------|---------|
| Streak at risk | 8 PM and no focus session today | "Your [N]-day streak is at risk! Quick 10-min session?" |
| Focus session reminder | Scheduled session in 5 min (if calendar integrated) | "Focus session starting in 5 minutes. Ready?" |
| Off-task too long | User on blocked sites >10 min total today, not in focus mode | "You've spent [X] min on distractions today. Want to start a focus session?" |
| Weekly recap ready | Monday 9 AM | "Your weekly recap is ready! Check your stats." |

---

## 8. Tech Stack Changes

| Addition | Package / Service | Phase | Why |
|----------|-------------------|-------|-----|
| Supabase Auth | `@supabase/supabase-js` (existing) | 2 | Multi-device identity |
| Web Push | `web-push` (npm) | 2 | Server-side push sending |
| Service Worker | Vanilla JS | 2 | Push receiver in PWA |
| Speech Synthesis | `window.speechSynthesis` (built-in) | 3 | TTS voice nudges |
| Resend (email) | `resend` (npm) | 3 | Weekly recap emails |
| Hono | `hono` (npm) | 4 | Replace Express for faster cold starts |
| Pino | `pino` (npm) | 4 | Structured logging |

---

## 9. Success Metrics

| Metric | Target | Measured by |
|--------|--------|-------------|
| Bug-free sync | 0 reports of lost tasks/chat | Phase 1 QA |
| Auth adoption | >50% of active users link an account | Phase 2 analytics |
| Push opt-in | >30% of authenticated users | Phase 2 analytics |
| Smart whitelist accuracy | >85% correct classification | Phase 3 user feedback |
| Daily active usage | User opens dashboard or triggers nudge 5+ days/week | Phase 3+ |
| Retention (7-day) | >40% of new users return after 7 days | Phase 3+ |

---

## 10. Out of Scope (for all 4 phases)

- Native mobile app with nudge capabilities (platform sandboxing makes this impossible)
- Team/group features (defer until solo retention is proven)
- Monetization / payment integration
- Third-party integrations beyond Google Calendar
- Custom AI model training (Gemini API is sufficient)

---

## 11. Risk Register

| Risk | Phase | Mitigation |
|------|-------|-----------|
| Auth migration breaks existing device-token users | 2 | Keep device-token as fallback; link to user_id on first login |
| Smart whitelist Gemini calls add latency to nudges | 3 | Cache classification per (domain, task) for 24h; classify async, show nudge optimistically |
| TTS browser support varies | 3 | Feature-detect `speechSynthesis`; graceful fallback to text-only |
| Push notification permission denied by users | 2 | Request permission contextually (after first focus session), not on page load |
| Chrome Web Store rejects broader permissions | 3–4 | Use optional permissions (`chrome.alarms`, `activeTab`) requested at runtime |
| Scope creep within phases | All | Each phase plan has explicit task lists; cut from bottom up |

---

## 12. File References

- **Validation memo:** [`2026-05-18-reo-v3-validation.md`](./2026-05-18-reo-v3-validation.md)
- **Phase 1 Plan:** [`../plans/2026-05-18-reo-v3-phase1-stabilize.md`](../plans/2026-05-18-reo-v3-phase1-stabilize.md)
- **Phase 2 Plan:** [`../plans/2026-05-18-reo-v3-phase2-identity.md`](../plans/2026-05-18-reo-v3-phase2-identity.md)
- **Phase 3 Plan:** [`../plans/2026-05-18-reo-v3-phase3-differentiate.md`](../plans/2026-05-18-reo-v3-phase3-differentiate.md)
- **Phase 4 Plan:** [`../plans/2026-05-18-reo-v3-phase4-platform.md`](../plans/2026-05-18-reo-v3-phase4-platform.md)
