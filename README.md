# sol-pi-omp

Standalone [Oh My Pi](https://omp.sh) plugin that loads [NVlabs/SoL-Pi](https://github.com/NVlabs/SoL-Pi) **Action Fusion** and **ObservationPack** without patching `can1357/oh-my-pi` or `NVlabs/SoL-Pi`.

Stock SoL-Pi's default factory **statically imports** Online Context Compact, which imports `findCutPoint`. Oh My Pi **18.1.17**'s `@earendil-works/pi-coding-agent` shim does not export `findCutPoint`, so that factory fails at module evaluation even when OCC is configured off.

This package:

- never statically imports `findCutPoint` or OCC
- phase-0 defaults: `actionFusion` + `observationPack` **on**, OCC/EPR **off**
- reads `sol-pi.json` from the host `CONFIG_DIR_NAME` (`.omp` on OMP), and also accepts `.pi` for stock Pi trees
- optionally dynamic-imports OCC/EPR from `SOL_PI_ROOT` only if the host actually exports `findCutPoint`

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

OCC/EPR stay off unless you set `SOL_PI_ROOT` to a checked-out SoL-Pi tree **and** the host exports `findCutPoint`. Missing exports skip those mechanisms with a warning instead of crashing load.

## What this is not

- Not a PR against `NVlabs/SoL-Pi` or `can1357/oh-my-pi`.
- Not a Hermes plugin and not a fake Hermes↔Pi ABI.
- Action Fusion / ObservationPack TypeScript sources are copied from SoL-Pi under MIT; see `THIRD_PARTY_NOTICES.md`.

## Tests

```bash
npm test
```

The suite registers a host stub **without** `findCutPoint` and asserts the factory still constructs.
