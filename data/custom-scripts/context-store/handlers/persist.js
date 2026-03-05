/**
 * persist.js — Automatic disk persistence for connections and queue.
 *
 * Called after every global.set() that touches the "parat_bridge" namespace.
 * Decides what needs to be written to disk based on the key pattern:
 *
 *   parat_bridge.queue.*                   → writes queue.json
 *   parat_bridge.connections.<name>.*      → writes connections/<name>.json
 *   parat_bridge.connections               → writes ALL connection files + removes stale ones
 *   parat_bridge                           → writes both queue + all connections
 *
 * All writes use write-file-atomic for crash safety — if the process dies
 * mid-write, the previous valid file is preserved.
 */

const fs = require('fs');
const writeFileAtomic = require('write-file-atomic');

const BASE_DIR        = '/data/bridge-files/';
const QUEUE_FILE      = BASE_DIR + 'queue.json';
const CONNECTIONS_DIR = BASE_DIR + 'connections/';

// ---- Queue persistence ----

/**
 * Writes the current queue state to queue.json.
 *
 * @param {Object} scopeCache - The full scope cache (contains parat_bridge.queue.entry_queue)
 */
function persistQueue(scopeCache) {
    const pb = scopeCache.parat_bridge;
    const queue = (pb && pb.queue && pb.queue.entry_queue) || [];
    writeFileAtomic.sync(QUEUE_FILE, JSON.stringify({ entry_queue: queue }));
}

// ---- Connection persistence ----

/**
 * Writes a single connection to its JSON file.
 *
 * @param {string} name       - The connection name (used as filename)
 * @param {Object} scopeCache - The full scope cache
 */
function persistConnection(name, scopeCache) {
    const pb = scopeCache.parat_bridge;
    const allConns = (pb && pb.connections) || {};
    const conn = allConns[name];

    if (conn) {
        writeFileAtomic.sync(
            CONNECTIONS_DIR + name + '.json',
            JSON.stringify(conn)
        );
    }
}

/**
 * Syncs ALL connection files with the in-memory state.
 * - Writes a JSON file for each connection
 * - Deletes files for connections that no longer exist (stale cleanup)
 *
 * @param {Object} scopeCache - The full scope cache
 */
function persistAllConnections(scopeCache) {
    const pb = scopeCache.parat_bridge;
    const allConns = (pb && pb.connections) || {};

    // Remove stale files (connections that were deleted from memory)
    fs.readdirSync(CONNECTIONS_DIR)
        .filter(f => f.endsWith('.json'))
        .forEach(f => {
            const name = f.replace(/\.json$/, '');
            if (!allConns[name]) {
                fs.unlinkSync(CONNECTIONS_DIR + f);
            }
        });

    // Write each current connection
    for (const [connName, connData] of Object.entries(allConns)) {
        writeFileAtomic.sync(
            CONNECTIONS_DIR + connName + '.json',
            JSON.stringify(connData)
        );
    }
}

// ---- Main entry point ----

/**
 * Decides what to persist based on the key that was just set.
 * Called after every global.set() — exits early if the key doesn't
 * start with "parat_bridge".
 *
 * @param {string} key        - The context key that was just written
 * @param {Object} scopeCache - The full scope cache for this context scope
 */
function persist(key, scopeCache) {
    const parts = key.split('.');

    // Only persist keys under the parat_bridge namespace
    if (parts[0] !== 'parat_bridge') return;

    // global.set("parat_bridge", ...) — root object, persist everything
    if (parts.length === 1) {
        persistQueue(scopeCache);
        persistAllConnections(scopeCache);
        return;
    }

    // global.set("parat_bridge.queue.*", ...) — persist queue
    if (parts[1] === 'queue') {
        persistQueue(scopeCache);
    }

    // global.set("parat_bridge.connections.*", ...) — persist connections
    if (parts[1] === 'connections') {
        if (parts[2]) {
            // Specific connection: parat_bridge.connections.<name>.*
            persistConnection(parts[2], scopeCache);
        } else {
            // Whole object: parat_bridge.connections
            persistAllConnections(scopeCache);
        }
    }
}

module.exports = { persist };
