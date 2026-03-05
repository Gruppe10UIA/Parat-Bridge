/**
 * Parat Bridge — Custom Context Store for Node-RED
 *
 * Replaces Node-RED's default context store with one that automatically
 * persists certain data to disk while keeping everything in memory for
 * fast access.
 *
 * How it works:
 *   1. Every global.set() and global.get() in any Node-RED function node
 *      goes through this store (configured in settings.js).
 *   2. Most keys work like normal in-memory storage.
 *   3. Keys starting with "parat_bridge." also trigger automatic disk writes.
 *   4. Keys starting with "files." bypass memory entirely and go straight to disk.
 *
 * See handlers/ for the implementation of each concern:
 *   - memory.js   → in-memory nested object read/write
 *   - files.js    → binary file storage (disk-only)
 *   - persist.js  → automatic queue/connection persistence
 */

const fs = require('fs');
const { getNestedValue, setNestedValue } = require('./handlers/memory');
const { isFileKey, readFile, writeFile }  = require('./handlers/files');
const { persist }                         = require('./handlers/persist');

// --- Directory setup ---
// Ensures the storage directories exist on startup.
// Uses recursive:true so the parent /data/bridge-files/ is also created if needed.

const CONNECTIONS_DIR = '/data/bridge-files/connections/';
const FILES_DIR       = '/data/bridge-files/files/';

[CONNECTIONS_DIR, FILES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// --- Constructor ---

/**
 * Creates a new BridgeStore instance.
 * Called by Node-RED when loading the context store from settings.js.
 *
 * @param {Object} config - Configuration from settings.js (currently unused)
 */
function BridgeStore(config) {
    this.config = config;
    this.cache = {};  // All in-memory context data lives here, keyed by scope
}

// --- Node-RED Context Store API ---
// These methods are required by the Node-RED Context Store interface.
// See: https://nodered.org/docs/api/context/

/** Called when Node-RED starts. Nothing to initialize — resolve immediately. */
BridgeStore.prototype.open = function() {
    return Promise.resolve();
};

/** Called when Node-RED shuts down. Nothing to clean up — resolve immediately. */
BridgeStore.prototype.close = function() {
    return Promise.resolve();
};

/**
 * Reads a value from the context store.
 * Node-RED calls this whenever a node does global.get(...).
 *
 * @param {string}        scope    - Context scope (e.g. "global", a flow id, or a node id)
 * @param {string|Array}  key      - Dot-separated key, or array of keys for batch read
 * @param {Function}      callback - Optional async callback(err, value)
 */
BridgeStore.prototype.get = function(scope, key, callback) {
    // Files are read directly from disk, never from memory
    if (typeof key === 'string' && isFileKey(key)) {
        const value = readFile(key);
        if (callback) return callback(null, value);
        return value;
    }

    const scopeCache = this.cache[scope] || {};

    // Support batch reads: global.get(["key1", "key2"])
    if (Array.isArray(key)) {
        const values = key.map(k => getNestedValue(scopeCache, k));
        if (callback) return callback(null, ...values);
        return values;
    }

    // Standard single-key read
    const value = getNestedValue(scopeCache, key);
    if (callback) return callback(null, value);
    return value;
};

/**
 * Writes a value to the context store.
 * Node-RED calls this whenever a node does global.set(...).
 *
 * @param {string}        scope    - Context scope
 * @param {string|Array}  key      - Dot-separated key, or array of keys for batch write
 * @param {*}             value    - The value to store (or array of values for batch)
 * @param {Function}      callback - Optional async callback(err)
 */
BridgeStore.prototype.set = function(scope, key, value, callback) {
    const scopeCache = this.cache[scope] || {};
    this.cache[scope] = scopeCache;

    // Support batch writes: global.set(["key1", "key2"], [val1, val2])
    if (Array.isArray(key)) {
        const values = Array.isArray(value) ? value : [value];
        key.forEach((k, i) => {
            const v = i < values.length ? values[i] : null;
            setNestedValue(scopeCache, k, v);
            persist(k, scopeCache);
        });
    } else {
        // Files go straight to disk, bypass memory
        if (isFileKey(key)) {
            writeFile(key, value);
            if (callback) return callback(null);
            return;
        }

        // Standard write: update memory, then persist if needed
        setNestedValue(scopeCache, key, value);
        persist(key, scopeCache);
    }

    if (callback) return callback(null);
};

/** Returns all top-level keys for a scope. Used by Node-RED's context sidebar. */
BridgeStore.prototype.keys = function(scope, callback) {
    const keys = Object.keys(this.cache[scope] || {});
    if (callback) return callback(null, keys);
    return keys;
};

/** Deletes all data for a scope. Called by Node-RED during cleanup. */
BridgeStore.prototype.delete = function(scope) {
    delete this.cache[scope];
    return Promise.resolve();
};

/** Called by Node-RED to clean up context for removed nodes. No action needed. */
BridgeStore.prototype.clean = function(activeNodes) {
    return Promise.resolve();
};

// --- Module export ---
// Node-RED calls this factory function with the config from settings.js.
// It must return a new store instance.

module.exports = function(config) {
    return new BridgeStore(config);
};
