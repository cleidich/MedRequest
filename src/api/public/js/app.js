/**
 * app.js — MedRequest app bootstrap and hash-based router.
 * Now includes persona detection and picker routing.
 */

/* global Auth, Personas, PersonaBadge, PickerView, PatientView, ConciergeView, CaseManagerView, ExplorerView, document, window */

const App = (() => {
  const VIEWS = {
    patient:     PatientView,
    concierge:   ConciergeView,
    casemanager: CaseManagerView,
    explorer:    ExplorerView,
  };

  const mainEl = () => document.getElementById('app');
  let currentPersona = null;

  /** Determine the current route from the URL hash. */
  function _currentRoute() {
    const hash = window.location.hash.replace('#', '').toLowerCase();
    return VIEWS[hash] ? hash : null;
  }

  /** Update the nav to reflect the active role. */
  function _setActiveNav(role) {
    document.querySelectorAll('.role-link').forEach((link) => {
      const isActive = link.dataset.role === role;
      link.setAttribute('aria-current', isActive ? 'true' : 'false');
    });
  }

  /** Detect and apply persona from URL query params. */
  function _detectPersona() {
    const persona = Personas.getFromUrl();
    if (persona) {
      currentPersona = persona;
      Auth.set({
        tenantId: persona.tenantId,
        userId: persona.userId,
        role: persona.role,
      });
      PersonaBadge.render(persona);
      return true;
    }
    return false;
  }

  /** Render the view matching the current hash. */
  function _renderView() {
    const route = _currentRoute();

    // If no persona and no hash, show the picker
    if (!currentPersona && !route) {
      PersonaBadge.remove();
      const container = mainEl();
      container.innerHTML = '';
      PickerView.render(container);
      return;
    }

    if (!route) {
      // Default to patient view
      window.location.hash = '#patient';
      return; // hashchange will fire and re-enter
    }

    // Update auth role to match selected view (skip if persona is active — it has real UUIDs)
    if (!currentPersona) {
      Auth.setRole(route);
    }
    _setActiveNav(route);

    const container = mainEl();
    container.innerHTML = '';
    VIEWS[route].render(container);
  }

  /** Wire up the mobile menu toggle. */
  function _initMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.role-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close menu when a role is selected (mobile UX)
    nav.addEventListener('click', (e) => {
      if (e.target.closest('.role-link')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /** Initialize the app. */
  async function init() {
    _initMenu();

    // Fetch runtime config (APIM vs direct mode) before any API calls
    await Api.init();

    // Detect persona from URL before rendering
    _detectPersona();

    // Listen for hash changes (role/view switching)
    window.addEventListener('hashchange', _renderView);

    // Initial render
    _renderView();
  }

  return { init };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
