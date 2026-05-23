// ── Shared utilities ──────────────────────────────────────

let toastTimer;
export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3400);
}
window.showToast = showToast;

export function avatarColor(init = 'AN') {
  const hue = [...init].reduce((n, c) => n + c.charCodeAt(0), 0) % 360;
  return `hsl(${hue},60%,65%)`;
}

export function emptyHTML(icon, heading, sub, btnLabel, btnAction) {
  return `<div class="empty-state">
    <div class="empty-icon">${icon}</div>
    <div class="empty-heading">${heading}</div>
    <div class="empty-sub">${sub}</div>
    ${btnLabel ? `<button class="btn-primary" style="margin-top:18px" onclick="${btnAction}">${btnLabel}</button>` : ''}
  </div>`;
}

export function gigCardHTML(g) {
  const color = avatarColor(g.seller_init || 'WF');
  const stars = g.rating > 0
    ? `<span class="star">★</span> ${g.rating} (${g.review_count})`
    : '<span style="color:var(--amber)">New ✦</span>';
  return `<div class="gig-card" onclick="openGig('${g.id}')" role="button" tabindex="0">
    <div class="gig-thumb">${g.thumb || '🎯'}<span class="gig-badge">${g.category}</span></div>
    <div class="gig-body">
      <div class="seller-row">
        <div class="avatar" style="color:${color};border-color:${color}55">${g.seller_init || '?'}</div>
        <span class="seller-name">${g.seller_name || 'Seller'}</span>
      </div>
      <div class="gig-title">${g.title}</div>
      <div class="gig-footer">
        <div class="gig-rating">${stars}</div>
        <div class="gig-price">$${g.price}</div>
      </div>
    </div>
  </div>`;
}
