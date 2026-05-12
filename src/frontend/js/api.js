/**
 * api.js — Fetch wrapper for the MedRequest API.
 * Automatically attaches auth headers to every request.
 */

/* global Auth, fetch */

const Api = (() => {
  const DIRECT_BASE = '/api';

  let baseUrl = DIRECT_BASE;
  let useApim = false;
  let apimBaseUrl = null;
  let apimKey = null;

  async function request(method, path, body, _retried) {
    const url = baseUrl + path;
    const headers = {
      'Content-Type': 'application/json',
      ...Auth.headers(),
    };
    if (useApim && apimKey) {
      headers['Ocp-Apim-Subscription-Key'] = apimKey;
    }
    const options = {
      method,
      headers,
      mode: 'cors',
    };
    if (body) {
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      // APIM Consumption tier cold-starts can cause the first request to fail.
      // Retry once after a short delay before giving up.
      if (!_retried && useApim) {
        await new Promise(r => setTimeout(r, 2000));
        return request(method, path, body, true);
      }
      throw new Error(`Could not load ${path}: ${err.message}`);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`API ${method} ${path} failed (${res.status}): ${text}`);
    }

    // 204 No Content
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    /**
     * Fetch runtime configuration from the backend.
     * Must be called (and awaited) before any other API calls.
     */
    async init() {
      try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error(`Config fetch failed (${res.status})`);
        const config = await res.json();

        if (config.apim && config.apim.enabled) {
          apimBaseUrl = config.apim.baseUrl.replace(/\/+$/, '');
          apimKey = config.apim.subscriptionKey || null;
          useApim = true;
          baseUrl = apimBaseUrl;
          // Warm up APIM (Consumption tier cold-start) — fire and forget
          fetch(apimBaseUrl + '/health', {
            headers: { 'Ocp-Apim-Subscription-Key': apimKey || '' },
            mode: 'cors',
          }).catch(() => {});
        } else {
          apimBaseUrl = null;
          apimKey = null;
          useApim = false;
          baseUrl = DIRECT_BASE;
        }
      } catch (err) {
        // If config endpoint is unavailable, fall back to direct mode
        console.warn('Could not load /api/config — using direct API mode:', err.message);
        useApim = false;
        baseUrl = DIRECT_BASE;
      }
    },

    /** Override the default API base URL. */
    setBaseUrl(url) {
      baseUrl = url.replace(/\/+$/, '');
    },

    getBaseUrl() {
      return baseUrl;
    },

    /** Toggle between APIM gateway and direct App Service routing. */
    setApimEnabled(enabled) {
      useApim = enabled && !!apimBaseUrl;
      baseUrl = (useApim && apimBaseUrl) ? apimBaseUrl : DIRECT_BASE;
    },

    isApimEnabled() {
      return useApim;
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

    // --- Integration endpoints ---

    /** Forward a request to the EMR system. */
    forwardToEmr(requestId) {
      return request('POST', '/integration/forward-emr', { request_id: requestId });
    },

    /** Forward a request to the business office. */
    forwardToBusinessOffice(requestId) {
      return request('POST', '/integration/forward-business-office', { request_id: requestId });
    },

    /** Send a notification. */
    notify(data) {
      return request('POST', '/integration/notify', data);
    },

    // --- Debug / Explorer ---

    /** Run a pre-built explorer query to demonstrate RLS. */
    runExplorerQuery(queryKey) {
      return request('POST', '/debug/explore', { queryKey });
    },
  };
})();
