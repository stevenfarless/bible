// credential-modals.js
// Lazily injects changeEmail and changePassword modals into the DOM
// on demand so Chrome's password-form scanner never sees them at parse time.

import { handleChangeEmail, handleChangePassword } from './auth.js';

const CHANGE_EMAIL_HTML = `
<div id="changeEmailModal" class="modal">
                <div class="modal-content">
                        <div class="modal-header">
                                <h3>Change Email</h3>
                                <button class="close-btn" id="closeChangeEmailModal">&times;</button>
                        </div>
                        <div class="modal-body">
                                <form id="changeEmailForm">
                                        <input type="hidden" name="username" autocomplete="username">
                                        <div class="setting-item">
                                                <label for="changeEmailCurrent">Current Password</label>
                                                <input type="password" id="changeEmailCurrent" class="input-field" placeholder="Enter current password" autocomplete="current-password">
                                        </div>
                                        <div class="setting-item">
                                                <label for="changeEmailNew">New Email</label>
                                                <input type="email" id="changeEmailNew" class="input-field" placeholder="Enter new email" autocomplete="email">
                                        </div>
                                        <button type="submit" class="primary-btn" style="width:100%;margin-top:var(--spacing-md)">Update Email</button>
                                </form>
                        </div>
                </div>
        </div>`;

const CHANGE_PASSWORD_HTML = `
<div id="changePasswordModal" class="modal">
                <div class="modal-content">
                        <div class="modal-header">
                                <h3>Change Password</h3>
                                <button class="close-btn" id="closeChangePasswordModal">&times;</button>
                        </div>
                        <div class="modal-body">
                                <form id="changePasswordForm">
                                        <input type="hidden" name="username" autocomplete="username">
                                        <div class="setting-item">
                                                <label for="changePasswordCurrent">Current Password</label>
                                                <input type="password" id="changePasswordCurrent" class="input-field" placeholder="Enter current password" autocomplete="current-password">
                                        </div>
                                        <div class="setting-item">
                                                <label for="changePasswordNew">New Password</label>
                                                <input type="password" id="changePasswordNew" class="input-field" placeholder="At least 6 characters" autocomplete="new-password">
                                        </div>
                                        <button type="submit" class="primary-btn" style="width:100%;margin-top:var(--spacing-md)">Update Password</button>
                                </form>
                        </div>
                </div>
        </div>`;

function injectModal(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html.trim();
    const el = tmp.firstElementChild;
    document.body.appendChild(el);
    return el;
}

function teardown(modal, app) {
    app.closeModal(modal);
    // Let the closing animation finish before removing
    modal.addEventListener('transitionend', () => modal.remove(), { once: true });
    // Fallback if no transition fires
    setTimeout(() => { if (modal.isConnected) modal.remove(); }, 400);
}

export function openChangeEmailModal(app) {
    const modal = injectModal(CHANGE_EMAIL_HTML);
    const usernameField = modal.querySelector('input[name="username"]');
    if (usernameField) usernameField.value = app.currentUser?.email ?? '';

    app.openModal(modal);

    modal.querySelector('#closeChangeEmailModal').addEventListener('click', () => teardown(modal, app));
    modal.querySelector('#changeEmailForm').addEventListener('submit', (e) => {
        e.preventDefault();
        handleChangeEmail(app).then(() => teardown(modal, app));
    });
}

export function openChangePasswordModal(app) {
    const modal = injectModal(CHANGE_PASSWORD_HTML);
    const usernameField = modal.querySelector('input[name="username"]');
    if (usernameField) usernameField.value = app.currentUser?.email ?? '';

    app.openModal(modal);

    modal.querySelector('#closeChangePasswordModal').addEventListener('click', () => teardown(modal, app));
    modal.querySelector('#changePasswordForm').addEventListener('submit', (e) => {
        e.preventDefault();
        handleChangePassword(app).then(() => teardown(modal, app));
    });
}
