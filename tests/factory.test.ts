import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { createSolPiOmpExtension, DEFAULT_CONFIG, loadSolPiOmpConfig } from "../src/index.ts";
import { hostExportsFindCutPoint } from "../src/optional-mechanisms.ts";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));

test("no source file statically imports findCutPoint or OCC", () => {
	const files = [];
	const walk = (dir) => {
		for (const name of readdirSync(dir)) {
			const path = join(dir, name);
			if (statSync(path).isDirectory()) walk(path);
			else if (name.endsWith(".ts")) files.push(path);
		}
	};
	walk(join(root, "src"));
	for (const file of files) {
		const text = readFileSync(file, "utf8");
		assert.doesNotMatch(
			text,
			/from\s+["'][^"']*online-context-compact[^"']*["']/,
			`${file} must not statically import OCC`,
		);
		assert.doesNotMatch(text, /\bimport\s*\{[^}]*\bfindCutPoint\b/, `${file} must not statically import findCutPoint`);
	}
});

test("host stub does not export findCutPoint", async () => {
	assert.equal(await hostExportsFindCutPoint(), false);
	const host = await import("@earendil-works/pi-coding-agent");
	assert.equal("findCutPoint" in host, false);
});

test("phase-0 defaults enable Action Fusion and ObservationPack only", () => {
	assert.equal(DEFAULT_CONFIG.actionFusion, true);
	assert.equal(DEFAULT_CONFIG.observationPack, true);
	assert.equal(DEFAULT_CONFIG.onlineContextCompact, false);
	assert.equal(DEFAULT_CONFIG.evidencePreservingReducer, false);
});

test("CONFIG_DIR_NAME candidates include .omp", () => {
	const cwd = mkdtempSync(join(tmpdir(), "sol-pi-omp-"));
	mkdirSync(join(cwd, ".omp"));
	writeFileSync(join(cwd, ".omp", "sol-pi.json"), JSON.stringify({ version: 1, actionFusion: false }));
	const loaded = loadSolPiOmpConfig(cwd, undefined, true, ".omp");
	assert.equal(loaded.actionFusion, false);
	assert.equal(loaded.observationPack, true);
});

test("factory constructs and session_start runs without findCutPoint", async () => {
	const tools = [];
	const handlers = {};
	const pi = {
		on(event, handler) {
			handlers[event] = handler;
		},
		registerTool(tool) {
			tools.push(tool.name);
		},
	};
	const factory = createSolPiOmpExtension(() => DEFAULT_CONFIG);
	assert.equal(typeof factory, "function");
	factory(pi);
	assert.equal(typeof handlers.session_start, "function");
	await handlers.session_start({}, { cwd: process.cwd(), isProjectTrusted: () => false });
	assert.ok(tools.includes("edit"));
	assert.ok(tools.includes("write"));
	assert.ok(tools.includes("obs_recall"));
});
