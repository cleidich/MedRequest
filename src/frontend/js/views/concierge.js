/**
 * concierge.js — Concierge dashboard: list tenant requests, filter, update status.
 */

/* global Api, document */

const ConciergeView = (() => {
  let _container;

  function render(container) {
    _container = container;
    container.innerHTML = `
      <section class="view-header">
        <h2>Concierge Dashboard</h2>
        <p>Review and manage patient requests for your facility.</p>
      </section>

      <div class="filter-bar" role="search" aria-label="Filter requests">
        <label for="filter-status">Filter by status:</label>
        <select id="filter-status" class="form-control" style="width:auto;">
          <option value="">All</option>
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="forwarded">Forwarded</option>
        </select>
      </div>

      <div id="concierge-requests" aria-live="polite">
        <div class="loading">Loading requests…</div>
      </div>
    `;

    container.querySelector('#filter-status').addEventListener('change', () => _loadRequests());
    _loadRequests();
  }

  async function _loadRequests() {
    const listEl = _container.querySelector('#concierge-requests');
    const status = _container.querySelector('#filter-status').value;
    const params = status ? { status } : undefined;

    try {
      const requests = await Api.getRequests(params);
      if (!requests || requests.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <p>No requests found${status ? ' with status "' + _esc(status) + '"' : ''}.</p>
          </div>`;
        return;
      }

      listEl.innerHTML = requests.map((r) => `
        <article class="card" aria-label="Request: ${_esc(r.subject)}">
          <div class="card-header">
            <span class="card-title">${_esc(r.subject)}</span>
            <span class="badge badge-${r.status}">${_statusLabel(r.status)}</span>
          </div>
          <div class="card-meta">
            ${_esc(r.type)} · Patient: ${_esc(r.user_id || r.patient_id || 'N/A')} · ${_formatDate(r.created_at)}
          </div>
          <div class="card-body">${_esc(r.body)}</div>
          <div class="card-actions">
            ${r.status === 'new' ? `<button class="btn btn-sm btn-warning" data-action="in_progress" data-id="${r.id}">Start Working</button>` : ''}
            ${r.status === 'in_progress' ? `<button class="btn btn-sm btn-success" data-action="resolved" data-id="${r.id}">Resolve</button>` : ''}
          </div>
        </article>
      `).join('');

      // Bind action buttons
      listEl.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => _updateStatus(btn.dataset.id, btn.dataset.action));
      });
    } catch (err) {
      listEl.innerHTML = `<div class="alert alert-error">Could not load requests: ${err.message}</div>`;
    }
  }

  async function _updateStatus(id, newStatus) {
    try {
      await Api.updateRequest(id, { status: newStatus });
      _loadRequests();
    } catch (err) {
      alert('Failed to update request: ' + err.message);
    }
  }

  function _esc(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }

  function _statusLabel(status) {
    const labels = { new: 'New', in_progress: 'In Progress', resolved: 'Resolved', forwarded: 'Forwarded' };
    return labels[status] || status;
  }

  function _formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
  }

  return { render };
})();
