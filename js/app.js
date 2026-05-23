// ── App entry point ───────────────────────────────────────
// Import order: state first, then leaf modules, then nav (which depends on all)
import './state.js';
import './utils.js';
import './auth.js';
import './gigs.js';
import './profile.js';
import './checkout.js';
import './payout.js';
import './txns.js';
import './legal.js';
import './nav.js';

// heroSell: read state at click time (not at import time)
import { state } from './state.js';
window.heroSell = function() {
  state.currentUser ? window.goPage('post') : window.goPage('register');
};

// Initial home render
import { renderHome } from './gigs.js';
renderHome();
