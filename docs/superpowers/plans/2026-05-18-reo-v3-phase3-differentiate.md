# Reo v3 — Phase 3: Differentiate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build features no other productivity tool has — AI-powered smart whitelisting, voice nudges, adaptive Pomodoro, and a gamified productivity score. This is what makes Reo *Reo*, not just another timer.
**Timeline:** Week 5–7
**Depends on:** Phase 2 complete (auth + push working)
**Reference:** [`2026-05-18-reo-v3-design.md`](../specs/2026-05-18-reo-v3-design.md) §4–6

---

## Summary of Changes

- AI-powered smart whitelisting (classify pages as on-task vs off-task)
- TTS voice nudges with persona-appropriate voice settings
- Tab-blocking interstitial during focus sessions
- Pomodoro break cycle (work/break loop with configurable intervals)
- Daily productivity score (0–100) with visual display
- Persona expansion (new language personas)
- Weekly email recap via scheduled function

**New files:**
- `apps/backend/src/classify.ts`
- `apps/backend/src/score.ts`
- `apps/backend/src/recap.ts`
- `apps/extension/src/voice.ts`
- `apps/extension/src/blocker.tsx`
- `apps/web/src/components/ProductivityScore.tsx`
- `apps/web/src/components/PomodoroTimer.tsx`

---

### Task 1: AI-Powered Smart Whitelisting

**Files:**
- Create: `apps/backend/src/classify.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/extension/src/ReoBubble.tsx`
- Modify: `apps/extension/src/background.ts`

**Goal:** Before showing a nudge, ask Gemini if the current page is actually relevant to the user's task. YouTube watching a React tutorial while your task is "learn React" → no nudge. YouTube watching cat videos → nudge.

- [ ] **Step 1:** Create `apps/backend/src/classify.ts`:
  ```typescript
  interface ClassifyRequest {
    url: string;
    page_title: string;
    user_task: string;
  }

  interface ClassifyResponse {
    productive: boolean;
    reason: string;
    confidence: number; // 0-1
  }

  // Uses Gemini with the smart whitelisting prompt from design spec §6
  // Returns cached result if same (domain, task) was classified in last 24h
  ```
- [ ] **Step 2:** Add classification cache table:
  ```sql
  CREATE TABLE classification_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL,
    user_task TEXT NOT NULL,
    page_title TEXT,
    productive BOOLEAN NOT NULL,
    reason TEXT,
    confidence FLOAT,
    created_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
    UNIQUE(domain, user_task)
  );
  ```
- [ ] **Step 3:** Add endpoint `POST /api/reo/classify`:
  - Input: `{ url, page_title, user_task }`
  - Check cache first (by domain + user_task)
  - If cache hit and not expired → return cached result
  - If cache miss → call Gemini → store in cache → return result
  - Response: `{ productive: boolean, reason: string, confidence: number }`
- [ ] **Step 4:** Modify extension nudge flow in `ReoBubble.tsx`:
  - Before calling `/api/reo/nudge`, call `/api/reo/classify` first
  - If `productive === true` and `confidence > 0.7` → suppress the nudge entirely
  - If `productive === false` or `confidence < 0.7` → proceed with nudge as normal
  - Store classification result in `chrome.storage.local` for the session (avoid repeated calls)
- [ ] **Step 5:** Add visual indicator when a site is classified as productive:
  - Small green check on the Reo bubble: "✓ On-task"
  - Versus the usual orange/red nudge state
- [ ] **Step 6:** Add a "This is wrong" button on nudges:
  - If user clicks it, invalidate the cache entry for this domain+task
  - Feedback stored for future prompt improvement
- [ ] **Step 7:** Test scenarios:
  - Task "learn React" + youtube.com/react-tutorial → no nudge
  - Task "learn React" + youtube.com/funny-cats → nudge
  - Task "write report" + docs.google.com → no nudge
  - Task "write report" + reddit.com → nudge
- [ ] **Step 8:** Commit: `feat(ai): smart whitelisting — AI classifies pages as on-task before nudging`

---

### Task 2: TTS Voice Nudges

**Files:**
- Create: `apps/extension/src/voice.ts`
- Modify: `apps/extension/src/ReoBubble.tsx`
- Modify: `apps/web/src/tabs/SettingsTab.tsx` (add voice toggle)

