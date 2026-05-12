/**
 * auth.js — Demo auth helper for MedRequest.
 * Stores tenant/user/role in localStorage and provides
 * header values for API calls.
 */

/* global window, localStorage */

const Auth = (() => {
  const STORAGE_KEY = 'medrequest_auth';

  const DEFAULTS = {
    tenantId: 'tenant-001',
    userId: 'patient-001',
    role: 'patient',
  };

  function _load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function _save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /** Mapping of roles to default demo user IDs. */
  const ROLE_USERS = {
    patient: 'patient-001',
    concierge: 'concierge-001',
    casemanager: 'casemgr-001',
  };

  return {
    /** Get current auth state. */
    get() {
      return _load();
    },

    /** Set role and update the default userId for that role. */
    setRole(role) {
      const data = _load();
      data.role = role;
      data.userId = ROLE_USERS[role] || role + '-001';
      _save(data);
      return data;
    },

    /** Set all auth fields at once. */
    set({ tenantId, userId, role }) {
      const data = _load();
      if (tenantId) data.tenantId = tenantId;
      if (userId) data.userId = userId;
      if (role) data.role = role;
      _save(data);
      return data;
    },

    /** Return HTTP headers for API requests. */
    headers() {
      const data = _load();
      return {
        'X-Tenant-Id': data.tenantId,
        'X-User-Id': data.userId,
        'X-User-Role': data.role,
      };
    },
  };
})();
