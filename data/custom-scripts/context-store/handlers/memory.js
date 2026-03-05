/**
 * memory.js — In-memory helpers for reading and writing nested values.
 *
 * These are pure utility functions with no side effects.
 * They walk dot-separated key paths (e.g. "parat_bridge.connections.my_conn")
 * through a plain JavaScript object, reading or creating structure as needed.
 */

/**
 * Reads a value from a nested object using a dot-separated key.
 *
 * Example:
 *   getNestedValue({ a: { b: 42 } }, "a.b")  →  42
 *   getNestedValue({ a: {} }, "a.b.c")        →  undefined
 *
 * @param {Object} obj - The object to read from
 * @param {string} key - Dot-separated path (e.g. "parat_bridge.queue.entry_queue")
 * @returns {*} The value at the path, or undefined if any step is missing
 */
function getNestedValue(obj, key) {
    const parts = key.split('.');
    let current = obj;

    for (const part of parts) {
        if (current === undefined || current === null) return undefined;
        current = current[part];
    }

    return current;
}

/**
 * Sets a value on a nested object using a dot-separated key.
 * Creates intermediate objects along the path if they don't exist.
 *
 * Example:
 *   const obj = {};
 *   setNestedValue(obj, "a.b.c", 42)  →  obj is now { a: { b: { c: 42 } } }
 *
 * @param {Object} obj   - The object to write to (mutated in place)
 * @param {string} key   - Dot-separated path
 * @param {*}      value - The value to set
 */
function setNestedValue(obj, key, value) {
    const parts = key.split('.');
    let current = obj;

    // Walk to the second-to-last part, creating objects as needed
    for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined || current[parts[i]] === null) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }

    // Set the final value
    current[parts[parts.length - 1]] = value;
}

module.exports = { getNestedValue, setNestedValue };
