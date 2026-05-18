# Reo v3 — Phase 4: Platform

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden Reo into production-grade software with observability, performance, and optional platform expansions (calendar, mobile, teams) gated by retention metrics.
**Timeline:** Week 8+ (ongoing)
**Depends on:** Phase 3 complete + healthy retention metrics (>40% 7-day retention)
**Reference:** [`2026-05-18-reo-v3-design.md`](../specs/2026-05-18-reo-v3-design.md) §4–6

---

## Summary of Changes

- Active-tab time tracking (reframed "browser history analysis" — privacy-safe)
- Google Calendar integration (auto-start focus sessions)
- Express → Hono migration (faster cold starts on Cloud Run)
- Structured logging + error tracking (observability)
- (Conditional) Mobile PWA wrapper via Capacitor
- (Conditional) Team/group accountability features

**New files:**
- `apps/backend/src/calendar.ts`
- `apps/backend/src/tab-sessions.ts`
- `apps/extension/src/tab-tracker.ts`
- `apps/web/src/tabs/TimelineTab.tsx`

---

### Task 1: Active-Tab Time Tracking

**Files:**
- Create: `apps/extension/src/tab-tracker.ts`
- Modify: `apps/extension/src/background.ts`
- Create: `apps/backend/src/tab-sessions.ts`
- Modify: `apps/backend/src/index.ts`
- Create: `apps/web/src/tabs/TimelineTab.tsx`
- Modify: `apps/web/src/App.tsx`

**Goal:** Track how long the user spends on each domain (opt-in). Replaces the "browser history deep analysis" item from the other AI's plan with a privacy-respectful alternative that only tracks *active tab duration*, not browsing history.

- [ ] **Step 1:** Create the `tab_sessions` table in Supabase (SQL from design spec §2)
- [ ] **Step 2:** Create `apps/extension/src/tab-tracker.ts`:
  ```typescript
  // Uses chrome.tabs.onActivated + chrome.tabs.onUpdated to detect active tab changes
  // Uses chrome.alarms (every 30s) to persist running session durations
  //
  // Logic:
  // 1. On tab change or URL change in active tab:
  //    - End current session (POST /api/reo/tab-session/end)
  //    - Start new session (POST /api/reo/tab-session/start)
  // 2. On chrome.idle detection (locked/idle):
  //    - End current session
  //    - Resume when user returns
  // 3. On browser close (chrome.runtime.onSuspend):
  //    - End current session
  //
  // Privacy guarantees:
  // - Only stores domain + page_title (not full URL)
  // - Does NOT access chrome.history API
  // - Opt-in only (user must enable in settings)
  // - Data stays in user's own Supabase row
  ```
- [ ] **Step 3:** Integrate in `background.ts`:
  - Check `tab_tracking_enabled` from `chrome.storage.local`
  - If enabled, initialize tab-tracker
  - If disabled, don't run any tracking listeners
- [ ] **Step 4:** Add backend endpoints in `tab-sessions.ts`:
  - `POST /api/reo/tab-session/start` — Input: `{ domain, page_title }`. Creates session row.
  - `POST /api/reo/tab-session/end` — Input: `{ session_id }`. Sets `ended_at`, calculates `duration_seconds`.
  - `GET /api/reo/tab-session/timeline?date=YYYY-MM-DD` — Returns all sessions for a date, ordered by time.
  - `GET /api/reo/tab-session/summary?range=1d|7d|30d` — Returns aggregated time per domain.
- [ ] **Step 5:** Add AI classification to tab sessions:
  - When a session ends, if duration > 60s, classify it as productive/distracting using the existing `/api/reo/classify` logic
  - Store `was_productive` boolean on the session row
- [ ] **Step 6:** Create `TimelineTab.tsx`:
  - Visual timeline for the selected day (horizontal bar chart, each segment = one tab session)
  - Color coded: green = productive, red = distracting, gray = unclassified
  - Hover/click shows: domain, page title, duration, productive/not
  - Summary cards at top: "Productive time: Xh Ym" / "Distracting time: Xh Ym" / "Untracked: Xh Ym"
  - Date picker to view previous days
- [ ] **Step 7:** Add "Timeline" to tab navigation in `App.tsx` (only shown if tab_tracking_enabled)
- [ ] **Step 8:** Add `tab_tracking_enabled BOOLEAN DEFAULT false` to settings table + Settings UI toggle
- [ ] **Step 9:** Update manifest.json permissions:
  - Add `"tabs"` to optional_permissions (requested at runtime when user enables tracking)
  - Use `chrome.permissions.request()` when user toggles on
