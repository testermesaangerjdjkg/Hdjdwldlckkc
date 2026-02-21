// ═══════════════════════════════════════════════════════════
// UTILS.JS - Вспомогательные функции
// ═══════════════════════════════════════════════════════════

function G(id){ return document.getElementById(id); }
function V(id){ return G(id).value.trim(); }
function E(id, msg){ G(id).textContent=msg; setTimeout(() => G(id).textContent='', 4000); }

// ── Me UI ──
function updMe(){
  const n = me.displayName || me.username;
  G('me-nm').textContent = n;
  setAv(G('me-av'), me, '10px');
  G('sett-un').textContent = n;
  G('sett-hn').textContent = '@'+me.username;
  G('sett-nm-sub').textContent = n;
  setAv(G('sett-av'), me, '20px');
  // set privacy selects
  if(me.privacy){
    G('priv-ls').value = me.privacy.lastSeen || 'everyone';
    G('priv-pp').value = me.privacy.profilePhoto || 'everyone';
    G('priv-on').value = me.privacy.online || 'everyone';
  }
}
function setAv(el, user, r='50%'){
  if(!el) return;
  el.style.background = col(user.username);
  el.style.borderRadius = r;
  el.innerHTML = user.avatar
    ? `<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:${r}">`
    : `<span>${ini(user.displayName||user.username)}</span>`;
}
function ini(n){ return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()).join('')||'?'; }
function col(s){ const c=['#4f8ef7','#7c4dff','#e91e8c','#00bcd4','#ff6b35','#2eb872','#ff9800','#9c27b0']; let h=0; for(let ch of s) h=(h*31+ch.charCodeAt(0))%c.length; return c[h]; }
function ft(ts){ const d=new Date(ts),n=new Date(); if(d.toDateString()===n.toDateString()) return d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); if(n-d<7*864e5) return d.toLocaleDateString('ru-RU',{weekday:'short'}); return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}); }
function ftLong(ts){ if(!ts) return 'давно'; const d=new Date(ts),n=new Date(); if(n-d<60000) return 'только что'; if(n-d<3600000) return Math.floor((n-d)/60000)+' мин назад'; if(d.toDateString()===n.toDateString()) return 'сегодня в '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+' в '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fs(s){ return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

