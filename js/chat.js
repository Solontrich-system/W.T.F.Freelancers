// ── Chat module ───────────────────────────────────────────
// Three chat types:
//   1. Direct Messages — buyer ↔ seller, keyed by gig_id + both user IDs
//   2. Support         — any user ↔ owner (room: 'support:<user_id>')
// Realtime via Supabase Realtime on 'chat_messages' table.

import { db }    from './db.js';
import { state } from './state.js';
import { showToast } from './utils.js';

// ── State ─────────────────────────────────────────────────
let activeChatRoom    = null;  // { type, room_id, title, other_name }
let chatChannel       = null;  // supabase realtime channel
let typingTimer       = null;
let chatMsgTotal      = 0;

// ── Admin user ID — set your Supabase user UUID here ─────
// Anyone whose user_id matches this gets [ADMIN] badge in support
const ADMIN_USER_ID = 'YOUR_ADMIN_UUID_HERE'; // Replace with your actual UUID

// ── Escape HTML ───────────────────────────────────────────
function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' });
}

// ── Canvas background (NEXUS aesthetic) ──────────────────
function initChatCanvas(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  let W, H, time = 0, raf;

  function resize() {
    W = canvasEl.width  = canvasEl.offsetWidth;
    H = canvasEl.height = canvasEl.offsetHeight;
  }

  function seededRng(seed) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s>>>0)/0xffffffff; };
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    const sp = 55;
    const cols = Math.ceil(W/sp)+1;
    const rows = Math.ceil(H/sp)+1;
    ctx.strokeStyle='rgba(0,255,180,0.05)';
    ctx.lineWidth=1;
    for(let c=0;c<cols;c++){ctx.beginPath();ctx.moveTo(c*sp,0);ctx.lineTo(c*sp,H);ctx.stroke();}
    for(let r=0;r<rows;r++){ctx.beginPath();ctx.moveTo(0,r*sp);ctx.lineTo(W,r*sp);ctx.stroke();}
    const scanY=(time*0.35)%(H+80)-40;
    const g=ctx.createLinearGradient(0,scanY-25,0,scanY+25);
    g.addColorStop(0,'rgba(0,255,180,0)');
    g.addColorStop(.5,'rgba(0,255,180,0.05)');
    g.addColorStop(1,'rgba(0,255,180,0)');
    ctx.fillStyle=g;ctx.fillRect(0,scanY-25,W,50);
    ctx.fillStyle='rgba(0,255,180,0.18)';
    const rng=seededRng(Math.floor(time/45));
    for(let i=0;i<6;i++){
      const cx=Math.floor(rng()*cols)*sp;
      const cy=Math.floor(rng()*rows)*sp;
      ctx.beginPath();ctx.arc(cx,cy,1.5,0,Math.PI*2);ctx.fill();
    }
    time++;
    raf=requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize);
  return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
}

// ── Render Chat Hub page ──────────────────────────────────
export async function renderChatHub() {
  const el = document.getElementById('chat-hub-content');
  if (!el) return;

  if (!state.currentUser) {
    el.innerHTML = `<div class="chat-hub"><div class="chat-empty">
      <div class="chat-empty-icon">🔒</div>
      <p>Please <button class="link-btn" onclick="goPage('login')">log in</button> to access messages.</p>
    </div></div>`;
    return;
  }

  el.innerHTML = `<div class="chat-hub">
    <h2 class="chat-hub-title">Messages</h2>
    <p class="chat-hub-sub">Chat directly with sellers, buyers, or reach out to the W.T.F. team for support.</p>
    <div class="chat-type-grid">
      <div class="chat-type-card" onclick="openSupportChat()">
        <div class="ctc-icon">🛟</div>
        <div class="ctc-title support-card" style="color:var(--amber)">W.T.F. Support</div>
        <div class="ctc-desc">Problems, feedback, billing questions, or anything else — message the W.T.F. team directly. We respond within 24 hours.</div>
        <span class="ctc-badge" style="background:var(--amber-dim);border-color:rgba(245,166,35,.3);color:var(--amber)">DIRECT TO OWNER</span>
      </div>
      <div class="chat-type-card" onclick="goPage('browse')">
        <div class="ctc-icon">💬</div>
        <div class="ctc-title">Seller Chat</div>
        <div class="ctc-desc">Go to any gig and click "Message Seller" to open a private direct message with that freelancer.</div>
        <span class="ctc-badge">PER GIG</span>
      </div>
    </div>
    <div class="section-label">Your conversations</div>
    <div id="chat-dm-list-wrap"><div class="loading-state">Loading conversations…</div></div>
  </div>`;

  loadDMList();
}

