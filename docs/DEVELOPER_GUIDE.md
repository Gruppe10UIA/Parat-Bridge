# Parat-Bridge — Architecture & Design Reference

This document describes the architecture, data model, and design principles of Parat-Bridge. It serves as a reference for developers and AI assistants working on the codebase. New code must align with these principles.

---

## What Parat-Bridge Is

Parat-Bridge is a Node-RED application that acts as a bidirectional message broker between independent communications systems. It polls connected systems for new messages and forwards them to each other.

The architecture is client-agnostic — the core pipeline has no knowledge of any specific system. New systems are integrated by adding adapter subflows at the edges, without modifying the core.

It runs as a Docker container (Node-RED 4.1.4-22) with a custom context store for crash-safe persistence.

---

## System Overview

```
                           Parat-Bridge
                    ┌─────────────────────────┐
   System A API ◄───┤  Inbound    Core    Out  ├───► System A API
                    │  Adapters  Pipeline      │
   System B API ◄───┤                          ├───► System B API
                    │                          │
   System N API ◄───┤                          ├───► System N API
                    └─────────────────────────┘
                            │
                       Custom Context Store
                       (memory + atomic disk)
```

Each connected system gets its own set of adapter subflows. The core pipeline handles queuing, filtering, persistence, and delivery without knowing which systems are involved.

---

## The Adapter Boundary

The architecture has two distinct sides, separated by the format transformers:

```
  System-Specific Side          │         System-Agnostic Side
  (adapters)                    │         (core pipeline)
                                │
  Configure System ──►          │
  GET System entries ──►        │
  Raw API response ──► [Client to bridge entry] ──► Canonical bridge entry
                                │                         │
                                │                    Filter, Queue,
                                │                    Route, Persist
                                │                         │
  POST to System API ◄── [Bridge entry to client] ◄── Canonical bridge entry
                                │
```

**Left of the boundary** — adapters deal with raw API formats, authentication, system-specific field names, and URL construction. Each system has its own set. They are the only place where system-specific knowledge exists.

**Right of the boundary** — the core pipeline works exclusively with the canonical bridge entry and standard client contract. It handles filtering, queuing, serialization, persistence, and routing. It never inspects `client_specific` or references any system's field names. It uses `client_system` only as an opaque routing key (via switch nodes), never to branch logic.

**The transformers are the boundary.** `Client to bridge entry` converts inbound data from system-specific to canonical. `Bridge entry to client` converts outbound data from canonical back to system-specific. These are the only subflows that touch both sides.

This separation is what makes the system extensible — a new system is integrated entirely on the left side, and the right side remains untouched.

---

## Data Pipeline

```
INGEST (polling interval)
  Inject → Pass active connections
    → Switch (by msg.topic — routes to the correct system adapter)
    → GET subflow (system-specific: fetches raw entries from external API)
    → Split (array → individual entries)
    → Client to bridge entry (system-specific: normalizes to canonical format)
    → Filter new entries (generic: drops stale / looped / duplicate entries)
    → Attach metadata and prune (generic: creates queue-ready msg)
    → Output: msg.entry in canonical format

QUEUE & DELIVER (send interval)
  Enqueue → { entry, _retries: 0 }
  Send → one entry per connection (serialized via in_flight_connections)
    → Bridge entry to client (system-specific: converts to target API format)
    → Switch (by target system — routes to correct POST adapter)
    → POST subflow (system-specific: sends to external API)
    → Success: Dequeue + release slot → Append to master_log
    → Failure: Retry (configurable max) → drop + notify on exhaustion
```

**System-specific** steps are adapter subflows. **Generic** steps are part of the core and must never reference any particular system.

---

## Data Model

### Client Contract

Every client object, regardless of which system it represents, conforms to this shape:

```javascript
{
    client_system:   "string",            // system identifier — used for routing
    identifier:      "string",            // unique ID within that system
    name:            "string",            // human-readable label
    timestamp:       1234567890000,       // unix ms — last-seen cursor
    client_specific: { ... }              // ALL system-specific fields live here
}
```

