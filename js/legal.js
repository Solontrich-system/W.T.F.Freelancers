// ── Legal & About pages module ────────────────────────────
import { db } from './db.js';

// ── Guest Support Modal ───────────────────────────────────
window.openGuestSupport = function() {
  // Remove any existing modal
  document.getElementById('guest-support-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'guest-support-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    background:rgba(5,11,20,0.85);backdrop-filter:blur(6px);padding:16px;
  `;

  modal.innerHTML = `
    <div style="background:#111827;border:1px solid rgba(0,255,180,0.25);border-radius:14px;width:100%;max-width:460px;padding:28px;position:relative;box-shadow:0 0 40px rgba(0,255,180,0.06)">
      <button onclick="document.getElementById('guest-support-modal').remove()"
        style="position:absolute;top:14px;right:16px;background:none;border:none;color:#4a6080;font-size:20px;cursor:pointer;line-height:1">✕</button>

      <div style="font-size:10px;color:#00ffb4;letter-spacing:3px;margin-bottom:8px;font-family:'Share Tech Mono',monospace">// W.T.F. SUPPORT</div>
      <h3 style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:6px;color:#f0eeea">Send us a message</h3>
      <p style="font-size:13px;color:#4a6080;margin-bottom:22px;line-height:1.6">No account needed. We'll get back to you as soon as possible.</p>

      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#4a6080;letter-spacing:1px;display:block;margin-bottom:6px;text-transform:uppercase">Your name *</label>
        <input id="gs-name" type="text" maxlength="60" placeholder="How should we address you?"
          style="width:100%;background:#0d1117;border:1px solid rgba(0,255,180,0.12);color:#c8d6e5;padding:10px 13px;border-radius:8px;font-size:13px;outline:none;font-family:'Share Tech Mono',monospace;caret-color:#00ffb4"
          onfocus="this.style.borderColor='rgba(0,255,180,0.4)'" onblur="this.style.borderColor='rgba(0,255,180,0.12)'"/>
      </div>

      <div style="margin-bottom:14px">
        <label style="font-size:11px;color:#4a6080;letter-spacing:1px;display:block;margin-bottom:6px;text-transform:uppercase">Email <span style="color:#2a3a50">(optional — for a reply)</span></label>
        <input id="gs-email" type="email" maxlength="120" placeholder="you@email.com"
          style="width:100%;background:#0d1117;border:1px solid rgba(0,255,180,0.12);color:#c8d6e5;padding:10px 13px;border-radius:8px;font-size:13px;outline:none;font-family:'Share Tech Mono',monospace;caret-color:#00ffb4"
          onfocus="this.style.borderColor='rgba(0,255,180,0.4)'" onblur="this.style.borderColor='rgba(0,255,180,0.12)'"/>
      </div>

      <div style="margin-bottom:20px">
        <label style="font-size:11px;color:#4a6080;letter-spacing:1px;display:block;margin-bottom:6px;text-transform:uppercase">Message *</label>
        <textarea id="gs-message" maxlength="1000" rows="5"
          placeholder="Describe your issue, feedback, or question…"
          style="width:100%;background:#0d1117;border:1px solid rgba(0,255,180,0.12);color:#c8d6e5;padding:10px 13px;border-radius:8px;font-size:13px;outline:none;font-family:'Share Tech Mono',monospace;resize:vertical;caret-color:#00ffb4;line-height:1.6"
          onfocus="this.style.borderColor='rgba(0,255,180,0.4)'" onblur="this.style.borderColor='rgba(0,255,180,0.12)'"></textarea>
        <div id="gs-char" style="text-align:right;font-size:10px;color:#2a3a50;margin-top:4px;font-family:'Share Tech Mono',monospace">0 / 1000</div>
      </div>

      <div id="gs-error" style="font-size:12px;color:#ff4560;margin-bottom:12px;min-height:16px;letter-spacing:.5px"></div>

      <button id="gs-submit" onclick="submitGuestSupport()"
        style="width:100%;background:transparent;border:1px solid #00ffb4;color:#00ffb4;padding:13px;border-radius:8px;font-family:'Share Tech Mono',monospace;font-size:12px;letter-spacing:3px;cursor:pointer;transition:all .2s;text-transform:uppercase">
        SEND MESSAGE →
      </button>
    </div>`;

  document.body.appendChild(modal);

  // Char counter
  const msgInput = document.getElementById('gs-message');
  const charEl   = document.getElementById('gs-char');
  msgInput.addEventListener('input', () => {
    const n = msgInput.value.length;
    charEl.textContent = `${n} / 1000`;
    charEl.style.color = n > 900 ? '#ff4560' : '#2a3a50';
  });

  // Close on backdrop click
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });

  document.getElementById('gs-name').focus();
};

window.submitGuestSupport = async function() {
  const name    = document.getElementById('gs-name').value.trim();
  const email   = document.getElementById('gs-email').value.trim();
  const message = document.getElementById('gs-message').value.trim();
  const errEl   = document.getElementById('gs-error');
  const btn     = document.getElementById('gs-submit');

  errEl.textContent = '';

  if (!name)    return void (errEl.textContent = 'Please enter your name.');
  if (!message) return void (errEl.textContent = 'Please enter a message.');

  btn.disabled = true;
  btn.textContent = 'SENDING…';

  const { error } = await db.from('guest_support').insert({ name, email: email || null, message });

  btn.disabled = false;
  btn.textContent = 'SEND MESSAGE →';

  if (error) {
    console.error(error);
    errEl.textContent = 'Could not send. Please try again.';
    return;
  }

  // Success state
  const modal = document.getElementById('guest-support-modal');
  modal.querySelector('div').innerHTML = `
    <div style="text-align:center;padding:20px 0">
      <div style="font-size:48px;margin-bottom:16px">✅</div>
      <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;margin-bottom:10px;color:#f0eeea">Message sent!</div>
      <p style="font-size:13px;color:#4a6080;line-height:1.7;max-width:300px;margin:0 auto 24px">
        We received your message${email ? ' and will reply to <strong style="color:#f0eeea">'+email+'</strong>' : ''}. Thanks for reaching out!
      </p>
      <button onclick="document.getElementById('guest-support-modal').remove()"
        style="background:#00ffb4;color:#050b14;border:none;padding:11px 28px;border-radius:8px;font-family:'Share Tech Mono',monospace;font-size:12px;letter-spacing:2px;cursor:pointer;font-weight:700">
        CLOSE
      </button>
    </div>`;
};

// Smooth scroll to anchored section
window.scrollToSection = function(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const offset = 80; // nav height
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
};

// Highlight active TOC item on scroll
function initTOCHighlight(tocLinks) {
  if (!tocLinks.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        tocLinks.forEach(a => a.classList.remove('active'));
        const active = [...tocLinks].find(a => a.getAttribute('data-target') === entry.target.id);
        if (active) active.classList.add('active');
      }
    });
  }, { rootMargin: '-72px 0px -60% 0px' });

  tocLinks.forEach(a => {
    const target = document.getElementById(a.getAttribute('data-target'));
    if (target) observer.observe(target);
  });
}

// ── About ─────────────────────────────────────────────────
export function renderAbout() {
  const container = document.getElementById('about-content');
  if (!container || container.dataset.rendered) return;
  container.dataset.rendered = '1';

  container.innerHTML = `
  <div class="doc-page">
    <div class="doc-hero">
      <div class="doc-badge">✦ Our Story</div>
      <h1 class="doc-title">Built for <em style="color:var(--amber);font-style:normal">freelancers</em>,<br>by freelancers</h1>
      <p class="doc-meta">
        <span>🌍 Cape Town, South Africa</span>
        <span>🚀 Founded 2024</span>
        <span>💛 Free forever</span>
      </p>
    </div>

    <div class="doc-section">
      <div class="doc-section-num">01 — MISSION</div>
      <h2>Why W.T.F. exists</h2>
      <p>W.T.F. — <strong style="color:var(--white)">We The Freelancers</strong> — was born from a simple frustration: existing platforms take huge cuts, hide earnings behind slow payouts, and treat freelancers as a commodity rather than a community.</p>
      <p>We built a marketplace where freelancers keep their earnings, get paid directly via bank transfer, PayPal, or crypto, and retain full ownership of their client relationships.</p>
      <div class="doc-highlight"><strong>Our promise:</strong> W.T.F. never sits between you and your money. Payments go directly from buyer to seller — we just facilitate the connection and keep a transparent record.</div>
    </div>

    <div class="about-stat-row">
      <div class="about-stat"><div class="about-stat-num" id="about-stat-gigs">—</div><div class="about-stat-label">Active gigs</div></div>
      <div class="about-stat"><div class="about-stat-num" id="about-stat-orders">—</div><div class="about-stat-label">Orders placed</div></div>
      <div class="about-stat"><div class="about-stat-num" id="about-stat-txns">—</div><div class="about-stat-label">Transactions</div></div>
      <div class="about-stat"><div class="about-stat-num">3</div><div class="about-stat-label">Payment methods</div></div>
    </div>

    <div class="doc-section">
      <div class="doc-section-num">02 — WHAT WE OFFER</div>
      <h2>A marketplace that gets out of your way</h2>
      <div class="about-grid">
        <div class="about-card"><div class="about-card-icon">💸</div><div class="about-card-title">Direct payments</div><div class="about-card-text">Buyers pay sellers directly via bank transfer, PayPal, Bitcoin, Ethereum, or USDT. No middleman holding your funds.</div></div>
        <div class="about-card"><div class="about-card-icon">🔒</div><div class="about-card-title">Transparent records</div><div class="about-card-text">Every transaction is logged in the W.T.F. database, giving both parties a clear, permanent record.</div></div>
        <div class="about-card"><div class="about-card-icon">🌐</div><div class="about-card-title">Global reach</div><div class="about-card-text">Sell to anyone, anywhere. Crypto payments mean no bank boundaries — perfect for cross-border work.</div></div>
        <div class="about-card"><div class="about-card-icon">🆓</div><div class="about-card-title">Free forever</div><div class="about-card-text">Creating an account, posting gigs, and receiving payments costs nothing. We believe access to opportunity should be free.</div></div>
      </div>
    </div>

    <div class="doc-section">
      <div class="doc-section-num">03 — OUR VALUES</div>
      <h2>What we stand for</h2>
      <div class="values-list">
        <div class="value-row"><div class="value-icon">🤝</div><div class="value-body"><h4>Fairness</h4><p>No commission on earnings. No pay-to-rank gimmicks. Every freelancer starts on equal footing.</p></div></div>
        <div class="value-row"><div class="value-icon">🔍</div><div class="value-body"><h4>Transparency</h4><p>Open transaction records, clear payment flows, no hidden fees. You always know exactly what's happening with your money.</p></div></div>
        <div class="value-row"><div class="value-icon">⚡</div><div class="value-body"><h4>Speed</h4><p>Instant listings, direct payments, no 7-day hold periods. Get paid as fast as your payment method allows.</p></div></div>
        <div class="value-row"><div class="value-icon">🌱</div><div class="value-body"><h4>Community</h4><p>Built in South Africa, used worldwide. We champion the independent worker — from Cape Town to Nairobi to Berlin.</p></div></div>
      </div>
    </div>

    <div class="doc-section">
      <div class="doc-section-num">04 — TECH STACK</div>
      <h2>How it's built</h2>
      <p>W.T.F. is deliberately lightweight — vanilla HTML, CSS, and JavaScript with no heavy framework, backed by Supabase for real-time data and auth. This means fast load times, easy hosting on GitHub Pages, and a codebase anyone can read and contribute to.</p>
      <div class="about-grid">
        <div class="about-card"><div class="about-card-icon">🗄️</div><div class="about-card-title">Supabase</div><div class="about-card-text">PostgreSQL database, real-time auth, and row-level security — all managed so we can focus on the product.</div></div>
        <div class="about-card"><div class="about-card-icon">🐙</div><div class="about-card-title">GitHub Pages</div><div class="about-card-text">Zero-cost, globally distributed hosting. Every push deploys instantly.</div></div>
        <div class="about-card"><div class="about-card-icon">⚡</div><div class="about-card-title">Vanilla JS modules</div><div class="about-card-text">ES modules keep the codebase lean and dependency-free — no bundler, no build step.</div></div>
      </div>
    </div>

    <div class="doc-section">
      <div class="doc-section-num">05 — CREATOR</div>
      <h2>Built by Solontrich</h2>
      <p>W.T.F. Freelancers is an independent project by <strong style="color:var(--white)">Solontrich</strong> — a solo developer and creator building custom software systems designed to empower independent workers. No corporate backing, no VC funding, no subscription gatekeeping.</p>
      <a href="Solontrich.html" class="about-creator-card">
        <img src="Solontrich.png" alt="Solontrich" class="about-creator-logo"/>
        <div class="about-creator-info">
          <div class="about-creator-name">Solontrich</div>
          <div class="about-creator-desc">Software Solutions for Personal Empowerment · View creator page →</div>
        </div>
      </a>
    </div>

    <div class="doc-contact-box">
      <div class="doc-contact-icon">💬</div>
      <div class="doc-contact-text">
        <h3>Want to get involved?</h3>
        <p>Whether you're a freelancer, developer, or just curious — we'd love to hear from you.<br>
        <p>We're always happy to help — whether you're a freelancer, buyer, or just curious.</p>
        <button class="btn-primary" style="margin-top:10px;width:auto;padding:11px 24px" onclick="openGuestSupport()">💬 Message Support</button>
      </div>
    </div>
  </div>`;

  // Pull live stats
  loadAboutStats();
}

async function loadAboutStats() {
  try {
    const { db } = await import('./db.js');
    const [{ data: gigs }, { count: orders }, { count: txns }] = await Promise.all([
      db.from('gigs').select('id'),
      db.from('orders').select('*', { count: 'exact', head: true }),
      db.from('transactions').select('*', { count: 'exact', head: true })
    ]);
    const g = document.getElementById('about-stat-gigs');
    const o = document.getElementById('about-stat-orders');
    const t = document.getElementById('about-stat-txns');
    if (g) g.textContent = gigs?.length ?? 0;
    if (o) o.textContent = orders ?? 0;
    if (t) t.textContent = txns ?? 0;
  } catch (e) { /* stats are decorative */ }
}

// ── Terms ─────────────────────────────────────────────────
export function renderTerms() {
  const container = document.getElementById('terms-content');
  if (!container || container.dataset.rendered) return;
  container.dataset.rendered = '1';

  container.innerHTML = `
  <div class="doc-page">
    <div class="doc-hero">
      <div class="doc-badge">📄 Legal</div>
      <h1 class="doc-title">Terms of Service</h1>
      <p class="doc-meta">
        <span>📅 Effective: 1 January 2025</span>
        <span>🔄 Last updated: May 2025</span>
      </p>
    </div>

    <div class="doc-toc">
      <div class="doc-toc-title">Table of Contents</div>
      <ol>
        <li><a href="#" onclick="scrollToSection('tos-1');return false" data-target="tos-1">Acceptance of Terms</a></li>
        <li><a href="#" onclick="scrollToSection('tos-2');return false" data-target="tos-2">Description of Service</a></li>
        <li><a href="#" onclick="scrollToSection('tos-3');return false" data-target="tos-3">Account Registration</a></li>
        <li><a href="#" onclick="scrollToSection('tos-4');return false" data-target="tos-4">Payments &amp; Transactions</a></li>
        <li><a href="#" onclick="scrollToSection('tos-5');return false" data-target="tos-5">Seller Obligations</a></li>
        <li><a href="#" onclick="scrollToSection('tos-6');return false" data-target="tos-6">Buyer Obligations</a></li>
        <li><a href="#" onclick="scrollToSection('tos-7');return false" data-target="tos-7">Prohibited Content</a></li>
        <li><a href="#" onclick="scrollToSection('tos-8');return false" data-target="tos-8">Limitation of Liability</a></li>
        <li><a href="#" onclick="scrollToSection('tos-9');return false" data-target="tos-9">Termination</a></li>
        <li><a href="#" onclick="scrollToSection('tos-10');return false" data-target="tos-10">Governing Law</a></li>
      </ol>
    </div>

    <div class="doc-highlight"><strong>Plain-English summary:</strong> W.T.F. connects buyers and sellers. Payments go directly between parties — we record them but don't hold funds. Use the platform honestly, deliver what you promise, and don't do anything illegal. Full details below.</div>

    <div class="doc-section" id="tos-1">
      <div class="doc-section-num">01</div>
      <h2>Acceptance of Terms</h2>
      <p>By accessing or using the W.T.F. Freelancers platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree, do not use the Service.</p>
      <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the revised Terms. We will note the effective date at the top of this page.</p>
    </div>

    <div class="doc-section" id="tos-2">
      <div class="doc-section-num">02</div>
      <h2>Description of Service</h2>
      <p>W.T.F. Freelancers is a peer-to-peer marketplace that allows freelancers ("Sellers") to list services ("Gigs") and clients ("Buyers") to purchase those services. We provide the platform and record-keeping; we do not act as a payment processor, escrow agent, or party to any transaction.</p>
      <p>All payments are made directly between Buyers and Sellers using the Seller's nominated payment method (bank transfer, PayPal, or cryptocurrency). W.T.F. is not responsible for payment disputes, non-delivery, or failed transactions.</p>
    </div>

    <div class="doc-section" id="tos-3">
      <div class="doc-section-num">03</div>
      <h2>Account Registration</h2>
      <ul>
        <li>You must be at least 18 years old to create an account.</li>
        <li>You must provide accurate, current, and complete information during registration.</li>
        <li>You are responsible for maintaining the security of your account credentials.</li>
        <li>You may not create multiple accounts to circumvent bans or restrictions.</li>
        <li>W.T.F. reserves the right to suspend or terminate accounts that violate these Terms.</li>
      </ul>
    </div>

    <div class="doc-section" id="tos-4">
      <div class="doc-section-num">04</div>
      <h2>Payments &amp; Transactions</h2>
      <p>All financial transactions occur directly between Buyers and Sellers. W.T.F. records transaction details (method, amount, status, reference) for transparency and dispute assistance but does not process, hold, or transfer funds.</p>
      <ul>
        <li><strong style="color:var(--white)">Card payments:</strong> Sellers must provide their banking details. Card data entered by Buyers is illustrative only — actual processing is the Seller's responsibility.</li>
        <li><strong style="color:var(--white)">PayPal:</strong> Buyers send funds to the Seller's PayPal email and submit the transaction reference on our platform.</li>
        <li><strong style="color:var(--white)">Cryptocurrency:</strong> Buyers send crypto to the Seller's wallet address and submit the transaction hash. Blockchain transactions are irreversible.</li>
      </ul>
      <div class="doc-highlight"><strong>Important:</strong> Always verify payment details independently before sending funds. W.T.F. cannot reverse, refund, or recover payments made to incorrect addresses.</div>
    </div>

    <div class="doc-section" id="tos-5">
      <div class="doc-section-num">05</div>
      <h2>Seller Obligations</h2>
      <ul>
        <li>Deliver services as described in your Gig listing, within the stated timeframe.</li>
        <li>Keep your payout details accurate and up to date.</li>
        <li>Respond to buyer inquiries in a timely and professional manner.</li>
        <li>Not misrepresent your skills, qualifications, or the scope of your services.</li>
        <li>Comply with all applicable laws, including tax obligations on your earnings.</li>
      </ul>
    </div>

    <div class="doc-section" id="tos-6">
      <div class="doc-section-num">06</div>
      <h2>Buyer Obligations</h2>
      <ul>
        <li>Pay the agreed amount promptly and provide accurate payment references.</li>
        <li>Communicate clearly about project requirements before placing an order.</li>
        <li>Not initiate chargebacks or payment disputes without first contacting the Seller.</li>
        <li>Use purchased services only for lawful purposes.</li>
      </ul>
    </div>

    <div class="doc-section" id="tos-7">
      <div class="doc-section-num">07</div>
      <h2>Prohibited Content &amp; Conduct</h2>
      <p>The following are strictly prohibited on W.T.F.:</p>
      <ul>
        <li>Illegal goods or services of any kind</li>
        <li>Adult or explicit content</li>
        <li>Hateful, discriminatory, or harassing content</li>
        <li>Spam, fake reviews, or coordinated manipulation</li>
        <li>Impersonating other users or entities</li>
        <li>Attempting to circumvent the platform (e.g. taking payments off-platform to avoid records)</li>
        <li>Any activity that violates applicable law</li>
      </ul>
    </div>

    <div class="doc-section" id="tos-8">
      <div class="doc-section-num">08</div>
      <h2>Limitation of Liability</h2>
      <p>W.T.F. Freelancers is provided "as is" without warranties of any kind. To the maximum extent permitted by law, W.T.F. shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>
      <p>Our total liability to you for any claim shall not exceed ZAR 500 (or equivalent) — the approximate cost of nothing, because this platform is free.</p>
    </div>

    <div class="doc-section" id="tos-9">
      <div class="doc-section-num">09</div>
      <h2>Termination</h2>
      <p>You may delete your account at any time by contacting us. W.T.F. may suspend or terminate accounts that violate these Terms, with or without notice, at our sole discretion.</p>
      <p>Upon termination, your public Gig listings will be removed. Transaction records may be retained for legal compliance purposes.</p>
    </div>

    <div class="doc-section" id="tos-10">
      <div class="doc-section-num">10</div>
      <h2>Governing Law</h2>
      <p>These Terms are governed by the laws of the Republic of South Africa. Any disputes shall be subject to the jurisdiction of the courts of the Western Cape, South Africa.</p>
    </div>

    <div class="doc-contact-box">
      <div class="doc-contact-icon">📬</div>
      <div class="doc-contact-text">
        <h3>Questions about these Terms?</h3>
        <p>We're happy to clarify anything. Email us at <a href="mailto:legal@wtf-freelancers.com">legal@wtf-freelancers.com</a></p>
      </div>
    </div>
  </div>`;

  initTOCHighlight(container.querySelectorAll('[data-target]'));
}

// ── Privacy Policy ────────────────────────────────────────
export function renderPrivacy() {
  const container = document.getElementById('privacy-content');
  if (!container || container.dataset.rendered) return;
  container.dataset.rendered = '1';

  container.innerHTML = `
  <div class="doc-page">
    <div class="doc-hero">
      <div class="doc-badge">🔒 Privacy</div>
      <h1 class="doc-title">Privacy Policy</h1>
      <p class="doc-meta">
        <span>📅 Effective: 1 January 2025</span>
        <span>🔄 Last updated: May 2025</span>
      </p>
    </div>

    <div class="doc-toc">
      <div class="doc-toc-title">Table of Contents</div>
      <ol>
        <li><a href="#" onclick="scrollToSection('pp-1');return false" data-target="pp-1">Information We Collect</a></li>
        <li><a href="#" onclick="scrollToSection('pp-2');return false" data-target="pp-2">How We Use Your Information</a></li>
        <li><a href="#" onclick="scrollToSection('pp-3');return false" data-target="pp-3">Data Storage &amp; Security</a></li>
        <li><a href="#" onclick="scrollToSection('pp-4');return false" data-target="pp-4">Sharing Your Information</a></li>
        <li><a href="#" onclick="scrollToSection('pp-5');return false" data-target="pp-5">Payment Data</a></li>
        <li><a href="#" onclick="scrollToSection('pp-6');return false" data-target="pp-6">Your Rights</a></li>
        <li><a href="#" onclick="scrollToSection('pp-7');return false" data-target="pp-7">Cookies &amp; Tracking</a></li>
        <li><a href="#" onclick="scrollToSection('pp-8');return false" data-target="pp-8">Children's Privacy</a></li>
        <li><a href="#" onclick="scrollToSection('pp-9');return false" data-target="pp-9">Changes to this Policy</a></li>
        <li><a href="#" onclick="scrollToSection('pp-10');return false" data-target="pp-10">Contact Us</a></li>
      </ol>
    </div>

    <div class="doc-highlight"><strong>Plain-English summary:</strong> We collect only what we need to run the platform. We don't sell your data. Payments go directly between users — we store references, not card numbers. You can request deletion of your data at any time.</div>

    <div class="doc-section" id="pp-1">
      <div class="doc-section-num">01</div>
      <h2>Information We Collect</h2>
      <p><strong style="color:var(--white)">Account information:</strong> Name, display name, email address, location, and role (buyer/seller/both) provided during registration.</p>
      <p><strong style="color:var(--white)">Gig information:</strong> Titles, descriptions, categories, pricing, and delivery details you publish.</p>
      <p><strong style="color:var(--white)">Payout details:</strong> Bank account info, PayPal email, and cryptocurrency wallet addresses you choose to save. This data is stored in our Supabase database and visible only to buyers when they view your gig.</p>
      <p><strong style="color:var(--white)">Transaction records:</strong> Payment method, amount, status, buyer email, and payment references (PayPal ref or crypto transaction hash). We do <em>not</em> store full card numbers — only the last 4 digits and card brand.</p>
    </div>

    <div class="doc-section" id="pp-2">
      <div class="doc-section-num">02</div>
      <h2>How We Use Your Information</h2>
      <ul>
        <li>To provide and maintain the marketplace platform</li>
        <li>To authenticate your identity and secure your account</li>
        <li>To display your Gigs and profile to potential buyers</li>
        <li>To share your payout details with buyers who are completing a purchase</li>
        <li>To maintain transaction records for both parties</li>
        <li>To improve the platform based on usage patterns</li>
        <li>To contact you about your account if necessary</li>
      </ul>
      <p>We do not use your data for advertising, profiling, or selling to third parties.</p>
    </div>

    <div class="doc-section" id="pp-3">
      <div class="doc-section-num">03</div>
      <h2>Data Storage &amp; Security</h2>
      <p>All data is stored in Supabase (PostgreSQL), hosted on AWS infrastructure with encryption at rest and in transit. Supabase enforces row-level security, meaning users can only access data they are permitted to see.</p>
      <p>Authentication is handled by Supabase Auth, which uses industry-standard bcrypt password hashing. We never store plaintext passwords.</p>
      <p>Despite these measures, no system is 100% secure. We encourage you to use a strong, unique password and to contact us immediately if you suspect unauthorised access to your account.</p>
    </div>

    <div class="doc-section" id="pp-4">
      <div class="doc-section-num">04</div>
      <h2>Sharing Your Information</h2>
      <p>We share your information only in the following circumstances:</p>
      <ul>
        <li><strong style="color:var(--white)">With buyers:</strong> Your display name, payout method types, and wallet/payment addresses are shown to buyers when they view your Gig or proceed to checkout.</li>
        <li><strong style="color:var(--white)">With service providers:</strong> Supabase processes and stores your data as our infrastructure provider. Their privacy policy is available at supabase.com.</li>
        <li><strong style="color:var(--white)">Legal requirements:</strong> We may disclose data if required by law, court order, or to protect the rights and safety of our users.</li>
      </ul>
      <p>We do not sell, rent, or trade your personal information to any third party.</p>
    </div>

    <div class="doc-section" id="pp-5">
      <div class="doc-section-num">05</div>
      <h2>Payment Data</h2>
      <div class="doc-highlight"><strong>We do not process payments.</strong> All funds move directly between Buyers and Sellers. We record payment metadata (method, amount, reference, status) for transparency — we never have access to or custody of any funds.</div>
      <ul>
        <li><strong style="color:var(--white)">Card payments:</strong> We store only the last 4 digits and card brand. Full card numbers are never stored by W.T.F.</li>
        <li><strong style="color:var(--white)">PayPal:</strong> We store the buyer's PayPal email and the transaction reference provided by the buyer.</li>
        <li><strong style="color:var(--white)">Crypto:</strong> We store the wallet address, transaction hash, coin type, and network. Blockchain transactions are public by nature.</li>
      </ul>
    </div>

    <div class="doc-section" id="pp-6">
      <div class="doc-section-num">06</div>
      <h2>Your Rights</h2>
      <p>Under applicable data protection law (including POPIA in South Africa and GDPR where applicable), you have the right to:</p>
      <ul>
        <li><strong style="color:var(--white)">Access:</strong> Request a copy of all personal data we hold about you.</li>
        <li><strong style="color:var(--white)">Correction:</strong> Update inaccurate or incomplete data via your profile settings.</li>
        <li><strong style="color:var(--white)">Deletion:</strong> Request deletion of your account and associated personal data. Note that transaction records may be retained for legal compliance.</li>
        <li><strong style="color:var(--white)">Portability:</strong> Request your data in a machine-readable format.</li>
        <li><strong style="color:var(--white)">Objection:</strong> Object to processing of your data in certain circumstances.</li>
      </ul>
      <p>To exercise any of these rights, email <a href="mailto:privacy@wtf-freelancers.com" style="color:var(--amber)">privacy@wtf-freelancers.com</a>.</p>
    </div>

    <div class="doc-section" id="pp-7">
      <div class="doc-section-num">07</div>
      <h2>Cookies &amp; Tracking</h2>
      <p>W.T.F. uses only essential cookies required for authentication (managed by Supabase Auth). We do not use advertising cookies, tracking pixels, or analytics services that profile individual users.</p>
      <p>You can clear cookies via your browser settings. This will log you out of your account.</p>
    </div>

    <div class="doc-section" id="pp-8">
      <div class="doc-section-num">08</div>
      <h2>Children's Privacy</h2>
      <p>W.T.F. is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If you believe a minor has created an account, please contact us and we will promptly delete the account and associated data.</p>
    </div>

    <div class="doc-section" id="pp-9">
      <div class="doc-section-num">09</div>
      <h2>Changes to this Policy</h2>
      <p>We may update this Privacy Policy periodically. We will update the "Last updated" date at the top of this page. For significant changes, we will notify registered users by email where possible.</p>
    </div>

    <div class="doc-section" id="pp-10">
      <div class="doc-section-num">10</div>
      <h2>Contact Us</h2>
      <p>For any privacy-related questions, requests, or concerns:</p>
      <ul>
        <li>📧 <a href="mailto:privacy@wtf-freelancers.com" style="color:var(--amber)">privacy@wtf-freelancers.com</a></li>
        <li>🌍 W.T.F. Freelancers, Cape Town, Western Cape, South Africa</li>
      </ul>
    </div>

    <div class="doc-contact-box">
      <div class="doc-contact-icon">🔐</div>
      <div class="doc-contact-text">
        <h3>Your privacy matters to us</h3>
        <p>We keep your data minimal, secure, and never sell it. Questions? <a href="mailto:privacy@wtf-freelancers.com">privacy@wtf-freelancers.com</a></p>
      </div>
    </div>
  </div>`;

  initTOCHighlight(container.querySelectorAll('[data-target]'));
}
