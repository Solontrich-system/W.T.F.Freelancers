/* ═══════════════════════════════════════════════════
   WFT Owner Dashboard — chat.js
   Real-time owner inbox using Supabase + NEXUS style
   Tables expected:
     messages  (id, username, text, created_at, recipient)
     guest_support (id, guest_name, guest_email, message, owner_reply, created_at, status)
═══════════════════════════════════════════════════ */

'use strict';

/* ── Supabase client (shared config from dashboard.js) ── */
const _sb = window.supabase.createClient(SUPABASE_URL, ANON_KEY);

/* ══════════════════════════════════════════
   USER MESSAGES (messages sent to owner)
══════════════════════════════════════════ */

let activeThread      = null;   // currently open username thread
let realtimeSub       = null;   // live subscription for messages
let allThreadsCache   = [];     // cached thread list
let threadMessages    = {};     // { username: [msg, ...] }

/* ── Load all threads sent to owner ── */
async function loadUserThreads() {
  const dot = document.getElementById('chat-live-dot');

  try {
    /* Fetch all messages directed to owner */
    const { data, error } = await _sb
      .from('messages')
      .select('*')
      .or('recipient.eq.owner,recipient.is.null')
      .order('created_at', { ascending: true });

    if (error) throw error;

    /* Group by sender */
    threadMessages = {};
    (data || []).forEach(msg => {
      const key = msg.username || 'anonymous';
      if (!threadMessages[key]) threadMessages[key] = [];
      threadMessages[key].push(msg);
    });

    allThreadsCache = Object.entries(threadMessages).map(([username, msgs]) => ({
      username,
      last: msgs[msgs.length - 1],
      unread: msgs.filter(m => !m.read_by_owner).length,
      count: msgs.length
    })).sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));

    renderThreadList(allThreadsCache);
    updateUnreadBadge();
    subscribeMessages();

    if (dot) { dot.classList.add('live'); dot.title = 'Real-time connected'; }

  } catch (err) {
    console.error('Thread load error:', err);
    if (dot) dot.title = 'Connection error';
  }
}

