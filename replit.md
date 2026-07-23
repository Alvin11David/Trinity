# Ball — Football Social Platform

## Project Overview

**Ball** (codename: Trinity) is a full-stack football social platform. This repo contains the Django REST API backend. The React frontend lives in `ball_frontend/`.

## Architecture

| Layer | Stack |
|---|---|
| Backend | Django 6.0 + Django REST Framework + Django Channels (WebSockets) |
| Frontend | React 18 + Vite + Tailwind CSS (in `ball_frontend/`) |
| Database | PostgreSQL |
| Cache / Broker | Redis |
| Background tasks | Celery + django-celery-beat |
| Media storage | AWS S3 + Pillow (photos), Mux (video) |
| Football data | API-Football |
| Market values | Apify / Transfermarkt scraper |

## Running the Frontend

```bash
cd ball_frontend
npm run dev       # starts Vite on port 5173
```

Or use the **Ball Frontend** workflow in Replit.

**Demo login:** enter any username + a password of 4+ characters.

## Frontend Screens

| Screen | Route | Description |
|---|---|---|
| Login | `/login` | Two-panel auth with green branding |
| Register | `/register` | Multi-step onboarding |
| Feed | `/` | Twitter-style social feed with post reactions (⚽ 🔥 🧠 💀) |
| Matches | `/matches` | Live, upcoming, and finished matches with Winnie predictions |
| Match Detail | `/matches/:id` | Score, events timeline, stats, H2H |
| Leagues | `/leagues` | Standings table, top scorers, assists leaderboard |
| Players | `/players` | Player cards with market values (Transfermarkt enriched) |
| Teams | `/teams` | Team cards with squad values and follow |
| Communities | `/communities` | Join/discover football communities |
| Chat | `/chat` | DM + group messaging |
| Notifications | `/notifications` | Filterable notification feed |
| Profile | `/profile` | Profile with tabs: Posts, Replies, Media, Reposts |

## Theme

- **Font:** Inter (Google Fonts)
- **Color palette:** Green (`#16a34a` light / `#22c55e` dark) with dark slate backgrounds
- **Modes:** Full light/dark toggle — persisted to `localStorage`

## Backend Required Secrets

Set these in Replit Secrets (Settings → Secrets):

| Key | Purpose |
|---|---|
| `SECRET_KEY` | Django secret key |
| `API_FOOTBALL_KEY` | API-Football v3 key |
| `APIFY_API_TOKEN` | Apify token for Transfermarkt sync |
| `AWS_ACCESS_KEY_ID` | S3 media uploads |
| `AWS_SECRET_ACCESS_KEY` | S3 media uploads |
| `AWS_S3_BUCKET` | S3 bucket name |
| `AWS_S3_REGION` | S3 region (default: `us-east-1`) |

## User Preferences

- Green color palette throughout the frontend
- Both light and dark theme support
- Inter as the professional font family
- All screens professionally designed and refined
