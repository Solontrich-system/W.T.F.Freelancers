// ── Supabase ─────────────────────────────────────────────
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const db = createClient(
  'https://bzqetkzxksmwkibbelnc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ6cWV0a3p4a3Ntd2tpYmJlbG5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NTUyODcsImV4cCI6MjA5MzQzMTI4N30.Adu_SIxxDuYsZcWgcyxpADGu7k5E9pZOVBgVKGTnmug'
);

// ── Constants ─────────────────────────────────────────────
const CATEGORIES = ['All','Design','Development','Writing','Marketing','Video','Music & Audio','Business','AI Services'];
const EMOJIS     = ['🎨','💻','✍️','📣','🎬','🎵','📊','🤖','📱','🖥️','📸','🎯','⚡','🔧','🌐','💡'];

// ── App State ─────────────────────────────────────────────
let currentUser    = null;
let currentProfile = null;
let activeFilter   = 'All';
let selectedEmoji  = '🎨';
let currentGig     = null;
let currentPayMethod  = 'card';
let currentCrypto     = 'btc';
let sellerPayDetails  = null;

// ── Auth State Listener ───────────────────────────────────
db.auth.onAuthStateChange(async (event, session) => {
  currentUser = session?.user ?? null;
  if (currentUser) {
    // Load profile
    const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    currentProfile = data;
    updateNavForUser();
  } else {
    currentProfile = null;
    updateNavForGuest();
  }
});

function updateNavForUser() {
  const p = currentProfile;
  const initials = p?.avatar_init || (currentUser?.email?.[0]?.toUpperCase() ?? '?');
  document.getElementById('nav-auth-guest').style.display = 'none';
  document.getElementById('nav-auth-user').style.display  = 'flex';
  document.getElementById('nav-avatar').textContent       = initials;
  document.getElementById('nav-profile').style.display    = '';
  document.getElementById('nav-txns').style.display       = '';
  document.getElementById('nav-post').style.display       = '';
}

function updateNavForGuest() {
  document.getElementById('nav-auth-guest').style.display = 'flex';
  document.getElementById('nav-auth-user').style.display  = 'none';
  document.getElementById('nav-profile').style.display    = 'none';
  document.getElementById('nav-txns').style.display       = 'none';
  document.getElementById('nav-post').style.display       = 'none';
}

function requireAuth(redirectPage) {
  if (!currentUser) {
    showToast('Please log in to continue.');
    goPage('login');
    return false;
  }
  return true;
}

// ── AUTH: Register ────────────────────────────────────────
window.doRegister = async function() {
  const name     = document.getElementById('reg-name').value.trim();
  const display  = document.getElementById('reg-display').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const role     = document.getElementById('reg-role').value;
  const location = document.getElementById('reg-location').value.trim();
  const errEl    = document.getElementById('reg-error');

  errEl.textContent = '';
  if (!name || !email || !password) return void (errEl.textContent = 'Please fill in all required fields.');
  if (password.length < 8)          return void (errEl.textContent = 'Password must be at least 8 characters.');

  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.textContent = 'Creating account…';

  // Build initials
  const parts    = name.trim().split(' ');
  const initials = (parts[0]?.[0] || '') + (parts[1]?.[0] || '');

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name:    name,
        display_name: display || name.split(' ')[0],
        role,
        location,
        avatar_init:  initials.toUpperCase()
      }
    }
  });

  btn.disabled = false; btn.textContent = 'Create account';

  if (error) return void (errEl.textContent = error.message);

  // Update profile with extra fields (trigger creates base profile)
  if (data.user) {
    await db.from('profiles').upsert({
      id:           data.user.id,
      full_name:    name,
      display_name: display || name.split(' ')[0],
      email,
      role,
      location,
      bio:          '',
      avatar_init:  initials.toUpperCase()
    });
  }

  showToast('🎉 Account created! Welcome to W.T.F. Freelancers.');
  ['reg-name','reg-display','reg-email','reg-password','reg-location'].forEach(id => document.getElementById(id).value = '');
  goPage('home');
};