async function loadDMList() {
  const wrap = document.getElementById('chat-dm-list-wrap');
  if (!wrap || !state.currentUser) return;

  const { data, error } = await db
    .from('chat_messages')
    .select('room_id, sender_name, text, created_at')
    .or(`sender_id.eq.${state.currentUser.id},receiver_id.eq.${state.currentUser.id}`)
    .order('created_at', { ascending: false });

  if (error) { wrap.innerHTML = '<p class="chat-empty">Could not load conversations.</p>'; return; }

  if (!data || !data.length) {
    wrap.innerHTML = `<div class="chat-empty"><div class="chat-empty-icon">💬</div>
      <p>No conversations yet. Message a seller from any gig page.</p></div>`;
    return;
  }

  // Deduplicate by room_id — keep latest message per room
  const rooms = {};
  data.forEach(m => {
    if (!rooms[m.room_id]) rooms[m.room_id] = m;
  });

  const myDisplay = state.currentProfile?.display_name || state.currentUser.email.split('@')[0];
  const items = Object.values(rooms).map(m => {
    const isSupport = m.room_id.startsWith('support:');
    const name = isSupport ? '🛟 W.T.F. Support' : (m.sender_name === myDisplay ? 'You' : m.sender_name);
    const init = isSupport ? 'S' : (name[0] || '?').toUpperCase();
    return `<div class="chat-dm-item" onclick="openRoomById('${esc(m.room_id)}','${esc(name)}')">
      <div class="chat-dm-avatar">${init}</div>
      <div class="chat-dm-info">
        <div class="chat-dm-name">${esc(name)}</div>
        <div class="chat-dm-preview">${esc(m.text?.slice(0,60) || '')}</div>
      </div>
      <div class="chat-dm-time">${fmtTime(m.created_at)}</div>
    </div>`;
  });

  wrap.innerHTML = `<div class="chat-dm-list">${items.join('')}</div>`;
}

// ── Open Support Chat ─────────────────────────────────────
window.openSupportChat = function() {
  if (!state.currentUser) return showToast('Please log in first.');
  const roomId = `support:${state.currentUser.id}`;
  const myName = state.currentProfile?.display_name || state.currentUser.email.split('@')[0];
  openChatRoom({
    type:       'support',
    room_id:    roomId,
    title:      '🛟 W.T.F. Support',
    other_name: 'W.T.F. Team',
    my_name:    myName,
    isSupport:  true,
  });
};

// ── Open DM with seller from gig ─────────────────────────
export function openSellerChat(gigId, sellerUserId, sellerName) {
  if (!state.currentUser) return (showToast('Please log in to message this seller.'), window.goPage('login'));
  if (!sellerUserId) return showToast('Seller info unavailable.');
  if (state.currentUser.id === sellerUserId) return showToast('That\'s you! You can\'t message yourself.');

  const ids = [state.currentUser.id, sellerUserId].sort();
  const roomId = `dm:${ids[0]}:${ids[1]}:gig:${gigId}`;
  const myName = state.currentProfile?.display_name || state.currentUser.email.split('@')[0];

  openChatRoom({
    type:       'dm',
    room_id:    roomId,
    title:      `💬 ${sellerName}`,
    other_name: sellerName,
    my_name:    myName,
    isSupport:  false,
  });
}
window.openSellerChat = openSellerChat;

// ── Open room by ID (from DM list) ───────────────────────
window.openRoomById = function(roomId, name) {
  if (!state.currentUser) return;
  const myName = state.currentProfile?.display_name || state.currentUser.email.split('@')[0];
  openChatRoom({
    type:       roomId.startsWith('support:') ? 'support' : 'dm',
    room_id:    roomId,
    title:      name,
    other_name: name,
    my_name:    myName,
    isSupport:  roomId.startsWith('support:'),
  });
};

