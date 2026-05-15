# Reo: AI Productivity Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of Reo, a Google Gemini-powered Chrome Extension, PWA dashboard, and Backend API that reprimands users to stay productive.

**Architecture:** A monorepo structure containing three packages: `apps/backend` (Hono.js for Gemini API calls), `apps/extension` (Vite + React for content script injection), and `apps/web` (Vite + React for the PWA dashboard).

**Tech Stack:** Node.js, pnpm workspace, TypeScript, Hono.js, React, Vite, `@google/generative-ai`.

---

### Task 1: Monorepo Initialization & Backend Setup

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `apps/backend/package.json`
- Create: `apps/backend/src/index.ts`
- Create: `apps/backend/tests/index.test.ts`

- [ ] **Step 1: Create Workspace config**

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
```

```json
// package.json
{
  "name": "reo-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm -r run dev"
  }
}
```

- [ ] **Step 2: Init Backend package & test**

```json
// apps/backend/package.json
{
  "name": "reo-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@google/generative-ai": "^0.11.0",
    "cors": "^2.8.5",
    "express": "^4.19.2"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "tsx": "^4.11.0",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 3: Write Backend App with Gemini Integration**

```typescript
// apps/backend/src/index.ts
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

app.post('/api/reo/chat', async (req, res) => {
  const { persona, context } = req.body;
  
  let systemPrompt = "You are Reo, a productivity companion.";
  if (persona === 'jowo') systemPrompt += " You speak in funny, angry Javanese slang to scold the user for slacking.";
  if (persona === 'jaksel') systemPrompt += " You speak in South Jakarta slang (Indonesian-English mix), being very sassy.";
  
  const prompt = `${systemPrompt}\n\nContext: ${context}\nGive a short 1-2 sentence reprimand.`;
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    res.json({ message: text });
  } catch (error) {
    res.status(500).json({ error: 'AI Error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

export default app;
```

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json apps/backend/
git commit -m "feat: init monorepo and backend gemini api"
```

---

### Task 2: Chrome Extension Setup & React Injector

**Files:**
- Create: `apps/extension/package.json`
- Create: `apps/extension/vite.config.ts`
- Create: `apps/extension/public/manifest.json`
- Create: `apps/extension/src/content.tsx`
- Create: `apps/extension/src/ReoBubble.tsx`
- Create: `apps/extension/src/style.css`

- [ ] **Step 1: Init Extension package**

```json
// apps/extension/package.json
{
  "name": "reo-extension",
  "version": "1.0.0",
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.2.11"
  }
}
```

- [ ] **Step 2: Create Manifest & Vite Config**

```json
// apps/extension/public/manifest.json
{
  "manifest_version": 3,
  "name": "Reo Productivity Companion",
  "version": "1.0",
  "permissions": ["activeTab", "storage"],
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "css": ["style.css"]
    }
  ]
}
```

```typescript
// apps/extension/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        content: 'src/content.tsx'
      },
      output: {
        entryFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  }
});
```

- [ ] **Step 3: Create Reo React Component & Injection Script**

```css
/* apps/extension/src/style.css */
#reo-root {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 999999;
  font-family: sans-serif;
}
.reo-blob {
  width: 80px;
  height: 80px;
  background: linear-gradient(145deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%);
  border-radius: 50%;
  box-shadow: 10px 10px 20px #d9d9d9, -10px -10px 20px #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  cursor: pointer;
  transition: all 0.3s ease;
}
.reo-blob:hover {
  transform: scale(1.1);
}
.reo-bubble {
  position: absolute;
  bottom: 100px;
  right: 0;
  background: white;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  width: 250px;
}
```

```tsx
// apps/extension/src/ReoBubble.tsx
import React, { useState, useEffect } from 'react';

export function ReoBubble() {
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    // Distraction detection simulation
    const url = window.location.href;
    if (url.includes('youtube.com') || url.includes('twitter.com')) {
      fetch('http://localhost:3000/api/reo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: 'jowo', context: `User is slacking on ${url}` })
      })
      .then(res => res.json())
      .then(data => setMessage(data.message));
    }
  }, []);

  return (
    <div>
      {message && <div className="reo-bubble">{message}</div>}
      <div className="reo-blob">👁️</div>
    </div>
  );
}
```

```tsx
// apps/extension/src/content.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ReoBubble } from './ReoBubble';
import './style.css';

const container = document.createElement('div');
container.id = 'reo-root';
document.body.appendChild(container);

const root = createRoot(container);
root.render(<ReoBubble />);
```

- [ ] **Step 4: Commit**

```bash
git add apps/extension/
git commit -m "feat: add chrome extension with claymorphism blob and backend connection"
```

---

### Task 3: PWA Dashboard Setup

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`

- [ ] **Step 1: Init Web package**

```json
// apps/web/package.json
{
  "name": "reo-web",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.2.11"
  }
}
```

- [ ] **Step 2: Create React App**

```html
<!-- apps/web/index.html -->
<!DOCTYPE html>
<html lang="en">
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```typescript
// apps/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()]
});
```

```tsx
// apps/web/src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
```

```tsx
// apps/web/src/App.tsx
import React, { useState } from 'react';

export default function App() {
  const [persona, setPersona] = useState('jowo');
  const [task, setTask] = useState('');

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Reo Dashboard ⚙️</h1>
      <div>
        <h3>Current Persona</h3>
        <select value={persona} onChange={(e) => setPersona(e.target.value)}>
          <option value="jowo">Savage Jowo</option>
          <option value="jaksel">Anak Jaksel</option>
          <option value="professional">Professional</option>
        </select>
      </div>
      <div style={{ marginTop: '2rem' }}>
        <h3>Current Task</h3>
        <input 
          value={task} 
          onChange={(e) => setTask(e.target.value)} 
          placeholder="What are you working on?"
          style={{ padding: '0.5rem', width: '300px' }}
        />
        <button style={{ marginLeft: '1rem', padding: '0.5rem' }}>Set Task</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/
git commit -m "feat: init pwa dashboard for task and persona management"
```
