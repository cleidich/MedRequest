/**
 * picker.js — Persona picker view for MedRequest demo.
 * Displays 3 tenant cards with persona selection buttons.
 */

/* global Personas, document */

const PickerView = (() => {
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

  /**
   * Render the persona picker into the given container.
   * @param {HTMLElement} container
   */
  function render(container) {
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'picker-wrapper';

    const header = document.createElement('div');
    header.className = 'picker-header';
    header.innerHTML = `
      <h1>MedRequest Demo</h1>
      <p>Select a hospital and role to start the demo</p>
    `;
    wrapper.appendChild(header);

    const tenantGroups = Personas.getAll();
    const grid = document.createElement('div');
    grid.className = 'picker-grid';

    tenantGroups.forEach((group) => {
      const card = _buildTenantCard(group);
      grid.appendChild(card);
    });

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
  }

  /**
   * Build a tenant card with 3 persona buttons.
   * @param {Object} group - { tenantId, tenantName, personas: [...] }
   * @returns {HTMLElement}
   */
  function _buildTenantCard(group) {
    const card = document.createElement('div');
    card.className = 'picker-card';
    card.dataset.tenantId = group.tenantId;

    const cardHeader = document.createElement('div');
    cardHeader.className = 'picker-card-header';
    cardHeader.innerHTML = `
      <h2 class="picker-card-title">🏥 ${group.tenantName}</h2>
    `;
    card.appendChild(cardHeader);

    const cardBody = document.createElement('div');
    cardBody.className = 'picker-card-body';

    group.personas.forEach((persona) => {
      const button = _buildPersonaButton(persona);
      cardBody.appendChild(button);
    });

    card.appendChild(cardBody);
    return card;
  }

  /**
   * Build a persona selection button.
   * @param {Object} persona
   * @returns {HTMLElement}
   */
  function _buildPersonaButton(persona) {
    const button = document.createElement('a');
    button.href = `/?persona=${persona.slug}#${persona.role}`;
    button.className = 'picker-persona-btn';
    button.setAttribute('role', 'button');

    const icon = document.createElement('span');
    icon.className = 'picker-persona-icon';
    icon.textContent = ROLE_ICONS[persona.role] || '👤';
    icon.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'picker-persona-label';

    const roleLabel = document.createElement('strong');
    roleLabel.textContent = ROLE_LABELS[persona.role] || persona.role;

    const nameLabel = document.createElement('span');
    nameLabel.className = 'picker-persona-name';
    nameLabel.textContent = persona.displayName;

    label.appendChild(roleLabel);
    label.appendChild(document.createElement('br'));
    label.appendChild(nameLabel);

    button.appendChild(icon);
    button.appendChild(label);

    return button;
  }

  return { render };
})();