// ── Core: open a chat room ────────────────────────────────
function openChatRoom(opts) {
  activeChatRoom = opts;
  chatMsgTotal   = 0;

  // Build the page
  const page = document.getElementById('page-chat-room');
  page.innerHTML = `
    <canvas class="chat-canvas-bg" id="chat-bg-canvas"></canvas>
    <div class="chat-room-wrap" style="height:calc(100vh - 65px);position:relative;display:flex;flex-direction:column">
      <div class="chat-room-header ${opts.isSupport ? 'support-room' : ''}">
        <div class="crh-left">
          <button class="crh-back" onclick="goPage('chat')">← Back</button>
          <div>
            <div class="crh-room-name">${esc(opts.title)}</div>
          </div>
        </div>
        <div class="crh-right">
          <span class="crh-typing" id="crh-typing" style="display:none"></span>
          <span class="crh-status" id="crh-status">CONNECTING…</span>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages">
        <div class="chat-messages-inner" id="chat-msgs-inner">
          <div class="chat-sys-msg">// SECURE CHANNEL · ${esc(opts.title).toUpperCase()} · END-TO-END RECORDED</div>
        </div>
      </div>
      <div class="chat-input-wrap">
        <div class="chat-input-prefix">▸</div>
        <input class="chat-msg-input" id="chat-msg-input" placeholder="TYPE MESSAGE…" maxlength="500" autocomplete="off" spellcheck="false"/>
        <button class="chat-send-btn" id="chat-send-btn" disabled>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
      <div class="chat-char-count" id="chat-char-count">0 / 500</div>
    </div>`;

  // Navigate to the room page
  window.goPage('chat-room');

  // Init canvas
  const canvasEl = document.getElementById('chat-bg-canvas');
  if (canvasEl) {
    canvasEl.style.position = 'absolute';
    canvasEl.style.inset = '0';
    canvasEl.style.width = '100%';
    canvasEl.style.height = '100%';
    canvasEl.style.pointerEvents = 'none';
    canvasEl.style.zIndex = '0';
    initChatCanvas(canvasEl);
  }

  // Wire input
  const input   = document.getElementById('chat-msg-input');
  const sendBtn = document.getElementById('chat-send-btn');
  const charEl  = document.getElementById('chat-char-count');

  input.addEventListener('input', () => {
    const n = input.value.length;
    charEl.textContent = `${n} / 500`;
    charEl.style.color = n > 450 ? '#ff4560' : '';
    sendBtn.disabled = n === 0;
    broadcastTyping();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
  });
  sendBtn.addEventListener('click', sendChatMessage);
  input.focus();

  // Load history + subscribe
  loadChatHistory();
  subscribeChatRoom();
}

// ── Load history ──────────────────────────────────────────
async function loadChatHistory() {
  const { data, error } = await db
    .from('chat_messages')
    .select('*')
    .eq('room_id', activeChatRoom.room_id)
    .order('created_at', { ascending: true })
    .limit(120);

  if (error) { console.error(error); return; }
  if (!data?.length) return;

  let lastDate = null;
  data.forEach(m => {
    const d = fmtDate(m.created_at);
    if (d !== lastDate) {
      appendDateDivider(d);
      lastDate = d;
    }
    appendChatMsg(m, false);
  });
  scrollChatBottom(false);
}

// ── Realtime subscription ─────────────────────────────────
function subscribeChatRoom() {
  if (chatChannel) db.removeChannel(chatChannel);

  chatChannel = db.channel(`chat:${activeChatRoom.room_id}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${activeChatRoom.room_id}` },
      payload => {
        appendChatMsg(payload.new, true);
        scrollChatBottom(true);
      }
    )
    .on('broadcast', { event: 'typing' }, payload => {
      if (payload.payload?.user !== activeChatRoom.my_name) showTyping(payload.payload?.user);
    })
    .subscribe(status => {
      const el = document.getElementById('crh-status');
      if (!el) return;
      if (status === 'SUBSCRIBED') {
        el.textContent = 'LIVE';
        el.classList.add('live');
      } else if (status === 'CHANNEL_ERROR') {
        el.textContent = 'ERROR';
        el.classList.remove('live');
      }
    });
}

