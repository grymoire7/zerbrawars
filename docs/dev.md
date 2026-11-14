# Developer guide

Zebra Wars is a browser game (three.js, TypeScript, Vite, plain DOM) for patients 13 and older with rare immune diseases. This page covers running, checking and deploying it. For what the game is and why, start with `specs/pitch-4.md`. For what is done and what is next, see `plans/beta-plan.md`.

## Setup

Node comes from [mise](https://mise.jdx.dev) (`mise.toml` pins Node 26). Plain `node` in a non-interactive shell may be a different version, so run everything through mise.

```sh
mise install
mise exec -- npm ci
```

## Run

- `mise run dev` serves the dev server at http://localhost:5199/ in the foreground.
- `pitchfork start web` runs the same server as a daemon (see `pitchfork.toml`).
- Add `--host` to the dev command to reach it from a phone on the same network.

Useful URLs: `?seed=7`, `?mode=life`, `?mode=battle`, `?arc=1`, `?facilitator=1`, `?epilogue=0`.

## Check

`mise run check` runs typecheck, lint, format check, tests and the production build. The pieces are also tasks: `typecheck`, `lint`, `format:check`, `test`, `build`. `mise tasks` lists them all.

Run `mise run format` only when the whole tree is yours. Otherwise run Prettier on the files you edited. Commits use the conventional commit format.

## Deploy

The site a remote reviewer plays is on DreamHost. Production only changes when a version tag is pushed, so work can land on `main` without shipping.

`.github/workflows/deploy.yml` runs on a tag that matches `v*`, or by hand with `workflow_dispatch`. It checks that the tag matches the version in `package.json`, runs `mise run check`, and uploads `dist/` over SFTP.

### One-time setup

Add these Actions secrets in the GitHub repo settings (Settings, Secrets and variables, Actions):

| Secret                  | Value                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `DREAMHOST_HOST`        | the SFTP host                                                                        |
| `DREAMHOST_USERNAME`    | the SFTP user                                                                        |
| `DREAMHOST_PASSWORD`    | that user's password                                                                 |
| `DREAMHOST_REMOTE_PATH` | the folder the site is served from, for example `/home/USER/zebrawars.example.com/` |

The upload deletes remote files that are no longer in `dist/`, so point the path at a folder this site owns. The build uses relative asset URLs (`base: "./"` in `vite.config.ts`), so it works from any folder.

### Cutting a release

1. Bump `"version"` in `package.json` ([semver](https://semver.org/): a feature is a minor, a fix is a patch). The tag must be `v` plus that version, or the workflow fails.
2. Commit the bump on `main`.
3. Tag and push:

   ```sh
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

The first release is `v0.1.0`; `package.json` is already at 0.1.0.

### Redeploying an older release

In the repo's Actions tab, choose "Deploy to DreamHost", then "Run workflow", and pick the tag in the "Use workflow from" menu.

## Repo notes

- `docs/internal/` is gitignored and must stay out of git. The repo is public, so never put patient-tester health details in tracked docs.
- `AGENTS.md` (also `CLAUDE.md`) carries the instructions for coding agents.
