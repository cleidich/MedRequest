/**
 * api.js — Fetch wrapper for the MedRequest API.
 * Automatically attaches auth headers to every request.
 */

/* global Auth, fetch */

const Api = (() => {
  // Base URL is configurable; defaults to /api (proxied in production).
  let baseUrl = '/api';

  async function request(method, path, body) {
    const url = baseUrl + path;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...Auth.headers(),
      },
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
    }

    // 204 No Content
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    /** Override the default API base URL. */
    setBaseUrl(url) {
      baseUrl = url.replace(/\/+$/, '');
    },

    getBaseUrl() {
      return baseUrl;
    },

    // --- Request CRUD ---

    /** Create a new patient request. */
    createRequest(data) {
      return request('POST', '/requests', data);
    },

    /** Get requests — optionally filter by status. */
    getRequests(params) {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request('GET', '/requests' + qs);
    },

    /** Get a single request by ID. */
    getRequest(id) {
      return request('GET', `/requests/${id}`);
    },

    /** Update a request (status change, notes, etc.). */
    updateRequest(id, data) {
      return request('PATCH', `/requests/${id}`, data);
    },
  };
})();
