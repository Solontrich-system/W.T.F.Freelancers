// ── Gigs module ───────────────────────────────────────────
import { db } from './db.js';
import { currentUser, currentProfile } from './auth.js';
import { showToast, emptyHTML, gigCardHTML } from './utils.js';

const CATEGORIES = ['All','Design','Development','Writing','Marketing','Video','Music & Audio','Business','AI Services'];
const EMOJIS     = ['🎨','💻','✍️','📣','🎬','🎵','📊','🤖','📱','🖥️','📸','🎯','⚡','🔧','🌐','💡'];

let activeFilter  = 'All';
let selectedEmoji = '🎨';

// Shared gig fetch
async function fetchGigs() {
  const { data, error } = await db.from('gigs').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); showToast('Could not load gigs.'); return []; }
  return data || [];
}

// ── HOME ──────────────────────────────────────────────────
export async function renderHome() {
  const loadEl = document.getElementById('home-loading');
  const gridEl = document.getElementById('home-gigs');
  loadEl.style.display = 'block'; gridEl.innerHTML = '';

  const [gigs, { count: orders }, { count: txns }] = await Promise.all([
    fetchGigs(),
    db.from('orders').select('*', { count: 'exact', head: true }),
    db.from('transactions').select('*', { count: 'exact', head: true })
  ]);

  loadEl.style.display = 'none';
  document.getElementById('stat-gigs').textContent   = gigs.length;
  document.getElementById('stat-orders').textContent = orders ?? 0;
  document.getElementById('stat-txns').textContent   = txns ?? 0;

  gridEl.innerHTML = gigs.length
    ? gigs.slice(0, 4).map(gigCardHTML).join('')
    : emptyHTML('🎯','No gigs yet','Be the first to post a service.','+ Post a gig',"goPage('post')");
}

// ── BROWSE ────────────────────────────────────────────────
export async function renderBrowse() {
  const loadEl = document.getElementById('browse-loading');
  const gridEl = document.getElementById('browse-gigs');

  document.getElementById('filter-chips').innerHTML = CATEGORIES.map(c =>
    `<button class="filter-chip ${activeFilter===c?'on':''}" onclick="setFilter('${c}')">${c}</button>`
  ).join('');

  loadEl.style.display = 'block'; gridEl.innerHTML = '';
  const gigs = await fetchGigs();
  loadEl.style.display = 'none';

  const q = (document.getElementById('search-input').value || '').toLowerCase().trim();
  const filtered = gigs.filter(g => {
    const mc = activeFilter === 'All' || g.category === activeFilter;
    const mq = !q || g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || g.seller_name.toLowerCase().includes(q);
    return mc && mq;
  });

  if (!gigs.length)     return void (gridEl.innerHTML = emptyHTML('🛸','The marketplace is empty','No gigs posted yet.','+ Post a gig',"goPage('post')"));
  if (!filtered.length) return void (gridEl.innerHTML = emptyHTML('🔍','No results','Try a different search or category.',null,null));
  gridEl.innerHTML = filtered.map(gigCardHTML).join('');
}

window.renderBrowse = renderBrowse;
window.setFilter    = c => { activeFilter = c; renderBrowse(); };
window.filterBrowse = c => { activeFilter = c; window.goPage('browse'); };

// ── EMOJI PICKER ──────────────────────────────────────────
export function buildEmojiPicker() {
  document.getElementById('emoji-picker').innerHTML = EMOJIS.map(e =>
    `<button class="filter-chip emoji-opt ${selectedEmoji===e?'on':''}" onclick="selectEmoji('${e}',this)">${e}</button>`
  ).join('');
}

window.selectEmoji = function(e, btn) {
  selectedEmoji = e;
  document.querySelectorAll('.emoji-opt').forEach(el => el.classList.remove('on'));
  btn.classList.add('on');
};

// ── POST GIG ──────────────────────────────────────────────
window.submitGig = async function() {
  if (!currentUser) return showToast('Please log in to post a gig.');
  const title       = document.getElementById('gig-title').value.trim();
  const category    = document.getElementById('gig-cat').value;
  const description = document.getElementById('gig-desc').value.trim();
  const price       = parseInt(document.getElementById('gig-price').value, 10);
  const delivery    = document.getElementById('gig-delivery').value;

  if (!title || !category || !description || !price || price < 5)
    return showToast('Please fill in all fields (min price $5).');

  const btn = document.getElementById('submit-btn');
  btn.disabled = true; btn.textContent = 'Publishing…';

  const display  = currentProfile?.display_name || currentProfile?.full_name || currentUser.email.split('@')[0];
  const initials = display.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const { error } = await db.from('gigs').insert({
    title, category, description, price, delivery,
    thumb: selectedEmoji, seller_name: display, seller_init: initials,
    user_id: currentUser.id, rating: 0, review_count: 0
  });

  btn.disabled = false; btn.textContent = 'Publish Gig →';
  if (error) return showToast('Could not publish. Try again.');

  ['gig-title','gig-desc','gig-price'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('gig-cat').value = '';
  document.getElementById('gig-delivery').value = '1 day';
  selectedEmoji = '🎨';
  showToast('🎉 Gig published! It\'s live on the marketplace.');
  setTimeout(() => window.goPage('browse'), 1600);
};

// ── GIG DETAIL ────────────────────────────────────────────
export let currentGig        = null;
export let sellerPayDetails  = null;

window.openGig = async function(id) {
  const { data: g, error } = await db.from('gigs').select('*').eq('id', id).single();
  if (error || !g) return showToast('Could not load gig.');
  currentGig = g;

  document.getElementById('detail-thumb').textContent    = g.thumb;
  document.getElementById('detail-title').textContent    = g.title;
  document.getElementById('detail-seller').textContent   = '👤 ' + g.seller_name;
  document.getElementById('detail-desc').textContent     = g.description;
  document.getElementById('detail-price').textContent    = '$' + g.price;
  document.getElementById('detail-delivery').textContent = '⏱ Delivered in ' + g.delivery;
  document.getElementById('detail-rating').textContent   = g.rating > 0
    ? `★ ${g.rating} (${g.review_count} reviews)` : '★ New listing';

  const { count } = await db.from('orders').select('*', { count: 'exact', head: true }).eq('gig_id', id);
  document.getElementById('detail-orders-count').textContent = `📦 ${count ?? 0} orders`;

  const query = g.user_id
    ? db.from('seller_payment_details').select('*').eq('user_id', g.user_id).maybeSingle()
    : db.from('seller_payment_details').select('*').eq('seller_name', g.seller_name).maybeSingle();
  const { data: pd } = await query;
  sellerPayDetails = pd;

  const spmEl = document.getElementById('seller-pay-methods');
  if (!pd) {
    spmEl.innerHTML = '<span style="color:var(--muted);font-size:13px">Seller hasn\'t added payment methods yet.</span>';
  } else {
    const b = [];
    if (pd.bank_name)    b.push(`<div class="spm-badge">🏦 Bank (${pd.bank_name})</div>`);
    if (pd.paypal_email) b.push('<div class="spm-badge">🅿️ PayPal</div>');
    if (pd.btc_address)  b.push('<div class="spm-badge">₿ Bitcoin</div>');
    if (pd.eth_address)  b.push('<div class="spm-badge">⟠ Ethereum</div>');
    if (pd.usdt_address) b.push('<div class="spm-badge">₮ USDT</div>');
    spmEl.innerHTML = b.length ? b.join('') : '<span style="color:var(--muted);font-size:13px">No payment methods saved.</span>';
  }

  window.goPage('gig');
};
