# Pack drafts

Richer packs that fail `scripts/pack-check.ts` and so are not live.
`data/catalogue/` is an exact copy of the Supabase `packs` table (synced by
`.github/workflows/catalogue-sync.yml`); drafts live here so the sync cannot
overwrite them.

| draft | places | live version in Supabase |
|---|---|---|
| croatia | 174 | none |
| ireland | 130 | 56 places |
| nepal | 111 | 67 places |
| norway | 150 | 52 places |
| switzerland | 139 | 64 places |

The scheduled pack-research task finishes these: it researches each bed until the
draft passes the checker, then loads it.