// ── AUTH: Login ───────────────────────────────────────────
window.doLogin = async function() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');

  errEl.textContent = '';
  if (!email || !password) return void (errEl.textContent = 'Enter your email and password.');

  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.textContent = 'Logging in…';

  const { error } = await db.auth.signInWithPassword({ email, password });

  btn.disabled = false; btn.textContent = 'Log in';

  if (error) return void (errEl.textContent = error.message);

  document.getElementById('login-email').value    = '';
  document.getElementById('login-password').value = '';
  showToast('👋 Welcome back!');
  goPage('home');
};

// ── AUTH: Logout ──────────────────────────────────────────
window.logout = async function() {
  await db.auth.signOut();
  currentUser = null; currentProfile = null;
  showToast('You have been logged out.');
  goPage('home');
};

// ── Navigation ─────────────────────────────────────────────
window.goPage = function(name) {
  // Guard protected pages
  if (['profile','post','payout','txns','edit-profile'].includes(name) && !requireAuth(name)) return;

  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn:not(.cta)').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  const nb = document.getElementById('nav-' + name);
  if (nb) nb.classList.add('active');
  document.getElementById('nav-links').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (name === 'home')         renderHome();
  if (name === 'browse')       renderBrowse();
  if (name === 'profile')      renderProfile();
  if (name === 'edit-profile') loadEditProfile();
  if (name === 'post')         buildEmojiPicker();
  if (name === 'payout')       loadPayoutForm();
  if (name === 'txns')         renderTxns();
};

document.getElementById('nav-toggle').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('open');
});

window.heroSell = function() {
  currentUser ? goPage('post') : goPage('register');
};

// ── Helpers ───────────────────────────────────────────────
function avatarColor(init = 'AN') {
  const hue = [...init].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue},60%,65%)`;
}

async function fetchGigs() {
  const { data, error } = await db.from('gigs').select('*').order('created_at', { ascending: false });
  if (error) { console.error(error); showToast('Could not load gigs.'); return []; }
  return data || [];
}

function emptyHTML(icon, heading, sub, btnLabel, btnAction) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <div class="empty-heading">${heading}</div>
    <div class="empty-sub">${sub}</div>
    ${btnLabel ? `<button class="btn-primary" style="margin-top:18px" onclick="${btnAction}">${btnLabel}</button>` : ''}
  </div>`;
}

function gigCardHTML(g) {
  const color = avatarColor(g.seller_init);
  const stars  = g.rating > 0
    ? `<span class="star">★</span> ${g.rating} (${g.review_count})`
    : '<span style="color:var(--amber)">New ✦</span>';
  return `<div class="gig-card" onclick="openGig('${g.id}')" role="button" tabindex="0">
    <div class="gig-thumb">${g.thumb}<span class="gig-badge">${g.category}</span></div>
    <div class="gig-body">
      <div class="seller-row">
        <div class="avatar" style="color:${color};border-color:${color}55">${g.seller_init}</div>
        <span class="seller-name">${g.seller_name}</span>
      </div>
      <div class="gig-title">${g.title}</div>
      <div class="gig-footer">
        <div class="gig-rating">${stars}</div>
        <div class="gig-price">$${g.price}</div>
      </div>
    </div>
  </div>`;
}

// ── HOME ──────────────────────────────────────────────────
async function renderHome() {
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
window.renderBrowse = async function() {
  const loadEl = document.getElementById('browse-loading');
  const gridEl = document.getElementById('browse-gigs');

  document.getElementById('filter-chips').innerHTML = CATEGORIES.map(c =>
    `<button class="filter-chip ${activeFilter===c?'on':''}" onclick="setFilter('${c}')">${c}</button>`
  ).join('');

  loadEl.style.display = 'block'; gridEl.innerHTML = '';
  const gigs = await fetchGigs();
  loadEl.style.display = 'none';

  const q = (document.getElementById('search-input').value||'').toLowerCase().trim();
  const filtered = gigs.filter(g => {
    const mc = activeFilter==='All' || g.category===activeFilter;
    const mq = !q || g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q) || g.seller_name.toLowerCase().includes(q);
    return mc && mq;
  });

  if (!gigs.length)     return void (gridEl.innerHTML = emptyHTML('🛸','The marketplace is empty','No gigs posted yet.','+ Post a gig',"goPage('post')"));
  if (!filtered.length) return void (gridEl.innerHTML = emptyHTML('🔍','No results','Try a different search or category.',null,null));
  gridEl.innerHTML = filtered.map(gigCardHTML).join('');
};

