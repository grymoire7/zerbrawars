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
