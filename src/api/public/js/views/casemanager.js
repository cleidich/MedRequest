/**
 * casemanager.js — Case Manager dashboard: review requests, forward to record or business office.
 */

/* global Api, document, alert */

const CaseManagerView = (() => {
  let _container;

  function render(container) {
    _container = container;
    container.innerHTML = `
      <section class="view-header">
        <h2>Case Manager Dashboard</h2>
        <p>Coordinate care requests — forward items to patient records or the business office.</p>
      </section>

      <div class="filter-bar" role="search" aria-label="Filter requests">
        <label for="cm-filter-status">Filter by status:</label>
        <select id="cm-filter-status" class="form-control" style="width:auto;">
          <option value="">All</option>
          <option value="new">New</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="forwarded">Forwarded</option>
        </select>
      </div>

      <div id="cm-requests" aria-live="polite">
        <div class="loading">Loading requests…</div>
      </div>
    `;

    container.querySelector('#cm-filter-status').addEventListener('change', () => _loadRequests());
    _loadRequests();
  }

  async function _loadRequests() {
    const listEl = _container.querySelector('#cm-requests');
    const status = _container.querySelector('#cm-filter-status').value;
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
            ${r.status === 'new' ? `<button class="btn btn-sm btn-primary" data-action="acknowledge" data-id="${r.id}">Acknowledge</button>` : ''}
            ${r.status !== 'resolved' && r.status !== 'closed' ? `<button class="btn btn-sm btn-success" data-action="resolve" data-id="${r.id}">Resolve</button>` : ''}
            ${r.status === 'resolved' ? `<button class="btn btn-sm btn-secondary" data-action="close" data-id="${r.id}">Close</button>` : ''}
            ${r.status !== 'forwarded' && r.status !== 'closed' ? `<button class="btn btn-sm btn-info" data-action="forward-record" data-id="${r.id}">Forward to Medical Record</button>` : ''}
            ${r.status !== 'forwarded' && r.status !== 'closed' ? `<button class="btn btn-sm btn-warning" data-action="forward-bizoffice" data-id="${r.id}">Forward to Business Office</button>` : ''}
          </div>
          <div class="card-alert" role="alert" aria-live="polite"></div>
        </article>
      `).join('');

      listEl.querySelectorAll('[data-action]').forEach((btn) => {
        btn.addEventListener('click', () => _handleAction(btn.dataset.id, btn.dataset.action, btn));
      });
    } catch (err) {
      listEl.innerHTML = `<div class="alert alert-error">Could not load requests: ${err.message}</div>`;
    }
  }

  async function _handleAction(id, action, btnEl) {
    const card = btnEl.closest('.card');
    const alertEl = card ? card.querySelector('.card-alert') : null;
    const clearAlert = () => { if (alertEl) alertEl.innerHTML = ''; };
    const showSuccess = (msg) => { if (alertEl) alertEl.innerHTML = `<div class="alert alert-success">${_esc(msg)}</div>`; };

    try {
      switch (action) {
        case 'acknowledge':
          await Api.updateRequest(id, { status: 'acknowledged' });
          break;
        case 'resolve':
          await Api.updateRequest(id, { status: 'resolved' });
          break;
        case 'close':
          await Api.updateRequest(id, { status: 'closed' });
          break;
        case 'forward-record':
          await Api.forwardToEmr(id);
          await Api.updateRequest(id, { status: 'forwarded', forwarded_to: 'patient_record' });
          showSuccess('Forwarded to Medical Record.');
          break;
        case 'forward-bizoffice':
          await Api.forwardToBusinessOffice(id);
          await Api.updateRequest(id, { status: 'forwarded', forwarded_to: 'business_office' });
          showSuccess('Forwarded to Business Office.');
          break;
      }
      // Small delay on forwards so user sees the success toast
      if (action === 'forward-record' || action === 'forward-bizoffice') {
        setTimeout(() => _loadRequests(), 800);
      } else {
        _loadRequests();
      }
    } catch (err) {
      if (alertEl) {
        alertEl.innerHTML = `<div class="alert alert-error">Action failed: ${_esc(err.message)}</div>`;
        setTimeout(clearAlert, 4000);
      }
    }
  }

  function _esc(str) {
    const el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
  }

  function _statusLabel(status) {
    const labels = {
      new: 'New', acknowledged: 'Acknowledged', in_progress: 'In Progress',
      resolved: 'Resolved', forwarded: 'Forwarded', closed: 'Closed'
    };
    return labels[status] || status;
  }

  function _formatDate(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
  }

  return { render };
})();
