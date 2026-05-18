# Reo v3 — Validation of the "Future Plan" Roadmap

**Date:** 2026-05-18
**Status:** Validation memo — read before executing v3 plans
**Source plan reviewed:** "Out of Scope" section of [`2026-05-17-reo-v2-design.md`](./2026-05-17-reo-v2-design.md) §7

---

## 1. Purpose

A second AI surfaced a 6-item future-scope list copied from the v2 spec's "Out of Scope" section
and proposed it as the roadmap for the next upgrade. This document validates whether each item is
(a) a good idea right now, (b) technically feasible against the actual code, and (c) correctly
prioritized.

The conclusion drives [`2026-05-18-reo-v3-design.md`](./2026-05-18-reo-v3-design.md) and the four
phase plans under `docs/superpowers/plans/`.

---

## 2. Per-Item Verdict

| # | Item | Feasible? | Worth doing now? | Verdict |
|---|------|-----------|------------------|---------|
| 1 | **Mobile App** | Yes (Capacitor / Expo wrapper of the PWA). | The product's real value lives in the **Chrome Extension** (browser-side intervention). Native mobile apps cannot inject nudges into Safari/Chrome on iOS/Android due to platform sandboxing. A mobile build would ship a stats viewer, not a companion. | **Defer.** If revisited in Phase 4, scope it as a Capacitor PWA wrapper marketed as a viewer, not as nudges. |
| 2 | **User Accounts / Multi-user Auth** | Yes — Supabase Auth is one config away. | Device-token model breaks the moment a user uses 2 browsers, reinstalls Chrome, or wants stats on their phone. It's also the prerequisite for items 4, 5, and 6. | **Do early (Phase 2).** |
| 3 | **Browser History Deep Analysis** | Yes via `chrome.history` API. | Privacy minefield (Chrome Web Store reviewers flag broad history reads), and the user value is unclear vs. the privacy cost. The same product outcome can be achieved by per-tab time tracking with `chrome.alarms`, which keeps data local to the tab session. | **Reframe, don't copy.** Replace with opt-in active-tab time tracking (Phase 4). |
| 4 | **Team / Group Features** | Yes after auth exists. | Solo-productivity tools that pivot to "team accountability" usually fail PMF. Validate single-user retention first. | **Defer 6+ months.** |
| 5 | **Push Notifications** | Yes — Web Push API + service worker on the existing PWA. | The extension only nudges when the user is *on* a distracting site. Push lets Reo nudge when the user has *left* a focus session, when a streak is at risk, or for scheduled session reminders. High value, low cost. | **Do (Phase 2).** |
| 6 | **Data Export** | Trivial (~1 day, Supabase → CSV/JSON). | Low impact but builds trust ("my data is mine") and improves GDPR posture. | **Do (Phase 2, small).** |

---

## 3. What the Other Plan Got Right

- The 6 items are real items deferred from the v2 spec.
- Auth, push notifications, and data export are correctly identified as future scope.

## 4. What the Other Plan Got Wrong

1. **No prioritization.** Listing items is not a plan; phase ordering matters because items 4–6 depend on item 2 (auth).
2. **No validation against the codebase.** Several real bugs and half-built features in the current v2 code are higher-leverage than any item on the list.
3. **No effort estimates or sequencing.** A roadmap without effort sizing cannot be executed.
4. **Mobile App and Team Features are premature.** They consume weeks of effort before retention data exists.
5. **Browser History Deep Analysis is the wrong shape.** The privacy risk is high and the user value can be delivered via tab-session tracking with much less data exposure.

---

## 5. Real Gaps Found in the Current Code

These are not on the other AI's list but should rank above most of it.

### Bugs (must-fix)
1. `apps/extension/src/background.ts` references `us-central1.run.app`, but `apps/extension/src/ReoBubble.tsx` uses `asia-southeast2`. The fallback chat path is broken.
2. The extension ignores the user's `blocked_sites` from Supabase. `ReoBubble.tsx` uses a hardcoded default. The web dashboard's "configurable blocked sites" feature is wired up on the dashboard side only.
3. Tasks list in `apps/web/src/tabs/HomeTab.tsx` is `localStorage`-only. Only the *active* task syncs to Supabase. Clearing browser data or switching devices wipes them.
4. Chat history doesn't persist. New tab = new conversation. Defeats the "AI companion" framing.
5. No rate limiting / debouncing on `/api/reo/nudge`. The v2 risk register mentions it, but it isn't implemented. One stuck tab on a blocked site can mean unlimited Gemini calls.

### Logic gaps
6. Idle detection and deadline proximity were in the v1 design but were silently dropped from v2.
7. No Pomodoro break cycle — focus timer is single-shot.
8. Streak logic in `StatsTab.tsx` always counts the current day even with zero focus.
9. No active-tab time tracking via `chrome.alarms`. The current timer dies on tab switch because each content script has its own state.
10. Daily summary is cached forever — there is no scheduled refresh, only manual.

These all belong in Phase 1 (Stabilize) and are the highest-ROI work available right now.

---

## 6. Recommendation

Execute work in this order. The other AI's items are **integrated**, not dropped:

1. **Phase 1 — Stabilize.** Fix the 5 bugs and 5 logic gaps above. Ship a v2.1 that actually delivers v2's promises.
2. **Phase 2 — Identity & Reach.** Deliver other-AI items #2 (Auth), #5 (Push), #6 (Export), plus mascot moods.
3. **Phase 3 — Differentiate.** AI-powered smart whitelisting, TTS voice nudges, Pomodoro break cycle, productivity score, weekly recap.
4. **Phase 4 — Platform.** Reframed history analysis (tab-session tracking), Calendar integration, Hono migration, observability. Revisit other-AI items #1 (Mobile) and #4 (Teams) only if Phase 3 retention is healthy.

See [`2026-05-18-reo-v3-design.md`](./2026-05-18-reo-v3-design.md) for the design spec and the four
phase plans for the task-by-task breakdown.
