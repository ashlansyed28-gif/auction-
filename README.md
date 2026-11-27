# Hammer Time — T20 Cricket Auction

Free-to-play T20 Cricket Auction Friend Challenge & Broadcast Stage featuring 10 franchises (`CSK`, `MBI`, `RCB`, `KRC`, `DDC`, `SRH`, `RRG`, `PBK`, `GPT`, `LSG`), 165 illustrated player portraits, GSAP broadcast camera & paddle animations, Indian English live auctioneer voice, and room-code multiplayer sync.

## Repository Structure

```text
├── frontend/          # React 19 + TypeScript + Tailwind CSS + GSAP (Deploy to Vercel)
│   ├── public/players # 165 illustrated 600x750 player portraits (/players/<slug>.jpg)
│   ├── src/           # Lobby, Auction Stage, Records Modal, Scorecard, Realtime Adapter
│   └── vercel.json    # Vercel SPA rewrites & asset cache headers
├── backend/           # Node HTTP API & Auction Engine (Deploy to Render)
│   ├── data/          # 165-player JSON dataset
│   ├── server.mjs     # /health, /api/players, /api/rooms/:code
│   └── engine.js      # Deterministic T20 auction rules & valuation engine
├── supabase/          # Supabase SQL schema for optional persistent rooms
│   └── schema.sql
├── render.yaml        # Render Blueprint for backend/
└── app/               # Kotlin / Jetpack Compose Android source & player assets
```

---

## 1. Deploy Frontend to **Vercel**
1. Import this GitHub repo in **Vercel**.
2. Set **Root Directory** to `frontend`.
3. Add Environment Variables (for cross-device Free Fire-style Room Codes via Supabase):
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon public key
4. Deploy (`npm run build` → `dist`).

## 2. Deploy Backend to **Render**
1. Create a **Web Service** in **Render** (or use `render.yaml` Blueprint).
2. Set **Root Directory** to `backend`.
3. **Start Command**: `node server.mjs`
4. **Health Check Path**: `/health`
5. Optional env vars: `CORS_ORIGIN=https://your-vercel-app.vercel.app`

## 3. Configure **Supabase**
1. Create a free project on [Supabase](https://supabase.com).
2. Copy **Project URL** and **anon public key** from **Project Settings → API** into Vercel (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) or `frontend/.env`.
3. *(Optional)* Run `supabase/schema.sql` in Supabase **SQL Editor** if you want persistent room storage in Postgres.
