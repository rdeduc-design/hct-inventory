# HCT Inventory Management System

A production-grade inventory management system for Healthcare and Technology Institute Inc. (HCT), Pasig City, Philippines.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS) |
| Hosting | GitHub Pages |
| CI/CD | GitHub Actions |
| QR Codes | qrcode.js |

---

## Deployment Guide

### Step 1 — Create Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Note your **Project URL** and **anon/public key** (Settings → API)
3. Go to **SQL Editor** → paste and run the full contents of `SUPABASE_SCHEMA.sql`
4. In **Authentication → Settings**, enable **Email** auth (and optionally Magic Link)
5. In **Authentication → Email Templates**, customize the confirmation email

### Step 2 — Create Your Admin Account

1. In Supabase Dashboard → **Authentication → Users → Invite User** (enter your email)
2. After confirming your email, go to **Table Editor → profiles**
3. Find your record and change `role` from `viewer` to `admin`

### Step 3 — Fork and Configure GitHub Repo

```bash
# Clone/fork this repository
git clone https://github.com/YOUR_ORG/hct-inventory.git
cd hct-inventory
```

4. Go to your GitHub repo → **Settings → Secrets and variables → Actions**
5. Add two secrets:
   - `VITE_SUPABASE_URL` → your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key

### Step 4 — Enable GitHub Pages

1. Repo → **Settings → Pages**
2. Source: **GitHub Actions**
3. Push to `main` → the Actions workflow deploys automatically
4. Your app will be live at: `https://YOUR_ORG.github.io/hct-inventory/`

### Step 5 — Local Development

```bash
# Copy environment file
cp .env.example .env.local
# Fill in your Supabase credentials

npm install
npm run dev
```

---

## User Roles

| Role | Who | Permissions |
|------|-----|-------------|
| **Viewer** | Guests, observers | View, search, export only |
| **Staff** | Students, faculty | Submit requests + view |
| **Room Custodian** | Lab in-charge | Add/edit inventory for assigned rooms |
| **Supply Officer** | Supply room staff | Manage CSR, approve/release requests, audit log |
| **Admin** | IT / R&D | Full access, soft-delete/restore, user management |

New accounts default to **Viewer**. Admins promote users via the Users page.

---

## Features

### Inventory
- Multi-floor, multi-room inventory (5th Floor, 3rd Floor, Central Supply)
- Preloaded item presets per room type (ICU, OR, DR, AHA, EMS, Caregiving, VR)
- Asset tag auto-generation (format: `HCT-ROOMCODE-NNNN`)
- Soft delete with restore
- Search, filter by category/status, sort by any column
- CSV export

### Transaction History
Track every inventory movement:
- **Stock In** — new supplies received
- **Stock Out** — released to department
- **Transfer** — moved between rooms
- **Return** — returned after use
- **Adjustment** — corrections

Each transaction records: quantity before/after, reference number, performed by, timestamp.

### VR Asset Registry
- Individual tracking per headset (VR-001, VR-002...)
- Serial number, brand, model, assigned room
- Last maintenance date
- QR code per asset

### Request Management
- Submit requests (Staff and above)
- Priority levels: Low → Medium → High → Urgent
- Status workflow: Pending → Approved → Released / Denied / Returned
- Inline status update by Supply Officer / Admin
- Soft delete with restore

### QR Codes
- QR code per inventory item → links to item record
- QR code per room → links to room inventory
- Print label (item name, asset tag, status, QR)
- Download QR as PNG

### Audit Log (OWASP-compliant)
Captures:
- Action type (Created, Edited, Deleted, Restored, Exported, Approved, Released, Denied)
- Record type and ID
- Old value and new value (JSONB diff)
- Changed by (name + role)
- Timestamp

### User Management (Admin)
- View all registered users
- Promote/demote roles
- Assign specific rooms to custodians

---

## Project Structure

```
hct-inventory/
├── .github/workflows/deploy.yml   # Auto-deploy to GitHub Pages
├── src/
│   ├── lib/
│   │   ├── supabase.js            # Supabase client + constants
│   │   ├── audit.js               # Audit log helper
│   │   └── qr.js                  # QR code + label printing
│   ├── context/
│   │   └── AuthContext.jsx        # Auth + permissions
│   ├── components/
│   │   ├── UI.jsx                 # Shared UI (Modal, Toast, Badge...)
│   │   ├── Nav.jsx                # Navigation bar
│   │   └── TransactionModal.jsx   # Transaction form + history table
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── HomePage.jsx           # Floor selection
│   │   ├── FloorPage.jsx          # Room cards per floor
│   │   ├── RoomPage.jsx           # Room inventory table
│   │   ├── DashboardPage.jsx      # Analytics overview
│   │   ├── VRRegistryPage.jsx     # VR asset tracking
│   │   ├── RequestsPage.jsx       # Request management
│   │   ├── AuditLogPage.jsx       # OWASP audit trail
│   │   └── UsersPage.jsx          # Admin user management
│   ├── App.jsx                    # Router
│   ├── main.jsx                   # Entry point
│   └── index.css                  # Global styles
├── SUPABASE_SCHEMA.sql            # Full DB schema with RLS policies
├── .env.example                   # Environment variables template
└── vite.config.js                 # Vite config (base path for GH Pages)
```

---

## Security Notes

- All data access is controlled by **Row Level Security (RLS)** in Supabase — not just the UI
- The anon key is safe to expose in frontend code (it's designed for that); RLS enforces access
- Passwords are handled entirely by Supabase Auth (bcrypt, secure session tokens)
- The audit log is insert-only from the frontend; rows cannot be edited or deleted through the API
- Soft delete pattern ensures data is never permanently lost from the UI; physical deletion requires direct DB access

---

## Customization

### Change the base path
In `vite.config.js`, update `base` to match your repo name:
```js
base: '/your-repo-name/',
```

### Add more rooms
Insert rows into the `rooms` table in Supabase. The app reads rooms dynamically.

### Add more preset items
Edit `PRESET_ITEMS` in `src/lib/supabase.js`.
