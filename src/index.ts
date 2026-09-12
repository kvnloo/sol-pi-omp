/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Kevin Rajan
 * SPDX-License-Identifier: MIT
 *
 * Default Oh My Pi / Pi ExtensionAPI factory. Action Fusion and ObservationPack
 * are local copies of NVlabs/SoL-Pi MIT sources. OCC is never statically
 * imported, so missing findCutPoint cannot fail module evaluation.
 */

import { registerActionFusion } from "./extensions/action-fusion/index.ts";
import { registerObservationPack } from "./extensions/observation-pack/index.ts";
import {
	DEFAULT_CONFIG,
	loadHostCodingAgent,
	loadSolPiOmpConfig,
	OMP_CONFIG_DIR_NAME,
	type SolPiOmpConfig,
} from "./config.ts";
import { registerOptionalMechanisms, type ExtensionAPI } from "./optional-mechanisms.ts";

export type SolPiOmpConfigLoader = (ctx: { cwd: string; isProjectTrusted?: () => boolean }) => SolPiOmpConfig;

export async function registerConfiguredFeatures(pi: ExtensionAPI, config: SolPiOmpConfig): Promise<void> {
	if (config.actionFusion) registerActionFusion(pi as never);
	if (config.observationPack) registerObservationPack(pi as never);
	await registerOptionalMechanisms(pi, config);
}

export function createSolPiOmpExtension(loadConfig?: SolPiOmpConfigLoader) {
	return (pi: ExtensionAPI): void => {
		let initialized = false;
		pi.on("session_start", async (_event: unknown, ctx: { cwd: string; isProjectTrusted?: () => boolean }) => {
			if (initialized) return;
			initialized = true;
			const config = loadConfig
				? loadConfig(ctx)
				: await loadConfigFromHost(ctx);
			await registerConfiguredFeatures(pi, config);
		});
	};
}

async function loadConfigFromHost(ctx: { cwd: string; isProjectTrusted?: () => boolean }): Promise<SolPiOmpConfig> {
	const host = await loadHostCodingAgent();
	const getAgentDir = host?.getAgentDir;
	const agentDir = typeof getAgentDir === "function" ? String(getAgentDir()) : undefined;
	const trusted = typeof ctx.isProjectTrusted === "function" ? ctx.isProjectTrusted() : false;
	const hostDirName =
		typeof host?.CONFIG_DIR_NAME === "string" && host.CONFIG_DIR_NAME.length > 0
			? host.CONFIG_DIR_NAME
			: OMP_CONFIG_DIR_NAME;
	return loadSolPiOmpConfig(ctx.cwd, agentDir, trusted, hostDirName);
}

export default function solPiOmpExtension(pi: ExtensionAPI): void {
	createSolPiOmpExtension()(pi);
}

export { DEFAULT_CONFIG, loadSolPiOmpConfig };
export type { SolPiOmpConfig };
