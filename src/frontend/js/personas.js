/**
 * personas.js — Demo persona registry for MedRequest.
 * Maps persona slugs to tenant/user/role data for instant switching.
 * 
 * ⚠️ DEMO ONLY — NOT PRODUCTION-READY AUTH
 */

/* global window */

const Personas = (() => {
  // Persona registry: 9 personas across 3 hospital tenants
  const PERSONAS = {
    'mercy-patient': {
      slug: 'mercy-patient',
      tenantId: 'A0000000-0000-0000-0000-000000000001',
      tenantName: 'Mercy General Hospital',
      userId: '10000000-0000-0000-0000-000000000001',
      role: 'patient',
      displayName: 'Alice Johnson',
    },
    'mercy-concierge': {
      slug: 'mercy-concierge',
      tenantId: 'A0000000-0000-0000-0000-000000000001',
      tenantName: 'Mercy General Hospital',
      userId: '10000000-0000-0000-0000-000000000003',
      role: 'concierge',
      displayName: 'Carol Davis',
    },
    'mercy-casemanager': {
      slug: 'mercy-casemanager',
      tenantId: 'A0000000-0000-0000-0000-000000000001',
      tenantName: 'Mercy General Hospital',
      userId: '10000000-0000-0000-0000-000000000004',
      role: 'casemanager',
      displayName: 'Dan Martinez',
    },
    'stclaire-patient': {
      slug: 'stclaire-patient',
      tenantId: 'B0000000-0000-0000-0000-000000000002',
      tenantName: 'St. Claire Medical Center',
      userId: '20000000-0000-0000-0000-000000000001',
      role: 'patient',
      displayName: 'Eve Thompson',
    },
    'stclaire-concierge': {
      slug: 'stclaire-concierge',
      tenantId: 'B0000000-0000-0000-0000-000000000002',
      tenantName: 'St. Claire Medical Center',
      userId: '20000000-0000-0000-0000-000000000002',
      role: 'concierge',
      displayName: 'Frank Lee',
    },
    'stclaire-casemanager': {
      slug: 'stclaire-casemanager',
      tenantId: 'B0000000-0000-0000-0000-000000000002',
      tenantName: 'St. Claire Medical Center',
      userId: '20000000-0000-0000-0000-000000000003',
      role: 'casemanager',
      displayName: 'Grace Kim',
    },
    'harbor-patient': {
      slug: 'harbor-patient',
      tenantId: 'C0000000-0000-0000-0000-000000000003',
      tenantName: 'Harbor Medical Center',
      userId: '30000000-0000-0000-0000-000000000001',
      role: 'patient',
      displayName: 'Henry Park',
    },
    'harbor-concierge': {
      slug: 'harbor-concierge',
      tenantId: 'C0000000-0000-0000-0000-000000000003',
      tenantName: 'Harbor Medical Center',
      userId: '30000000-0000-0000-0000-000000000002',
      role: 'concierge',
      displayName: 'Isabel Chen',
    },
    'harbor-casemanager': {
      slug: 'harbor-casemanager',
      tenantId: 'C0000000-0000-0000-0000-000000000003',
      tenantName: 'Harbor Medical Center',
      userId: '30000000-0000-0000-0000-000000000003',
      role: 'casemanager',
      displayName: 'Jack O\'Brien',
    },
  };

  /**
   * Parse the ?persona= query param from the current URL.
   * @returns {Object|null} Persona object or null if not found.
   */
  function getFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('persona');
    return slug ? PERSONAS[slug] || null : null;
  }

  /**
   * Get all personas grouped by tenant.
   * @returns {Array} Array of { tenantName, tenantId, personas: [...] }
   */
  function getAll() {
    const grouped = {};
    Object.values(PERSONAS).forEach((persona) => {
      if (!grouped[persona.tenantId]) {
        grouped[persona.tenantId] = {
          tenantId: persona.tenantId,
          tenantName: persona.tenantName,
          personas: [],
        };
      }
      grouped[persona.tenantId].personas.push(persona);
    });
    return Object.values(grouped);
  }

  /**
   * Get personas for a specific tenant (by slug or ID).
   * @param {string} tenantSlug - e.g., 'mercy', 'stclaire', 'harbor'
   * @returns {Array} Array of persona objects
   */
  function getByTenant(tenantSlug) {
    return Object.values(PERSONAS).filter((p) => {
      return p.slug.startsWith(tenantSlug + '-');
    });
  }

  return {
    getFromUrl,
    getAll,
    getByTenant,
  };
})();
