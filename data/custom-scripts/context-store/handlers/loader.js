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
 *   /data/bridge-files/files/              → scanned to build files_index,
 *                                            orphaned files pruned immediately
 */

const fs = require('fs');

const BASE_DIR        = '/data/bridge-files/';
const QUEUE_FILE      = BASE_DIR + 'queue.json';
const CONNECTIONS_DIR = BASE_DIR + 'connections/';
const FILES_DIR       = BASE_DIR + 'files/';

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
 * Scans the files directory, prunes orphaned files immediately, and returns
 * the index of retained files. A file is orphaned if its connection_name
 * does not match any loaded connection.
 *
 * Key format: {message_id}---{connection_name}---{filename}
 * This is the only place that enumerates and prunes the files directory; other
 * modules may still access individual files within it.
 *
 * @param {Object} connections - already-loaded connections, keyed by name
 * @returns {Array} context keys for retained files, e.g. ["files.abc---conn---photo.jpg"]
 */
function loadAndPruneFiles(connections) {
    const retained = [];

    try {
        if (!fs.existsSync(FILES_DIR)) return retained;

        const filenames = fs.readdirSync(FILES_DIR).filter(f => f.length > 0);

        for (const filename of filenames) {
            const parts           = filename.split("---");
            const connection_name = parts[1] || null;

            if (connection_name && connections[connection_name]) {
                retained.push("files." + filename);
            } else {
                try {
                    fs.unlinkSync(FILES_DIR + filename);
                    console.log('[context-store] Pruned orphaned file: ' + filename);
                } catch (err) {
                    console.warn('[context-store] Failed to prune file:', filename, err.message);
                }
            }
        }
    } catch (err) {
        console.warn('[context-store] Failed to read files directory:', err.message);
    }

    return retained;
}

const ERROR_LOG_FILE = BASE_DIR + 'error_log.json';

function loadErrorLog() {
    try {
        if (fs.existsSync(ERROR_LOG_FILE)) {
            return JSON.parse(fs.readFileSync(ERROR_LOG_FILE, 'utf8'));
        }
    } catch (err) {
        console.warn('[context-store] Failed to read error log:', err.message);
    }
    return [];
}

function loadBridgeData() {
    const connections = loadConnections();
    const entry_queue = loadQueue();
    const files_index = loadAndPruneFiles(connections);
    const error_log   = loadErrorLog();

    console.log('[context-store] Pre-loaded ' + Object.keys(connections).length +
        ' connection(s), ' + entry_queue.length + ' queue entries, ' +
        files_index.length + ' file(s), and ' + error_log.length + ' error log entries from disk');

    return {
        connections:  connections,
        queue:        { in_flight_connections: [], entry_queue: entry_queue },
        files_index:  files_index,
        error_log:    error_log
    };
}


module.exports = { loadBridgeData };