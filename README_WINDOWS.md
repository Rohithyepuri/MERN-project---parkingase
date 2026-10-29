# ParkEase - Windows & VS Code Guide

## Prerequisites on Windows
1. **Node.js** (v18 or v20+) — [nodejs.org](https://nodejs.org/)
2. **MongoDB** Community Server running locally on `localhost:27017` or MongoDB Atlas URI in `server/.env`.
3. **VS Code**

---

## Method 1: Single-Click Launcher (Easiest)
Simply double-click:
```cmd
run.bat
```
This automatically installs missing dependencies, starts the backend on port 5000, and starts the frontend on port 5173.

---

## Method 2: Running via VS Code Terminal

Open the `parkease` folder in VS Code (`File > Open Folder...`).

Open terminal (`Ctrl + \``) and run:

### 1. Install dependencies
```powershell
npm run install:all
```

### 2. Configure Environment (Preconfigured)
`server/.env` is already configured for local development. If needed:
```powershell
copy server\.env.example server\.env
```

### 3. Seed Demo Data
```powershell
npm run seed
```

### 4. Start Both Servers

**Terminal 1 (Backend API :5000):**
```powershell
npm run dev:api
```
*(Or `cd server` then `npm run dev`)*

**Terminal 2 (Frontend Web :5173):**
```powershell
npm run dev:web
```
*(Or `cd client` then `npm run dev`)*

---

## Method 3: Using VS Code Tasks
1. Press `Ctrl + Shift + P`
2. Type `Tasks: Run Task`
3. Select:
   - `1. Install All Dependencies`
   - `2. Seed Database`
   - `3. Start Backend (API :5000)`
   - `4. Start Frontend (Web :5173)`

---

## Demo Accounts
- **Admin**: `admin@parkease.dev` / `Admin@123`
- **Staff**: `staff@parkease.dev` / `Staff@123`
- **Customer**: `user@parkease.dev` / `User@123`