window.setFilter    = c => { activeFilter = c; renderBrowse(); };
window.filterBrowse = c => { activeFilter = c; goPage('browse'); };

// ── PROFILE ───────────────────────────────────────────────
async function renderProfile() {
  if (!currentUser) return;
  const p = currentProfile;

  // Avatar & name
  document.getElementById('profile-avatar-big').textContent = p?.avatar_init || '?';
  document.getElementById('profile-fullname').textContent   = p?.full_name    || currentUser.email;
  document.getElementById('profile-bio').textContent        = p?.bio || 'No bio yet.';

  const roleMap = { freelancer:'Freelancer', buyer:'Client / Buyer', both:'Freelancer & Buyer' };
  document.getElementById('profile-role-label').textContent = roleMap[p?.role] || '—';

  const tags = [];
  if (p?.location) tags.push(`<span class="tag">🌍 ${p.location}</span>`);
  if (p?.role === 'freelancer' || p?.role === 'both') tags.push('<span class="tag">🛠 Freelancer</span>');
  document.getElementById('profile-tags').innerHTML = tags.join('');

  // Gigs belonging to this user
  const loadEl = document.getElementById('profile-loading');
  const gridEl = document.getElementById('profile-gigs');
  loadEl.style.display = 'block'; gridEl.innerHTML = '';

  const { data: myGigs } = await db.from('gigs').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
  loadEl.style.display = 'none';
  document.getElementById('profile-gig-count').textContent = myGigs?.length ?? 0;

  gridEl.innerHTML = myGigs?.length
    ? myGigs.map(gigCardHTML).join('')
    : emptyHTML('📭','No gigs posted yet','Post your first gig to start selling.','+ Post a gig',"goPage('post')");

  // Orders & transactions for this user
  const [{ count: orderCount }, { data: txnData }] = await Promise.all([
    db.from('orders').select('*', { count:'exact', head:true }).eq('buyer_user_id', currentUser.id),
    db.from('transactions').select('payment_status,payment_method').eq('buyer_user_id', currentUser.id)
  ]);

  const txns = txnData || [];
  document.getElementById('profile-order-count').textContent  = orderCount ?? 0;
  document.getElementById('profile-txn-count').textContent    = txns.length;
  document.getElementById('profile-pending-count').textContent = txns.filter(t => t.payment_status==='pending').length;
  document.getElementById('earn-completed').textContent = txns.filter(t => t.payment_status==='completed').length;
  document.getElementById('earn-pending').textContent   = txns.filter(t => t.payment_status==='pending').length;
  document.getElementById('earn-card').textContent      = txns.filter(t => t.payment_method==='card').length;
  document.getElementById('earn-crypto').textContent    = txns.filter(t => t.payment_method==='crypto').length;
}

// ── EDIT PROFILE ──────────────────────────────────────────
function loadEditProfile() {
  if (!currentProfile) return;
  document.getElementById('ep-fullname').value  = currentProfile.full_name    || '';
  document.getElementById('ep-display').value   = currentProfile.display_name || '';
  document.getElementById('ep-bio').value       = currentProfile.bio           || '';
  document.getElementById('ep-location').value  = currentProfile.location      || '';
  document.getElementById('ep-role').value      = currentProfile.role          || 'buyer';
}

