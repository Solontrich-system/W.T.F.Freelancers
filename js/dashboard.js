/* ═══════════════════════════════════════
   WFT Owner Dashboard — dashboard.js
   Supabase live data + Chart.js rendering
═══════════════════════════════════════ */

/* ── CONFIG ── */
const SUPABASE_URL = 'https://bzqetkzxksmwkibbelnc.supabase.co';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cWV0a3p4a3Ntd2tpYmJlbG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTUyODcsImV4cCI6MjA5MzQzMTI4N30.Adu_SIxxDuYsZcWgcyxpADGu7k5E9pZOVBgVKGTnmug';

/* ── STATE ── */
let currentPage = 'overview';
let allData     = { orders: [], transactions: [], gigs: [], users: [] };
let charts      = {};

/* ── SUPABASE QUERY ── */
async function sbQuery(table, params = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
    headers: {
      'apikey':        ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'count=exact'
    }
  });
  if (!res.ok) throw new Error(`Supabase error on ${table}: ${res.status}`);
  const total = res.headers.get('content-range')?.split('/')[1];
  const data  = await res.json();
  return { data: Array.isArray(data) ? data : [], count: total ? parseInt(total) : (Array.isArray(data) ? data.length : 0) };
}

/* ── FORMATTERS ── */
const fmt      = n  => (isNaN(n) ? '—' : Math.round(n).toLocaleString('en-ZA'));
const fmtMoney = n  => 'R\u202f' + Math.round(n).toLocaleString('en-ZA');
const fmtDate  = d  => d ? new Date(d).toLocaleDateString('en-ZA', { day:'2-digit', month:'short', year:'numeric' }) : '—';

function countBy(arr, key) {
  return arr.reduce((acc, item) => {
    const v = item[key] || 'Unknown';
    acc[v]  = (acc[v] || 0) + 1;
    return acc;
  }, {});
}

function badge(status) {
  const map = {
    'Completed':   'completed',
    'Pending':     'pending',
    'In Progress': 'progress',
    'Delivered':   'progress',
    'Processing':  'progress',
    'Failed':      'failed',
    'Refunded':    'refunded'
  };
  return `<span class="badge badge-${map[status] || 'pending'}">${status || '—'}</span>`;
}

function initials(name) {
  return (name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/* ── CHART HELPERS ── */
function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function buildLegend(elId, labels, colors, values) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = labels.map((l, i) =>
    `<div class="legend-item"><div class="legend-dot" style="background:${colors[i]}"></div>${l}&nbsp;<strong>${values[i]}</strong></div>`
  ).join('');
}

/* ── CHART RENDERERS ── */
function renderOrderChart(orders) {
  const counts  = countBy(orders, 'status');
  const labels  = Object.keys(counts);
  const values  = Object.values(counts);
  const palette = { 'Pending':'#f0a500','In Progress':'#4da6ff','Delivered':'#22c993','Completed':'#a3e635' };
  const colors  = labels.map(l => palette[l] || '#6b6862');
  buildLegend('order-legend', labels, colors, values);
  destroyChart('orderChart');
  charts['orderChart'] = new Chart(document.getElementById('orderChart'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 3, borderColor: '#1d1b19', hoverOffset: 5 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '66%',
      plugins: { legend: { display: false } }
    }
  });
}

function renderTxnChart(txns) {
  const counts  = countBy(txns, 'status');
  const labels  = Object.keys(counts);
  const values  = Object.values(counts);
  const palette = { 'Pending':'#f0a500','Processing':'#4da6ff','Completed':'#22c993','Failed':'#f87171','Refunded':'#a78bfa' };
  const colors  = labels.map(l => palette[l] || '#6b6862');
  buildLegend('txn-legend', labels, colors, values);
  destroyChart('txnChart');
  charts['txnChart'] = new Chart(document.getElementById('txnChart'), {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderRadius: 6, borderSkipped: false }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#6b6862' } },
        y: { beginAtZero: true, ticks: { stepSize: 1, color: '#6b6862' }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderCatChart(gigs) {
  const counts = countBy(gigs, 'category');
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = sorted.map(([k]) => k.length > 18 ? k.slice(0, 17) + '…' : k);
  const values = sorted.map(([, v]) => v);
  const palette = ['#22c993','#4da6ff','#f0a500','#a78bfa','#f87171','#fb923c','#34d399','#818cf8'];
  destroyChart('catChart');
  charts['catChart'] = new Chart(document.getElementById('catChart'), {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: palette.slice(0, values.length), borderRadius: 5 }] },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1, color: '#6b6862' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { grid: { display: false }, ticks: { color: '#a8a49d', font: { size: 12 } } }
      }
    }
  });
}

