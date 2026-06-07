# Plugin Authoring Smoke Example

A CrewSpace plugin

## Development

```bash
pnpm install
pnpm dev            # watch builds
pnpm dev:ui         # local dev server with hot-reload events
pnpm test
```

## Install Into CrewSpace

```bash
pnpm crewspace plugin install ./
```

## Build Options

- `pnpm build` uses esbuild presets from `@crewspace/plugin-sdk/bundlers`.
- `pnpm build:rollup` uses rollup presets from the same SDK.
