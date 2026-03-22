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

    const boostEnabled = connection.boost_mode === true

    card.innerHTML = `
        <label class="boost-switch" title="Boost Mode">
            <input type="checkbox" ${boostEnabled ? 'checked' : ''} />
            <span class="slider">
                <div class="fug">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" class="nav bi bi-rocket-takeoff-fill" viewBox="0 0 16 16">
                        <path d="M12.17 9.53c2.307-2.592 3.278-4.684 3.641-6.218.21-.887.214-1.58.16-2.065a3.578 3.578 0 0 0-.108-.563 2.22 2.22 0 0 0-.078-.23V.453c-.073-.164-.168-.234-.352-.295a2.35 2.35 0 0 0-.16-.045 3.797 3.797 0 0 0-.57-.093c-.49-.044-1.19-.03-2.08.188-1.536.374-3.618 1.343-6.161 3.604l-2.4.238h-.006a2.552 2.552 0 0 0-1.524.734L.15 7.17a.512.512 0 0 0 .433.868l1.896-.271c.28-.04.592.013.955.132.232.076.437.16.655.248l.203.083c.196.816.66 1.58 1.275 2.195.613.614 1.376 1.08 2.191 1.277l.082.202c.089.218.173.424.249.657.118.363.172.676.132.956l-.271 1.9a.512.512 0 0 0 .867.433l2.382-2.386c.41-.41.668-.949.732-1.526l.24-2.408Zm.11-3.699c-.797.8-1.93.961-2.528.362-.598-.6-.436-1.733.361-2.532.798-.799 1.93-.96 2.528-.361.599.599.437 1.732-.36 2.531Z"></path>
                        <path d="M5.205 10.787a7.632 7.632 0 0 0 1.804 1.352c-1.118 1.007-4.929 2.028-5.054 1.903-.126-.127.737-4.189 1.839-5.18.346.69.837 1.35 1.411 1.925Z"></path>
                    </svg>
                </div>
                <div class="stars">
                    <svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" fill="#fff" class="star bi bi-star-fill" viewBox="0 0 16 16"><path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"></path></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" fill="#fff" class="star bi bi-star-fill" viewBox="0 0 16 16"><path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"></path></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" fill="#fff" class="star bi bi-star-fill" viewBox="0 0 16 16"><path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"></path></svg>
                    <svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" fill="#fff" class="star bi bi-star-fill" viewBox="0 0 16 16"><path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.282.95l-3.522 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"></path></svg>
                </div>
            </span>
        </label>
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
            <button class="btn-action btn-remove">Fjern</button>
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

    card.querySelector('.boost-switch input').addEventListener('change', (e) => {
        send('connection/boost', { name: connection.name, enabled: e.target.checked })
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

    const boostCheckbox = card.querySelector('.boost-switch input')
    if (boostCheckbox) {
        boostCheckbox.checked = connection.boost_mode === true
    }
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
