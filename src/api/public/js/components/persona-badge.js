/**
 * persona-badge.js — Floating persona indicator for MedRequest demo.
 * Shows current tenant, user, and role in top-right corner.
 * 
 * ⚠️ DEMO MODE INDICATOR — NOT PRODUCTION-READY AUTH
 */

/* global document */

const PersonaBadge = (() => {
  const ROLE_ICONS = {
    patient: '🧑‍⚕️',
    concierge: '🛎️',
    casemanager: '📋',
  };

  const ROLE_LABELS = {
    patient: 'Patient',
    concierge: 'Concierge',
    casemanager: 'Case Manager',
  };

  let badgeEl = null;

  /**
   * Render the persona badge with the given persona data.
   * @param {Object} persona - { tenantName, displayName, role, ... }
   */
  function render(persona) {
    remove(); // Clear any existing badge

    badgeEl = document.createElement('div');
    badgeEl.className = 'persona-badge';
    badgeEl.setAttribute('role', 'status');
    badgeEl.setAttribute('aria-live', 'polite');

    const roleIcon = ROLE_ICONS[persona.role] || '👤';
    const roleLabel = ROLE_LABELS[persona.role] || persona.role;

    badgeEl.innerHTML = `
      <div class="persona-badge-header">
        <span class="persona-badge-demo-label">DEMO MODE</span>
      </div>
      <div class="persona-badge-body">
        <div class="persona-badge-tenant">
          <span aria-hidden="true">🏥</span>
          ${persona.tenantName}
        </div>
        <div class="persona-badge-user">
          <span aria-hidden="true">${roleIcon}</span>
          ${persona.displayName} <span class="persona-badge-role">(${roleLabel})</span>
        </div>
      </div>
      <div class="persona-badge-footer">
        <a href="/" class="persona-badge-switch-btn" aria-label="Switch to a different persona">
          Switch Persona
        </a>
      </div>
    `;

    document.body.appendChild(badgeEl);
  }

  /**
   * Remove the persona badge from the DOM.
   */
  function remove() {
    if (badgeEl && badgeEl.parentNode) {
      badgeEl.parentNode.removeChild(badgeEl);
    }
    badgeEl = null;
  }

  return {
    render,
    remove,
  };
})();