/* ── SECTION RENDERERS ── */
function renderRoles(users) {
  const el = document.getElementById('roles-container');
  if (!el) return;
  if (!users.length) { el.innerHTML = '<span class="empty-text">No users yet.</span>'; return; }
  const counts = countBy(users, 'role');
  const total  = users.length;
  const colors = { freelancer: '#22c993', buyer: '#4da6ff', both: '#a78bfa' };
  el.innerHTML = Object.entries(counts).map(([role, count]) => {
    const pct   = Math.round((count / total) * 100);
    const color = colors[role] || '#6b6862';
    return `<div class="role-bar">
      <div class="role-row">
        <span class="role-name">${role}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="role-pct">${count} (${pct}%)</span>
      </div>
    </div>`;
  }).join('');
}

function renderTopGigs(gigs) {
  const el  = document.getElementById('top-gigs');
  if (!el) return;
  const top = gigs.slice(0, 5);
  if (!top.length) { el.innerHTML = '<span class="empty-text">No gigs yet.</span>'; return; }
  el.innerHTML = top.map(g => `
    <div class="gig-row">
      <div>
        <div class="gig-row-name">${g.title}</div>
        <div class="gig-row-meta">${g.seller_name || '—'} · ${g.category || '—'}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div class="star-val">★ ${parseFloat(g.rating || 0).toFixed(1)}</div>
        <div class="star-reviews">${g.review_count || 0} reviews</div>
      </div>
    </div>`).join('');
}

function renderOverviewOrders(orders) {
  const el  = document.getElementById('overview-orders');
  const cnt = document.getElementById('orders-count');
  if (!el) return;
  if (cnt) cnt.textContent = `${orders.length} most recent`;
  if (!orders.length) { el.innerHTML = '<span class="empty-text">No orders yet.</span>'; return; }
  el.innerHTML = buildOrderTable(orders.slice(0, 10));
}

function renderOverviewTxns(txns) {
  const el  = document.getElementById('overview-txns');
  const cnt = document.getElementById('txns-count');
  if (!el) return;
  if (cnt) cnt.textContent = `${txns.length} most recent`;
  if (!txns.length) { el.innerHTML = '<span class="empty-text">No transactions yet.</span>'; return; }
  el.innerHTML = buildTxnTable(txns.slice(0, 10));
}


function renderOverviewUsers(users) {
  const el = document.getElementById('overview-users');
  if (!el) return;
  if (!users.length) { el.innerHTML = '<span class="empty-text">No users yet.</span>'; return; }
  const colorMap = { freelancer:'green', buyer:'', both:'purple' };
  el.innerHTML = users.slice(0, 6).map(u => {
    const name  = u.display_name || u.full_name || 'Unknown';
    const init  = initials(name);
    const cls   = colorMap[u.role] || '';
    return `<div class="chat-row">
      <div class="chat-row-left">
        <div class="mini-avatar ${cls}">${init}</div>
        <div>
          <div class="chat-row-name">${name}</div>
          <div class="chat-row-meta">${u.email || '—'}</div>
        </div>
      </div>
      <div>${badge(u.role)}</div>
    </div>`;
  }).join('');
}