function renderThreadList(threads) {
  const el = document.getElementById('thread-list');
  if (!el) return;
  if (!threads.length) {
    el.innerHTML = '<span class="empty-text">No user messages yet.</span>';
    return;
  }
  el.innerHTML = threads.map(t => {
    const init    = initials(t.username);
    const preview = t.last?.text || '…';
    const time    = t.last?.created_at ? new Date(t.last.created_at).toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' }) : '';
    const active  = activeThread === t.username ? 'active' : '';
    return `<div class="thread-item ${active}" onclick="openThread('${escapeAttr(t.username)}')">
      <div class="thread-avatar-sm">${init}</div>
      <div class="thread-body-sm">
        <div class="thread-name-sm">${t.username}</div>
        <div class="thread-preview-sm">${escapeHTML(preview.slice(0, 55))}${preview.length > 55 ? '…' : ''}</div>
      </div>
      <div class="thread-meta-sm">
        <div class="thread-time-sm">${time}</div>
        ${t.unread > 0 ? `<div class="thread-unread">${t.unread}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function openThread(username) {
  activeThread = username;

  /* Show convo panel */
  document.getElementById('chat-empty-state').style.display = 'none';
  document.getElementById('chat-convo').style.display       = 'flex';

  /* Header */
  const init = initials(username);
  document.getElementById('convo-avatar').textContent = init;
  document.getElementById('convo-name').textContent   = username;
  const msgs = threadMessages[username] || [];
  document.getElementById('convo-meta').textContent   = `${msgs.length} message${msgs.length !== 1 ? 's' : ''}`;

  /* Render messages */
  renderConvoMessages(msgs);
  scrollConvo();

  /* Re-highlight thread list */
  document.querySelectorAll('.thread-item').forEach(el => {
    el.classList.toggle('active', el.onclick?.toString().includes(username));
  });
  renderThreadList(allThreadsCache);

  /* Wire up textarea */
  const ta   = document.getElementById('chat-textarea');
  const send = document.getElementById('chat-send-btn');
  ta.oninput = () => {
    send.disabled = ta.value.trim().length === 0;
    document.getElementById('chat-char-count').textContent = `${ta.value.length} / 500`;
  };
  ta.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendOwnerReply('messages'); }
  };
}

function renderConvoMessages(msgs) {
  const inner = document.getElementById('chat-messages-inner');
  if (!inner) return;
  if (!msgs.length) { inner.innerHTML = '<div class="chat-sys-msg">No messages yet.</div>'; return; }
  inner.innerHTML = msgs.map(m => {
    const isOwner = m.username === 'Owner' || m.sender === 'owner';
    const time    = m.created_at ? new Date(m.created_at).toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' }) : '';
    return `<div class="chat-msg-group ${isOwner ? 'outgoing' : 'incoming'}">
      <div class="chat-msg-header">
        <span class="chat-msg-user">${isOwner ? 'You (Owner)' : escapeHTML(m.username || 'User')}</span>
        <span class="chat-msg-time">${time}</span>
      </div>
      <div class="chat-bubble">${escapeHTML(m.text || '')}</div>
    </div>`;
  }).join('');
  scrollConvo();
}

async function sendOwnerReply(context) {
  if (context === 'messages') {
    const ta   = document.getElementById('chat-textarea');
    const text = ta.value.trim();
    if (!text || !activeThread) return;
    ta.value = '';
    document.getElementById('chat-send-btn').disabled = true;
    document.getElementById('chat-char-count').textContent = '0 / 500';

    const { error } = await _sb.from('messages').insert([{
      username:  'Owner',
      text,
      recipient: activeThread,
      sender:    'owner'
    }]);

    if (error) {
      console.error('Send error:', error);
      showToast('Failed to send reply.');
      ta.value = text;
    } else {
      showToast('Reply sent ✓');
    }
  } else if (context === 'guest') {
    sendGuestReply();
  }
}

function filterThreads(type) {
  if (type === 'messages') {
    const q = (document.getElementById('thread-search')?.value || '').toLowerCase();
    const filtered = allThreadsCache.filter(t => t.username.toLowerCase().includes(q));
    renderThreadList(filtered);
  } else {
    const q = (document.getElementById('guest-thread-search')?.value || '').toLowerCase();
    const filtered = allGuestCache.filter(t =>
      (t.guest_name || '').toLowerCase().includes(q) ||
      (t.guest_email || '').toLowerCase().includes(q)
    );
    renderGuestThreadList(filtered);
  }
}

function subscribeMessages() {
  if (realtimeSub) _sb.removeChannel(realtimeSub);

  realtimeSub = _sb.channel('owner-inbox')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const msg = payload.new;
      const key = msg.sender === 'owner' ? msg.recipient : msg.username;
      if (!key) return;
      if (!threadMessages[key]) threadMessages[key] = [];
      threadMessages[key].push(msg);

      /* Update cache */
      const idx = allThreadsCache.findIndex(t => t.username === key);
      if (idx >= 0) {
        allThreadsCache[idx].last   = msg;
        allThreadsCache[idx].count += 1;
        if (msg.sender !== 'owner') allThreadsCache[idx].unread += 1;
      } else {
        allThreadsCache.unshift({ username: key, last: msg, unread: msg.sender !== 'owner' ? 1 : 0, count: 1 });
      }
      allThreadsCache.sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at));

      renderThreadList(allThreadsCache);
      updateUnreadBadge();

      /* If convo is open, append */
      if (activeThread === key) {
        renderConvoMessages(threadMessages[key]);
      }
    })
    .subscribe(status => {
      const dot = document.getElementById('chat-live-dot');
      if (dot) dot.classList.toggle('live', status === 'SUBSCRIBED');
    });
}

function updateUnreadBadge() {
  const total  = allThreadsCache.reduce((s, t) => s + (t.unread || 0), 0);
  const badge  = document.getElementById('unread-badge');
  if (badge) {
    badge.textContent    = total;
    badge.style.display  = total > 0 ? 'inline-flex' : 'none';
  }
}

