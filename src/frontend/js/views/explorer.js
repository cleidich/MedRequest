/**
 * explorer.js — "Behind the Scenes" view: demonstrates Row-Level Security visually.
 * Shows pre-built query cards that reveal how RLS filters data per tenant.
 */

/* global Auth, Api, Personas, document */

const ExplorerView = (() => {
  const QUERIES = [
    {
      key: 'my_requests',
      name: 'My Requests',
      icon: '📋',
      description: 'Shows requests visible to the current persona. RLS automatically filters to your tenant.',
    },
    {
      key: 'all_users',
      name: 'All Users',
      icon: '👥',
      description: 'Shows users in the current tenant. Other tenants\' users are hidden by RLS.',
    },
    {
      key: 'request_count',
      name: 'Request Count',
      icon: '🔢',
      description: 'Counts requests visible to this tenant. Switch personas to compare — each tenant sees a different count.',
    },
    {
      key: 'tenant_info',
      name: 'Tenant Info',
      icon: '🏥',
      description: 'Shows which tenant the current session belongs to, as set by SESSION_CONTEXT.',
    },
    {
      key: 'cross_tenant',
      name: 'Cross-Tenant Proof',
      icon: '🛡️',
      description: 'Proves RLS prevents seeing other tenants\' data — even with a direct query against the full table.',
    },
  ];

  /** Get tenant color class from current auth state */
  function _getTenantStyle() {
    const auth = Auth.get();
    const tid = (auth.tenantId || '').toUpperCase();
    if (tid.startsWith('A0000000')) return { color: 'var(--tenant-mercy)', label: 'Mercy General Hospital' };
    if (tid.startsWith('B0000000')) return { color: 'var(--tenant-stclaire)', label: 'St. Claire Medical' };
    if (tid.startsWith('C0000000')) return { color: 'var(--tenant-harbor)', label: 'Harbor Medical Center' };
    return { color: 'var(--color-primary)', label: 'Unknown Tenant' };
  }

  /** Get current persona display info */
  function _getPersonaInfo() {
    const persona = Personas.getFromUrl();
    if (persona) return persona;
    const auth = Auth.get();
    return { displayName: auth.userId, role: auth.role, tenantName: _getTenantStyle().label };
  }

  /** Build the results table HTML from an array of row objects */
  function _buildTable(rows) {
    if (!rows || rows.length === 0) {
      return '<p class="explorer-no-results">No rows returned</p>';
    }
    const keys = Object.keys(rows[0]);
    const isIdCol = (k) => /id$/i.test(k) || k === 'id';
    const header = keys.map(k => `<th>${_escHtml(k)}</th>`).join('');
    const body = rows.map((row, i) => {
      const cells = keys.map(k => {
        const val = row[k] == null ? '' : String(row[k]);
        const cls = isIdCol(k) ? ' class="mono"' : '';
        return `<td${cls}>${_escHtml(val)}</td>`;
      }).join('');
      return `<tr class="${i % 2 === 0 ? 'even' : 'odd'}">${cells}</tr>`;
    }).join('');
    return `
      <div class="explorer-table-wrap">
        <table class="explorer-table">
          <thead><tr>${header}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>`;
  }

  function _escHtml(str) {
    const el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  /** Render a single query card */
  function _renderCard(q) {
    return `
      <div class="explorer-card" data-query="${q.key}">
        <div class="explorer-card-header">
          <span class="explorer-card-icon">${q.icon}</span>
          <div>
            <h3 class="explorer-card-title">${_escHtml(q.name)}</h3>
            <p class="explorer-card-desc">${_escHtml(q.description)}</p>
          </div>
        </div>
        <div class="explorer-card-actions">
          <button class="btn btn-primary btn-sm explorer-run-btn" data-query="${q.key}">
            ▶ Run Query
          </button>
        </div>
        <div class="explorer-card-results" id="results-${q.key}" style="display:none;"></div>
      </div>`;
  }

  /** Execute a query and display results */
  async function _runQuery(key, card) {
    const btn = card.querySelector('.explorer-run-btn');
    const resultsEl = card.querySelector('.explorer-card-results');

    btn.disabled = true;
    btn.textContent = '⏳ Running…';
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<p class="explorer-loading">Executing query…</p>';

    try {
      const data = await Api.runExplorerQuery(key);
      const rowCount = data.rows ? data.rows.length : 0;

      resultsEl.innerHTML = `
        ${data.sql ? `<div class="explorer-sql"><strong>SQL Executed:</strong><pre><code>${_escHtml(data.sql)}</code></pre></div>` : ''}
        <div class="explorer-row-count">
          <strong>Rows returned:</strong> <span class="badge badge-new">${rowCount}</span>
        </div>
        ${_buildTable(data.rows)}
        ${data.rlsNote ? `<div class="explorer-rls-note"><span class="rls-icon">🔒</span> ${_escHtml(data.rlsNote)}</div>` : ''}
      `;
    } catch (err) {
      resultsEl.innerHTML = `<div class="alert alert-error">Error: ${_escHtml(err.message)}</div>`;
    }

    btn.disabled = false;
    btn.textContent = '▶ Run Query';
  }

  function render(container) {
    const tenant = _getTenantStyle();
    const persona = _getPersonaInfo();

    container.innerHTML = `
      <section class="explorer-view">
        <div class="explorer-banner">
          <p>🔬 <strong>Behind the Scenes</strong> — This page demonstrates Row-Level Security (RLS) in Azure SQL Database. Each query runs against the FULL database, but RLS automatically filters results to only show data belonging to your current tenant. Switch personas to see different results from the same queries.</p>
        </div>

        <div class="explorer-persona-bar" style="border-left-color: ${tenant.color}">
          <div class="explorer-persona-info">
            <span class="explorer-persona-tenant" style="color: ${tenant.color}">${_escHtml(persona.tenantName || tenant.label)}</span>
            <span class="explorer-persona-detail">${_escHtml(persona.displayName || '')} · <em>${_escHtml(persona.role || '')}</em></span>
          </div>
        </div>

        <div class="explorer-cards">
          ${QUERIES.map(_renderCard).join('')}
        </div>
      </section>
    `;

    // Wire up Run Query buttons
    container.querySelectorAll('.explorer-run-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.query;
        const card = btn.closest('.explorer-card');
        _runQuery(key, card);
      });
    });
  }

  return { render };
})();
