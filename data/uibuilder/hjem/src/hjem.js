/** @file Hjem page logic: form handling and connection card rendering. */

import { send, onMessage } from './uib-bridge.js'

// ===== Form Helpers =====

/**
 * Read all named inputs from a form and return as a plain object.
 * @param {HTMLFormElement} form
 * @returns {object} Key-value pairs of input name → value.
 */
function collectFormData(form) {
    const data = {}
    new FormData(form).forEach((value, key) => { data[key] = value })
    return data
}

/**
 * Display a feedback message below the form.
 * @param {HTMLElement} el   - The feedback container element.
 * @param {string}      message - Text to display.
 * @param {'success'|'error'} type - Visual style.
 */
function showFeedback(el, message, type) {
    el.textContent = message
    el.className = `feedback-${type}`
}

/**
 * Clear the feedback message.
 * @param {HTMLElement} el - The feedback container element.
 */
function clearFeedback(el) {
    el.textContent = ''
    el.className = ''
}

// ===== Connection Card Rendering =====

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str - Untrusted string.
 * @returns {string} Escaped string safe for innerHTML.
 */
function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
}

/**
 * Format epoch milliseconds to a readable Norwegian date string.
 * @param {number} epochMs - Timestamp in milliseconds.
 * @returns {string} Formatted date, e.g. "03.03.2026 14:30".
 */
function formatTimestamp(epochMs) {
    const d = new Date(epochMs)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * Determine status label and CSS class for a connection.
 * @param {object} connection - Connection object from global context.
 * @returns {{label: string, cssClass: string}}
 */
function getStatusBadge(connection) {
    if (connection.active) return { label: 'Aktiv', cssClass: 'status-active' }
    return { label: 'Stoppet', cssClass: 'status-stopped' }
}

/**
 * Extract the display name for a client from a connection object.
 * @param {object} client - Client object (rayvn or wasos).
 * @returns {string} Formatted label, e.g. "[rayvn]: LogName".
 */
function formatClientLabel(client) {
    return `[${escapeHtml(client.client_system)}]: ${escapeHtml(client.name)}`
}

/**
 * Build a DOM element for a single connection card.
 * @param {object} connection - Connection object from global context.
 * @returns {HTMLElement} The card element.
 */
function renderConnectionCard(connection) {
    const clients = Object.values(connection.clients)
    const status = getStatusBadge(connection)

    const card = document.createElement('div')
    card.className = 'connection-card'
    card.dataset.connectionName = connection.name
    card.dataset.active = connection.active

    card.innerHTML = `
        <div class="connection-info">
            <span class="connection-client">${formatClientLabel(clients[0])}</span>
            <span class="connection-separator">↔</span>
            <span class="connection-client">${formatClientLabel(clients[1])}</span>
        </div>
        <div class="connection-meta">
            <span class="status-badge ${status.cssClass}">${status.label}</span>
            <span class="connection-time">Opprettet: ${formatTimestamp(connection.time_created)}</span>
        </div>
        <div class="connection-actions">
            <button class="btn-action btn-toggle ${connection.active ? 'btn-stop' : 'btn-start'}">${connection.active ? 'Stopp' : 'Start'}</button>
            <button class="btn-action btn-details" disabled>Detaljer</button>
            <button class="btn-action btn-remove" disabled>Fjern</button>
        </div>
    `

    card.querySelector('.btn-toggle').addEventListener('click', (e) => {
        const active = card.dataset.active === 'true'
        const nextActive = !active
        send('connection/toggle', { name: connection.name, active: nextActive })

        card.dataset.active = String(nextActive)
        const btn = e.currentTarget
        btn.textContent = nextActive ? 'Stopp' : 'Start'
        btn.classList.toggle('btn-stop', nextActive)
        btn.classList.toggle('btn-start', !nextActive)

        const badge = card.querySelector('.status-badge')
        const status = nextActive
            ? { label: 'Aktiv', cssClass: 'status-active' }
            : { label: 'Stoppet', cssClass: 'status-stopped' }
        badge.textContent = status.label
        badge.className = `status-badge ${status.cssClass}`
    })

    card.querySelector('.btn-remove').addEventListener('click', () => {
        if (confirm('Er du sikker på at du vil slette koblingen?')) {
            send('connection/remove', { name: connection.name })
        }
    })

    return card
}

/**
 * Show or hide the bulk actions bar based on connection count.
 * @param {number} count - Number of connections.
 */
function toggleBulkActions(count) {
    const bar = document.getElementById('connections-bulk-actions')
    bar.classList.toggle('hidden', count === 0)
}

/**
 * Update an existing card's dynamic content in-place.
 * @param {HTMLElement} card - The existing card element.
 * @param {object} connection - Updated connection data.
 */
function updateCard(card, connection) {
    const status = getStatusBadge(connection)
    card.dataset.active = connection.active

    const badge = card.querySelector('.status-badge')
    badge.textContent = status.label
    badge.className = `status-badge ${status.cssClass}`

    const toggle = card.querySelector('.btn-toggle')
    toggle.textContent = connection.active ? 'Stopp' : 'Start'
    toggle.className = `btn-action btn-toggle ${connection.active ? 'btn-stop' : 'btn-start'}`
}

/**
 * Diff and update the connections list — only add, remove, or patch cards as needed.
 * @param {object} connections - Connections object keyed by connection name.
 */
function renderConnectionsList(connections) {
    const list = document.getElementById('connections-list')
    const incoming = new Set(Object.keys(connections))

    // Build lookup map of existing cards
    const existingCards = new Map()
    list.querySelectorAll('.connection-card').forEach(card => {
        existingCards.set(card.dataset.connectionName, card)
    })

    // Remove cards for deleted connections
    existingCards.forEach((card, name) => {
        if (!incoming.has(name)) card.remove()
    })

    // Add new or update existing
    Object.values(connections).forEach(connection => {
        const existing = existingCards.get(connection.name)
        if (existing) {
            updateCard(existing, connection)
        } else {
            list.appendChild(renderConnectionCard(connection))
        }
    })

    toggleBulkActions(incoming.size)
}

// ===== Initialization =====

/** Track known connection count to detect new additions. */
let knownConnectionCount = 0

/** Track whether a form submission is pending. */
let submitting = false

/** Attach form listener and register incoming message handlers. */
function initHjem() {
    const form = document.getElementById('connection-form')
    const feedback = document.getElementById('form-feedback')

    form.addEventListener('invalid', () => {
        form.classList.add('form-validated')
    }, true)

    const btnClear = document.getElementById('btn-clear')
    btnClear.addEventListener('click', () => {
        if (confirm('Er du sikker på at du vil tømme skjemaet?')) {
            form.reset()
            form.classList.remove('form-validated')
        }
    })

    form.addEventListener('submit', (e) => {
        e.preventDefault()
        clearFeedback(feedback)

        const data = collectFormData(form)
        send('form/submit', data)
        showFeedback(feedback, 'Sender...', 'success')
        submitting = true
    })

    onMessage('form/feedback', (payload) => {
        const type = payload.success ? 'success' : 'error'
        showFeedback(feedback, payload.message, type)
        if (payload.success) {
            form.reset()
            form.classList.remove('form-validated')
        }
        submitting = false
    })

    onMessage('connections/update', (connections) => {
        const count = Object.keys(connections).length

        if (submitting && count > knownConnectionCount) {
            clearFeedback(feedback)
            form.reset()
            form.classList.remove('form-validated')
            submitting = false
        }

        knownConnectionCount = count
        renderConnectionsList(connections)
    })
}

export { initHjem }
