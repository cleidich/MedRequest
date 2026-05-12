/**
 * patient.js — Patient view: submit requests and see own request history.
 */

/* global Auth, Api, document */

const PatientView = (() => {
  function render(container) {
    container.innerHTML = `
      <section class="view-header">
        <h2>Submit a Request</h2>
        <p>Let us know how we can help during your stay.</p>
      </section>

      <form id="request-form" class="request-form" novalidate>
        <div class="form-group">
          <label for="req-type">Request Type</label>
          <select id="req-type" class="form-control" required aria-required="true">
            <option value="">— Select type —</option>
            <option value="comfort">Comfort Item</option>
            <option value="service">Service Request</option>
            <option value="staff">Staff Assistance</option>
            <option value="feedback">Feedback</option>
          </select>
        </div>

        <div class="form-group">
          <label for="req-subject">Subject</label>
          <input type="text" id="req-subject" class="form-control"
                 placeholder="Brief summary of your request" required aria-required="true" maxlength="200">
        </div>

        <div class="form-group">
          <label for="req-body">Details</label>
          <textarea id="req-body" class="form-control"
                    placeholder="Please describe what you need…" rows="4" aria-required="true" required></textarea>
        </div>

        <button type="submit" class="btn btn-primary">Send Request</button>
        <div id="form-alert" role="alert" aria-live="polite"></div>
      </form>

      <section class="view-header" style="margin-top:2rem;">
        <h2>Your Requests</h2>
      </section>
      <div id="patient-requests" aria-live="polite">
        <div class="loading">Loading your requests…</div>
      </div>
    `;

    _bindForm(container);
    _loadRequests(container);
  }

  function _bindForm(container) {
    const form = container.querySelector('#request-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const alertEl = container.querySelector('#form-alert');
      alertEl.innerHTML = '';

      const type = form.querySelector('#req-type').value;
      const subject = form.querySelector('#req-subject').value.trim();
      const body = form.querySelector('#req-body').value.trim();

      if (!type || !subject || !body) {
        alertEl.innerHTML = '<div class="alert alert-error">Please fill in all fields.</div>';
        return;
      }

      try {
        await Api.createRequest({ type, subject, body });
        alertEl.innerHTML = '<div class="alert alert-success">Request submitted!</div>';
        form.reset();
        _loadRequests(container);
      } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-error">Error: ${err.message}</div>`;
      }
    });
  }

  async function _loadRequests(container) {
    const listEl = container.querySelector('#patient-requests');
    try {
      const requests = await Api.getRequests();
      if (!requests || requests.length === 0) {
        listEl.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📭</div>
            <p>You haven't submitted any requests yet.</p>
          </div>`;
        return;
      }

      listEl.innerHTML = requests.map((r) => `
        <article class="card" aria-label="Request: ${_esc(r.subject)}">
          <div class="card-header">
            <span class="card-title">${_esc(r.subject)}</span>
            <span class="badge badge-${r.status}">${_statusLabel(r.status)}</span>
          </div>
          <div class="card-meta">${_esc(r.type)} · ${_formatDate(r.created_at)}</div>
          <div class="card-body">${_esc(r.body)}</div>
        </article>
      `).join('');
    } catch (err) {
      listEl.innerHTML = `<div class="alert alert-error">Could not load requests: ${err.message}</div>`;
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
