# Parat Bridge — Custom Context Store

A custom Node-RED context store that adds automatic disk persistence to the standard in-memory store.

## Why?

Node-RED's built-in memory store loses all data on restart. This store intercepts `global.set()` and `global.get()` calls and automatically persists selected data to disk, so the bridge survives crashes and restarts without any extra code in the flow nodes.

## File structure

```
context-store/
├── index.js              Entry point — implements the Node-RED Context Store API
├── handlers/
│   ├── memory.js         In-memory read/write (nested dot-path traversal)
│   ├── files.js          Binary file storage (disk-only, no memory)
│   └── persist.js        Queue + connection persistence (atomic writes)
└── README.md             This file
```

## How data is routed

| Key pattern | Memory | Disk | Write method |
|---|---|---|---|
| `parat_bridge.connections.<name>.*` | yes | `connections/<name>.json` | atomic |
| `parat_bridge.connections` | yes | all `connections/*.json` + stale cleanup | atomic |
| `parat_bridge.queue.*` | yes | `queue.json` | atomic |
| `parat_bridge` | yes | both queue + all connections | atomic |
| `files.<filename>` | **no** | `files/<filename>` | standard |
| anything else | yes | **no** | — |

## Disk locations

All persisted data lives under `/data/bridge-files/`:

```
/data/bridge-files/
├── queue.json                 The entry queue
├── connections/               One JSON file per connection
│   ├── rayvn-abc123_wasos-456.json
│   └── ...
└── files/                     Binary files (PDFs, images, etc.)
    ├── abc123.pdf
    └── ...
```

Directories are created automatically on startup if they don't exist.

## Configuration

In `settings.js`:

```js
contextStorage: {
    default: {
        module: require("/data/custom-scripts/context-store")
    }
}
```

## Usage in Node-RED function nodes

```js
// Connections — automatically persisted
global.set("parat_bridge.connections.my_conn.status", "active");
const status = global.get("parat_bridge.connections.my_conn.status");

// Queue — automatically persisted
global.set("parat_bridge.queue.entry_queue", updatedArray);
const queue = global.get("parat_bridge.queue.entry_queue");

// Binary files — disk only, no memory usage
global.set("files.report.pdf", binaryBuffer);
const file = global.get("files.report.pdf");  // returns Buffer or null

// Everything else — normal in-memory, no persistence
global.set("my_temp_var", 123);
```

## Adding a new persistence target

To persist a new data type (e.g. `parat_bridge.audit_log`):

1. Open `handlers/persist.js`
2. Add a new condition in the `persist()` function
3. Write a `persistAuditLog()` function following the same pattern as `persistQueue()`