- [ ] **Step 10:** Test: enable tracking → browse normally for 10 min → check timeline → verify accurate durations
- [ ] **Step 11:** Commit: `feat(extension+web): opt-in active-tab time tracking with timeline view`

---

### Task 2: Google Calendar Integration

**Files:**
- Create: `apps/backend/src/calendar.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/web/src/tabs/SettingsTab.tsx`
- Modify: `apps/web/src/tabs/FocusTab.tsx`

**Goal:** Connect Google Calendar and auto-start focus sessions for events tagged with `[focus]` in the title.

- [ ] **Step 1:** Enable Google Calendar API in Google Cloud Console (same project as OAuth)
- [ ] **Step 2:** Request `calendar.readonly` scope during Google OAuth login (add to auth flow from Phase 2)
- [ ] **Step 3:** Create `apps/backend/src/calendar.ts`:
  ```typescript
  // Functions:
  // - getUpcomingFocusEvents(userId, hours: 24): fetches events with [focus] in title
  // - checkForImminent Sessions(userId): checks if a [focus] event starts in <5 min
  //
  // Uses Google Calendar API with user's OAuth token stored by Supabase Auth
  ```
- [ ] **Step 4:** Add endpoints:
  - `GET /api/reo/calendar/events` — Returns upcoming [focus] events for next 24h
  - `POST /api/reo/calendar/connect` — Initiates OAuth flow with calendar scope
  - `DELETE /api/reo/calendar/disconnect` — Revokes calendar access
- [ ] **Step 5:** Add scheduled check (every 5 minutes):
  - For each user with calendar connected:
    - Check if a [focus] event starts in <5 minutes
    - If yes, send push notification: "Focus session for '[event title]' starts in 5 min"
    - Optionally auto-start the focus session on the dashboard
- [ ] **Step 6:** In `FocusTab.tsx`:
  - Show "Upcoming focus events" section if calendar is connected
  - Display next [focus] event with countdown
  - "Start now" button to begin session early
- [ ] **Step 7:** In `SettingsTab.tsx`:
  - Add "Calendar" section
  - Connect/Disconnect Google Calendar button
  - Show connected status + next sync time
  - Instructions: "Add [focus] to any calendar event title to auto-start focus sessions"
- [ ] **Step 8:** Test: create calendar event "[focus] Write documentation" → verify notification arrives 5 min before → verify it shows in FocusTab
- [ ] **Step 9:** Commit: `feat(backend+web): Google Calendar integration for auto-focus sessions`

---

### Task 3: Express → Hono Migration

**Files:**
- Modify: `apps/backend/src/index.ts` (full rewrite)
- Modify: `apps/backend/src/middleware.ts`
- Modify: `apps/backend/package.json`

**Goal:** Replace Express with Hono for ~3× faster cold starts on Cloud Run and smaller bundle size.

- [ ] **Step 1:** Install Hono: `cd apps/backend && npm install hono @hono/node-server`
- [ ] **Step 2:** Create new `index.ts` using Hono syntax:
  ```typescript
  import { Hono } from 'hono';
  import { cors } from 'hono/cors';
  import { serve } from '@hono/node-server';

  const app = new Hono();
  app.use('*', cors({ origin: '*' }));

  // Migrate each route from Express syntax to Hono syntax
  // Express: app.get('/path', (req, res) => { res.json(data) })
  // Hono:    app.get('/path', (c) => { return c.json(data) })
  ```
- [ ] **Step 3:** Migration checklist (mechanical, route-by-route):
  - [ ] `/api/reo/device/register`
  - [ ] `/api/reo/state` GET + POST
  - [ ] `/api/reo/chat` + `/api/reo/chat/history`
  - [ ] `/api/reo/nudge`
  - [ ] `/api/reo/stats`
  - [ ] `/api/reo/focus/start` + `/api/reo/focus/end`
  - [ ] `/api/reo/summary/today`
  - [ ] `/api/reo/tasks` CRUD
  - [ ] `/api/reo/auth/*`
  - [ ] `/api/reo/push/*`
  - [ ] `/api/reo/export`
  - [ ] `/api/reo/classify`
  - [ ] `/api/reo/score/today`
  - [ ] `/api/reo/recap/weekly`
  - [ ] `/api/reo/tab-session/*`
  - [ ] `/api/reo/calendar/*`
- [ ] **Step 4:** Migrate middleware:
  - `authenticateUser` → Hono middleware syntax
  - CORS → use `hono/cors`
  - Body parsing → built into Hono
