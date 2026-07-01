# CLAUDE.md — Project Rules

## SOURCE OF TRUTH

The LOCAL FILES in this directory ARE the source of truth.
GitHub and Vercel are DEPLOYMENT TARGETS, not sources to pull from.

## CRITICAL: NEVER DO THESE WITHOUT EXPLICIT CONFIRMATION

- NEVER fetch files from GitHub and write them to disk (this overwrites local work)
- NEVER run `Write` or `Edit` on a file you haven't first read in this session
- NEVER overwrite a src/ or api/ file with content fetched from a remote URL
- NEVER delete or reset local files to match GitHub state

## WORKFLOW

The correct workflow for this project is:
1. Read and edit LOCAL files
2. Push local → GitHub via GitHub REST API (upload, never download)
3. Deploy from GitHub → Vercel via Vercel CLI (`vercel --prod --yes`)

## DEPLOYMENT

Two Vercel projects must be deployed every time:
- `jeu-imitation-project-one` → project ID `prj_IzmfBsC3NqmUoVdXXo64J3EJ2UHQ`
- `jeu-imitation-project` → project ID `prj_AT48tZskTnsqGeD6F7YcGvPxoY3I`

GitHub branch: `claude/interview-game-students-z22T1`

## IF ACCIDENTAL OVERWRITE OCCURS

The Vercel deployment URL contains the last working build.
The dist/assets/*.js bundle contains minified source that can be reverse-engineered.

## TECH STACK

- React + TypeScript + Vite SPA
- Vercel Edge Functions (api/*.ts)
- Redis (Upstash KV) for auth persistence
- OpenAI API: gpt-4.5 for chat (api/chat.ts), gpt-4o-mini for persona creation
- Google Perspective API for moderation (api/moderate.ts)
