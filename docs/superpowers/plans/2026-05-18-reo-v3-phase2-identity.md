# Reo v3 — Phase 2: Identity & Reach

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give Reo real user identity (auth), expand its reach beyond the active tab (push notifications), and add trust features (data export) + personality (mascot moods).
**Timeline:** Week 3–4
**Depends on:** Phase 1 complete (stable v2.1)
**Reference:** [`2026-05-18-reo-v3-design.md`](../specs/2026-05-18-reo-v3-design.md) §2–5

---

## Summary of Changes

- Migrate from device-token-only to Supabase Auth (email magic link + Google OAuth)
- Link existing device_tokens to authenticated user accounts
- Add Web Push notifications for streak risk, session reminders, and off-task alerts
- Add data export endpoint (JSON/CSV)
- Implement mascot mood system (4 emotional states)
- Add a Settings tab to the web dashboard

**New packages:**
- `web-push` (backend — push notification sending)
- Service worker registration (web PWA)

**New files:**
- `apps/backend/src/auth.ts`
- `apps/backend/src/push.ts`
- `apps/backend/src/export.ts`
- `apps/web/src/tabs/SettingsTab.tsx`
- `apps/web/src/components/MascotMood.tsx`
- `apps/web/public/sw.js` (service worker)

---

### Task 1: Supabase Auth Setup

**Files:**
- Create: `apps/backend/src/auth.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/src/middleware.ts`
- Modify: `apps/web/src/api.ts`
- Modify: `apps/web/src/App.tsx`

**Goal:** Enable email magic link + Google OAuth. Keep device-token as fallback for extension-first users.

- [ ] **Step 1:** Enable Auth in Supabase dashboard:
  - Enable Email (magic link) provider
  - Enable Google OAuth provider (add client ID/secret)
  - Set redirect URL to your web dashboard URL
- [ ] **Step 2:** Create `apps/backend/src/auth.ts`:
  - Export middleware `authenticateUser` that:
    - Checks for `Authorization: Bearer <jwt>` header first
    - Falls back to `x-device-token` header if no JWT
    - Attaches `req.userId` (from JWT) or `req.deviceToken` to the request
- [ ] **Step 3:** Update `apps/backend/src/middleware.ts`:
  - Replace the simple device-token middleware with the new `authenticateUser` from auth.ts
  - Ensure backward compatibility: endpoints still work with device-token only
- [ ] **Step 4:** Add auth endpoints to `index.ts`:
  - `POST /api/reo/auth/register` — calls `supabase.auth.signUp({ email, password })` or sends magic link
  - `POST /api/reo/auth/login` — calls `supabase.auth.signInWithOtp({ email })` for magic link
  - `POST /api/reo/auth/link-device` — links a device_token to the authenticated user_id
    - Updates all rows in `settings`, `nudge_events`, `focus_sessions`, `daily_summaries`, `tasks`, `chat_messages` where `device_token = X` to set `user_id = Y`
  - `GET /api/reo/auth/me` — returns current user profile
- [ ] **Step 5:** Add `user_id UUID REFERENCES auth.users(id)` column to all existing tables (nullable, for backward compat):
  ```sql
  ALTER TABLE settings ADD COLUMN user_id UUID REFERENCES auth.users(id);
  ALTER TABLE nudge_events ADD COLUMN user_id UUID REFERENCES auth.users(id);
  ALTER TABLE focus_sessions ADD COLUMN user_id UUID REFERENCES auth.users(id);
  ALTER TABLE daily_summaries ADD COLUMN user_id UUID REFERENCES auth.users(id);
  ALTER TABLE tasks ADD COLUMN user_id UUID REFERENCES auth.users(id);
  ALTER TABLE chat_messages ADD COLUMN user_id UUID REFERENCES auth.users(id);
  ```
- [ ] **Step 6:** Update query logic: if `req.userId` exists, query by `user_id`; else query by `device_token`
- [ ] **Step 7:** In `apps/web/src/api.ts`:
  - Store JWT in localStorage on login
  - Send `Authorization: Bearer <jwt>` header when JWT exists
  - Fall back to device-token header when not logged in
- [ ] **Step 8:** In `apps/web/src/App.tsx`:
  - Add auth state management (logged in / anonymous)
  - Add login/register modal component
  - Show "Sign in" button in header when anonymous
  - Show user email/avatar when logged in
- [ ] **Step 9:** Test flows:
  - New user: register → magic link → logged in → device linked
  - Existing user: has device-token → logs in → link-device → all data preserved
  - Extension user: continues using device-token until they visit dashboard and log in
- [ ] **Step 10:** Commit: `feat(auth): add Supabase Auth with magic link + Google OAuth + device linking`

---

### Task 2: Web Push Notifications

