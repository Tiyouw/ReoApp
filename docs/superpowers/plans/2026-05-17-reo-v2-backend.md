# Reo v2 Backend + Persistence Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace in-memory state with Supabase persistence and add stats/nudge/focus/summary API endpoints.

**Architecture:** Express backend on Cloud Run adds Supabase JS client. All endpoints require x-device-token header. New tables: settings, nudge_events, focus_sessions, daily_summaries.

**Tech Stack:** Express, @supabase/supabase-js, Gemini 2.5 Flash, Vitest

---

### Task 1: Supabase Setup

**Files:**
- Create: `apps/backend/src/supabase.ts`
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/.env`

- [ ] **Step 1:** Install Supabase client: `cd apps/backend && npm install @supabase/supabase-js`
- [ ] **Step 2:** Create `apps/backend/src/supabase.ts` with createClient using env vars
- [ ] **Step 3:** Add SUPABASE_URL and SUPABASE_SERVICE_KEY to `.env`
- [ ] **Step 4:** Create tables in Supabase SQL editor (settings, nudge_events, focus_sessions, daily_summaries)
- [ ] **Step 5:** Commit

### Task 2: Device Token Middleware

**Files:**
- Create: `apps/backend/src/middleware.ts`

- [ ] **Step 1:** Create middleware that reads x-device-token header and attaches to req
- [ ] **Step 2:** Commit

### Task 3: Migrate All Endpoints to Supabase

**Files:**
- Modify: `apps/backend/src/index.ts`

- [ ] **Step 1:** Rewrite index.ts with all Supabase-backed endpoints (device/register, state GET/POST, chat, nudge, stats, focus start/end, summary/today)
- [ ] **Step 2:** Test manually with curl
- [ ] **Step 3:** Commit

### Task 4: Update Tests

**Files:**
- Modify: `apps/backend/tests/index.test.ts`

- [ ] **Step 1:** Update tests for new v2 endpoints
- [ ] **Step 2:** Run tests
- [ ] **Step 3:** Commit
