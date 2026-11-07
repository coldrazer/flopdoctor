# Security

Please don't report security problems in public issues.

Report them privately through this repository's **Security** tab → **Report a vulnerability**. If that option isn't available, open an issue that says only that you have a security report, and a maintainer will contact you.

Useful details: what's affected (app, an Edge Function, a script), how to reproduce it, and the impact.

## What Flop Doctor stores

- Public video metadata and transcripts returned by Oriane, cached in the `api_cache`, `posts` and `scans` tables.
- No passwords, no account access, and nothing is ever posted to a creator's account.
- API keys live only in server-side secrets (Lovable Cloud / Supabase) or in the git-ignored `scripts/.env`.