/* ── TABLE BUILDERS ── */
function buildOrderTable(orders) {
  if (!orders.length) return '<span class="empty-text">No orders found.</span>';
  return `<table>
    <thead><tr>
      <th style="width:22%">Buyer</th>
      <th style="width:24%">Email</th>
      <th style="width:16%;text-align:center">Status</th>
      <th style="width:14%;text-align:right">Amount</th>
      <th style="width:14%;text-align:right">Date</th>
    </tr></thead>
    <tbody>${orders.map(o => `<tr>
      <td class="pr"><strong>${o.buyer_name || 'Guest'}</strong></td>
      <td class="pr td-muted">${o.buyer_email || '—'}</td>
      <td class="td-center">${badge(o.status)}</td>
      <td class="td-right">R ${(o.amount || 0).toLocaleString('en-ZA')}</td>
      <td class="td-right td-muted">${fmtDate(o.created_at)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function buildTxnTable(txns) {
  if (!txns.length) return '<span class="empty-text">No transactions found.</span>';
  return `<table>
    <thead><tr>
      <th style="width:30%">Gig</th>
      <th style="width:22%">Buyer</th>
      <th style="width:16%;text-align:center">Status</th>
      <th style="width:14%;text-align:right">Amount</th>
      <th style="width:18%;text-align:right">Date</th>
    </tr></thead>
    <tbody>${txns.map(t => `<tr>
      <td class="pr">${t.gig_title || '—'}</td>
      <td class="pr td-muted">${t.buyer_name || '—'}</td>
      <td class="td-center">${badge(t.status)}</td>
      <td class="td-right">R ${(t.amount || 0).toLocaleString('en-ZA')}</td>
      <td class="td-right td-muted">${fmtDate(t.created_at)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

function buildUserTable(users) {
  if (!users.length) return '<span class="empty-text">No users found.</span>';
  return `<table>
    <thead><tr>
      <th style="width:24%">Name</th>
      <th style="width:30%">Email</th>
      <th style="width:14%;text-align:center">Role</th>
      <th style="width:16%">Location</th>
      <th style="width:16%;text-align:right">Joined</th>
    </tr></thead>
    <tbody>${users.map(u => `<tr>
      <td class="pr"><strong>${u.display_name || u.full_name || 'Unknown'}</strong></td>
      <td class="pr td-muted">${u.email || '—'}</td>
      <td class="td-center">${badge(u.role)}</td>
      <td class="td-muted">${u.location || '—'}</td>
      <td class="td-right td-muted">${fmtDate(u.created_at)}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

/* ── PAGE-SPECIFIC RENDERS ── */
function renderOrdersPage() {
  const el  = document.getElementById('all-orders-table');
  const cnt = document.getElementById('all-orders-count');
  if (!el) return;
  if (cnt) cnt.textContent = `${allData.orders.length} total`;
  el.innerHTML = buildOrderTable(allData.orders);
}

function renderTransactionsPage() {
  const el  = document.getElementById('all-txns-table');
  const cnt = document.getElementById('all-txns-count');
  if (!el) return;
  if (cnt) cnt.textContent = `${allData.transactions.length} total`;
  el.innerHTML = buildTxnTable(allData.transactions);
}

function renderGigsPage() {
  const el  = document.getElementById('all-gigs-grid');
  const cnt = document.getElementById('all-gigs-count');
  if (!el) return;
  if (cnt) cnt.textContent = `${allData.gigs.length} total`;
  if (!allData.gigs.length) { el.innerHTML = '<span class="empty-text">No gigs yet.</span>'; return; }
  el.innerHTML = allData.gigs.map(g => `
    <div class="gig-card">
      <div class="gig-thumb">${g.thumb || '💼'}</div>
      <div class="gig-title">${g.title}</div>
      <div class="gig-seller">by ${g.seller_name || 'Unknown'}</div>
      <div class="gig-footer">
        <div class="gig-price">R ${(g.price || 0).toLocaleString('en-ZA')}</div>
        <div class="gig-rating">★ ${parseFloat(g.rating || 0).toFixed(1)} · ${g.review_count || 0} reviews</div>
      </div>
    </div>`).join('');
}

function renderUsersPage() {
  const el  = document.getElementById('all-users-table');
  const cnt = document.getElementById('all-users-count');
  if (!el) return;
  if (cnt) cnt.textContent = `${allData.users.length} total`;
  el.innerHTML = buildUserTable(allData.users);
}


/* ── SEARCH / FILTER ── */
function filterTable(type) {
  const queries = {
    orders:       document.getElementById('orders-search')?.value.toLowerCase() || '',
    transactions: document.getElementById('txns-search')?.value.toLowerCase() || '',
    gigs:         document.getElementById('gigs-search')?.value.toLowerCase() || '',
    users:        document.getElementById('users-search')?.value.toLowerCase() || ''
  };
  const q = queries[type];

  if (type === 'orders') {
    const filtered = allData.orders.filter(o =>
      (o.buyer_name || '').toLowerCase().includes(q) || (o.buyer_email || '').toLowerCase().includes(q)
    );
    document.getElementById('all-orders-table').innerHTML = buildOrderTable(filtered);
    document.getElementById('all-orders-count').textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
  }
  if (type === 'transactions') {
    const filtered = allData.transactions.filter(t =>
      (t.gig_title || '').toLowerCase().includes(q) || (t.buyer_name || '').toLowerCase().includes(q)
    );
    document.getElementById('all-txns-table').innerHTML = buildTxnTable(filtered);
    document.getElementById('all-txns-count').textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
  }
  if (type === 'gigs') {
    const filtered = allData.gigs.filter(g =>
      (g.title || '').toLowerCase().includes(q) ||
      (g.seller_name || '').toLowerCase().includes(q) ||
      (g.category || '').toLowerCase().includes(q)
    );
    const el = document.getElementById('all-gigs-grid');
    document.getElementById('all-gigs-count').textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
    if (!filtered.length) { el.innerHTML = '<span class="empty-text">No gigs match your search.</span>'; return; }
    el.innerHTML = filtered.map(g => `
      <div class="gig-card">
        <div class="gig-thumb">${g.thumb || '💼'}</div>
        <div class="gig-title">${g.title}</div>
        <div class="gig-seller">by ${g.seller_name || 'Unknown'}</div>
        <div class="gig-footer">
          <div class="gig-price">R ${(g.price || 0).toLocaleString('en-ZA')}</div>
          <div class="gig-rating">★ ${parseFloat(g.rating || 0).toFixed(1)} · ${g.review_count || 0} reviews</div>
        </div>
      </div>`).join('');
  }
  if (type === 'users') {
    const filtered = allData.users.filter(u =>
      (u.display_name || u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
    document.getElementById('all-users-table').innerHTML = buildUserTable(filtered);
    document.getElementById('all-users-count').textContent = `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`;
  }
}

/* ── MAIN LOADER ── */
async function loadAll() {
  const icon = document.getElementById('refresh-icon');
  const btn  = document.getElementById('refresh-btn');
  if (icon) icon.classList.add('spinning');
  if (btn)  btn.disabled = true;
  document.getElementById('last-updated').textContent = 'Refreshing…';

  try {
    const [users, gigs, orders, txns] = await Promise.all([
      sbQuery('profiles',     'select=id,role,display_name,full_name,email,location,created_at&order=created_at.desc'),
      sbQuery('gigs',         'select=id,title,category,rating,review_count,seller_name,thumb,price&order=rating.desc'),
      sbQuery('orders',       'select=id,buyer_name,buyer_email,status,amount,created_at&order=created_at.desc'),
      sbQuery('transactions', 'select=id,gig_title,amount,buyer_name,status,reference,created_at&order=created_at.desc'),
    ]);

    /* Store globally */
    allData.users        = users.data;
    allData.gigs         = gigs.data;
    allData.orders       = orders.data;
    allData.transactions = txns.data;

    /* KPIs */
    document.getElementById('kpi-users').textContent   = fmt(users.count);
    document.getElementById('kpi-gigs').textContent    = fmt(gigs.count);
    document.getElementById('kpi-orders').textContent  = fmt(orders.count);

    const revenue    = txns.data.filter(t => t.status === 'Completed').reduce((s, t) => s + (t.amount || 0), 0);
    const pendingCnt = orders.data.filter(o => o.status === 'Pending').length;
    document.getElementById('kpi-revenue').textContent = fmtMoney(revenue);
    document.getElementById('kpi-pending').textContent = fmt(pendingCnt);

    /* Overview charts */
    renderOrderChart(orders.data);
    renderTxnChart(txns.data);
    renderCatChart(gigs.data);

    /* Overview lists */
    renderRoles(users.data);
    renderTopGigs(gigs.data);
    renderOverviewOrders(orders.data);
    renderOverviewTxns(txns.data);
    renderOverviewUsers(users.data);

    /* Refresh current sub-page if not overview */
    if (currentPage !== 'overview') renderCurrentPage();

    const now = new Date();
    document.getElementById('last-updated').textContent =
      'Last updated: ' + now.toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

    showToast('Dashboard refreshed ✓');

  } catch (err) {
    console.error(err);
    document.getElementById('last-updated').textContent = '⚠ Failed to load — check console';
    showToast('Error loading data. Check your connection.');
  }

  if (icon) icon.classList.remove('spinning');
  if (btn)  btn.disabled = false;
}

function renderCurrentPage() {
  const map = {
    orders:       renderOrdersPage,
    transactions: renderTransactionsPage,
    gigs:         renderGigsPage,
    users:        renderUsersPage
  };
  if (map[currentPage]) map[currentPage]();
}

function loadCurrentPage() { loadAll(); }

/* ── PAGE ROUTING ── */
const pageTitles = {
  overview:     'Dashboard',
  orders:       'Orders',
  transactions: 'Transactions',
  gigs:         'Gigs',
  users:        'Users'
};

function goPage(name) {
  /* Hide all pages */
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  /* Show target */
  const target = document.getElementById(`page-${name}`);
  if (target) target.classList.add('active');

  /* Nav active state */
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === name);
  });

  /* Topbar title */
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = pageTitles[name] || name;

  currentPage = name;

  /* Close sidebar on mobile */
  document.getElementById('sidebar').classList.remove('open');

  /* Render page-specific content from cached data */
  renderCurrentPage();

  window.scrollTo(0, 0);
}

/* ── SIDEBAR TOGGLE (mobile) ── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

/* ── TOAST ── */
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}

/* ── INIT ── */
loadAll();
setInterval(loadAll, 60000); /* auto-refresh every 60s */
