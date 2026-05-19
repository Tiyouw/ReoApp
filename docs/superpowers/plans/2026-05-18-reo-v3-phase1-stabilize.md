# Reo v3 — Phase 1: Stabilize

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all bugs and logic gaps in the current v2 deployment so it actually delivers on its spec promises. Ship as v2.1.
**Timeline:** Week 1–2
**Depends on:** Reo v2 deployed and functional
**Reference:** [`2026-05-18-reo-v3-design.md`](../specs/2026-05-18-reo-v3-design.md) §3–5

---

## Summary of Changes

- Fix API URL inconsistency between extension files
- Sync blocked_sites from Supabase to extension
- Add server-side + client-side nudge debouncing
- Persist task list to Supabase (new `tasks` table)
- Persist chat messages to Supabase (new `chat_messages` table)
- Fix streak calculation bug
- Add idle detection during focus sessions
- Add daily summary refresh logic

**Files touched:**
- `apps/backend/src/index.ts`
- `apps/backend/src/supabase.ts`
- `apps/extension/src/background.ts`
- `apps/extension/src/ReoBubble.tsx`
- `apps/extension/src/content.tsx`
- `apps/web/src/tabs/HomeTab.tsx`
- `apps/web/src/tabs/ChatTab.tsx`
- `apps/web/src/tabs/StatsTab.tsx`
- `apps/web/src/api.ts`

---

### Task 1: Fix API URL Region Bug

**Files:**
- Modify: `apps/extension/src/background.ts`
- Modify: `apps/extension/src/ReoBubble.tsx`

**Problem:** `background.ts` references `us-central1` while `ReoBubble.tsx` uses `asia-southeast2`. This means the fallback chat path in background.ts is broken.

- [ ] **Step 1:** Create a shared constant file `apps/extension/src/config.ts` that exports `API_BASE_URL` pointing to the correct region (`asia-southeast2`)
- [ ] **Step 2:** Update `background.ts` to import `API_BASE_URL` from `config.ts`
- [ ] **Step 3:** Update `ReoBubble.tsx` to import `API_BASE_URL` from `config.ts`
- [ ] **Step 4:** Verify no other hardcoded URLs exist: `grep -r "run.app" apps/extension/`
- [ ] **Step 5:** Commit: `fix(extension): unify API base URL to single config constant`

---

### Task 2: Sync Blocked Sites from Supabase to Extension

**Files:**
- Modify: `apps/extension/src/background.ts`
- Modify: `apps/extension/src/ReoBubble.tsx`
- Modify: `apps/extension/src/content.tsx`

**Problem:** The extension uses a hardcoded blocked_sites array. The web dashboard lets users edit blocked sites in Supabase, but the extension never reads them.

- [ ] **Step 1:** In `background.ts`, add a function `syncBlockedSites()` that calls `GET /api/reo/state` and stores the returned `blocked_sites` array in `chrome.storage.local`
- [ ] **Step 2:** Call `syncBlockedSites()` on extension startup (in `chrome.runtime.onInstalled` and `chrome.runtime.onStartup`)
- [ ] **Step 3:** Set up `chrome.alarms` to call `syncBlockedSites()` every 5 minutes
- [ ] **Step 4:** In `content.tsx` / `ReoBubble.tsx`, read blocked sites from `chrome.storage.local` instead of using the hardcoded array
- [ ] **Step 5:** Add a fallback: if `chrome.storage.local` has no blocked_sites yet, use the hardcoded defaults
- [ ] **Step 6:** Test: change blocked_sites in dashboard → wait 5 min (or trigger manually) → extension should reflect new list
- [ ] **Step 7:** Commit: `feat(extension): sync blocked_sites from Supabase every 5 minutes`

---

### Task 3: Add Nudge Debouncing

