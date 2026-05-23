// ── Checkout module ───────────────────────────────────────
import { db } from './db.js';
import { state } from './state.js';
import { requireAuth } from './auth.js';
import { showToast } from './utils.js';

let currentPayMethod = 'card';
let currentCrypto    = 'btc';

window.openCheckout = function() {
  if (!requireAuth()) return;
  if (!state.currentGig) return;

  const g = state.currentGig;
  document.getElementById('checkout-summary').innerHTML = `
    <div class="cs-thumb">${g.thumb || '🎯'}</div>
    <div class="cs-info">
      <div class="cs-title">${g.title}</div>
      <div class="cs-meta">by ${g.seller_name} · ${g.delivery}</div>
    </div>
    <div class="cs-price">$${g.price}</div>`;

  const pp = state.sellerPayDetails?.paypal_email;
  document.getElementById('paypal-seller-email').textContent = pp || 'Seller has not added PayPal.';

  // Pre-fill buyer email
  const email = state.currentProfile?.email || state.currentUser?.email || '';
  if (email) {
    document.getElementById('card-email').value     = email;
    document.getElementById('pp-buyer-email').value = email;
    document.getElementById('crypto-email').value   = email;
  }
  if (state.currentProfile?.full_name)
    document.getElementById('card-name').value = state.currentProfile.full_name;

  selectCrypto('btc');
  selectPayMethod('card');
  window.goPage('checkout');
};

window.selectPayMethod = function(method) {
  currentPayMethod = method;
  ['card','paypal','crypto'].forEach(m => {
    document.getElementById('pay-' + m).style.display = m === method ? 'block' : 'none';
    document.getElementById('pm-' + m).classList.toggle('active', m === method);
  });
};

function selectCrypto(coin) {
  currentCrypto = coin;
  ['btc','eth','usdt'].forEach(c =>
    document.getElementById('co-' + c).classList.toggle('active', c === coin)
  );
  const pd  = state.sellerPayDetails;
  const map = {
    btc:  { addr: pd?.btc_address,  label: '₿ Bitcoin (BTC)',  net: '' },
    eth:  { addr: pd?.eth_address,  label: '⟠ Ethereum (ETH)', net: '' },
    usdt: { addr: pd?.usdt_address, label: '₮ USDT',           net: pd?.crypto_network || '' },
  };
  const info = map[coin];
  document.getElementById('cac-label').textContent   = `Send exact amount in ${info.label} to:`;
  document.getElementById('cac-address').textContent = info.addr || 'Seller has not added this wallet.';
  document.getElementById('cac-network').textContent = info.net ? `Network: ${info.net}` : '';
}
window.selectCrypto = selectCrypto;

window.copyAddress = function() {
  const addr = document.getElementById('cac-address').textContent;
  navigator.clipboard.writeText(addr).then(() => showToast('Address copied!'));
};

function detectCardBrand(num) {
  if (/^4/.test(num))      return 'Visa';
  if (/^5[1-5]/.test(num)) return 'Mastercard';
  if (/^3[47]/.test(num))  return 'Amex';
  return 'Card';
}

window.fmtCard   = el => { let v = el.value.replace(/\D/g,'').slice(0,16); el.value = v.match(/.{1,4}/g)?.join(' ') || v; };
window.fmtExpiry = el => { let v = el.value.replace(/\D/g,'').slice(0,4); if (v.length >= 3) v = v.slice(0,2)+' / '+v.slice(2); el.value = v; };

window.submitPayment = async function() {
  if (!state.currentGig || !state.currentUser) return;
  const btn = document.getElementById('checkout-btn');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  const g = state.currentGig;
  let txnData = {
    gig_id: g.id, gig_title: g.title,
    amount: g.price, currency: 'USD',
    payment_method: currentPayMethod, payment_status: 'pending',
    buyer_user_id: state.currentUser.id,
  };
  let orderData = {
    gig_id: g.id, payment_method: currentPayMethod,
    amount: g.price, status: 'Pending',
    buyer_user_id: state.currentUser.id,
  };

  if (currentPayMethod === 'card') {
    const name   = document.getElementById('card-name').value.trim();
    const email  = document.getElementById('card-email').value.trim();
    const num    = document.getElementById('card-number').value.replace(/\s/g, '');
    const expiry = document.getElementById('card-expiry').value.trim();
    const cvv    = document.getElementById('card-cvv').value.trim();
    if (!name || !email || num.length < 13 || !expiry || !cvv) {
      showToast('Please fill in all card details.');
      btn.disabled = false; btn.textContent = 'Confirm & Pay'; return;
    }
    txnData   = { ...txnData, buyer_name: name, buyer_email: email, card_last4: num.slice(-4), card_brand: detectCardBrand(num) };
    orderData = { ...orderData, buyer_name: name, buyer_email: email };
  }

  if (currentPayMethod === 'paypal') {
    const email = document.getElementById('pp-buyer-email').value.trim();
    const ref   = document.getElementById('pp-ref').value.trim();
    if (!email || !ref) {
      showToast('Enter your PayPal email and transaction reference.');
      btn.disabled = false; btn.textContent = 'Confirm & Pay'; return;
    }
    txnData   = { ...txnData, paypal_email: email, paypal_ref: ref };
    orderData = { ...orderData, buyer_name: email, buyer_email: email };
  }

  if (currentPayMethod === 'crypto') {
    const email  = document.getElementById('crypto-email').value.trim();
    const txhash = document.getElementById('crypto-txhash').value.trim();
    if (!email || !txhash) {
      showToast('Enter your email and transaction hash.');
      btn.disabled = false; btn.textContent = 'Confirm & Pay'; return;
    }
    const names = { btc: 'Bitcoin (BTC)', eth: 'Ethereum (ETH)', usdt: 'USDT' };
    txnData = {
      ...txnData,
      buyer_email:     email,
      crypto_currency: names[currentCrypto],
      crypto_address:  state.sellerPayDetails?.[currentCrypto + '_address'] || '',
      crypto_txhash:   txhash,
      crypto_network:  currentCrypto === 'usdt' ? (state.sellerPayDetails?.crypto_network || '') : '',
    };
    orderData = { ...orderData, buyer_name: email, buyer_email: email };
  }

  const { data: order, error: oErr } = await db.from('orders').insert(orderData).select().single();
  if (oErr) {
    console.error(oErr);
    showToast('Could not place order.');
    btn.disabled = false; btn.textContent = 'Confirm & Pay'; return;
  }

  txnData.order_id = order.id;
  const { error: tErr } = await db.from('transactions').insert(txnData);
  if (tErr) console.error(tErr);

  btn.disabled = false;
  btn.textContent = 'Confirm & Pay';
  showToast('🎉 Payment submitted! Order is now pending.');
  setTimeout(() => window.goPage('txns'), 1800);
};
