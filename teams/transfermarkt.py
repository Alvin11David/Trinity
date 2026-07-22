"""Transfermarkt reconcile + sync (see ball/TRANSFERMARKT.md).

Flow: run the actor for a league's competition code, then match the returned club
and player rows back to our Team/Player by name (+ dateOfBirth for players) and write
the enrichment. Parsing/matching (`process_items`) is deliberately separate from the
paid actor run so it can be tested against a cached dataset.
"""
import logging
import re
import unicodedata
from datetime import date
from difflib import SequenceMatcher

from django.utils import timezone

from .apify_client import apify_transfermarkt_client
from .models import Team, TransfermarktClub

logger = logging.getLogger(__name__)

CLUB_MATCH_THRESHOLD = 0.72
PLAYER_NAME_THRESHOLD = 0.60

# Dropped when normalizing club names so "Manchester City FC" ~ "Manchester City".
_CLUB_STOPWORDS = {'fc', 'cf', 'sc', 'ac', 'afc', 'club', 'de', 'cd', 'ud', 'sd'}


def _norm(s):
    if not s:
        return ''
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-z0-9 ]', ' ', s.lower())
    return ' '.join(t for t in s.split() if t not in _CLUB_STOPWORDS)


def _ratio(a, b):
    return SequenceMatcher(None, _norm(a), _norm(b)).ratio()


def _parse_date(s):
    """TM dates come as 'YYYY-MM-DD' or full ISO with tz — take the date part."""
    if not s:
        return None
    try:
        y, m, d = (int(x) for x in s[:10].split('-'))
        return date(y, m, d)
    except (ValueError, TypeError):
        return None


def _to_int(v):
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


# --------------------------------------------------------------------------- #
# Matching
# --------------------------------------------------------------------------- #
def match_club(tm_club, candidate_teams):
    """Best Team match for a TM club row by normalized-name similarity.
    Returns (Team, confidence) or (None, best_score)."""
    name = tm_club.get('name') or ''
    best, best_score = None, 0.0
    for team in candidate_teams:
        score = _ratio(name, team.name)
        if score > best_score:
            best, best_score = team, score
    if best and best_score >= CLUB_MATCH_THRESHOLD:
        return best, best_score
    return None, best_score


def match_player(tm_player, candidate_players):
    """Best Player match within a club's squad. dateOfBirth is the strong key; name
    similarity breaks ties / handles missing DOB. Returns (Player, confidence)."""
    tm_dob = _parse_date(tm_player.get('dateOfBirth'))
    tm_name = tm_player.get('name') or ''

    dob_matches = []
    for p in candidate_players:
        p_dob = _parse_date(p.birth_date)
        if tm_dob and p_dob and tm_dob == p_dob:
            dob_matches.append(p)

    pool = dob_matches or candidate_players
    best, best_score = None, 0.0
    for p in pool:
        score = _ratio(tm_name, p.name)
        if score > best_score:
            best, best_score = p, score

    if dob_matches:
        # DOB agreement is strong on its own; blend so a clean DOB match wins even
        # with a noisy name ("E. Haaland" vs "Erling Haaland").
        return best, max(best_score, 0.85)
    if best and best_score >= PLAYER_NAME_THRESHOLD:
        return best, best_score
    return None, best_score


# --------------------------------------------------------------------------- #
# Writing
# --------------------------------------------------------------------------- #
def _apply_club(team, tm, conf, now):
    team.transfermarkt_id = _to_int(tm.get('id'))
    team.squad_value_eur = tm.get('squadMarketValueTotalEur')
    team.squad_acquisition_value_eur = (tm.get('squadAcquisitionValue') or {}).get('value')
    team.match_confidence = round(conf, 3)
    team.tm_synced_at = now
    team.tm_raw = tm
    team.save(update_fields=[
        'transfermarkt_id', 'squad_value_eur', 'squad_acquisition_value_eur',
        'match_confidence', 'tm_synced_at', 'tm_raw', 'updated_at',
    ])