function scrollConvo() {
  const wrap = document.getElementById('chat-messages-wrap');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

/* ══════════════════════════════════════════
   GUEST SUPPORT
══════════════════════════════════════════ */

let activeGuest     = null;
let guestSub        = null;
let allGuestCache   = [];

async function loadGuestThreads() {
  const dot = document.getElementById('guest-live-dot');
  try {
    const { data, error } = await _sb
      .from('guest_support')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allGuestCache = data || [];
    renderGuestThreadList(allGuestCache);
    updateGuestBadge();
    subscribeGuestSupport();

    if (dot) { dot.classList.add('live'); dot.title = 'Real-time connected'; }

  } catch (err) {
    console.error('Guest support load error:', err);
    const el = document.getElementById('guest-thread-list');
    if (el) el.innerHTML = '<span class="empty-text">Could not load guest tickets. Check if the guest_support table exists.</span>';
  }
}

function renderGuestThreadList(tickets) {
  const el = document.getElementById('guest-thread-list');
  if (!el) return;
  if (!tickets.length) {
    el.innerHTML = '<span class="empty-text">No guest tickets yet.</span>';
    return;
  }
  el.innerHTML = tickets.map(t => {
    const name    = t.guest_name || 'Guest';
    const preview = t.message || '…';
    const time    = t.created_at ? new Date(t.created_at).toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' }) : '';
    const active  = activeGuest === t.id ? 'active' : '';
    const unread  = !t.owner_reply ? 1 : 0;
    return `<div class="thread-item ${active}" onclick="openGuestTicket('${t.id}')">
      <div class="thread-avatar-sm guest-avatar">${initials(name)}</div>
      <div class="thread-body-sm">
        <div class="thread-name-sm">${escapeHTML(name)} <span class="thread-email-tag">${t.guest_email || ''}</span></div>
        <div class="thread-preview-sm">${escapeHTML(preview.slice(0, 55))}${preview.length > 55 ? '…' : ''}</div>
      </div>
      <div class="thread-meta-sm">
        <div class="thread-time-sm">${time}</div>
        ${unread ? `<div class="thread-unread guest-unread">!</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openGuestTicket(id) {
  const ticket = allGuestCache.find(t => t.id == id || t.id === id);
  if (!ticket) return;
  activeGuest = ticket.id;

  document.getElementById('guest-empty-state').style.display  = 'none';
  document.getElementById('guest-chat-convo').style.display   = 'flex';

  const name  = ticket.guest_name || 'Guest';
  document.getElementById('guest-convo-avatar').textContent = initials(name);
  document.getElementById('guest-convo-name').textContent   = name;
  document.getElementById('guest-convo-meta').textContent   = ticket.guest_email || 'No email provided';

  /* Render as conversation */
  const inner = document.getElementById('guest-messages-inner');
  const msgs  = [];
  if (ticket.message) msgs.push({ text: ticket.message, sender: 'guest', name, time: ticket.created_at });
  if (ticket.owner_reply) msgs.push({ text: ticket.owner_reply, sender: 'owner', name: 'You (Owner)', time: ticket.updated_at || ticket.created_at });

  inner.innerHTML = msgs.map(m => {
    const isOwner = m.sender === 'owner';
    const time    = m.time ? new Date(m.time).toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' }) : '';
    return `<div class="chat-msg-group ${isOwner ? 'outgoing' : 'incoming'}">
      <div class="chat-msg-header">
        <span class="chat-msg-user">${escapeHTML(m.name)}</span>
        <span class="chat-msg-time">${time}</span>
      </div>
      <div class="chat-bubble">${escapeHTML(m.text)}</div>
    </div>`;
  }).join('');

  const wrap = document.getElementById('guest-messages-wrap');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;

  renderGuestThreadList(allGuestCache);

  /* Wire textarea */
  const ta   = document.getElementById('guest-textarea');
  const send = document.getElementById('guest-send-btn');
  ta.value   = ticket.owner_reply || '';
  ta.oninput = () => {
    send.disabled = ta.value.trim().length === 0;
    document.getElementById('guest-char-count').textContent = `${ta.value.length} / 500`;
  };
  ta.onkeydown = e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendOwnerReply('guest'); }
  };
  send.disabled = ta.value.trim().length === 0;
}

async function sendGuestReply() {
  if (!activeGuest) return;
  const ta   = document.getElementById('guest-textarea');
  const text = ta.value.trim();
  if (!text) return;

  const { error } = await _sb
    .from('guest_support')
    .update({ owner_reply: text, status: 'Resolved', updated_at: new Date().toISOString() })
    .eq('id', activeGuest);

  if (error) {
    console.error('Guest reply error:', error);
    showToast('Failed to save reply.');
  } else {
    /* Update cache */
    const idx = allGuestCache.findIndex(t => t.id === activeGuest);
    if (idx >= 0) {
      allGuestCache[idx].owner_reply = text;
      allGuestCache[idx].status      = 'Resolved';
    }
    showToast('Reply saved ✓');
    openGuestTicket(activeGuest); /* re-render convo */
  }
}

function subscribeGuestSupport() {
  if (guestSub) _sb.removeChannel(guestSub);
  guestSub = _sb.channel('guest-support-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_support' }, payload => {
      const idx = allGuestCache.findIndex(t => t.id === payload.new?.id);
      if (payload.eventType === 'INSERT') {
        allGuestCache.unshift(payload.new);
      } else if (payload.eventType === 'UPDATE' && idx >= 0) {
        allGuestCache[idx] = payload.new;
      }
      renderGuestThreadList(allGuestCache);
      updateGuestBadge();
      if (activeGuest === payload.new?.id) openGuestTicket(activeGuest);
    })
    .subscribe(status => {
      const dot = document.getElementById('guest-live-dot');
      if (dot) dot.classList.toggle('live', status === 'SUBSCRIBED');
    });
}

function updateGuestBadge() {
  const total = allGuestCache.filter(t => !t.owner_reply).length;
  const badge = document.getElementById('guest-badge');
  if (badge) {
    badge.textContent   = total;
    badge.style.display = total > 0 ? 'inline-flex' : 'none';
  }
}

/* ── UTILITIES ── */
function escapeHTML(str) {
  return String(str || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeAttr(str) {
  return String(str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/* ── Hook into page navigation ── */
const _origGoPage = goPage;
window.goPage = function(name) {
  _origGoPage(name);
  if (name === 'messages')     loadUserThreads();
  if (name === 'guest-support') loadGuestThreads();
};
