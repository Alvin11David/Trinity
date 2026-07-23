# Ball — Frontend Architecture & UI Reference

This document is the current, durable state of Ball's product/architecture decisions — organized by subsystem, not by session. It should tell someone "what is Ball supposed to be, right now" with no need to reconstruct history. For the chronological narrative (bugs found, decisions walked back, audits run, what was verified when), see `SESSION_LOG.md` in this same directory.

**Working agreement:** this file is the shared source of truth across parallel Claude Code sessions/instances — point a new session at it before it assumes context it didn't build itself (a past incident: one instance mistook another instance's already-curated league data for corruption, purely from lack of shared context). Avoid two drivers (a planning chat and a Claude Code session) editing the same frontend files concurrently without syncing first — this caused a real overwritten-file incident once (a tab layout got clobbered).

---

## 1. Core Product Positioning

**Ball's core value is NOT Winnie's predictions.** It's structured football conversation: sharing live scores, lineups, match cards, and stats as real interactive objects inside chats and posts — instead of screenshots.

Reasoning:
- Predicting football outcomes is inherently hard; making it the main differentiator is fragile.
- Winnie is a separate product that will keep evolving independently (more advanced stat fields planned) — Ball shouldn't be built as a shell around Winnie's current feature set.
- The actual differentiator is the **shareable football object system**, reflected in the backend's `chat` app (`Message.message_type`: `match_card`, `prediction_card`, `poll`, `goal_event`) and `feed` app (`Post.post_type`: `text`, `match_object`, `poll`, `winnie_insight`).

**Practical implications:**
- Winnie's prediction card is **one card type among several** (match card, lineup card, live score card, goal/event card) — not the hero feature.
- The card/object system quality is the priority build, not decoration.
- Match Detail (see Matches, below) is the canonical source object that gets *shared* into chats/feed as a card.
- **MVP scope for shared cards: default format only.** No per-share customization (e.g. "share with lineup" vs "score only") — that's a post-MVP feature.

---

## 2. Relationship to Winnie

**Decision: Ball gets its own direct API-Football connection, separate from Winnie's** (not a proxy through Winnie).

Why:
- Maintains the decoupled microservices principle Ball was founded on — Winnie owns ML/predictions, Ball owns social/content/browsing.
- Winnie shouldn't become a general-purpose football data proxy; scope creep risk.
- Ball's league browsing (many leagues) shouldn't depend on Winnie's uptime/rate limits for leagues Winnie has no predictive interest in.

**Current state:** `matches/api_football_client.py` is Ball's own client, parallel in structure to the existing `matches/winnie_client.py`. The Winnie integration itself is confirmed working end-to-end (Ball fetches and caches Winnie predictions). Distinguishing "has a Winnie prediction" from "browse-only" needs no dedicated field — it relies on `winnie_prediction` being non-null on `Match`.

**Winnie's ML predictions only cover 5 leagues**: EPL, La Liga, Serie A, Bundesliga, Ligue 1 (flagged `is_core_league=True` on `League` — see Leagues, below). Every other league Ball supports shows real match/table/fixture data via Ball's own API-Football integration, just with no Winnie prediction card on Match Detail. This is expected, not a gap — not every match needs a prediction to be useful content.

**Visual distinction:** Winnie (sister product) uses a brighter green (`#00e676`) with Syne + DM Mono fonts. Ball intentionally uses a deeper, more mature green (see Design System) to feel distinct while staying in the same football-product family.

---

## 3. Navigation & App Shell

### Bottom Tab Bar (5 tabs, final)
```
Home | Matches | Leagues | Chat | Activity
```
(The 5th tab's route file is still `notifications.tsx`; only its title changed to **Activity**, and it now hosts two segments — see Notifications/Activity below.)

### Profile — NOT a tab
Accessed by tapping the user's avatar (top corner, X/Twitter-style). Opens a **drawer** (`@react-navigation/drawer` via `withLayoutContext`, nested inside the tab navigator — SDK 54 doesn't bundle `expo-router/drawer`, only SDK 56+ does), not a full navigation tab. Freed up a tab slot for Leagues instead.

**Drawer contents** (`src/components/ProfileDrawer.tsx`): avatar/initial placeholder, display name, @handle, Following/Followers counts, menu items (Profile, Bookmarks (future), Settings & Privacy, Help Center), Log Out.

**Profile screen — built** (see Users & Auth → Profile/Block/Report). The drawer's "Profile" item now routes to `profile/[username]`; People-search rows, follow/mention notifications, and post authors all deep-link into it too (the earlier "fail gracefully on tap" dead ends are closed).

### Route structure
```
app/
├── _layout.tsx              (root Stack: auth vs main)
├── (auth)/                  (login, register)
├── (main)/
│   ├── _layout.tsx          (Drawer navigator, custom drawerContent = ProfileDrawer)
│   └── (app)/(tabs)/
│       ├── _layout.tsx
│       ├── index.tsx         (Home / Feed)
│       ├── matches.tsx
│       ├── leagues.tsx
│       ├── chat.tsx
│       └── notifications.tsx
│   ├── (app)/league/[id].tsx
│   ├── (app)/team/[id].tsx
│   ├── (app)/player/[id].tsx
│   ├── (app)/match/[id].tsx
│   ├── (app)/post/[id].tsx
│   ├── (app)/profile/[username].tsx
│   ├── (app)/profile/edit.tsx    (modal presentation)
│   ├── (app)/search.tsx
│   └── (app)/compose.tsx
└── modal.tsx
```

`src/components/DrawerAvatarButton.tsx` is a floating top-left avatar button on each tab screen that calls `navigation.openDrawer()`.

### Chat Tab shape

Uses a **segmented top bar** within the single Chat tab (not two separate tabs) — Chat and Communities have different interaction models but both needed to fit in the tab budget.

```
[ Chats ] [ Communities ]
```

- **Chats segment** — DMs, group chats, channels (message-based, linear stream).
- **Communities segment** — public communities feed (post/vote/discuss, subreddit-style).

Key distinction maintained throughout planning:
- *Group* = private/invite-only messaging (WhatsApp-style).
- *Channel* = broadcast or open messaging space (Telegram-style); a channel's `channel_mode` is `open` (anyone posts) or `broadcast` (admins only post).
- *Community* = public, feed-based, subreddit-style — a separate backend app (`communities`), not part of `chat`.

**Frontend status:** both segments are live. Chats: conversation list (avatars, last-message preview, unread badges from the read-cursor counts) with New-conversation and Public-channels entry points. Communities: My communities + Discover list with join-toggles and a create-community modal. See the Chat and Communities sections for the full screen inventory.

### Search entry point

Search is **not** a sixth bottom-tab app — it's an icon in Feed's header (top-right), opening `search.tsx`. No new bottom-nav real estate. (A separate "Football Hub" widget concept — a persistent Schedule/Groups/News card pinned inside the feed itself — was explicitly scoped out as a different, undesigned feature; not to be conflated with Search.)

---

## 4. Design System

Implemented in `tailwind.config.js`. **Aesthetic:** clean, dark, minimal — X/Threads inspired.

| Token | Value | Use |
|---|---|---|
| `background` | `#0A0A0A` | App base |
| `surface` | `#141414` | Cards, posts |
| `elevated` | `#1C1C1C` | Modals |
| `border` | `#262626` | Hairlines |
| `primary` | `#1B9C5D` (pitch green) | Actions, active states |
| `primaryDark` | `#157A49` | Pressed states |
| `text` | `#F5F5F5` | Primary text |
| `textSecondary` | `#A1A1A1` | Meta/timestamps |
| `textMuted` | `#6B6B6B` | Placeholders |
| `goal` | `#1B9C5D` | Semantic — goals/wins |
| `yellowCard` | `#F5A623` | Semantic |
| `redCard` | `#E5484D` | Semantic |

**Typography:** Geist (body/headings) + JetBrains Mono (labels/stats).

**NativeWind:** configured via `tailwind.config.js` + `global.css` + `metro.config.js` + `babel.config.js`. The `content` glob must cover `./app/**`, `./components/**`, and `./src/**/*.{js,jsx,ts,tsx}` — a class inside `src/components/*.tsx` compiles to nothing if `src/` isn't in the glob (see Known gaps pattern below; this specific instance is already fixed).

---

## 5. Users & Auth

