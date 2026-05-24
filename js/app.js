// ── App entry point ───────────────────────────────────────
import './state.js';
import './utils.js';
import './auth.js';
import './gigs.js';
import './profile.js';
import './checkout.js';
import './payout.js';
import './txns.js';
import './legal.js';
import './chat.js';
import './nav.js';

import { state } from './state.js';
import { renderHome } from './gigs.js';
import { openSellerChat } from './chat.js';

// heroSell: read state at click time
window.heroSell = function() {
  state.currentUser ? window.goPage('post') : window.goPage('register');
};

// Wire up "Message Seller" button on gig detail page
window.openSellerChatFromGig = function() {
  const g = state.currentGig;
  if (!g) return;
  openSellerChat(g.id, g.user_id, g.seller_name);
};

// Initial home render
renderHome();
