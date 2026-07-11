from django.contrib.postgres.operations import TrigramExtension
from django.db import migrations


class Migration(migrations.Migration):
    """Enable pg_trgm for trigram similarity / prefix matching used by Search
    (Match name search, Step 6) and Autocomplete (username prefix, Step 9).
    Postgres full-text search itself is built-in and needs no extension."""

    dependencies = [
        ('feed', '0003_comment'),
    ]

    operations = [
        TrigramExtension(),
    ]