`client_system` is the routing key that determines which adapter handles this client. `client_specific` is an opaque bag — the core pipeline never reads from it. Only the system's own adapters access its contents.

### Connection Schema

A connection links two (or more) clients across systems. Connections are stored at `parat_bridge.connections`, an object keyed by connection name.

Connection name format: `"<system>-<identifier>_<system>-<identifier>"` (clients sorted alphabetically by `client_system`, joined with `_`, using `-` as the system-identifier separator). Always generated by `utils.build_connection_name(clients)` — never constructed manually. This guarantees a consistent, deterministic key regardless of the order clients are provided.

```javascript
{
    name:           "systema-id1_systemb-id2",
    time_created:   1234567890000,
    clients: {
        "id1": { /* client contract */ },
        "id2": { /* client contract */ }
    },
    active:         true,
    master_log:     [],
    failed_entries: [],
    retry_failed:   false
}
```

`clients` is an object keyed by `identifier`, not an array. Iterate with `Object.values(connection.clients)`.

### Bridge Entry (Canonical Format)

The single shared format used throughout the core pipeline. Every system maps into and out of this format through its adapters:

```javascript
{
    id:        "string",               // unique entry ID from the source system
    text:      "string",               // message content
    timestamp: 1234567890000,          // unix ms
    author:    "string",               // display name of the original author
    files:     [],                     // attached files (array)
    labels:    [],                     // system-specific labels (array, may be empty)
    metadata: {
        source:          { /* client */ },    // the client this entry came from
        target:          { /* client */ },    // the client this entry will be sent to
        connection_name: "string"             // connection this entry belongs to
    }
}
```

Metadata travels with the entry through the entire pipeline and is used by the core for routing, filtering, and queue management — without inspecting `client_specific`.

### Queue State

```javascript
parat_bridge.queue = {
    entry_queue:           [{ entry, _retries }],    // entries waiting to be delivered
    in_flight_connections: ["connection-name", ...]   // connections with an active POST
}
```

### Global State

```javascript
parat_bridge = {
    base_urls:   { /* system_name: url, ... */ },
    connections: { /* keyed by connection name */ },
    queue:       { entry_queue: [], in_flight_connections: [] }
}

utils = {
    build_connection_name: (clients) => "string",
    build_label:           (client)  => { id, name, colorHex },
    build_callsign:        (client)  => "[system:name]"
}
```

`base_urls` maps system names to their API base URLs. New systems add an entry here.

---

## Project Structure

```
Parat-Bridge/
├── DOCKERFILE / docker-compose.yml
└── data/
    ├── settings.js                       # Node-RED config, custom context store
    ├── package.json                      # Dependencies
    ├── custom-scripts/context-store/     # Custom context store (see Persistence)
    │   ├── index.js                      # Node-RED Context Store API
    │   ├── handlers/memory.js            # In-memory nested get/set
    │   ├── handlers/files.js             # Binary file I/O (disk-only)
    │   ├── handlers/persist.js           # Atomic writes for connections + queue
    │   └── handlers/loader.js            # Pre-load from disk on startup
    ├── flows/                            # Flow tabs
    │   ├── Entrypoint.json               # Config UI + initialization
    │   ├── Data Flow.json                # Main pipeline orchestrator
    │   ├── System handling.json          # Runtime init, dashboard, error handling
    │   └── testing environment.json
    ├── subflows/
    │   ├── # --- Core (generic) ---
    │   ├── Get new entries.json          # Polling pipeline
    │   ├── Filter new entries.json       # Stale/loop/duplicate filtering
    │   ├── log queue.json                # Queue with per-connection concurrency
    │   ├── POST entries.json             # Route to correct POST adapter
    │   ├── Append entries to master_log.json
    │   ├── Initialize connection.json
    │   │
    │   ├── # --- Adapters (per-system) ---
    │   ├── Client to bridge entry.json   # Normalize: raw API → canonical format
    │   ├── Bridge entry to client.json   # Denormalize: canonical → target API format
    │   ├── Configure <System>.json       # Config UI + client object builder
    │   ├── GET <System> <resource>.json  # HTTP GET adapter
    │   ├── POST to <System>.json         # HTTP POST adapter
    │   └── ...
    └── bridge-files/                     # Runtime data (auto-created, not in git)
        ├── connections/*.json            # One file per connection
        ├── queue.json                    # Persisted queue state
        └── files/                        # Binary file storage
```

