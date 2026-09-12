# sol-pi-omp

Standalone [Oh My Pi](https://omp.sh) plugin that loads [NVlabs/SoL-Pi](https://github.com/NVlabs/SoL-Pi) **Action Fusion** and **ObservationPack** without patching `can1357/oh-my-pi` or `NVlabs/SoL-Pi`.

Stock SoL-Pi's default factory **statically imports** Online Context Compact, which imports `findCutPoint`. Oh My Pi **18.1.17**'s `@earendil-works/pi-coding-agent` shim does not export `findCutPoint`, so that factory fails at module evaluation even when OCC is configured off.

This package:

- never statically imports `findCutPoint` or OCC
- phase-0 defaults: `actionFusion` + `observationPack` **on**, OCC/EPR **off**
- reads `sol-pi.json` from the host `CONFIG_DIR_NAME` (`.omp` on OMP), and also accepts `.pi` for stock Pi trees
- OCC, when enabled, uses a local adapter: settle → `session_stop` / `waitForIdle` + `ctx.compact()` (no `findCutPoint`)
- missing shim symbols (`modelRegistry.complete`, `isProjectTrusted`, `ctx.ui.setStatus`) are probed and skipped, not thrown

## Install (Oh My Pi 18.1.17)

```bash
omp plugin install github:kvnloo/sol-pi-omp
```

npm equivalent once published:

```bash
omp plugin install sol-pi-omp
```

Restart omp. Confirm with `omp plugin list`. The plugin advertises `omp.extensions` and legacy `pi.extensions` pointing at `./src/index.ts`. OMP remaps `@earendil-works/pi-coding-agent` onto `@oh-my-pi/pi-coding-agent`.

Local development:

```bash
omp plugin link /path/to/sol-pi-omp
```

## Config

Place `sol-pi.json` in `.omp/` (project, when trusted) or `~/.omp/agent/sol-pi.json`.

```json
{
  "version": 1,
  "actionFusion": true,
  "observationPack": true,
  "evidencePreservingReducer": false,
  "onlineContextCompact": false
}
```

See `sol-pi.example.json`.

OCC stays **off** by default. When you set `"onlineContextCompact": true`, this wrapper registers an OMP settle adapter (`src/occ-adapter.ts`) that maps Pi `agent_settled` onto `session_stop` / `waitForIdle` + `ctx.compact()`. It does **not** import `findCutPoint`. Missing `compact` or `waitForIdle` skips compaction instead of failing load.

EPR still optional-loads from `SOL_PI_ROOT` when enabled. Missing host symbols (`modelRegistry.complete`, `isProjectTrusted`, `ctx.ui.setStatus`) are treated as absent; factory construct and `session_start` do not throw.

## What this is not

- Not a PR against `NVlabs/SoL-Pi` or `can1357/oh-my-pi`.
- Not a Hermes plugin and not a fake Hermes↔Pi ABI.
- Action Fusion / ObservationPack TypeScript sources are copied from SoL-Pi under MIT; see `THIRD_PARTY_NOTICES.md`.

## Tests

```bash
npm test
```

The suite registers a host stub **without** `findCutPoint` and asserts the factory still constructs. Session-smoke tests cover missing `modelRegistry.complete`, `isProjectTrusted`, and `ctx.ui.setStatus`. Live `omp` is not required.
