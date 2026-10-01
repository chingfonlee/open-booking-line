#!/usr/bin/env node

/**
 * Minimal Project State Manager
 * Spec: Evolution-4Tier-Architecture #17
 * Supports: read, validate, record-capability
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const STATE_FILE = path.join(ROOT_DIR, '.booking', 'project-state.json');
const SCHEMA_FILE = path.join(ROOT_DIR, '.booking', 'project-state.schema.json');
const EXAMPLE_FILE = path.join(ROOT_DIR, '.booking', 'project-state.json.example');

export function readState() {
  if (!fs.existsSync(STATE_FILE)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${STATE_FILE}: ${err.message}`);
  }
}

export function validateState(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('State must be a JSON object');
  }
  if (typeof data.stateSchemaVersion !== 'number' || data.stateSchemaVersion < 1) {
    throw new Error('Invalid or missing stateSchemaVersion');
  }
  if (!data.project || typeof data.project.name !== 'string' || typeof data.project.type !== 'string') {
    throw new Error('Invalid or missing project metadata (name, type required)');
  }
  if (!data.capabilities || typeof data.capabilities !== 'object') {
    throw new Error('Invalid or missing capabilities registry');
  }
  for (const [key, cap] of Object.entries(data.capabilities)) {
    if (!cap.status || !['verified', 'degraded', 'unverified'].includes(cap.status)) {
      throw new Error(`Invalid status for capability "${key}": ${cap.status}`);
    }
    if (!cap.sourceEpisode || typeof cap.sourceEpisode !== 'string') {
      throw new Error(`Missing sourceEpisode for capability "${key}"`);
    }
    if (!cap.verifiedAt || isNaN(Date.parse(cap.verifiedAt))) {
      throw new Error(`Invalid ISO verifiedAt timestamp for capability "${key}"`);
    }
  }
  return true;
}

export function atomicWriteState(data) {
  validateState(data);
  const dir = path.dirname(STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tempPath = `${STATE_FILE}.tmp.${Date.now()}`;
  const payload = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(tempPath, payload, 'utf8');
  fs.renameSync(tempPath, STATE_FILE);
}

export function recordCapability(capabilityId, sourceEpisode, status = 'verified') {
  let state = readState();
  if (!state) {
    if (fs.existsSync(EXAMPLE_FILE)) {
      state = JSON.parse(fs.readFileSync(EXAMPLE_FILE, 'utf8'));
      state.capabilities = {};
    } else {
      state = {
        stateSchemaVersion: 1,
        project: { name: 'My Booking Service', type: 'general' },
        capabilities: {},
        updatedAt: new Date().toISOString()
      };
    }
  }

  state.capabilities[capabilityId] = {
    status,
    sourceEpisode,
    verifiedAt: new Date().toISOString()
  };
  state.updatedAt = new Date().toISOString();

  atomicWriteState(state);
  console.log(`[project-state] Recorded capability "${capabilityId}" (${status}) from ${sourceEpisode}`);
}

// CLI handler
const [,, command, ...args] = process.argv;

if (command === 'read') {
  const state = readState();
  if (!state) {
    console.log(JSON.stringify({ exists: false }));
  } else {
    console.log(JSON.stringify(state, null, 2));
  }
} else if (command === 'validate') {
  const state = readState();
  if (!state) {
    console.error('No project-state.json found to validate.');
    process.exit(1);
  }
  try {
    validateState(state);
    console.log('Project state is VALID.');
  } catch (err) {
    console.error('Project state INVALID:', err.message);
    process.exit(1);
  }
} else if (command === 'record') {
  const [capId, epId] = args;
  if (!capId || !epId) {
    console.error('Usage: node project-state.mjs record <capabilityId> <sourceEpisode>');
    process.exit(1);
  }
  recordCapability(capId, epId);
} else if (command) {
  console.log('Unknown command. Available: read, validate, record');
}
