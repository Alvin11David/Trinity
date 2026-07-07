"""
Sync and flag featured leagues for a given country.
Usage: python sync_featured.py <country_name> [--list-only]
"""
import django
import os
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ball.settings')
django.setup()

from matches.api_football_client import api_football_client
from leagues.models import League

def sync_country(country):
    """Sync all leagues for a country from API-Football."""
    print(f"\n{'='*60}")
    print(f"SYNCING: {country}")
    print('='*60)
    data = api_football_client.get_leagues(country=country)
    if not data:
        print(f"  ERROR: Could not fetch leagues for {country}")
        return False
    updated = 0
    for entry in data:
        league_info = entry['league']
        country_info = entry.get('country', {})
        seasons = entry.get('seasons', [])
        current_season = next((s['year'] for s in seasons if s.get('current')), None)
        League.objects.update_or_create(
            league_id=league_info['id'],
            defaults={
                'name': league_info['name'],
                'league_type': league_info.get('type'),
                'logo': league_info.get('logo'),
                'country_name': country_info.get('name'),
                'country_code': country_info.get('code'),
                'country_flag': country_info.get('flag'),
                'current_season': current_season,
            }
        )
        updated += 1
    print(f"  Synced {updated} leagues")
    return True

def search_competition(country_name, competition_name):
    """Search for a competition by name in API-Football and return matching leagues."""
    results = api_football_client.get_leagues(search=competition_name)
    if not results:
        return []
    # Filter to the correct country
    matches = []
    for r in results:
        league = r['league']
        c_info = r.get('country', {})
        c_name = (c_info.get('name') or '').lower()
        # Handle special cases like England/UK name variations
        if c_name == country_name.lower():
            matches.append(r)
    return matches

def find_in_db(country_name, search_terms):
    """Find leagues in DB by searching name and filtering by country."""
    qs = League.objects.filter(country_name__iexact=country_name)
    results = []
    for term in search_terms:
        match = qs.filter(name__icontains=term).first()
        if match:
            results.append(match)
    return results

def show_all_synced(country):
    """Show all synced leagues for a country."""
    leagues = League.objects.filter(country_name__iexact=country).order_by('league_type', 'name')
    print(f"\nAll leagues for {country} ({leagues.count()} total):")
    for l in leagues:
        featured = "★" if l.is_featured else " "
        core = "C" if l.is_core_league else " "
        print(f"  [{featured}{core}] ID={l.league_id:>4} | {l.name:<45} | {l.league_type or '?'}")

def set_featured(league_id, name_hint=""):
    """Set is_featured=True for a league by ID."""
    try:
        l = League.objects.get(league_id=league_id)
        l.is_featured = True
        l.save()
        print(f"  ✓ FLAGGED: ID={l.league_id} {l.name} ({l.country_name})")
        return True
    except League.DoesNotExist:
        print(f"  ✗ NOT FOUND: ID={league_id} ({name_hint}) — not in DB")
        return False

if __name__ == '__main__':
    country = sys.argv[1] if len(sys.argv) > 1 else None
    list_only = '--list-only' in sys.argv

    if not country:
        print("Usage: python sync_featured.py <country_name> [--list-only]")
        sys.exit(1)

    # Step 1: Sync from API
    if not list_only:
        sync_country(country)

    # Step 2: Show what we have
    show_all_synced(country)