### Adding a New System

To integrate a new system, create these adapter subflows:
1. **Configure \<System\>** — config UI that outputs a standard client object
2. **GET \<System\>** — HTTP request to fetch entries from the system's API
3. **Client to bridge entry mapper** — add a new branch in the switch node for the new `client_system` value, mapping raw fields to the canonical bridge entry format
4. **Bridge entry to client mapper** — add a new branch converting canonical entries to the system's POST body format
5. **POST to \<System\>** — HTTP request to send entries to the system's API

Then register the system's `base_url` in the initialization flow. No core pipeline changes required.

---

## Startup Sequence

1. **Context store `open()`** — pre-loads connections + queue from disk into memory cache. This runs before any flows start, preventing race conditions.
2. **Inject (once, short delay)** → **Initialize system functions** — sets `utils` global with helper functions.
3. **Initialize context** — sets `base_urls` for all systems, resets `in_flight_connections = []` (clears stale locks from crashes).

---

## Persistence Layer

The custom context store (`data/custom-scripts/context-store/`) replaces Node-RED's default. It intercepts all `global.get()` and `global.set()` calls transparently.

**Routing rules:**

| Key pattern | Behavior |
|---|---|
| `parat_bridge.connections.<name>.*` | Memory + atomic write to `connections/<name>.json` |
| `parat_bridge.queue.*` | Memory + atomic write to `queue.json` |
| `parat_bridge.*` (root set) | Memory + persist both connections and queue |
| `files.<filename>` | Disk only (no memory) — for binary data |
| Everything else | Standard in-memory, no persistence |

All writes use `write-file-atomic` (temp file, fsync, atomic rename). If the process dies mid-write, the previous valid file is preserved.

**Only the key patterns listed above are persisted.** Other keys under `parat_bridge.*` (e.g. `parat_bridge.base_urls`) are in-memory only and will be lost on restart. If a new feature requires persistence, the context store must be extended to handle the new key pattern — persistence is not automatic for arbitrary keys.

Function nodes never interact with the filesystem directly — they use `global.get()` / `global.set()` and the context store decides what to persist based on its routing rules.

---

## Design Principles

These principles guide all implementation decisions. New code must conform to them.

### 1. Canonical Data Model

All data flowing through the core pipeline uses the bridge entry format. System-specific formats exist only at the edges (inbound/outbound adapters). Code in the core must never reference system-specific field names.

**Evaluation:** Can you describe what the code does without mentioning a specific system? If not, it belongs in an adapter.

### 2. Adapters at the Edges, Generic Core

System-specific knowledge is confined to adapter subflows:

- **Inbound:** Configure subflows, GET subflows, Client-to-bridge-entry mappers
- **Outbound:** Bridge-to-client mappers, POST subflows

The core pipeline (queue, filter, routing, persistence) is fully generic. Adding a new system should only require new adapter subflows — never changes to the core.

**Evaluation:** Does adding a new system require modifying core pipeline code? If yes, the boundary is leaking.

### 3. Persistence Through the Context Store

Function nodes use `global.get()` / `global.set()` — they have no knowledge of the filesystem. The custom context store intercepts these calls and persists data to disk for specific key patterns (see Persistence Layer above).

However, persistence is **not automatic for all keys**. Only explicitly configured key patterns are persisted (see Persistence Layer above). If a new feature introduces data that must survive restarts, the context store must be updated to handle the new key pattern — including write, read, and startup loading logic.

New code must never import `fs` or `write-file-atomic` inside a function node — all disk I/O goes through the context store.

**Evaluation:** Does this data need to survive a restart? If yes, is it covered by an existing persistence rule in the context store? If not, the context store needs to be extended first.

### 4. Standard Client Contract

Every client object follows a uniform shape. System-specific fields live inside `client_specific` — never as top-level properties. This ensures all generic pipeline code can handle any client identically.