- [ ] **Step 5:** Update `package.json`:
  - Remove `express` and `@types/express`
  - Add `hono` and `@hono/node-server`
  - Update start script if needed
- [ ] **Step 6:** Update Dockerfile if the entry point or build process changed
- [ ] **Step 7:** Run all existing tests → fix any that break due to the migration
- [ ] **Step 8:** Deploy to Cloud Run staging → verify all endpoints work
- [ ] **Step 9:** Measure cold start time: Express vs Hono (expect ~300ms → ~100ms)
- [ ] **Step 10:** Commit: `refactor(backend): migrate Express to Hono for faster cold starts`

---

### Task 4: Observability & Error Tracking

**Files:**
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/package.json`
- Create: `apps/backend/src/logger.ts`

**Goal:** Replace `console.log/error` with structured logging. Add request tracing and error reporting so you can debug production issues.

- [ ] **Step 1:** Install Pino: `cd apps/backend && npm install pino pino-pretty`
- [ ] **Step 2:** Create `apps/backend/src/logger.ts`:
  ```typescript
  import pino from 'pino';

  export const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV === 'production'
      ? {} // JSON format for Cloud Run (auto-parsed by Cloud Logging)
      : { transport: { target: 'pino-pretty' } } // Pretty print for dev
    ),
  });
  ```
- [ ] **Step 3:** Add request logging middleware:
  - Log: method, path, status, duration_ms, user_id/device_token (masked), request_id
  - Use `crypto.randomUUID()` as request_id, pass it through for tracing
- [ ] **Step 4:** Replace all `console.log` / `console.error` with structured logger calls:
  - `logger.info({ event: 'nudge_generated', domain, escalation_level }, 'Nudge generated')`
  - `logger.error({ event: 'gemini_error', error: err.message }, 'Gemini API call failed')`
- [ ] **Step 5:** Add error boundary middleware:
  - Catches unhandled errors
  - Logs full stack trace with request context
  - Returns appropriate 4xx/5xx response without leaking internals
- [ ] **Step 6:** Add health check endpoint `GET /health`:
  - Returns `{ status: 'ok', uptime_seconds, version }`
  - Used by Cloud Run for health checks
- [ ] **Step 7:** Add Supabase query timing logs:
  - Wrap Supabase calls to measure and log query duration
  - Alert (log.warn) if any query takes >500ms
- [ ] **Step 8:** Test: trigger various endpoints → verify structured JSON logs appear in Cloud Run Logs Explorer
- [ ] **Step 9:** Commit: `feat(backend): add structured logging with Pino + request tracing`

---

### Task 5: Mobile PWA Wrapper (Conditional)

> ⚠️ **Only execute this task if Phase 3 retention metrics show >40% 7-day retention.**

**Files:**
- Create: `apps/mobile/` directory (Capacitor project)
- Modify: `apps/web/` (PWA manifest enhancements)

**Goal:** Wrap the existing PWA in a Capacitor shell for App Store / Play Store listing. Marketed as a "stats viewer & companion chat", NOT as a nudger (impossible on mobile).

- [ ] **Step 1:** Initialize Capacitor:
  ```bash
  cd apps/web
  npm install @capacitor/core @capacitor/cli
  npx cap init "Reo" "com.reo.app" --web-dir=dist
  npx cap add android
  npx cap add ios
  ```
- [ ] **Step 2:** Configure mobile-specific behavior:
  - Hide "Extension"-related UI on mobile (detect via `window.matchMedia` or Capacitor platform detection)
  - Make focus timer the default landing tab on mobile
  - Optimize touch targets (min 48px)
  - Enable pull-to-refresh for stats
- [ ] **Step 3:** Add mobile push notifications via Capacitor Push plugin:
  - `npm install @capacitor/push-notifications`
  - Connect to the existing push infrastructure from Phase 2
- [ ] **Step 4:** App store metadata:
  - Screenshots of: Focus Timer, Stats, Chat, Timeline
  - Description: "Reo — Your AI Productivity Companion. Track focus sessions, get daily insights, and chat with your AI buddy. Companion to the Reo Chrome Extension."
  - Category: Productivity
- [ ] **Step 5:** Build and test on emulators:
  - `npx cap sync && npx cap open android`
  - Verify all tabs work, API calls succeed, push notifications arrive
- [ ] **Step 6:** Commit: `feat(mobile): add Capacitor wrapper for Android/iOS`

---

### Task 6: Team / Group Features (Conditional)

> ⚠️ **Only execute this task if:**
> - Phase 3 retention >40% AND
> - >100 weekly active users AND
> - User feedback explicitly requests team features

**Files:**
- Create: `apps/backend/src/teams.ts`
- Create: `apps/web/src/tabs/TeamTab.tsx`
- New tables: `teams`, `team_members`, `team_challenges`

**Goal:** Allow small groups (2–5 people) to do accountability challenges together.

- [ ] **Step 1:** Design team schema:
  ```sql
  CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
    created_by UUID NOT NULL REFERENCES auth.users(id),
    max_members INT DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now()
  );

  CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(team_id, user_id)
  );

  CREATE TABLE team_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    target_focus_minutes INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ```
- [ ] **Step 2:** Add team endpoints:
  - `POST /api/reo/teams` — Create team
  - `POST /api/reo/teams/join` — Join team via invite code
  - `GET /api/reo/teams/:id` — Get team info + members
  - `GET /api/reo/teams/:id/leaderboard` — Get team leaderboard (focus time, score, streak)
  - `POST /api/reo/teams/:id/challenges` — Create challenge
  - `GET /api/reo/teams/:id/challenges` — List challenges
- [ ] **Step 3:** Create `TeamTab.tsx`:
  - If not in a team: "Create team" or "Join team (enter invite code)"
  - If in a team: leaderboard view, active challenges, team chat
  - Leaderboard shows: rank, name, today's score, streak, focus time
  - Active challenge progress bar per member
- [ ] **Step 4:** Privacy controls:
  - Users opt-in to sharing their stats with the team
  - Only aggregate data shared (score, focus time, streak) — not specific sites visited
  - "Leave team" always available
- [ ] **Step 5:** Team notifications:
  - "X just completed a focus session!" (optional)
  - "Challenge ends tomorrow — you're 30 min behind!"
- [ ] **Step 6:** Test: create team → invite code → second user joins → leaderboard updates
- [ ] **Step 7:** Commit: `feat(teams): team accountability with leaderboards and challenges`

---

## Acceptance Criteria (Phase 4 Complete)

### Required (always)
- [ ] Tab time tracking shows accurate per-domain duration in timeline view
- [ ] Calendar integration auto-notifies before [focus] events
- [ ] Backend runs on Hono with <150ms cold start
- [ ] All endpoints have structured logging visible in Cloud Run Logs Explorer
- [ ] No regressions in Phase 1–3 functionality

### Conditional
- [ ] (If built) Mobile app opens and displays all tabs correctly
- [ ] (If built) Team leaderboard updates in real-time within 30s of activity

---

## Estimated Effort

| Task | Effort | Condition |
|------|--------|-----------|
| Task 1: Tab Time Tracking | 3 days | Always |
| Task 2: Calendar Integration | 2 days | Always |
| Task 3: Hono Migration | 1 day | Always |
| Task 4: Observability | 1 day | Always |
| Task 5: Mobile Wrapper | 1 week | If retention >40% |
| Task 6: Team Features | 1–2 weeks | If 100+ WAU + user demand |
| **Total (required)** | **~7 days** | |
| **Total (all)** | **~4 weeks** | |

---

## Decision Gates

Before starting conditional tasks, verify these metrics:

| Metric | Source | Required for |
|--------|--------|--------------|
| 7-day retention >40% | Supabase query: users active in last 7 days / users registered 7+ days ago | Task 5 (Mobile) |
| Weekly Active Users >100 | Supabase query: distinct user_ids with any activity in last 7 days | Task 6 (Teams) |
| User feedback mentions "team" or "friends" | Manual review of chat messages / support requests | Task 6 (Teams) |

If gates are not met, focus engineering effort on improving Phase 3 features and user acquisition instead.

---

## Post-Phase 4: What Comes Next?

If all phases complete successfully and metrics are healthy, the next frontier is:

1. **AI Memory:** Reo remembers previous conversations and adapts nudge style based on what worked (which escalation levels actually caused the user to leave the site).
2. **Plugin System:** Let power users write custom nudge triggers (e.g., "nudge me if I'm on any shopping site during weekdays before 5 PM").
3. **Marketplace:** Community-created personas and timer sounds.
4. **Enterprise Version:** Admin dashboard, team management, reporting for managers. (Only if team features prove successful first.)
5. **API for Integrations:** Let other apps trigger Reo focus sessions (Notion, Slack, VS Code extension).

These are all post-v3 considerations and should not be planned until v3 Phase 4 ships.
