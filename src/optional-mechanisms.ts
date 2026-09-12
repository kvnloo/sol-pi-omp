/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Kevin Rajan
 * SPDX-License-Identifier: MIT
 *
 * OCC and EPR are never imported statically. OMP 18.1.17's coding-agent shim
 * does not export findCutPoint, so even `onlineContextCompact: false` in stock
 * SoL-Pi fails at module evaluation. Optional loaders only run when those
 * features are requested AND the host actually exports findCutPoint AND a
 * SoL-Pi tree is available via SOL_PI_ROOT.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SolPiOmpConfig } from "./config.ts";

export type ExtensionAPI = {
	on: (...args: unknown[]) => unknown;
	registerTool?: (...args: unknown[]) => unknown;
};

export async function hostExportsFindCutPoint(): Promise<boolean> {
	try {
		const mod = (await import("@earendil-works/pi-coding-agent")) as Record<string, unknown>;
		return typeof mod.findCutPoint === "function";
	} catch {
		return false;
	}
}

export function solPiRoot(): string | undefined {
	const fromEnv = process.env.SOL_PI_ROOT?.trim();
	if (fromEnv && existsSync(fromEnv)) return fromEnv;
	return undefined;
}

async function importIfExists(filePath: string): Promise<Record<string, unknown> | undefined> {
	if (!existsSync(filePath)) return undefined;
	try {
		return (await import(pathToFileURL(filePath).href)) as Record<string, unknown>;
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		console.warn(`[sol-pi-omp] skipped optional module ${filePath}: ${reason}`);
		return undefined;
	}
}

export async function registerOptionalMechanisms(pi: ExtensionAPI, config: SolPiOmpConfig): Promise<void> {
	if (!config.onlineContextCompact && !config.evidencePreservingReducer) return;

	const root = solPiRoot();
	if (!root) {
		console.warn(
			"[sol-pi-omp] OCC/EPR requested but SOL_PI_ROOT is unset; leaving them disabled. Phase 0 ships Action Fusion + ObservationPack only.",
		);
		return;
	}

	if (config.onlineContextCompact) {
		const hasCut = await hostExportsFindCutPoint();
		if (!hasCut) {
			console.warn(
				"[sol-pi-omp] host does not export findCutPoint; skipping Online Context Compact (OMP 18.1.17-compatible default).",
			);
		} else {
			const occ = await importIfExists(join(root, "src/sol-pi/extensions/online-context-compact/index.ts"));
			const register = occ?.registerOnlineContextCompact;
			if (typeof register === "function") {
				register(pi, config.cacheWriteReadRatio);
			} else {
				console.warn("[sol-pi-omp] SOL_PI_ROOT has no registerOnlineContextCompact; OCC skipped.");
			}
		}
	}

	if (config.evidencePreservingReducer) {
		const epr = await importIfExists(join(root, "src/sol-pi/extensions/evidence-preserving-reducer/index.ts"));
		const register = epr?.registerEvidencePreservingReducer;
		if (typeof register === "function") {
			register(pi, {
				reducerModel: config.evidencePreservingReducerModel,
				reducerProvider: config.evidencePreservingReducerProvider,
			});
		} else {
			console.warn("[sol-pi-omp] SOL_PI_ROOT has no registerEvidencePreservingReducer; EPR skipped.");
		}
	}
}
