/**
 * files.js — Binary file handler (disk-only, no memory).
 *
 * Handles keys that start with "files." — for example:
 *   global.set("files.abc123.pdf", buffer)
 *   global.get("files.abc123.pdf")
 *
 * Files are stored in /data/bridge-files/files/ and are never kept in memory.
 * This prevents large binary data (PDFs, images) from bloating the cache.
 *
 * The filename is everything after "files." — so "files.report.pdf" becomes
 * the file "report.pdf" on disk.
 */

const fs = require('fs');

const FILES_DIR = '/data/bridge-files/files/';

/**
 * Checks if a key targets the files handler.
 *
 * @param {string} key - The context key (e.g. "files.report.pdf")
 * @returns {boolean} True if this key should be handled as a binary file
 */
function isFileKey(key) {
    const parts = key.split('.');
    return parts[0] === 'files' && parts.length > 1;
}

/**
 * Extracts the filename from a files key.
 * Everything after "files." is joined back together.
 *
 * Example: "files.abc123.pdf" → "abc123.pdf"
 *
 * @param {string} key - The full context key
 * @returns {string} The filename
 */
function keyToFilename(key) {
    return key.split('.').slice(1).join('.');
}

/**
 * Reads a binary file from disk.
 *
 * @param {string} key - The context key (e.g. "files.report.pdf")
 * @returns {Buffer|null} The file contents, or null if the file doesn't exist
 */
function readFile(key) {
    const filePath = FILES_DIR + keyToFilename(key);

    if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath);
    }

    return null;
}

/**
 * Writes binary data to disk.
 *
 * @param {string} key   - The context key (e.g. "files.report.pdf")
 * @param {Buffer} value - The binary data to write
 */
function writeFile(key, value) {
    const filePath = FILES_DIR + keyToFilename(key);
    fs.writeFileSync(filePath, value);
}

module.exports = { isFileKey, readFile, writeFile };
