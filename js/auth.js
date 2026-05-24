// ── Auth module ───────────────────────────────────────────
import { db } from './db.js';
import { state } from './state.js';
import { showToast } from './utils.js';

export function updateNavForUser() {
  const p = state.currentProfile;
  const initials = p?.avatar_init || (state.currentUser?.email?.[0]?.toUpperCase() ?? '?');
  document.getElementById('nav-auth-guest').style.display = 'none';
  document.getElementById('nav-auth-user').style.display  = 'flex';
  document.getElementById('nav-avatar').textContent       = initials;
  document.getElementById('nav-profile').style.display    = '';
  document.getElementById('nav-txns').style.display       = '';
  document.getElementById('nav-post').style.display       = '';
  document.getElementById('nav-chat').style.display       = '';
}

export function updateNavForGuest() {
  document.getElementById('nav-auth-guest').style.display = 'flex';
  document.getElementById('nav-auth-user').style.display  = 'none';
  document.getElementById('nav-profile').style.display    = 'none';
  document.getElementById('nav-txns').style.display       = 'none';
  document.getElementById('nav-post').style.display       = 'none';
  document.getElementById('nav-chat').style.display       = 'none';
}

export function requireAuth() {
  if (!state.currentUser) {
    showToast('Please log in to continue.');
    window.goPage('login');
    return false;
  }
  return true;
}

// ── Auth state listener ───────────────────────────────────
db.auth.onAuthStateChange(async (event, session) => {
  state.currentUser = session?.user ?? null;
  if (state.currentUser) {
    const { data } = await db.from('profiles')
      .select('*').eq('id', state.currentUser.id).maybeSingle();
    state.currentProfile = data;
    updateNavForUser();
  } else {
    state.currentProfile = null;
    updateNavForGuest();
  }
});

// ── Register ──────────────────────────────────────────────
window.doRegister = async function() {
  const name     = document.getElementById('reg-name').value.trim();
  const display  = document.getElementById('reg-display').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const role     = document.getElementById('reg-role').value;
  const location = document.getElementById('reg-location').value.trim();
  const errEl    = document.getElementById('reg-error');

  errEl.style.color = '';
  errEl.textContent = '';

  if (!name || !email || !password)
    return void (errEl.textContent = 'Please fill in all required fields.');
  if (password.length < 8)
    return void (errEl.textContent = 'Password must be at least 8 characters.');

  const btn = document.getElementById('reg-btn');
  btn.disabled = true;
  btn.textContent = 'Creating account…';

  const parts    = name.split(' ');
  const initials = ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || name[0].toUpperCase();

  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name:    name,
        display_name: display || parts[0],
        role,
        location,
        avatar_init:  initials,
      }
    }
  });

  btn.disabled = false;
  btn.textContent = 'Create account';

  if (error) {
    errEl.textContent = error.message;
    return;
  }

  // Write profile row immediately (works even if email confirm needed)
  if (data?.user) {
    await db.from('profiles').upsert({
      id:           data.user.id,
      full_name:    name,
      display_name: display || parts[0],
      email,
      role,
      location,
      bio:          '',
      avatar_init:  initials,
    }, { onConflict: 'id' });
  }

  if (data?.session) {
    // Email confirmation is OFF — user is signed in immediately
    showToast('🎉 Account created! Welcome to W.T.F. Freelancers.');
    ['reg-name','reg-display','reg-email','reg-password','reg-location']
      .forEach(id => { document.getElementById(id).value = ''; });
    window.goPage('home');
  } else {
    // Email confirmation is ON — ask them to check inbox
    errEl.style.color = 'var(--green)';
    errEl.textContent = '✅ Check your email to confirm your account, then log in here.';
    btn.textContent = 'Awaiting confirmation…';
    btn.disabled = true;
  }
};

// ── Login ─────────────────────────────────────────────────
window.doLogin = async function() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl    = document.getElementById('login-error');

  errEl.style.color = '';
  errEl.textContent = '';

  if (!email || !password)
    return void (errEl.textContent = 'Enter your email and password.');

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = 'Logging in…';

  const { error } = await db.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Log in';

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('invalid login') || msg.includes('invalid credentials'))
      errEl.textContent = 'Incorrect email or password.';
    else if (msg.includes('email not confirmed'))
      errEl.textContent = 'Please confirm your email first — check your inbox.';
    else
      errEl.textContent = error.message;
    return;
  }

  document.getElementById('login-email').value    = '';
  document.getElementById('login-password').value = '';
  showToast('👋 Welcome back!');
  window.goPage('home');
};

// ── Logout ────────────────────────────────────────────────
window.logout = async function() {
  await db.auth.signOut();
  state.currentUser    = null;
  state.currentProfile = null;
  showToast('You have been logged out.');
  window.goPage('home');
};