def _apply_player(player, tm, conf, now):
    from players.models import PlayerMarketValue, PlayerTransfer

    player.transfermarkt_id = _to_int(tm.get('id'))
    player.market_value_eur = tm.get('marketValueEur')
    player.previous_value_eur = (tm.get('previousMarketValue') or {}).get('value')
    player.contract_until = _parse_date(tm.get('contractUntil'))
    player.preferred_foot = tm.get('preferredFoot')
    player.agent = tm.get('consultantAgencyName')
    player.match_confidence = round(conf, 3)
    player.tm_synced_at = now
    player.tm_raw = tm
    player.save(update_fields=[
        'transfermarkt_id', 'market_value_eur', 'previous_value_eur', 'contract_until',
        'preferred_foot', 'agent', 'match_confidence', 'tm_synced_at', 'tm_raw', 'updated_at',
    ])

    mv_rows = 0
    for h in tm.get('marketValueHistory') or []:
        d = _parse_date(h.get('determined'))
        if not d or h.get('value') is None:
            continue
        PlayerMarketValue.objects.update_or_create(
            player=player, date=d,
            defaults={
                'value_eur': h['value'],
                'tm_club_id': _to_int(h.get('clubId')),
                'age': h.get('age'),
                'season_id': h.get('seasonId'),
            },
        )
        mv_rows += 1

    tr_rows = 0
    for t in tm.get('transferHistory') or []:
        tid = _to_int(t.get('id'))
        if tid is None:
            continue
        PlayerTransfer.objects.update_or_create(
            tm_transfer_id=tid,
            defaults={
                'player': player,
                'date': _parse_date(t.get('date')),
                'from_tm_club_id': _to_int(t.get('fromClubId')),
                'to_tm_club_id': _to_int(t.get('toClubId')),
                'fee_eur': (t.get('fee') or {}).get('value'),
                'market_value_eur': (t.get('marketValue') or {}).get('value'),
                'transfer_type': t.get('type'),
                'season_id': t.get('seasonId'),
            },
        )
        tr_rows += 1

    return mv_rows, tr_rows


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
def process_items(items, candidate_teams):
    """Reconcile a list of actor dataset items against candidate Team rows.
    Pure of the actor call, so testable with any item list. Returns a summary dict."""
    from players.models import Player

    now = timezone.now()
    summary = {
        'clubs_matched': 0, 'clubs_unmatched': 0,
        'players_matched': 0, 'players_unmatched': 0,
        'mv_rows': 0, 'transfer_rows': 0, 'unmatched': [],
    }

    clubs = [i for i in items if i.get('recordType') == 'club']
    players = [i for i in items if i.get('recordType') == 'player']

    # 1) Clubs -> Team; build tm_club_id -> Team for scoping players. Every club
    #    record also seeds the TM club name cache (used to resolve transfer/MV
    #    history club ids -> names), whether or not it matched one of our Teams.
    tm_club_to_team = {}
    for tm in clubs:
        TransfermarktClub.ensure(tm.get('id'), tm.get('name'), tm.get('crestUrl'), tm.get('countryId'))
        team, conf = match_club(tm, candidate_teams)
        if team:
            _apply_club(team, tm, conf, now)
            tm_club_to_team[str(tm.get('id'))] = team
            summary['clubs_matched'] += 1
        else:
            summary['clubs_unmatched'] += 1
            summary['unmatched'].append(f"club {tm.get('name')!r} (best {conf:.2f})")

    # 2) Players -> Player, scoped to their club's squad.
    for tm in players:
        team = tm_club_to_team.get(str(tm.get('currentClubId')))
        candidates = list(Player.objects.filter(team=team)) if team else []
        player, conf = match_player(tm, candidates)
        if player:
            mv, tr = _apply_player(player, tm, conf, now)
            summary['players_matched'] += 1
            summary['mv_rows'] += mv
            summary['transfer_rows'] += tr
        else:
            summary['players_unmatched'] += 1
            summary['unmatched'].append(
                f"player {tm.get('name')!r} dob={tm.get('dateOfBirth')} (best {conf:.2f})")

    return summary


def resolve_unknown_transfer_clubs(max_clubs=300):
    """Fetch names for TM club ids that appear in transfer/MV history but aren't in
    the TransfermarktClub cache yet (historical/foreign clubs not in any synced
    league). Each club is one actor result row (~$0.001). Returns count resolved.

    Also seeds the cache from our matched Teams first (free) — a Team with a
    transfermarkt_id already gives us that club's name/logo."""
    from players.models import PlayerTransfer, PlayerMarketValue

    # Free: seed from matched Teams.
    for t in Team.objects.exclude(transfermarkt_id__isnull=True):
        TransfermarktClub.ensure(t.transfermarkt_id, t.name, t.logo)

    known = set(TransfermarktClub.objects.values_list('pk', flat=True))
    ids = set()
    for f, t in PlayerTransfer.objects.values_list('from_tm_club_id', 'to_tm_club_id'):
        for cid in (f, t):
            if cid and cid not in known:
                ids.add(cid)
    for cid in PlayerMarketValue.objects.values_list('tm_club_id', flat=True):
        if cid and cid not in known:
            ids.add(cid)

    ids = list(ids)[:max_clubs]
    if not ids:
        return 0

    urls = [f'https://www.transfermarkt.com/-/startseite/verein/{cid}' for cid in ids]
    items = apify_transfermarkt_client.run_urls(urls, max_results=len(urls) + 10)
    if items is None:
        return 0

    resolved = 0
    for it in items:
        if it.get('recordType') != 'club':
            continue
        if TransfermarktClub.ensure(it.get('id'), it.get('name'), it.get('crestUrl'), it.get('countryId')):
            resolved += 1
    logger.info(f'resolve_unknown_transfer_clubs: requested {len(ids)}, resolved {resolved}')
    return resolved


def sync_league(league):
    """Run the actor for one League (must have transfermarkt_code) and reconcile.
    Returns a summary dict, or None if disabled / the run failed."""
    from leagues.models import LeagueStanding

    if not league.transfermarkt_code:
        logger.warning(f'League {league.name} has no transfermarkt_code — skipping.')
        return None

    items = apify_transfermarkt_client.run_competition(league.transfermarkt_code)
    if items is None:
        return None

    # Candidate teams: those in this league's standings (narrow, avoids cross-league
    # name collisions); fall back to all teams if we have no standings yet.
    team_ids = set(
        LeagueStanding.objects.filter(league_id=league.league_id)
        .values_list('team_id', flat=True)
    )
    candidate_teams = list(Team.objects.filter(pk__in=team_ids)) if team_ids else list(Team.objects.all())

    summary = process_items(items, candidate_teams)
    logger.info(f'TM sync {league.name}: {summary}')
    return summary
