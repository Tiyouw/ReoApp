# Reo: AI Productivity Companion

## 1. Overview
Reo is an AI-powered productivity companion designed for the #JuaraVibeCoding competition. Built as a browser extension and a Progressive Web App (PWA) Dashboard, Reo acts as a personal task enforcer. Powered by Google Gemini AI Studio and hosted on Google Cloud Run, Reo takes the form of a 3D claymorphism blob that sits at the bottom-right corner of the user's screen, dynamically adapting its personality (e.g., Javanese swearing, Jaksel slang) to motivate and reprimand users when they procrastinate.

## 2. Architecture
The system consists of three main components:
- **Backend API (Node.js/TypeScript):** Hosted on Google Cloud Run. This service handles user data, task states, and communication with the Gemini AI Studio API.
- **Browser Extension (React):** A content script injected into web pages that renders the Reo 3D blob and chat interface in the bottom-right corner. It monitors user activity (e.g., idle time, visiting distraction sites like YouTube).
- **PWA Dashboard (React/Vite):** A standalone web application where users can log in, manage their task lists, configure Reo's persona, and view productivity statistics. This can be installed on mobile devices.

## 3. Core Features
### 3.1. The Character (Reo)
- **Visual Style:** 3D Claymorphism. A squishy, adorable blob-like appearance that contrasts heavily with its potentially abrasive verbal responses.
- **Positioning:** Persistent floating bubble in the bottom-right corner of the browser viewport.

### 3.2. Dynamic AI Personas
Powered by Gemini AI, Reo dynamically generates text responses based on the selected persona:
- **Savage Jowo:** Uses harsh, comical Javanese slang to scold the user.
- **Anak Jaksel:** Uses a sassy mix of Indonesian and English.
- **Professional:** Provides polite and structured reminders.

### 3.3. Triggers & Behaviors
- **Distraction Detection:** If the user opens a blacklisted domain (e.g., youtube.com, twitter.com) while a task is active, Reo pops up and reprimands the user.
- **Deadline Proximity:** Reo visually shakes or bounces when a task deadline is approaching within a specified threshold.
- **Idle Timeout:** If the cursor is idle for too long, Reo prompts the user to check if they are stuck.
- **Manual Interaction:** Clicking on Reo opens a chat interface for AI-assisted task breakdown or advice.

## 4. Data Flow
1. User adds a task in the PWA Dashboard.
2. The Extension fetches the active task from the Backend API.
3. The Extension monitors browser activity (URL changes, idle time).
4. Upon a trigger event (e.g., opening YouTube), the Extension sends the context (Active Task + Distraction URL + Selected Persona) to the Backend API.
5. The Backend API queries Gemini AI Studio to generate a contextual response.
6. The Backend returns the response to the Extension.
7. Reo displays the response in a speech bubble with an accompanying animation.

## 5. Deployment strategy for #JuaraVibeCoding
- **Backend:** Deployed as a container on Google Cloud Run.
- **PWA:** Hosted as a static site or alongside the backend.
- **Extension:** Packaged and loaded into the browser.
