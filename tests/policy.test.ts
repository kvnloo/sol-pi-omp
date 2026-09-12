import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { loadSolPiOmpConfig } from "../src/config.ts";
import { FULL_SENDS, THRESHOLD_BYTES } from "../src/extensions/observation-pack/observation.ts";

const root = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const schemaPath = join(root, "schema", "sol-pi.policy.v1.schema.json");
const instancePath = join(root, "schema", "sol-pi.policy.v1.json");

test("copied schema is SoL-Pi v1 keys plus ObservationPack constants in $defs", () => {
	const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
	const keys = Object.keys(schema.properties);
	assert.deepEqual(
		keys.sort(),
		[
			"actionFusion",
			"cacheWriteReadRatio",
			"evidencePreservingReducer",
			"evidencePreservingReducerModel",
			"evidencePreservingReducerProvider",
			"observationPack",
			"onlineContextCompact",
			"version",
		].sort(),
	);
	assert.equal(schema.properties.version.const, 1);
	assert.equal(schema.additionalProperties, false);
	const constants = schema.$defs.observationPackConstants.properties;
	assert.equal(constants.FULL_SENDS.const, 2);
	assert.equal(constants.thresholdBytes.const, 10240);
});

test("ObservationPack constants match shared schema $defs (not reminted)", () => {
	const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
	const constants = schema.$defs.observationPackConstants.properties;
	assert.equal(FULL_SENDS, constants.FULL_SENDS.const);
	assert.equal(THRESHOLD_BYTES, constants.thresholdBytes.const);
	assert.equal(FULL_SENDS, 2);
	assert.equal(THRESHOLD_BYTES, 10240);
});

test("OMP config loader accepts the canonical policy file", () => {
	const cwd = mkdtempSync(join(tmpdir(), "sol-pi-omp-policy-"));
	mkdirSync(join(cwd, ".omp"));
	writeFileSync(join(cwd, ".omp", "sol-pi.json"), readFileSync(instancePath));
	const loaded = loadSolPiOmpConfig(cwd, undefined, true, ".omp");
	assert.equal(loaded.version, 1);
	assert.equal(loaded.actionFusion, true);
	assert.equal(loaded.observationPack, true);
	assert.equal(loaded.evidencePreservingReducer, false);
	assert.equal(loaded.onlineContextCompact, false);
	const instance = JSON.parse(readFileSync(instancePath, "utf8"));
	assert.equal("FULL_SENDS" in instance, false);
	assert.equal("thresholdBytes" in instance, false);
});