// ── Send message ──────────────────────────────────────────
async function sendChatMessage() {
  const input = document.getElementById('chat-msg-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text || !state.currentUser || !activeChatRoom) return;

  input.value = '';
  document.getElementById('chat-send-btn').disabled = true;
  document.getElementById('chat-char-count').textContent = '0 / 500';

  const isAdmin = state.currentUser.id === ADMIN_USER_ID;

  const { error } = await db.from('chat_messages').insert({
    room_id:       activeChatRoom.room_id,
    sender_id:     state.currentUser.id,
    sender_name:   activeChatRoom.my_name,
    receiver_name: activeChatRoom.other_name,
    text,
    is_admin:      isAdmin,
  });

  if (error) {
    console.error(error);
    showToast('Could not send message. Try again.');
    input.value = text;
  }
  input.focus();
}

// ── Typing broadcast ──────────────────────────────────────
function broadcastTyping() {
  if (!chatChannel) return;
  chatChannel.send({ type: 'broadcast', event: 'typing', payload: { user: activeChatRoom.my_name } });
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => {}, 2000);
}

let typingHideTimer;
function showTyping(name) {
  const el = document.getElementById('crh-typing');
  if (!el) return;
  el.textContent = `${name} is typing…`;
  el.style.display = 'block';
  clearTimeout(typingHideTimer);
  typingHideTimer = setTimeout(() => { el.style.display = 'none'; }, 2500);
}

// ── Append message to UI ──────────────────────────────────
function appendChatMsg(msg, animate) {
  const inner = document.getElementById('chat-msgs-inner');
  if (!inner) return;

  const isMe    = msg.sender_id === state.currentUser?.id;
  const isAdmin = msg.is_admin;

  const div = document.createElement('div');
  div.className = `chat-msg ${isMe ? 'outgoing' : 'incoming'} ${isAdmin && !isMe ? 'admin' : ''}`;
  if (!animate) div.style.animation = 'none';

  div.innerHTML = `
    <div class="chat-msg-header">
      <span class="chat-msg-name">${esc(msg.sender_name)}</span>
      <span class="chat-msg-time">${fmtTime(msg.created_at)}</span>
    </div>
    <div class="chat-msg-bubble">${esc(msg.text)}</div>`;

  inner.appendChild(div);
  chatMsgTotal++;
}

function appendDateDivider(dateStr) {
  const inner = document.getElementById('chat-msgs-inner');
  if (!inner) return;
  const div = document.createElement('div');
  div.className = 'chat-date-divider';
  div.textContent = dateStr;
  inner.appendChild(div);
}

function scrollChatBottom(smooth) {
  const el = document.getElementById('chat-messages');
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
}

// ── Cleanup when leaving chat ─────────────────────────────
export function cleanupChat() {
  if (chatChannel) { db.removeChannel(chatChannel); chatChannel = null; }
  activeChatRoom = null;
}

// ── Admin: view all support rooms (for owner) ─────────────
export async function renderAdminSupport() {
  const el = document.getElementById('admin-support-content');
  if (!el) return;

  if (!state.currentUser || state.currentUser.id !== ADMIN_USER_ID) {
    el.innerHTML = '<p style="padding:28px;color:var(--muted)">Access denied.</p>';
    return;
  }

  const { data, error } = await db
    .from('chat_messages')
    .select('room_id, sender_name, text, created_at')
    .like('room_id', 'support:%')
    .order('created_at', { ascending: false });

  if (error || !data?.length) {
    el.innerHTML = '<p style="padding:28px;color:var(--muted)">No support tickets yet.</p>';
    return;
  }

  const rooms = {};
  data.forEach(m => { if (!rooms[m.room_id]) rooms[m.room_id] = m; });

  el.innerHTML = `<div class="chat-hub" style="padding:28px">
    <h2 class="chat-hub-title">Support Inbox</h2>
    <div class="chat-dm-list">
      ${Object.values(rooms).map(m => `
        <div class="chat-dm-item" onclick="openRoomById('${esc(m.room_id)}','Support: ${esc(m.sender_name)}')">
          <div class="chat-dm-avatar">🛟</div>
          <div class="chat-dm-info">
            <div class="chat-dm-name">${esc(m.sender_name)}</div>
            <div class="chat-dm-preview">${esc(m.text?.slice(0,60)||'')}</div>
          </div>
          <div class="chat-dm-time">${fmtTime(m.created_at)}</div>
        </div>`).join('')}
    </div>
  </div>`;
}