**Files:**
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/extension/src/ReoBubble.tsx`

**Problem:** No rate limiting on `/api/reo/nudge`. A tab stuck on YouTube can trigger unlimited Gemini API calls every 30 seconds.

- [ ] **Step 1:** **Server-side:** In the `/api/reo/nudge` handler, before calling Gemini, query `nudge_events` for the most recent nudge with the same `device_token` and `site_domain`. If it was <60 seconds ago, return the previous `ai_message` with a `cached: true` flag instead of generating a new one.
- [ ] **Step 2:** **Client-side:** In `ReoBubble.tsx`, add a local timestamp variable `lastNudgeTime`. Before calling the nudge API, check if `Date.now() - lastNudgeTime < 60000`. If so, skip the call.
- [ ] **Step 3:** Test: open a blocked site, verify only 1 nudge per 60 seconds fires (not every 30s)
- [ ] **Step 4:** Commit: `fix(backend+extension): add 60s debounce to nudge calls`

---

### Task 4: Persist Task List to Supabase

**Files:**
- Modify: `apps/backend/src/index.ts` (add CRUD endpoints)
- Modify: `apps/web/src/api.ts` (add task API functions)
- Modify: `apps/web/src/tabs/HomeTab.tsx` (replace localStorage with API calls)

**Problem:** Tasks are stored only in localStorage. Clearing browser data or switching devices wipes them. Only the "active" task syncs to Supabase settings.

- [ ] **Step 1:** Create the `tasks` table in Supabase (SQL from design spec §2)
- [ ] **Step 2:** Add backend endpoints:
  - `GET /api/reo/tasks` → returns tasks ordered by `position` for the device_token
  - `POST /api/reo/tasks` → creates task `{ title }`, returns created task
  - `PATCH /api/reo/tasks/:id` → updates `{ title?, completed?, position? }`
  - `DELETE /api/reo/tasks/:id` → deletes task
- [ ] **Step 3:** Add API functions in `apps/web/src/api.ts`:
  - `getTasks(): Promise<Task[]>`
  - `createTask(title: string): Promise<Task>`
  - `updateTask(id: string, updates: Partial<Task>): Promise<Task>`
  - `deleteTask(id: string): Promise<void>`
- [ ] **Step 4:** Refactor `HomeTab.tsx`:
  - Remove all `localStorage.getItem/setItem` for tasks
  - Fetch tasks on mount with `getTasks()`
  - Create/update/delete tasks via API
  - Keep local React state for optimistic UI, sync with server
- [ ] **Step 5:** Ensure the "active task" in `settings` table still syncs (for the extension to read)
- [ ] **Step 6:** Test: add tasks → refresh page → tasks persist. Clear localStorage → tasks still there.
- [ ] **Step 7:** Commit: `feat(web+backend): persist task list to Supabase`

---

### Task 5: Persist Chat History

**Files:**
- Modify: `apps/backend/src/index.ts` (modify chat endpoint + add history endpoint)
- Modify: `apps/web/src/api.ts` (add chat history function)
- Modify: `apps/web/src/tabs/ChatTab.tsx` (load history on mount)

**Problem:** Chat messages exist only in React state. Opening a new tab = new conversation. This defeats the "AI companion" framing.

- [ ] **Step 1:** Create the `chat_messages` table in Supabase (SQL from design spec §2)
- [ ] **Step 2:** Modify `POST /api/reo/chat` handler:
  - After receiving user message, insert `{ device_token, role: 'user', content }` into `chat_messages`
  - After generating AI response, insert `{ device_token, role: 'assistant', content }` into `chat_messages`
  - Include last 10 messages as conversation context in the Gemini prompt (for continuity)
- [ ] **Step 3:** Add endpoint `GET /api/reo/chat/history?limit=50`:
  - Returns last 50 messages ordered by `created_at ASC`
- [ ] **Step 4:** Add `getChatHistory()` function in `api.ts`
- [ ] **Step 5:** In `ChatTab.tsx`:
  - On mount, call `getChatHistory()` and populate the message list
  - Show a loading state while fetching
  - New messages are appended to the persisted list
- [ ] **Step 6:** Test: send messages → close tab → reopen → messages are there
- [ ] **Step 7:** Commit: `feat(web+backend): persist chat history to Supabase`

---

### Task 6: Fix Streak Calculation

**Files:**
- Modify: `apps/web/src/tabs/StatsTab.tsx`

**Problem:** Current streak logic `if (hasFocus || i === 0) streak++` always counts the current day (index 0) even if the user has zero focus time today.

- [ ] **Step 1:** Find the streak calculation in `StatsTab.tsx`
- [ ] **Step 2:** Fix logic: only count a day toward the streak if `focus_minutes > 0` for that day. Do NOT auto-count today if there's no focus time yet.
- [ ] **Step 3:** Add edge case: if today has >0 focus but yesterday has 0, streak = 1 (today only)
- [ ] **Step 4:** Test with mock data: [30, 0, 45, 20] minutes → streak should be 1 (only today), not 4
- [ ] **Step 5:** Commit: `fix(web): correct streak calculation to require actual focus time`

---

### Task 7: Add Idle Detection During Focus Sessions

**Files:**
- Modify: `apps/web/src/tabs/FocusTab.tsx`
- Modify: `apps/extension/src/content.tsx` (optional: idle indicator)

**Problem:** The focus timer keeps running even when the user walks away. The v1 design specified idle detection but it was never implemented.

- [ ] **Step 1:** In `FocusTab.tsx`, add event listeners for `mousemove`, `keydown`, and `visibilitychange`
- [ ] **Step 2:** Track `lastActivityTime`. If `Date.now() - lastActivityTime > 5 * 60 * 1000` (5 minutes), set `isIdle = true`
- [ ] **Step 3:** When idle detected:
  - Pause the focus timer countdown
  - Show a UI indicator: "⏸️ Paused — You seem away. Timer will resume when you return."
- [ ] **Step 4:** When activity resumes (any mouse/key event):
  - Set `isIdle = false`
  - Resume the timer
  - Show brief toast: "Welcome back! Timer resumed."
- [ ] **Step 5:** Idle time should NOT count toward `focus_minutes` in the session
- [ ] **Step 6:** Test: start focus session → don't touch anything for 5 min → timer should pause
- [ ] **Step 7:** Commit: `feat(web): add idle detection to pause focus timer after 5 min inactivity`

---

### Task 8: Fix Daily Summary Staleness

**Files:**
- Modify: `apps/web/src/tabs/StatsTab.tsx`
- Modify: `apps/backend/src/index.ts`

**Problem:** Daily summary is fetched once and cached forever. No scheduled refresh even as new data comes in throughout the day.

- [ ] **Step 1:** In `GET /api/reo/summary/today` handler, add logic:
  - If an existing summary exists but was generated >2 hours ago AND new nudge/focus events exist since then, regenerate it
  - Add `generated_at TIMESTAMPTZ` column to `daily_summaries` table (or use `updated_at`)
- [ ] **Step 2:** In `StatsTab.tsx`, add a "Refresh Summary" button that re-fetches `/api/reo/summary/today?force=true`
- [ ] **Step 3:** Also auto-refresh summary when the user completes a focus session (call from FocusTab on session end)
- [ ] **Step 4:** Test: complete a focus session → summary should update within a few seconds (on manual refresh) or next auto-fetch
- [ ] **Step 5:** Commit: `fix(backend+web): add summary staleness check and refresh capability`

---

## Acceptance Criteria (Phase 1 Complete)

- [ ] Extension uses a single, correct API URL
- [ ] Blocked sites sync from Supabase to extension within 5 minutes of dashboard change
- [ ] Nudges are limited to max 1 per domain per 60 seconds
- [ ] Task list persists across page refreshes and browser data clears
- [ ] Chat history loads previous messages on new tab/session
- [ ] Streak shows correct count (only days with actual focus time)
- [ ] Focus timer pauses after 5 minutes of user inactivity
- [ ] Daily summary refreshes when new data arrives
- [ ] All existing functionality still works (no regressions)

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Task 1: Fix URL bug | 15 min |
| Task 2: Sync blocked sites | 2–3 hours |
| Task 3: Nudge debounce | 1–2 hours |
| Task 4: Persist tasks | 4–5 hours |
| Task 5: Persist chat | 3–4 hours |
| Task 6: Fix streak | 30 min |
| Task 7: Idle detection | 2–3 hours |
| Task 8: Summary refresh | 2–3 hours |
| **Total** | **~2–3 days** |
