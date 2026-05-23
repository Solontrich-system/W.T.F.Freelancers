// ── App entry point ───────────────────────────────────────
// All modules are imported here so their side-effects (window.* assignments) fire.
import './utils.js';
import './auth.js';
import './gigs.js';
import './profile.js';
import './checkout.js';
import './payout.js';
import './txns.js';
import './legal.js';
import './nav.js';

// Re-wire heroSell now that auth module is loaded
import { currentUser } from './auth.js';
window.heroSell = function() {
  currentUser ? window.goPage('post') : window.goPage('register');
};

// Initial render
import { renderHome } from './gigs.js';
renderHome();
