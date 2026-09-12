/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Kevin Rajan
 * SPDX-License-Identifier: MIT
 *
 * Stock SoL-Pi OCC is never imported (it names findCutPoint). When OCC is
 * enabled, the local adapter maps settle → session_stop / waitForIdle +
 * compact(). EPR still optional-loads from SOL_PI_ROOT when requested.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { SolPiOmpConfig } from "./config.ts";
import { registerOnlineContextCompactAdapter } from "./occ-adapter.ts";

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
	if (config.onlineContextCompact) {
		registerOnlineContextCompactAdapter(pi);
	}

	if (!config.evidencePreservingReducer) return;

	const root = solPiRoot();
	if (!root) {
		console.warn(
			"[sol-pi-omp] EPR requested but SOL_PI_ROOT is unset; leaving the reducer disabled. Phase 0 ships Action Fusion + ObservationPack only.",
		);
		return;
	}

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
