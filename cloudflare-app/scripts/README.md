# Data ingestion

`import_sources.py` is the standalone replacement for the Django/DynamoDB
import commands. It fetches the same NYC Open Data sources and upserts into
Supabase through the Data API; it does not require Django, boto3, or DynamoDB.

LinkNYC merges the kiosk status and Wi-Fi hotspot datasets by source ID and
five-decimal-place coordinates, matching the old Django importer.

Run from the repository root:

```bash
python3 cloudflare-app/scripts/import_sources.py all
python3 cloudflare-app/scripts/import_sources.py restrooms fountains linknyc
```

The script loads `.env.postgres` automatically and accepts `DATABASE_API` plus
`PUBLISHABLE_DB_KEY`, or `SUPABASE_URL` plus `SUPABASE_PUBLISHABLE_KEY`.

Run `cloudflare-app/supabase/schema.sql` first. Source rows are keyed by
`(amenity_type_id, external_id)`, retain their source name and raw JSON, and
can be safely re-imported. The importer intentionally does not deactivate
missing rows yet: source deletions need a review policy before they can safely
be treated as inactive.
