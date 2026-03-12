/**
 * loader.js — Pre-loads persisted data from disk on startup.
 *
 * Called during the context store's open() phase, before any flows run.
 * This prevents race conditions where early-firing nodes would write
 * empty data to disk before the init flow has loaded from disk.
 *
 * Reads:
 *   /data/bridge-files/connections/*.json  → connection objects keyed by name
 *   /data/bridge-files/queue.json          → entry_queue array
 */

const fs = require('fs');

const BASE_DIR        = '/data/bridge-files/';
const QUEUE_FILE      = BASE_DIR + 'queue.json';
const CONNECTIONS_DIR = BASE_DIR + 'connections/';

/**
 * Reads all persisted connection files from disk.
 *
 * @returns {Object} connections keyed by name
 */
function loadConnections() {
    const connections = {};
    try {
        const files = fs.readdirSync(CONNECTIONS_DIR).filter(f => f.endsWith('.json'));
        files.forEach(f => {
            const data = JSON.parse(fs.readFileSync(CONNECTIONS_DIR + f, 'utf8'));
            connections[data.name] = data;
        });
    } catch (err) {
        console.warn('[context-store] Failed to read connections:', err.message);
    }
    return connections;
}

/**
 * Reads the persisted queue from disk.
 *
 * @returns {Array} the entry_queue array (empty if file missing or invalid)
 */
function loadQueue() {
    try {
        if (fs.existsSync(QUEUE_FILE)) {
            const saved = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
            return saved.entry_queue || [];
        }
    } catch (err) {
        console.warn('[context-store] Failed to read queue:', err.message);
    }
    return [];
}

/**
 * Loads all persisted bridge data from disk.
 *
 * @returns {Object} the parat_bridge object ready to be placed in the scope cache
 */
function loadBridgeData() {
    const connections = loadConnections();
    const entry_queue = loadQueue();

    console.log('[context-store] Pre-loaded ' + Object.keys(connections).length +
        ' connection(s) and ' + entry_queue.length + ' queue entries from disk');

    return {
        connections: connections,
        queue: { in_flight_connections: [], entry_queue: entry_queue }
    };
}

module.exports = { loadBridgeData };
