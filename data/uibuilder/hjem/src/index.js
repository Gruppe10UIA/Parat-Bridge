// Give VS Code IntelliSense for uibuilder
/// <reference path="../types/uibuilder.d.ts" />

// ===== SPA Navigation =====

const navLinks = document.querySelectorAll('#main-nav a[data-page]')
const pages = document.querySelectorAll('.page')

navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault()

        const targetPage = link.dataset.page

        // Toggle active nav link
        navLinks.forEach((l) => l.classList.remove('active'))
        link.classList.add('active')

        // Toggle active page
        pages.forEach((p) => p.classList.remove('active'))
        document.getElementById(`page-${targetPage}`).classList.add('active')
    })
})

// ===== UIbuilder =====

// Listen for incoming messages from Node-RED and action
// uibuilder.onChange('msg', (msg) => {
//     // do stuff with the incoming msg
// })
