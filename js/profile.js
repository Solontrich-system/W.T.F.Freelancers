// ── Profile module ────────────────────────────────────────
import { db } from './db.js';
import { state } from './state.js';
import { updateNavForUser } from './auth.js';
import { showToast, emptyHTML, gigCardHTML } from './utils.js';

export async function renderProfile() {
  if (!state.currentUser) return;
  const p = state.currentProfile;

  document.getElementById('profile-avatar-big').textContent = p?.avatar_init || '?';
  document.getElementById('profile-fullname').textContent   = p?.full_name    || state.currentUser.email;
  document.getElementById('profile-bio').textContent        = p?.bio           || 'No bio yet.';

  const roleMap = { freelancer: 'Freelancer', buyer: 'Client / Buyer', both: 'Freelancer & Buyer' };
  document.getElementById('profile-role-label').textContent = roleMap[p?.role] || '—';

  const tags = [];
  if (p?.location) tags.push(`<span class="tag">🌍 ${p.location}</span>`);
  if (p?.role === 'freelancer' || p?.role === 'both') tags.push('<span class="tag">🛠 Freelancer</span>');
  document.getElementById('profile-tags').innerHTML = tags.join('');

  const loadEl = document.getElementById('profile-loading');
  const gridEl = document.getElementById('profile-gigs');
  loadEl.style.display = 'block';
  gridEl.innerHTML = '';

  const { data: myGigs } = await db.from('gigs')
    .select('*').eq('user_id', state.currentUser.id).order('created_at', { ascending: false });

  loadEl.style.display = 'none';
  document.getElementById('profile-gig-count').textContent = myGigs?.length ?? 0;

  gridEl.innerHTML = myGigs?.length
    ? myGigs.map(gigCardHTML).join('')
    : emptyHTML('📭','No gigs posted yet','Post your first gig to start selling.','+ Post a gig',"goPage('post')");

  const [{ count: orderCount }, { data: txnData }] = await Promise.all([
    db.from('orders').select('*', { count: 'exact', head: true }).eq('buyer_user_id', state.currentUser.id),
    db.from('transactions').select('payment_status,payment_method').eq('buyer_user_id', state.currentUser.id),
  ]);

  const txns = txnData || [];
  document.getElementById('profile-order-count').textContent   = orderCount ?? 0;
  document.getElementById('profile-txn-count').textContent     = txns.length;
  document.getElementById('profile-pending-count').textContent = txns.filter(t => t.payment_status === 'pending').length;
  document.getElementById('earn-completed').textContent = txns.filter(t => t.payment_status === 'completed').length;
  document.getElementById('earn-pending').textContent   = txns.filter(t => t.payment_status === 'pending').length;
  document.getElementById('earn-card').textContent      = txns.filter(t => t.payment_method === 'card').length;
  document.getElementById('earn-crypto').textContent    = txns.filter(t => t.payment_method === 'crypto').length;
}

export function loadEditProfile() {
  if (!state.currentProfile) return;
  document.getElementById('ep-fullname').value = state.currentProfile.full_name    || '';
  document.getElementById('ep-display').value  = state.currentProfile.display_name || '';
  document.getElementById('ep-bio').value      = state.currentProfile.bio           || '';
  document.getElementById('ep-location').value = state.currentProfile.location      || '';
  document.getElementById('ep-role').value     = state.currentProfile.role          || 'buyer';
}

window.saveProfile = async function() {
  const btn = document.getElementById('ep-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const full    = document.getElementById('ep-fullname').value.trim();
  const display = document.getElementById('ep-display').value.trim();
  const bio     = document.getElementById('ep-bio').value.trim();
  const loc     = document.getElementById('ep-location').value.trim();
  const role    = document.getElementById('ep-role').value;
  const parts   = full.split(' ');
  const init    = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '??';

  const { data, error } = await db.from('profiles').update({
    full_name: full, display_name: display, bio,
    location: loc, role, avatar_init: init,
    updated_at: new Date().toISOString(),
  }).eq('id', state.currentUser.id).select().single();

  btn.disabled = false;
  btn.textContent = 'Save Changes';
  if (error) { console.error(error); showToast('Could not save profile.'); return; }

  Object.assign(state.currentProfile, data);
  updateNavForUser();
  showToast('✅ Profile updated!');
  window.goPage('profile');
};