window.saveProfile = async function() {
  const btn = document.getElementById('ep-save-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  const full    = document.getElementById('ep-fullname').value.trim();
  const display = document.getElementById('ep-display').value.trim();
  const bio     = document.getElementById('ep-bio').value.trim();
  const loc     = document.getElementById('ep-location').value.trim();
  const role    = document.getElementById('ep-role').value;
  const parts   = full.split(' ');
  const init    = ((parts[0]?.[0]||'') + (parts[1]?.[0]||'')).toUpperCase() || '??';

  const { data, error } = await db.from('profiles').update({
    full_name: full, display_name: display, bio, location: loc, role,
    avatar_init: init, updated_at: new Date().toISOString()
  }).eq('id', currentUser.id).select().single();

  btn.disabled = false; btn.textContent = 'Save Changes';
  if (error) { showToast('Could not save profile.'); return; }
  currentProfile = data;
  updateNavForUser();
  showToast('✅ Profile updated!');
  goPage('profile');
};

// ── GIG DETAIL ────────────────────────────────────────────
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

  const { count } = await db.from('orders').select('*', { count:'exact', head:true }).eq('gig_id', id);
  document.getElementById('detail-orders-count').textContent = `📦 ${count ?? 0} orders`;

  // Load seller payout methods by user_id or seller_name fallback
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

  goPage('gig');
};

// ── CHECKOUT ──────────────────────────────────────────────
window.openCheckout = function() {
  if (!requireAuth('checkout')) return;
  if (!currentGig) return;

  document.getElementById('checkout-summary').innerHTML = `
    <div class="cs-thumb">${currentGig.thumb}</div>
    <div class="cs-info">
      <div class="cs-title">${currentGig.title}</div>
      <div class="cs-meta">by ${currentGig.seller_name} · ${currentGig.delivery}</div>
    </div>
    <div class="cs-price">$${currentGig.price}</div>`;

  const pp = sellerPayDetails?.paypal_email;
  document.getElementById('paypal-seller-email').textContent = pp || 'Seller has not added PayPal.';

  // Pre-fill buyer email from profile
  if (currentProfile?.email || currentUser?.email) {
    const e = currentProfile?.email || currentUser?.email;
    document.getElementById('card-email').value   = e;
    document.getElementById('pp-buyer-email').value = e;
    document.getElementById('crypto-email').value = e;
  }
  if (currentProfile?.full_name) {
    document.getElementById('card-name').value = currentProfile.full_name;
  }

  selectCrypto('btc');
  selectPayMethod('card');
  goPage('checkout');
};

window.selectPayMethod = function(method) {
  currentPayMethod = method;
  ['card','paypal','crypto'].forEach(m => {
    document.getElementById('pay-'+m).style.display     = m===method?'block':'none';
    document.getElementById('pm-'+m).classList.toggle('active', m===method);
  });
};

window.selectCrypto = function(coin) {
  currentCrypto = coin;
  ['btc','eth','usdt'].forEach(c => document.getElementById('co-'+c).classList.toggle('active', c===coin));
  const pd  = sellerPayDetails;
  const map = {
    btc:  { addr: pd?.btc_address,  label:'₿ Bitcoin (BTC)',  net:'' },
    eth:  { addr: pd?.eth_address,  label:'⟠ Ethereum (ETH)', net:'' },
    usdt: { addr: pd?.usdt_address, label:'₮ USDT',           net: pd?.crypto_network||'' }
  };
  const info = map[coin];
  document.getElementById('cac-label').textContent   = `Send exact amount in ${info.label} to:`;
  document.getElementById('cac-address').textContent = info.addr || 'Seller has not added this wallet.';
  document.getElementById('cac-network').textContent = info.net ? `Network: ${info.net}` : '';
};

window.copyAddress = function() {
  const addr = document.getElementById('cac-address').textContent;
  navigator.clipboard.writeText(addr).then(() => showToast('Address copied!'));
};