**Goal:** When a nudge fires, optionally speak it aloud using the Web Speech Synthesis API. Extremely memorable for demos, low implementation cost.

- [ ] **Step 1:** Create `apps/extension/src/voice.ts`:
  ```typescript
  interface VoiceConfig {
    enabled: boolean;
    volume: number;      // 0-1
    rate: number;        // 0.5-2
    pitch: number;       // 0-2
    voiceName?: string;  // specific voice to use
  }

  const PERSONA_VOICE_MAP = {
    jowo: { rate: 0.9, pitch: 1.1 },      // slightly slower, higher pitch (friendly)
    jaksel: { rate: 1.2, pitch: 1.0 },    // faster (energetic)
    professional: { rate: 1.0, pitch: 0.9 }, // measured, lower pitch
    sundanese: { rate: 0.9, pitch: 1.1 },
    batak: { rate: 1.1, pitch: 0.8 },     // louder feeling, lower pitch
    corporate: { rate: 1.0, pitch: 0.9 },
  };

  function speakNudge(message: string, persona: string): void {
    if (!('speechSynthesis' in window)) return;
    if (!voiceConfig.enabled) return;

    const utterance = new SpeechSynthesisUtterance(message);
    const config = PERSONA_VOICE_MAP[persona] || PERSONA_VOICE_MAP.professional;
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = voiceConfig.volume;

    // Try to find an Indonesian voice if persona is Indonesian
    const voices = speechSynthesis.getVoices();
    const idVoice = voices.find(v => v.lang.startsWith('id'));
    if (idVoice && ['jowo', 'jaksel', 'sundanese', 'batak'].includes(persona)) {
      utterance.voice = idVoice;
    }

    speechSynthesis.speak(utterance);
  }
  ```
- [ ] **Step 2:** In `ReoBubble.tsx`, after receiving nudge message:
  - Call `speakNudge(message, currentPersona)` if voice is enabled
  - Add a small speaker icon on the bubble that toggles voice on/off
- [ ] **Step 3:** Store voice preference in `chrome.storage.local`:
  - `voice_enabled: boolean` (default: false — opt-in)
  - `voice_volume: number` (default: 0.7)
- [ ] **Step 4:** In `SettingsTab.tsx`, add a "Voice Nudges" section:
  - Toggle: Enable/Disable
  - Volume slider
  - "Test Voice" button that speaks a sample nudge
- [ ] **Step 5:** Feature detection: if `speechSynthesis` not available, hide the option entirely
- [ ] **Step 6:** Test: enable voice → visit blocked site → hear the nudge spoken aloud
- [ ] **Step 7:** Commit: `feat(extension): TTS voice nudges with persona-appropriate voice settings`

---

### Task 3: Tab-Blocking Interstitial

**Files:**
- Create: `apps/extension/src/blocker.tsx`
- Modify: `apps/extension/src/content.tsx`
- Modify: `apps/extension/src/ReoBubble.tsx`

**Goal:** During active focus sessions, optionally replace blocked site content with a full-page "Reo says no" interstitial instead of just showing a bubble nudge.

- [ ] **Step 1:** Create `apps/extension/src/blocker.tsx`:
  ```tsx
  // Full-page overlay component:
  // - Covers entire viewport with semi-transparent backdrop
  // - Centered card with:
  //   - Angry Reo mascot (large)
  //   - Message: "You're in a focus session! Get back to: [task]"
  //   - Countdown: "This page will close in [10]s" (auto-redirect)
  //   - "I need this for my task" button (dismisses + marks as productive)
  //   - "Take me back" button (navigates to previous page or new tab)
  // - Cannot be easily dismissed (no clicking outside)
  ```
- [ ] **Step 2:** In `content.tsx`, check focus session state:
  - Read `focus_active` from `chrome.storage.local`
  - Read `block_mode_enabled` from `chrome.storage.local` (user preference)
  - If both true AND current site is in blocked_sites → render blocker instead of bubble
- [ ] **Step 3:** Add auto-redirect logic:
  - 10-second countdown
  - On countdown complete → `window.history.back()` or `window.location = 'chrome://newtab'`
  - If user clicks "I need this" → dismiss blocker, add domain to temporary whitelist for this session