**Files:**
- Create: `apps/backend/src/push.ts`
- Create: `apps/web/public/sw.js`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/package.json`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/api.ts`

**Goal:** Send push notifications for streak risk, off-task alerts, and weekly recap availability.

- [ ] **Step 1:** Install `web-push` package: `cd apps/backend && npm install web-push`
- [ ] **Step 2:** Generate VAPID keys: `npx web-push generate-vapid-keys` → store in env vars `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`
- [ ] **Step 3:** Create the `push_subscriptions` table in Supabase (SQL from design spec §2)
- [ ] **Step 4:** Create `apps/backend/src/push.ts`:
  ```typescript
  // Functions:
  // - saveSubscription(userId, subscription)
  // - removeSubscription(userId, endpoint)
  // - sendPushToUser(userId, { title, body, icon, url })
  // - sendStreakRiskNotifications() — called by cron/scheduled
  // - sendOffTaskNotifications() — called when nudge count > threshold
  ```
- [ ] **Step 5:** Add endpoints to `index.ts`:
  - `POST /api/reo/push/subscribe` — saves push subscription (requires auth)
  - `DELETE /api/reo/push/unsubscribe` — removes subscription
  - `POST /api/reo/push/test` — sends a test notification to the user
- [ ] **Step 6:** Add push trigger in `/api/reo/nudge`:
  - After logging a nudge, check total nudges today for the user
  - If total > 10 and no push sent in last 2 hours, send "off-task" push
- [ ] **Step 7:** Create `apps/web/public/sw.js` (service worker):
  ```javascript
  self.addEventListener('push', (event) => {
    const data = event.data.json();
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/mascot.png',
      data: { url: data.url || '/' }
    });
  });
  self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(event.notification.data.url));
  });
  ```
- [ ] **Step 8:** In `apps/web/src/App.tsx` or a new `usePushNotifications` hook:
  - Register service worker on app load
  - After user logs in + completes first focus session, prompt for notification permission
  - On permission granted, subscribe and send subscription to `/api/reo/push/subscribe`
- [ ] **Step 9:** Add scheduled push triggers (can be Supabase Edge Function or Cloud Run cron):
  - **8 PM daily:** Check if user has no focus session today → send streak-risk push
  - **Monday 9 AM:** Send "weekly recap ready" push
- [ ] **Step 10:** Test: enable notifications → trigger a streak risk scenario → push should arrive
- [ ] **Step 11:** Commit: `feat(push): add Web Push notifications for streak risk and off-task alerts`

---

### Task 3: Data Export

**Files:**
- Create: `apps/backend/src/export.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/web/src/tabs/SettingsTab.tsx` (created in Task 5)

**Goal:** Let users download all their data as JSON or CSV. Builds trust + GDPR compliance.

- [ ] **Step 1:** Create `apps/backend/src/export.ts`:
  ```typescript
  // exportUserData(userId | deviceToken, format: 'json' | 'csv')
  // Gathers: settings, tasks, nudge_events, focus_sessions, daily_summaries, chat_messages
  // For JSON: returns single object with all tables as arrays
  // For CSV: returns zip with one CSV per table (or concatenated with headers)
  ```
- [ ] **Step 2:** Add endpoint `GET /api/reo/export?format=json|csv`:
  - Requires authentication (user_id) OR device_token
  - Returns appropriate Content-Type and Content-Disposition headers
  - JSON: `application/json` with `attachment; filename="reo-export-YYYY-MM-DD.json"`
  - CSV: `text/csv` with `attachment; filename="reo-export-YYYY-MM-DD.csv"`
- [ ] **Step 3:** Add rate limit: max 1 export per hour per user (simple in-memory check or DB timestamp)
- [ ] **Step 4:** Test: call endpoint → verify all user data is included in download
- [ ] **Step 5:** Commit: `feat(backend): add data export endpoint (JSON/CSV)`

---

### Task 4: Mascot Moods

**Files:**
- Create: `apps/web/src/components/MascotMood.tsx`
- Modify: `apps/web/src/tabs/HomeTab.tsx`
- Modify: `apps/web/src/tabs/StatsTab.tsx`
- Add: mascot mood images/SVGs to `apps/web/public/`

**Goal:** Reo's mascot expression changes based on the user's productivity state. Cheap implementation, huge UX impact.

- [ ] **Step 1:** Define mood states and conditions:
  ```typescript
  type MascotMood = 'happy' | 'idle' | 'disappointed' | 'angry';

  function getMood(stats: { streak: number, nudgesToday: number, focusToday: number, lastActivity: Date }): MascotMood {
    if (stats.streak >= 3 || stats.focusToday >= 60) return 'happy';
    if (stats.nudgesToday > 10 && stats.focusToday < 15) return 'angry';
    if (stats.nudgesToday > 5) return 'disappointed';
    if (Date.now() - stats.lastActivity.getTime() > 2 * 60 * 60 * 1000) return 'idle';
    return 'happy'; // default
  }
  ```
