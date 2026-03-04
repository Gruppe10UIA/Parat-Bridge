const fs = require('fs');
const writeFileAtomic = require('write-file-atomic');

const BASE_DIR        = '/data/bridge-files/';
const QUEUE_FILE      = BASE_DIR + 'queue.json';
const CONNECTIONS_DIR = BASE_DIR + 'connections/';
const FILES_DIR       = BASE_DIR + 'files/';

const sanitize = (name) => name.replace(/:/g, '_');

// Ensure directories exist
[CONNECTIONS_DIR, FILES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function BridgeStore(config) {
    this.config = config;
    this.cache = {};   // in-memory store
}

BridgeStore.prototype.open = function() {
    return Promise.resolve();
};

BridgeStore.prototype.close = function() {
    return Promise.resolve();
};

BridgeStore.prototype.get = function(scope, key, callback) {
    if (typeof key === 'string') {
        const parts = key.split('.');
        // files.* — disk only
        if (parts[0] === 'files' && parts.length > 1) {
            const filePath = FILES_DIR + sanitize(parts.slice(1).join('.'));
            let value = null;
            if (fs.existsSync(filePath)) value = fs.readFileSync(filePath);
            if (callback) return callback(null, value);
            return value;
        }
    }

    // Standard memory get (supports single key or array of keys)
    const scopeCache = this.cache[scope] || {};

    if (Array.isArray(key)) {
        const values = key.map(k => this._getNestedValue(scopeCache, k));
        if (callback) return callback(null, ...values);
        return values;
    }

    const value = this._getNestedValue(scopeCache, key);
    if (callback) return callback(null, value);
    return value;
};

BridgeStore.prototype.set = function(scope, key, value, callback) {
    const scopeCache = this.cache[scope] || {};
    this.cache[scope] = scopeCache;

    if (Array.isArray(key)) {
        const values = Array.isArray(value) ? value : [value];
        key.forEach((k, i) => {
            const v = i < values.length ? values[i] : null;
            this._setNestedValue(scopeCache, k, v);
            this._persist(k, scopeCache);
        });
    } else {
        // files.* — disk only, bypass memory
        const parts = key.split('.');
        if (parts[0] === 'files' && parts.length > 1) {
            fs.writeFileSync(FILES_DIR + sanitize(parts.slice(1).join('.')), value);
            if (callback) return callback(null);
            return;
        }

        this._setNestedValue(scopeCache, key, value);
        this._persist(key, scopeCache);
    }

    if (callback) return callback(null);
};

BridgeStore.prototype.keys = function(scope, callback) {
    const keys = Object.keys(this.cache[scope] || {});
    if (callback) return callback(null, keys);
    return keys;
};

BridgeStore.prototype.delete = function(scope) {
    delete this.cache[scope];
    return Promise.resolve();
};

BridgeStore.prototype.clean = function(activeNodes) {
    return Promise.resolve();
};

// --- internal helpers ---

BridgeStore.prototype._persist = function(key, scopeCache) {
    const parts = key.split('.');
    if (parts[0] !== 'parat_bridge') return;

    // queue
    if (parts[1] === 'queue' || parts.length === 1) {
        const pb = scopeCache.parat_bridge;
        const queue = (pb && pb.queue && pb.queue.entry_queue) || [];
        writeFileAtomic.sync(QUEUE_FILE, JSON.stringify({ entry_queue: queue }));
    }

    // connections
    if (parts[1] === 'connections' || parts.length === 1) {
        const pb = scopeCache.parat_bridge;
        const allConns = (pb && pb.connections) || {};

        if (parts[2]) {
            // single connection changed
            const conn = allConns[parts[2]];
            if (conn) {
                writeFileAtomic.sync(
                    CONNECTIONS_DIR + sanitize(parts[2]) + '.json',
                    JSON.stringify(conn)
                );
            }
        } else {
            // whole connections object set — sync all files
            fs.readdirSync(CONNECTIONS_DIR).filter(f => f.endsWith('.json')).forEach(f => {
                const name = f.replace(/\.json$/, '');
                if (!Object.keys(allConns).some(k => sanitize(k) === name)) {
                    fs.unlinkSync(CONNECTIONS_DIR + f);
                }
            });
            for (const [connName, connData] of Object.entries(allConns)) {
                writeFileAtomic.sync(
                    CONNECTIONS_DIR + sanitize(connName) + '.json',
                    JSON.stringify(connData)
                );
            }
        }
    }
};

BridgeStore.prototype._getNestedValue = function(obj, key) {
    const parts = key.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }
    return current;
};

BridgeStore.prototype._setNestedValue = function(obj, key, value) {
    const parts = key.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined || current[parts[i]] === null) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
};

module.exports = function(config) {
    return new BridgeStore(config);
};