- [ ] **Step 4:** Make this opt-in:
  - Default: OFF (nudge-only behavior, as current)
  - User enables in Settings: "Block distracting sites during focus" toggle
  - Store preference in `chrome.storage.local` and sync from Supabase settings
- [ ] **Step 5:** Style the blocker to match Reo's claymorphism design (rounded corners, soft shadows, gradient background)
- [ ] **Step 6:** Test: start focus session → enable blocking → visit blocked site → full interstitial appears → auto-redirects after 10s
- [ ] **Step 7:** Commit: `feat(extension): optional tab-blocking interstitial during focus sessions`

---

### Task 4: Pomodoro Break Cycle

**Files:**
- Create: `apps/web/src/components/PomodoroTimer.tsx`
- Modify: `apps/web/src/tabs/FocusTab.tsx`
- Modify: `apps/web/src/api.ts`

**Goal:** Replace the single-shot focus timer with a proper Pomodoro cycle: work → break → work → break → long break.

- [ ] **Step 1:** Define Pomodoro presets:
  ```typescript
  interface PomodoroPreset {
    name: string;
    workMinutes: number;
    breakMinutes: number;
    longBreakMinutes: number;
    roundsBeforeLongBreak: number;
  }

  const PRESETS: PomodoroPreset[] = [
    { name: 'Classic', workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, roundsBeforeLongBreak: 4 },
    { name: 'Deep Work', workMinutes: 50, breakMinutes: 10, longBreakMinutes: 30, roundsBeforeLongBreak: 2 },
    { name: 'Sprint', workMinutes: 15, breakMinutes: 3, longBreakMinutes: 10, roundsBeforeLongBreak: 4 },
    { name: 'Custom', workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, roundsBeforeLongBreak: 4 },
  ];
  ```
- [ ] **Step 2:** Create `PomodoroTimer.tsx` component:
  - Circular progress indicator showing time remaining
  - Phase indicator: "Work 1/4" → "Break" → "Work 2/4" → "Break" → ... → "Long Break"
  - Color changes: blue during work, green during break, purple during long break
  - Audio chime on phase transitions (subtle, optional)
  - Skip button to jump to next phase
- [ ] **Step 3:** Refactor `FocusTab.tsx`:
  - Replace existing single timer with `PomodoroTimer`
  - Add preset selector (dropdown or button group)
  - Add custom interval inputs (shown when "Custom" preset selected)
  - Keep session history list below the timer
- [ ] **Step 4:** Backend integration:
  - `POST /api/reo/focus/start` now includes `{ task, work_minutes, break_minutes }`
  - `POST /api/reo/focus/end` now includes `{ completed_rounds }` (how many work phases completed)
  - Individual work phases count toward `focus_minutes` in stats
  - Break phases do NOT count toward focus time
- [ ] **Step 5:** Sync focus state to extension:
  - When work phase starts → set `focus_active = true` in `chrome.storage.local`
  - When break phase starts → set `focus_active = false` (no nudges during breaks)
  - When session ends → set `focus_active = false`
- [ ] **Step 6:** Push notification on break end:
  - If user enabled push + is in a break → send "Break's over! Ready for round [N]?" push
- [ ] **Step 7:** Test: start Classic Pomodoro → complete 4 rounds → verify long break triggers → verify stats show correct focus minutes
- [ ] **Step 8:** Commit: `feat(web): Pomodoro break cycle with presets and phase tracking`

---

### Task 5: Daily Productivity Score

