// ═══════════════════════════════════════════════════════════
// AUTH.JS - Авторизация
// ═══════════════════════════════════════════════════════════

// ── Auth ──
function authTab(t){
  document.querySelectorAll('.auth-seg-btn').forEach((b,i) => b.classList.toggle('active', t==='login'?i===0:i===1));
  G('lf').style.display = t==='login' ? '' : 'none';
  G('rf').style.display = t==='reg' ? '' : 'none';
}
function doLogin(){
  const u=V('lu'), p=V('lp');
  if(!u||!p) return E('le','Заполните все поля');
  socket.emit('login', {username:u, password:p}, r => r.error ? E('le',r.error) : onAuth(r.user));
}
function doReg(){
  const n=V('rn'), u=V('ru'), p=V('rp');
  if(!n||!u||!p) return E('re','Заполните все поля');
  socket.emit('register', {username:u, password:p, displayName:n}, r => r.error ? E('re',r.error) : onAuth(r.user));
}
function onAuth(user){
  me=user;
  G('auth-screen').style.display='none';
  G('app').classList.add('on');
  updMe(); loadUsers();
}
function doLogout(){
  socket.emit('logout');
  me=null; cur=null; currentChat=null; users=[]; hist={}; unread={}; prev={};
  G('app').classList.remove('on');
  G('auth-screen').style.display='flex';
  G('chat-view').style.display='none';
  G('no-chat').style.display='flex';
  closeSett();
}
function G(id){ return document.getElementById(id); }
function V(id){ return G(id).value.trim(); }
function E(id, msg){ G(id).textContent=msg; setTimeout(() => G(id).textContent='', 4000); }

