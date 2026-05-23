// ── Payout module ─────────────────────────────────────────
import { db } from './db.js';
import { state } from './state.js';
import { showToast } from './utils.js';

export async function loadPayoutForm() {
  if (!state.currentUser) return;
  const { data } = await db.from('seller_payment_details')
    .select('*').eq('user_id', state.currentUser.id).maybeSingle();
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

window.switchPayoutTab = function(tab) {
  ['bank','paypal','crypto'].forEach(t => {
    document.getElementById('payout-' + t).style.display = t === tab ? 'block' : 'none';
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
};

window.savePayoutDetails = async function() {
  if (!state.currentUser) return;
  const btn = document.getElementById('payout-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  const sellerName = state.currentProfile?.display_name
    || state.currentProfile?.full_name
    || state.currentUser.email;

  const payload = {
    user_id:        state.currentUser.id,
    seller_name:    sellerName,
    bank_name:      document.getElementById('po-bank-name').value.trim()      || null,
    account_name:   document.getElementById('po-account-name').value.trim()   || null,
    account_number: document.getElementById('po-account-number').value.trim() || null,
    branch_code:    document.getElementById('po-branch').value.trim()         || null,
    swift_code:     document.getElementById('po-swift').value.trim()          || null,
    paypal_email:   document.getElementById('po-paypal-email').value.trim()   || null,
    btc_address:    document.getElementById('po-btc').value.trim()            || null,
    eth_address:    document.getElementById('po-eth').value.trim()            || null,
    usdt_address:   document.getElementById('po-usdt').value.trim()           || null,
    crypto_network: document.getElementById('po-crypto-network').value        || null,
    updated_at:     new Date().toISOString(),
  };

  const { data: existing } = await db.from('seller_payment_details')
    .select('id').eq('user_id', state.currentUser.id).maybeSingle();

  const { error } = existing
    ? await db.from('seller_payment_details').update(payload).eq('id', existing.id)
    : await db.from('seller_payment_details').insert(payload);

  btn.disabled = false;
  btn.textContent = 'Save Payout Details';
  if (error) { console.error(error); showToast('Could not save. Try again.'); return; }
  showToast('✅ Payout details saved!');
  setTimeout(() => window.goPage('profile'), 1400);
};
