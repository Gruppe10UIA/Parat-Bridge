/** @file App entry point. SPA navigation and module initialization. */

import { startListening } from './uib-bridge.js'

// ===== SPA Navigation =====

/** Set up click handlers for nav tabs to switch visible page sections. */
function initNavigation() {
    const navLinks = document.querySelectorAll('#main-nav a[data-page]')
    const pages = document.querySelectorAll('.page')

    navLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
            e.preventDefault()

            const targetPage = link.dataset.page

            navLinks.forEach((l) => l.classList.remove('active'))
            link.classList.add('active')

            pages.forEach((p) => p.classList.remove('active'))
            document.getElementById(`page-${targetPage}`).classList.add('active')
        })
    })
}

// ===== Init =====

initNavigation()
startListening()