When the contract needs to grow (e.g. a new field all systems share), extend the contract itself rather than adding system-specific fields outside `client_specific`.

**Evaluation:** Could a generic function node process this client without checking `client_system`? If not, the contract needs extending (not bypassing).

### 5. Connection-Level Serialization

The queue sends one message per connection at a time, tracked by `in_flight_connections`. This guarantees message ordering within a connection and prevents overwhelming target APIs, while allowing parallelism across different connections.

**Evaluation:** Can two entries for the same connection be in flight simultaneously? If yes, serialization is broken.

### 6. Defense-in-Depth Loop Prevention

Bidirectional bridges risk infinite message loops. Multiple independent filters prevent this:

1. Timestamp cursor — drops entries older than the last-seen timestamp
2. Bridge pattern regex — drops text/author matching known bridge callsign patterns
3. Target callsign match — drops entries authored by the target system's callsign
4. System message prefix — drops the bridge's own system messages
5. Label-based deduplication — drops entries already tagged with the target identifier

Each layer is a safety net for the others. New filter rules should be additive — removing a single check must not create a loop vulnerability.

When adding a new system, ensure its callsign format is covered by the bridge pattern regex, or add it.

**Evaluation:** If you disable this one check, could a loop form? If yes, keep it.

### 7. Crash Safety

Crash safety is handled entirely by the custom context store — not by Node-RED flows or function nodes. The context store uses atomic writes (`write-file-atomic`) for all disk operations, pre-loads persisted state from disk before any flows run, and resets transient state like `in_flight_connections` on startup.

Function nodes just use `global.get()` / `global.set()` as normal. The crash safety guarantees come from how the context store implements those calls, not from anything in the flows themselves.

The accepted trade-off: one possible duplicate per in-flight connection on crash (the entry was POSTed but the dequeue wasn't persisted yet). This is the tightest guarantee achievable without receiver-side idempotency support.

**Evaluation:** If this data needs crash safety, is the context store handling it? Crash safety logic belongs in the context store, not in function nodes.

### 8. Subflow Composability

Each subflow has a documented contract in its `info` field: expected input shape, output shape, and side effects. Subflows are self-contained — you should be able to understand what one does without reading its internals.

**Evaluation:** Can you understand the subflow's behavior from its info field and wiring alone? If not, the contract documentation is insufficient.

### 9. Minimal Shared State

Global state is limited to `parat_bridge` (connections, queue, base_urls) and `utils` (pure functions). Values needed only within a single pipeline run belong on `msg`, not in global state.

Note that storing a value under `parat_bridge.*` does not automatically make it persistent — see principle 3. Persistence requires the context store to be extended.

**Evaluation:** Is this value needed by nodes that don't share a `msg` object? If no, pass it on `msg` instead of making it global.

### 10. Idiomatic Node-RED

- Route by `msg.topic` using switch nodes
- Fan out with split, fan in with join
- Use link nodes for cross-flow connections
- Keep function nodes short and single-purpose
- Document subflow contracts in the info field

If a function node is growing complex, split it into multiple nodes or extract a subflow. The flow should be readable from the Node-RED editor without diving into function code.

---

## LLM Instructions

When working on this codebase:

- **Never edit flow JSON files directly.** Provide code snippets and instructions for the user to apply in the Node-RED editor.
- **Read the relevant subflow's `info` field** before modifying it — it documents the contract.
- **Check the design principles above** before proposing changes. If a change violates a principle, flag it explicitly.
- **System-specific code goes in adapters only.** If you're writing code that references a specific system's field names, it must be inside that system's adapter subflow (Configure, GET, POST, or mapper).
- **Use `global.get()` / `global.set()` for persistence.** Never use filesystem operations in function nodes.
- **Preserve the `msg.entry` and `msg.metadata` shapes** throughout the pipeline. These are the canonical interfaces between subflows.
- Connection names use `-` as the system-identifier separator (not `:`). Names are filesystem-safe.
- `clients` on a connection is an object keyed by `identifier`, not an array. Iterate with `Object.values()`.
- When adding support for a new system, follow the adapter pattern described in "Adding a New System" — do not modify core pipeline subflows.