**Files:**
- Create: `apps/backend/src/score.ts`
- Create: `apps/web/src/components/ProductivityScore.tsx`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/web/src/tabs/StatsTab.tsx`

**Goal:** A single 0–100 number that tells the user "how productive was I today?" with visual flair.

- [ ] **Step 1:** Create `apps/backend/src/score.ts`:
  ```typescript
  interface ScoreInput {
    focusMinutes: number;
    targetMinutes: number;     // default 120, user-configurable
    nudgesToday: number;
    maxNudges: number;         // 20 (score floors at 0 after this)
    streakDays: number;
    tasksCompleted: number;
    tasksTotal: number;
  }

  function calculateScore(input: ScoreInput): number {
    const focusScore = Math.min(input.focusMinutes / input.targetMinutes, 1) * 40;
    const nudgeScore = Math.max(1 - (input.nudgesToday / input.maxNudges), 0) * 30;
    const streakScore = Math.min(input.streakDays / 7, 1) * 15;
    const taskScore = input.tasksTotal > 0
      ? (input.tasksCompleted / input.tasksTotal) * 15
      : 7.5; // neutral if no tasks set
    return Math.round(Math.min(Math.max(focusScore + nudgeScore + streakScore + taskScore, 0), 100));
  }
  ```
- [ ] **Step 2:** Add endpoint `GET /api/reo/score/today`:
  - Gathers today's data from existing tables
  - Calculates and returns `{ score, breakdown: { focus, nudges, streak, tasks }, grade }`
  - Grade mapping: 90+ = "S", 80+ = "A", 70+ = "B", 60+ = "C", below = "D"
- [ ] **Step 3:** Create `ProductivityScore.tsx` component:
  - Large circular gauge (SVG) with animated fill based on score
  - Color gradient: red (0-30) → orange (30-60) → green (60-80) → gold (80-100)
  - Score number displayed prominently in center
  - Grade badge (S/A/B/C/D) with distinct styling
  - Breakdown tooltip or expandable section showing the 4 component scores
- [ ] **Step 4:** Integrate in `StatsTab.tsx`:
  - Add ProductivityScore at the top of the stats view
  - Fetches from `/api/reo/score/today` on mount
  - Auto-refreshes every 5 minutes while tab is visible
- [ ] **Step 5:** Add score to daily summary prompt (so AI can reference it in the narrative)
- [ ] **Step 6:** Test: simulate different scenarios → verify score matches expected calculation
- [ ] **Step 7:** Commit: `feat(stats): daily productivity score (0-100) with visual gauge`

---

### Task 6: Persona Expansion

**Files:**
- Modify: `apps/backend/src/index.ts` (nudge prompt)
- Modify: `apps/web/src/tabs/HomeTab.tsx` (persona picker)
- Modify: `apps/extension/src/ReoBubble.tsx` (persona display)

**Goal:** Add new language-based personas beyond the existing Jowo/Jaksel/Professional.

- [ ] **Step 1:** Define new personas:
  ```typescript
  const PERSONAS = {
    jowo: {
      name: 'Jowo',
      description: 'Gentle Javanese elder who guilt-trips you with kindness',
      language: 'Mix of Javanese and Indonesian',
      example: 'Mas/Mbak, kok malah buka YouTube... tugasnya gimana?'
    },
    jaksel: {
      name: 'Jaksel',
      description: 'South Jakarta Gen-Z who roasts you with slang',
      language: 'Indonesian with heavy English mixing',
      example: 'Literally kamu tuh lagi focus session tapi malah scrolling? Which is...'
    },
    professional: {
      name: 'Professional',
      description: 'Corporate coach with polished language',
      language: 'Formal English',
      example: 'I notice you\'ve deviated from your focus objective. Shall we refocus?'
    },
    sundanese: {
      name: 'Urang Sunda',
      description: 'Warm Sundanese friend who teases with humor',
      language: 'Mix of Sundanese and Indonesian',
      example: 'Euy, eta naon atuh buka Reddit? Tugas teh can beres lain?'
    },
    batak: {
      name: 'Lae Batak',
      description: 'Direct and loud Batak uncle who tells it straight',
      language: 'Indonesian with Batak expressions',
      example: 'BAAAH! Buka YouTube lagi?! Kerjamu itu yang mana, Lae?!'
    },
    corporate: {
      name: 'Corporate Buzzword',
      description: 'Annoying middle manager who speaks only in corporate jargon',
      language: 'English corporate speak',
      example: 'Let\'s circle back on your OKRs. This Reddit synergy isn\'t aligned with our North Star metric.'
    },
  };
  ```
- [ ] **Step 2:** Update persona picker UI in HomeTab:
  - Expand from 3 buttons to a 2×3 grid (or scrollable row)
  - Each persona card shows: name, short description, example nudge
  - New personas marked with "NEW" badge
- [ ] **Step 3:** Update backend nudge prompt to include the new persona descriptions and language guidelines
- [ ] **Step 4:** Update `settings` table: ensure persona field accepts new values (TEXT type already handles this)
- [ ] **Step 5:** Test: select each new persona → trigger nudge → verify AI response matches persona tone
- [ ] **Step 6:** Commit: `feat(personas): add Sundanese, Batak, and Corporate Buzzword personas`

---

### Task 7: Weekly Email Recap

**Files:**
- Create: `apps/backend/src/recap.ts`
- Modify: `apps/backend/src/index.ts`
- Modify: `apps/backend/package.json`

**Goal:** Every Monday, authenticated users receive an email summary of their week. Compounds existing daily summary data.

- [ ] **Step 1:** Install Resend: `cd apps/backend && npm install resend`
- [ ] **Step 2:** Create `apps/backend/src/recap.ts`:
  ```typescript
  // generateWeeklyRecap(userId):
  //   1. Gather last 7 days of: nudge_events, focus_sessions, daily_summaries, tasks
  //   2. Calculate: total focus minutes, total nudges, streak, best day, worst day, avg score
  //   3. Call Gemini with weekly recap prompt (design spec §6)
  //   4. Format into HTML email template
  //   5. Send via Resend

  // triggerWeeklyRecaps():
  //   1. Get all users with email who opted in to weekly recaps
  //   2. For each user, call generateWeeklyRecap
  //   3. Log results
  ```
- [ ] **Step 3:** Add endpoint `POST /api/reo/recap/weekly`:
  - Can be called manually (for testing) or by a cron trigger
  - Optional `?user_id=X` for single user, otherwise processes all opted-in users
- [ ] **Step 4:** Create HTML email template:
  - Branded with Reo mascot header
  - Stats at a glance: focus time, nudges, streak, score avg
  - AI-written narrative paragraph (from Gemini)
  - "View full stats" CTA button linking to dashboard
  - Unsubscribe link in footer
- [ ] **Step 5:** Add `weekly_recap_enabled BOOLEAN DEFAULT true` to settings table
- [ ] **Step 6:** Add recap preference toggle in SettingsTab
- [ ] **Step 7:** Set up Cloud Run cron job or Supabase Edge Function to call the endpoint every Monday at 9 AM
- [ ] **Step 8:** Test: trigger manually → verify email arrives with correct data
- [ ] **Step 9:** Commit: `feat(backend): weekly email recap via Resend + Gemini narrative`

---

## Acceptance Criteria (Phase 3 Complete)

- [ ] Smart whitelisting correctly classifies productive vs. distracting pages with >80% accuracy
- [ ] Nudges are suppressed when AI classifies the page as on-task
- [ ] Voice nudges speak in persona-appropriate tone when enabled
- [ ] Tab-blocking interstitial appears during focus sessions (when opted in)
- [ ] Pomodoro timer cycles through work/break phases correctly
- [ ] Productivity score displays and updates throughout the day
- [ ] New personas (Sundanese, Batak, Corporate) generate appropriate nudges
- [ ] Weekly email recap arrives on Monday with accurate stats
- [ ] All Phase 1 and Phase 2 functionality still works

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Task 1: Smart Whitelisting | 2–3 days |
| Task 2: TTS Voice Nudges | 1 day |
| Task 3: Tab-Blocking Interstitial | 1 day |
| Task 4: Pomodoro Break Cycle | 1–1.5 days |
| Task 5: Productivity Score | 1–1.5 days |
| Task 6: Persona Expansion | 4–5 hours |
| Task 7: Weekly Email Recap | 1 day |
| **Total** | **~8–10 days** |

---

## Key Technical Decisions

1. **Smart whitelisting is async but optimistic:** The extension shows the nudge bubble immediately (as before), but then fires the classify call. If classification returns `productive: true`, the nudge auto-dismisses with a "✓ Never mind, you're on-task!" message. This avoids latency-blocking the UX.

2. **Voice is opt-in, never opt-out:** Users must explicitly enable voice nudges. This avoids startling users and potential workplace embarrassment.

3. **Tab-blocking has an escape hatch:** The "I need this for my task" button ensures users are never truly locked out. It just adds friction, which is the goal.

4. **Score formula is transparent:** Users can see exactly how their score is calculated (breakdown view). No black box.

5. **Classification cache is domain-level, not URL-level:** This prevents excessive Gemini calls while still being useful. `youtube.com` + task "learn React" = one classification, regardless of the specific video URL. Users can override with the "This is wrong" button.