window.submitPayment = async function() {
  if (!currentGig || !currentUser) return;
  const btn = document.getElementById('checkout-btn');
  btn.disabled = true; btn.textContent = 'Processing…';

  let txnData = {
    gig_id: currentGig.id, gig_title: currentGig.title,
    amount: currentGig.price, currency: 'USD',
    payment_method: currentPayMethod, payment_status: 'pending',
    buyer_user_id: currentUser.id
  };
  let orderData = {
    gig_id: currentGig.id, payment_method: currentPayMethod,
    amount: currentGig.price, status: 'Pending', buyer_user_id: currentUser.id
  };

  if (currentPayMethod === 'card') {
    const name = document.getElementById('card-name').value.trim();
    const email = document.getElementById('card-email').value.trim();
    const num   = document.getElementById('card-number').value.replace(/\s/g,'');
    const expiry = document.getElementById('card-expiry').value.trim();
    const cvv    = document.getElementById('card-cvv').value.trim();
    if (!name||!email||num.length<13||!expiry||!cvv) {
      showToast('Please fill in all card details.'); btn.disabled=false; btn.textContent='Confirm & Pay'; return;
    }
    txnData = { ...txnData, buyer_name:name, buyer_email:email, card_last4:num.slice(-4), card_brand:detectCardBrand(num) };
    orderData = { ...orderData, buyer_name:name, buyer_email:email };
  }

  if (currentPayMethod === 'paypal') {
    const email = document.getElementById('pp-buyer-email').value.trim();
    const ref   = document.getElementById('pp-ref').value.trim();
    if (!email||!ref) {
      showToast('Enter your PayPal email and transaction reference.'); btn.disabled=false; btn.textContent='Confirm & Pay'; return;
    }
    txnData   = { ...txnData, paypal_email:email, paypal_ref:ref };
    orderData = { ...orderData, buyer_name:email, buyer_email:email };
  }

  if (currentPayMethod === 'crypto') {
    const email  = document.getElementById('crypto-email').value.trim();
    const txhash = document.getElementById('crypto-txhash').value.trim();
    if (!email||!txhash) {
      showToast('Enter your email and transaction hash.'); btn.disabled=false; btn.textContent='Confirm & Pay'; return;
    }
    const names = { btc:'Bitcoin (BTC)', eth:'Ethereum (ETH)', usdt:'USDT' };
    txnData = { ...txnData, buyer_email:email,
      crypto_currency: names[currentCrypto],
      crypto_address:  sellerPayDetails?.[currentCrypto+'_address']||'',
      crypto_txhash:   txhash,
      crypto_network:  currentCrypto==='usdt' ? (sellerPayDetails?.crypto_network||'') : ''
    };
    orderData = { ...orderData, buyer_name:email, buyer_email:email };
  }

  const { data: order, error: oErr } = await db.from('orders').insert(orderData).select().single();
  if (oErr) { showToast('Could not place order.'); btn.disabled=false; btn.textContent='Confirm & Pay'; return; }

  txnData.order_id = order.id;
  await db.from('transactions').insert(txnData);

  btn.disabled=false; btn.textContent='Confirm & Pay';
  showToast('🎉 Payment submitted! Order is now pending.');
  setTimeout(() => goPage('txns'), 1800);
};

function detectCardBrand(num) {
  if (/^4/.test(num))      return 'Visa';
  if (/^5[1-5]/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num))  return 'Amex';
  return 'Card';
}

window.fmtCard   = el => { let v=el.value.replace(/\D/g,'').slice(0,16); el.value=v.match(/.{1,4}/g)?.join(' ')||v; };
window.fmtExpiry = el => { let v=el.value.replace(/\D/g,'').slice(0,4); if(v.length>=3) v=v.slice(0,2)+' / '+v.slice(2); el.value=v; };

