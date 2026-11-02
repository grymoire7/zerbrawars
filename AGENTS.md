# Project Context

This is a typescript project using raw-http.

Read .codesight/wiki/index.md for orientation (WHERE things live). Then read actual source files before implementing. Wiki articles are navigation aids, not implementation guides.
Read .codesight/CODESIGHT.md for the complete AI context map including all routes, schema, components, libraries, config, middleware, and dependency graph.
The codesight wiki is kept up-to-date with a pre-commit hook.

## Commands

Node comes from mise (`mise.toml`, Node 26); plain `node` in a non-interactive shell may be a different version. Run everything through `mise exec --`.

- `mise exec -- npm run dev -- --port 5199` starts the dev server.
- Verify with `mise exec -- npm run typecheck`, `lint`, `format:check`, `test` and `build`.
- Run `npm run format` only on files you edited, never to reformat other people's work.
