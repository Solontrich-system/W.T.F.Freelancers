// ── Navigation ────────────────────────────────────────────
import { requireAuth } from './auth.js';
import { renderHome, renderBrowse, buildEmojiPicker } from './gigs.js';
import { renderProfile, loadEditProfile } from './profile.js';
import { loadPayoutForm } from './payout.js';
import { renderTxns } from './txns.js';
import { renderAbout, renderTerms, renderPrivacy } from './legal.js';

const PROTECTED = ['profile','post','payout','txns','edit-profile'];

window.goPage = function(name) {
  if (PROTECTED.includes(name) && !requireAuth()) return;

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
  if (name === 'about')        renderAbout();
  if (name === 'terms')        renderTerms();
  if (name === 'privacy')      renderPrivacy();
};

document.getElementById('nav-toggle').addEventListener('click', () => {
  document.getElementById('nav-links').classList.toggle('open');
});