// ── PAYOUT DETAILS ────────────────────────────────────────
window.switchPayoutTab = function(tab) {
  ['bank','paypal','crypto'].forEach(t => {
    document.getElementById('payout-'+t).style.display = t===tab?'block':'none';
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
};

async function loadPayoutForm() {
  if (!currentUser) return;
  const { data } = await db.from('seller_payment_details')
    .select('*').eq('user_id', currentUser.id).maybeSingle();
  if (!data) return;
  document.getElementById('po-bank-name').value      = data.bank_name      || '';
  document.getElementById('po-account-name').value   = data.account_name   || '';
  document.getElementById('po-account-number').value = data.account_number || '';
  document.getElementById('po-branch').value         = data.branch_code    || '';
  document.getElementById('po-swift').value          = data.swift_code     || '';
  document.getElementById('po-paypal-email').value   = data.paypal_email   || '';
  document.getElementById('po-btc').value            = data.btc_address    || '';
  document.getElementById('po-eth').value            = data.eth_address    || '';
  document.getElementById('po-usdt').value           = data.usdt_address   || '';
  document.getElementById('po-crypto-network').value = data.crypto_network || '';
}

window.savePayoutDetails = async function() {
  if (!currentUser) return;
  const btn = document.getElementById('payout-save-btn');
  btn.disabled=true; btn.textContent='Saving…';

  const sellerName = currentProfile?.display_name || currentProfile?.full_name || currentUser.email;

  const payload = {
    user_id:        currentUser.id,
    seller_name:    sellerName,
    bank_name:      document.getElementById('po-bank-name').value.trim()||null,
    account_name:   document.getElementById('po-account-name').value.trim()||null,
    account_number: document.getElementById('po-account-number').value.trim()||null,
    branch_code:    document.getElementById('po-branch').value.trim()||null,
    swift_code:     document.getElementById('po-swift').value.trim()||null,
    paypal_email:   document.getElementById('po-paypal-email').value.trim()||null,
    btc_address:    document.getElementById('po-btc').value.trim()||null,
    eth_address:    document.getElementById('po-eth').value.trim()||null,
    usdt_address:   document.getElementById('po-usdt').value.trim()||null,
    crypto_network: document.getElementById('po-crypto-network').value||null,
    updated_at:     new Date().toISOString()
  };

  const { data: existing } = await db.from('seller_payment_details')
    .select('id').eq('user_id', currentUser.id).maybeSingle();

  const { error } = existing
    ? await db.from('seller_payment_details').update(payload).eq('id', existing.id)
    : await db.from('seller_payment_details').insert(payload);

  btn.disabled=false; btn.textContent='Save Payout Details';
  if (error) { showToast('Could not save. Try again.'); return; }
  showToast('✅ Payout details saved!');
  setTimeout(() => goPage('profile'), 1400);
};

// ── TRANSACTIONS ──────────────────────────────────────────
window.renderTxns = async function() {
  const loadEl  = document.getElementById('txns-loading');
  const listEl  = document.getElementById('txns-list');
  const statsEl = document.getElementById('txn-stats');
  loadEl.style.display='block'; listEl.innerHTML=''; statsEl.innerHTML='';

  // Show all transactions (admin view) — filter by current user if desired
  const { data, error } = await db.from('transactions').select('*').order('created_at', { ascending:false });
  loadEl.style.display='none';
  if (error) return void (listEl.innerHTML='<p style="color:var(--muted);padding:20px">Could not load transactions.</p>');

  const txns = data || [];
  const mf = document.getElementById('txn-filter').value;
  const sf = document.getElementById('txn-status-filter').value;
  const filtered = txns.filter(t =>
    (mf==='all'||t.payment_method===mf) && (sf==='all'||t.payment_status===sf)
  );

  const completed = txns.filter(t=>t.payment_status==='completed');
  const pending   = txns.filter(t=>t.payment_status==='pending');
  const volume    = completed.reduce((s,t)=>s+(t.amount||0),0);

  statsEl.innerHTML = `
    <div class="txn-stat-card"><div class="txn-stat-label">Total</div><div class="txn-stat-num">${txns.length}</div></div>
    <div class="txn-stat-card"><div class="txn-stat-label">Completed</div><div class="txn-stat-num" style="color:var(--green)">${completed.length}</div></div>
    <div class="txn-stat-card"><div class="txn-stat-label">Pending</div><div class="txn-stat-num" style="color:var(--amber)">${pending.length}</div></div>
    <div class="txn-stat-card"><div class="txn-stat-label">Volume</div><div class="txn-stat-num" style="color:var(--amber)">$${volume}</div></div>`;

  if (!filtered.length) {
    listEl.innerHTML='<p style="color:var(--muted);padding:20px 0;font-size:14px">No transactions match this filter.</p>'; return;
  }

  const icons = { card:'💳', paypal:'🅿️', crypto:'₿' };
  listEl.innerHTML = filtered.map(t => {
    const date = new Date(t.created_at).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'});
    const time = new Date(t.created_at).toLocaleTimeString('en-ZA',{hour:'2-digit',minute:'2-digit'});
    let detail = '';
    if (t.payment_method==='card')   detail = t.card_brand&&t.card_last4 ? `${t.card_brand} ····${t.card_last4}` : 'Card payment';
    if (t.payment_method==='paypal') detail = t.paypal_email ? `PayPal · ${t.paypal_email}` : 'PayPal';
    if (t.payment_method==='crypto') detail = t.crypto_currency ? `${t.crypto_currency}`+(t.crypto_txhash?` · ${t.crypto_txhash.slice(0,14)}…`:'') : 'Crypto';
    return `<div class="txn-row">
      <div class="txn-icon">${icons[t.payment_method]||'💰'}</div>
      <div class="txn-info">
        <div class="txn-title">${t.gig_title||'Gig order'}</div>
        <div class="txn-meta">${detail} · ${date} ${time}</div>
        ${t.buyer_email?`<div class="txn-meta">👤 ${t.buyer_email}</div>`:''}
      </div>
      <div class="txn-amount">$${t.amount}</div>
      <div class="txn-status status-${t.payment_status}">${t.payment_status}</div>
    </div>`;
  }).join('');
};

// ── POST GIG ──────────────────────────────────────────────
function buildEmojiPicker() {
  document.getElementById('emoji-picker').innerHTML = EMOJIS.map(e =>
    `<button class="filter-chip emoji-opt ${selectedEmoji===e?'on':''}" onclick="selectEmoji('${e}',this)">${e}</button>`
  ).join('');
}

window.selectEmoji = function(e, btn) {
  selectedEmoji = e;
  document.querySelectorAll('.emoji-opt').forEach(el => el.classList.remove('on'));
  btn.classList.add('on');
};

window.submitGig = async function() {
  if (!currentUser) return showToast('Please log in to post a gig.');
  const title       = document.getElementById('gig-title').value.trim();
  const category    = document.getElementById('gig-cat').value;
  const description = document.getElementById('gig-desc').value.trim();
  const price       = parseInt(document.getElementById('gig-price').value, 10);
  const delivery    = document.getElementById('gig-delivery').value;

  if (!title||!category||!description||!price||price<5) return showToast('Please fill in all fields (min price $5).');

  const btn = document.getElementById('submit-btn');
  btn.disabled=true; btn.textContent='Publishing…';

  const display  = currentProfile?.display_name || currentProfile?.full_name || currentUser.email.split('@')[0];
  const initials = display.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

  const { error } = await db.from('gigs').insert({
    title, category, description, price, delivery,
    thumb: selectedEmoji, seller_name: display, seller_init: initials,
    user_id: currentUser.id, rating: 0, review_count: 0
  });

  btn.disabled=false; btn.textContent='Publish Gig →';
  if (error) return showToast('Could not publish. Try again.');

  ['gig-title','gig-desc','gig-price'].forEach(id => document.getElementById(id).value='');
  document.getElementById('gig-cat').value=''; document.getElementById('gig-delivery').value='1 day';
  selectedEmoji='🎨';
  showToast('🎉 Gig published! It\'s live on the marketplace.');
  setTimeout(() => goPage('browse'), 1600);
};

// ── TOAST ─────────────────────────────────────────────────
let toastTimer;
window.showToast = function(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
};

// ── INIT ──────────────────────────────────────────────────
renderHome();
