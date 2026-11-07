# Contributing to Flop Doctor

Thanks for helping. Small, focused pull requests are easiest to review.

## Set up

```bash
npm install
npm run dev        # http://localhost:5173, runs on sample data with no keys
```

The backend and console scripts need [Deno](https://deno.com) 2.x.

## Before you open a pull request

```bash
npm run typecheck
npm test                 # scoring and findings
deno task test:backend   # full pipeline against a fake Oriane and model
npm run build
```

If you changed a screen, run `npm run screenshots` so the README images stay current. One-time setup: `npm i -D playwright && npx playwright install chromium`.

## Where things live

- Logic shared by the app, the Edge Functions and the scripts goes in `supabase/functions/_shared/`. Keep `types.ts`, `scoring.ts`, `findings.ts` and `view.ts` free of runtime-specific imports, because the browser imports them too.
- Anything the model returns goes through a validator in `prompts.ts`. Evidence must cite a post id from the input; anything else is dropped.
- Per-clip findings on the wheel come from data, not the model. If a signal isn't in the data, skip the finding rather than guess.

## Data and privacy

- Use the sample creators or your own account in tests, screenshots and issues. Don't commit other people's scan data.
- Never commit API keys. `.env` and `scripts/.env` are git-ignored.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
