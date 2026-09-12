/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Kevin Rajan
 * SPDX-License-Identifier: MIT
 *
 * Phase-0 defaults turn Action Fusion and ObservationPack on. OCC and EPR stay
 * off so Oh My Pi 18.1.17 can load this plugin without findCutPoint.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_CACHE_WRITE_READ_RATIO = 12.5;
export const DEFAULT_REDUCER_PROVIDER = "openai-codex";
export const DEFAULT_REDUCER_MODEL = "gpt-5.6-luna";
/** Matches Oh My Pi's CONFIG_DIR_NAME when the host shim is not loaded. */
export const OMP_CONFIG_DIR_NAME = ".omp";

export interface SolPiOmpConfig {
	readonly version: 1;
	readonly actionFusion: boolean;
	readonly observationPack: boolean;
	readonly evidencePreservingReducer: boolean;
	readonly evidencePreservingReducerModel: string;
	readonly evidencePreservingReducerProvider: string;
	readonly onlineContextCompact: boolean;
	readonly cacheWriteReadRatio: number;
}

export const DEFAULT_CONFIG: SolPiOmpConfig = Object.freeze({
	version: 1,
	actionFusion: true,
	observationPack: true,
	evidencePreservingReducer: false,
	evidencePreservingReducerModel: DEFAULT_REDUCER_MODEL,
	evidencePreservingReducerProvider: DEFAULT_REDUCER_PROVIDER,
	onlineContextCompact: false,
	cacheWriteReadRatio: DEFAULT_CACHE_WRITE_READ_RATIO,
});

const FEATURE_KEYS = [
	"actionFusion",
	"observationPack",
	"evidencePreservingReducer",
	"onlineContextCompact",
] as const;
const STRING_KEYS = ["evidencePreservingReducerModel", "evidencePreservingReducerProvider"] as const;
const CONFIG_KEYS = new Set<string>(["version", ...FEATURE_KEYS, ...STRING_KEYS, "cacheWriteReadRatio"]);

export function configDirCandidates(hostDirName = OMP_CONFIG_DIR_NAME): string[] {
	const names = new Set<string>([hostDirName, OMP_CONFIG_DIR_NAME, ".pi"]);
	return [...names];
}

export function findConfigPath(
	cwd: string,
	agentDir: string | undefined,
	allowProjectConfig: boolean,
	hostDirName = OMP_CONFIG_DIR_NAME,
): string | undefined {
	if (allowProjectConfig) {
		for (const dirName of configDirCandidates(hostDirName)) {
			const projectPath = join(cwd, dirName, "sol-pi.json");
			if (existsSync(projectPath)) return projectPath;
		}
	}
	if (agentDir) {
		const globalPath = join(agentDir, "sol-pi.json");
		if (existsSync(globalPath)) return globalPath;
	}
	return undefined;
}

export function loadSolPiOmpConfig(
	cwd: string,
	agentDir: string | undefined,
	allowProjectConfig: boolean,
	hostDirName = OMP_CONFIG_DIR_NAME,
): SolPiOmpConfig {
	const path = findConfigPath(cwd, agentDir, allowProjectConfig, hostDirName);
	if (!path) return DEFAULT_CONFIG;

	let parsed: unknown;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		throw new Error(`Unable to read SoL-Pi config ${path}: ${reason}`);
	}

	if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
		throw new Error(`SoL-Pi config must be a JSON object: ${path}`);
	}

	const record = parsed as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (!CONFIG_KEYS.has(key)) throw new Error(`Unknown SoL-Pi config key: ${key}`);
	}
	if (record.version !== 1) throw new Error(`SoL-Pi config version must be 1: ${path}`);

	for (const key of FEATURE_KEYS) {
		if (record[key] !== undefined && typeof record[key] !== "boolean") {
			throw new Error(`SoL-Pi config ${key} must be boolean: ${path}`);
		}
	}
	const cacheWriteReadRatio = Object.hasOwn(record, "cacheWriteReadRatio")
		? record.cacheWriteReadRatio
		: DEFAULT_CACHE_WRITE_READ_RATIO;
	if (
		typeof cacheWriteReadRatio !== "number" ||
		!Number.isFinite(cacheWriteReadRatio) ||
		cacheWriteReadRatio < 0
	) {
		throw new Error(`SoL-Pi config cacheWriteReadRatio must be a finite non-negative number: ${path}`);
	}

	return Object.freeze({
		...DEFAULT_CONFIG,
		...record,
		cacheWriteReadRatio,
		evidencePreservingReducerModel: stringConfigValue(
			record,
			"evidencePreservingReducerModel",
			DEFAULT_REDUCER_MODEL,
			path,
		),
		evidencePreservingReducerProvider: stringConfigValue(
			record,
			"evidencePreservingReducerProvider",
			DEFAULT_REDUCER_PROVIDER,
			path,
		),
	}) as SolPiOmpConfig;
}

function stringConfigValue(
	record: Record<string, unknown>,
	key: (typeof STRING_KEYS)[number],
	defaultValue: string,
	path: string,
): string {
	const value = Object.hasOwn(record, key) ? record[key] : defaultValue;
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`SoL-Pi config ${key} must be a non-empty string: ${path}`);
	}
	return value;
}

export async function loadHostCodingAgent(): Promise<Record<string, unknown> | undefined> {
	try {
		return (await import("@earendil-works/pi-coding-agent")) as Record<string, unknown>;
	} catch {
		return undefined;
	}
}
