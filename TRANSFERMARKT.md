# Transfermarkt Enrichment (via Apify)

Integration spec for enriching Ball's `Player` and `Team` with Transfermarkt data
(market value, MV history, transfers, squad value) that API-Football can't provide.
Second half of the Team-model work — see the FK de-normalization already shipped.

**Status:** spec agreed; schema + `apify_client` + reconcile NOT built yet.
Token-gated (needs `APIFY_API_TOKEN`).

---

## Actor

- **`solidcode/transfermarkt-scraper`** — https://apify.com/solidcode/transfermarkt-scraper
- Chosen because it's the only actor covering player + club + competition + transfer
  records with **MV history**, **transfer history**, and **club squad value**, and it
  returns the fields our auto-match needs (TM id + `dateOfBirth` + club id).
- **Pricing:** flat **$1.00 / 1,000 result rows** (a row = one player/club/competition/
  transfer). No compute charge.
- **Auth:** account-level Apify token (works for any actor). Set
  `APIFY_API_TOKEN=apify_api_...` in `ball/ball/.env`; `settings.py` reads it like
  `API_FOOTBALL_KEY`. Never commit the token.

---

## How we drive it — per COMPETITION (not per player/team)

There is no way to fetch one player without their TM id (which we don't have). The
actor instead expands a **competition code → all clubs → all squads** in one run.
So the sync is league-driven:

1. `League.transfermarkt_code` holds the TM competition code (new field).
2. Run the actor per enabled league with both expansion toggles on.
3. Reconcile the returned club + player rows back to our `Team`/`Player`.

**Scope: core 5 leagues to start** (add `transfermarkt_code` to more `League` rows to
expand — no code change):

| League | API-Football league_id | TM code |
|---|---|---|
| Premier League | 39 | `GB1` |
| La Liga | 140 | `ES1` |
| Serie A | 135 | `IT1` |
| Bundesliga | 78 | `L1` |
| Ligue 1 | 61 | `FR1` |

**Actor input we send** (one run per league):
```json
{
  "startUrls": ["https://www.transfermarkt.com/-/startseite/wettbewerb/GB1"],
  "recordType": "auto",
  "includeCompetitionClubs": true,
  "includeClubSquad": true,
  "includeMarketValueHistory": true,
  "includeTransferHistory": true,
  "includeAchievements": false,
  "includeInjuries": false,
  "language": "com",
  "maxResults": 800
}
```
`language` is the TM **mirror code** (`com`, `de`, `es`, …) — not an ISO code. `com` =
English. A full top-flight league ≈ 20 clubs + ~500–700 players ≈ **$0.50–0.70/run**;
core 5 ≈ $3. Rows carry `recordType`: `player` | `club` | `competition` | `transfer`.

**Client — official `apify-client` SDK** (add `apify-client` to `requirements.txt`):
```python
from apify_client import ApifyClient
client = ApifyClient(settings.APIFY_API_TOKEN)
run = client.actor("solidcode/transfermarkt-scraper").call(run_input=run_input)  # BLOCKS
for item in client.dataset(run["defaultDatasetId"]).iterate_items():
    ...  # route on item["recordType"]
```
`.call()` **blocks until the run finishes** (minutes for a full league) — so the sync
MUST run in a **Celery task / management command**, never inside a web request. Our
`apify_client` wraps this the way `api_football_client` wraps API-Football.

---

## Reconcile (no shared id between TM and API-Football)

Because we drive per-league/per-club, matching is scoped and low-ambiguity:

- **Club** (`recordType: club`): match TM `name` (+ `countryId`) → `Team.name`. Persist
  `Team.transfermarkt_id` + `match_confidence`. Sub-threshold → log, don't force-link.
- **Player** (`recordType: player`): within a matched club's squad, match TM `name` +
  **`dateOfBirth`** → our `Player` on that team. DOB inside a known squad is the strong
  key — sidesteps the TM-club-id problem. Persist `Player.transfermarkt_id` +
  `match_confidence`.

Once `transfermarkt_id` is stored, re-syncs are a direct lookup (matching is one-time).

---

## Schema mapping (what we store)

### League (add)
- `transfermarkt_code` — TM competition code; null = not enriched.

### Team (already has TM columns from Phase 1)
| Column | TM source |
|---|---|
| `transfermarkt_id` | club `id` |
| `squad_value_eur` | `squadMarketValueTotal.value` |
| `squad_acquisition_value_eur` *(add)* | `squadAcquisitionValue.value` |
| `match_confidence`, `tm_synced_at`, `tm_raw` | audit / full payload |
| ~~`transfer_balance_eur`~~ | **not in actor output — leave null / drop** |

### Player (add)
| Column | TM source |
|---|---|
| `transfermarkt_id` | `id` |
| `market_value_eur` | `marketValue.value` |
| `previous_value_eur` | `previousMarketValue.value` |
| `contract_until` (Date) | `contractUntil` / `currentClubContractUntil` |
| `preferred_foot` | mapped from `preferredFootId` (see below) |
| `agent_agency_id` | `consultantAgencyId` (raw id, no name available) |
| `match_confidence`, `tm_synced_at`, `tm_raw` | audit / full payload |

Keep API-Football's `nationality`, `position`, `height`, `birth_place` — better strings
than TM's numeric ids. Don't duplicate.

### PlayerMarketValue (new child) — powers the value-over-time chart
`player` FK · `date` (from `determined`) · `value_eur` · `tm_club_id` · `age`
← from `marketValueHistory[]`.

### PlayerTransfer (new child)
`player` FK · `date` · `from_tm_club_id` · `to_tm_club_id` · `fee_eur` (`feeEur`) ·
`market_value_eur` · `type` (`typeName`) ← from `transferHistory[]`.
Note: club names are **not** in history rows (TM ids only); resolve to `Team.name` via
`Team.transfermarkt_id` reverse-lookup where possible, else keep the id.

---

## ID-only fields — pragmatic handling

TM returns numeric ids for foot / position / nationality / agent / country with no
lookup shipped. Decisions:
- **`preferredFootId`** → map to a word. Likely `1=right, 2=left, 3=both` **BUT VERIFY
  on the first real run** (Haaland came back as `3`) before trusting the map.
- **nationality / position** → keep API-Football's strings; ignore TM's ids.
- **agent** → store `consultantAgencyId` raw (no readable name obtainable here).
- everything else → lives in `tm_raw` for later.

---

## Known caveats

- **No net transfer balance** in club output (`squadAcquisitionValue` = fees paid to
  assemble squad, not a balance). `transfer_balance_eur` has no source.
- **Transfer / MV history reference clubs by TM id, not name.**
- **`preferredFootId` mapping unverified** — confirm empirically first.
- **Stadium capacity** stays from API-Football (`Team.venue_capacity`); TM club record
  has address but no capacity.
- Match quality depends on name/DOB cleanliness — log unmatched rows for review.

---

## Build order (when token is in)

1. Migrations: `League.transfermarkt_code`, `Player` TM cols, `PlayerMarketValue` +
   `PlayerTransfer`, `Team.squad_acquisition_value_eur`; seed the core-5 codes.
2. `apify_client` (mirrors `api_football_client`, wraps the `apify-client` SDK):
   run actor via `.call()`, iterate dataset.
3. `reconcile` + a `SyncTransfermarkt` per-league **Celery task** (`.call()` blocks).
4. Verify matching + the foot-id map on EPL first, then enable the other four.
5. Serializers/endpoints to expose the new fields + the MV chart.
