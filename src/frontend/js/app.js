/**
 * app.js — MedRequest app bootstrap and hash-based router.
 */

/* global Auth, PatientView, ConciergeView, CaseManagerView, document, window */

const App = (() => {
  const VIEWS = {
    patient:     PatientView,
    concierge:   ConciergeView,
    casemanager: CaseManagerView,
  };

  const mainEl = () => document.getElementById('app');

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

  /** Render the view matching the current hash. */
  function _renderView() {
    const route = _currentRoute();

    if (!route) {
      // Default to patient view
      window.location.hash = '#patient';
      return; // hashchange will fire and re-enter
    }

    // Update auth role to match selected view
    Auth.setRole(route);
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
  function init() {
    _initMenu();

    // Listen for hash changes (role/view switching)
    window.addEventListener('hashchange', _renderView);

    // Initial render
    _renderView();
  }

  return { init };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
