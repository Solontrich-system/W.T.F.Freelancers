// ── Transactions module ───────────────────────────────────
import { db } from './db.js';

export async function renderTxns() {
  const loadEl  = document.getElementById('txns-loading');
  const listEl  = document.getElementById('txns-list');
  const statsEl = document.getElementById('txn-stats');
  loadEl.style.display = 'block';
  listEl.innerHTML = '';
  statsEl.innerHTML = '';

  const { data, error } = await db.from('transactions')
    .select('*').order('created_at', { ascending: false });
  loadEl.style.display = 'none';

  if (error) {
    console.error(error);
    listEl.innerHTML = '<p style="color:var(--muted);padding:20px">Could not load transactions.</p>';
    return;
  }

  const txns = data || [];
  const mf = document.getElementById('txn-filter').value;
  const sf = document.getElementById('txn-status-filter').value;
  const filtered = txns.filter(t =>
    (mf === 'all' || t.payment_method === mf) &&
    (sf === 'all' || t.payment_status === sf)
  );

  const completed = txns.filter(t => t.payment_status === 'completed');
  const pending   = txns.filter(t => t.payment_status === 'pending');
  const volume    = completed.reduce((s, t) => s + (t.amount || 0), 0);

  statsEl.innerHTML = `
    <div class="txn-stat-card"><div class="txn-stat-label">Total</div><div class="txn-stat-num">${txns.length}</div></div>
    <div class="txn-stat-card"><div class="txn-stat-label">Completed</div><div class="txn-stat-num" style="color:var(--green)">${completed.length}</div></div>
    <div class="txn-stat-card"><div class="txn-stat-label">Pending</div><div class="txn-stat-num" style="color:var(--amber)">${pending.length}</div></div>
    <div class="txn-stat-card"><div class="txn-stat-label">Volume</div><div class="txn-stat-num" style="color:var(--amber)">$${volume}</div></div>`;

  if (!filtered.length) {
    listEl.innerHTML = '<p style="color:var(--muted);padding:20px 0;font-size:14px">No transactions match this filter.</p>';
    return;
  }

  const icons = { card: '💳', paypal: '🅿️', crypto: '₿' };
  listEl.innerHTML = filtered.map(t => {
    const date = new Date(t.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
    const time = new Date(t.created_at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
    let detail = '';
    if (t.payment_method === 'card')   detail = t.card_brand && t.card_last4 ? `${t.card_brand} ····${t.card_last4}` : 'Card payment';
    if (t.payment_method === 'paypal') detail = t.paypal_email ? `PayPal · ${t.paypal_email}` : 'PayPal';
    if (t.payment_method === 'crypto') detail = t.crypto_currency ? `${t.crypto_currency}${t.crypto_txhash ? ` · ${t.crypto_txhash.slice(0,14)}…` : ''}` : 'Crypto';
    return `<div class="txn-row">
      <div class="txn-icon">${icons[t.payment_method] || '💰'}</div>
      <div class="txn-info">
        <div class="txn-title">${t.gig_title || 'Gig order'}</div>
        <div class="txn-meta">${detail} · ${date} ${time}</div>
        ${t.buyer_email ? `<div class="txn-meta">👤 ${t.buyer_email}</div>` : ''}
      </div>
      <div class="txn-amount">$${t.amount}</div>
      <div class="txn-status status-${t.payment_status}">${t.payment_status}</div>
    </div>`;
  }).join('');
}

window.renderTxns = renderTxns;