- [ ] **Step 2:** Create mascot mood assets. Options (choose one):
  - **Option A (quick):** CSS filter overlays on existing `mascot.png` (hue-rotate, brightness, add emoji overlay)
  - **Option B (better):** 4 simple SVG variations of the mascot face (can be AI-generated)
  - **Option C (best):** 4 PNG sprite variants (commission or generate via AI image tool)
- [ ] **Step 3:** Create `apps/web/src/components/MascotMood.tsx`:
  - Takes `mood` prop
  - Renders appropriate mascot variant with a subtle CSS animation (bounce for happy, shake for angry, pulse for idle)
  - Add a tooltip showing a mood-appropriate message:
    - Happy: "I'm proud of you! Keep going! 🎉"
    - Idle: "Hello? Anyone there? 😴"
    - Disappointed: "You can do better than this... 😤"
    - Angry: "SERIOUSLY?! Get back to work! 🔥"
- [ ] **Step 4:** Integrate in `HomeTab.tsx`:
  - Replace static mascot image with `<MascotMood mood={currentMood} />`
  - Compute mood from today's stats (fetched from `/api/reo/stats?range=1d`)
- [ ] **Step 5:** Add a brief mood transition animation when mood changes
- [ ] **Step 6:** Test: simulate different states → verify correct mood displays
- [ ] **Step 7:** Commit: `feat(web): add mascot mood system with 4 emotional states`

---

### Task 5: Settings Tab

**Files:**
- Create: `apps/web/src/tabs/SettingsTab.tsx`
- Modify: `apps/web/src/App.tsx` (add tab)

**Goal:** Central place for account management, notification preferences, and data export.

- [ ] **Step 1:** Create `SettingsTab.tsx` with sections:
  - **Account:** Email, sign out button, link device button (if using device-token)
  - **Notifications:** Toggle for push notifications, permission status indicator
  - **Data:** Export button (JSON/CSV selector + download trigger)
  - **Preferences:** Persona picker (move from Home or duplicate), blocked sites manager
  - **Danger Zone:** "Delete all my data" button (with confirmation modal)
- [ ] **Step 2:** Add "Settings" to the tab navigation in `App.tsx` (icon: gear/cog)
- [ ] **Step 3:** Wire up export button to call `GET /api/reo/export?format=json` and trigger browser download
- [ ] **Step 4:** Wire up push toggle:
  - If permission not granted: clicking toggle triggers `Notification.requestPermission()`
  - If granted: toggle sends subscribe/unsubscribe to API
  - Show current state clearly (Enabled ✓ / Disabled ✗ / Not supported)
- [ ] **Step 5:** Wire up "Delete all data":
  - Confirmation modal: "This will permanently delete all your tasks, chat history, focus sessions, and stats. This cannot be undone."
  - Calls a new `DELETE /api/reo/account/data` endpoint
- [ ] **Step 6:** Style consistent with existing claymorphism design system
- [ ] **Step 7:** Test all interactions
- [ ] **Step 8:** Commit: `feat(web): add Settings tab with account, notifications, and export`

---

## Acceptance Criteria (Phase 2 Complete)

- [ ] Users can register and log in via email magic link or Google OAuth
- [ ] Existing device-token users can link their data to a new account without data loss
- [ ] Extension continues to work for non-authenticated users (device-token fallback)
- [ ] Push notifications arrive for streak-risk (8 PM, no focus today) and off-task (>10 nudges)
- [ ] Users can export all their data as JSON or CSV from Settings
- [ ] Mascot mood visually reflects the user's current productivity state
- [ ] Settings tab provides centralized access to all preferences and account actions
- [ ] No regressions in Phase 1 functionality

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Task 1: Supabase Auth | 2–3 days |
| Task 2: Web Push | 1–1.5 days |
| Task 3: Data Export | 3–4 hours |
| Task 4: Mascot Moods | 1 day |
| Task 5: Settings Tab | 4–5 hours |
| **Total** | **~5–7 days** |

---

## Migration Strategy

The auth migration is the riskiest part of this phase. Here's the safe approach:

1. **Add `user_id` columns as nullable** — no schema breakage
2. **Update middleware to accept both JWT and device-token** — existing users unaffected
3. **Ship the login UI** — users opt in at their own pace
4. **On first login, run `link-device`** — backfills user_id on all existing rows
5. **Never remove device-token support from the extension** — it's the only auth path that works without user interaction

This means there is **no migration day**. Users gradually transition from anonymous to authenticated as they choose to log in.
