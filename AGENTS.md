# Project Context

This is a typescript project using raw-http.

Read .codesight/wiki/index.md for orientation (WHERE things live). Then read actual source files before implementing. Wiki articles are navigation aids, not implementation guides.
Read .codesight/CODESIGHT.md for the complete AI context map including all routes, schema, components, libraries, config, middleware, and dependency graph.
The codesight wiki is kept up-to-date with a pre-commit hook.

## Commands

Node comes from mise (`mise.toml`, Node 26); plain `node` in a non-interactive shell may be a different version. Tasks are defined in `mise.toml`; `mise tasks` lists them and `mise run <task>` runs one (use `mise exec -- npm ...` for anything else).

- `mise run check` runs typecheck, lint, format:check, test and build. The individual tasks are `typecheck`, `lint`, `format:check`, `test` and `build`.
- `pitchfork start web` (daemon in `pitchfork.toml`) serves the dev server at http://localhost:5199/. `mise run dev` runs it in the foreground.
- Run `mise run format` only when the whole tree is yours; otherwise run Prettier on the files you edited.

## Releasing

Production (the DreamHost site a remote reviewer plays) only changes when a version tag is pushed. Work lands on `main` without shipping. `.github/workflows/deploy.yml` runs `mise run check` and uploads `dist/` over SFTP. `workflow_dispatch` redeploys an older tag.

1. Bump `"version"` in `package.json` (semver; the tag must be `v` plus that version or the workflow fails).
2. Commit, then `git tag vX.Y.Z` and `git push origin main vX.Y.Z`.

The repo needs four Actions secrets: `DREAMHOST_HOST`, `DREAMHOST_USERNAME`, `DREAMHOST_PASSWORD` and `DREAMHOST_REMOTE_PATH` (the folder on the host the site is served from, for example `/home/USER/zebrawars.example.com/`). The build uses relative asset URLs (`base: "./"` in `vite.config.ts`), so it works from any folder. The upload deletes remote files that are no longer in `dist/`, so point the path at a folder this site owns.
