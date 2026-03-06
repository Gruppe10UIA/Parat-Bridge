/** @file Thin wrapper around the uibuilder client library for topic-based messaging. */

/** Registered message handlers keyed by topic. @type {Map<string, Function[]>} */
const handlers = new Map()

/** Registered one-time handlers keyed by topic. @type {Map<string, Function[]>} */
const onceHandlers = new Map()

/**
 * Send a message to Node-RED via uibuilder.
 * @param {string} topic - Message topic (e.g. 'form/submit').
 * @param {*}      payload - Message payload.
 */
function send(topic, payload) {
    uibuilder.send({ topic, payload })
}

/**
 * Register a handler for messages with a specific topic.
 * @param {string}   topic    - Topic to listen for.
 * @param {Function} callback - Called with msg.payload when topic matches.
 */
function onMessage(topic, callback) {
    if (!handlers.has(topic)) handlers.set(topic, [])
    handlers.get(topic).push(callback)
}

/**
 * Register a one-time handler that is removed after first invocation.
 * @param {string}   topic    - Topic to listen for.
 * @param {Function} callback - Called once with msg.payload when topic matches.
 */
function onceMessage(topic, callback) {
    if (!onceHandlers.has(topic)) onceHandlers.set(topic, [])
    onceHandlers.get(topic).push(callback)
}

/**
 * Route an incoming message to registered handlers by topic.
 * @param {object} msg - uibuilder message object with topic and payload.
 */
function routeMessage(msg) {
    const topic = msg.topic
    if (!topic) return

    const cbs = handlers.get(topic)
    if (cbs) cbs.forEach((cb) => cb(msg.payload))

    const onceCbs = onceHandlers.get(topic)
    if (onceCbs) {
        onceCbs.forEach((cb) => cb(msg.payload))
        onceHandlers.delete(topic)
    }
}

/** Start listening for incoming uibuilder messages. Call once at app init. */
function startListening() {
    uibuilder.onChange('msg', routeMessage)
}

export { send, onMessage, onceMessage, startListening }