**Backend:** Phone OTP verification (Africa's Talking) + mutual contact sync are live. `Follow` (one-way, `follower`/`following`) and mutual-contacts (`Contact`, phone-hash based) relationships both exist and are used by Chat's DM permission logic (see Chat).

**Frontend, built end-to-end and tested on a physical device:**
- `src/api/client.ts` — Axios instance, JWT bearer auto-attach via request interceptor, 401 → refresh-token retry via response interceptor.
- `src/api/auth.ts` — `register`, `login`, `getProfile`.
- `src/store/authStore.ts` — Zustand store: `user`, `isAuthenticated`, `isLoading`, `login()`, `register()`, `logout()`, `restoreSession()`.
- Tokens stored via `expo-secure-store`.
- `app/(auth)/login.tsx`, `app/(auth)/register.tsx`, `app/(auth)/_layout.tsx`.
- Root layout (`app/_layout.tsx`) restores session on mount, redirects unauthenticated users to `(auth)`, authenticated users to `(main)`.

**Backend contract:** `POST /api/users/register/` returns `{user, refresh, access}`. `POST /api/users/login/` (SimpleJWT's `TokenObtainPairView`) returns only `{access, refresh}` — no user object, hence `login()` calls `getProfile()` separately afterward.

### 5.1 Profile, Block & Report

**User model additions.** `bio` (280-char) predates this work. Added: favorite team (⚠ **now `favorite_team` FK → `teams.Team`** as of 2026-07-22 — was denormalized `favorite_team_id`/`favorite_team_name` before the Team model landed; the API still exposes `favorite_team_id`/`favorite_team_name`/`favorite_team_logo` unchanged — see §16), `favorite_league` (FK → the real `League`, mirrors `UserLeagueFollow`), and `pinned_post` (nullable FK → `feed.Post`, `SET_NULL`). Favorite team and league are **independent, both optional, no exclusivity** — whichever is set displays; both-set is harmless. `pinned_post` is a single FK, **not** a boolean on `Post`: pinning a new post just repoints the FK, automatically replacing the prior pin. Legacy free-text `favorite_club` is retained, untouched.

**Block (`users.Block`, `unique_together('blocker','blocked')`)** — a real block, not cosmetic. All effects funnel through **`users/blocking.py`** (`blocked_user_ids(user)` → both-direction set; `is_blocked_between(a,b)`; `exclude_blocked_authors(qs, user)`), the single shared filter so Following/For You/Search can't drift:
- **DM creation** hard-rejects if a block exists either direction, checked **before** the mutual-follow rule in `ConversationCreateSerializer.validate()` — a block always wins.
- **Follow** — creating a Block auto-deletes Follow rows in both directions; the two can't coexist. Unblock is a plain delete, **no auto-refollow**.
- **Search** — People results exclude blocked users both directions; the post-based tabs (Top/Latest/Media) exclude blocked authors; **the search-typeahead `AutocompleteView` also excludes them** (added after a gap was found: the full People tab excluded blocked users but the on-keystroke username-prefix autocomplete did not, so a blocked user stayed findable by typing their handle — closed 2026-07-14, both directions).
- **Feed** — both `FeedView` (Following) and `GlobalFeedView` (For You) exclude blocked authors. For You needs a **single** `exclude_blocked_authors` call because its three 36.6 candidate pools (affinity/trending/social-proof) are merged into one queryset before ranking — no per-pool duplication.
- **Profile visibility** — a block either direction fully hides profile content. Design note: the aggregate endpoint still **resolves** (not a 404), but `ProfileSerializer.to_representation` masks bio/avatar/banner/favorites/counts/pinned-post server-side and the tab endpoints return empty — nothing leaks over the API. Resolving-with-masking (rather than 404) is deliberate: it keeps **Unblock reachable from the blocked user's own profile**. The frontend renders "You blocked @x" + Unblock for the blocker, "This account is unavailable" for the blocked-by side.
- **Blocked Accounts list** — `GET /api/users/blocked/` (`BlockedAccountsView`) is the canonical, always-reachable review/unblock surface (Settings → Blocked Accounts, most-recently-blocked first). The masked stale-link profile view above is NOT a discovery path; this list is. Unblock reuses `DELETE /api/users/<username>/block/`.

**Report (`users.Report`)** — reporter / reported_user / reason enum (`spam`/`harassment`/`impersonation`/`other`) / optional `detail` / created_at. Reporting a **user only** (posts/messages explicitly out of scope). Capture only — no moderation-side review UI yet.

**Endpoints.** `GET /api/users/<username>/profile/` (`ProfileSerializer`: identity, follower/following counts, viewer relationship — is_self/is_following/is_followed_by/is_blocked/is_blocked_by — and pinned post). Four cursor-paginated tab endpoints `GET /api/feed/users/<username>/tab/{posts,replies,media,reposts}/`, each reusing an existing author-filtered query (Post / Comment / has-media Post / repost_of-set Post), pagination matching `FollowingCursorPagination`. `POST/DELETE /api/users/me/pin/` (pin/unpin own post), `POST/DELETE /api/users/<username>/block/`, `POST /api/users/<username>/report/`. `PATCH /api/users/me/` now writes username/bio/avatar + favorite team/league via `ProfileUpdateSerializer`.

**Avatar + banner images (upload, not URLs).** `User.banner` (X-style wide header) joins `avatar`; both stay plain URL fields holding the resulting **public S3 URL**. Upload reuses 36.9's S3 + Pillow pipeline as a **new call site, not a second pipeline**: `create_s3_presigned_upload(content_type, prefix=…)` (prefix scopes `avatars/`/`banners/` key namespaces) + `feed/media.py::finalize_profile_image` (reads the uploaded object back, Pillow-validates, `ImageOps.fit` cover-crops + resizes — **avatar 400×400, banner 1500×500** — writes the resized JPEG back to the same key). Endpoints `POST /api/users/me/image/upload-url/` + `.../finalize/`. Validation: JPEG/PNG/WebP/**HEIC/HEIF**, 10MB cap, finalize key-prefix guard; unconfigured S3 → 503 (parity with post photos). **HEIC support (closed 2026-07-14):** `pillow-heif==1.4.0` is now a pinned dependency and `register_heif_opener()` runs at startup in `feed/apps.py::FeedConfig.ready()` (a global Pillow registration, so it covers **both** media pipelines — profile images and post photos). Before this, Pillow 12 had no HEIF decoder at all (`Image.registered_extensions()` confirmed `.heic`/`.heif` absent), so HEIC uploads 400'd — that root gap is closed: the profile allow-list now accepts `image/heic`/`image/heif`, and the post-photo pipeline's latent fragility (a true raw-HEIC upload would previously 400 at `finalize_photo`) is gone too. Verified end-to-end with a genuine in-memory HEIF encode→decode→resize; the `ready()` registration is confirmed firing (extensions present after startup). **Standing caveat (same list as the S3 live-paths):** a real iPhone-camera HEIC asset over the live S3 round-trip is still device-unverified — the unit test uses a pillow-heif-encoded HEIF, not a real device capture.

**Endpoints.** `GET /api/users/<username>/profile/` (`ProfileSerializer`: identity, follower/following counts, viewer relationship — is_self/is_following/is_followed_by/is_blocked/is_blocked_by — and pinned post). Four cursor-paginated tab endpoints `GET /api/feed/users/<username>/tab/{posts,replies,media,reposts}/`. `POST/DELETE /api/users/me/pin/`, `POST/DELETE /api/users/<username>/block/`, `POST /api/users/<username>/report/`, `GET /api/users/blocked/`, `POST /api/users/me/image/{upload-url,finalize}/`. `PATCH /api/users/me/` writes username/bio + favorite team/league (avatar/banner are set by their own finalize calls).

**Frontend.** `src/api/profile.ts` + `src/hooks/useProfile.ts` (aggregate query; four gated infinite tab queries; follow/block/unblock/report/update/pin mutations; blocked-accounts query). `app/(main)/(app)/profile/[username].tsx` — **X-style header** (banner image at top with the circular avatar overlapping its lower edge), name, bio, **tappable favorite badge** → Search prefilled via `?q=`, counts, action row (Edit Profile for self; Follow + Message + overflow for others — Message is block-aware and surfaces the real rejection reason), four tabs, **pinned post at top of Posts**. Block behind the overflow menu with an effects-stating confirm; Report is a reason-picker + detail modal. `profile/edit.tsx` (modal) — username/bio + **avatar & banner image pickers** (`expo-image-picker`, separate crop UIs: square avatar / wide `[3,1]` banner; direct-to-S3 upload with % progress via `uploadFileToUrl`, then finalize). `settings/index.tsx` (Settings & Privacy hub) + `settings/blocked.tsx` (Blocked Accounts list, Unblock with a confirm dialog), reached from the drawer's "Settings & Privacy". Profiles are reachable from the drawer, People-search rows, follow/mention notifications, and post authors (`AuthorRow`).

**Favorite team/league setter.** Both are settable from Edit Profile (two independent rows, each with its own search-as-you-type picker + explicit Clear — `src/components/profile/FavoritePickerModal.tsx`, a generic modal). Team search: `GET /api/leagues/teams/search/?q=` (`TeamSearchView`) returns distinct `{team_id, team_name, team_logo}` — ⚠ **now sourced from the `teams.Team` model** (2026-07-22), so it covers **all ~1,502 synced teams** (icontains), not just teams appearing in standings. Same response keys as before. League search reuses the existing `LeagueListView ?search=` via `getLeagues({search})`. Selections ride the **same single Save** as username/bio through `ProfileUpdateSerializer`: `favorite_team_id`/`favorite_team_name`/**`favorite_team_logo`** set/cleared as a group (the crest is a denormalized URL captured from the search result at set-time, mirroring `favorite_league_logo`), `favorite_league` as a League **pk** (or null). Each favorite is independently clearable (no exclusivity). The profile header renders **both** as separate chips when set (team chip with `favorite_team_logo`, league chip with `favorite_league_logo`) — side by side, each deep-linking into Search; they no longer collapse to one, and the earlier team-crest asymmetry (team chip had no logo) is closed.

**Known gaps (Profile/Block/Report):**
- Avatar/banner S3-live paths (presign round-trip, resize-write-back, public serving) are unverified against a real bucket — only guard/validation/transform logic is proven.
- HEIC: **fixed** — `pillow-heif` added + registered at startup (see the upload paragraph above); decode gap closed for both pipelines. Only the real-device-capture-over-live-S3 leg remains on the standing device-verification list.
- Settings hub has only the Blocked Accounts row so far.
- Device-unverified (typecheck-clean only), consistent with prior frontend sessions.

---

## 6. Leagues

### 6.1 Leagues List Screen & Following

`app/(main)/(app)/(tabs)/leagues.tsx` — pattern based on FotMob's Leagues tab: search bar ("Find leagues"), a **"Following"** section (real per-user follows, not a fixed flag — see below), and an "All Competitions" section grouped by country with collapsible rows (`src/components/CountryLeagueGroup.tsx`).

Ball supports a broad list of leagues/countries for browsing (fixtures, tables) — not just the 5 Winnie-covered leagues (see Relationship to Winnie). **Explicitly rejected:** defaulting the Leagues tab to the user's favorite league/club — the tab always opens to the same neutral list state for everyone (users get agitated when the app assumes what they want to look at).

**Per-user following is user-controlled and editable**, not a fixed backend flag (confirmed via FotMob reference screenshots):
- `UserLeagueFollow` model (`leagues/models.py`) — FK to `users.User` and `League`, `unique_together`, plus an `order` field reserved for future drag-reordering.
- `LeagueSerializer.is_following` — per-request `SerializerMethodField`.
- `POST /api/leagues/<league_id>/follow/` — toggle follow/unfollow.
- `GET /api/leagues/following/` — list a user's followed leagues.
- Frontend: `LeagueListItem.tsx` (shared row component, Follow/Following pill button, `variant='compact'|'default'`), wired via `useToggleFollowLeague`/`useFollowedLeagues` (TanStack Query).
- New users start with an **empty** Following list — no auto-following of core/default leagues. Empty state: "Follow leagues to see them here."
- Row tap navigates to League Detail; the Follow-button tap does not also trigger navigation (RN's innermost `Touchable` claims the gesture — no `stopPropagation` needed).

Both the country-group browse list and search are filtered to the **curated featured set only** (`featured_only` query param on `LeagueListView`, hardcoded `true` inside the frontend's `getLeagues()` function itself rather than left to each call site, so this can't silently regress per call site).

**Three separate, independent boolean concepts on `League`** — easy to conflate, each serves a different purpose:
- `is_core_league` — the 5 Winnie-predicted leagues.
- `is_featured` — the curated 209 (see 6.5, below).
- `is_following` (via `UserLeagueFollow`) — per-user, editable.

**Nationality/country flags:** API-Football's flag images (`country_flag`) are `.svg` (confirmed live at `media.api-sports.io/flags/*.svg`, no `.png` alternate at the same path) — React Native's core `Image` cannot render remote SVGs. Worked around via `flagcdn.com/w40/{code}.png` (a public flag CDN, deliberate third-party dependency, worth knowing if `flagcdn.com` availability/rate limits ever matter at scale), built from the ISO code synced from API-Football's own `/countries` endpoint. See 6.4 for the full pipeline (a dedicated `Country` sync was needed — reusing `League.country_flag` data only covered 62% of real player nationalities).

### 6.2 League Detail Screen

`app/(main)/(app)/league/[id].tsx` — 4-tab screen: **Table | Fixtures | Results | Player Stats**.

- **Table** — `useStandings(leagueId, season)`: rank, logo, team, P/W/D/L, F/A goals, Pts; left-border accent color (green = European qualification, red = relegation — inferred by matching a substring in the standings row's `description` field; gray = mid-table).
- **Fixtures / Results** — a single `useLeagueMatches(leagueId)` query, client-filtered/sorted via `useMemo` (`scheduled` ascending for Fixtures, `finished` descending for Results), shared `MatchRow` component.
- **Player Stats** — a FotMob-style category switcher: Goals, Assists, Yellow/Red cards, Penalty scored, Shots, Shots on Target, Dribbles attempted/successful, Fouled, Key passes, Passes. Goals/Assists use server-side `rank_position`; every other category is sorted **client-side** from `full_stats` JSON, computed only over players already present in the scorer+assist dataset — **not a true league-wide ranking** (a real limitation, not yet resolved). "Big chances created/missed" (seen in a reference screenshot) is omitted — not a field API-Football provides.
- Navigation: tapping any league row (search, Following, or country-group) routes here with `season`/`name` as query params.

**Explicitly deferred (no data source identified):** News, Transfers tabs.

**Note for future cup competitions:** tournament-style competitions (e.g. World Cup) use a different tab set in reference apps (`Table | Knockout | Fixtures | News | Player stats`) because of the knockout stage — not relevant to Ball's 5 core leagues (all round-robin), but relevant if Ball ever adds cup competitions.

### 6.3 Team Detail Screen

`app/(main)/(app)/team/[id].tsx` — 4-tab screen: **Fixtures | Squad | Stats | Table**.

- **Header** — crest, name, country, founded year, venue (name/city/capacity), fetched **live** from `/teams` on each view (not persisted — cheap, rarely-changing data, avoids another sync task), plus league position + last-5 form parsed from the team's own row in `useStandings`.
- **Fixtures** — `GET /api/matches/team/<team_id>/` (`TeamMatchesView`), filters `Match` by `home_team_id` OR `away_team_id`.
- **Squad** — `TeamSquadView` (`GET /api/players/?team_id=X`), grouped by position via `SectionList`. Each `PlayerRow` shows per-player Appearances/Goals/Assists columns (via the same cross-competition `sumStatForTeam` aggregation used by Key Player, below), `~` shown for players with no synced stats. Column widths are a consistent `w-10` on both header and row (a real overflow/misalignment bug was found and fixed here — see log).
- **Stats** — hits the single-team `TeamStatisticsView` endpoint directly (not a league-wide leaderboard filtered client-side).
- **Table** — reuses `useStandings` directly from League Detail's hook file, no wrapper.

**Trophies tab explicitly excluded** — API-Football's `/trophies` endpoint only accepts `player`/`coach` parameters, not `team` (confirmed via a direct API test). No clean team-level trophy data source exists.

**Stats tab, in order:** Discipline (Yellow/Red Cards, summed from minute-bucketed data via `sumCardBuckets`) → Scoring (Goals For/Against, Clean Sheets, Failed to Score, Penalties Scored) → Biggest Results (home & away win/loss score lines) → Position in League Table (a 5-row window centered on the team's actual rank, ±2 — deliberately not a blind top-3, which would exclude mid/lower-table teams) → **Key Player grid** (Goals, Assists, Appearances, Passes, Key Passes, Tackles, Interceptions — 7 tiles): the squad member leading the team in each category, summed across **every** competition entry belonging to the current team this season (`entry.team.id === teamId`, so a mid-season transfer's stats at a previous club don't leak in) rather than picking one arbitrary competition entry.

Fields deliberately excluded: `fouls` (no team-level total exists in `/teams/statistics`), `biggest.streak` (redundant with Form chips already shown), "Clearances" (no clean API-Football field — closest is `tackles.blocks`, unverified for completeness).

**Field completeness** (checked empirically against 133 real synced Premier League players, not assumed): `passes.total` 102/133, `passes.key` 86/133, `tackles.total` 89/133, `tackles.interceptions` 80/133, `duels.total` 99/133 non-null.

**Known data coverage (not a bug):** full squad statistics only exist for 4 teams (`team_id` 33/34/35/40 — Man Utd/Newcastle/Bournemouth/Liverpool), plus 2 incidental single-player rows. `TeamStatistics` rows only exist for the 20 Premier League teams, `season=2025` — under Ball's confirmed end-year season convention (see Known gaps, below) that's actually the **2024/25** season, one season behind the 2025/26 data the rest of the app is built against; this looks like an unresolved leftover mismatch, not a deliberate scope choice. No expansion has happened since these were manually synced for testing — other teams/leagues show empty Stats tabs until synced.

### 6.4 Player Detail Screen

`app/(main)/(app)/player/[id].tsx` — 3-tab screen: **Profile | Matches | Stats**. Route param `id` is the API-Football numeric player ID (`api_football_id`), the same convention used by `PlayerLeagueStat.player_id`/`PlayerMatchStat.player_id` — **not** the Django PK. `TeamSquadView.get_queryset` supports filtering by a `player_id` query param mapped to `api_football_id`.

- **Profile** — header (photo, name, position, number, team) + season snapshot (appearances/goals/assists) + bio rows (age, nationality, height, weight, birth date/place). Pulls entirely from `Player.statistics` — no dedicated sync needed.
- **Matches** — `usePlayerMatchHistory` → a compact table: `MatchHistoryHeader` (Date/Opponent | Min | G | A | Cards | Rate) + `MatchHistoryRow` (opponent crest, result-colored score pill — green win / red loss / gray draw, from the viewed player's side — minutes, goals, assists, colored card indicator, rating). An **"On the bench"** row state replaces the stat columns entirely when `minutes` is `null` (API-Football's `/fixtures/players` includes unused subs).
- **Stats** — per-competition expandable `CompetitionStatCard`s (season/competition header, a quick-glance row of Appearances/Starts/Mins-per-game/Goals/Assists, Open/Close toggle revealing the fuller Attacking/Passing/Defending/Discipline/Penalties breakdown). A **Total / League / Cup / National** segmented filter sits above — Total sums every competition entry into one card; the other three list individual, non-aggregated cards per matching entry.

**Classification heuristic (not authoritative, flagged for spot-checking):** API-Football's player statistics entries carry no competition "type" field. If an entry's `team.id` differs from the player's actual club → National (country-duty). Else Cup if the competition name matches common cup/knockout keywords ("cup", "shield", "champions league", "europa", etc.). Else League.

**Backend:** `PlayerMatchStat` model — one row per `(match, player_id)`: minutes/rating/position/goals/assists/cards + a full raw stat blob (`full_stats`). `GET /api/matches/player/<player_id>/history/` (`PlayerMatchHistoryView`, ordered `-match__kickoff_time`); `PlayerMatchStatSerializer` includes a nested `match_summary` (kickoff time, league name, both teams + logos + **ids**, scores) — the team ids were added beyond the original spec because computing "opponent"/home-vs-away requires them.

**Data coverage:** Liverpool's complete 2025/26 EPL season is backfilled (38 matches, `2025-08-15` through `2026-05-24`, 33 distinct players have match-history rows). No other team's players have match-history rows yet — future finishes populate incrementally via the event-driven sync hook (see Matches), no separate backfill needed going forward.

**Nationality flags — the full pipeline:**
- `players.Country` model, synced from API-Football's `/countries` endpoint (`SyncCountriesView` / `GET /api/players/countries/`) — 171 countries loaded. Needed because reusing `League.country_flag` only covered 25/40 (62%) of real player nationalities in the DB (countries without a "featured" league synced — Hungary, Czechia, Georgia, Wales, Northern Ireland, etc. — had no flag data).
- `src/lib/flags.ts::getFlagUrl()` — normalizes accents/hyphens/punctuation, applies a small alias map for genuine name mismatches between API-Football's `/players` and `/countries` endpoints (`"Czechia"` vs `"Czech-Republic"`, `"Korea Republic"` vs `"South-Korea"`, `"Türkiye"` vs `"Turkey"`, `"Côte d'Ivoire"` vs `"Ivory-Coast"`, `"Republic of Ireland"` vs `"Ireland"`, plus a systemic hyphen-vs-space convention on multi-word country names), falls back to `null` (no image, not a crash) for anything unmatched.
- Wired into Team Detail's Squad rows and Player Detail's Profile → Nationality row.

**Known tech debt (frontend-wide, not just this screen):** `TeamLogo`/`TeamCrest`, `formatKickoff`, `StatSectionHeader`/`StatTile`/`StatTileGrid`, `sumCardBuckets`, and a match-row-equivalent component are all independently duplicated (slightly adapted each time) across `league/[id].tsx`, `team/[id].tsx`, `player/[id].tsx`, and `match/[id].tsx` — a four-way duplication, not yet extracted into `src/components/` or a shared utils file. This is the same category of risk that caused the standings `form`/`points` sync bug to need fixing twice (see Matches → sync architecture).

### 6.5 Curated Leagues Reference

**Current state:** fully synced and curated. 791 leagues total in the DB; **209 flagged `is_featured=True`** across 56 countries plus 16 continental competitions (final count, corrected up from an earlier 206 after adding England's FA Community Shield, which had been missed; contamination-scanned clean of youth/reserve/women's/academy entries). 5 leagues remain flagged `is_core_league=True` (the Winnie-5), unchanged and separate from this curation.

**Known gaps** (data unavailable in API-Football, not a curation error): Uganda — FUFA Big League, Uganda Cup; Tanzania — FA Cup. If these matter for the Uganda-focused audience later, they'll need a different data source.

**Process for re-curating or adding new countries later:** sync country → search each named competition by name to find its real `league_id` → verify by cross-checking country/type (exclude youth/reserve/women's variants unless explicitly wanted) → flag `is_featured=True` only on verified matches → report unresolved cases rather than guessing.

**Reference tier list** (target scope; kept for future re-verification, not necessarily 1:1 with what's currently flagged):

<details>
<summary>Tier 1 — deep coverage</summary>

- **England:** Premier League, Championship, League One, League Two, National League (optional), FA Cup, EFL Cup (Carabao Cup), FA Community Shield
- **Spain:** La Liga, Segunda División, Primera Federación, Copa del Rey, Supercopa de España
- **Italy:** Serie A, Serie B, Serie C, Coppa Italia, Supercoppa Italiana
- **Germany:** Bundesliga, 2. Bundesliga, DFB-Pokal, DFL-Supercup
- **France:** Ligue 1, Ligue 2, Championnat National, Coupe de France, Trophée des Champions
</details>

<details>
<summary>Tier 2 — top 2-3 divisions + cups</summary>

- **Netherlands:** Eredivisie, Eerste Divisie, KNVB Cup, Johan Cruyff Shield
- **Portugal:** Primeira Liga, Liga Portugal 2, Taça de Portugal, Taça da Liga, Supertaça Cândido de Oliveira
- **Belgium:** Belgian Pro League, Challenger Pro League, Belgian Cup, Belgian Super Cup
- **Türkiye:** Süper Lig, 1. Lig, Turkish Cup, Turkish Super Cup
- **Scotland:** Scottish Premiership, Scottish Championship, Scottish Cup, Scottish League Cup
- **Brazil:** Série A, Série B, Série C, Copa do Brasil, Supercopa do Brasil (state championships like Paulista deferred)
- **Argentina:** Primera División, Primera Nacional, Copa Argentina, Supercopa Argentina
- **Mexico:** Liga MX, Liga de Expansión MX, Leagues Cup (shared w/ MLS), Campeón de Campeones
- **USA/Canada:** MLS, MLS NEXT Pro, USL Championship, U.S. Open Cup, Canadian Championship
- **Japan:** J1 League, J2 League, J3 League, Emperor's Cup, J.League Cup, Japanese Super Cup
- **Saudi Arabia:** Saudi Pro League, First Division League, King's Cup, Saudi Super Cup
</details>

<details>
<summary>Tier 3 — top division + cup only</summary>

- **Austria:** Austrian Bundesliga, 2. Liga, ÖFB Cup
- **Switzerland:** Swiss Super League, Challenge League, Swiss Cup
- **Denmark:** Danish Superliga, Danish 1st Division, Danish Cup
- **Sweden:** Allsvenskan, Superettan, Svenska Cupen
- **Norway:** Eliteserien, OBOS-ligaen, Norwegian Cup
- **Poland:** Ekstraklasa, I Liga, Polish Cup, Polish SuperCup
- **Czech Republic:** Czech First League, Czech National League, MOL Cup
- **Greece:** Super League Greece, Super League 2, Greek Cup
- **Croatia:** HNL, First Football League, Croatian Cup
- **Serbia:** Serbian SuperLiga, Serbian First League, Serbian Cup
- **Ukraine:** Ukrainian Premier League, First League, Ukrainian Cup
- **Romania:** Liga I, Liga II, Cupa României
- **Russia:** Russian Premier League, Russian First League, Russian Cup, Russian Super Cup (include/exclude decision deferred)
- **Uruguay:** Primera División, Segunda División, Supercopa Uruguaya
- **Chile:** Primera División, Primera B, Copa Chile, Supercopa de Chile
- **Colombia:** Categoría Primera A, Primera B, Copa Colombia, Superliga Colombiana
- **Ecuador:** LigaPro Serie A, Serie B, Copa Ecuador
- **Peru:** Liga 1, Liga 2
- **Paraguay:** Primera División, División Intermedia, Copa Paraguay
- **Bolivia:** División Profesional
- **Venezuela:** Primera División
- **Costa Rica:** Liga FPD
- **South Korea:** K League 1, K League 2, Korean FA Cup
- **China:** Chinese Super League, China League One, Chinese FA Cup
- **UAE:** UAE Pro League, President's Cup
- **Qatar:** Qatar Stars League, Emir Cup
- **Iran:** Persian Gulf Pro League, Hazfi Cup
- **India:** Indian Super League, I-League, Super Cup
- **Thailand:** Thai League 1, Thai League 2, FA Cup
- **Indonesia:** Liga 1, Liga 2
- **Malaysia:** Malaysia Super League, Malaysia Cup, FA Cup
- **Singapore:** Singapore Premier League
- **Australia:** A-League Men, Australia Cup
- **New Zealand:** National League
- **Egypt:** Egyptian Premier League, Egypt Cup, Egyptian League Cup, Egyptian Super Cup
- **South Africa:** Premier Soccer League, National First Division, Nedbank Cup, MTN8
- **Morocco:** Botola Pro, Throne Cup
- **Tunisia:** Ligue Professionnelle 1, Tunisian Cup
- **Algeria:** Ligue Professionnelle 1, Algerian Cup
- **Nigeria:** Nigeria Premier Football League
- **Uganda:** Uganda Premier League, FUFA Big League, Uganda Cup
- **Kenya:** Kenyan Premier League, FKF Cup
- **Tanzania:** Premier League, FA Cup
</details>

<details>
<summary>Continental competitions</summary>

- **Europe:** UEFA Champions League, UEFA Europa League, UEFA Conference League, UEFA Super Cup
- **South America:** CONMEBOL Libertadores, CONMEBOL Sudamericana, Recopa Sudamericana
- **North America:** CONCACAF Champions Cup, Leagues Cup
- **Africa:** CAF Champions League, CAF Confederation Cup, CAF Super Cup
- **Asia:** AFC Champions League Elite, AFC Champions League Two, AFC Challenge League
- **Oceania:** OFC Champions League
</details>

### 6.6 Leagues-tab Entity Search (built 2026-07-21)

A **football-entity** search living on the Leagues tab — deliberately **separate from and clearly scoped against** Feed's social search (Section 10). The point: a user looking up a player shouldn't have to drill league → team → squad. Two distinct surfaces, no overlap:
- The Leagues tab keeps its inline **"Find leagues"** bar (leagues-only live filter, unchanged).
- A **search icon top-right** of the Leagues tab header opens a full-screen entity search.

**Screen** `app/(main)/(app)/leagues-search.tsx` — **live grouped results, no tabs** (unlike social search's 5 tabs), debounced 250ms, sections **Teams · Players · Leagues · Countries**, each UI-capped ~6. Empty state (before typing) = quick-access to the user's **followed leagues + followed teams**.

**Sources (only ONE new endpoint needed):**
- **Teams** — existing `/api/leagues/teams/search/?q=` (`TeamSearchView` — ⚠ now `teams.Team`-sourced, all ~1,502 synced teams; same response keys).
- **Players** — **NEW** `GET /api/players/search/?q=` (`PlayerSearchView`): pg_trgm `TrigramSimilarity` on `name` OR'd with `icontains` for recall, ranked by similarity, capped 20; lean `PlayerSearchSerializer` (drops the heavy `statistics` blob). **Only returns synced players** — core-5-scoped today, grows automatically as squads sync in. No migration (view/serializer/URL only).
- **Leagues** — existing `getLeagues({ search })` (featured set).
- **Countries** — **filtered client-side** from the grouped-by-country cache (shares the `['leagues','by-country']` query key), so every country result is guaranteed to have featured leagues behind it. Tap → `country/[name].tsx` (a focused "leagues in <country>" list via `getLeagues({ country })`, reusing `LeagueListItem`).

Rows deep-link to `team/[id]` · `player/[id]` · `league/[id]` (via `LeagueListItem`) · `country/[name]`. Player rows render nationality flags via `getFlagUrl`.

**Files:** backend `players/{views,serializers,urls}.py`; frontend `src/api/footballSearch.ts` (`searchPlayers`), `getFollowedTeams` in `src/api/leagues.ts`, `src/hooks/useFootballSearch.ts` (fans out teams/players/leagues in parallel React Queries + client-side countries), `useFollowedTeams` in `src/hooks/useLeagues.ts`, `leagues-search.tsx`, `country/[name].tsx`, header icon in `(tabs)/leagues.tsx`. Verified `tsc --noEmit` + `manage.py check` clean; **device-unverified**. The pg_trgm player query only runs against Postgres (not exercised by `check`) — worth a live-DB smoke test.

### 6.7 Player/Team Comparison Radar — PAUSED (advanced-stats licensing)

A proposed **MB-style position comparison radar** (from reference screenshots, 2026-07-21): pick a position (GK/CB/FB/CM/FW/ST + team mode) → search & multi-select players/teams → spider chart across ~7 position-specific axes + an 8-column percentile table + a "similar players" nearest-neighbour row. Each position has its **own** axis/column template.

**STATUS: PAUSED — waiting on a reply from licensing before choosing a data source. Do not build until then.** The whole scope hinges on it.

**Why: the reference app runs on a licensed advanced feed (StatsBomb/Opta grade); API-Football provides almost none of its metrics per player.** The **complete** API-Football player-stat field universe (unioned across all 164 synced players — this is the entire toolbox):
```
goals{total,assists,conceded,saves}   passes{total,key,accuracy}
shots{total,on}                        tackles{total,blocks,interceptions}
duels{total,won}  (generic, NO aerial split)   dribbles{attempts,success,past}
fouls{committed,drawn}                 penalty{won,scored,missed,saved,commited}
cards{yellow,red}                      games{minutes,appearances,lineups,rating}
```
**Missing at source (no sync fixes these):** all per-player xG (xA/npxG/npxG+xA/PSxG-GA — API-Football only has team-level match xG), progressive passes/carries ("Carrying"), aerial/def-duel splits, crosses, long balls, pass-length %, ball recoveries, clearances, per-player clean sheets, goals-prevented, cross claims, punches, sweeper actions, "chances created" as a distinct field (`passes.key` is the only proxy).

**Achievability of the user's own trimmed wishlist on API-Football only:** ST 7/9 (miss xG, aerial%), CM 6/8 (miss ball recoveries; chances-created == key passes), DF 4/8 (miss clearances, aerial%, long balls, errors), **GK ~1.5/7** (only distribution accuracy solid; save% is an approximation `saves/(saves+conceded)`, no shots-faced) — GK barely viable, drop or reduced card.

**Two standing constraints even for the achievable metrics:**
- **Percentiles not trustworthy yet:** only ~164 players across ~4–5 (mostly top) clubs synced — real percentiles need full-league squad sync. Until then ship raw per-90 (scaled to max in the compared set) or wait.
- **Sparsity + minutes:** many fields null even within the 164 (backup keepers all-null; interceptions/blocks ~60–80% populated). Any per-90 needs a minutes threshold.

**Data-source options:** (1) license StatsBomb/Opta/Wyscout — only faithful path; (2) Understat — free-ish, adds per-player xG/xA for top-5 leagues, still no progressive/duels/crosses; (3) FBref/StatsBomb open — near-complete but scraping breaks ToS / free comps limited; (4) adapted API-Football-only with reduced templates — ships fast, thinner, no true percentiles yet. **Recommendation: decide the source first (licensing decision, not coding); if option 4, make axis templates config so a richer feed later just swaps the numbers.**

**Option-4 achievable templates (if it comes to that):** ST = Goals/90·Assists/90·Shots/90·Shot acc·Dribbles·Pass acc·Duels won; CM = Key passes·Assists·Pass acc·Duels won·Tackles·Interceptions·Dribbles; DF = Tackles·Interceptions·Blocks·Pass acc·Duels won·Fouls; GK = Save%(approx)·Distribution acc (reduced/omit).

### 6.8 Known gaps — Leagues

- Full player/squad statistics sync (beyond the lightweight bio-only `/players/squads` sync) is scoped to the 5 core leagues first, not yet expanded to all 209 featured leagues — still only 4 teams have full data.
- Player/Team Detail redesign is built and typechecked but **not yet re-tested on a real device**.
- News/Transfers tabs — deferred indefinitely, no data source identified.
- Exact API-Football pricing/plan needs at full production scale (once all 209 leagues need full squad data) — not modeled.
- **`season` labeling convention (confirmed):** Ball/API-Football labels a season by its **end year** — `season=2026` means the 2025/26 season (started Aug 2025, ends 2026). Since the 2026/27 season hasn't started yet, `season=2026` is "the old/last-completed season" that testing and live display both use — this is why the Matches tab's fixture sync (`season=2026`) and its hardcoded `2025-08-15` default view date agree with each other and with `League.current_season`.
- **⚠ Remaining mismatch, not yet resolved:** `TeamStatistics`'s testing sync used `season=2025` (20 Premier League teams) — under the end-year convention above, that's the **2024/25** season, one season **earlier** than the 2025/26 data everything else (Matches tab, `League.current_season`, the Player Match Stats backfill) is built and tested against. This looks like a real leftover mismatch rather than an intentional choice — nothing in the source material flags `TeamStatistics` as deliberately scoped to the prior season. Worth re-syncing `TeamStatistics` under `season=2026` (or confirming the existing `season=2025` rows were actually intentional) before trusting Team Detail's Stats tab to be showing the same season as the rest of the app.

---

## 7. Matches

### 7.1 Matches Tab (list)

`app/(main)/(app)/(tabs)/matches.tsx` — Prev/Next date navigator + matches grouped into a `SectionList` by `league_name` (league logo via `useCoreLeagues`), each section sorted by kickoff time. `MatchRow` (live minute / FT / kickoff time, scores shown when live or finished). Tapping a row navigates to `/(main)/(app)/match/[id]`.

Backend: `MatchListView.get_queryset` supports `date` (`kickoff_time__date`) and `season` query params alongside `league_id`/`status`, ordered by `kickoff_time`.

The default date is hardcoded to `2025-08-15` (a temporary override, since live synced data is for that season — see the flagged `season` inconsistency in Leagues → Known gaps). `season` itself is derived from the selected date via a July-cutoff heuristic (`getSeasonForDate`), so Prev/Next still fetches sensibly across a season boundary. Any function that turns a `Date` back into a plain calendar-day string must stay in local time end-to-end (parse local, format from local `Date` getters) — never round-trip through `.toISOString()`, which converts to UTC and produces an off-by-one day for any timezone east of UTC.

### 7.2 Match Detail Screen

`app/(main)/(app)/match/[id].tsx`. Header: back button, both team crests/names, score or kickoff time.

**Tab set is status-conditional**, recomputed on every render (falls back to the current set's first tab if the previously-selected tab isn't in it — no `useEffect` needed):
- **Pre-match** (`scheduled`): Preview | Lineup | H2H | Odds
- **Post-match** (`finished`/`live`): Facts | Stats | Lineup | H2H

Lineup and H2H appear in both sets. There is no "Overview" tab — it was replaced by Facts.

- **Preview** — no new sync. `GET /api/matches/<id>/preview/`: venue/referee + each team's last-5 finished matches (any competition) with a computed W/D/L result, via a `_team_result()` helper shared with H2H. Frontend: a venue card + each team's form as colored chips.
- **H2H** — no new model, a pure query over already-synced `Match` rows. `GET /api/matches/<id>/h2h/`: up to 10 past finished meetings between the two teams (either home/away order, via `Q`), returns `{team1_wins, draws, team2_wins}`. Frontend: a proportional win/draw/loss bar + a list of past meetings.
- **Odds** — `MatchOdds` model (`OneToOneField` to `Match`, raw JSON payload). `GET /api/matches/<id>/odds/` (404 if not synced). Frontend filters `bookmakers[0].bets` to bet IDs `1`/`8`/`5` (Match Winner / Both Teams Score / Goals Over-Under), rendered as value/odd chip cards. **`sync_odds_for_match(match_id)` has no automatic trigger anywhere** — no Celery Beat entry, no view triggers it lazily on GET. If nobody has manually run it for a given match, Odds shows "not yet available" indefinitely, even inside API-Football's ~7-day retention window. This is a real, unresolved product gap, not by design.
- **Lineup** — `MatchLineup` model, `sync_lineup_for_match(match_id)`, `GET /api/matches/<id>/lineup/` (404 gracefully if absent). **Is** wired into the automatic finish-hook (see 7.3) — any match that finished before that wiring was added needs manual backfill. Remains queryable indefinitely after a match finishes (not time-limited the way Odds is), though it's only populated by API-Football ~30-60 min before kickoff. Frontend: one shared pitch (not two separate mini-pitches) — home team from their own goal down to attackers, a halfway-line marker, away team mirrored below (attackers closest to the line, GK last). Each player chip: real photo (joined client-side via `useTeamSquad(teamId)` matched by API-Football's numeric player ID, confirmed to share the same ID space as lineup/player-stats/squad data), a colored rating badge (green ≥7 / amber <7 / blue+star reserved for the single highest-rated player across both teams, not a numeric threshold), a red circle+minute for anyone subbed off (matched by team+player name against `MatchEvent`, since events carry no player FK). Substitutes list + coach name below.
- **Facts** (post-match) — a two-column, reverse-chronological feed: FT at top, most recent events first, an HT divider at the 45'/46' boundary, kickoff at the bottom. Home team's events render left-aligned, away team's right-aligned, minute pinned to the outer screen edge. Goals show a running score (`(2-0)`) computed client-side, excluding missed penalties from the tally (`detail` containing `"Missed"` is treated as non-scoring — API-Football files missed penalties under the same `"Goal"` event type, distinguished only by `detail`). Substitutions render a green "in" arrow stacked over a red "out" arrow (`player` = who went off, `assist` = who came on, for `subst`-type events — confirmed against API-Football's documented schema).
- **Stats** (post-match) — parses `MatchOdds`-style flat `{type, value}` arrays into Shots/General/Passes/Advanced sections plus a Ball Possession bar. Exact `type` strings (`"Shots insidebox"`, `"Passes %"`, `"expected_goals"` as a snake_case outlier among otherwise Title Case types) were verified against real synced data before hardcoding.
- **Player of the Match / ratings** — `GET /api/matches/<id>/player-stats/` (`MatchPlayerStatsView`, full `PlayerMatchStat` rows for both teams). Highest-rated player is computed **client-side** (Postgres sorts `NULL` first on `ORDER BY ... DESC` for the nullable string `rating` field, which silently breaks the naive server-side version of this query).

**`MatchEvent` model:** `player`/`team` are plain strings, no player FK. `assist_player` field captures who came ON for a `subst`-type event (`player` = who went off). `sync_match_events` uses `update_or_create` (not `get_or_create` — the latter's `defaults` only apply on row creation, which would silently leave `assist_player` null forever on any re-run against already-existing rows).

**`src/lib/teamColors.ts`** — curated real club brand colors keyed by **exact** team-name strings as stored in Ball's own DB (several assumed names were wrong — it's `"Inter"` not `"Inter Milan"`, `"AS Roma"` not `"Roma"`, `"Tottenham"` not `"Tottenham Hotspur"`). Falls back to a deterministic hash-based color for anything unmapped.

**Known gaps:** Odds has no automatic sync path (above). Substitution arrow direction and the team-color palette are confirmed via docs/DB respectively but not yet visually confirmed on a real device beyond Liverpool/Bournemouth. The shared-pitch layout's spacing/proportions at real screen sizes are unconfirmed on-device.

### 7.3 Sync Architecture (event-driven)

**Automatic, event-driven — `check_for_finished_matches`** (`matches/tasks.py`, Celery Beat `crontab(minute='*/3')`, defined in `ball/settings.py::CELERY_BEAT_SCHEDULE`) — the only periodic task touching individual matches. Every 3 minutes: finds `Match` rows with `kickoff_time` in the last 3 hours still marked `scheduled`/`live`, re-fetches live status from API-Football, updates `status`/`status_short`/`minute`/scores. The moment a match first flips to `finished`, it synchronously (not `.delay()` — cheap, per-match) runs, in this exact order:
1. `sync_player_stats_for_match(match_id)` — per-player stats (`PlayerMatchStat`, includes `rating`).
2. `sync_match_statistics(match_id)` — team-level stats into `Match.live_stats` (reuses an existing field rather than a new model).
3. `sync_match_events(match_id)` — goals/cards/subs into `MatchEvent` (includes `assist_player`).
4. `sync_lineup_for_match(match_id)`.

Separately, keyed off the same newly-finished-match detection: `resync_league_after_match.delay(league_id, season)` fires as an **async** Celery task per distinct league+season that had a match finish (deduplicated, so a full round finishing together only costs one resync per league). Internally runs `sync_standings_for_league` + `sync_player_stats_for_league` (`leagues/tasks.py`).

`sync_all_featured_standings` (the original bulk sync) is demoted to a **daily 4am safety net** (`crontab(hour=4, minute=0)`), catching anything the event-driven system missed (e.g. Celery downtime during a match).

**Manual/on-demand only, no automatic trigger:** `sync_odds_for_match(match_id)` (see 7.2's Odds gap).

**Manual, bulk, view-triggered:** `SyncFixturesView` (`POST /api/matches/fixtures/sync/`) — takes `league_id`+`season`, pulls every fixture for that league/season from API-Football, `update_or_create`s each into `Match`. This is the **only** way `Match` rows get created; nothing else does.

**Data-window constraints** (a `Match` existing doesn't mean everything about it is synced):

| Sync | Window | Consequence if outside it |
|---|---|---|
| `sync_odds_for_match` | ~7 days before kickoff (API-Football retention) | "No odds available" — and since nothing auto-triggers this, almost nothing has odds populated right now |
| `sync_lineup_for_match` | Posted ~30-60 min before kickoff; remains queryable indefinitely after the match finishes | Empty until that window opens; not time-limited post-finish |
| `sync_match_statistics` / `sync_match_events` / `sync_player_stats_for_match` | Match must be `finished` (or have live data) | Empty for `scheduled` matches; automatic once the hook detects the finish |

**Infrastructure:** Celery + Celery Beat + `django-celery-beat` (DB-backed schedule) + Redis (Memurai) as broker. **Windows-specific:** the worker must run with `--pool=solo` (Windows lacks the process-forking model Celery's default pool needs).

**Known follow-up:** an automatic trigger for `sync_odds_for_match` (e.g. a Celery Beat entry scanning upcoming fixtures in the 7-day window) is needed before Odds works for real users rather than only manually-backfilled test matches.

---

## 8. Live Match & Real-Time Infrastructure

**WebSocket auth (Channels).** Ball's HTTP API is JWT-only (SimpleJWT bearer tokens), but Django Channels' default `AuthMiddlewareStack` only authenticates via session cookies — React Native's `WebSocket` cannot set custom headers, so every mobile WS connection resolved to `AnonymousUser`. `ball/ws_auth.py::JWTAuthMiddleware` reads a short-lived **access** token (never refresh — query strings can land in proxy/access logs) from `?token=` on the query string, validates it via SimpleJWT, sets `scope['user']`. Wrapped **inside** `AuthMiddlewareStack` in `ball/asgi.py` (`AuthMiddlewareStack(JWTAuthMiddleware(URLRouter(chat.routing + matches.routing)))`) so session auth still works for browser/testing, and the token takes precedence when present. Fails closed: an absent/invalid/expired token leaves the connection as `AnonymousUser`, so each consumer's `is_authenticated` guard rejects it.

This single middleware fixes the identical latent bug in **both** `MatchConsumer` and `ChatConsumer` — both consumers use the same `scope['user']` + `is_authenticated` guard pattern, and neither had a JWT workaround before this middleware existed.

**Live match events — `sync_live_match_events`** (Celery Beat, ~60s interval, distinct from `check_for_finished_matches`'s 3-minute cycle): scans `status='live'` matches, pulls the current event list per match, diffs against stored `MatchEvent` rows via the same `_sync_events_core` the finish-hook uses, creates whatever's new. Each new event fans out two ways:
- **WebSocket broadcast** into the match's existing `MatchRoom` Channels group (`match_{id}`, via `broadcast_match_event`) — the Live Match view is just another subscriber to a group that already exists for chat, no new WS infrastructure needed.
- **Notification fan-out** — a separate async Celery task (`fan_out_match_event_notification.delay`), so one popular match's fan-out doesn't block the poller from moving to the next live match. Full-time fan-out is wired into `check_for_finished_matches` itself.

**Recipients:** followers of either team playing, via `UserTeamFollow` (⚠ **now `team` FK → `teams.Team`** as of 2026-07-22 — the whole app was migrated off the old denormalized `team_id`/`team_name`/`team_logo` convention; `team_id` still works everywhere as the FK's attname, and API response shapes are unchanged — see §16). Endpoints: `/api/leagues/teams/<id>/follow/`, `/api/leagues/teams/following/`, and `/api/leagues/teams/search/?q=` (`TeamSearchView` — `teams.Team`-sourced, see §5.1).

**Granularity:** everything — goals, cards, subs, full-time. No filtering/muting (a notification-preferences toggle is the obvious pressure valve for a high-profile match with a large combined following, but isn't built).

**Frontend** — `useMatchSocket` (WS with `?token=`, receive-only) + `LiveMatchPanel`, injected into `match/[id].tsx` when `status === 'live'` (inside Match Detail's existing live state — **not** a 6th bottom tab; a "browse currently-live matches" discovery screen is a separate, smaller feature to consider later). Real-time score + live event feed.

**MatchRoom chat surface** — Match Detail's header has a **Chat** button that calls `GET /api/matches/<pk>/room/` (`MatchRoomView`: lazily creates the room via the same `ensure_match_room` the scheduled→live hook uses, and auto-joins the requester so the chat WS membership guard passes immediately) and opens the returned conversation in the shared `ChatThread` screen — the same component chat and community channels use, so human messages and system `goal_event` messages render there with no dedicated match-chat UI.

**`MatchRoom` (`Match` ↔ `Conversation`) auto-creation — built.** `matches/services.py::ensure_match_room(match)` creates the room (and its backing `Conversation`: `channel`/`open`/public, named "Home vs Away", system-created with `created_by=None`) idempotently. Wired into `check_for_finished_matches` at the `scheduled → live` transition, mirroring how the Feed recap post is created at `live → finished`; guarded so a chat-side failure can't break match syncing. The `goal_event` path (below) also calls it defensively, so a missing room self-heals.

**`goal_event` chat message type — built.** Scoped to goals only (not cards/subs/FT, which already have full coverage via notifications) — keeps `MatchRoom` from getting cluttered with lower-signal events. A third consumer of the live-event pipeline: when `sync_live_match_events` detects a new `event_type='goal'`, `matches/tasks.py::create_goal_event_message` creates a `Message` (`message_type='goal_event'`, authored by the system account `ball`) in that match's `MatchRoom.conversation` — content "⚽ scorer (team) minute'", metadata carrying scorer/team/minute/assist/current score — and broadcasts it into the room's `chat_{conversation_id}` group in the same shape as a normal send, so connected clients see it live. Missed penalties (`detail` containing "Missed" — API-Football files them under the Goal event type) are skipped, consistent with the Facts tab and recap scorer list.

**Known gaps:**
- `sync_live_match_events` is verified structurally only — the event-upsert core is shared with the finish-hook's proven code path, but the full live loop has never run against a real `status='live'` API-Football fixture with events posting in real time.
- The RN client's `?token=` WS handshake is verified server-side (`JWTAuthMiddleware` unit-tested for valid/absent/garbage tokens) but untested against a running server from the actual app.
- Whether the production WS proxy logs full query strings (and therefore the access token) is unconfirmed — dev (`runserver`/`daphne`) doesn't persist WS query strings by default, but this isn't set in the repo for production. Keep the access-token TTL short (currently 60 min) and don't log full WS query strings in whatever proxy config ships.

---

## 9. Feed

### 9.1 Post Types

Current live `post_type` choices: `text`, `match_object`, `poll` (enum value retained for future use — no `Poll` model or voting UI currently exists, see 9.4), `winnie_insight`.

### 9.2 match_object Posts

A single `match_object` `Post` is created **once, at full-time**, containing just the final score and goal-scorer names — nothing updates after creation. It's positioned by finish timestamp and sorts normally forever after. Content isn't stored separately on the `Post`: final score reads off `Match.home_score`/`away_score`, scorer names off `MatchEvent` rows filtered to goals (excluding missed penalties), both already populated by `check_for_finished_matches` by the time it detects the finish. `feed/services.py::create_match_recap_post` is idempotent (keyed on system-author + match) and rides the existing finish-hook — no new sync infrastructure for Feed itself.

*(Two alternative designs were considered and rejected before landing here — live per-event auto-posting, and one "living" card updating in place via WebSocket. See `SESSION_LOG.md` for why.)*

**Authorship:** a single global system account, username `ball` (`get_system_user`, auto-created), not a per-league account.

**`winnie_insight` posts:** user-share only — a user shares a Winnie prediction card into their feed manually. Nothing auto-creates these. They currently get no special server payload beyond content — they render as text + a Winnie badge on the frontend, no shared prediction card UI yet.

**`Post.match` is a real `ForeignKey('matches.Match')`** (converted from a plain `IntegerField`; the `match_id` API key is preserved via serializer source-mapping). `PostSerializer.get_match_card` derives `goal_scorers` at serialization time from the linked `Match` + its goal `MatchEvent` rows.

**Following-feed distribution of system recap posts:** `FeedView.get_queryset` (`feed/views.py`) is a single OR-filtered, deduped queryset (not `.union()`, which fights ordering/slicing), preserving `-created_at` ordering:

```
Following = Q(author_id__in=<followed user ids>)
          | Q(author__username='ball', post_type='match_object',
              match__league_id__in=<viewer's UserLeagueFollow league_ids>)
```

Filters by `author__username='ball'` directly — deliberately does **not** call `get_system_user()` in the read path (no get-or-create write on every feed load); if the system user doesn't exist yet, that branch simply matches nothing. A viewer following no leagues collapses this to exactly "posts from followed users."

### 9.3 Feed Shape & Discovery (For You)

Two tabs, X-style: **Following** (people you follow, plus the system-recap union above, reverse-chronological) and **For You** (discovery-mixed). Both sort by the same underlying principle — reverse-chronological for Following, a weighted recency-decayed score for For You.

**For You is a full blend** — affinity + trending + social proof — built as three narrow candidate pools merged per request rather than a per-viewer score against every post:
- **Affinity pool** — recent posts matching the viewer's followed leagues/teams. Cheap, indexed, computed at request time. Graded, not binary: `1.0` team match, `0.6` league-only match, `0` otherwise.
- **Trending pool** — global, identical for every viewer, computed **once**: `feed/tasks.py::compute_trending` (Celery Beat, every 20 minutes) scores recent posts by engagement velocity, caches the top N in Redis (DB 1 — required because `LocMemCache` can't be shared across the web + Celery processes). Request time just reads the cache. Velocity weights: `REPOST 3.0 > COMMENT 1.5 > REACTION 1.0` (a repost is a stronger signal — active distribution vs. passive acknowledgment).
- **Social-proof pool** — "what did the accounts I follow engage with recently" (one indexed query, bounded by the viewer's own follow-list size, not the size of the post corpus) rather than a graph intersection against the whole post set. Counts both `Reaction` rows and reposts (`Post.repost_of`) by a followed account as two sources, not one.

Merged and scored with a single weighted formula (a single named config, `feed/scoring.py::DiscoveryConfig`, so weights are adjustable without touching scoring logic — no A/B infra exists to tune them yet, these are placeholder constants):

```
score = recency_decay(post.created_at) × (w1·affinity + w2·trending + w3·social_proof)
```

`recency_decay` is an exponential half-life, short (low tens-of-hours) — football content ages fast. `trending` is log-normalized to 0-1. `social_proof` is capped (`min(count/3, 1.0)`). Cold-start falls out of the design for free: a zero-follow user has empty affinity and social-proof pools by construction, so their For You is just the trending pool.

**For You pagination is a per-user frozen snapshot, not live-rescored pages.** Plain offset pagination against live-recomputed scores was tried first and rejected — a post's score shifting between page requests can move it across a page boundary mid-scroll, producing visible duplicate/skipped posts, not just "minor drift." Current design: on first load or pull-to-refresh (`offset == 0`), `GlobalFeedView` computes the ranked candidate pool once and caches the **ordered post-id list** in Redis (`feed:foryou:frozen:{user_id}`, `FORYOU_FROZEN_TTL = 600s` — 10 minutes, chosen because the trending job itself only recomputes every 15-30 minutes, so a shorter TTL bought no real freshness). Subsequent offset pages slice that frozen list and hydrate posts in frozen order — no per-page rescoring. Regenerated on TTL expiry or on pull-to-refresh (`offset == 0` always rebuilds). Per-user, on-demand — **not** a scheduled precompute-for-everyone job. Accepted boundary case: if the TTL expires mid-scroll, the next page rebuilds and slices the new order at that offset — a rare, one-time seam inherent to any TTL-based freeze.

**Following pagination:** DRF `CursorPagination` on `(created_at, id)` (`FollowingCursorPagination`, `page_size=20`) — matches the stable reverse-chronological ordering this tab already has; `id` tie-breaks same-timestamp posts.

Both pagination schemes replaced an earlier hardcoded 100-item cap on For You, which is now removed entirely.

### 9.4 Engagement Model

**Reactions, not a plain Like.** `Reaction` (4 types: `goal`/`hot_take`/`smart`/`terrible`) is the live engagement primitive — richer than a plain like/join, and deliberately kept as-is rather than adding a separate `Like` model alongside it or replacing it. Any `Reaction` row, regardless of type, is treated as **the** engagement/social-proof signal for Discovery scoring. Frontend UX: long-press tapback picker (haptics), not a persistent 4-icon row.

**Comments — threaded.** Self-referencing `parent` FK on `Comment` (nullable; null = top-level). A thread is fetched in **one flat query** (all comments for a post) and the tree is built in application code (`_build_comment_tree`, standard adjacency-list pattern) — avoids recursive SQL. Frontend renders it client-side from the API's flat payload.

**Reposts — both plain and quote-repost, via one mechanism.** A repost is a new `Post` row with a `repost_of` FK to the original — this means reposts automatically flow through the same Following/For You machinery with zero new distribution logic. Quote-repost isn't a separate model/field: same row, non-empty `content` (the same field a plain user post uses). Empty `content` + `repost_of` set = plain repost; both set = quote-repost. **Reposting a repost resolves `repost_of` to the original source post**, not a chain (matches X/Instagram behavior, avoids nested-attribution mess). Frontend: `repost_of` comes back as a bare pk, the quoted/original post is fetched lazily by id and embedded; plain reposts render "@user reposted" over the fully-interactive original.

**Poll — removed.** `Poll`/`PollOption`/`PollVote` existed live with a vote endpoint at one point but had **zero rows** at every point they were checked (the feed was empty). Removed cleanly (models, `PollVoteView`, poll serializers, vote route all gone) — the `'poll'` `post_type` enum value was deliberately kept for future use. No `feed_poll*` tables remain in Postgres.

**Known gaps:**
- Comment-reply notifications — not built, explicitly deferred (a new notification category beyond match-event scope).
- Media multiplicity enforcement (see 9.5's "4 photos OR 1 video" rule) — `PostMedia` currently allows unbounded media per post, not enforced at model/API level.

### 9.5 Media Pipeline (Photo + Video)

**Two vendors, deliberately** — Mux for video, S3 + Pillow for photos, not a single unified vendor. Mux's basic-quality tier encodes for free with 6,000 free delivery minutes/month, explicitly positioned for social/UGC use cases. (Cloudinary's free tier was checked and rejected — weak on video specifically, and would put photo/video in competition for the same limited credit pool.)

**Video upload flow:**
1. Mobile app requests an upload credential from `POST /api/feed/media/upload-url/`.
2. Phone uploads **directly to Mux**, not through Django — Django never handles raw video bytes.
3. Mux transcodes asynchronously, fires a webhook back to Ball with a playback URL + thumbnail when ready.
4. The webhook flips the post from a **processing** state to ready. A post with attached video is not immediately visible/complete the instant it's created — the app shows a processing state (frontend: TanStack `refetchInterval` polling the post only while `media_state === 'processing'`, no dedicated WS) in the meantime.

**Photo upload:** direct-to-S3 presigned PUT, consistent with the "no raw bytes through Django" principle established for video. Pillow (`finalize_photo`) runs server-side only in the post-upload finalize step. **This same S3 + Pillow flow also backs profile avatar/banner uploads** (see §5.1) — `create_s3_presigned_upload` takes a `prefix` for the key namespace, and `finalize_profile_image` adds a cover-crop/resize step on top of the same validate-with-Pillow finalize. One pipeline, two call sites.

**Data model:** a separate `PostMedia` model (not dedicated `Post` fields) — chosen because single-vs-multiple media per post is still undecided, and a FK'd model supports 0..N media without future schema churn while keeping Mux/S3-specific fields off the `Post` row.

**Mux integration:** plain `requests` calls, deliberately no SDK (matches the `api_football_client` pattern). Uses `new_asset_settings.video_quality: 'basic'` (Mux's current field naming, not the deprecated `encoding_tier: 'baseline'` — Mux renamed this in 2024 and recommends the new field for anything without a legacy constraint). Webhook signature verified via HMAC-SHA256. `PostMedia` is matched to the asset by `data.upload_id` on the `video.asset.ready` event.

**Video duration cap: 140 seconds** (`MUX_MAX_VIDEO_DURATION`, env-overridable) — matches X's own standard-upload limit, generous for the goal-replay/reaction use case Ball actually has; enforced in the Mux webhook (over-cap → `PostMedia` status `'failed'`).

**Config:** all Mux/AWS credentials are optional `os.getenv` reads → the relevant endpoints 503 when unconfigured, rather than crashing.

**Known gaps (unverified against live external services, no credentials in the build/dev environment used so far):**
- Mux: never tested against the live Mux API. The `upload_id`/`video.asset.ready` webhook-matching logic is derived from Mux's documented schema, not a confirmed real response.
- S3: presigned-PUT + `finalize_photo` untested against a real bucket; guard paths (missing config → 503) are verified.
- Single vs. multiple media per post, and enforcement of the "4 photos OR 1 video" rule — undecided/unbuilt (see 9.4).

### 9.6 Known gaps — Feed (cross-cutting)

- `winnie_insight` posts render as text + a badge only — no shared prediction-card UI yet.
- Discovery's trending/social-proof weighting for reposts is applied (9.3) — this was flagged as a required follow-up earlier in the project and has since been closed.

---

## 10. Search

**Entry point:** an icon in Feed's header, not a bottom tab (see Navigation).

**Scope note — this is Ball's *social* search** (posts / people / hashtags / matches / media). The Leagues tab has a **separate, deliberately distinct football-entity search** (teams / players / leagues / countries) — see **6.6**. Two different products, two different surfaces; don't conflate them or try to merge them.

**Mechanism:** Postgres full-text search (`tsvector`/`tsquery`, `SearchVector`/`SearchQuery` websearch mode) for Post/People, plus `pg_trgm` (`TrigramSimilarity`) for fuzzy/prefix matching on Match team/league names — deliberately not a dedicated search engine (Elasticsearch/Meilisearch/Algolia). `django.contrib.postgres` is in `INSTALLED_APPS`; the `pg_trgm` extension is enabled via migration.

**Five tabs**, each a filter/sort over sources that already exist (no tab introduces a new data source):

| Tab | Source | Behavior |
|---|---|---|
| **Top** | Post (text-matched) + Match + User | Mixed results, ranked via the **same Discovery formula** as Feed's For You (`scoring.rank_posts`), applied to the text-matched candidate pool instead of the affinity/follow-based one |
| **Latest** | Same Post candidate pool as Top | Plain reverse-chronological, no ranking |
| **People** | `User` | Text search only |
| **Matches** | `Match` | Text search against team/league names, rendered as cards (same rendering as `match_object` posts); returns **upcoming + past mixed**, ordered by trigram similarity then kickoff time |
| **Media** | Post (text-matched) | Filtered to posts with attached media |

Post ranking on the Top tab is reuse, not new work — a change to the scoring formula affects Discovery and Search simultaneously.

**Trends — hashtags only**, not freeform keyword/topic mining. No dedicated `Hashtag` model — extraction is folded into the same `compute_trending` Celery job Feed already runs for trending scores (`_compute_trending_hashtags`, a regex pass over the same in-memory recent-post scan the job already holds — no new I/O, schedule, or model). Output: a cached top-N hashtag list with counts, case-folded, per-post deduped. Tapping a trend re-runs the same Postgres FTS search (`#klopp` matches as text like any other query); hashtag autocomplete suggestions pull from the same cached list.

**Autocomplete — a separate, cheaper endpoint**, not a lighter version of the full search pipeline (running the ranked-search pipeline on every keystroke would be a real performance problem). `AutocompleteView`: `pg_trgm`-indexed username prefix matching (`istartswith` + trigram order) + prefix filter over the cached trending-hashtag list; an empty query returns top trending hashtags (doubles as the Trends surface — zero new endpoint needed for that). Debounce/min-character threshold is **not enforced server-side** — treated as a client responsibility, the endpoint answers any prefix length.

**Frontend:** `search.tsx` — header search, debounced typeahead (users + hashtags), the 5 tabs reusing `PostCard`, a Trends empty-state (top hashtags), tap-a-tag → search.

**Known gaps:**
- Debounce timing / minimum-character threshold for autocomplete — not specified anywhere, purely a client-side default.
- Whether hashtags are tappable/rendered specially inside a post's own display (not just inside Trends) — undecided.
- Search history (recent searches saved per user) — not built.
- Pagination for the five result tabs beyond Top/Latest's shared Post pool — not explicitly addressed; Feed's own pagination work (see Feed) doesn't necessarily cover Search's other tabs.

---

## 11. Notifications (the "Activity" tab)

**Tab shape.** The 5th bottom tab is titled **Activity** and is segmented (same control as Chat's Chats/Communities): **Notifications** (the list described below, unchanged) and **People** (follow discovery). Route file remains `(tabs)/notifications.tsx`; the existing list was extracted verbatim into a `NotificationsSegment`, with a new `PeopleSegment` beside it.

### 11.1 People segment (follow discovery — no new models)

New queries over existing data; blocked users (either direction) excluded everywhere. Two backend endpoints in the users app:
- `GET /api/users/activity/followers/` (`NewFollowersView`) — people who follow the viewer but the viewer doesn't follow back (blocked excluded). Rendered with a **Follow-Back** action; Ball's Follow is one-way and instant — no accept/reject.
- `GET /api/users/activity/suggestions/` (`SuggestedPeopleView`) — three parallel candidate sources, merged/deduped (same shape as Discovery's 36.6 candidate pools, pointed at people): **interaction** (`Reaction`/`Comment`, both directions), **mutual_follows** (friend-of-friend over `Follow`), **groups_in_common** (shared `CommunityMembership` + `chat.Membership` group chats). Each candidate carries priority-ordered reason chips `{type, count}` (mutual_follows → groups_in_common → interaction) for the frontend badge ("12 mutual follows", "In 2 groups together"). Excludes self / already-followed / blocked. **No weighted ranking in v1** — ordered by summed signal, capped at 30.

Frontend: `src/api/people.ts` + `src/hooks/usePeople.ts`; the People segment lists New Followers (Follow-Back) then Suggested (Follow + reason chip). Each row deep-links to the profile and has a **client-side-only** dismiss (✕) — v1 dismissals don't persist across restarts (deliberate). **Contact-sync ("Find friends" from phone contacts) is explicitly out of scope** and unbuilt; nothing was added toward it (though `User.phone_hash` already exists from OTP auth if it's ever picked up).

### 11.2 Notifications list

**`Notification` model** — 12 types total: the original 10 (including `follow`/`reply`/`repost`/`mention`, broader than pure match-event scope) plus `'card'` and `'substitution'` added for live match events. Full-time events reuse the existing `'match_result'` type rather than adding a 13th.

**Push delivery — Expo, not direct FCM/APNs.** Researched current pricing/positioning before deciding: Expo's push service is free for delivery at any tier and is explicitly positioned by Expo as the default path; direct-to-FCM/APNs is for teams needing finer control than Expo's abstraction provides, which isn't a stated need here. `ExpoPushToken` is the live model for this. `FCMToken` (raw FCM/APNs device tokens) still exists in the schema but is effectively legacy — confirmed nothing currently reads from it for delivery, kept rather than removed.

**Recipients & granularity, delivery mechanism:** see Live Match & Real-Time Infrastructure (the notification fan-out is one of two consumers of `sync_live_match_events`, alongside the WS broadcast).

**Frontend:** `useRegisterPushToken` (permission → Expo token → register, fully defensive — no-op if `Constants`' EAS `projectId` is absent, e.g. no build config). Notification list rendering each of the 12 types distinctly (`notificationMeta`), tap → mark-read + navigate.

**Expo Go boot crash — fixed.** Importing `expo-notifications` at all (even just the static top-level `import`) runs a push auto-registration side effect at **module-import time**, which throws in Expo Go (remote push was removed from Expo Go in SDK 53) — before any try/catch in `useRegisterPushToken` can run. Fixed by detecting Expo Go (`Constants.executionEnvironment === ExecutionEnvironment.StoreClient`) and, when true, early-returning **before** ever importing the module — loading `expo-notifications` via a dynamic `import()` inside the effect instead of a static top-level import, so the throwing side effect never evaluates in Expo Go. Push still works in a dev/production build; the in-app (polled) notification list was never affected by this bug.

**Known gaps:**
- Notification muting/preferences — not built, flagged as an eventual need given the "everything, to every team follower" granularity.
- Comment-reply notifications — not built (see Feed → Engagement).
- Push has never actually been sent to a real device (token lookup + no-op path verified only).

---

## 12. Chat

**Models** (`chat/models.py`):
- `Conversation` — `conversation_type` (`direct`/`group`/`channel`), `channel_mode` (`open`/`broadcast`, nullable), `name`, `description`, `avatar`, `participants` (M2M through `Membership`), `created_by`, `is_public`, timestamps.
- `Membership` — `user`, `conversation`, `role` (`admin`/`member`), `joined_at`, `last_read_at` (the member's read cursor — see Read receipts below).
- `Message` — `conversation`, `sender`, `content`, `message_type` (`text`/`match_card`/`prediction_card`/`poll`/`goal_event`), `match_id`, `metadata` (JSON), `is_read` (**deprecated** — superseded by `Membership.last_read_at`; no longer written, kept only so historical rows don't need a destructive migration), `created_at`.
- `MessagePollVote` — `user`, `message`, `option_index`, unique per (user, message). Deliberately lean — not a revival of Feed's removed Poll system.
- `PinnedMessage` — `conversation`, `message`, `pinned_by`, `pinned_at`, unique per (conversation, message). Position of the floating pin cards is **never** stored here — it's a per-user, client-side concern (see Pinned messages).

**Creation validation** (`ConversationCreateSerializer`): `is_public` may only be `True` for `channel` (rejected for `direct`/`group` — closes the bug class where a "private" group could secretly be flagged public). `group` requires ≥2 total participants (creator + at least one other). `group`/`channel` require a non-empty `name`; `direct` doesn't (the other participant is the name). `channel_mode` **stays nullable at the DB level — deliberately no migration/backfill**: only `'broadcast'` has ever had enforcement logic, and `None`/`'open'` are functionally identical; instead the serializer writes `'open'` explicitly when a channel's creator doesn't specify a mode, so new rows are self-documenting.

**DM permission:** for `conversation_type='direct'`, exactly one `participant_id`, and either **mutual contacts** (`are_mutual_contacts`, inherently two-way) **or mutual follow** — both `Follow(you→them)` and `Follow(them→you)` must exist; a one-way follow is not sufficient. If a direct conversation between the two already exists, `create()` returns it rather than duplicating.

**Typed messages.** Validation for all typed messages lives in one shared helper — `chat/validators.py::validate_message_payload` — used by **both** the REST serializer and the WS consumer's save path, so the two can't drift:
- `match_card` — `match_id` required and must reference a real `Match` (`validate_match_id`). Rendered via `MessageSerializer.get_match_card` (`MatchCardSerializer`).
- `prediction_card` — `match_id` required, must reference a real `Match`, **and** that match must have a non-null `winnie_prediction` (a prediction card with nothing to render is rejected). Rendered via `get_prediction_card` → `{match: <MatchCard>, prediction: <winnie_prediction JSON>}`, pulled live at serialization, not snapshotted.
- `poll` — `metadata.options` must be a list of ≥2 non-empty strings. Voting: `POST /api/chat/messages/<pk>/poll/vote/` with `option_index` (participant-only; out-of-range rejected; re-voting updates the row via `update_or_create`, never duplicates). Rendered via `get_poll` → `{options, counts, total_votes, user_vote}`, counts computed live — same pattern as Communities' voting.
- `goal_event` — system-created only, from the live-event pipeline (see Live Match & Real-Time Infrastructure).

**Match rooms are a restricted surface.** A conversation linked to a `matches.MatchRoom` (surfaced to the client as `Conversation.is_match_room`) accepts **only** `text` (user-sent) and `goal_event` (system-sent) — polls and shared cards are rejected on both the REST and WS paths (the shared `validate_message_payload` takes the conversation and enforces this before any type-specific rule). Match rooms also **cannot have pinned messages** at all. Regular groups/channels/DMs are unrestricted. The client hides the poll/pin affordances in match rooms, but the backend enforces regardless.

**Pinned messages** (`PinnedMessage`). Max **5 per conversation**, enforced at creation — the 6th pin is rejected with a clear error, nothing is auto-unpinned. Permission (same rule for pin and unpin — whoever may pin may unpin, including removing someone else's pin): **match room** → nobody; **channel** → admins only; **direct/group** → any member. Endpoints: `POST`/`DELETE /api/chat/<pk>/messages/<message_pk>/pin/`, `GET /api/chat/<pk>/pinned/` (participant-only visibility). The list serializer nests the full message, so a pinned `match_card`'s live fields (score/status) re-serialize on each fetch — that's what lets a periodically-refetched pinned card update.

**Endpoints** (`/api/chat/`): list/create conversations, retrieve one, leave, list/send messages, **get a single message** (`<pk>/messages/<message_pk>/`, participant-only — lets the client patch one card/poll into its cached thread instead of refetching the list), poll vote, kick (`<pk>/members/<user_id>/kick/`), promote (`.../promote/`), pin/unpin/list-pinned, list public channels, join a public channel.

**Note on `MessageSerializer`:** `conversation` is read-only (server-set via `save()`); it was previously a writable required field, which 400'd every REST send that didn't include it — latent because sends go over the WS, not the REST `send/` endpoint.

**Moderation (minimal, admin-only):** kick (deletes another member's `Membership`; self-kick rejected — use leave) and promote (sets `role='admin'`). No ban, no audit log, no demote — deliberately out of scope. **A channel-admin kick is channel-scoped**: kicking someone from a community's companion channel does not remove them from the community — channel admins hold no community authority (roles aren't synced across the link, so neither is role-derived power). Only community-moderator kicks cascade the other way (see Communities → Membership sync).

**Read receipts:** `Membership.last_read_at` is advanced to now whenever the member lists a conversation's messages (`MessageListView`). `unread_count` on `ConversationSerializer` counts others' messages newer than the viewer's cursor — works uniformly for DMs and groups, unlike the deprecated `Message.is_read`.

**WebSocket (`ChatConsumer`):** one room group per conversation (`chat_{id}`). Rejects unauthenticated or non-member connections. `receive()` **strictly type-dispatches** — every payload must carry an explicit event `type`, exactly two are accepted:
- `{'type': 'typing', 'is_typing': bool}` — relayed to the group as an ephemeral `typing_indicator` event (never persisted; clients filter their own `user_id` and auto-expire after a few seconds of silence).
- `{'type': 'message', 'message_type': 'text'|…, 'content', 'match_id', 'metadata'}` — a message send; `message_type` defaults to `'text'` and must be one of the model's defined choices (out-of-choices values are rejected in the consumer — Django doesn't enforce `choices` at the DB level and `.create()` skips model validation, so without this check an unknown type would persist as a junk row; the REST path gets the same protection from DRF's `ChoiceField`).

Anything else — missing/unknown `type`, malformed JSON — gets an `{'error': ...}` frame back and is dropped, never persisted. **There is no implicit-message fallback**: the pre-dispatch contract (where `'type'` carried the message type directly) was removed before any chat client existed (verified at removal time — the only WS client then was the receive-only `useMatchSocket`, so nothing ever depended on the old shape). `useChatSocket` — the client built against this contract — sends only the two shapes above. Sends run through the shared validator; failures come back with the specific reason. Broadcast-channel sends remain gated to admins. Auth: see Live Match & Real-Time Infrastructure — the same `JWTAuthMiddleware` used by `MatchConsumer` covers chat.

**Known gaps:**
- `admin.py` has no model registration.
- No restriction on who may set `channel_mode='broadcast'` at creation (any authenticated user can create a broadcast channel — the gate is on posting into it, not creating it).

**Frontend (built, typecheck-verified, not yet device-verified):** `src/api/chat.ts` + `src/hooks/useChat.ts` (TanStack Query over every chat endpoint), `src/hooks/useChatSocket.ts` (the app's first **bidirectional** WS hook — same `?token=` JWT pattern as `useMatchSocket`, but it sends: exactly the strict `{type: 'typing'|'message', ...}` contract, with backend `{error}` frames surfaced via a dismissible banner rather than assumed-success), `src/components/chat/MessageBubble.tsx` (five distinct render treatments — text bubble; tappable live match card; match-plus-Winnie prediction card; inline poll with vote bars, re-vote, and live counts; and a centered system card for `goal_event` with no reply affordance), `src/components/chat/ChatThread.tsx` (reusable thread: REST history merged with live WS messages, typing indicator with 4s auto-expiry, composer with typing throttle + in-chat poll creation, broadcast-channel composer gating, plus long-press-to-pin and the pinned overlay), `app/(main)/(app)/chat/[id].tsx` (thread screen + member modal with admin-only kick/promote), `chat/new.tsx` (DM/group/channel creation; DM rejections surface the backend's real mutual-follow reason), `chat/channels.tsx` (public-channel browse/join).

**Per-message WS patch (not full-thread refetch):** when a `match_card`/`prediction_card`/`poll` arrives over the WS (its nested render payload isn't in the flat WS event), `useChatSocket` fetches **only that message** (`getMessage`) and splices it into the cached thread — avoiding a refetch storm in a card/poll-heavy conversation. `text`/`goal_event` still append directly from the WS event.

**Pinned overlay** (`src/components/chat/PinnedOverlay.tsx`): a floating layer of compact, draggable pill cards over the thread — one per pinned message, screen-boundary clamped (via `PanResponder` + `Animated`, no new deps), tap-to-jump to the message, dismiss-to-unpin (gated by the same pin permission). Pinned `match_card` pills refresh on a ~45s interval **only while a live/scheduled card is pinned** (reusing the live serializer via the pinned-list query's `refetchInterval`, not a WS subscription). Card **positions are local-only** — persisted per user, per conversation via `src/lib/pinPositions.ts` (secure-store/localStorage), never sent to the backend. The overlay's visual treatment (compact score-pill look) is a first-pass interpretation — there was no reference screenshot.

---

## 13. Communities

**Models** (`communities/models.py`):
- `Community` — `name` (unique), `description`, `avatar`, `banner`, `created_by`, `members` (M2M through `CommunityMembership`), `is_official`, `created_at`.
- `CommunityMembership` — `user`, `community`, `role` (`moderator`/`member`), `joined_at`.
- `CommunityPost` — `community`, `author`, `content`, `post_type` (`text`/`match_object`/`poll`/`winnie_insight`, default `text` — mirrors `feed.Post.post_type`/`chat.Message.message_type`), `match_id` (plain `IntegerField` — unlike Feed's `Post.match` FK, but now existence-validated on create via `validate_match_id`; `match_object` posts additionally require it), `is_pinned`, timestamps.
- `CommunityPostVote` — `user`, `post`, `vote_type` (`up`/`down`), unique per user+post.
- `CommunityRoom` — `Community` ↔ `chat.Conversation`, one-to-one, **optional** (moderator-enabled per community — not auto-created for all, unlike `MatchRoom`).

**Endpoints** (`/api/communities/`): list/create communities (creator auto-made `moderator`), retrieve one, join-toggle, kick (`<pk>/members/<user_id>/kick/`), promote (`.../promote/`), create companion channel (`<pk>/room/create/`), list/create posts, retrieve/delete a post, vote (`posts/<pk>/vote/`), pin-toggle (`posts/<pk>/pin/`), list the requesting user's communities.

**Voting mechanics:** membership-gated — non-members get 403 ("Join the community to vote"). Then `get_or_create` on `(user, post)`: no existing vote → create; same type → delete (toggle-off); opposite type → flip. Counts computed live (`SerializerMethodField`), not cached.

**Moderation (moderator-only, same minimal scope as Chat's):** post deletion (author or moderator), pin-toggle on `is_pinned` (the field drives `-is_pinned, -created_at` sort order), kick (mirrors removal onto a linked companion channel), promote to `moderator`. No ban, no audit log, no demote.

**Community-Channel linking (`CommunityRoom`).** A moderator can enable a companion chat channel via `POST /api/communities/<pk>/room/create/`: creates a `Conversation` (`channel`, `channel_mode='open'` — members can post, community chat rather than announcements; `is_public=True`, named/avatared after the community) and **backfills every current community member into it**. The enabling moderator becomes the channel's admin (they created it); everyone else joins as plain member.

**Membership sync** (`communities/services.py`): **voluntary** membership syncs bidirectionally — joining a `Community` (join-toggle) also creates chat `Membership` on the linked `Conversation` if a `CommunityRoom` exists; joining the companion channel directly (`JoinChannelView`) also creates `CommunityMembership`; voluntarily leaving mirrors the same way in both directions. **Kicks are asymmetric, following where the authority lives:** a community-moderator kick cascades to channel-membership removal (the community is the parent space), but a channel-admin kick stays channel-scoped and never touches `CommunityMembership` — channel admins hold no community authority. **Roles are explicitly NOT synced** — community moderator ≠ channel admin, independently assigned; only membership presence syncs. Sync is view-driven (explicit calls from the join/leave/kick views), not signal-driven, so there's no mutual-trigger recursion. `CommunityMembership` and `chat.Membership` remain deliberately separate models despite structural similarity — intentionally separate systems, not a shared base class.

**Known gaps:**
- `admin.py` has no model registration.
- `post_type='poll'`/`'winnie_insight'` are enum values only — no community-post poll or insight rendering exists (unlike chat's `poll` message type, which is fully wired).

**Frontend (built, typecheck-verified, not yet device-verified):** `src/api/communities.ts` + `src/hooks/useCommunities.ts`, the Communities segment of `chat.tsx` (My/Discover lists, join-toggle, create-community modal), and `app/(main)/(app)/community/[id].tsx` — post feed (server `-is_pinned, -created_at` ordering respected), inline composer (members only, with an explanatory non-member state), up/down voting that tells non-members *why* they can't vote (pre-flight alert plus a persistent "Join to vote" hint, not a bare disabled button), moderator pin/unpin + delete via a post action sheet, member modal with moderator-only kick/promote (kick confirm copy notes the channel cascade), and the moderator-only **Enable chat** action → deep-links into the shared `ChatThread` screen (`room_conversation_id` from the serializer for returning members).

---

## 14. Infrastructure & Ops Notes

- **Celery + Celery Beat** (`django-celery-beat`, DB-backed schedule) + **Redis** (Memurai on this dev machine) as the broker, and as a separate cache backend (DB 1 — required so the trending cache is shared across the web + Celery processes; `LocMemCache` can't be shared cross-process). **Windows-specific:** the worker must run with `--pool=solo` (Windows lacks the process-forking model Celery's default pool needs).
- **`requirements.txt`** exists at `ball/requirements.txt` (generated via `pip freeze`, ~49 pinned deps including `boto3`, `redis`, `pillow`, `pillow-heif`, `Django`, `channels`, `celery`). No Mux SDK is pinned — the Mux integration is plain `requests` calls, deliberately. **`pillow-heif` is activated once at startup** via `feed/apps.py::FeedConfig.ready()` calling `register_heif_opener()` (guarded so a missing wheel degrades to "HEIC unsupported" rather than crashing) — this is what makes HEIC/HEIF decodable across both the post-photo and profile-image Pillow finalize paths.
- **Deployment data note:** all syncing so far has happened against the local PostgreSQL database on this machine. Production deployment starts with a fresh, empty database — none of this local sync data transfers automatically. Decision: don't build a data-migration/dump-restore path — at actual deployment time, simply re-run the same Celery sync tasks (idempotent and repeatable) against the production database. Budget real time for this as a known first-deployment step.
- **`django.contrib.postgres`** is in `INSTALLED_APPS`, and the `pg_trgm` extension is enabled — required for Search (see Search).

---

## 15. Cross-Cutting Known Gaps

Gaps that don't belong to a single subsystem, or that surfaced while assembling this document rather than being explicitly flagged in any one place:

- **Frontend verification is largely device-unconfirmed.** Most screens built across Leagues/Matches/Feed/Search/Notifications are typechecked (`tsc --noEmit` clean) and pass `manage.py check`/backend smoke tests, but have not been visually re-verified on a real device after their most recent redesign pass. A small number of things genuinely *were* found and fixed via real on-device testing (the NativeWind glob bug, the timezone off-by-one in date navigation, the Team Detail Squad column overflow, the Expo Go boot crash) — those are confirmed. Everything else built since is typecheck-clean but device-unconfirmed.
- **Shared-component duplication** — `TeamLogo`/`TeamCrest`, `formatKickoff`, stat-tile components, `sumCardBuckets`, and a match-row-equivalent component are independently reimplemented across `league/[id].tsx`, `team/[id].tsx`, `player/[id].tsx`, and `match/[id].tsx` (four-way). Not yet extracted into shared components — the same category of risk that already caused one sync bug to need fixing twice.
- **⚠ Possible genuine app-count staleness:** at least `leagues` and `players` exist as fully-built Django apps beyond the commonly-cited "6 core apps" (`users`, `feed`, `chat`, `communities`, `matches`, `notifications`) — this document doesn't carry an authoritative current app list anywhere; treat any specific app count as unverified rather than re-derive it from a stale summary.
- **⚠ `TeamStatistics`'s `season=2025` mismatch, flagged in Leagues → Known gaps**, is repeated here because it's the most concrete unresolved correctness risk found while assembling this document: under Ball's confirmed end-year season convention, those 20 EPL rows are from the 2024/25 season, one season behind the 2025/26 data (`season=2026`) everything else — Matches tab, `League.current_season`, Player Match Stats — is built and tested against.

---

## 16. Team Model & Transfermarkt Enrichment (added 2026-07-22)

**⚠ The "there is NO Team model" statements throughout this doc are now OUTDATED.** A first-class `Team` model was introduced (new `teams` Django app) and the whole backend was migrated off the old Section-38 denormalized `team_id`/`team_name`/`team_logo` convention. Full spec: `ball/TRANSFERMARKT.md`.

**What this means for the frontend contract — mostly nothing, deliberately:**
- The migration kept **every API response byte-identical** (serializers re-source `team_name`/`team_logo` from the FK; integer `team_id`/`home_team_id`/`favorite_team_id` are preserved as the FK's `*_id` attname). **No existing frontend call broke** — same URLs, same keys.
- **One behavior change:** `TeamSearchView` (`/api/leagues/teams/search/`) is now `teams.Team`-sourced, so it returns **all ~1,502 synced teams**, not just teams in standings. Same response keys.
- New, additive endpoints exist under `/api/teams/` (list/detail/sync) — **not consumed by the frontend yet**.

**Transfermarkt enrichment (via Apify — new).** `Player` and `Team` now carry Transfermarkt data (market value, contract, preferred foot, agent; squad value) when the TM sync has matched them (core-5 leagues; null otherwise). New API surface, now consumed by Player Detail:
- `PlayerSerializer` adds `market_value_eur`, `previous_value_eur`, `contract_until`, `preferred_foot`, `agent`, `transfermarkt_id`, `tm_synced_at`.
- `GET /api/players/<afid>/market-value-history/` → MV time series; `GET /api/players/<afid>/transfers/` → career transfers (⚠ club refs are **TM ids, not names** — no transfers UI yet for that reason).
- **Frontend built:** `src/api/playerDetail.ts` (types + `getPlayerMarketValueHistory`/`getPlayerTransfers`), `usePlayerMarketValueHistory`/`usePlayerTransfers` hooks, and Player Detail's **Profile tab** now shows a **Market Value card** (value + Δ vs previous + contract/foot/agent) and a **dependency-free MV sparkline** (no chart lib — scaled `View` bars). Profile tab wrapped in a `ScrollView`. Cards hide when a player isn't TM-matched. `tsc --noEmit` clean; **device-unverified**.
- **Data coverage today:** only Man City (club) + Man Utd squad enriched from validation runs — the full core-5 TM sync (`manage.py sync_transfermarkt`, costs ~$0.50-0.70/league) hasn't been run yet, so most players show no market-value card.
