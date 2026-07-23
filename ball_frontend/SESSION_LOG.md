# Ball — Session Log

Chronological record of build sessions, audits, bugs found and fixed, and decisions walked back — for Ball's frontend and the backend work done alongside it. This is the narrative companion to `CLAUDE.md`, which holds only the current, durable state of the architecture. Entries are dated where the original source material stated a date; where it didn't, the entry is left undated and ordered as it appeared in the original document (which was itself organized roughly in build order).

Original section numbers from the prior single-file `CLAUDE.md` are cited parenthetically for provenance only — they are not live cross-references into this document's structure.

---

## Early build baseline (date not recorded in source)

By the time detailed session logging began, the backend already had all core Django apps built (`users`, `feed`, `chat`, `communities`, `matches`, `notifications`, plus `leagues` and `players` which weren't originally counted in the "6 core apps" summary — see the app-count staleness flag in `CLAUDE.md`'s Cross-Cutting Known Gaps), WebSockets (Django Channels) + Redis (Memurai) working, Phone OTP verification (Africa's Talking) + mutual contact sync working, and DM permission enforcement live. The Winnie integration (`winnie_client.py`) was confirmed working end-to-end.

On the frontend: Expo SDK 54 was scaffolded (a nested-folder bug and an SDK-56-vs-Expo-Go mismatch were both resolved along the way), Expo Router with 5-tab bottom navigation was working, dark theme + Ionicons were rendering correctly (after resolving a file-mixup between the root `_layout.tsx` and `(tabs)/_layout.tsx`, and a font-loading issue), the Chat tab's segmented Chats/Communities bar existed as a placeholder shell, and NativeWind was installed and configured (a `babel-preset-expo` dependency issue was hit and resolved along the way).

**Known workflow risk noted at this point:** both a planning chat and Claude Code had been editing the same frontend files independently in the same session, which caused at least one real conflict (a tab layout got overwritten). This is now a standing working agreement (see `CLAUDE.md`'s header) rather than a one-off note.

---

## Leagues Screen — two real bugs found and fixed (date not recorded; original Section 12)

1. **NativeWind not scanning `src/`.** `tailwind.config.js`'s `content` glob only covered `./app/**` and `./components/**` (the latter an unrelated Expo-template leftover folder, not `src/components/`). Every Tailwind class inside `src/components/*.tsx` silently compiled to nothing — invisible images, centered-instead-of-row layouts, missing button styling. Fixed by adding `./src/**/*.{js,jsx,ts,tsx}` to the glob.
2. **Country-expansion and search both showed ALL synced leagues, not just the curated 209.** `getLeaguesGroupedByCountry` and `getLeagues` were querying the unfiltered `/api/leagues/` endpoint. Fixed by adding a `featured_only` query param to `LeagueListView` on the backend, and hardcoding `featured_only: true` inside the frontend's `getLeagues()` function itself — deliberately not left to each call site, so this bug class can't recur.

The SVG country-flag rendering question (raised as "worth checking" around this point) was resolved later — see the Player/Team Detail Redesign entry below.

---

## Backend Data-Freshness Infrastructure — rebuilt event-driven (date not recorded; original Section 15)

**Started as:** a naive hourly Celery Beat job syncing all 209 featured leagues' standings unconditionally.

**Corrected after direct UX feedback** — fans check tables immediately after their team's match ends, not on an hourly clock — to the event-driven model now described in `CLAUDE.md`'s Matches → Sync Architecture section (`check_for_finished_matches` running every 3 minutes, targeted per-league resync, a demoted daily safety-net sweep).

**Three bugs found and fixed during this build, all the same root-cause class:**
1. `LeagueStanding.form` had no `null=True` — API-Football returns an explicit `'form': None` for teams with zero matches played (new season), causing an `IntegrityError`. Fixed at both the model level (`null=True, default=''`) and the sync code level (`team_entry.get('form') or ''`, not `.get('form', '')` — the latter only defaults on a *missing* key, not an explicit `None` value).
2. The same `.get(key, default)`-vs-explicit-null pattern was found and fixed in `sync_next_batch_of_teams` across six separate fields (`birth`, `team`, `games` nested dicts; `paging.total`; `team_info.id`/`name`; `injured`). The `paging.total` case was flagged as most severe — it could have silently killed an entire batch task via a `TypeError` on the pagination loop condition, not just failed one player.
3. `.env` loading broke specifically under `python -c` invocations (not `python script.py`) because `python-dotenv`'s interactive-mode detection relies on `__main__.__file__`, which `-c` doesn't set — this caused a transient, hard-to-diagnose 403 mid-session. Fixed with an explicit path: `load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))`.

**Lesson reinforced three times in one session:** `.get(key, default)` in Python only supplies the default when the key is *absent* — API-Football frequently sends keys with an explicit `null` value instead of omitting them, which silently bypasses the default unless you use `.get(key) or default` instead.

---

## Full Player/Squad Sync — pivot session (date not recorded; original Section 16)

**Original plan:** sync full player statistics for every team across all 209 featured leagues (`LeagueTeamSyncStatus` tracking model, a resumable multi-day batch job via `discover_teams_for_league` + `sync_next_batch_of_teams`).

**Real blocker discovered:** the 2026/27 season hadn't started yet. API-Football's `/players?team=X&season=2026` returned `results: 0, response: []` — entirely empty, not partial data with empty stats, because season-stats and the player bio object are bundled together in one response, and neither exists until matches have been played in that season. Confirmed by directly comparing `season=2026` (empty) against `season=2025` (full data, same team, same moment) — ruled out rate-limiting as the cause.

**Scope correction:** decided the immediate goal (Player Detail/profile pages) didn't need last-season stats — only current bio/roster info (name, photo, position, jersey number, age). The **lighter** `/players/squads?team={id}` endpoint provides exactly that, with no season parameter and no season-availability problem.

**Status at the time this was written:** mid-pivot from the heavy `/players` sync to the lightweight `/players/squads` sync. `sync_next_batch_of_teams` (heavy version) had been run once against the 5 core leagues (~96 teams discovered/tracked) but returned near-zero player data due to the season-emptiness issue above — not yet re-run with the lightweight endpoint. (`CLAUDE.md`'s Leagues section reflects the actual current coverage: full data for only 4 teams.)

**Also found and fixed during this build: a stale-cohort bug.** `discover_teams_for_league` had accidentally been called with `season=2025` before `season=2026` was confirmed as the correct current season, creating duplicate `LeagueTeamSyncStatus` rows for the same teams under two different seasons. `sync_next_batch_of_teams` had no season-awareness and silently processed the wrong (stale) cohort first. Fixed by (a) deleting stale rows where `season != League.current_season`, (b) hardening `sync_next_batch_of_teams` to only process rows matching each league's current season (via `Subquery`/`OuterRef` against `League`), and (c) adding a refusal guard to `discover_teams_for_league` itself if called with a season that doesn't match `League.current_season` (advisory, non-fatal — lets through if no `League` row exists yet to check against).

**Note for future readers:** this exact class of `season`-value confusion resurfaced later in a different subsystem. Ball's season convention was later confirmed as end-year (`season=2026` = the 2025/26 season, i.e. "the old season" being tested against since 2026/27 hadn't started) — which reconciles the Matches tab's `season=2026` fixture sync with its `2025-08-15` default date. It does **not** reconcile `TeamStatistics`'s `season=2025` testing sync (Team Detail entry, below), which under that same convention is actually the 2024/25 season — one season behind everything else. See `CLAUDE.md`'s Leagues → Known gaps for the still-open follow-up.

---

## Multi-Instance Claude Code Workflow — incident (date not recorded; original Section 18)

A session ran three parallel Claude Code instances (backend, frontend, data-syncing), each with separate context. This caused one real incident: a backend-focused instance encountered `is_featured=True` on 208+ leagues it had no memory of curating, initially suspecting corrupted/unreviewed data, until independently re-verifying against the live DB and API confirmed the data was legitimate — it had come from a different instance's work earlier in the same session.

**Process lesson drawn from this:** a shared reference document is only useful across instances if it's actually saved into the project directory (not just left as a chat artifact), and if each new instance is explicitly pointed at it before it starts making assumptions about data it didn't create itself. This is now a standing working agreement (see `CLAUDE.md`'s header).

---

## Team Detail Screen — build + Stats tab data investigation (date not recorded; original Section 19)

Built the 4-tab Team Detail screen (Fixtures/Squad/Stats/Table — final design now in `CLAUDE.md`'s Leagues section). Trophies tab was excluded after confirming via a direct API test that `/trophies` only accepts `player`/`coach` parameters, not `team` (the API returned `{'team': 'The Team field do not exist.'}`) — no clean team-level trophy data source exists, and building one would require manual per-team curation, out of scope for MVP.

**Stats tab layout was redesigned after checking real synced data against a FotMob reference screenshot, rather than assuming the reference's fields all existed:**
- Queried actual `TeamStatistics.data` and `Player.statistics` payloads directly. `fouls` as a team-level total does **not** exist in API-Football's `/teams/statistics` response — confirmed by dumping real synced data's top-level keys (`form`, `team`, `cards`, `goals`, `league`, `biggest`, `lineups`, `penalty`, `fixtures`, `clean_sheet`, `failed_to_score` — no `fouls`). Excluded entirely rather than approximated by summing per-player fouls (too sparse to trust).
- `biggest.streak` (win/draw/lose streak counts) exists but was excluded as redundant with the Form chips already in the header.
- **Key Player grid complication:** each entry in a player's `statistics` array is scoped to one specific competition (a player might have separate League Cup and Premier League entries with different numbers) — picking `statistics[0]` blindly would sometimes show the wrong competition. Decided to sum a player's value across every competition entry belonging to the current team this season (`entry.team.id === teamId`, so a mid-season transfer's stats at their previous club don't leak in) rather than isolating one league. "Clearances" was dropped — no clean API-Football field.
- Field completeness was checked empirically against 133 real synced Premier League players before committing to which stats to show (see `CLAUDE.md` for the exact coverage numbers) — "good enough to compute reliably, not 100% coverage."

**Known tech debt flagged at this point (grew over subsequent sessions — see `CLAUDE.md`'s Cross-Cutting Known Gaps):** `TeamLogo`/`TeamCrest`, a match-row-equivalent component, and `sumCardBuckets` were all duplicated (slightly adapted) between `league/[id].tsx` and `team/[id].tsx` rather than extracted into shared components — flagged as the same category of risk that caused the standings `form`/`points` sync bug to need fixing twice.

**Expected empty states noted, not bugs:** `Player` table only had full statistics for 4 teams synced during testing that night (Man Utd, Newcastle, Bournemouth, Liverpool — team_ids 33/34/35/40) — the Key Player section wouldn't render for any other team until its squad got the full (not lightweight bio-only) sync. `TeamStatistics` rows only existed for the 20 Premier League teams manually synced for `season=2025` testing.

---

## Player Match Stats System — backend build (date not recorded; original Section 20)

Built `PlayerMatchStat` (one row per `(match, player_id)`) and `matches.tasks.sync_player_stats_for_match(match_id)` — deliberately a plain function, not `@shared_task`, since it's meant to be called synchronously inline from the finish-hook rather than enqueued separately. Hooked into `check_for_finished_matches` so a player's match history builds up incrementally, one row per finished match, with no separate backfill task required going forward.

Read endpoint `GET /api/matches/player/<player_id>/history/` (`PlayerMatchHistoryView`) was built with a `match_summary` nested field (kickoff time, league name, both teams + logos, scores) alongside the raw stat fields — this was **added beyond the original spec**, on the reasoning that a "match log" is unusable if each row only carries a bare `match` FK id with no context on which fixture it belongs to. Flagged to the user at the time; not reverted.

**Status as documented at the time:** "infrastructure only, zero data yet" — `PlayerMatchStat.objects.count()` was 0, no backfill had run. This status claim later turned out to be **stale**, not accurate — see the Codebase Audit entry below for how that was discovered and corrected. The actual current data coverage (Liverpool's full 2025/26 season, 1,516 rows across 38 matches) is documented as current fact in `CLAUDE.md`'s Player Detail section.

---

## Player Detail Screen — build + two real bugs (date not recorded; original Section 22)

Built the 3-tab Player Detail screen (Profile/Matches/Stats — final design in `CLAUDE.md`'s Leagues section).

**Backend fix required before this could work at all:** `TeamSquadView` (`GET /api/players/`) only supported filtering by `team_id` — a `player_id` query param was silently ignored (DRF doesn't error on unrecognized params), so the originally-drafted `getPlayerProfile()` would have returned the *entire* `Player` table and `.data[0]` would've silently shown the wrong player. Fixed by adding `player_id` filtering to `TeamSquadView.get_queryset`, mapped to **`api_football_id`** (not the Django `id`) — verified empirically: 164 players in the DB, filtering by one real `api_football_id` returned exactly that 1 player.

**Second fix, found while building the Matches tab:** `PlayerMatchStatSerializer.get_match_summary` (from the prior session) only returned team *names*, not IDs — so the frontend had no way to determine which side (home/away) was the player's own team, meaning "opponent" couldn't be computed. Added `home_team_id`/`away_team_id` to the serializer output.

Built and typechecked (`tsc --noEmit` clean) but **not yet visually verified end-to-end** at the time this session closed.

---

## Player/Team Detail Redesign — Match Tables, Competition Stat Cards, Nationality Flags (date not recorded; original Section 24)

First real on-device feedback pass on the prior two screens. Three UI reference screenshots (a FotMob-style player page's Match/Stats tabs and a team's Squad tab) drove a rebuild of three areas, plus a real bug fix and a new data pipeline.

**1. Team Detail Squad tab — per-player stat columns, plus a real overflow bug.** `PlayerRow` was given Appearances/Goals/Assists columns. The column headers were visibly overflowing off the right edge of the screen on-device (confirmed via screenshot — "Assists" wasn't even visible). Root cause was two compounding issues: (a) the "Apps" header `Text` had both `flex-1` and a fixed `w-12` set simultaneously — conflicting layout instructions; (b) the section-header wrapper used `px-4` while `PlayerRow` itself used `mx-4 px-3`, so header and data columns had different horizontal insets and drifted apart. Fixed both; all three stat columns became a consistent `w-10` on both header and row.

**2. Player Detail Matches tab — rebuilt as a compact table**, replacing the original stacked-card layout, adding an "On the bench" row state for unused subs (`minutes === null`).

**3. Player Detail Stats tab — rebuilt as per-competition expandable cards**, replacing a single aggregated tile-grid, with a Total/League/Cup/National segmented filter.

**Classification heuristic flagged explicitly as non-authoritative:** API-Football's player statistics entries carry no competition "type" field, so League/Cup/National is inferred from team-id mismatch + name-keyword matching — worth spot-checking against real data if a competition is ever miscategorized.

**4. Nationality flags — new `Country` sync + a confirmed, worked-around SVG rendering limitation.** New `players.Country` model synced from API-Football's `/countries` endpoint (171 countries loaded). Real coverage gap found: reusing the already-synced `League.country_flag` data only covered 25/40 (62%) of actual player nationalities in the DB — countries without a "featured" league ever synced (Hungary, Czechia, Georgia, Wales, Northern Ireland, etc.) had no flag data at all. The dedicated `/countries` sync covers all of them.

Naming mismatch found empirically, not assumed: even after the sync, 8 of 40 nationalities still didn't match directly between API-Football's `/players` and `/countries` endpoints (`"Czechia"` vs `"Czech-Republic"`, `"Korea Republic"` vs `"South-Korea"`, `"Türkiye"` vs `"Turkey"`, `"Côte d'Ivoire"` vs `"Ivory-Coast"`, `"Republic of Ireland"` vs `"Ireland"`, plus a systemic hyphen-vs-space convention on multi-word country names). Built and standalone-tested `src/lib/flags.ts::getFlagUrl()` against real synced data before wiring into any screen.

This also **resolved a previously-unconfirmed open item**: API-Football's flag images are indeed `.svg` (`media.api-sports.io/flags/*.svg`, verified live, no `.png` alternate at the same path), and React Native's core `Image` genuinely cannot render remote SVGs. Rather than add an unverifiable native dependency (`react-native-svg`) or assume `expo-image` handles SVG without being able to test it, flags are rendered via `flagcdn.com/w40/{code}.png` instead.

**Verification:** `tsc --noEmit` clean, `manage.py check` clean, migration applied, sync run for real, flag-matching logic tested standalone against real DB data before UI wiring. Not yet re-verified on device after this pass.

---

## Matches Tab — build + a timezone off-by-one bug (date not recorded; original Section 26)

Built the date-navigable Matches tab (final design in `CLAUDE.md`'s Matches section) plus backend support (`date`/`season` query params on `MatchListView`). Fixtures were synced for the 4 core leagues that weren't yet populated.

**Real bug found and fixed: timezone off-by-one in date navigation.** The original `addDays()` parsed the date string as local midnight but serialized the result via `.toISOString()`, which converts to UTC before formatting. On a machine east of UTC (East Africa Time, UTC+3, where this was tested), local midnight for the target day falls on 21:00 UTC the *previous* day, so the sliced `YYYY-MM-DD` came out one day off — "Next" silently no-op'd (cancelled back to the same day) and "Prev" skipped two days instead of one. Fixed by building the date string entirely from local `Date` getters (`getFullYear`/`getMonth`/`getDate`), never touching UTC-converting methods. Verified via standalone reproduction in this timezone before and after the fix.

**Lesson:** any function that turns a `Date` back into a plain calendar-day string must stay in local time end-to-end — parsing local then serializing via `toISOString()` is the same category of bug every time.

---

## Match Detail Screen — initial build (date not recorded; original Section 27)

Match Detail didn't exist as a route before this work. Built Overview/Lineup/H2H/Preview/Odds tabs (this initial 5-tab set was later superseded — see the redesign entry below).

**Real bug found and fixed: tab bar rendered as full-height vertical pills.** The 5-tab row was built as a horizontal `ScrollView` (to allow scrolling if labels didn't fit). Without an explicit bounded height, the `ScrollView` stretched to fill the remaining screen space in the flex-column layout, and its row children inherited that height via the default cross-axis `stretch` — producing tall pill buttons with a dead gap below instead of a compact strip. Fixed by reverting to a plain `flex-row` `View` with `flex-1` per button (no scrolling) — the exact pattern League Detail's own tab row already used successfully with a longer label than any tab here.

**Lesson:** don't reach for `ScrollView` over a proven plain-`View` tab-row pattern just because the tab count matches a screen that already works — the moment horizontal scroll is actually needed for a tab bar, it needs an explicit height, not an assumption that it'll behave like a `View`.

**Verification status at the time:** backend `manage.py check` clean, migrations applied; frontend `tsc --noEmit` clean. Odds and Lineup were flagged as unverified against real data — API-Football's `/odds` only retains data within ~7 days of kickoff, `/fixtures/lineups` only posts ~30-60 min before kickoff, and the synced fixtures were all outside both windows at the time. (Lineup was subsequently backfilled and verified — see the redesign entry below. Odds still has zero real-data confirmation as of the latest information in this project.)

---

## Match Detail — Facts/Stats tabs, player ratings, team-colored redesign (date not recorded; original Section 29)

Follow-on work after the initial Match Detail build. Three passes: (1) add post-match Facts/Stats tabs and status-conditional tab sets, (2) fix a real backend data-capture gap found while building Facts, (3) a full visual redesign copying FotMob reference screenshots.

**Pass 1 — status-conditional tabs**, replacing the original fixed 5-tab set with the Pre-match/Post-match split now documented as current design in `CLAUDE.md`. The original Overview tab was retired in favor of Facts.

**Pass 2 — real gap found and fixed: `MatchEvent` had no way to represent assists or substitution pairs.** `sync_match_events` (built the session before this one) only captured `event.get('player')`, never `event.get('assist')`. Fixed by adding `MatchEvent.assist_player` and changing `sync_match_events` from `get_or_create` to `update_or_create` — `get_or_create`'s `defaults` only apply on creation, so re-running the sync against an already-existing match's rows would have silently left `assist_player` at `None` forever; this was caught before it shipped, not after.

The `player`=off/`assist`=on convention for `subst`-type events was verified against API-Football's own documentation, not guessed — this directly **contradicted an earlier assumption** in an even-earlier version of this project's notes, which had guessed the opposite based on player identity (unreliable reasoning). Confirmed by web search against api-sports.io's documented schema before building any UI on top of it. Backfilled match id=2 as a check: Ekitike's 37' goal correctly showed `assist: A. Mac Allister`; all 6 goals cross-checked against the known 4-2 scoreline.

Built a new `GET /api/matches/<id>/player-stats/` endpoint for ratings — discovered along the way that Postgres sorts `NULL` first on `ORDER BY ... DESC`, which silently broke the naive "highest-rated player" query against the nullable string `rating` field; parsed client-side instead.

**Pass 2, continued — real gap found: Lineup was never wired into the event-driven sync.** The user reported the Lineup tab was empty for Liverpool vs Bournemouth despite believing it had been synced. Investigation confirmed `MatchLineup.objects.filter(match_id=2).exists()` was `False` — `sync_lineup_for_match` was the only per-match sync function *not* called from `check_for_finished_matches` (unlike stats/events/player-stats). Fixed by adding it to that loop, then manually backfilled match 2 (confirmed real data: Liverpool 4-2-3-1 under Arne Slot, Bournemouth 4-1-4-1 under Iraola, 11 starters + 9 subs each).

**Pass 3 — UI redesign, copied from user-provided FotMob screenshots, not from memory/assumption.** `src/lib/teamColors.ts` was built with real club brand colors keyed by exact team-name strings queried from Ball's own DB first — several assumed names were wrong (`"Inter"` not `"Inter Milan"`, `"AS Roma"` not `"Roma"`, `"Tottenham"` not `"Tottenham Hotspur"`). Player photos on Lineup were joined client-side after confirming (via direct DB check, not assumed) that lineup, player-stats, and squad data all share the same numeric player-ID space. Lineup was redesigned as one shared pitch instead of two mini-pitches. Facts was redesigned as a two-column reverse-chronological feed with defensive handling of the "missed penalty filed as a Goal event" quirk.

**Verification status:** `manage.py check` and `npx tsc --noEmit` clean throughout all three passes. Player-of-the-Match/ratings data verified directly against the DB (Semenyo 8.6, Gakpo 8.6, Salah 8.5 for match id=2 — matched real synced values). Lineup backfill verified directly against the DB. Not yet visually confirmed on-device: the substitution arrow direction, the team-color palette beyond Liverpool/Bournemouth, and the shared-pitch layout's spacing/proportions at real screen sizes.

---

## Codebase Audit — ticking off what's actually done, before starting Feed (date not recorded; original Section 33)

A requested pass to re-check every "not yet done" claim in the project's running notes against the real DB/codebase directly, rather than against memory of what was last written — several sessions' worth of claims had accumulated without anyone re-verifying them.

**Genuinely resolved but never marked as such:**
- The Player Match Stats "zero data yet" status (see the earlier entry above) was stale. Direct DB query: `PlayerMatchStat.objects.count()` = 1,516, spanning 38 distinct matches — Liverpool's complete 2025/26 EPL season (`2025-08-15` through `2026-05-24`, all finished). 33 distinct Liverpool players had match-history rows (Van Dijk and Kerkez had all 38). The "manual one-off Liverpool backfill" that had been described as pending across three consecutive rounds of open-questions notes had **already happened** — just never during a session that updated the running notes.
- An open-questions bullet claiming "Player Detail's Matches tab (frontend) — not yet built" was simply **wrong**, not just stale — direct inspection of `player/[id].tsx` showed `usePlayerMatchHistory`, a `matches` tab, and `MatchHistoryRow` all already existed (built two sessions earlier, redesigned since). Lesson drawn: open-questions bullets need the same re-verification discipline as everything else — they don't self-correct just because a later entry documents the actual build.
- The Lineup "unverified against real data" claim from the initial Match Detail build was superseded by the later real backfill+DB verification.
- Several "not yet built" claims dating back to the earliest sections of the project's notes (API-Football client, sync mechanism, most frontend screens) had all been built long ago and simply never crossed off.

**Checked and confirmed still accurate (not stale):**
- Full player/squad sync: still only 4 teams have full squad data (team_ids 33/34/35/40), plus 2 incidental single-player rows. No expansion had happened.
- `TeamStatistics` coverage: still exactly 20 rows, all `league_id=39` (EPL), all `season=2025`. No expansion had happened.
- Shared-component duplication was still unaddressed, confirmed by inspecting `match/[id].tsx`'s own local `TeamLogo`/`formatKickoff` definitions (a fourth independent copy).
- The drawer's "Profile" menu item still had no route/`onPress`, and no `app/**/profile*` route file existed anywhere.
- The Odds tab's missing automatic sync path was confirmed still true.

This audit's discipline — re-verify against the DB/codebase directly, don't trust prior status claims — was explicitly carried forward as the standard for subsequent sessions, and is the same discipline applied in producing this log/spec split.

---

## Feed — pre-build architecture planning session (date not recorded; original Section 36)

A full planning pass before writing any Feed models/endpoints. Several forks were walked through and reversed once the implications became concrete.

**`match_object` post design — two designs rejected before landing on the post-match-recap-only design now in `CLAUDE.md`:**
1. *Rejected: live, per-event auto-posting.* The original instinct was a distinct feed entry for every goal/card/sub, posted in real time. Walked back for two reasons: (a) it required genuinely new backend infrastructure — the existing finish-hook only fires once, at full-time, not repeatedly during play, working against the "keep the backend light" goal; (b) a feed flooded with a new post per event, per simultaneous match, reads closer to a live-score-bot than the "interactive object, not a screenshot" positioning Ball is built around.
2. *Rejected: one living card per match, updating in place via WebSocket.* Better than (1) — would have reused the existing `MatchRoom` WebSocket group rather than inventing post-per-event rows. Rejected anyway because it broke chronological feed ordering: a card that jumps back to the top of the feed on a 90th-minute goal either duplicates for someone mid-scroll or gets missed once they've scrolled past its old position, with no clean bump-vs-pin answer that didn't compromise one tab or the other.
3. Landed on the post-match-recap-only design (see `CLAUDE.md` → Feed).

**Discovery cost reasoning (For You tab):** a full blend (affinity + trending + social proof) was chosen over a leaner affinity-only version, deliberately, after flagging the cost difference. The design choice that makes the full blend affordable rather than Twitter-scale-heavy: don't compute one score per post against every viewer — generate three narrow candidate pools per request and merge them (see `CLAUDE.md` for the final pool definitions). A dependency was surfaced that hadn't been accounted for when this design started: both the trending and social-proof pools need engagement *events* to exist as a queryable data source, meaning Discovery was implicitly depending on the Engagement model before that model had been designed.

**Media vendor comparison, researched rather than assumed:** video and photo went to two different vendors (Mux, S3+Pillow) rather than one, after checking current pricing rather than assuming a single vendor would be simpler. Mux's basic-quality tier encodes for free and includes 6,000 free delivery minutes/month, explicitly positioned for social/UGC use cases. Cloudinary's free tier (25 shared credits/month across storage+transformation+bandwidth) was checked and found comparatively weak on video specifically — one source noted the free plan doesn't meaningfully support video transformations at all — and would have put photo and video usage in competition for the same limited credit pool if unified. Photos don't need a managed service to stay simple regardless (S3 + Pillow is well-trodden), so "one vendor" convenience wasn't actually saving meaningful complexity.

**Open items carried out of this session** (mostly resolved in later sessions — see below): media pipeline vendor choice (resolved), whether photo upload goes direct-to-S3 (resolved), single vs. multiple media per post (still open), video duration cap (resolved to 140s), `Post` media reference shape (resolved: separate `PostMedia` model), Discovery's repost-weighting (resolved), comment-reply notifications (still deferred), Following-feed distribution for system posts (resolved), whether a team-follow relationship existed anywhere (checked — it didn't, built denormalized), notification muting (still not scheduled).

---

## Search — pre-build architecture planning session (date not recorded; original Section 37)

Reference screenshots reviewed: X's autocomplete, tabbed search results (with match-score cards surfacing inline above tweet results for a football-related query), the Trending page, and a "Football Hub" widget embedded in X's Home feed — the last of these was explicitly scoped **out** of this discussion (a different feature — a persistent module inside Feed/Home — from Search itself; conflating them would have blurred two separate pieces of work).

Key reasoning preserved: Postgres FTS + `pg_trgm` was chosen deliberately over a dedicated search engine (Elasticsearch/Meilisearch/Algolia) — Ball already runs Postgres, and standing up a second, separate search service is real ongoing infrastructure a small team doesn't need yet; "we outgrew it" is a fine problem to defer. Trends was scoped to hashtags only, explicitly not true freeform keyword/topic mining (spike-detection, stopword filtering, entity resolution) — real NLP infrastructure Ball's stage doesn't call for, when hashtags deliver most of the actual product value at a fraction of the cost. Autocomplete was deliberately scoped as an architecturally separate, cheaper endpoint from the start, not a lighter version of the same query — running the full ranked-search pipeline on every keystroke would be a real performance problem.

Open items carried out of this session: debounce timing (still unspecified), Matches tab upcoming-vs-past mixing (resolved: mixed), tappable hashtags inside a post's own display (still undecided), search history (still not built), pagination for the five result tabs (partially addressed via Feed's own pagination work, not comprehensively).

---

## 2026-07-11 — Feed / Search / Notifications backend build, Step 0 audit

*(Note on this log: the original project notes contain two separate write-ups of what appears to be the same Step-0 verification pass and reconciliation, filed under duplicate section numbers in the source document. Both are preserved below since they're framed slightly differently — one as an implementation summary ("what got built"), one as an audit-reasoning narrative ("why we decided X") — but a future reader should treat them as describing the same underlying event, not two separate audits.)*

**First write-up.** Before writing any Feed/Search code, a session ran a live-codebase verification pass and found the doc's premise was partly wrong:

- `feed` and `notifications` were **not** "scaffolded-only" as the running notes claimed — both were fully live: mounted in the root URLconf, migrated, with working models/views/serializers.
- `feed.Post` already existed with `repost_of` (matching the planned design exactly) and `match_id` as a plain `IntegerField` (not the FK the plan specified).
- `feed.Reaction` (4 types: goal/hot_take/smart/terrible) was live — not the plain Like the plan specified.
- `feed.Poll`/`PollOption`/`PollVote` were fully built and live, despite the plan having decided to drop poll from scope (in ignorance of this).
- `notifications.Notification` already had 10 types (including follow/reply/repost/mention, beyond the plan's match-event scope) and `FCMToken` (raw FCM/APNs device tokens, not Expo).
- No team-follow relationship existed anywhere, and no `Team` model existed anywhere — only `leagues.UserLeagueFollow` and the user↔user `users.Follow`. Teams were (and remain) denormalized (`team_id`/`team_name`) across `Match`/`TeamStatistics`/`LeagueStanding`.
- `check_for_finished_matches` was confirmed to behave exactly as previously documented, by reading it directly rather than trusting the prior description.
- `MatchRoom`'s Channels consumer already had a `match_event` handler wired and ready — the planned WebSocket reuse was directly actionable with no adaptation needed.

These findings were reported to the user, who issued explicit reconciliation decisions (below). **The forks were surfaced as plain text for the user to research rather than pushed through a quick multiple-choice prompt** — the working pattern established was that the user does independent research before committing to architecture calls, rather than being asked to pick from a quick list.

**Second write-up of the same pass**, framed as an audit correction: confirms the same findings (feed/notifications fully live, Post/Reaction/Poll states, Notification's 10 types, no Team model, `check_for_finished_matches` accurate, `MatchRoom` handler ready), and additionally notes the environment check: Celery + django-celery-beat were installed; boto3 and a Mux SDK were not; Postgres was confirmed as the DB engine, but `django.contrib.postgres` wasn't yet in `INSTALLED_APPS`.

### Reconciliation decisions (from the user, after the Step 0 report)

- **Poll:** DB checked first — `Poll`/`PollOption`/`PollVote` and poll-posts were all 0 rows (the entire feed was empty at the time). Removed the models + `PollVoteView` + poll serializers + vote route cleanly, per the "zero usage → remove cleanly" rule. The `'poll'` `post_type` enum value was kept for future use. Explicit rule stated for next time: "the doc said drop it" isn't sufficient reason to delete real user data if a drop decision was made in ignorance of the feature already existing — always check usage first.
- **Reaction vs. Like:** kept `Reaction` exactly as-is; rejected both adding a redundant separate Like model and replacing Reaction with a plain Like (a breaking change to live, arguably-better functionality, for no real gain).
- **Push delivery — Expo vs. direct FCM/APNs:** researched current pricing/positioning before deciding, rather than assumed from training data. Expo's push service remains free for delivery at any tier and is explicitly positioned by Expo as the default path; direct-to-FCM/APNs is for teams needing finer control Expo's abstraction doesn't provide, which wasn't a stated need here. Decision: add `ExpoPushToken` as a new model, leave `FCMToken` in place as likely-legacy (confirmed nothing currently reads from it for delivery before treating it as dead).
- **`Post.match_id` → FK:** converted to a real `ForeignKey('matches.Match')` — low switching cost since `match_object` posts weren't in production use yet.
- **`UserTeamFollow`:** confirmed absent, genuinely new work — built denormalized, following the same convention already used throughout the codebase, rather than introducing the only relational team reference in the system.

### Build order categorization

- **Unchanged, keep as-is:** `Post.repost_of`, `Reaction`, `Notification`'s existing 10 types, `MatchRoom`'s WebSocket handler.
- **Adapt existing code, don't rebuild:** `Post.match_id` (add FK), `GlobalFeedView` (apply ranking to it — it's already the For You endpoint, just unranked), `FeedView` (verify it already matches the Following spec), `FCMToken`/`Notification` (add `ExpoPushToken` and new match-event type values alongside what's there).
- **Build fresh, confirmed absent:** `Comment` (threaded), processing/ready state + media fields on `Post`, `UserTeamFollow` (denormalized), `sync_live_match_events` poller, the WebSocket fan-out logic itself (the handler existed, the events driving it didn't), the async notification fan-out task, Mux/S3 integration.
- **Blocked on a data check, not a decision:** Poll removal (resolved above, same session).

### What got built, by step (all smoke-tested against the local DB; `manage.py check` clean, no pending migrations at session end)

- **Step 1** — `Post`: `match` FK, `media_state` ('ready'/'processing'). New `PostMedia` model. Poll models removed. Migrations `feed/0002`, `0003`.
- **Step 2** — `feed/services.py::create_match_recap_post` (idempotent, keyed on system-author+match), riding `check_for_finished_matches`. Single global system account `ball` (`get_system_user`, auto-created). Recap content not stored — derived at serialization time. Backfill mgmt command `create_match_recaps`. Verified against match id=2 (Liverpool 4-2 Bournemouth, all 6 scorers + assists correct).
- **Step 3** — `Comment` model (self-FK `parent`, null=top-level); thread fetched in one flat query, nested in app code. Repost-resolve logic verified: reposting a repost resolves `repost_of` to the original, not the intermediate.
- **Step 4** — `feed/media.py`: Mux direct-upload (`create_mux_direct_upload`, plain `requests`, no SDK), Mux webhook signature verify (HMAC-SHA256), S3 presigned PUT + Pillow `finalize_photo`. Views: `MediaUploadURLView`, `PhotoFinalizeView`, `MuxWebhookView`. All config optional → 503 when unconfigured. `boto3` installed into the venv. Verified without live creds: guards, signature good/bad/skip paths, full webhook `video.asset.ready` → ready + playback/thumbnail, duration-cap → failed.
- **Step 5** — `feed/scoring.py` (`DiscoveryConfig`), `feed/tasks.py::compute_trending` (Celery Beat every 20 min, Redis cache). `GlobalFeedView.list` merges the 3 pools and ranks via `scoring.rank_posts`. Redis cache backend added (DB 1) — `LocMemCache` can't be shared across web + Celery processes. Verified: all 3 pools contribute, own posts excluded, cold-start = trending-only.
- **Step 6** — `SearchView` with 5 tabs. Postgres FTS for Post/People; `pg_trgm` `TrigramSimilarity` for Match names. Top tab reuses `scoring.rank_posts` (not reimplemented). `django.contrib.postgres` added to `INSTALLED_APPS`; `pg_trgm` extension via migration `feed/0004`. Verified all five tabs.
- **Step 7** — hashtag extraction folded into `compute_trending` (`_compute_trending_hashtags`) — no new job/model/I/O. Verified.
- **Step 8** — `matches.tasks.sync_live_match_events` (Celery Beat, 60s) diffs live events via shared `_sync_events_core`; each new event → WS broadcast + a separate async `fan_out_match_event_notification.delay`. FT fan-out wired into `check_for_finished_matches`. Recipients = both teams' followers via `UserTeamFollow`. Verified: fan-out hits exactly both teams' followers, in-app rows created, WS broadcast runs, Expo no-op without tokens.
- **Step 9** — `AutocompleteView`: `pg_trgm` username prefix + prefix filter over the cached hashtag list; empty query returns top trending hashtags. Verified.

### Trending formula fixes applied this session

Trending velocity weights reposts heaviest (`REPOST 3.0 > COMMENT 1.5 > REACTION 1.0`; verified a repost-heavy post out-scored a reaction-heavy one). Social proof now counts reposts (`Post.repost_of` by a follow) as a third source alongside reactions/comments — these had been flagged as required follow-ups when Discovery and Engagement were originally designed in separate sessions, and were closed out here.

### Other decisions made to keep moving (all now reflected as current fact in `CLAUDE.md`)

- `PostMedia` chosen as a separate model over dedicated `Post` fields — the sibling open item (single vs. multiple media) was undecided, and a FK'd model supports 0..N without future schema churn.
- Photo upload: direct-to-S3 presigned PUT, consistent with the video pattern.
- Video duration cap: 140s picked as "a sensible X-like default, not a confirmed product decision" at the time — later confirmed as the real, locked cap (see the 2026-07-11 follow-up entry below).
- Search Matches tab: upcoming+past mixed, "this is my default, flag for confirmation" at the time — later confirmed.
- Autocomplete debounce/min-char: not enforced server-side, treated as a client responsibility.

### Deliberately not done / not silently reinterpreted

- Following-feed distribution for system recap posts — flagged as still open, not resolved in this session (resolved same day — see the follow-up entry below).
- Comment-reply notifications — not built, explicitly deferred.
- Media multiplicity enforcement — not built.
- Notification muting/preferences — not built.
- Hashtags-tappable-in-post-display, search history, result-tab pagination beyond what was built — not built.

### Verified structurally but not against live external data

- **Mux:** tested via a simulated `video.asset.ready` webhook, never against the live Mux API (no credentials in this environment). Two schema details taken from Mux's documented schema, not a real response: `encoding_tier: 'baseline'` (later found to be a deprecated field name — see the follow-up entry) and matching `PostMedia` by `data.upload_id`.
- **S3:** presigned-PUT + `finalize_photo` untested against a real bucket; guard paths verified.
- **`sync_live_match_events`:** WS-broadcast and notification-fan-out halves verified in isolation; the full live loop against API-Football had not run — needs an actual `status='live'` fixture with events posting in real time.
- **Expo push:** token lookup + no-op path verified; an actual push to Expo's service was not sent.

### New dependencies/infra added this session

`boto3` installed into the venv (no `requirements.txt` existed yet — this was only recorded in notes at the time). Redis cache backend (DB 1). `django.contrib.postgres` + `pg_trgm`. New Celery Beat entries: `compute-feed-trending` (20 min), `sync-live-match-events` (60s). New settings block: `MUX_*`, `AWS_*`/`AWS_S3_*`.

---

## 2026-07-11 — Steps 1-9 build complete, post-build decisions

All 9 steps were confirmed built, smoke-tested, and `manage.py check` clean with no pending migrations. Decisions made on delivery, at the time flagged as guesses needing confirmation:

- Video duration cap 140s — confirmed as the real cap (matches X's own standard-upload limit, generous for the goal-replay/reaction use case).
- Search Matches tab upcoming+past mixed — confirmed (matches the original reference screenshot this feature was scoped from).
- Following-feed distribution of system recap posts — resolved as a design (the union query later documented in `CLAUDE.md`), but flagged as "needs building" — not yet actually implemented at this point in the session.
- Mux field naming — `encoding_tier: 'baseline'` was flagged as deprecated (renamed to `video_quality: 'basic'` in 2024); decision made to switch, not yet actually changed at this point.
- Deferred items (comment-reply notifications, media-count enforcement, muting) confirmed correctly still deferred.

Still pending at end of this entry: Poll removal (blocked on a DB check, resolved same day — see below), Mux field rename (resolved same day), `sync_live_match_events` against real data (still open), S3 path (still open), no `requirements.txt` yet (resolved same day).

---

## 2026-07-11 — Post-build follow-up fixes

Same-day follow-up after the user reviewed the prior entry's decisions and confirmed them. Closed out the remaining pending list.

**Following-feed distribution — built.** `FeedView.get_queryset` changed from a plain "posts by followed users" filter to the OR-filtered union now documented as current fact in `CLAUDE.md`. Implemented as a single filtered queryset (not `.union()`, which fights ordering/slicing). Deliberately does not call `get_system_user()` in the read path (no get-or-create write on every feed load). Verified: a viewer following EPL + one user gets both that user's post and a league-39 recap in Following; a viewer following nothing gets neither.

**Mux field naming — fixed.** `create_mux_direct_upload` now sends `video_quality: 'basic'` instead of the deprecated `encoding_tier: 'baseline'`. Flagged as still needing re-verification against a live webhook payload once real Mux credentials exist — built from docs, never hit a real Mux response, and the field rename may also shift the webhook payload shape.

**Poll usage numbers — reported, closing the earlier pending DB check.** The check had actually already been run at the start of the build session (Step 0), before any poll code was touched: `Poll` rows 0, `PollOption` 0, `PollVote` 0, `post_type='poll'` posts 0. Re-verified at this point: no `feed_poll*` tables remain in Postgres, `feed.models.Poll` is no longer importable.

**`requirements.txt` — added.** Created from `pip freeze` (48 pinned deps). No Mux SDK pinned, since none is used.

**Real gap caught while doing this: Pillow was missing from the venv entirely.** The `pillow==12.2.0` seen during the earlier environment check had come from the *global* Python (a `cd` had silently fallen back to system Python), not the project venv. `finalize_photo`'s lazy `from PIL import Image` import had never actually been reached by any smoke test (the S3 config-guard fired first), so this wasn't caught until generating the freeze. Installed `Pillow==12.3.0` into the venv and confirmed it imports — photo finalize would have raised `ModuleNotFoundError` at runtime without this fix.

---

## 2026-07-12 (pre-build) — WebSocket JWT auth gap found and resolved

Before starting the frontend Feed/Search/Notifications/Live build, a real blocker was surfaced that the earlier Notifications planning hadn't anticipated: `ball/asgi.py` wrapped the WS router in Channels' `AuthMiddlewareStack` (session/cookie auth only), but the mobile app is JWT-only and React Native's `WebSocket` can't send custom headers — `MatchConsumer` would see every mobile connection as `AnonymousUser`.

**Resolved** by adding a Channels JWT middleware reading `?token=` from the query string (the standard workaround for header-less WS clients), wrapping it inside `AuthMiddlewareStack` in `asgi.py`. Small (~30 lines), a standard pattern, chosen over shipping the live feature dead or falling back to REST polling — polling would have undermined the whole point of the real-time design by lagging behind the push-notification fan-out reporting the same events near-instantly.

Flagged at the time, not yet confirmed: whether this middleware, once applied globally to the ASGI router, would reveal the same gap already existed for the chat WebSocket on real mobile connections (as opposed to browser/session-auth testing). **This was confirmed true the next day** — see the frontend build entry below.

---

## 2026-07-12 — Frontend Feed / Search / Notifications / Live build

Frontend build against the live REST + WS API. Verification gate: `npx tsc --noEmit` clean across the whole app after every step; backend `manage.py check` clean throughout. Not run on a device/emulator — none available in this environment.

**Step 0 audit surfaced three wrong assumptions going in:**
1. Media/notification deps (`expo-video`, `expo-notifications`, `expo-image-picker`) were assumed possibly-present — all were actually absent, installed fresh via `expo install` (SDK-54 compatible versions).
2. It was assumed a client WebSocket already existed for chat to reuse — a full grep found zero WS client code anywhere; the WS client built this session was entirely net-new.
3. **Confirmed the previous day's flagged item:** `ChatConsumer` had the identical JWT auth bug all along — same `scope['user']` + `is_authenticated` guard pattern, no workaround. It only ever worked under browser/session auth; every JWT mobile connection would have been rejected exactly like `MatchConsumer`. The new `JWTAuthMiddleware` fixed chat too, as a confirmed side effect, not a hopeful guess.
4. It was also implicitly assumed the feed API was paginated — it wasn't. `FeedView`/`GlobalFeedView`/search/notifications all returned flat lists (For You capped server-side at 100; Following uncapped), no page/cursor param. This meant "infinite scroll" wasn't buildable against the API as it existed at the start of this session — the client was built to render the returned list with pull-to-refresh only, and pagination was picked up as its own follow-up the same day (see below).

**What got built:** backend `JWTAuthMiddleware`, then eight frontend steps covering API clients/hooks, feed post-rendering components (including a long-press reaction tapback, confirmed with the user over a persistent icon row), the Home feed screen, the compose flow (direct device→Mux/S3 upload), post detail + threaded comments, search, push token registration + notification list, and the live match WebSocket panel.

**Decisions made, not pre-specified:** reaction UX = long-press tapback (confirmed with user). Live view = inside Match Detail's live state, no 6th tab (confirmed with user). Quote/repost embedding: since `repost_of` comes back as a bare pk, the quoted/original post is fetched lazily by id and embedded, rather than the API being changed to inline it.

**Security note (per an explicit request to think through this):** WS auth passes the short-lived access token (not refresh) in the query string. Whether that token lands in access logs depends on the production proxy config, which isn't set in this repo yet (dev's `runserver`/`daphne` don't persist WS query strings by default). Flagged for the eventual production proxy: don't log full WS query strings, keep the access-token TTL short.

**Verified vs. not verified at the end of this session:** `tsc --noEmit` clean whole-app, backend `manage.py check` clean, `JWTAuthMiddleware` unit-tested (valid/absent/garbage token) — all confirmed. Nothing was run visually or at runtime on an actual device/emulator (none available): the Mux/S3 direct upload, `expo-video` HLS playback, push registration (needs a real EAS `projectId`), and the live WebSocket all need a real device + live services to exercise end-to-end. Known product gaps surfaced but not built this session: no Profile screen (so People-search rows and follow/mention notifications are inert on tap), infinite-scroll pagination, `winnie_insight` posts render as text + badge only.

---

## 2026-07-12 — Post-build fixes: pagination + Profile scope decision

**Pagination, confirmed as a real gap, not scope creep** — an unpaginated feed with a hard 100-item cap is a dead end past 100 posts, not a degraded experience. Decided approach: `CursorPagination` for Following (matches its stable reverse-chronological ordering), offset/page pagination for For You against the merged-score endpoint. **Deliberately not a stabilized/cached ranked-list snapshot at first** — reasoned as "real machinery to solve a consistency problem nobody's actually hit yet," accepting minor rank drift between page loads as a fair trade-off for a dynamically-scored feed. (This reasoning was revisited and partially reversed later the same day — see below.) The hardcoded 100-item cap was removed entirely.

**Profile screen — deferred to its own scoped session.** A full Profile build was judged out of scope for the Feed/Search/Notifications arc — genuinely Users-app work, matching how Feed and Search had each gotten their own dedicated planning pass rather than being squeezed into an adjacent build. Interim: People-search rows and follow/mention notifications should fail gracefully on tap (no crash) — no placeholder UI investment for this gap right now.

**Pagination — built and verified.** `FollowingCursorPagination` (`page_size=20`, ordering `(-created_at, -id)`) set as `FeedView`'s pagination class. `FeedLimitOffsetPagination` (`default_limit=20`, `max_limit=50`) for For You — `GlobalFeedView.list` now ranks the whole candidate pool (the old page-limit slice constant was deleted) and paginates the ranked list. Frontend converted to `useInfiniteQuery` on both feeds; `useReactToPost`'s optimistic patch was rewritten to walk the new `InfiniteData<Paginated<Post>>` shape (patch every page's results) instead of a flat array, since the feed cache shape itself had changed.

Verified: Following cursor returns 20 then a disjoint 5 across the boundary; For You returns a consistent count across two disjoint pages once the trending pool was populated. `manage.py check` clean, `tsc --noEmit` clean. Graceful-fail confirmed with no code change needed (`PeopleRow` was already a non-pressable `View`; notification taps already resolved to no navigation). Still not run on a device — the client infinite-scroll/next-URL handshake is typed-and-wired but unexercised at runtime.

**For You pagination corrected to a per-user frozen-list cache, same day.** The initial "live-recomputed offset pagination" approach shipped just hours earlier was judged to risk more than "minor drift" — a post's score shifting between page requests could move it across a page boundary mid-scroll, producing visible duplicate/skipped posts, not just reordering. Corrected: on first load or pull-to-refresh, the ranked candidate pool is computed once and the **ordered post-id list** is cached in Redis with a TTL; subsequent offset pages slice that frozen list rather than rescoring per page. TTL was set to 600s (10 minutes), bumped up from an initial 180s — reasoned that since the trending job itself only recomputes every 15-30 minutes, a shorter TTL bought no real freshness, it just made the mid-scroll re-freeze seam more frequent for no benefit. Regenerates on TTL expiry or explicit pull-to-refresh; deliberately per-user and on-demand, not a scheduled precompute-for-everyone job.

Verified: after page 0 froze a 30-id list, reactions were spammed and `compute_trending` re-run to change scores drastically — `page(offset=10)` still returned the frozen slice, not the new scores; pages didn't overlap; `offset=0` correctly regenerated. `manage.py check` clean. Accepted boundary case: if the TTL expires mid-scroll, the next page rebuilds and slices the new order at that offset — a rare, one-time seam inherent to any TTL-based freeze.

**Expo Go crash on boot — found and fixed.** The first on-device run, in Expo Go, hard-crashed at app boot. Root cause: remote push was removed from Expo Go in SDK 53, and merely *importing* `expo-notifications` runs its push auto-registration side effect (`DevicePushTokenAutoRegistration.fx.js`), which throws **at module-import time** — before any of `useRegisterPushToken`'s own try/catch logic could ever run. The static top-level `import * as Notifications from 'expo-notifications'` (pulled in by the app's root layout) triggered this on every launch. Fixed by detecting Expo Go via `Constants.executionEnvironment` and, when true, early-returning before doing anything and loading `expo-notifications` through a **dynamic `import()` inside the effect** instead of a static top-level import — so in Expo Go the module (and its throwing side effect) never evaluates at all. Push still works in a dev/production build; the polled in-app notification list was never affected. `tsc --noEmit` clean.

---

## Chat & Communities — gap-closure decision session (date not recorded)

Grounded in two live-code audits done directly against `chat/`, `communities/`, `ball/asgi.py`, and `ball/ws_auth.py` (not memory), followed by a full decision pass completed before any code was written for these two apps — per an explicit instruction to finish deciding before tasking implementation. Frontend for both apps was confirmed genuinely untouched (one placeholder shell in `chat.tsx`) — this entire planning session was backend-only.

The decisions themselves (creation validation, moderation scope, typing/read-receipts, the new lean chat-poll design, the DM permission tightening, the new message/post types, `MatchRoom` auto-creation, and the new `CommunityRoom` linking model) are recorded as current planned/decided design directly in `CLAUDE.md`'s Chat and Communities sections, each explicitly marked there as "decided, not yet built" where it diverges from what's actually live in the code today. No separate narrative is preserved here beyond this pointer, since the source material for this particular session was already almost entirely decision-shaped rather than narrative — there wasn't a "what happened" story distinct from "what was decided" to keep separate.

---

## 2026-07-13 — Chat & Communities gap-closure build (Steps 1-10)

Implementation session executing the decision pass logged in the previous entry. All 10 steps built in order, `manage.py check` clean, both migrations generated and applied (`chat/0002_membership_last_read_at_messagepollvote`, `communities/0002_communitypost_post_type_communityroom`), no pending model changes. A 47-check smoke test (run inside `manage.py shell` in a rolled-back transaction, exercising every step's endpoints/serializers/services against the real local DB) passed 47/47. `CLAUDE.md`'s Chat, Communities, and Live Match sections were rewritten in place to describe the built state — the "decided, not yet built" subsections are gone.

**Reporting divergence:** the session prompt asked for this entry to be appended to `CLAUDE.md`, but this repo's docs were split earlier this same day (spec in `CLAUDE.md`, chronological log here) — appending a session log to the spec is the exact pattern that split removed, so the entry lives here instead.

### What got built, by step

- **Step 1 (creation validation)** — `ConversationCreateSerializer.validate`: `is_public` rejected unless `conversation_type='channel'`; `group` requires ≥1 `participant_ids` entry (creator + one = 2 total); `group`/`channel` require a non-empty `name`. `channel_mode` untouched at the DB level per the walked-back-migration decision — `create()` writes `'open'` explicitly for channels created without a mode.
- **Step 2 (chat moderation)** — `KickMemberView` + `PromoteMemberView` (`/<pk>/members/<user_id>/kick|promote/`), admin-gated via a `_require_admin` helper. Self-kick rejected with "use leave".
- **Step 3 (typing + read receipts)** — `ChatConsumer.receive()` moved to type-dispatch: `{'type': 'typing'}` broadcasts an ephemeral `typing_indicator` group event (never persisted); everything else is a message send. **Backward-compat note:** the old WS contract used `'type'` to carry the *message* type (`text`/`match_card`/…), so dispatch reads `message_type` from a new explicit `'message_type'` key when present, falling back to `'type'` — old clients keep working unchanged; `'typing'` is the one reserved word. This did NOT touch more of the consumer than expected — `receive()` and one new handler method, as anticipated. Read receipts: `Membership.last_read_at` (chose the timestamp over a `last_read_message` FK — matches the model's existing plain-timestamp style, and avoids FK-to-latest-row maintenance), advanced by `MessageListView` on every view; `ConversationSerializer.get_unread_count` now counts messages newer than the viewer's cursor. `Message.is_read` deprecated in place (comment on the field; no longer written anywhere) rather than dropped — no destructive migration.
- **Step 4 (chat poll)** — `MessagePollVote` model exactly as specced (`unique_together(user, message)`, re-vote = `update_or_create`). Poll options in `Message.metadata['options']`; malformed polls (missing/non-list/<2 non-empty options) rejected *before* persisting on both the REST and WS paths. `POST /api/chat/messages/<pk>/poll/vote/` — participant-only (the queryset filters on conversation membership), out-of-range `option_index` → 400. `MessageSerializer.get_poll` renders `{options, counts, total_votes, user_vote}` with live-computed counts.
- **Step 5 (DM tightened)** — the follow-based path now requires `Follow` rows in *both* directions; smoke-verified that a one-way follow is rejected and that mutual contacts alone still pass.
- **Step 6 (`prediction_card`)** — validated like `match_card` plus one extra rule not in the spec but implied by it: the referenced match must actually *have* a non-null `winnie_prediction` (a prediction card with nothing to render is rejected, not silently accepted). `get_prediction_card` returns `{match: MatchCardSerializer data, prediction: winnie_prediction}` pulled live at render, mirroring `match_card`'s no-snapshot convention.
- **Shared-validator extraction (not a numbered step, but load-bearing):** `chat/validators.py::validate_message_payload` now holds the match_card/prediction_card/poll rules once, called by both `MessageSerializer.validate` and `ChatConsumer.save_message` — previously the WS path had its own inline copy of the match_card check, which is exactly how the two paths would have drifted once poll/prediction_card landed. The consumer's `save_message` return shape changed from `message|None` to `(message, error)` so the WS client gets the *specific* validation failure instead of a hardcoded "invalid match_id" for every error.
- **Step 7 (communities)** — all five closures: `validate_match_id` on post create (plus `match_object` requires a `match_id`); `post_type` field (`text`/`match_object`/`poll`/`winnie_insight`, default `text`, mirroring feed/chat); `PinPostView` toggle (moderator-only); `KickCommunityMemberView`/`PromoteCommunityMemberView` (moderator-only, same minimal scope as chat's); membership check in `CommunityPostVoteView` (non-members → 403).
- **Step 8 (`MatchRoom` auto-creation)** — **confirmed genuinely absent first** (grep of the whole matches app: the model existed, nothing anywhere created rows — the earlier audit was right, no duplicate path risk). Built `matches/services.py::ensure_match_room` (idempotent; creates the backing `Conversation` as `channel`/`open`/public, `created_by=None`) and wired it into `check_for_finished_matches` at the `scheduled → live` transition (`was_live` tracked alongside the existing `was_finished`), guarded so a chat-side failure can't break match sync — same defensive pattern as the recap-post hook.
- **Step 9 (`CommunityRoom`)** — one-to-one `Community` ↔ `Conversation`, moderator-only enablement via `POST /<pk>/room/create/`. **Interpretation beyond the spec letter:** enabling a room backfills all *current* community members into the channel (the spec only defined go-forward sync; a room created for an established community would otherwise start empty, which contradicts "membership syncs"). The enabling moderator gets channel admin as the channel's creator; everyone else backfills as plain member — roles still not synced. Bidirectional sync in `communities/services.py`, called explicitly from `JoinCommunityView` (both toggle directions), `JoinChannelView`, `LeaveConversationView`, and both kick views (a kick is a removal, so it mirrors too — spec said "leaving mirrors", kicks were folded in as the same operation). View-driven, not signals, so no mutual-trigger recursion is possible.
- **Step 10 (`goal_event`)** — `create_goal_event_message` in `matches/tasks.py`, called from `sync_live_match_events` for new `event_type='goal'` rows only. Message authored by the feed system account `ball` (reused `get_system_user` — a `Message.sender` FK needs an author, and the system voice is the right one), content "⚽ scorer (team) minute'", metadata `{scorer, team, minute, assist, home_score, away_score}`. Two additions beyond the spec letter, both flagged: (a) missed penalties are skipped (API-Football files them under the Goal event type, `detail` containing "Missed" — same quirk the recap scorer list and Facts tab already handle; posting a goal message for a miss would be wrong); (b) the new message is also broadcast into the room's `chat_{conversation_id}` group in the exact shape of a normal send, so connected clients see the goal live rather than on refresh. The room lookup goes through `ensure_match_room` defensively — if the Step 8 hook somehow didn't fire for a match, the first goal self-heals it.

### Verification

- `manage.py check` clean; `makemigrations --check` reports no pending changes; both new migrations applied to the local DB.
- 47/47 smoke checks passed, covering: all four Step 1 rejections + the open-mode default; one-way-follow rejection vs mutual-follow and mutual-contacts acceptance; non-admin 403 vs admin kick/promote; `last_read_at` set on view + unread count 0→1 across a new message; malformed-poll rejections, vote, re-vote-updates-not-duplicates, rendering shape, out-of-range index; prediction_card's three validation cases + rendering; bad-`match_id` rejection and `match_object` post creation; non-member vote 403 vs member vote; non-mod pin 403 vs mod pin; community promote/kick; room creation + channel shape + backfill-as-admin; all four membership-sync directions + roles-not-synced; `ensure_match_room` create/idempotency/shape; goal message creation with correct metadata, missed-penalty skip, and self-healing room creation.
- **Not verified (same class as prior sessions' live-data caveats):** the `scheduled → live` hook inside `check_for_finished_matches` was verified at the `ensure_match_room` unit level, not by running the task against a real API-Football status transition (needs a real near-term fixture, same blocker as `sync_live_match_events` end-to-end). The WS typing-indicator round-trip is verified at the code level only — no WS client exists yet (frontend untouched); it needs the frontend follow-up to exercise against a running server.

### Divergences from the prompt, consolidated

1. Session log appended here, not to `CLAUDE.md` (docs were split earlier today; noted above).
2. `prediction_card` additionally requires the match to have a prediction (implied, made explicit).
3. `CommunityRoom` enablement backfills existing members; enabling moderator becomes channel admin.
4. Kicks mirror across the community↔channel link, treated as a form of leaving.
5. `goal_event` skips missed penalties and live-broadcasts into the room's chat group.
6. WS `receive()` keeps the legacy `'type'`-as-message-type contract working via fallback; `'message_type'` is the new explicit key.

Nothing is blocked. The natural next task is the frontend for Chat + Communities (the placeholder shell), which now has a complete backend surface to build against.

---

## 2026-07-13 — Post-build corrections: kick-mirroring asymmetry + WS fallback removal

Same-day follow-up after the user reviewed the gap-closure build. Two corrections, both smoke-tested (14/14 checks, rolled-back transaction against the real local DB), `manage.py check` clean, no new migrations needed.

### 1. Kick-mirroring made asymmetric (was: symmetric, an over-generalization in the build)

The build had folded kicks into "leaving mirrors both directions" — so a **channel admin** kicking someone out of a community's companion channel also deleted their `CommunityMembership`. On review that's an authority leak: roles are deliberately not synced across the link, so a channel admin holds no community authority — but the symmetric mirror handed them exactly that (community-member removal) through the side door.

**Fixed:** the cascade call was removed from chat's `KickMemberView`. Community-moderator kicks (`KickCommunityMemberView`) still cascade to channel removal — the community is the parent space and the moderator does hold that authority. Voluntary joins/leaves still sync bidirectionally, unchanged. The `communities/services.py` docstring now states the asymmetry principle explicitly: sync follows where the authority lives.

**Smoke-verified both directions explicitly** (same discipline as the roles-not-synced check last round): community-mod kick removes both memberships; channel-admin kick removes only the channel membership and the target's `CommunityMembership` survives; voluntary channel leave still mirrors to the community.

### 2. WS implicit-message fallback removed — strict type-dispatch now required

Before changing anything, the fallback was analyzed as requested. What actually fell into it:

- **No `type` key at all** → treated as `message_type='text'` → accepted and persisted as a text message.
- **`type` = a valid message_type string** (`'text'`, `'match_card'`, `'poll'`, …) → treated as that message type, validated by the shared validator (the legacy pre-Step-3 contract).
- **`type` = anything else** (`'ping'`, `'read'`, a typo…) → fell through to the message path as `message_type='<that string>'`, matched **no branch** of the shared validator (which returns no-error for unknown types), and **persisted as a junk `Message` row with an out-of-choices `message_type`** — Django doesn't enforce `choices` at the DB level and `.create()` skips model validation. So the fallback wasn't just legacy plumbing; it was a silent-garbage-write hole.

**Dependency check:** grep of the entire frontend confirmed the only WS client in the app is `useMatchSocket` — the match socket, receive-only, never sends chat payloads — and `chat/tests.py` is an empty stub. Nothing real ever depended on the pre-Step-3 shape (chat's frontend WS client is entirely unbuilt). Per the user's stated lean given that fact, the fallback was removed rather than maintained.

**New strict contract** (`ChatConsumer.receive`): exactly two event types accepted — `{'type': 'typing', 'is_typing'}` and `{'type': 'message', 'message_type', 'content', 'match_id', 'metadata'}` (`message_type` defaults to `'text'`). Missing/unknown `type` and malformed JSON get an `{'error': ...}` frame and are dropped, never persisted. `save_message` additionally rejects any `message_type` outside the model's defined choices — closing the junk-row hole on the WS path (REST already had this via DRF's `ChoiceField`).

**Smoke-verified:** typing broadcasts to the group with nothing persisted; missing `type`, unknown `type`, the legacy implicit shape (`{'type': 'text', ...}`), and malformed JSON all get error frames with no group broadcast; `save_message` rejects out-of-choices types and malformed polls through the shared validator. (Consumer tests ran against a stubbed channel layer/send; `save_message`'s rejection paths were exercised via the async wrapper directly — safe because they return before any DB access, avoiding the cross-thread transaction-visibility trap of `database_sync_to_async` inside a rolled-back test transaction. The happy persist path was already covered by the previous round's REST tests.)

`CLAUDE.md`'s Chat (moderation scope + WS contract) and Communities (membership-sync) sections were updated in place to describe the corrected behavior — "bidirectional, both directions" now reads as voluntary-bidirectional with asymmetric kicks, and the WS section documents the strict contract with no fallback.

---

## 2026-07-13 — Chat & Communities frontend build (Steps 0-9) + three backend enabler fixes

UI/client build against the finished backend (same-day follow-on to the gap-closure and correction sessions above). Verification: `npx tsc --noEmit` clean across the whole app; backend `manage.py check` clean, no new migrations; a 10/10 backend smoke test for the enabler endpoints added this session. **Not run on a device/emulator** — same environment constraint as every prior frontend session; see "Multi-client verification debt" below for what that specifically leaves unproven.

### Step 0 findings — one real spec/reality surprise, two enumeration gaps

- Confirmed unchanged: no chat/communities API client or hooks existed anywhere; `chat.tsx` was still the segmented placeholder shell; `useMatchSocket` is receive-only (exposes no send path — its extension to sending is genuinely new work, as assumed).
- **Surprise: `GET /api/matches/<pk>/room/` (`MatchRoomView`) already existed and lazily auto-creates a MatchRoom + auto-joins the requester** — a creation path that predates this session's `ensure_match_room` and that neither earlier audit surfaced (those audits inspected `matches/tasks.py` and the models, not this view). The two paths produced identical conversation shapes (channel/open/public, same name format) — no semantic drift, but duplicated creation logic. **Reconciled**: `MatchRoomView` now calls `ensure_match_room` and keeps its auto-join; smoke-verified (lazy create, shape, auto-join, idempotency across two users).
- **Gap: no member-list endpoint existed in either app.** `ConversationSerializer` exposes participants but only the *viewer's* membership role; `CommunitySerializer` exposes only `members_count`. Kick/promote UI ("surfaced contextually on the member list") had nothing to enumerate. Added `GET /api/chat/<pk>/members/` (participant-only) and `GET /api/communities/<pk>/members/` (public, matching community visibility), both returning memberships with roles.
- **Gap: the client couldn't discover an existing companion channel.** `createCommunityRoom` returns `conversation_id`, but a returning member of a community with an already-enabled channel had no way to find it. Added `room_conversation_id` (nullable) to `CommunitySerializer`.

### What got built (frontend)

- **Step 1** — `src/api/chat.ts` + `src/api/communities.ts` (types mirror the serializers exactly) and `src/hooks/useChat.ts` + `useCommunities.ts` (key-factory + TanStack Query, matching the codebase pattern). Cross-cutting invalidations encode the sync semantics: community join/leave/kick invalidate the conversations list (membership may have cascaded); listing messages invalidates conversations (the read cursor advanced server-side). `extractApiError` flattens DRF error bodies so permission rejections surface their real reason.
- **Step 2** — `src/hooks/useChatSocket.ts`: bidirectional, per-conversation. Reuses `useMatchSocket`'s JWT/`?token=`/lifecycle pattern; sends exactly the strict contract (`{type:'typing'}` / `{type:'message', message_type, ...}`). Backend `{error}` frames (which carry no `type` key) are parsed and surfaced as `lastError` — the send path does not assume success. Typing state auto-expires client-side after 4s and is cleared instantly when that sender's message arrives. Design decision: live `chat_message` events for `match_card`/`prediction_card`/`poll` trigger a REST refetch instead of an optimistic append, because the WS group event is flattened and lacks the nested render payloads those types need; `text`/`goal_event` append directly.
- **Step 3** — `MessageBubble` (five treatments: text bubble; tappable match card; match+Winnie prediction card rendering defensively over the Winnie-owned JSON shape; inline poll with vote bars/re-vote/live counts; centered `goal_event` system card with no avatar or reply affordance, built against the real metadata shape the backend writes — still needs a live fixture to see fire for real). `ChatThread` (reusable: REST+live merge, typing indicator, composer with typing throttle, in-chat poll creation modal, broadcast-channel gating with an explanatory non-admin state). `chat/[id].tsx` thread screen; Chats segment of `chat.tsx` (unread badges, last-message previews per type).
- **Step 4** — `chat/new.tsx`: DM (single-select via the existing autocomplete endpoint, helper text states the mutual-follow rule up front, and a 400 shows the backend's actual rejection reason inline); Group (name + multi-select ≥1 other); Channel (name, description, public toggle — mode defaults to `open` server-side). `chat/channels.tsx`: public-channel browse/join/open.
- **Step 5** — member modal on the thread screen: roles badged, admin-only kick (confirm dialog) and promote. Channel-scoped by design — the copy makes no community claims, per the asymmetric-kick fix.
- **Steps 6-7** — Communities segment (My/Discover, join-toggle, create modal) + `community/[id].tsx`: post feed in server order, member-gated composer, voting that tells non-members *why* ("Join the community to vote" pre-flight alert + persistent hint), moderator pin/unpin + delete action sheet, member modal with moderator kick/promote — the kick confirm explicitly says the member will also be removed from the community's chat channel (the cascade direction that *does* exist).
- **Step 8** — moderator-only "Enable chat" on community detail → creates the room and deep-links into the shared `ChatThread` screen; "Open chat" for anyone once `room_conversation_id` is set. No second thread UI.
- **Step 9** — Match Detail header gains a Chat button → `getMatchRoom(matchId)` → opens `chat/<conversation>` in the same thread screen. First time MatchRoom's chat (human + `goal_event` messages) is reachable in any UI.

Conventions: NativeWind classNames throughout (the old placeholder's `StyleSheet` is gone); `as Href` casts for routes not yet in the generated route types (the codebase's existing pattern — the typed-route union regenerates when the dev server next runs); `conversationTitle` extracted to `src/lib/conversation.ts` rather than exported from a route file.

### Multi-client verification debt (explicit, per the prompt's testing note)

Everything below is code-complete and typecheck-clean but **cannot be verified single-client, and no device/emulator (let alone two) was available in this environment**. These need 2+ concurrently-connected accounts:
- WS message and typing fan-out (Step 2) — own-client optimistic state looks identical whether or not the broadcast reached anyone.
- Bidirectional membership sync observed from the app (Step 8) — join community as A, confirm A's conversations list gained the channel.
- Asymmetric kick observed from the app (Steps 5/8) — community-mod kick removes both sides; channel-admin kick leaves `CommunityMembership` intact. (Backend-verified in the correction session's smoke test; unobserved through the UI.)
- `goal_event` live arrival needs a real live fixture besides; the render was built against the exact backend metadata shape and is testable today via a REST-created mock message.

### Also not built (out of scope, noted rather than silently skipped)

- Sending `match_card`/`prediction_card` from the UI (a "share to chat" flow from Match Detail) — the prompt scoped card *rendering*; a composition entry point for cards was never specified anywhere. Rendering is fully wired for messages created via REST/system paths.
- Read receipts display is the unread-count/cursor behavior the backend defines; no per-message "seen by" UI (the backend has no per-message receipt data — `last_read_at` is a cursor).

---

## 2026-07-14 — Profile, Block & Report build (Steps 1-6)

Full vertical: User-model additions, a real cross-cutting Block, user Reporting, the aggregate profile endpoints, and the Profile / Edit-Profile / Block-Report frontend — built on top of the existing Follow / UserLeagueFollow / UserTeamFollow / feed.Post / Comment / chat DM-permission models. Verification: backend `manage.py check` clean, one migration (`users.0004`), a scripted end-to-end smoke test (below) passing; frontend `npx tsc --noEmit` clean across the app. **Not run on a device/emulator** — same environment constraint as every prior frontend session.

### Backend

- **Step 1 — User fields.** `bio` already existed (280-char). Added `favorite_team_id` + `favorite_team_name` (denormalized, matching `UserTeamFollow` — no Team model introduced), `favorite_league` (FK → real `League`, matching `UserLeagueFollow`), and `pinned_post` (nullable FK → `feed.Post`, `SET_NULL`). No exclusivity validation between team/league (both-set is harmless by design). Pinning is just "point the FK at the new post" — replaces the prior pin with no separate unpin step. `favorite_club` (legacy free-text) left untouched.
- **Step 2 — Block (`users.Block`, unique_together).** All four effects are real, funneled through one shared module `users/blocking.py` (`blocked_user_ids`, `is_blocked_between`, `exclude_blocked_authors`): DM creation hard-rejects a block **before** the mutual-follow check in `ConversationCreateSerializer` (block always wins); creating a Block auto-deletes Follow rows both directions; People search excludes both directions; Feed (Following + For You incl. all three 36.6 candidate pools) and Search (Top/Latest/Media/People) all exclude via the shared helper; profile content is fully hidden when a block exists either way. Unblock = plain delete, no auto-refollow.
- **Step 3 — Report (`users.Report`).** reporter / reported_user / reason enum (spam·harassment·impersonation·other) / optional detail / created_at. User-scoped only; no post/message reporting, no moderation UI (capture only, as specified).
- **Step 4 — Profile endpoints.** `GET /api/users/<username>/profile/` (`ProfileSerializer`: identity, counts, viewer relationship — is_self / is_following / is_followed_by / is_blocked / is_blocked_by — and the pinned post). Four cursor-paginated tabs under `/api/feed/users/<username>/tab/{posts,replies,media,reposts}/`, each reusing an existing author-filtered query, pagination matching `FollowingCursorPagination`. Plus `POST/DELETE /api/users/me/pin/`, `POST/DELETE /api/users/<username>/block/`, `POST /api/users/<username>/report/`.

### Block visibility — the one design call that deviated from a literal reading

The spec says a blocked profile is a "full hide, not just disabled buttons." A literal 404 in both directions was rejected because it makes **unblock unreachable** (no settings "blocked accounts" list is in scope, and a cosmetic-only block was explicitly not wanted). Chosen instead: the aggregate endpoint still resolves, but `ProfileSerializer.to_representation` **masks all content server-side** (bio, avatar, favorites, counts, pinned post → blanked) when a block exists either way, and the tab endpoints return empty. Nothing leaks over the API, so it is a genuine content hide; the frontend renders a blocked state from the flags — "You blocked @x" + an **Unblock** button for the blocker, "This account is unavailable" for the blocked-by side. This keeps the block operable without a separate settings surface.

### Frontend

- `src/api/profile.ts` + `src/hooks/useProfile.ts` (aggregate query, four infinite tab queries gated so only the active tab fetches, follow/block/unblock/report/update/pin mutations with the right invalidations).
- `app/(main)/(app)/profile/[username].tsx` — header (avatar, name, bio, tappable favorite badge → Search prefilled, follower/following counts), action row (Edit Profile for self; Follow + Message + overflow for others), four tabs, pinned post rendered at the top of Posts with a "Pinned" label and de-duped from the list, blocked-state rendering, block confirm dialog (copy states the real effects), report modal (reason picker + optional detail). Message uses the block-aware DM create and surfaces the backend's real rejection reason rather than failing silently.
- `app/(main)/(app)/profile/edit.tsx` — username / bio / avatar-URL form → `PATCH /api/users/me/`, then refreshes the auth store.
- Navigation wired into the previously dead ends: ProfileDrawer "Profile" item, People-search rows, follow/mention notifications, and post authors (`AuthorRow`) all now open profiles. Routes registered in the app Stack. `search.tsx` now reads a `?q=` param for the favorite-badge deep-link.
- Small enablers: `PostCard` gained an optional `onLongPress` (own posts → pin/unpin action sheet); auth store gained `refreshUser` + the new favorite fields.

### On the flagged risk — Feed exclusion across three query paths

The prompt flagged Step 2's Feed exclusion as the one piece with real complexity (Following / For You / Search are three separate paths). It was **not** awkward: `exclude_blocked_authors(qs, user)` dropped in cleanly at each site, and For You needed only a single call because its three candidate pools (affinity/trending/social-proof) are already merged into one queryset before ranking — no per-pool duplication. No messier approach was needed.

### Smoke test (passed)

Two users, mutual follow → block: follows auto-deleted 2→0; `blocked_user_ids` correct both directions; blocker sees 0 of the blocked user's posts; `ProfileSerializer` masks bio/counts for both the blocker and the blocked-by viewer; report row created.

### Not done / debt

- No settings "Blocked accounts" list — unblock is reachable only from the blocked user's profile (deliberate, given the masking design above). A dedicated list is the natural future add.
- Avatar editing is a URL field (no image-upload pipeline exists for user avatars; the media pipeline is post-scoped). Flagged for a future image-picker pass.
- Favorite team/league have no dedicated *setter* UI in Edit Profile (Step 6 specified username/bio/avatar only) — the backend fields + serializer support writes, and the header renders/deep-links them; wiring a picker is a small future task.
- Device-unverified (typecheck-clean only), consistent with prior frontend sessions.

---

## 2026-07-14 — Activity tab (Notifications + People)

Follow-on to the Profile/Block/Report build the same day. **No new models** — entirely new queries over existing `Follow`/`Reaction`/`Comment`/`CommunityMembership`/`chat.Membership`/`Block` data. The Block model was already present (built earlier this session), so blocked-user exclusion is baked in from day one, not retrofitted. Verification: backend `manage.py check` clean, no migrations; scripted end-to-end smoke test passing; frontend `npx tsc --noEmit` clean. Device-unverified, as usual.

### Backend (users app)
- `GET /api/users/activity/followers/` (`NewFollowersView`) — people who follow the viewer minus those already followed back, minus blocked (either direction). Follow-Back is just the existing one-way instant follow; no accept/reject.
- `GET /api/users/activity/suggestions/` (`SuggestedPeopleView`) — three parallel candidate sources merged/deduped, each carrying reason chips `{type, count}`:
  - **interaction** — people the viewer reacted to / commented on, or who engaged the viewer's posts (both directions over `Reaction`/`Comment`).
  - **mutual_follows** — friend-of-friend over `Follow`, count = number of the viewer's follows who follow the candidate.
  - **groups_in_common** — shared `CommunityMembership` + shared `chat.Membership` where `conversation_type='group'`.
  - All exclude self / already-followed / blocked. No weighted ranking (v1): ordered by summed signal, capped at 30. Reasons returned in a fixed priority (mutual_follows → groups_in_common → interaction) so the client shows `reasons[0]` as the primary chip.

Smoke test confirmed: new-followers excludes both the followed-back and the blocked follower; suggestions surface via each source with correct counts; blocked and already-followed users never appear.

### Frontend
- `src/api/people.ts` + `src/hooks/usePeople.ts` (two queries + a `useFollowPerson` mutation reusing `toggleFollow`, invalidating both lists so a followed/dismissed person drops out).
- Bottom tab renamed **Notifications → Activity** (tab title only; route file stays `notifications.tsx` to avoid churn). The screen is now segmented (same control as Chat's Chats/Communities): **Notifications** (existing list, behavior unchanged — extracted verbatim into a `NotificationsSegment`) and **People**.
- People segment: "New followers" rows (Follow-Back) + "Suggested for you" rows (Follow + a reason chip like "12 mutual follows" / "In 2 groups together"). Each row taps through to the profile, has a dismiss (✕) that hides it **client-side only** (v1 — dismissals don't persist across restarts, by design). Pull-to-refresh refetches both lists.

### Out of scope (as specified)
- Contact-sync / "Find friends" from phone contacts — deferred entirely; nothing built toward it (no speculative phone-number capture). Note: a `phone_number`/`phone_hash` field *does* already exist on `User` from the earlier OTP auth work, so if contact-sync is picked up later the hashing primitive is already there — but no suggestion source uses it and none was added.

---

## 2026-07-14 — Blocked Accounts list + Avatar/Banner upload

Two unrelated gap-closers from the Profile session. Verification: backend `manage.py check` clean, one migration (`users.0005_user_banner`); scripted smoke test passing; frontend `npx tsc --noEmit` clean. Device-unverified as usual; S3-dependent paths verified only through their config-guard/validation branches (no live bucket in this env).

### Step 1 — the search-exclusion gap was REAL (flagging as requested)

**Finding: blocked users were findable by exact/prefix username in the search typeahead.** The full People tab (`SearchView._people`) *did* exclude blocked users in both directions — that part was correct. But `AutocompleteView` (the cheap typeahead firing on every keystroke, doing `username__istartswith=q`) had **no block exclusion at all**. So typing a blocked user's handle into the search box surfaced them in the live suggestion dropdown, with their id/username/avatar, even though the full search results tab hid them and the profile was masked.

- **Scope of exposure:** the search-screen autocomplete `users` list only (id, username, avatar — no posts/bio). Not the People tab, not feeds, not profiles — those were all already correctly excluded.
- **How long:** since blocks shipped earlier the same day (2026-07-14) — the exclusion was added to `_people` but the sibling autocomplete path was missed. Short-lived, but real, and exactly the "exact-username lookup" surface the spec worried about.
- **Fix:** added `.exclude(id__in=blocked_user_ids(request.user))` to the autocomplete user query. Smoke-verified both directions, with a passing control (a non-blocking third user still sees both).

### Step 2/3 — Blocked Accounts list
- `GET /api/users/blocked/` (`BlockedAccountsView`) — users the requester has blocked, most-recently-blocked first (via the `blocked_by` reverse relation). The canonical, always-reachable review/unblock surface; unblock reuses the existing `DELETE /api/users/<username>/block/`. The masked stale-link profile view is unchanged and stays scoped to landing on an already-blocked profile — it is not a discovery path; this list is.
- Frontend: `settings/index.tsx` (a small Settings & Privacy hub, Blocked Accounts the one live row) + `settings/blocked.tsx` (list with avatar/username, Unblock with a confirm dialog so it's deliberate). Entry point: the ProfileDrawer "Settings & Privacy" item (previously dead) now routes here.

### Step 4/5 — Avatar + banner upload (reuses 36.9's S3 + Pillow pipeline)
- Backend: new `User.banner` field (X-style wide header). Both avatar and banner stay plain URL fields holding the resulting public S3 URL — the old manual-URL avatar entry is replaced by a real upload flow, **not** a second pipeline. Reused `create_s3_presigned_upload` (now takes a `prefix` so avatars/ and banners/ get their own key namespaces) + a new `finalize_profile_image` that reads the uploaded object back, validates with Pillow, `ImageOps.fit` cover-crops + resizes (avatar 400×400, banner 1500×500), and writes the resized JPEG back to the same key. Endpoints: `POST /api/users/me/image/upload-url/` + `.../finalize/`. Validation: content-type restricted to JPEG/PNG/WebP, 10MB cap, key-prefix guard on finalize; unconfigured S3 → 503 (parity with post photos). Smoke test confirmed the validation branches and the resize math (2000×1200 → 400×400 / 1500×500).
- Frontend: Edit Profile screen now uses `expo-image-picker` with **separate crop UIs** — square (`aspect [1,1]`) for avatar, wide (`aspect [3,1]`) for banner — uploading directly to S3 via the existing `uploadFileToUrl` (XHR progress), finalizing, then refreshing the auth store. Upload progress shows as a % overlay on each image. Avatar/banner persist via their own finalize calls independently of the text Save (which now only patches username/bio). Profile header restructured X-style: banner image at top with the circular avatar overlapping its lower edge (both masked when blocked).

### Known gaps / debt
- HEIC: `expo-image-picker` can hand back `image/heic` on iOS, which the backend rejects (JPEG/PNG/WebP only) → a 400 the UI surfaces. Matches the existing post-photo constraint; not separately solved (would need client-side transcode).
- S3-live paths (presign round-trip, resize-write-back, public URL serving) are unverified against a real bucket — no creds in this env; only the guard/validation/transform logic is proven.
- Settings hub has just the one Blocked Accounts row; the rest of "Settings & Privacy" is still unbuilt.

---

## 2026-07-14 — HEIC 400 investigation (follow-up, no code change)

Investigated the HEIC-rejection flagged in the avatar/banner build before deciding a fix. Findings (verified against installed deps + expo-image-picker 17 types, not a device):

- **It's both, but the missing decode dependency is the root cause.** `pillow-heif` is **not installed** and Pillow 12.3 cannot decode HEIC/HEIF (verified: `.heic`/`.heif` absent from `Image.registered_extensions()`; AVIF is present, HEIC is not). So no HEIC *bytes* can be processed server-side on any path. The profile upload path *additionally* hard-rejects `image/heic` early via its content-type allow-list (jpeg/png/webp) at `upload-url` — that's the visible 400, but even without it the bytes would fail later at the Pillow decode in `finalize_profile_image`.
- **expo-image-picker already hands back JPEG on iOS — no config needed, and none exists.** The picker has no format/output option in v17; but its own type docs describe the returned/base64 payload as "the selected image's **JPEG** data," and `quality` (default 1.0) + the crop editor both re-encode to JPEG. So the *pixel bytes* reaching our backend from an iOS pick are JPEG; genuine raw-HEIC bytes very likely never actually arrive. The residual risk is a **declared-mimeType mismatch**: if the asset's `mimeType` is reported as `image/heic` for a JPEG-bytes file, the profile allow-list falsely rejects a perfectly decodable upload. (`expo-image-manipulator`, which could force an explicit JPEG re-encode + correct mimeType, is **not** installed.)
- **Post-photo pipeline — one-liner:** it has **not** been silently broken in practice. It has no content-type allow-list (so no early rejection) and the actual bytes are JPEG, so `finalize_photo`'s Pillow decode succeeds. But it is **latently fragile**: a true raw-HEIC upload (a non-Expo client, or if Expo changes behavior) would 400 at finalize, and would land an S3 object tagged `image/heic` holding JPEG bytes. The pipeline cannot actually decode HEIC and never could — it only works because the picker pre-converts.

**Recommended fix (deferred to a decision, not applied here — it's a dependency change best validated with a real device + file):** add `pillow-heif` on the backend and `register_heif_opener()` at startup. That makes HEIC genuinely decodable end-to-end for **both** profile and post uploads, removes the latent post-photo fragility, and needs no client change or allow-list widening. Cheaper alternative if a backend dep is unwanted: add `expo-image-manipulator` and normalize every pick to JPEG client-side (guarantees both bytes and declared type), which also fixes the false-rejection for profile images. Not chosen unilaterally because either path adds a dependency and should be confirmed against a real HEIC asset on device.

**Item 1 (S3 live-path verification) — unchanged standing item:** presign round-trip, resize-write-back, and public serving still need a real bucket + device pass whenever that access is available. No action now.

---

## 2026-07-14 — HEIC support closed (pillow-heif)

Acted on the prior investigation's recommendation. `pillow-heif==1.4.0` added to `requirements.txt` and installed; `register_heif_opener()` now runs at startup in `feed/apps.py::FeedConfig.ready()` (guarded — a missing wheel degrades to "HEIC unsupported" rather than crashing). Because it's a global Pillow registration, it fixes **both** pipelines that go through `feed/media.py` — post photos and profile avatar/banner. The profile upload allow-list now accepts `image/heic`/`image/heif` (finalize re-encodes to JPEG regardless), and `_EXT_FOR_CONTENT_TYPE` maps heic/heif keys.

**Unit-tested (no device):**
- After Django startup, `Image.registered_extensions()` now contains `.heic`/`.heif` — confirms `ready()` fired the registration.
- A genuine in-memory HEIF file encodes → decodes through `PIL.Image.open` → runs the exact finalize transform (cover-crop + resize + JPEG) → avatar 400×400 / banner 1500×500.
- View-level: `upload-url` with `image/heic` now passes the type gate (503 for unconfigured S3, no longer a 400 type rejection); `image/tiff` still 400s, so the allow-list is still real.
- `manage.py check` clean; no migrations.

**Standing device-verification item (unchanged category, flagged NOT proven):** "installed and imports cleanly / decodes a pillow-heif-encoded HEIF" is **not** the same as a real iPhone-camera HEIC asset over the live S3 round-trip. That real-capture leg joins the same standing list as the S3 live-paths — build + unit-test done, real-device confirmation still owed.

---

## 2026-07-14 — Favorite team/league setter (closing the no-setter-UI gap)

The `favorite_team_id`/`favorite_team_name` (denormalized) and `favorite_league` (FK) fields + their profile-header display already existed; this adds the missing way to actually set them. Verification: `manage.py check` clean, **no migrations** (fields pre-existed; the team lookup is a view), scripted smoke test passing, `npx tsc --noEmit` clean. Device-unverified as usual.

### Step 1 — Team lookup (new endpoint, no Team model)
`GET /api/leagues/teams/search/?q=` (`TeamSearchView`) returns distinct `{team_id, team_name, team_logo}` sourced from **`LeagueStanding`** — plain `icontains`, Python-deduped to one row per `team_id`, capped at 30. Queries whatever's synced (not hardcoded to the core 5), so it scales as leagues sync in.

**LeagueStanding as the source — checked, it's good (not a worse source than expected):** 1,567 rows → **1,497 distinct teams across 95 distinct leagues** (well beyond the core 5). No missing-team or staleness problem worth flagging; no fallback table needed. (Aside: `LeagueStanding.Meta.ordering = [league_id, rank]` pollutes a naive `.values('team_name').distinct()` — the view sidesteps this by `order_by('team_name')` + Python dedup on `team_id`, so results are correctly one-per-team.)

### Step 2 — League lookup (reused, nothing new)
`LeagueListView` already supports `?search=` (name `icontains`) and the frontend `getLeagues({search})` already calls it (scoped to `featured_only`). Reused as-is — no new endpoint.

### Step 3 — Edit Profile endpoint (already accepted them)
`ProfileUpdateSerializer` already listed `favorite_team_id`/`favorite_team_name`/`favorite_league` from the original Profile build, and `ProfileView` PATCHes partially. Confirmed via smoke test: set all three, then clear team-only (league persists) and clear league-only (team untouched) — **independent, each clearable**, matching the no-exclusivity decision. No backend change was needed here beyond confirmation.

### Steps 4/5 — Frontend pickers + save
`src/components/profile/FavoritePickerModal.tsx` — a generic search-as-you-type modal (debounced `useQuery`, result list, explicit **Clear selection** row shown when something's set). Edit Profile gains **two independent rows** (Favorite Team, Favorite League), each opening its own instance — team searches `searchTeams`, league searches `getLeagues({search})`. Selections feed the **same single Save** as username/bio (one PATCH: `favorite_team_id`/`favorite_team_name` as a pair, `favorite_league` as a pk-or-null) — no separate confirmation step. The FK uses the League's Django pk (`league.id`), which is what `favorite_league` points at (not `league_id`). Note: an already-set favorite team shows no logo until re-picked (the denormalized pair stores only id+name, no logo) — league logos come through fine via `favorite_league_logo`.

Closes the "Favorite team/league have no setter UI" gap noted in CLAUDE.md §5.1.

---

## 2026-07-16 — favorite_team_logo (closing the team-crest asymmetry)

Small follow-up: the favorite-team pair stored only id+name, so a profile's team chip rendered without a crest while the league chip (which has `favorite_league_logo`) showed one — a visible asymmetry on the same header. Added `User.favorite_team_logo` (URLField, migration `users.0006`), mirroring `favorite_league_logo`. Threaded through `ProfileUpdateSerializer` (accept/store), `UserSerializer` + `ProfileSerializer` (expose, incl. the block-mask), and the frontend types/store. `TeamSearchView` already returned `team_logo`, so it's just captured at set-time and sent on the same single Save; cleared as part of the team group.

Also reworked the profile header: `FavoriteBadge` (single collapsed chip, team-preferred) → `FavoriteBadges` rendering team and league as **two independent chips side by side** when both set, each with its own crest — matching the fields' independence rather than implying a choice between them. Verified: logo saves, profile endpoint exposes it, clearing the team clears the logo; `manage.py check` + `tsc` clean. No new endpoint. Device-unverified as usual.
