# Parat-Bridge — Known Issues & Technical Debt

Tracked issues and planned improvements. Items here are acknowledged and intentional deferrals, not bugs.

---

## HTTP Timeouts on POST Subflows

**Status:** Must be addressed soon

Neither POST subflow (POST to Rayvn, POST to Wasos) has an HTTP timeout configured. If a target API hangs indefinitely, the connection stays locked in `in_flight_connections` and no further entries are sent for that connection. The Send node's prune logic only clears slots when the queue has no entries for that connection — a hang with entries still queued won't self-heal.

**Fix:** Add a timeout to the HTTP request nodes in both POST subflows. This converts silent hangs into explicit errors that flow through the existing Retry path.

---

## Loop Prevention Regex is Hardcoded

**Status:** Prototype — to be made generic

The filter regex `/\[(?:wasos|rayvn|cim|parat-bridge)(?::|])/` lists system names explicitly. This was a quick fix to prevent loops when multiple team members connect to the same logs and chats simultaneously. It works but violates the adapter boundary principle — adding a new system requires updating core pipeline code.

**Future:** Replace with a generic pattern that matches any callsign produced by `utils.build_callsign` (e.g. `/\[[a-z_-]+:[^\]]+\]/`), removing the need to enumerate systems.

---

## Labels Field in Canonical Format

**Status:** Needs design work — deferred

The `labels` field exists in the canonical bridge entry because Rayvn supports labels. The original intent was to attach a label to target entries to mark them as already-bridged (used as one layer of loop prevention). However, the target system requires a label to be created before it can be attached to an entry — this prerequisite step is not yet implemented.

When implemented, the solution must be system-agnostic. Labels (or an equivalent tagging mechanism) should be handled through the adapter pattern, not hardcoded to Rayvn's label API.

---

## Connections Assume Exactly Two Clients

**Status:** By design — to be reworked with CIM integration

Connections are currently hardcoded to two clients: the Join node waits for count 2, `build_connection_name` sorts and joins two systems, and the polling loop finds the target by excluding self (which only works with exactly two).

The intended model is: each connection pairs one military system (WaSOS) with one civilian system (Rayvn or CIM). This constraint will remain — connections are always 1:1 pairings. The rework to properly enforce and support this (especially the CIM + WaSOS pairing alongside Rayvn + WaSOS) will come with CIM integration.

---

## Error Handling is Stubbed Out

**Status:** Not yet implemented

The three error handling nodes in System handling ("Build error message", "Write to error log", "Build user response") are stubs that pass through without action. When max retries are exhausted, entries are dropped with a `node.warn` but no notification reaches any connected system and no error is logged to the dashboard.

---

## `in_flight_connections` is Not Persisted

**Status:** Intentional — not an issue

`in_flight_connections` is deliberately kept in-memory only and reset to `[]` on every startup. Persisting it would add complexity without benefit — every initialization starts with a clean slate. The context store does not need to handle this key.
