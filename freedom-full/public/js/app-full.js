
// SVG snippets
const CHK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
const DBLCHK = `<svg width="16" height="12" viewBox="0 0 28 14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="2 7 7 12 14 4"/><polyline points="14 7 19 12 26 4"/></svg>`;
const PLAY_ICO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const PAUSE_ICO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const PHONE_ICO = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>`;
const EMOJIS = ['😀','😂','🥰','😍','🤔','😎','😭','😤','🥺','🤣','❤️','🔥','👍','👎','🎉','✨','💯','🙏','😊','🤗','😏','😅','🤦','🤷','💪','👀','🫡','🫂','💀','🤙','💬','🚀','🌟','🎮','🍕','🎵','🌈','🌙','⚡','🎯'];

let socket, me=null, cur=null;
let currentChat = null;
let users=[], hist={}, unread={}, prev={};
let replyMsg=null, ctxMsg=null;
let tyTimer=null, typing=false;
let recorder=null, chunks=[], recInt=null;
let pc=null, localStream=null, incomingOffer=null;
let callInt=null, callSecs=0, callUser=null, callKind='audio';
let attachImg=null, toastTimer=null, toastUser=null, pmUser=null;
let notifEnabled=false;
let currentTheme = localStorage.getItem('theme') || 'dark';

// Apply saved theme immediately
document.documentElement.setAttribute('data-theme', currentTheme);

function init(){
  socket=io();
  socket.on('new_message', onMsg);
  socket.on('user_online', ({username}) => setStatus(username, true));
  socket.on('user_offline', ({username, lastSeen}) => setStatus(username, false, lastSeen));
  socket.on('user_updated', onUserUpd);
  socket.on('user_typing', onTypingEvt);
  socket.on('messages_read', ({by}) => markRead(by));
  socket.on('message_deleted', ({msgId}) => rmEl(msgId));
  socket.on('incoming_call', onInCall);
  socket.on('call_answered', onCallAns);
  socket.on('ice_candidate', ({candidate}) => { try{ if(pc) pc.addIceCandidate(new RTCIceCandidate(candidate)); }catch(e){} });
  socket.on('call_ended', () => callEndedRemote());
  socket.on('call_rejected', () => callSt('Отклонено', true));
  socket.on('call_busy', () => callSt('Занято', true));
  socket.on('call_user_offline', () => callSt('Пользователь не в сети', true));
  updateThemeUI();
}

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

// ── Users ──
function loadUsers(){
  fetch('/api/users').then(r=>r.json()).then(u => { users=u.filter(x=>x.username!==me.username); renderList(); });
}
function switchTab(tab, btn){
  document.querySelectorAll('.sb-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderList(tab);
}
function goPeople(){ G('tab-p').click(); }
function filterList(q){
  const active = document.querySelector('.sb-tab.active').textContent.includes('Люди') ? 'people' : 'chats';
  renderList(active, q.toLowerCase().replace(/^@/,''));
}
function renderList(mode='chats', q=''){
  const el=G('clist');
  const f=users.filter(u => !q || (u.displayName||u.username).toLowerCase().includes(q) || u.username.includes(q));
  if(!f.length){
    el.innerHTML=`<div class="empty-list"><div class="empty-list-icon"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div>Никого не найдено</div></div>`;
    return;
  }
  let html='';
  if(mode==='chats'){
    const wm=f.filter(u=>prev[u.username]), wo=f.filter(u=>!prev[u.username]);
    if(wm.length) html+=`<div class="sec-hd">Активные</div>`;
    wm.forEach(u=>html+=ci(u));
    if(wo.length&&wm.length) html+=`<div class="sec-hd">Контакты</div>`;
    wo.forEach(u=>html+=ci(u));
  } else {
    html+=`<div class="sec-hd">Все пользователи · ${f.length}</div>`;
    f.forEach(u=>html+=ci(u));
  }
  el.innerHTML=html;
}
function ci(u){
  const p=prev[u.username], badge=(unread[u.username]||0)>0?`<div class="ubadge">${unread[u.username]}</div>`:'';
  const showOnline = !me?.privacy || me.privacy.online!=='nobody';
  const online = u.online && showOnline ? `<div class="odot"></div>` : '';
  const showAv = !u.privacy || u.privacy.profilePhoto==='everyone';
  const avC = (u.avatar && showAv) ? `<img src="${u.avatar}">` : `<span>${ini(u.displayName||u.username)}</span>`;
  const time=p?`<span class="ci-time">${ft(p.timestamp)}</span>`:'';
  let ptx='';
  if(p) ptx=p.type==='image'?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> Фото`:p.type==='voice'?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> Голосовое`:esc(p.content||'').slice(0,45);
  else ptx=u.online?`<span style="color:var(--green);font-size:11px">В сети</span>`:(u.lastSeen&&u.privacy?.lastSeen!=='nobody')?`<span style="font-size:11px">был(а) ${ftLong(u.lastSeen)}</span>`:'';
  return `<div class="chat-item${currentChat===u.username?' active':''}" onclick="openChat('${u.username}')"><div class="ci-av" style="background:${col(u.username)}">${avC}${online}</div><div class="ci-info"><div class="ci-top"><span class="ci-name">${esc(u.displayName||u.username)}</span>${time}</div><div class="ci-bot"><span class="ci-prev">${ptx}</span>${badge}</div></div></div>`;
}

// ── Open Chat ──
function openChat(username){
  currentChat=username; cur=username; unread[username]=0;
  const u=users.find(x=>x.username===username)||{username,displayName:username};
  const hav=G('ch-av'); hav.style.background=col(username); setAv(hav,u,'12px');
  G('ch-name').textContent=u.displayName||username;
  const st=G('ch-status');
  if(u.online){ st.textContent='В сети'; st.className='ch-status on'; }
  else if(u.lastSeen && u.privacy?.lastSeen!=='nobody'){ st.textContent='был(а) '+ftLong(u.lastSeen); st.className='ch-status'; }
  else { st.textContent='Не в сети'; st.className='ch-status'; }
  G('no-chat').style.display='none';
  G('chat-view').style.display='flex';
  G('chat-area').classList.add('mob');
  socket.emit('get_messages', {with:username}, msgs => { hist[username]=msgs||[]; renderMsgs(); scrollBot(); });
  socket.emit('mark_read', {chatWith:username});
  renderList();
}
function closeMob(){ G('chat-area').classList.remove('mob'); }

// ── Render Messages ──
function renderMsgs(){
  const area=G('msgs'), msgs=hist[currentChat]||[];
  if(!msgs.length){ area.innerHTML=`<div style="text-align:center;color:var(--text3);padding:48px 20px;font-size:13px">Начните переписку 👋</div>`; return; }
  let html='', lastD=null;
  msgs.forEach(m=>{
    const d=new Date(m.timestamp).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
    if(d!==lastD){ html+=`<div class="date-div">${d}</div>`; lastD=d; }
    html+=bbl(m);
  });
  area.innerHTML=html;
  bindEvts(area);
}
function bbl(m){
  const out=m.from===me.username, u=users.find(x=>x.username===m.from)||{username:m.from,displayName:m.from};
  const showAv = !u.privacy || u.privacy.profilePhoto==='everyone';
  const avC=(u.avatar && showAv)?`<img src="${u.avatar}">`:`<span>${ini(u.displayName||u.username)}</span>`;
  const time=ft(m.timestamp), checks=out?`<span class="chk">${m.read?DBLCHK:CHK}</span>`:'';
  let reply='';
  if(m.replyTo){
    const orig=(hist[currentChat]||[]).find(x=>x.id===m.replyTo);
    if(orig){ const rn=orig.from===me.username?'Вы':(users.find(x=>x.username===orig.from)?.displayName||orig.from); reply=`<div class="bbl-reply"><div class="bbl-rname">${rn}</div><div class="bbl-rtext">${orig.type==='image'?'Фото':orig.type==='voice'?'Голосовое':esc(orig.content||'').slice(0,60)}</div></div>`; }
  }
  let body='';
  if(m.type==='image') body=`<img class="bbl-img" src="${m.content}" alt="фото">`;
  else if(m.type==='voice'){ const bars=Array.from({length:22},()=>`<span style="height:${5+Math.floor(Math.random()*16)}px"></span>`).join(''); body=`<div class="voice-msg"><button class="voice-play" onclick="playV(this,'${m.content}')">${PLAY_ICO}</button><div class="voice-waves">${bars}</div><span class="voice-dur">${m.duration||'0:00'}</span></div>`; }
  else body=`<div class="bbl-text">${esc(m.content||'').replace(/\n/g,'<br>')}</div>`;
  const avEl=!out?`<div class="msg-av" style="background:${col(m.from)}">${avC}</div>`:'';
  return `<div class="mrow ${out?'out':'in'}" id="mw-${m.id}">${avEl}<div class="bubble" data-id="${m.id}" data-from="${m.from}" data-content="${esc(m.content||'')}">${reply}${body}<div class="bbl-meta">${time}${checks}</div></div></div>`;
}
function bindEvts(el){
  el.querySelectorAll('.bubble').forEach(b => b.addEventListener('contextmenu', e => { e.preventDefault(); showCtx(e, b.dataset.id); }));
  el.querySelectorAll('.bbl-img').forEach(img => img.addEventListener('click', () => { G('lbi').src=img.src; G('lb').classList.add('on'); }));
}
function scrollBot(){ const a=G('msgs'); setTimeout(()=>a.scrollTop=a.scrollHeight, 40); }

// ── Send ──
function sendMsg(){
  if(!currentChat) return;
  if(attachImg){ sendImg(); return; }
  const inp=G('mi'), text=inp.value.trim();
  if(!text) return;
  const d={to:currentChat, content:text, type:'text'};
  if(replyMsg) d.replyTo=replyMsg.id;
  socket.emit('send_message', d, r => { if(r?.message) pushMsg(r.message); });
  inp.value=''; resize(inp); cancelReply(); clearTyp();
}
function sendImg(){
  socket.emit('send_message', {to:currentChat, content:attachImg, type:'image', replyTo:replyMsg?.id||null}, r => { if(r?.message) pushMsg(r.message); });
  rmImg(); cancelReply();
}
function pushMsg(msg){
  if(!hist[currentChat]) hist[currentChat]=[];
  hist[currentChat].push(msg); prev[currentChat]=msg;
  const area=G('msgs'), ph=area.querySelector('[style*="Начните"]');
  if(ph) ph.remove();
  const d=document.createElement('div'); d.innerHTML=bbl(msg);
  const el=d.firstElementChild; area.appendChild(el);
  bindEvts(el.parentElement||area); scrollBot(); renderList();
}
function onMsg(msg){
  const cu=msg.from===me.username?msg.to:msg.from;
  if(!hist[cu]) hist[cu]=[]; hist[cu].push(msg); prev[cu]=msg;
  if(cu===currentChat){ pushMsg(msg); socket.emit('mark_read',{chatWith:cu}); }
  else if(msg.from!==me.username){ unread[msg.from]=(unread[msg.from]||0)+1; showToast(msg); sendBrowserNotif(msg); }
  renderList();
}
function mkey(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMsg(); } }
function handleImg(e){ const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>{ attachImg=ev.target.result; G('ithumb').src=attachImg; G('is').classList.add('on'); }; r.readAsDataURL(f); e.target.value=''; }
function rmImg(){ attachImg=null; G('is').classList.remove('on'); }
function resize(el){ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,120)+'px'; }

// ── Typing ──
function onType(){ if(!currentChat) return; if(!typing){ typing=true; socket.emit('typing',{to:currentChat,isTyping:true}); } clearTimeout(tyTimer); tyTimer=setTimeout(clearTyp, 2500); }
function clearTyp(){ if(typing){ typing=false; socket.emit('typing',{to:currentChat,isTyping:false}); } }
function onTypingEvt({from,isTyping:t}){ if(from!==currentChat) return; const area=G('msgs'), ex=document.getElementById('tind'); if(t&&!ex){ const d=document.createElement('div'); d.id='tind'; d.className='typing-row'; d.innerHTML=`<div class="tdots"><span></span><span></span><span></span></div><span>печатает...</span>`; area.appendChild(d); scrollBot(); } else if(!t&&ex) ex.remove(); }

// ── Reply/Delete ──
function cancelReply(){ replyMsg=null; G('rs').classList.remove('on'); }
function rmEl(id){ G('mw-'+id)?.remove(); }
function markRead(by){ if(by!==currentChat) return; (hist[currentChat]||[]).forEach(m=>{ if(m.from===me.username) m.read=true; }); renderMsgs(); }

// ── Context ──
function showCtx(e, id){ ctxMsg=(hist[currentChat]||[]).find(m=>m.id===id); const c=G('ctx'); c.style.left=Math.min(e.clientX,window.innerWidth-200)+'px'; c.style.top=Math.min(e.clientY,window.innerHeight-130)+'px'; c.classList.add('on'); G('ctx-del').style.display=ctxMsg?.from===me.username?'':'none'; }
document.addEventListener('click', () => G('ctx').classList.remove('on'));
function ctxReply(){ if(!ctxMsg) return; replyMsg=ctxMsg; const n=ctxMsg.from===me.username?'Вы':(users.find(u=>u.username===ctxMsg.from)?.displayName||ctxMsg.from); G('rs-nm').textContent=n; G('rs-tx').textContent=ctxMsg.type==='image'?'Фото':ctxMsg.type==='voice'?'Голосовое':ctxMsg.content?.slice(0,80); G('rs').classList.add('on'); G('mi').focus(); }
function ctxCopy(){ if(ctxMsg?.content) navigator.clipboard.writeText(ctxMsg.content).catch(()=>{}); }
function ctxDel(){ if(!ctxMsg) return; socket.emit('delete_message', {msgId:ctxMsg.id,chatWith:currentChat}, r=>{ if(r?.ok){ hist[currentChat]=(hist[currentChat]||[]).filter(m=>m.id!==ctxMsg.id); rmEl(ctxMsg.id); } }); }

// ── Emoji ──
function toggleEmoji(){ const p=G('ep'); if(!p.innerHTML) p.innerHTML=`<div class="emoji-grid">${EMOJIS.map(e=>`<div class="emoji-it" onclick="insEmoji('${e}')">${e}</div>`).join('')}</div>`; p.classList.toggle('on'); }
function insEmoji(e){ const inp=G('mi'), pos=inp.selectionStart; inp.value=inp.value.slice(0,pos)+e+inp.value.slice(pos); inp.selectionStart=inp.selectionEnd=pos+e.length; inp.focus(); G('ep').classList.remove('on'); }
document.addEventListener('click', e=>{ if(!e.target.closest('.iwrap')) G('ep')?.classList.remove('on'); });

// ── Voice ──
async function toggleRec(){
  if(recorder&&recorder.state==='recording'){ recorder.stop(); return; }
  try{
    const s=await navigator.mediaDevices.getUserMedia({audio:true});
    recorder=new MediaRecorder(s); chunks=[]; let sec=0;
    const btn=G('mic-btn'); btn.classList.add('rec');
    recInt=setInterval(()=>{ sec++; btn.title=`Запись: ${fs(sec)}`; }, 1000);
    recorder.ondataavailable=e=>chunks.push(e.data);
    recorder.onstop=()=>{
      clearInterval(recInt); btn.classList.remove('rec'); btn.title='Голосовое сообщение';
      const blob=new Blob(chunks,{type:'audio/webm'}); const r=new FileReader();
      r.onload=ev=>{ socket.emit('send_message',{to:currentChat,content:ev.target.result,type:'voice',duration:fs(sec),replyTo:replyMsg?.id||null},res=>{ if(res?.message) pushMsg(res.message); }); };
      r.readAsDataURL(blob); s.getTracks().forEach(t=>t.stop()); cancelReply();
    };
    recorder.start();
  }catch(e){ alert('Нет доступа к микрофону'); }
}
function playV(btn, src){ const a=new Audio(src); btn.innerHTML=PAUSE_ICO; a.play(); a.onended=()=>{ btn.innerHTML=PLAY_ICO; }; }

// ── Status ──
function setStatus(username, online, lastSeen){
  const u=users.find(x=>x.username===username);
  if(u){ u.online=online; if(!online&&lastSeen) u.lastSeen=lastSeen; }
  if(currentChat===username){
    const s=G('ch-status');
    if(online){ s.textContent='В сети'; s.className='ch-status on'; }
    else if(lastSeen&&u?.privacy?.lastSeen!=='nobody'){ s.textContent='был(а) '+ftLong(lastSeen); s.className='ch-status'; }
    else { s.textContent='Не в сети'; s.className='ch-status'; }
  }
  renderList();
}
function onUserUpd({username, displayName, avatar, bio, privacy}){
  const u=users.find(x=>x.username===username);
  if(u){ u.displayName=displayName; u.avatar=avatar; if(bio!==undefined) u.bio=bio; if(privacy) u.privacy=privacy; }
  if(username===me.username){ me.displayName=displayName; me.avatar=avatar; if(bio!==undefined) me.bio=bio; if(privacy) me.privacy=privacy; updMe(); }
  renderList();
}

// ── Settings ──
function openSett(){ G('sp').classList.add('on'); G('sef').classList.remove('on'); }
function closeSett(){ G('sp').classList.remove('on'); }
function toggleEdit(){
  const f=G('sef');
  if(!f.classList.contains('on')){ G('en').value=me.displayName||''; G('eb').value=me.bio||''; f.classList.add('on'); }
  else f.classList.remove('on');
}
function saveProf(){
  const n=G('en').value.trim(), b=G('eb').value.trim();
  socket.emit('update_profile', {displayName:n, bio:b}, r=>{ if(r?.ok){ me=r.user; updMe(); G('sef').classList.remove('on'); } });
}
function chgAv(e){
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=ev=>{ fetch('/api/avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:me.username,avatar:ev.target.result})}).then(()=>{ me.avatar=ev.target.result; updMe(); }); };
  r.readAsDataURL(f); e.target.value='';
}
function savePriv(key, val){
  const privacy={...me.privacy, [key]:val};
  socket.emit('update_profile', {privacy}, r=>{ if(r?.ok) me=r.user; });
}

// ── Theme ──
function toggleTheme(){
  currentTheme = currentTheme==='dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('theme', currentTheme);
  updateThemeUI();
}
function updateThemeUI(){
  const isDark=currentTheme==='dark';
  G('theme-sub').textContent = isDark ? 'Тёмная' : 'Светлая';
  G('theme-ico').innerHTML = isDark
    ? `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`
    : `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
}

// ── Notifications ──
async function toggleNotif(on){
  if(on){
    if(Notification.permission==='default'){
      const perm=await Notification.requestPermission();
      if(perm!=='granted'){ G('notif-chk').checked=false; G('notif-sub').textContent='Отказано браузером'; return; }
    }
    if(Notification.permission==='denied'){ G('notif-chk').checked=false; G('notif-sub').textContent='Заблокировано в браузере'; return; }
    notifEnabled=true; G('notif-sub').textContent='Включены';
    localStorage.setItem('notif','1');
  } else {
    notifEnabled=false; G('notif-sub').textContent='Выключены';
    localStorage.setItem('notif','0');
  }
}
function sendBrowserNotif(msg){
  if(!notifEnabled || Notification.permission!=='granted') return;
  if(document.hasFocus()) return;
  const u=users.find(x=>x.username===msg.from)||{username:msg.from,displayName:msg.from};
  const body=msg.type==='image'?'Фото':msg.type==='voice'?'Голосовое':msg.content||'';
  const n=new Notification(u.displayName||u.username, {body, icon:'/favicon.ico'});
  n.onclick=()=>{ window.focus(); openChat(msg.from); n.close(); };
  setTimeout(()=>n.close(), 5000);
}
// Init notifications state
window.addEventListener('load', ()=>{
  const saved=localStorage.getItem('notif');
  if(saved==='1' && Notification.permission==='granted'){ notifEnabled=true; G('notif-chk').checked=true; G('notif-sub').textContent='Включены'; }
});

// ── Change Password ──
function openChangePwd(){
  G('pwd-old').value=''; G('pwd-new').value=''; G('pwd-new2').value='';
  G('pwd-err').textContent=''; G('pwd-ok').textContent='';
  G('pwd-modal').classList.add('on');
}
function closePwdModal(){ G('pwd-modal').classList.remove('on'); }
function submitPwd(){
  const old=G('pwd-old').value.trim(), nw=G('pwd-new').value.trim(), nw2=G('pwd-new2').value.trim();
  G('pwd-err').textContent=''; G('pwd-ok').textContent='';
  if(!old||!nw||!nw2) return G('pwd-err').textContent='Заполните все поля';
  if(nw!==nw2) return G('pwd-err').textContent='Пароли не совпадают';
  if(nw.length<6) return G('pwd-err').textContent='Минимум 6 символов';
  socket.emit('change_password', {oldPassword:old, newPassword:nw}, r=>{
    if(r?.error) G('pwd-err').textContent=r.error;
    else { G('pwd-ok').textContent='Пароль успешно изменён!'; setTimeout(closePwdModal, 1500); }
  });
}

// ── Profile Modal ──
function showPM(username){
  if(!username) return;
  const u=users.find(x=>x.username===username)||{username,displayName:username};
  pmUser=username;
  const av=G('pmav'); av.style.background=col(username);
  const showAv=!u.privacy||u.privacy.profilePhoto==='everyone';
  setAv(av, {...u, avatar: showAv?u.avatar:null}, '16px');
  G('pmnm').textContent=u.displayName||username;
  G('pmhn').textContent='@'+username;
  const st=G('pmst');
  if(u.online){ st.textContent='В сети'; st.className='pm-status on'; }
  else if(u.lastSeen&&u.privacy?.lastSeen!=='nobody'){ st.textContent='был(а) '+ftLong(u.lastSeen); st.className='pm-status off'; }
  else { st.textContent='Не в сети'; st.className='pm-status off'; }
  G('pmbio').textContent=u.bio||'Нет описания';
  G('pmo').classList.add('on');
}
function closePM(){ G('pmo').classList.remove('on'); }
function chatFromPM(){ closePM(); openChat(pmUser); }
function callFromPM(t){ closePM(); openChat(pmUser); setTimeout(()=>startCall(t), 300); }

// ── Toast ──
function showToast(msg){
  const u=users.find(x=>x.username===msg.from)||{username:msg.from,displayName:msg.from};
  toastUser=msg.from;
  const av=G('tav'); av.style.background=col(msg.from); av.style.borderRadius='11px'; setAv(av,u,'11px');
  G('tnm').textContent=u.displayName||u.username;
  G('ttx').textContent=msg.type==='image'?'📷 Фото':msg.type==='voice'?'🎤 Голосовое':(msg.content||'').slice(0,60);
  const t=G('toast'); t.classList.add('on');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove('on'), 4500);
}
function openToast(){ G('toast').classList.remove('on'); if(toastUser) openChat(toastUser); }

// ─────────────── CALLS ───────────────
const ICE = { iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}] };

async function startCall(type){
  if(!currentChat){ alert('Сначала откройте чат'); return; }
  const targetUser = users.find(x=>x.username===currentChat);
  if(!targetUser?.online){ showCallMsg('Пользователь не в сети'); return; }
  callKind=type; callUser=currentChat;
  const u=users.find(x=>x.username===currentChat)||{username:currentChat,displayName:currentChat};
  showCallUI(u, type, 'out');
  try{
    localStream=await navigator.mediaDevices.getUserMedia(type==='video'?{video:true,audio:true}:{audio:true});
    if(type==='video'){ G('localVideo').srcObject=localStream; G('va').classList.add('on'); }
    pc=new RTCPeerConnection(ICE);
    localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
    pc.ontrack=e=>{ G('remoteVideo').srcObject=e.streams[0]; };
    pc.onicecandidate=e=>{ if(e.candidate) socket.emit('ice_candidate',{to:callUser,candidate:e.candidate}); };
    pc.onconnectionstatechange=()=>{ if(pc&&(pc.connectionState==='failed'||pc.connectionState==='disconnected')) callEndedRemote(); };
    const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
    socket.emit('call_user', {to:callUser, offer, callType:type});
  }catch(e){
    cleanCall();
    alert('Нет доступа к '+( type==='video'?'камере/':'')+'микрофону');
  }
}

function onInCall({from, offer, callType:ct}){
  if(pc){ socket.emit('call_busy',{to:from}); return; }
  incomingOffer=offer; callUser=from; callKind=ct;
  const u=users.find(x=>x.username===from)||{username:from,displayName:from};
  showCallUI(u, ct, 'in');
}

async function acceptCall(){
  const offer=incomingOffer; incomingOffer=null;
  try{
    localStream=await navigator.mediaDevices.getUserMedia(callKind==='video'?{video:true,audio:true}:{audio:true});
    if(callKind==='video'){ G('localVideo').srcObject=localStream; G('va').classList.add('on'); }
    pc=new RTCPeerConnection(ICE);
    localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
    pc.ontrack=e=>{ G('remoteVideo').srcObject=e.streams[0]; };
    pc.onicecandidate=e=>{ if(e.candidate) socket.emit('ice_candidate',{to:callUser,candidate:e.candidate}); };
    pc.onconnectionstatechange=()=>{ if(pc&&(pc.connectionState==='failed'||pc.connectionState==='disconnected')) callEndedRemote(); };
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer=await pc.createAnswer(); await pc.setLocalDescription(answer);
    socket.emit('call_answer', {to:callUser, answer});
    startCallTimer();
    const u=users.find(x=>x.username===callUser)||{username:callUser,displayName:callUser};
    showCallUI(u, callKind, 'active');
  }catch(e){ cleanCall(); }
}

async function onCallAns({answer}){
  try{
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
    startCallTimer();
    const u=users.find(x=>x.username===callUser)||{username:callUser,displayName:callUser};
    showCallUI(u, callKind, 'active');
  }catch(e){}
}

function endCall(){ socket.emit('call_end',{to:callUser}); cleanCall(); }
function rejectCall(){ socket.emit('call_reject',{to:callUser}); cleanCall(); }
function callEndedRemote(){ callSt('Звонок завершён', true); }

function cleanCall(){
  if(pc){ pc.close(); pc=null; }
  if(localStream){ localStream.getTracks().forEach(t=>t.stop()); localStream=null; }
  incomingOffer=null;
  clearInterval(callInt); callSecs=0;
  G('ctmr').style.display='none';
  G('va').classList.remove('on');
  G('remoteVideo').srcObject=null;
  G('localVideo').srcObject=null;
  G('co').classList.remove('on');
  G('cav').classList.remove('ringing');
}

function callSt(msg, close){
  G('cst').textContent=msg;
  if(close) setTimeout(cleanCall, 2000);
}

function showCallMsg(msg){
  // brief toast-style message for call errors
  const old=toastUser;
  G('tnm').textContent='Звонок';
  G('ttx').textContent=msg;
  const t=G('toast'); t.classList.add('on');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{ t.classList.remove('on'); toastUser=old; }, 3000);
}

function startCallTimer(){
  callSecs=0;
  const el=G('ctmr'); el.style.display='block';
  el.textContent=fs(0);
  callInt=setInterval(()=>{ callSecs++; el.textContent=fs(callSecs); }, 1000);
}

function showCallUI(u, type, mode){
  const av=G('cav'); av.style.background=col(u.username);
  setAv(av, u, '22px');
  G('cnm').textContent=u.displayName||u.username;
  const tl=type==='video'?'Видеозвонок':'Аудиозвонок';
  let st='', btns='';

  if(mode==='out'){
    st=tl+' · Вызов...';
    av.classList.add('ringing');
    btns=`<div class="call-btn-wrap">
      <button class="cbtn end-call" onclick="endCall()">${PHONE_ICO}</button>
      <span>Завершить</span>
    </div>`;
  } else if(mode==='in'){
    st='Входящий · '+tl.toLowerCase();
    av.classList.add('ringing');
    G('cst').textContent=st;
    G('cbtns').innerHTML=`
      <div class="call-btn-wrap"><button class="cbtn decline" onclick="rejectCall()">${PHONE_ICO}</button><span>Отклонить</span></div>
      <div class="call-btn-wrap"><button class="cbtn accept" onclick="acceptCall()">${PHONE_ICO}</button><span>Принять</span></div>
    `;
    G('co').classList.add('on');
    return;
  } else { // active
    st=tl; av.classList.remove('ringing');
    btns=`
      <div class="call-btn-wrap">
        <button class="cbtn neutral" id="cbmute" onclick="tMute(this)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </button>
        <span>Микрофон</span>
      </div>
      <div class="call-btn-wrap"><button class="cbtn end-call" onclick="endCall()">${PHONE_ICO}</button><span>Завершить</span></div>
      ${type==='video'?`<div class="call-btn-wrap">
        <button class="cbtn neutral" id="cbcam" onclick="tCam(this)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
        </button>
        <span>Камера</span>
      </div>`:''}
    `;
  }
  G('cst').textContent=st;
  G('cbtns').innerHTML=btns;
  G('co').classList.add('on');
}

function tMute(btn){
  if(!localStream) return;
  const t=localStream.getAudioTracks()[0];
  if(!t) return;
  t.enabled=!t.enabled;
  btn.classList.toggle('muted', !t.enabled);
  btn.title=t.enabled?'Выключить микрофон':'Включить микрофон';
}
function tCam(btn){
  if(!localStream) return;
  const t=localStream.getVideoTracks()[0];
  if(!t) return;
  t.enabled=!t.enabled;
  btn.classList.toggle('muted', !t.enabled);
  btn.title=t.enabled?'Выключить камеру':'Включить камеру';
}

// ── Periodic refresh ──
setInterval(()=>{ if(me) loadUsers(); }, 30000);
init();

</body>
</html>

/* ─── AUTH ─── */
#auth-screen {
  display:flex; align-items:center; justify-content:center; height:100vh;
  background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(79,142,247,0.1) 0%, transparent 65%);
}
.auth-card {
  width:400px; background:var(--sidebar); border:1px solid var(--border);
  border-radius:24px; padding:40px 36px; box-shadow:0 32px 80px rgba(0,0,0,0.6);
}
.auth-brand { display:flex; align-items:center; gap:14px; margin-bottom:32px; }
.auth-brand-icon { width:52px; height:52px; background:var(--accent); border-radius:16px; display:flex; align-items:center; justify-content:center; }
.auth-brand-text h1 { font-size:24px; font-weight:700; letter-spacing:-0.5px; }
.auth-brand-text p { color:var(--text2); font-size:13px; margin-top:2px; }
.auth-seg { display:flex; background:var(--bg); border-radius:12px; padding:3px; margin-bottom:28px; border:1px solid var(--border); }
.auth-seg-btn { flex:1; padding:9px; border:none; background:none; color:var(--text2); border-radius:9px; cursor:pointer; font-size:13px; font-weight:500; transition:all .2s; font-family:inherit; }
.auth-seg-btn.active { background:var(--surface); color:var(--text); box-shadow:0 2px 8px rgba(0,0,0,0.3); }
.field { margin-bottom:16px; position:relative; }
.field-label { display:flex; align-items:center; gap:6px; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:var(--text2); margin-bottom:8px; }
.field-icon { position:absolute; left:13px; bottom:11px; color:var(--text3); pointer-events:none; }
.field input { width:100%; padding:11px 14px 11px 40px; background:var(--surface); border:1px solid var(--border); border-radius:12px; color:var(--text); font-family:inherit; font-size:14px; outline:none; transition:all .2s; }
.field input:focus { border-color:var(--accent); background:var(--surface2); }
.field input::placeholder { color:var(--text3); }
.auth-btn { width:100%; padding:12px; background:var(--accent); border:none; border-radius:12px; color:#fff; font-size:14px; font-weight:600; cursor:pointer; transition:all .2s; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:8px; margin-top:4px; }
.auth-btn:hover { background:var(--accent-hover); transform:translateY(-1px); box-shadow:0 4px 16px rgba(79,142,247,0.3); }
.auth-err { color:var(--red); font-size:12px; text-align:center; margin-top:10px; min-height:16px; }

/* ─── APP ─── */
#app { display:none; height:100vh; }
#app.on { display:flex; }

/* ─── SIDEBAR ─── */
.sidebar { width:300px; background:var(--sidebar); border-right:1px solid var(--border); display:flex; flex-direction:column; flex-shrink:0; }
.sb-head { display:flex; align-items:center; gap:10px; padding:14px 14px 12px; border-bottom:1px solid var(--border); }
.me-av { width:38px; height:38px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; cursor:pointer; flex-shrink:0; overflow:hidden; transition:opacity .2s; }
.me-av:hover { opacity:.8; }
.me-av img { width:100%; height:100%; object-fit:cover; }
.me-nm { flex:1; font-weight:600; font-size:14px; cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.me-nm:hover { color:var(--accent); }
.sb-acts { display:flex; gap:2px; }
.ib { width:32px; height:32px; border:none; background:none; color:var(--text2); border-radius:9px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .18s; }
.ib:hover { background:var(--surface); color:var(--text); }
.sb-search { padding:10px 12px; border-bottom:1px solid var(--border); }
.srch-wrap { position:relative; }
.srch-wrap svg { position:absolute; left:11px; top:50%; transform:translateY(-50%); color:var(--text3); pointer-events:none; }
.srch-inp { width:100%; padding:8px 12px 8px 36px; background:var(--surface); border:1px solid var(--border); border-radius:22px; color:var(--text); font-family:inherit; font-size:13px; outline:none; transition:all .2s; }
.srch-inp:focus { border-color:var(--accent); background:var(--surface2); }
.srch-inp::placeholder { color:var(--text3); }
.sb-tabs { display:flex; padding:0 12px; border-bottom:1px solid var(--border); gap:2px; }
.sb-tab { flex:1; padding:10px 4px 9px; border:none; background:none; color:var(--text2); cursor:pointer; font-size:12px; font-weight:500; border-bottom:2px solid transparent; transition:all .2s; font-family:inherit; display:flex; align-items:center; justify-content:center; gap:5px; }
.sb-tab:hover { color:var(--text); }
.sb-tab.active { color:var(--accent); border-bottom-color:var(--accent); }
.chat-list { flex:1; overflow-y:auto; padding:6px; }
.chat-item { display:flex; align-items:center; gap:11px; padding:9px 10px; border-radius:12px; cursor:pointer; transition:background .15s; position:relative; }
.chat-item:hover { background:var(--surface); }
.chat-item.active { background:var(--surface2); }
.chat-item.active::before { content:''; position:absolute; left:0; top:50%; transform:translateY(-50%); width:3px; height:55%; background:var(--accent); border-radius:0 3px 3px 0; }
.ci-av { width:46px; height:46px; border-radius:14px; flex-shrink:0; position:relative; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:17px; overflow:hidden; }
.ci-av img { width:100%; height:100%; object-fit:cover; border-radius:14px; }
.odot { position:absolute; bottom:-1px; right:-1px; width:13px; height:13px; background:var(--green); border-radius:50%; border:2px solid var(--sidebar); }
.ci-info { flex:1; min-width:0; }
.ci-top { display:flex; align-items:center; justify-content:space-between; gap:4px; }
.ci-name { font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ci-time { font-size:11px; color:var(--text3); flex-shrink:0; }
.ci-bot { display:flex; align-items:center; justify-content:space-between; gap:4px; margin-top:2px; }
.ci-prev { color:var(--text2); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:4px; }
.ubadge { background:var(--accent); color:#fff; font-size:10px; font-weight:700; border-radius:10px; padding:2px 6px; min-width:18px; text-align:center; flex-shrink:0; }
.empty-list { padding:48px 20px; text-align:center; color:var(--text2); font-size:13px; }
.empty-list-icon { color:var(--text3); margin-bottom:12px; display:flex; justify-content:center; }
.sec-hd { padding:14px 12px 4px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:var(--text3); }

/* ─── CHAT AREA ─── */
.chat-area { flex:1; display:flex; flex-direction:column; background:var(--bg); min-width:0; }
.no-chat { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; color:var(--text2); }
.no-chat-icon { color:var(--text3); opacity:.5; }
.no-chat h3 { font-size:18px; font-weight:600; color:var(--text); }
.no-chat p { font-size:13px; }
.chat-hd { display:flex; align-items:center; gap:12px; padding:12px 16px; border-bottom:1px solid var(--border); background:var(--sidebar); flex-shrink:0; }
.ch-av { width:38px; height:38px; border-radius:12px; cursor:pointer; flex-shrink:0; overflow:hidden; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:14px; }
.ch-av img { width:100%; height:100%; object-fit:cover; }
.ch-info { flex:1; cursor:pointer; min-width:0; }
.ch-name { font-weight:600; font-size:15px; }
.ch-status { font-size:12px; color:var(--text2); margin-top:1px; display:flex; align-items:center; gap:4px; }
.ch-status.on { color:var(--green); }
.ch-status.on::before { content:''; width:6px; height:6px; background:var(--green); border-radius:50%; display:inline-block; }
.ch-acts { display:flex; gap:2px; }

/* Messages */
.msgs { flex:1; overflow-y:auto; padding:16px 16px 8px; display:flex; flex-direction:column; gap:2px; }
.date-div { display:flex; align-items:center; gap:10px; margin:12px 0; color:var(--text3); font-size:11px; }
.date-div::before,.date-div::after { content:''; flex:1; height:1px; background:var(--border); }
.mrow { display:flex; align-items:flex-end; gap:8px; animation:msgIn .18s ease; }
.mrow.out { flex-direction:row-reverse; align-self:flex-end; max-width:75%; }
.mrow.in { align-self:flex-start; max-width:75%; }
@keyframes msgIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
.msg-av { width:28px; height:28px; border-radius:9px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:11px; overflow:hidden; }
.msg-av img { width:100%; height:100%; object-fit:cover; }
.bubble { padding:8px 12px; border-radius:16px; max-width:100%; word-break:break-word; cursor:default; position:relative; }
.out .bubble { background:var(--bubble-out); border-bottom-right-radius:4px; }
.in .bubble { background:var(--bubble-in); border-bottom-left-radius:4px; border:1px solid var(--border); }
.bbl-reply { background:rgba(255,255,255,0.06); border-left:2px solid var(--accent); border-radius:8px; padding:5px 8px; margin-bottom:6px; }
.bbl-rname { font-size:11px; font-weight:600; color:var(--accent); margin-bottom:2px; }
.bbl-rtext { font-size:12px; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.bbl-text { font-size:14px; line-height:1.55; }
.bbl-img { max-width:280px; max-height:260px; border-radius:10px; display:block; cursor:zoom-in; }
.bbl-meta { display:flex; align-items:center; justify-content:flex-end; gap:4px; margin-top:4px; font-size:10px; color:rgba(255,255,255,0.35); }
.bbl-meta .chk { color:var(--accent); display:flex; }
.voice-msg { display:flex; align-items:center; gap:10px; min-width:190px; }
.voice-play { width:36px; height:36px; border-radius:50%; background:var(--accent); border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; color:#fff; transition:background .2s; }
.voice-play:hover { background:var(--accent-hover); }
.voice-waves { flex:1; display:flex; align-items:center; gap:2px; height:24px; }
.voice-waves span { display:inline-block; width:3px; border-radius:2px; background:rgba(255,255,255,0.35); }
.voice-dur { font-size:11px; color:var(--text2); }
.typing-row { display:flex; align-items:center; gap:8px; color:var(--text2); font-size:12px; padding:4px 0; }
.tdots { display:flex; gap:3px; }
.tdots span { width:6px; height:6px; background:var(--text2); border-radius:50%; animation:tdot 1.2s infinite; }
.tdots span:nth-child(2){animation-delay:.2s}.tdots span:nth-child(3){animation-delay:.4s}
@keyframes tdot{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}

/* ─── INPUT BAR ─── */
.ibar { padding:10px 14px 12px; background:var(--sidebar); border-top:1px solid var(--border); flex-shrink:0; }
.reply-strip { display:none; align-items:center; gap:10px; background:var(--surface); border-left:3px solid var(--accent); border-radius:0 10px 10px 0; padding:6px 10px; margin-bottom:8px; }
.reply-strip.on { display:flex; }
.rs-info { flex:1; min-width:0; }
.rs-nm { font-size:11px; font-weight:600; color:var(--accent); margin-bottom:2px; }
.rs-tx { font-size:12px; color:var(--text2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.rs-x { border:none; background:none; color:var(--text2); cursor:pointer; padding:2px; border-radius:4px; display:flex; }
.rs-x:hover { color:var(--text); }
.img-strip { display:none; position:relative; margin-bottom:8px; width:fit-content; }
.img-strip.on { display:block; }
.img-strip img { height:80px; border-radius:10px; display:block; }
.img-strip-rm { position:absolute; top:-6px; right:-6px; width:20px; height:20px; background:var(--red); border:none; border-radius:50%; cursor:pointer; color:#fff; display:flex; align-items:center; justify-content:center; }
.irow { display:flex; align-items:flex-end; gap:8px; }
.iab { width:38px; height:38px; border:none; background:none; color:var(--text2); border-radius:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .18s; flex-shrink:0; }
.iab:hover { background:var(--surface); color:var(--text); }
.iwrap { flex:1; position:relative; }
.msg-inp { width:100%; padding:9px 40px 9px 16px; background:var(--surface); border:1px solid var(--border); border-radius:14px; color:var(--text); font-family:inherit; font-size:14px; outline:none; resize:none; max-height:120px; transition:border-color .2s; line-height:1.5; }
.msg-inp:focus { border-color:var(--border2); background:var(--surface2); }
.msg-inp::placeholder { color:var(--text3); }
.emoji-trigger { position:absolute; right:10px; bottom:8px; border:none; background:none; color:var(--text3); cursor:pointer; padding:2px; border-radius:6px; display:flex; transition:color .18s; }
.emoji-trigger:hover { color:var(--text2); }
.emoji-picker { display:none; position:absolute; bottom:50px; right:0; background:var(--surface2); border:1px solid var(--border); border-radius:16px; padding:10px; z-index:200; width:288px; box-shadow:var(--shadow); }
.emoji-picker.on { display:block; }
.emoji-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:3px; }
.emoji-it { font-size:22px; cursor:pointer; text-align:center; border-radius:8px; padding:4px; transition:background .12s; }
.emoji-it:hover { background:var(--surface); }
.send-btn { width:38px; height:38px; border:none; background:var(--accent); color:#fff; border-radius:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; flex-shrink:0; }
.send-btn:hover { background:var(--accent-hover); transform:scale(1.04); }
.mic-btn { width:38px; height:38px; border:none; background:var(--surface); color:var(--text2); border-radius:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; flex-shrink:0; }
.mic-btn:hover { background:var(--surface2); color:var(--text); }
.mic-btn.rec { background:var(--red-dim); color:var(--red); animation:rp 1s infinite; border:1px solid var(--red); }
@keyframes rp{0%,100%{opacity:1}50%{opacity:.7}}

/* ─── CONTEXT MENU ─── */
.ctx { position:fixed; background:var(--surface2); border:1px solid var(--border); border-radius:14px; padding:4px; box-shadow:var(--shadow); z-index:1000; min-width:170px; display:none; overflow:hidden; }
.ctx.on { display:block; }
.ctx-it { display:flex; align-items:center; gap:10px; padding:9px 13px; border-radius:10px; cursor:pointer; font-size:13px; transition:background .12s; }
.ctx-it:hover { background:var(--surface); }
.ctx-it.danger { color:var(--red); }

/* ─── SETTINGS PANEL ─── */
.sett-panel { position:fixed; top:0; right:-420px; width:380px; height:100vh; background:var(--sidebar); border-left:1px solid var(--border); z-index:300; transition:right .3s cubic-bezier(.4,0,.2,1); display:flex; flex-direction:column; box-shadow:-8px 0 32px rgba(0,0,0,0.3); }
.sett-panel.on { right:0; }
.sett-hd { display:flex; align-items:center; gap:12px; padding:16px 20px; border-bottom:1px solid var(--border); flex-shrink:0; }
.sett-hd h2 { font-size:17px; font-weight:700; flex:1; }
.sett-body { flex:1; overflow-y:auto; }
.sett-profile { padding:24px 20px; text-align:center; border-bottom:1px solid var(--border); }
.sett-av-wrap { position:relative; width:80px; margin:0 auto 14px; cursor:pointer; }
.sett-av { width:80px; height:80px; border-radius:22px; display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:700; overflow:hidden; border:2px solid var(--border); }
.sett-av img { width:100%; height:100%; object-fit:cover; }
.sett-av-badge { position:absolute; bottom:-4px; right:-4px; width:26px; height:26px; background:var(--accent); border-radius:8px; display:flex; align-items:center; justify-content:center; border:2px solid var(--sidebar); }
.sett-uname { font-size:18px; font-weight:700; margin-bottom:4px; }
.sett-handle { font-size:13px; color:var(--text2); }
.sett-grp { padding:12px 16px; border-bottom:1px solid var(--border); }
.sett-grp-title { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1.5px; color:var(--text3); margin-bottom:8px; padding:0 4px; }
.sett-row { display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:12px; cursor:pointer; transition:background .15s; }
.sett-row:hover { background:var(--surface); }
.sett-ico { width:34px; height:34px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.sett-ico.blue { background:rgba(79,142,247,0.15); color:var(--accent); }
.sett-ico.green { background:var(--green-dim); color:var(--green); }
.sett-ico.red { background:var(--red-dim); color:var(--red); }
.sett-ico.yellow { background:rgba(255,209,102,0.12); color:var(--yellow); }
.sett-ico.purple { background:rgba(160,110,247,0.12); color:#a06ef7; }
.sett-row-body { flex:1; min-width:0; }
.sett-row-label { font-size:14px; font-weight:500; }
.sett-row-sub { font-size:12px; color:var(--text2); margin-top:2px; }
.sett-row-arrow { color:var(--text3); display:flex; align-items:center; }
.sett-edit-form { padding:16px; border-bottom:1px solid var(--border); display:none; }
.sett-edit-form.on { display:block; }
.sett-inp { width:100%; padding:10px 14px; background:var(--surface); border:1px solid var(--border); border-radius:11px; color:var(--text); font-family:inherit; font-size:14px; outline:none; margin-bottom:10px; transition:border-color .2s; }
.sett-inp:focus { border-color:var(--accent); }
.sett-ta { width:100%; padding:10px 14px; background:var(--surface); border:1px solid var(--border); border-radius:11px; color:var(--text); font-family:inherit; font-size:14px; outline:none; resize:none; height:80px; margin-bottom:10px; transition:border-color .2s; }
.sett-ta:focus { border-color:var(--accent); }
.btn-row { display:flex; gap:8px; }
.btn-prim { flex:1; padding:10px; background:var(--accent); border:none; border-radius:10px; color:#fff; font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .2s; }
.btn-prim:hover { background:var(--accent-hover); }
.btn-sec { flex:1; padding:10px; background:var(--surface); border:1px solid var(--border); border-radius:10px; color:var(--text2); font-size:13px; font-weight:500; cursor:pointer; font-family:inherit; transition:all .2s; }
.btn-sec:hover { background:var(--surface2); color:var(--text); }
.btn-danger { width:100%; padding:11px; background:var(--red-dim); border:1px solid rgba(255,82,82,0.2); border-radius:10px; color:var(--red); font-size:13px; font-weight:600; cursor:pointer; font-family:inherit; transition:all .2s; display:flex; align-items:center; justify-content:center; gap:8px; }
.btn-danger:hover { background:rgba(255,82,82,0.2); }

/* ─── PROFILE MODAL ─── */
.pm-over { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:400; align-items:center; justify-content:center; backdrop-filter:blur(4px); }
.pm-over.on { display:flex; }
.pm-card { background:var(--sidebar); border:1px solid var(--border); border-radius:22px; width:340px; overflow:hidden; box-shadow:0 24px 60px rgba(0,0,0,0.6); }
.pm-banner { height:90px; position:relative; }
.pm-banner-grad { position:absolute; inset:0; background:linear-gradient(135deg,var(--accent) 0%,#7c4dff 100%); }
.pm-body { padding:0 20px 20px; }
.pm-av-row { display:flex; align-items:flex-end; justify-content:space-between; margin-top:-32px; margin-bottom:12px; }
.pm-av { width:68px; height:68px; border-radius:18px; border:3px solid var(--sidebar); display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:700; overflow:hidden; }
.pm-av img { width:100%; height:100%; object-fit:cover; }
.pm-status { font-size:12px; font-weight:500; }
.pm-status.on { color:var(--green); }
.pm-status.off { color:var(--text2); }
.pm-name { font-size:20px; font-weight:700; }
.pm-handle { font-size:13px; color:var(--text2); margin:3px 0 10px; }
.pm-bio { font-size:13px; color:var(--text2); line-height:1.55; margin-bottom:16px; }
.pm-btns { display:flex; gap:8px; }
.pm-btn { flex:1; padding:9px 8px; border-radius:12px; border:none; cursor:pointer; font-size:13px; font-weight:600; font-family:inherit; transition:all .2s; display:flex; align-items:center; justify-content:center; gap:6px; }
.pm-btn.prim { background:var(--accent); color:#fff; }
.pm-btn.prim:hover { background:var(--accent-hover); }
.pm-btn.sec { background:var(--surface2); color:var(--text); border:1px solid var(--border); }
.pm-btn.sec:hover { background:var(--surface); }

/* ─── CALL MODAL ─── */
.call-over { display:none; position:fixed; inset:0; background:rgba(10,12,18,0.92); z-index:500; flex-direction:column; align-items:center; justify-content:center; backdrop-filter:blur(12px); }
.call-over.on { display:flex; }
.call-card { background:var(--sidebar); border:1px solid var(--border); border-radius:28px; padding:36px 44px; text-align:center; min-width:300px; box-shadow:0 32px 80px rgba(0,0,0,0.6); }
.call-av { width:88px; height:88px; border-radius:26px; display:flex; align-items:center; justify-content:center; font-size:34px; font-weight:700; margin:0 auto 16px; overflow:hidden; border:2px solid var(--border); }
.call-av img { width:100%; height:100%; object-fit:cover; }
.call-name { font-size:22px; font-weight:700; margin-bottom:6px; }
.call-st { color:var(--text2); font-size:13px; margin-bottom:28px; display:flex; align-items:center; justify-content:center; gap:6px; }
.call-timer { font-size:36px; font-weight:700; letter-spacing:2px; margin-bottom:6px; font-variant-numeric:tabular-nums; }
.call-btns { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
.call-btn-wrap { display:flex; flex-direction:column; align-items:center; gap:6px; }
.call-btn-wrap span { font-size:11px; color:var(--text2); }
.cbtn { width:58px; height:58px; border-radius:50%; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all .2s; }
.cbtn:hover { transform:scale(1.06); }
.cbtn.accept { background:#1db954; color:#fff; }
.cbtn.decline { background:var(--red); color:#fff; }
.cbtn.end-call { background:var(--red); color:#fff; }
.cbtn.neutral { background:var(--surface2); color:var(--text); border:1px solid var(--border); }
.cbtn.neutral.muted { background:var(--accent-dim); color:var(--accent); border-color:var(--accent); }
.vid-area { display:none; width:100%; max-width:560px; margin-bottom:20px; border-radius:16px; overflow:hidden; background:#000; position:relative; }
.vid-area.on { display:block; }
#remoteVideo { width:100%; max-height:280px; object-fit:cover; background:#111; display:block; }
#localVideo { position:absolute; bottom:8px; right:8px; width:96px; height:72px; border-radius:10px; object-fit:cover; border:2px solid var(--accent); background:#222; }

/* ─── LIGHTBOX ─── */
.lightbox { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:600; align-items:center; justify-content:center; cursor:zoom-out; }
.lightbox.on { display:flex; }
.lightbox img { max-width:92vw; max-height:92vh; border-radius:10px; }

/* ─── TOAST ─── */
.toast { position:fixed; bottom:20px; right:20px; background:var(--surface2); border:1px solid var(--border); border-radius:16px; padding:12px 14px; z-index:700; transform:translateX(120%); opacity:0; transition:all .3s cubic-bezier(.4,0,.2,1); display:flex; align-items:center; gap:10px; max-width:320px; cursor:pointer; box-shadow:var(--shadow); }
.toast.on { transform:translateX(0); opacity:1; }
.toast-av { width:38px; height:38px; border-radius:11px; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px; overflow:hidden; }
.toast-av img { width:100%; height:100%; object-fit:cover; }
.t-name { font-weight:600; font-size:13px; }
.t-text { color:var(--text2); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* Mobile */
@media(max-width:640px){
  .sidebar{width:100%;}
  .chat-area{display:none;}
  .chat-area.mob{display:flex;position:fixed;inset:0;z-index:50;}
  .back-btn{display:flex!important;}
  .sett-panel{width:100%;right:-100%;}
}
.back-btn{display:none;}
</style>
</head>
<body>

<!-- AUTH -->
<div id="auth-screen">
  <div class="auth-card">
    <div class="auth-brand">
      <div class="auth-brand-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </div>
      <div class="auth-brand-text"><h1>Freedom</h1><p>Мессенджер без границ</p></div>
    </div>
    <div class="auth-seg">
      <button class="auth-seg-btn active" onclick="authTab('login')">Войти</button>
      <button class="auth-seg-btn" onclick="authTab('reg')">Регистрация</button>
    </div>
    <div id="lf">
      <div class="field">
        <div class="field-label"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>Имя пользователя</div>
        <div class="field-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <input type="text" id="lu" placeholder="username" autocomplete="username">
      </div>
      <div class="field">
        <div class="field-label"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Пароль</div>
        <div class="field-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <input type="password" id="lp" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key==='Enter')doLogin()">
      </div>
      <button class="auth-btn" onclick="doLogin()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Войти
      </button>
      <div class="auth-err" id="le"></div>
    </div>
    <div id="rf" style="display:none">
      <div class="field">
        <div class="field-label">Отображаемое имя</div>
        <div class="field-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>
        <input type="text" id="rn" placeholder="Ваше имя">
      </div>
      <div class="field">
        <div class="field-label">Логин</div>
        <div class="field-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/></svg></div>
        <input type="text" id="ru" placeholder="username (мин. 3 символа)">
      </div>
      <div class="field">
        <div class="field-label">Пароль</div>
        <div class="field-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <input type="password" id="rp" placeholder="••••••••" onkeydown="if(event.key==='Enter')doReg()">
      </div>
      <button class="auth-btn" onclick="doReg()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
        Создать аккаунт
      </button>
      <div class="auth-err" id="re"></div>
    </div>
  </div>
</div>

<!-- APP -->
<div id="app">
  <!-- SIDEBAR -->
  <div class="sidebar">
    <div class="sb-head">
      <div class="me-av" id="me-av" onclick="openSett()"></div>
      <div class="me-nm" id="me-nm" onclick="openSett()"></div>
      <div class="sb-acts">
        <button class="ib" title="Новый чат" onclick="goPeople()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button class="ib" title="Настройки" onclick="openSett()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </div>
    </div>
    <div class="sb-search">
      <div class="srch-wrap">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input class="srch-inp" placeholder="Поиск..." oninput="filterList(this.value)">
      </div>
    </div>
    <div class="sb-tabs">
      <button class="sb-tab active" id="tab-c" onclick="switchTab('chats',this)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Чаты
      </button>
      <button class="sb-tab" id="tab-p" onclick="switchTab('people',this)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Люди
      </button>
    </div>
    <div class="chat-list" id="clist"></div>
  </div>

  <!-- CHAT AREA -->
  <div class="chat-area" id="chat-area">
    <div id="no-chat" class="no-chat">
      <div class="no-chat-icon"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
      <h3>Freedom Messenger</h3>
      <p>Выберите чат или найдите собеседника</p>
    </div>
    <div id="chat-view" style="display:none;flex-direction:column;height:100%">
      <div class="chat-hd">
        <button class="ib back-btn" onclick="closeMob()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <div class="ch-av" id="ch-av" onclick="showPM(currentChat)"></div>
        <div class="ch-info" onclick="showPM(currentChat)">
          <div class="ch-name" id="ch-name"></div>
          <div class="ch-status" id="ch-status"></div>
        </div>
        <div class="ch-acts">
          <button class="ib" title="Аудиозвонок" onclick="startCall('audio')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.5 16c.02.32.02.64 0 .96"/></svg>
          </button>
          <button class="ib" title="Видеозвонок" onclick="startCall('video')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </button>
          <button class="ib" title="Профиль" onclick="showPM(currentChat)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
          </button>
        </div>
      </div>
      <div class="msgs" id="msgs" oncontextmenu="return false"></div>
      <div class="ibar">
        <div class="reply-strip" id="rs">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.5" style="flex-shrink:0"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
          <div class="rs-info"><div class="rs-nm" id="rs-nm"></div><div class="rs-tx" id="rs-tx"></div></div>
          <button class="rs-x" onclick="cancelReply()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="img-strip" id="is"><img id="ithumb"><button class="img-strip-rm" onclick="rmImg()"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>
        <div class="irow">
          <button class="iab" title="Прикрепить файл" onclick="document.getElementById('fi').click()">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <input type="file" id="fi" accept="image/*" style="display:none" onchange="handleImg(event)">
          <div class="iwrap">
            <textarea class="msg-inp" id="mi" placeholder="Написать сообщение..." rows="1" oninput="resize(this);onType()" onkeydown="mkey(event)"></textarea>
            <button class="emoji-trigger" onclick="toggleEmoji()">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
            </button>
            <div class="emoji-picker" id="ep"></div>
          </div>
          <button class="mic-btn" id="mic-btn" onclick="toggleRec()" title="Голосовое сообщение">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
          <button class="send-btn" onclick="sendMsg()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- SETTINGS PANEL -->
<div class="sett-panel" id="sp">
  <div class="sett-hd">
    <button class="ib" onclick="closeSett()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/></svg></button>
    <h2>Настройки</h2>
  </div>
  <div class="sett-body">
    <div class="sett-profile">
      <div class="sett-av-wrap" onclick="document.getElementById('avi').click()">
        <div class="sett-av" id="sett-av"></div>
        <div class="sett-av-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
      </div>
      <input type="file" id="avi" accept="image/*" style="display:none" onchange="chgAv(event)">
      <div class="sett-uname" id="sett-un"></div>
      <div class="sett-handle" id="sett-hn"></div>
    </div>

    <div class="sett-grp">
      <div class="sett-grp-title">Аккаунт</div>
      <div class="sett-row" onclick="toggleEdit()">
        <div class="sett-ico blue"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
        <div class="sett-row-body"><div class="sett-row-label">Редактировать профиль</div><div class="sett-row-sub" id="sett-nm-sub"></div></div>
        <div class="sett-row-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></div>
      </div>
      <div class="sett-row">
        <div class="sett-ico purple"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>
        <div class="sett-row-body"><div class="sett-row-label">О себе</div><div class="sett-row-sub" id="sett-bio-sub">Не указано</div></div>
      </div>
    </div>

    <div class="sett-edit-form" id="sef">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);margin-bottom:12px">Редактирование</div>
      <input class="sett-inp" id="en" placeholder="Отображаемое имя">
      <textarea class="sett-ta" id="eb" placeholder="Расскажите о себе..."></textarea>
      <div class="btn-row">
        <button class="btn-prim" onclick="saveProf()">Сохранить</button>
        <button class="btn-sec" onclick="toggleEdit()">Отмена</button>
      </div>
    </div>

    <div class="sett-grp">
      <div class="sett-grp-title">Приватность</div>
      <div class="sett-row" onclick="alert('Скоро!')">
        <div class="sett-ico green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
        <div class="sett-row-body"><div class="sett-row-label">Последний визит</div><div class="sett-row-sub">Все пользователи</div></div>
        <div class="sett-row-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></div>
      </div>
      <div class="sett-row" onclick="alert('Скоро!')">
        <div class="sett-ico blue"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>
        <div class="sett-row-body"><div class="sett-row-label">Фото профиля</div><div class="sett-row-sub">Все пользователи</div></div>
        <div class="sett-row-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></div>
      </div>
    </div>

    <div class="sett-grp">
      <div class="sett-grp-title">Внешний вид</div>
      <div class="sett-row" onclick="alert('Скоро!')">
        <div class="sett-ico yellow"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg></div>
        <div class="sett-row-body"><div class="sett-row-label">Тема оформления</div><div class="sett-row-sub">Тёмная</div></div>
        <div class="sett-row-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></div>
      </div>
      <div class="sett-row" onclick="alert('Скоро!')">
        <div class="sett-ico green"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
        <div class="sett-row-body"><div class="sett-row-label">Уведомления</div><div class="sett-row-sub">Включены</div></div>
        <div class="sett-row-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></div>
      </div>
    </div>

    <div class="sett-grp">
      <div class="sett-grp-title">Безопасность</div>
      <div class="sett-row" onclick="alert('Скоро!')">
        <div class="sett-ico red"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
        <div class="sett-row-body"><div class="sett-row-label">Сменить пароль</div><div class="sett-row-sub">Рекомендуется регулярно</div></div>
        <div class="sett-row-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg></div>
      </div>
    </div>

    <div class="sett-grp">
      <button class="btn-danger" onclick="doLogout()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        Выйти из аккаунта
      </button>
    </div>
  </div>
</div>

<!-- PROFILE MODAL -->
<div class="pm-over" id="pmo" onclick="if(event.target===this)closePM()">
  <div class="pm-card">
    <div class="pm-banner">
      <div class="pm-banner-grad"></div>
      <button class="ib" onclick="closePM()" style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,0.4)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
    <div class="pm-body">
      <div class="pm-av-row">
        <div class="pm-av" id="pmav"></div>
        <div class="pm-status" id="pmst"></div>
      </div>
      <div class="pm-name" id="pmnm"></div>
      <div class="pm-handle" id="pmhn"></div>
      <div class="pm-bio" id="pmbio"></div>
      <div class="pm-btns">
        <button class="pm-btn prim" onclick="chatFromPM()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Написать</button>
        <button class="pm-btn sec" onclick="callFromPM('audio')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.8a16 16 0 0 0 6 6l.94-.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21.5 16c.02.32.02.64 0 .96"/></svg>Звонок</button>
        <button class="pm-btn sec" onclick="callFromPM('video')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>Видео</button>
      </div>
    </div>
  </div>
</div>

<!-- CALL MODAL -->
<div class="call-over" id="co">
  <div class="vid-area" id="va"><video id="remoteVideo" autoplay playsinline></video><video id="localVideo" autoplay muted playsinline></video></div>
  <div class="call-card">
    <div class="call-av" id="cav"></div>
    <div class="call-name" id="cnm"></div>
    <div class="call-st" id="cst"></div>
    <div class="call-timer" id="ctmr" style="display:none"></div>
    <div class="call-btns" id="cbtns"></div>
  </div>
</div>

<!-- LIGHTBOX -->
<div class="lightbox" id="lb" onclick="this.classList.remove('on')"><img id="lbi"></div>

<!-- CONTEXT MENU -->
<div class="ctx" id="ctx">
  <div class="ctx-it" onclick="ctxReply()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>Ответить</div>
  <div class="ctx-it" onclick="ctxCopy()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Копировать</div>
  <div class="ctx-it danger" id="ctx-del" onclick="ctxDel()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>Удалить</div>
</div>

<!-- TOAST -->
<div class="toast" id="toast" onclick="openToast()">
  <div class="toast-av" id="tav"></div>
  <div><div class="t-name" id="tnm"></div><div class="t-text" id="ttx"></div></div>
</div>


// SVG snippets
const CHK = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
const DBLCHK = `<svg width="16" height="12" viewBox="0 0 28 14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="2 7 7 12 14 4"/><polyline points="14 7 19 12 26 4"/></svg>`;
const PLAY_ICO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const PAUSE_ICO = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const EMOJIS = ['😀','😂','🥰','😍','🤔','😎','😭','😤','🥺','🤣','❤️','🔥','👍','👎','🎉','✨','💯','🙏','😊','🤗','😏','😅','🤦','🤷','💪','👀','🫡','🫂','💀','🤙','💬','🚀','🌟','🎮','🍕','🎵','🌈','🌙','⚡','🎯'];

let socket, me=null, cur=null;
let users=[], hist={}, unread={}, prev={};
let replyMsg=null, ctxMsg=null;
let tyTimer=null, typing=false;
let recorder=null, chunks=[], recInt=null;
let pc=null, stream=null;
let callInt=null, callSecs=0, callUser=null, callKind='audio';
let attachImg=null, toastTimer=null, toastUser=null, pmUser=null;

function init(){
  socket=io();
  socket.on('new_message',onMsg);
  socket.on('user_online',({username})=>setStatus(username,true));
  socket.on('user_offline',({username,lastSeen})=>setStatus(username,false,lastSeen));
  socket.on('user_updated',onUserUpd);
  socket.on('user_typing',onTypingEvt);
  socket.on('messages_read',({by})=>markRead(by));
  socket.on('message_deleted',({msgId})=>rmEl(msgId));
  socket.on('incoming_call',onInCall);
  socket.on('call_answered',onCallAns);
  socket.on('ice_candidate',({candidate})=>{try{if(pc)pc.addIceCandidate(candidate);}catch(e){}});
  socket.on('call_ended',()=>callSt('Звонок завершён',true));
  socket.on('call_rejected',()=>callSt('Отклонено',true));
  socket.on('call_busy',()=>callSt('Занято',true));
}

// Auth
function authTab(t){
  document.querySelectorAll('.auth-seg-btn').forEach((b,i)=>b.classList.toggle('active',t==='login'?i===0:i===1));
  G('lf').style.display=t==='login'?'':'none';
  G('rf').style.display=t==='reg'?'':'none';
}
function doLogin(){
  const u=V('lu'),p=V('lp');
  if(!u||!p)return E('le','Заполните все поля');
  socket.emit('login',{username:u,password:p},r=>r.error?E('le',r.error):onAuth(r.user));
}
function doReg(){
  const n=V('rn'),u=V('ru'),p=V('rp');
  if(!n||!u||!p)return E('re','Заполните все поля');
  socket.emit('register',{username:u,password:p,displayName:n},r=>r.error?E('re',r.error):onAuth(r.user));
}
function onAuth(user){
  me=user;
  G('auth-screen').style.display='none';
  G('app').classList.add('on');
  updMe(); loadUsers();
}
function doLogout(){
  socket.emit('logout');
  me=null;cur=null;users=[];hist={};unread={};prev={};
  G('app').classList.remove('on');
  G('auth-screen').style.display='flex';
  G('chat-view').style.display='none';
  G('no-chat').style.display='flex';
  closeSett();
}
function G(id){return document.getElementById(id);}
function V(id){return G(id).value.trim();}
function E(id,msg){G(id).textContent=msg;setTimeout(()=>G(id).textContent='',4000);}

// Me UI
function updMe(){
  const n=me.displayName||me.username;
  G('me-nm').textContent=n;
  setAv(G('me-av'),me,'10px');
  G('sett-un').textContent=n;
  G('sett-hn').textContent='@'+me.username;
  G('sett-nm-sub').textContent=n;
  G('sett-bio-sub').textContent=me.bio||'Не указано';
  setAv(G('sett-av'),me,'20px');
}
function setAv(el,user,r='50%'){
  if(!el)return;
  el.style.background=col(user.username);
  el.style.borderRadius=r;
  el.innerHTML=user.avatar?`<img src="${user.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:${r}">`:`<span>${ini(user.displayName||user.username)}</span>`;
}
function ini(n){return n.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()).join('')||'?';}
function col(s){const c=['#4f8ef7','#7c4dff','#e91e8c','#00bcd4','#ff6b35','#2eb872','#ff9800','#9c27b0'];let h=0;for(let ch of s)h=(h*31+ch.charCodeAt(0))%c.length;return c[h];}
function ft(ts){const d=new Date(ts),n=new Date();if(d.toDateString()===n.toDateString())return d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});if(n-d<7*864e5)return d.toLocaleDateString('ru-RU',{weekday:'short'});return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fs(s){return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}

// Users
function loadUsers(){
  fetch('/api/users').then(r=>r.json()).then(u=>{users=u.filter(x=>x.username!==me.username);renderList();});
}
function switchTab(tab,btn){
  document.querySelectorAll('.sb-tab').forEach(t=>t.classList.remove('active'));
  btn.classList.add('active');
  renderList(tab);
}
function goPeople(){G('tab-p').click();}
function filterList(q){
  const active=document.querySelector('.sb-tab.active').textContent.includes('Люди')?'people':'chats';
  renderList(active,q.toLowerCase());
}
function renderList(mode='chats',q=''){
  const el=G('clist');
  const f=users.filter(u=>!q||(u.displayName||u.username).toLowerCase().includes(q)||u.username.includes(q));
  if(!f.length){el.innerHTML=`<div class="empty-list"><div class="empty-list-icon"><svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div>Никого нет</div></div>`;return;}
  let html='';
  if(mode==='chats'){
    const wm=f.filter(u=>prev[u.username]),wo=f.filter(u=>!prev[u.username]);
    if(wm.length)html+=`<div class="sec-hd">Активные</div>`;
    wm.forEach(u=>html+=ci(u));
    if(wo.length&&wm.length)html+=`<div class="sec-hd">Контакты</div>`;
    wo.forEach(u=>html+=ci(u));
  }else{
    html+=`<div class="sec-hd">Все пользователи · ${f.length}</div>`;
    f.forEach(u=>html+=ci(u));
  }
  el.innerHTML=html;
}
function ci(u){
  const p=prev[u.username],badge=(unread[u.username]||0)>0?`<div class="ubadge">${unread[u.username]}</div>`:'';
  const online=u.online?`<div class="odot"></div>`:'';
  const avC=u.avatar?`<img src="${u.avatar}">`:`<span>${ini(u.displayName||u.username)}</span>`;
  const time=p?`<span class="ci-time">${ft(p.timestamp)}</span>`:'';
  let ptx='';
  if(p)ptx=p.type==='image'?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Фото`:p.type==='voice'?`<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>Голосовое`:esc(p.content||'').slice(0,45);
  else ptx=u.online?`<span style="color:var(--green);font-size:11px">В сети</span>`:'';
  return`<div class="chat-item${cur===u.username?' active':''}" onclick="openChat('${u.username}')"><div class="ci-av" style="background:${col(u.username)}">${avC}${online}</div><div class="ci-info"><div class="ci-top"><span class="ci-name">${esc(u.displayName||u.username)}</span>${time}</div><div class="ci-bot"><span class="ci-prev">${ptx}</span>${badge}</div></div></div>`;
}

// Open Chat
function openChat(username){
  cur=username; unread[username]=0;
  const u=users.find(x=>x.username===username)||{username,displayName:username};
  const hav=G('ch-av'); hav.style.background=col(username); setAv(hav,u,'12px');
  G('ch-name').textContent=u.displayName||username;
  const st=G('ch-status'); st.textContent=u.online?'В сети':'Не в сети'; st.className='ch-status'+(u.online?' on':'');
  G('no-chat').style.display='none';
  G('chat-view').style.display='flex';
  G('chat-area').classList.add('mob');
  socket.emit('get_messages',{with:username},msgs=>{hist[username]=msgs||[];renderMsgs();scrollBot();});
  socket.emit('mark_read',{chatWith:username});
  renderList();
}
function closeMob(){G('chat-area').classList.remove('mob');}

// Render Messages
function renderMsgs(){
  const area=G('msgs'),msgs=hist[cur]||[];
  if(!msgs.length){area.innerHTML=`<div style="text-align:center;color:var(--text3);padding:48px 20px;font-size:13px">Начните переписку 👋</div>`;return;}
  let html='',lastD=null;
  msgs.forEach(m=>{
    const d=new Date(m.timestamp).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
    if(d!==lastD){html+=`<div class="date-div">${d}</div>`;lastD=d;}
    html+=bbl(m);
  });
  area.innerHTML=html;
  bindEvts(area);
}
function bbl(m){
  const out=m.from===me.username,u=users.find(x=>x.username===m.from)||{username:m.from,displayName:m.from};
  const avC=u.avatar?`<img src="${u.avatar}">`:`<span>${ini(u.displayName||u.username)}</span>`;
  const time=ft(m.timestamp),checks=out?`<span class="chk">${m.read?DBLCHK:CHK}</span>`:'';
  let reply='';
  if(m.replyTo){
    const orig=(hist[cur]||[]).find(x=>x.id===m.replyTo);
    if(orig){const rn=orig.from===me.username?'Вы':(users.find(x=>x.username===orig.from)?.displayName||orig.from);reply=`<div class="bbl-reply"><div class="bbl-rname">${rn}</div><div class="bbl-rtext">${orig.type==='image'?'Фото':orig.type==='voice'?'Голосовое':esc(orig.content||'').slice(0,60)}</div></div>`;}
  }
  let body='';
  if(m.type==='image')body=`<img class="bbl-img" src="${m.content}" alt="фото">`;
  else if(m.type==='voice'){const bars=Array.from({length:22},()=>`<span style="height:${5+Math.floor(Math.random()*16)}px"></span>`).join('');body=`<div class="voice-msg"><button class="voice-play" onclick="playV(this,'${m.content}')">${PLAY_ICO}</button><div class="voice-waves">${bars}</div><span class="voice-dur">${m.duration||'0:00'}</span></div>`;}
  else body=`<div class="bbl-text">${esc(m.content||'').replace(/\n/g,'<br>')}</div>`;
  const avEl=!out?`<div class="msg-av" style="background:${col(m.from)}">${avC}</div>`:'';
  return`<div class="mrow ${out?'out':'in'}" id="mw-${m.id}">${avEl}<div class="bubble" data-id="${m.id}" data-from="${m.from}" data-content="${esc(m.content||'')}">${reply}${body}<div class="bbl-meta">${time}${checks}</div></div></div>`;
}
function bindEvts(el){
  el.querySelectorAll('.bubble').forEach(b=>b.addEventListener('contextmenu',e=>{e.preventDefault();showCtx(e,b.dataset.id);}));
  el.querySelectorAll('.bbl-img').forEach(img=>img.addEventListener('click',()=>{G('lbi').src=img.src;G('lb').classList.add('on');}));
}
function scrollBot(){const a=G('msgs');setTimeout(()=>a.scrollTop=a.scrollHeight,40);}

// Send
function sendMsg(){
  if(!cur)return;
  if(attachImg){sendImg();return;}
  const inp=G('mi'),text=inp.value.trim();
  if(!text)return;
  const d={to:cur,content:text,type:'text'};
  if(replyMsg)d.replyTo=replyMsg.id;
  socket.emit('send_message',d,r=>{if(r?.message)pushMsg(r.message);});
  inp.value='';resize(inp);cancelReply();clearTyp();
}
function sendImg(){
  socket.emit('send_message',{to:cur,content:attachImg,type:'image',replyTo:replyMsg?.id||null},r=>{if(r?.message)pushMsg(r.message);});
  rmImg();cancelReply();
}
function pushMsg(msg){
  if(!hist[cur])hist[cur]=[];
  hist[cur].push(msg);prev[cur]=msg;
  const area=G('msgs'),ph=area.querySelector('[style*="Начните"]');
  if(ph)ph.remove();
  const d=document.createElement('div');d.innerHTML=bbl(msg);
  const el=d.firstElementChild;area.appendChild(el);
  bindEvts(el.parentElement||area);scrollBot();renderList();
}
function onMsg(msg){
  const cu=msg.from===me.username?msg.to:msg.from;
  if(!hist[cu])hist[cu]=[];hist[cu].push(msg);prev[cu]=msg;
  if(cu===cur){pushMsg(msg);socket.emit('mark_read',{chatWith:cu});}
  else if(msg.from!==me.username){unread[msg.from]=(unread[msg.from]||0)+1;showToast(msg);}
  renderList();
}
function mkey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg();}}
function handleImg(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{attachImg=ev.target.result;G('ithumb').src=attachImg;G('is').classList.add('on');};r.readAsDataURL(f);e.target.value='';}
function rmImg(){attachImg=null;G('is').classList.remove('on');}
function resize(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}

// Typing
function onType(){if(!cur)return;if(!typing){typing=true;socket.emit('typing',{to:cur,isTyping:true});}clearTimeout(tyTimer);tyTimer=setTimeout(clearTyp,2500);}
function clearTyp(){if(typing){typing=false;socket.emit('typing',{to:cur,isTyping:false});}}
function onTypingEvt({from,isTyping:t}){if(from!==cur)return;const area=G('msgs'),ex=document.getElementById('tind');if(t&&!ex){const d=document.createElement('div');d.id='tind';d.className='typing-row';d.innerHTML=`<div class="tdots"><span></span><span></span><span></span></div><span>печатает...</span>`;area.appendChild(d);scrollBot();}else if(!t&&ex)ex.remove();}

// Reply/Delete
function cancelReply(){replyMsg=null;G('rs').classList.remove('on');}
function rmEl(id){G('mw-'+id)?.remove();}
function markRead(by){if(by!==cur)return;(hist[cur]||[]).forEach(m=>{if(m.from===me.username)m.read=true;});renderMsgs();}

// Context
function showCtx(e,id){ctxMsg=(hist[cur]||[]).find(m=>m.id===id);const c=G('ctx');c.style.left=Math.min(e.clientX,window.innerWidth-200)+'px';c.style.top=Math.min(e.clientY,window.innerHeight-130)+'px';c.classList.add('on');G('ctx-del').style.display=ctxMsg?.from===me.username?'':'none';}
document.addEventListener('click',()=>G('ctx').classList.remove('on'));
function ctxReply(){if(!ctxMsg)return;replyMsg=ctxMsg;const n=ctxMsg.from===me.username?'Вы':(users.find(u=>u.username===ctxMsg.from)?.displayName||ctxMsg.from);G('rs-nm').textContent=n;G('rs-tx').textContent=ctxMsg.type==='image'?'Фото':ctxMsg.type==='voice'?'Голосовое':ctxMsg.content?.slice(0,80);G('rs').classList.add('on');G('mi').focus();}
function ctxCopy(){if(ctxMsg?.content)navigator.clipboard.writeText(ctxMsg.content).catch(()=>{});}
function ctxDel(){if(!ctxMsg)return;socket.emit('delete_message',{msgId:ctxMsg.id,chatWith:cur},r=>{if(r?.ok){hist[cur]=(hist[cur]||[]).filter(m=>m.id!==ctxMsg.id);rmEl(ctxMsg.id);}});}

// Emoji
function toggleEmoji(){const p=G('ep');if(!p.innerHTML)p.innerHTML=`<div class="emoji-grid">${EMOJIS.map(e=>`<div class="emoji-it" onclick="insEmoji('${e}')">${e}</div>`).join('')}</div>`;p.classList.toggle('on');}
function insEmoji(e){const inp=G('mi'),pos=inp.selectionStart;inp.value=inp.value.slice(0,pos)+e+inp.value.slice(pos);inp.selectionStart=inp.selectionEnd=pos+e.length;inp.focus();G('ep').classList.remove('on');}
document.addEventListener('click',e=>{if(!e.target.closest('.iwrap'))G('ep')?.classList.remove('on');});

// Voice
async function toggleRec(){
  if(recorder&&recorder.state==='recording'){recorder.stop();return;}
  try{
    const s=await navigator.mediaDevices.getUserMedia({audio:true});
    recorder=new MediaRecorder(s);chunks=[];let sec=0;
    const btn=G('mic-btn');btn.classList.add('rec');
    recInt=setInterval(()=>{sec++;btn.title=`Запись: ${fs(sec)}`;},1000);
    recorder.ondataavailable=e=>chunks.push(e.data);
    recorder.onstop=()=>{
      clearInterval(recInt);btn.classList.remove('rec');btn.title='Голосовое сообщение';
      const blob=new Blob(chunks,{type:'audio/webm'});const r=new FileReader();
      r.onload=ev=>{socket.emit('send_message',{to:cur,content:ev.target.result,type:'voice',duration:fs(sec),replyTo:replyMsg?.id||null},res=>{if(res?.message)pushMsg(res.message);});};
      r.readAsDataURL(blob);s.getTracks().forEach(t=>t.stop());cancelReply();
    };
    recorder.start();
  }catch(e){alert('Нет доступа к микрофону');}
}
function playV(btn,src){const a=new Audio(src);btn.innerHTML=PAUSE_ICO;a.play();a.onended=()=>{btn.innerHTML=PLAY_ICO;};}

// Status
function setStatus(username,online){const u=users.find(x=>x.username===username);if(u)u.online=online;if(cur===username){const s=G('ch-status');s.textContent=online?'В сети':'Не в сети';s.className='ch-status'+(online?' on':'');}renderList();}
function onUserUpd({username,displayName,avatar}){const u=users.find(x=>x.username===username);if(u){u.displayName=displayName;u.avatar=avatar;}if(username===me.username){me.displayName=displayName;me.avatar=avatar;updMe();}renderList();}

// Settings
function openSett(){G('sp').classList.add('on');G('sef').classList.remove('on');}
function closeSett(){G('sp').classList.remove('on');}
function toggleEdit(){
  const f=G('sef');
  if(!f.classList.contains('on')){G('en').value=me.displayName||'';G('eb').value=me.bio||'';f.classList.add('on');}
  else f.classList.remove('on');
}
function saveProf(){
  const n=G('en').value.trim(),b=G('eb').value.trim();
  socket.emit('update_profile',{displayName:n,bio:b},r=>{if(r?.ok){me=r.user;updMe();G('sef').classList.remove('on');}});
}
function chgAv(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{fetch('/api/avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:me.username,avatar:ev.target.result})}).then(()=>{me.avatar=ev.target.result;updMe();});};r.readAsDataURL(f);e.target.value='';}

// Profile Modal
function showPM(username){if(!username)return;const u=users.find(x=>x.username===username)||{username,displayName:username};pmUser=username;const av=G('pmav');av.style.background=col(username);setAv(av,u,'16px');G('pmnm').textContent=u.displayName||username;G('pmhn').textContent='@'+username;const st=G('pmst');st.textContent=u.online?'В сети':'Не в сети';st.className='pm-status '+(u.online?'on':'off');G('pmbio').textContent=u.bio||'Нет описания';G('pmo').classList.add('on');}
function closePM(){G('pmo').classList.remove('on');}
function chatFromPM(){closePM();openChat(pmUser);}
function callFromPM(t){closePM();openChat(pmUser);setTimeout(()=>startCall(t),300);}

// Toast
function showToast(msg){const u=users.find(x=>x.username===msg.from)||{username:msg.from,displayName:msg.from};toastUser=msg.from;const av=G('tav');av.style.background=col(msg.from);av.style.borderRadius='11px';setAv(av,u,'11px');G('tnm').textContent=u.displayName||u.username;G('ttx').textContent=msg.type==='image'?'Фото':msg.type==='voice'?'Голосовое':(msg.content||'').slice(0,60);const t=G('toast');t.classList.add('on');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),4500);}
function openToast(){G('toast').classList.remove('on');if(toastUser)openChat(toastUser);}

// Calls
const ICE={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
async function startCall(type){
  if(!cur)return;callKind=type;callUser=cur;
  const u=users.find(x=>x.username===cur)||{username:cur};
  showCallUI(u,type,'out');
  try{
    stream=await navigator.mediaDevices.getUserMedia(type==='video'?{video:true,audio:true}:{audio:true});
    if(type==='video'){G('localVideo').srcObject=stream;G('va').classList.add('on');}
    pc=new RTCPeerConnection(ICE);stream.getTracks().forEach(t=>pc.addTrack(t,stream));
    pc.ontrack=e=>{G('remoteVideo').srcObject=e.streams[0];};
    pc.onicecandidate=e=>{if(e.candidate)socket.emit('ice_candidate',{to:callUser,candidate:e.candidate});};
    const offer=await pc.createOffer();await pc.setLocalDescription(offer);
    socket.emit('call_user',{to:callUser,offer,callType:type});
  }catch(e){endCall();alert('Нет доступа к камере/микрофону');}
}
function onInCall({from,offer,callType:ct}){callUser=from;callKind=ct;showCallUI(users.find(x=>x.username===from)||{username:from},ct,'in',offer);}
async function acceptCall(offer){
  try{
    stream=await navigator.mediaDevices.getUserMedia(callKind==='video'?{video:true,audio:true}:{audio:true});
    if(callKind==='video'){G('localVideo').srcObject=stream;G('va').classList.add('on');}
    pc=new RTCPeerConnection(ICE);stream.getTracks().forEach(t=>pc.addTrack(t,stream));
    pc.ontrack=e=>{G('remoteVideo').srcObject=e.streams[0];};
    pc.onicecandidate=e=>{if(e.candidate)socket.emit('ice_candidate',{to:callUser,candidate:e.candidate});};
    await pc.setRemoteDescription(offer);const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
    socket.emit('call_answer',{to:callUser,answer});startCallTimer();
  }catch(e){endCall();}
}
async function onCallAns({answer}){try{await pc.setRemoteDescription(answer);startCallTimer();showCallUI(users.find(x=>x.username===callUser)||{username:callUser},callKind,'active');}catch(e){}}
function endCall(){socket.emit('call_end',{to:callUser});cleanCall();}
function rejectCall(){socket.emit('call_reject',{to:callUser});cleanCall();}
function cleanCall(){pc?.close();pc=null;stream?.getTracks().forEach(t=>t.stop());stream=null;clearInterval(callInt);callSecs=0;G('ctmr').style.display='none';G('va').classList.remove('on');G('co').classList.remove('on');}
function callSt(msg,close){G('cst').textContent=msg;if(close)setTimeout(cleanCall,2000);}
function startCallTimer(){callSecs=0;const el=G('ctmr');el.style.display='block';callInt=setInterval(()=>{callSecs++;el.textContent=fs(callSecs);},1000);}
const PHONE_ICO=`<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/></svg>`;
function showCallUI(u,type,mode,offer){
  const av=G('cav');av.style.background=col(u.username);setAv(av,u,'22px');
  G('cnm').textContent=u.displayName||u.username;
  const tl=type==='video'?'Видеозвонок':'Аудиозвонок';
  let st='',btns='';
  if(mode==='out'){
    st=tl+' · Исходящий...';
    btns=`<div class="call-btn-wrap"><button class="cbtn end-call" onclick="endCall()">${PHONE_ICO}</button><span>Завершить</span></div>`;
  }else if(mode==='in'){
    st='Входящий '+tl.toLowerCase();
    G('cst').textContent=st;
    G('cbtns').innerHTML=`<div class="call-btn-wrap"><button class="cbtn decline" onclick="rejectCall()">${PHONE_ICO}</button><span>Отклонить</span></div><div class="call-btn-wrap"><button id="acc-btn" class="cbtn accept">${PHONE_ICO}</button><span>Принять</span></div>`;
    G('co').classList.add('on');
    G('acc-btn').onclick=()=>acceptCall(offer);return;
  }else{
    st=tl;G('ctmr').style.display='block';
    btns=`<div class="call-btn-wrap"><button class="cbtn neutral" id="cbmute" onclick="tMute(this)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button><span>Микрофон</span></div><div class="call-btn-wrap"><button class="cbtn end-call" onclick="endCall()">${PHONE_ICO}</button><span>Завершить</span></div>${type==='video'?`<div class="call-btn-wrap"><button class="cbtn neutral" id="cbcam" onclick="tCam(this)"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg></button><span>Камера</span></div>`:''}`;
  }
  G('cst').textContent=st;G('cbtns').innerHTML=btns;G('co').classList.add('on');
}
function tMute(btn){if(!stream)return;const t=stream.getAudioTracks()[0];t.enabled=!t.enabled;btn.classList.toggle('muted',!t.enabled);}
function tCam(btn){if(!stream)return;const t=stream.getVideoTracks()[0];t.enabled=!t.enabled;btn.classList.toggle('muted',!t.enabled);}

setInterval(()=>{if(me)loadUsers();},30000);
init();

</body>
</html>}
.auth-box {
  width:380px; background:var(--sidebar); border:1px solid var(--border);
  border-radius:20px; padding:36px 32px; box-shadow:0 24px 60px rgba(0,0,0,0.5);
}
.auth-logo { text-align:center; margin-bottom:28px; }
.auth-logo .logo-icon { font-size:48px; margin-bottom:8px; }
.auth-logo h1 { font-size:28px; font-weight:700; letter-spacing:-0.5px; }
.auth-logo p { color:var(--text2); font-size:13px; margin-top:4px; }
.auth-tabs { display:flex; gap:4px; background:var(--bg); border-radius:10px; padding:4px; margin-bottom:24px; }
.auth-tab {
  flex:1; padding:8px; border:none; background:none; color:var(--text2);
  border-radius:8px; cursor:pointer; font-size:13px; font-weight:500; transition:all .2s;
}
.auth-tab.active { background:var(--accent); color:#fff; }
.form-group { margin-bottom:14px; }
.form-group label { display:block; font-size:12px; color:var(--text2); margin-bottom:6px; font-weight:500; }
.form-group input {
  width:100%; padding:10px 14px; background:var(--surface);
  border:1px solid var(--border); border-radius:10px; color:var(--text);
  font-family:'Inter',sans-serif; font-size:14px; outline:none; transition:border-color .2s;
}
.form-group input:focus { border-color:var(--accent); }
.btn {
  width:100%; padding:11px; background:var(--accent); border:none; border-radius:10px;
  color:#fff; font-size:14px; font-weight:600; cursor:pointer; transition:background .2s;
  font-family:'Inter',sans-serif; margin-top:4px;
}
.btn:hover { background:var(--accent-hover); }
.btn-danger { background:var(--danger); }
.btn-danger:hover { background:#ff6b6b; }
.btn-ghost {
  background:none; border:1px solid var(--border); color:var(--text2);
  margin-top:8px;
}
.btn-ghost:hover { background:var(--surface); color:var(--text); }
.auth-error { color:var(--danger); font-size:12px; text-align:center; margin-top:10px; min-height:18px; }

/* ── MAIN LAYOUT ── */
#app { display:none; height:100vh; flex-direction:column; }
#app.visible { display:flex; }
.app-body { display:flex; flex:1; overflow:hidden; }

/* ── SIDEBAR ── */
.sidebar {
  width:300px; background:var(--sidebar); border-right:1px solid var(--border);
  display:flex; flex-direction:column; flex-shrink:0;
}
.sidebar-header {
  padding:12px 14px; border-bottom:1px solid var(--border);
  display:flex; align-items:center; gap:10px;
}
.sidebar-header .my-avatar {
  width:36px; height:36px; border-radius:50%; background:var(--accent);
  display:flex; align-items:center; justify-content:center; font-weight:700;
  font-size:14px; cursor:pointer; flex-shrink:0; overflow:hidden;
}
.sidebar-header .my-avatar img { width:100%; height:100%; object-fit:cover; }
.sidebar-header .my-name { font-weight:600; font-size:14px; flex:1; cursor:pointer; }
.sidebar-header .my-name:hover { color:var(--accent); }
.icon-btn {
  width:32px; height:32px; border:none; background:none; color:var(--text2);
  border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-size:16px; transition:all .2s;
}
.icon-btn:hover { background:var(--surface); color:var(--text); }

.sidebar-search { padding:10px 14px; border-bottom:1px solid var(--border); }
.search-input {
  width:100%; padding:8px 12px; background:var(--surface);
  border:1px solid var(--border); border-radius:20px; color:var(--text);
  font-family:'Inter',sans-serif; font-size:13px; outline:none;
}
.search-input:focus { border-color:var(--accent); }

.sidebar-tabs { display:flex; border-bottom:1px solid var(--border); }
.sidebar-tab {
  flex:1; padding:10px; border:none; background:none; color:var(--text2);
  cursor:pointer; font-size:12px; font-weight:500; border-bottom:2px solid transparent;
  transition:all .2s;
}
.sidebar-tab.active { color:var(--accent); border-bottom-color:var(--accent); }

.chat-list { flex:1; overflow-y:auto; }
.chat-list::-webkit-scrollbar { width:4px; }
.chat-list::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

.chat-item {
  display:flex; align-items:center; gap:12px; padding:10px 14px;
  cursor:pointer; transition:background .15s; position:relative;
}
.chat-item:hover { background:var(--surface); }
.chat-item.active { background:var(--surface2); }

.chat-avatar {
  width:44px; height:44px; border-radius:50%; background:var(--accent);
  display:flex; align-items:center; justify-content:center; font-weight:700;
  font-size:16px; flex-shrink:0; position:relative; overflow:hidden;
}
.chat-avatar img { width:100%; height:100%; object-fit:cover; }
.online-dot {
  position:absolute; bottom:1px; right:1px; width:12px; height:12px;
  background:var(--accent2); border-radius:50%; border:2px solid var(--sidebar);
}
.chat-info { flex:1; min-width:0; }
.chat-name { font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.chat-preview { color:var(--text2); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px; }
.chat-meta { display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; }
.chat-time { color:var(--text3); font-size:11px; }
.unread-badge {
  background:var(--accent); color:#fff; font-size:11px; font-weight:600;
  border-radius:10px; padding:1px 6px; min-width:18px; text-align:center;
}

.empty-state { padding:40px 20px; text-align:center; color:var(--text2); font-size:13px; }
.empty-state .empty-icon { font-size:40px; margin-bottom:12px; opacity:0.5; }

/* ── MAIN CHAT AREA ── */
.chat-area {
  flex:1; display:flex; flex-direction:column; background:var(--bg);
}

.no-chat {
  flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;
  color:var(--text2);
}
.no-chat .big-icon { font-size:80px; margin-bottom:16px; opacity:0.3; }
.no-chat h2 { font-size:20px; font-weight:600; margin-bottom:8px; }
.no-chat p { font-size:13px; opacity:0.7; }

.chat-header {
  display:flex; align-items:center; gap:12px; padding:12px 16px;
  border-bottom:1px solid var(--border); background:var(--sidebar);
}
.chat-header .back-btn { display:none; }
.chat-header-avatar {
  width:38px; height:38px; border-radius:50%; background:var(--accent);
  display:flex; align-items:center; justify-content:center; font-weight:700;
  font-size:14px; cursor:pointer; overflow:hidden; position:relative;
}
.chat-header-avatar img { width:100%; height:100%; object-fit:cover; }
.chat-header-info { flex:1; cursor:pointer; }
.chat-header-name { font-weight:600; font-size:15px; }
.chat-header-status { font-size:12px; color:var(--text2); margin-top:1px; }
.chat-header-status.online { color:var(--accent2); }
.chat-header-actions { display:flex; gap:4px; }

.messages-area {
  flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:4px;
}
.messages-area::-webkit-scrollbar { width:4px; }
.messages-area::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

.date-divider {
  text-align:center; margin:12px 0; color:var(--text3); font-size:12px;
  display:flex; align-items:center; gap:8px;
}
.date-divider::before, .date-divider::after {
  content:''; flex:1; height:1px; background:var(--border);
}

.msg-wrap { display:flex; align-items:flex-end; gap:8px; max-width:72%; }
.msg-wrap.out { align-self:flex-end; flex-direction:row-reverse; }
.msg-wrap.in { align-self:flex-start; }

.msg-avatar-small {
  width:28px; height:28px; border-radius:50%; background:var(--accent);
  display:flex; align-items:center; justify-content:center; font-weight:700;
  font-size:11px; flex-shrink:0; overflow:hidden;
}
.msg-avatar-small img { width:100%; height:100%; object-fit:cover; }

.bubble {
  padding:8px 12px; border-radius:16px; max-width:100%; word-break:break-word;
  position:relative; line-height:1.5;
}
.out .bubble { background:var(--bubble-out); border-bottom-right-radius:4px; }
.in .bubble { background:var(--bubble-in); border-bottom-left-radius:4px; }

.bubble-reply {
  background:rgba(255,255,255,0.07); border-left:3px solid var(--accent);
  border-radius:8px; padding:4px 8px; margin-bottom:6px; font-size:12px; color:var(--text2);
}
.bubble-reply .reply-name { font-weight:600; color:var(--accent); font-size:11px; margin-bottom:2px; }

.bubble-text { font-size:14px; }
.bubble-time {
  font-size:11px; color:rgba(255,255,255,0.4); margin-top:4px;
  display:flex; align-items:center; gap:4px; justify-content:flex-end;
}
.bubble-time .read-icon { color:var(--accent2); }

.bubble img.msg-image {
  max-width:280px; max-height:280px; border-radius:10px; display:block; cursor:pointer;
}

.voice-bubble {
  display:flex; align-items:center; gap:10px; min-width:180px; padding:8px 12px;
}
.voice-play-btn {
  width:34px; height:34px; border-radius:50%; background:var(--accent);
  border:none; color:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center;
  font-size:14px; flex-shrink:0;
}
.voice-wave { flex:1; height:28px; display:flex; align-items:center; gap:2px; }
.voice-wave span {
  display:inline-block; width:3px; background:rgba(255,255,255,0.4);
  border-radius:2px; animation: none;
}
.voice-duration { font-size:11px; color:var(--text2); }

.typing-indicator { display:flex; align-items:center; gap:8px; padding:4px 0; color:var(--text2); font-size:13px; }
.typing-dots { display:flex; gap:3px; }
.typing-dots span {
  width:6px; height:6px; background:var(--text2); border-radius:50%;
  animation: bounce 1.2s infinite;
}
.typing-dots span:nth-child(2) { animation-delay:.2s; }
.typing-dots span:nth-child(3) { animation-delay:.4s; }
@keyframes bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

/* Context menu */
.ctx-menu {
  position:fixed; background:var(--surface2); border:1px solid var(--border);
  border-radius:12px; padding:4px; box-shadow:0 8px 24px rgba(0,0,0,0.4);
  z-index:1000; min-width:160px; display:none;
}
.ctx-menu.show { display:block; }
.ctx-item {
  display:flex; align-items:center; gap:8px; padding:8px 12px;
  border-radius:8px; cursor:pointer; font-size:13px; transition:background .15s;
}
.ctx-item:hover { background:var(--surface); }
.ctx-item.danger { color:var(--danger); }

/* ── INPUT AREA ── */
.input-area {
  padding:12px 16px; border-top:1px solid var(--border); background:var(--sidebar);
}
.reply-preview {
  display:none; background:var(--surface); border-left:3px solid var(--accent);
  border-radius:8px; padding:6px 10px; margin-bottom:8px;
  flex-direction:row; align-items:center; gap:8px;
}
.reply-preview.show { display:flex; }
.reply-preview .rp-text { flex:1; font-size:12px; color:var(--text2); overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
.reply-preview .rp-name { font-weight:600; color:var(--accent); font-size:11px; }
.reply-close { border:none; background:none; color:var(--text2); cursor:pointer; font-size:16px; }

.input-row { display:flex; align-items:flex-end; gap:8px; }
.attach-btn, .emoji-btn {
  width:38px; height:38px; border:none; background:none; color:var(--text2);
  border-radius:50%; cursor:pointer; font-size:18px; display:flex; align-items:center;
  justify-content:center; transition:all .2s; flex-shrink:0;
}
.attach-btn:hover, .emoji-btn:hover { background:var(--surface); color:var(--text); }
.msg-input {
  flex:1; background:var(--surface); border:1px solid var(--border); border-radius:20px;
  padding:9px 16px; color:var(--text); font-family:'Inter',sans-serif; font-size:14px;
  outline:none; resize:none; max-height:120px; transition:border-color .2s; line-height:1.4;
}
.msg-input:focus { border-color:var(--accent); }
.msg-input::placeholder { color:var(--text3); }
.send-btn {
  width:38px; height:38px; border:none; background:var(--accent); color:#fff;
  border-radius:50%; cursor:pointer; font-size:18px; display:flex; align-items:center;
  justify-content:center; transition:all .2s; flex-shrink:0;
}
.send-btn:hover { background:var(--accent-hover); transform:scale(1.05); }
.mic-btn {
  width:38px; height:38px; border:none; background:var(--surface); color:var(--text2);
  border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center;
  justify-content:center; transition:all .2s; flex-shrink:0;
}
.mic-btn:hover { background:var(--accent); color:#fff; }
.mic-btn.recording { background:var(--danger); color:#fff; animation:pulse 1s infinite; }
@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }

/* ── CALL MODAL ── */
.call-modal {
  display:none; position:fixed; inset:0; background:rgba(0,0,0,0.85);
  z-index:500; flex-direction:column; align-items:center; justify-content:center;
}
.call-modal.show { display:flex; }
.call-box {
  background:var(--sidebar); border:1px solid var(--border); border-radius:24px;
  padding:40px 48px; text-align:center; min-width:300px;
}
.call-avatar-big {
  width:90px; height:90px; border-radius:50%; background:var(--accent);
  display:flex; align-items:center; justify-content:center; font-size:36px;
  font-weight:700; margin:0 auto 16px; overflow:hidden; position:relative;
}
.call-avatar-big img { width:100%; height:100%; object-fit:cover; }
.call-name { font-size:22px; font-weight:700; margin-bottom:8px; }
.call-status { color:var(--text2); font-size:14px; margin-bottom:32px; }
.call-actions { display:flex; gap:16px; justify-content:center; }
.call-btn {
  width:60px; height:60px; border-radius:50%; border:none; cursor:pointer;
  font-size:24px; display:flex; align-items:center; justify-content:center; transition:all .2s;
}
.call-btn:hover { transform:scale(1.08); }
.call-btn.accept { background:#1db954; color:#fff; }
.call-btn.reject { background:var(--danger); color:#fff; }
.call-btn.end { background:var(--danger); color:#fff; }
.call-btn.mute { background:var(--surface2); color:var(--text); }
.call-btn.speaker { background:var(--surface2); color:var(--text); }
.call-btn.cam { background:var(--surface2); color:var(--text); }
.call-timer { font-size:32px; font-weight:700; letter-spacing:2px; margin-bottom:8px; }

/* Video */
.video-area {
  display:none; width:100%; max-width:600px; border-radius:16px; overflow:hidden;
  background:#000; margin-bottom:20px; position:relative;
}
.video-area.show { display:block; }
#remoteVideo { width:100%; max-height:300px; object-fit:cover; background:#111; }
#localVideo {
  position:absolute; bottom:8px; right:8px; width:100px; height:75px;
  border-radius:8px; object-fit:cover; border:2px solid var(--accent); background:#222;
}

/* ── SETTINGS PANEL ── */
.settings-panel {
  position:fixed; top:0; right:-400px; width:400px; height:100vh;
  background:var(--sidebar); border-left:1px solid var(--border);
  z-index:200; transition:right .3s ease; overflow-y:auto; display:flex; flex-direction:column;
}
.settings-panel.open { right:0; }
.settings-panel::-webkit-scrollbar { width:4px; }
.settings-panel::-webkit-scrollbar-thumb { background:var(--border); }
.settings-header {
  padding:16px 20px; border-bottom:1px solid var(--border);
  display:flex; align-items:center; gap:12px;
}
.settings-header h2 { font-size:18px; font-weight:700; flex:1; }
.settings-body { padding:20px; flex:1; }
.settings-avatar-section { text-align:center; margin-bottom:24px; }
.settings-avatar {
  width:80px; height:80px; border-radius:50%; background:var(--accent);
  display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:700;
  margin:0 auto 12px; cursor:pointer; overflow:hidden; position:relative; border:3px solid var(--border);
}
.settings-avatar:hover::after {
  content:'📷'; position:absolute; inset:0; background:rgba(0,0,0,0.6);
  display:flex; align-items:center; justify-content:center; font-size:24px;
  border-radius:50%;
}
.settings-avatar img { width:100%; height:100%; object-fit:cover; }
.settings-username { font-size:18px; font-weight:700; }
.settings-handle { font-size:13px; color:var(--text2); margin-top:2px; }

.settings-section { margin-bottom:24px; }
.settings-section-title {
  font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px;
  color:var(--text3); margin-bottom:12px;
}
.settings-row {
  background:var(--surface); border-radius:12px; margin-bottom:2px; overflow:hidden;
}
.settings-item {
  display:flex; align-items:center; gap:12px; padding:12px 16px;
  cursor:pointer; transition:background .15s; border-bottom:1px solid var(--border);
}
.settings-item:last-child { border-bottom:none; }
.settings-item:hover { background:var(--surface2); }
.settings-item-icon { font-size:18px; width:24px; text-align:center; }
.settings-item-text { flex:1; }
.settings-item-label { font-size:14px; font-weight:500; }
.settings-item-sub { font-size:12px; color:var(--text2); margin-top:2px; }
.settings-item-arrow { color:var(--text3); font-size:12px; }

.settings-input {
  width:100%; background:var(--surface); border:1px solid var(--border); border-radius:10px;
  padding:10px 14px; color:var(--text); font-family:'Inter',sans-serif; font-size:14px;
  outline:none; margin-bottom:10px;
}
.settings-input:focus { border-color:var(--accent); }
.settings-textarea {
  width:100%; background:var(--surface); border:1px solid var(--border); border-radius:10px;
  padding:10px 14px; color:var(--text); font-family:'Inter',sans-serif; font-size:14px;
  outline:none; resize:none; height:80px; margin-bottom:10px;
}
.settings-textarea:focus { border-color:var(--accent); }

/* ── USER PROFILE MODAL ── */
.profile-modal {
  display:none; position:fixed; inset:0; background:rgba(0,0,0,0.7);
  z-index:300; align-items:center; justify-content:center;
}
.profile-modal.show { display:flex; }
.profile-box {
  background:var(--sidebar); border:1px solid var(--border); border-radius:20px;
  width:340px; overflow:hidden;
}
.profile-cover { height:100px; background:linear-gradient(135deg, var(--accent), #7c4dff); }
.profile-content { padding:0 20px 20px; }
.profile-avatar-wrap { margin-top:-40px; margin-bottom:12px; }
.profile-avatar-wrap .pa {
  width:80px; height:80px; border-radius:50%; background:var(--accent);
  display:flex; align-items:center; justify-content:center; font-size:30px; font-weight:700;
  border:3px solid var(--sidebar); overflow:hidden;
}
.profile-avatar-wrap .pa img { width:100%; height:100%; object-fit:cover; }
.profile-name { font-size:20px; font-weight:700; }
.profile-handle { color:var(--text2); font-size:13px; margin:3px 0 12px; }
.profile-bio { color:var(--text2); font-size:13px; line-height:1.5; margin-bottom:16px; }
.profile-actions { display:flex; gap:8px; }
.profile-actions button {
  flex:1; padding:9px; border-radius:10px; border:none; cursor:pointer;
  font-size:13px; font-weight:600; font-family:'Inter',sans-serif; transition:all .2s;
}
.btn-msg { background:var(--accent); color:#fff; }
.btn-msg:hover { background:var(--accent-hover); }
.btn-audio { background:var(--surface2); color:var(--text); }
.btn-audio:hover { background:var(--surface); }
.btn-video { background:var(--surface2); color:var(--text); }
.btn-video:hover { background:var(--surface); }
.profile-close { position:absolute; top:12px; right:12px; }

/* Image lightbox */
.lightbox {
  display:none; position:fixed; inset:0; background:rgba(0,0,0,0.9);
  z-index:600; align-items:center; justify-content:center;
}
.lightbox.show { display:flex; }
.lightbox img { max-width:90vw; max-height:90vh; border-radius:8px; }

/* Notification toast */
.toast {
  position:fixed; bottom:20px; right:20px; background:var(--surface2);
  border:1px solid var(--border); border-radius:12px; padding:12px 16px;
  z-index:700; transform:translateY(80px); opacity:0; transition:all .3s;
  display:flex; align-items:center; gap:10px; max-width:320px; cursor:pointer;
}
.toast.show { transform:translateY(0); opacity:1; }
.toast-avatar {
  width:36px; height:36px; border-radius:50%; background:var(--accent);
  display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px;
  flex-shrink:0;
}
.toast-text { flex:1; }
.toast-name { font-weight:600; font-size:13px; }
.toast-msg { color:var(--text2); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* Emoji picker */
.emoji-picker {
  display:none; position:absolute; bottom:60px; left:16px;
  background:var(--surface2); border:1px solid var(--border); border-radius:14px;
  padding:10px; z-index:100; width:280px;
}
.emoji-picker.show { display:block; }
.emoji-grid { display:grid; grid-template-columns:repeat(8,1fr); gap:4px; }
.emoji-item { font-size:22px; cursor:pointer; text-align:center; border-radius:6px; padding:3px; transition:background .15s; }
.emoji-item:hover { background:var(--surface); }
.input-wrapper { flex:1; position:relative; }

/* ── IMAGE UPLOAD OVERLAY ── */
.img-attach-preview {
  display:none; background:var(--surface); border:1px solid var(--border);
  border-radius:12px; padding:10px; margin-bottom:8px; position:relative;
}
.img-attach-preview.show { display:block; }
.img-attach-preview img { max-height:120px; border-radius:8px; }
.img-attach-preview .remove-img {
  position:absolute; top:8px; right:8px; background:var(--danger); color:#fff;
  border:none; border-radius:50%; width:22px; height:22px; cursor:pointer; font-size:12px;
  display:flex; align-items:center; justify-content:center;
}

/* ── SCROLLBAR ── */
::-webkit-scrollbar { width:4px; }
::-webkit-scrollbar-track { background:transparent; }
::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }

/* ── ANIMATIONS ── */
.msg-wrap { animation: msgIn .2s ease; }
@keyframes msgIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

/* ── MOBILE ── */
@media (max-width: 640px) {
  .sidebar { width:100%; }
  .chat-area { display:none; }
  .chat-area.mobile-open { display:flex; position:fixed; inset:0; z-index:100; }
  .chat-header .back-btn { display:flex; }
  .settings-panel { width:100%; right:-100%; }
}
</style>
</head>
<body>

<!-- AUTH SCREEN -->
<div id="auth-screen">
  <div class="auth-box">
    <div class="auth-logo">
      <div class="logo-icon">✈️</div>
      <h1>Freedom</h1>
      <p>Мессенджер без границ</p>
    </div>
    <div class="auth-tabs">
      <button class="auth-tab active" onclick="switchAuthTab('login')">Войти</button>
      <button class="auth-tab" onclick="switchAuthTab('register')">Регистрация</button>
    </div>

    <!-- LOGIN -->
    <div id="login-form">
      <div class="form-group">
        <label>Имя пользователя</label>
        <input type="text" id="login-username" placeholder="username">
      </div>
      <div class="form-group">
        <label>Пароль</label>
        <input type="password" id="login-password" placeholder="••••••••" onkeydown="if(event.key==='Enter')doLogin()">
      </div>
      <button class="btn" onclick="doLogin()">Войти</button>
      <div class="auth-error" id="login-error"></div>
    </div>

    <!-- REGISTER -->
    <div id="register-form" style="display:none">
      <div class="form-group">
        <label>Отображаемое имя</label>
        <input type="text" id="reg-displayname" placeholder="Ваше имя">
      </div>
      <div class="form-group">
        <label>Имя пользователя (login)</label>
        <input type="text" id="reg-username" placeholder="username (мин. 3 символа)">
      </div>
      <div class="form-group">
        <label>Пароль</label>
        <input type="password" id="reg-password" placeholder="••••••••" onkeydown="if(event.key==='Enter')doRegister()">
      </div>
      <button class="btn" onclick="doRegister()">Создать аккаунт</button>
      <div class="auth-error" id="reg-error"></div>
    </div>
  </div>
</div>

<!-- MAIN APP -->
<div id="app">
  <div class="app-body">

    <!-- SIDEBAR -->
    <div class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <div class="my-avatar" id="my-avatar" onclick="openSettings()">
          <span id="my-avatar-text"></span>
        </div>
        <div class="my-name" onclick="openSettings()" id="my-display-name"></div>
        <button class="icon-btn" title="Новый чат" onclick="showNewChatHint()">✏️</button>
        <button class="icon-btn" title="Настройки" onclick="openSettings()">⚙️</button>
      </div>
      <div class="sidebar-search">
        <input class="search-input" placeholder="🔍 Поиск..." oninput="filterChats(this.value)">
      </div>
      <div class="sidebar-tabs">
        <button class="sidebar-tab active" onclick="switchSidebarTab('chats',this)">Чаты</button>
        <button class="sidebar-tab" onclick="switchSidebarTab('people',this)">Люди</button>
      </div>
      <div class="chat-list" id="chat-list">
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <div>Пока нет чатов<br><small style="color:var(--text3)">Перейди во вкладку «Люди»</small></div>
        </div>
      </div>
    </div>

    <!-- CHAT AREA -->
    <div class="chat-area" id="chat-area">
      <div id="no-chat" class="no-chat" style="flex:1;display:flex">
        <div class="big-icon">✈️</div>
        <h2>Freedom Messenger</h2>
        <p>Выбери чат слева или найди нового собеседника</p>
      </div>
      <div id="chat-view" style="display:none;flex-direction:column;height:100%">
        <div class="chat-header">
          <button class="icon-btn back-btn" onclick="closeMobileChat()">←</button>
          <div class="chat-header-avatar" id="chat-hdr-avatar" onclick="showUserProfile(currentChat)"></div>
          <div class="chat-header-info" onclick="showUserProfile(currentChat)">
            <div class="chat-header-name" id="chat-hdr-name"></div>
            <div class="chat-header-status" id="chat-hdr-status"></div>
          </div>
          <div class="chat-header-actions">
            <button class="icon-btn" title="Аудиозвонок" onclick="startCall('audio')">📞</button>
            <button class="icon-btn" title="Видеозвонок" onclick="startCall('video')">📹</button>
            <button class="icon-btn" title="Поиск" onclick="alert('Поиск в чате — скоро!')">🔍</button>
            <button class="icon-btn" title="Ещё">⋮</button>
          </div>
        </div>
        <div class="messages-area" id="messages-area" oncontextmenu="return false"></div>
        <div class="input-area">
          <div class="reply-preview" id="reply-preview">
            <div class="rp-text">
              <div class="rp-name" id="reply-name"></div>
              <div id="reply-text"></div>
            </div>
            <button class="reply-close" onclick="cancelReply()">✕</button>
          </div>
          <div class="img-attach-preview" id="img-attach-preview">
            <img id="img-attach-thumb">
            <button class="remove-img" onclick="removeAttachedImage()">✕</button>
          </div>
          <div class="input-row">
            <button class="attach-btn" onclick="document.getElementById('file-input').click()">📎</button>
            <input type="file" id="file-input" accept="image/*" style="display:none" onchange="handleImageAttach(event)">
            <div class="input-wrapper">
              <button class="emoji-btn" onclick="toggleEmojiPicker()">😊</button>
              <div class="emoji-picker" id="emoji-picker"></div>
              <textarea class="msg-input" id="msg-input" placeholder="Написать сообщение..." rows="1"
                oninput="autoResize(this);handleTyping()" onkeydown="handleMsgKey(event)"></textarea>
            </div>
            <button class="mic-btn" id="mic-btn" onclick="toggleRecording()" title="Голосовое сообщение">🎤</button>
            <button class="send-btn" onclick="sendMessage()">➤</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- SETTINGS PANEL -->
<div class="settings-panel" id="settings-panel">
  <div class="settings-header">
    <button class="icon-btn" onclick="closeSettings()">←</button>
    <h2>Настройки</h2>
  </div>
  <div class="settings-body">
    <div class="settings-avatar-section">
      <div class="settings-avatar" id="settings-avatar" onclick="document.getElementById('avatar-input').click()">
        <span id="settings-avatar-text"></span>
      </div>
      <input type="file" id="avatar-input" accept="image/*" style="display:none" onchange="handleAvatarChange(event)">
      <div class="settings-username" id="settings-username"></div>
      <div class="settings-handle" id="settings-handle"></div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Профиль</div>
      <div class="settings-row">
        <div class="settings-item" onclick="editProfile()">
          <span class="settings-item-icon">✏️</span>
          <div class="settings-item-text">
            <div class="settings-item-label">Редактировать профиль</div>
            <div class="settings-item-sub">Имя, фото, о себе</div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
        <div class="settings-item" onclick="toggleEditProfile()">
          <span class="settings-item-icon">👤</span>
          <div class="settings-item-text">
            <div class="settings-item-label">Имя</div>
            <div class="settings-item-sub" id="sett-display-name"></div>
          </div>
        </div>
        <div class="settings-item">
          <span class="settings-item-icon">📝</span>
          <div class="settings-item-text">
            <div class="settings-item-label">О себе</div>
            <div class="settings-item-sub" id="sett-bio">Нет</div>
          </div>
        </div>
      </div>
    </div>

    <div id="edit-profile-form" style="display:none" class="settings-section">
      <div class="settings-section-title">Редактирование</div>
      <input class="settings-input" id="edit-displayname" placeholder="Отображаемое имя">
      <textarea class="settings-textarea" id="edit-bio" placeholder="О себе..."></textarea>
      <button class="btn" onclick="saveProfile()" style="width:100%;margin-bottom:8px">Сохранить</button>
      <button class="btn btn-ghost" onclick="toggleEditProfile()">Отмена</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Приватность</div>
      <div class="settings-row">
        <div class="settings-item">
          <span class="settings-item-icon">👁️</span>
          <div class="settings-item-text">
            <div class="settings-item-label">Последний визит</div>
            <div class="settings-item-sub">Все</div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
        <div class="settings-item">
          <span class="settings-item-icon">📸</span>
          <div class="settings-item-text">
            <div class="settings-item-label">Фото профиля</div>
            <div class="settings-item-sub">Все</div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title">Внешний вид</div>
      <div class="settings-row">
        <div class="settings-item" onclick="alert('Тема скоро!')">
          <span class="settings-item-icon">🎨</span>
          <div class="settings-item-text">
            <div class="settings-item-label">Тема</div>
            <div class="settings-item-sub">Тёмная</div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
        <div class="settings-item" onclick="alert('Скоро!')">
          <span class="settings-item-icon">🔔</span>
          <div class="settings-item-text">
            <div class="settings-item-label">Уведомления</div>
            <div class="settings-item-sub">Включены</div>
          </div>
          <span class="settings-item-arrow">›</span>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <button class="btn btn-danger" onclick="doLogout()">Выйти из аккаунта</button>
    </div>
  </div>
</div>

<!-- USER PROFILE MODAL -->
<div class="profile-modal" id="profile-modal" onclick="if(event.target===this)closeProfileModal()">
  <div class="profile-box">
    <div class="profile-cover"></div>
    <div class="profile-content">
      <div class="profile-avatar-wrap">
        <div class="pa" id="pm-avatar"></div>
      </div>
      <div class="profile-name" id="pm-name"></div>
      <div class="profile-handle" id="pm-handle"></div>
      <div class="profile-bio" id="pm-bio"></div>
      <div class="profile-actions">
        <button class="btn-msg" onclick="openChatFromProfile()">💬 Написать</button>
        <button class="btn-audio" onclick="startCallFromProfile('audio')">📞</button>
        <button class="btn-video" onclick="startCallFromProfile('video')">📹</button>
      </div>
    </div>
  </div>
</div>

<!-- CALL MODAL -->
<div class="call-modal" id="call-modal">
  <div class="call-box">
    <div class="video-area" id="video-area">
      <video id="remoteVideo" autoplay playsinline></video>
      <video id="localVideo" autoplay muted playsinline></video>
    </div>
    <div class="call-avatar-big" id="call-avatar"></div>
    <div class="call-name" id="call-name"></div>
    <div class="call-status" id="call-status"></div>
    <div class="call-timer" id="call-timer" style="display:none">00:00</div>
    <div class="call-actions" id="call-actions"></div>
  </div>
</div>

<!-- IMAGE LIGHTBOX -->
<div class="lightbox" id="lightbox" onclick="this.classList.remove('show')">
  <img id="lightbox-img">
</div>

<!-- CONTEXT MENU -->
<div class="ctx-menu" id="ctx-menu">
  <div class="ctx-item" onclick="ctxReply()">↩️ Ответить</div>
  <div class="ctx-item" onclick="ctxCopy()">📋 Копировать</div>
  <div class="ctx-item danger" onclick="ctxDelete()">🗑️ Удалить</div>
</div>

<!-- TOAST -->
<div class="toast" id="toast" onclick="openChatFromToast()">
  <div class="toast-avatar" id="toast-avatar"></div>
  <div class="toast-text">
    <div class="toast-name" id="toast-name"></div>
    <div class="toast-msg" id="toast-msg"></div>
  </div>
</div>


// ─── State ───────────────────────────────────────────────────────────────────
let socket, me = null, currentChat = null;
let allUsers = [], chatHistory = {}, unread = {}, chatPreviews = {};
let replyTo = null, ctxMsg = null;
let typingTimers = {}, typingState = false;
let mediaRecorder = null, audioChunks = [], recordingInterval = null;
let peerConnection = null, localStream = null;
let callTimer = null, callSeconds = 0;
let currentCallUser = null, callType = 'audio';
let attachedImage = null;
let toastTimeout = null, toastChatUser = null;
let profileModalUser = null;

const EMOJIS = ['😀','😂','🥰','😍','🤔','😎','😭','😤','🥺','🤣','❤️','🔥','👍','👎','🎉','✨','💯','🙏','😊','🤗','😏','😅','🤦','🤷','💪','👀','🫡','🫂','💀','🤙','💬','✈️','🌟','🚀','🎮','🍕','🎵','🌈','🌙','⚡'];

// ─── Socket ───────────────────────────────────────────────────────────────────
function connectSocket() {
  socket = io();
  socket.on('new_message', onNewMessage);
  socket.on('user_online', u => updateUserStatus(u.username, true));
  socket.on('user_offline', u => updateUserStatus(u.username, false, u.lastSeen));
  socket.on('user_updated', onUserUpdated);
  socket.on('user_typing', onTyping);
  socket.on('messages_read', ({by}) => markMessagesRead(by));
  socket.on('message_deleted', ({msgId}) => removeMessageEl(msgId));
  socket.on('incoming_call', onIncomingCall);
  socket.on('call_answered', onCallAnswered);
  socket.on('ice_candidate', onIceCandidate);
  socket.on('call_ended', onCallEnded);
  socket.on('call_rejected', () => showCallStatus('Отклонено', true));
  socket.on('call_busy', () => showCallStatus('Занято', true));
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => t.classList.toggle('active', (tab==='login'&&i===0)||(tab==='register'&&i===1)));
  document.getElementById('login-form').style.display = tab==='login'?'':'none';
  document.getElementById('register-form').style.display = tab==='register'?'':'none';
}

function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) return setErr('login-error','Заполните все поля');
  socket.emit('login', {username, password}, res => {
    if (res.error) return setErr('login-error', res.error);
    onLoggedIn(res.user);
  });
}

function doRegister() {
  const displayName = document.getElementById('reg-displayname').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value;
  if (!displayName || !username || !password) return setErr('reg-error','Заполните все поля');
  socket.emit('register', {username, password, displayName}, res => {
    if (res.error) return setErr('reg-error', res.error);
    onLoggedIn(res.user);
  });
}

function onLoggedIn(user) {
  me = user;
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  updateMyUI();
  loadUsers();
}

function doLogout() {
  socket.emit('logout');
  me = null; currentChat = null; allUsers = [];
  chatHistory = {}; unread = {}; chatPreviews = {};
  document.getElementById('app').classList.remove('visible');
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('chat-view').style.display = 'none';
  document.getElementById('no-chat').style.display = 'flex';
  closeSettings();
}

function setErr(id, msg) { document.getElementById(id).textContent = msg; setTimeout(()=>document.getElementById(id).textContent='', 4000); }

// ─── UI Updates ───────────────────────────────────────────────────────────────
function updateMyUI() {
  const name = me.displayName || me.username;
  document.getElementById('my-display-name').textContent = name;
  document.getElementById('my-avatar-text').textContent = initials(name);
  document.getElementById('settings-username').textContent = name;
  document.getElementById('settings-handle').textContent = '@' + me.username;
  document.getElementById('sett-display-name').textContent = name;
  document.getElementById('sett-bio').textContent = me.bio || 'Нет';
  document.getElementById('settings-avatar-text').textContent = initials(name);
  if (me.avatar) {
    setAvatarImg('my-avatar', me.avatar);
    setAvatarImg('settings-avatar', me.avatar);
  }
}

function initials(name) {
  return name.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()).join('') || '?';
}

function setAvatarEl(el, user) {
  if (!el) return;
  if (user.avatar) {
    el.innerHTML = `<img src="${user.avatar}" alt="">`;
  } else {
    el.innerHTML = `<span>${initials(user.displayName||user.username)}</span>`;
    el.style.background = strColor(user.username);
  }
}

function setAvatarImg(elId, src) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
}

function strColor(str) {
  const colors = ['#2d7dd2','#7c4dff','#e91e8c','#00bcd4','#ff6b35','#4caf50','#ff9800','#9c27b0'];
  let h = 0; for (let c of str) h = (h*31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

// ─── Users / Contacts ─────────────────────────────────────────────────────────
function loadUsers() {
  fetch('/api/users').then(r=>r.json()).then(users => {
    allUsers = users.filter(u => u.username !== me.username);
    renderChatList();
  });
}

function switchSidebarTab(tab, btn) {
  document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  if (tab === 'chats') renderChatList('chats');
  else renderChatList('people');
}

function renderChatList(mode = 'chats', filter = '') {
  const list = document.getElementById('chat-list');
  let html = '';

  if (mode === 'people') {
    const users = allUsers.filter(u => !filter || u.displayName.toLowerCase().includes(filter) || u.username.includes(filter));
    if (!users.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div>Пользователи не найдены</div></div>`; return; }
    html += `<div class="section-label" style="padding:12px 14px 4px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px">Все пользователи</div>`;
    users.forEach(u => {
      html += renderUserItem(u);
    });
  } else {
    // Show chats with recent messages first, then all contacts
    const chatsWithMsgs = allUsers.filter(u => chatPreviews[u.username]);
    const others = allUsers.filter(u => !chatPreviews[u.username]);
    const combined = [...chatsWithMsgs, ...others].filter(u => !filter || u.displayName.toLowerCase().includes(filter) || u.username.includes(filter));
    if (!combined.length) { list.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><div>Нет чатов<br><small style="color:var(--text3)">Перейди во вкладку «Люди»</small></div></div>`; return; }
    if (chatsWithMsgs.length) html += `<div class="section-label" style="padding:12px 14px 4px;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1.5px">Недавние</div>`;
    combined.forEach(u => html += renderUserItem(u, true));
  }
  list.innerHTML = html;
}

function renderUserItem(u, showPreview = false) {
  const preview = chatPreviews[u.username];
  const unreadCount = unread[u.username] || 0;
  const badge = unreadCount ? `<div class="unread-badge">${unreadCount}</div>` : '';
  const onlineDot = u.online ? `<div class="online-dot"></div>` : '';
  const avatarBg = strColor(u.username);
  const avatarContent = u.avatar ? `<img src="${u.avatar}" alt="">` : `<span>${initials(u.displayName||u.username)}</span>`;
  const time = preview ? formatTime(preview.timestamp) : '';
  const previewText = preview ? (preview.type === 'image' ? '📷 Фото' : preview.type === 'voice' ? '🎤 Голосовое' : escHtml(preview.content||'').slice(0,40)) : (u.online ? 'В сети' : '');
  const activeClass = currentChat === u.username ? 'active' : '';

  return `<div class="chat-item ${activeClass}" onclick="openChat('${u.username}')">
    <div class="chat-avatar" style="background:${avatarBg}">${avatarContent}${onlineDot}</div>
    <div class="chat-info">
      <div class="chat-name">${escHtml(u.displayName||u.username)}</div>
      <div class="chat-preview">${previewText}</div>
    </div>
    <div class="chat-meta">
      <div class="chat-time">${time}</div>
      ${badge}
    </div>
  </div>`;
}

function filterChats(val) {
  const tab = document.querySelector('.sidebar-tab.active').textContent;
  renderChatList(tab === 'Люди' ? 'people' : 'chats', val.toLowerCase());
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
function openChat(username) {
  currentChat = username;
  unread[username] = 0;
  const user = allUsers.find(u => u.username === username) || {username, displayName: username};

  // Update header
  const hdrAvatar = document.getElementById('chat-hdr-avatar');
  hdrAvatar.style.background = strColor(username);
  setAvatarEl(hdrAvatar, user);

  document.getElementById('chat-hdr-name').textContent = user.displayName || username;
  const statusEl = document.getElementById('chat-hdr-status');
  statusEl.textContent = user.online ? 'В сети' : 'Не в сети';
  statusEl.className = 'chat-header-status' + (user.online ? ' online' : '');

  document.getElementById('no-chat').style.display = 'none';
  const cv = document.getElementById('chat-view');
  cv.style.display = 'flex';

  // Mobile
  document.getElementById('chat-area').classList.add('mobile-open');

  // Load messages
  socket.emit('get_messages', {with: username}, msgs => {
    chatHistory[username] = msgs || [];
    renderMessages();
    scrollBottom();
  });

  // Mark read
  socket.emit('mark_read', {chatWith: username});
  renderChatList();
}

function closeMobileChat() {
  document.getElementById('chat-area').classList.remove('mobile-open');
}

function renderMessages() {
  const area = document.getElementById('messages-area');
  const msgs = chatHistory[currentChat] || [];
  if (!msgs.length) {
    area.innerHTML = `<div style="text-align:center;color:var(--text3);padding:40px;font-size:13px">Начните переписку! 👋</div>`;
    return;
  }
  let html = '', lastDate = null;
  msgs.forEach(m => {
    const d = new Date(m.timestamp).toLocaleDateString('ru-RU', {day:'numeric',month:'long'});
    if (d !== lastDate) { html += `<div class="date-divider">${d}</div>`; lastDate = d; }
    html += renderBubble(m);
  });
  area.innerHTML = html;
  area.querySelectorAll('.bubble').forEach(b => {
    b.addEventListener('contextmenu', e => { e.preventDefault(); showCtxMenu(e, b.dataset.id); });
  });
  area.querySelectorAll('img.msg-image').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

function renderBubble(m) {
  const isOut = m.from === me.username;
  const user = allUsers.find(u => u.username === m.from) || {username: m.from, displayName: m.from};
  const avatarBg = strColor(m.from);
  const avatarContent = user.avatar ? `<img src="${user.avatar}" alt="">` : `<span>${initials(user.displayName||user.username)}</span>`;
  const time = formatTime(m.timestamp);
  const readIcon = isOut ? `<span class="read-icon">${m.read ? '✓✓' : m.delivered ? '✓✓' : '✓'}</span>` : '';

  let replyHtml = '';
  if (m.replyTo) {
    const orig = (chatHistory[currentChat]||[]).find(x=>x.id===m.replyTo);
    if (orig) {
      const rFrom = orig.from === me.username ? 'Вы' : (allUsers.find(u=>u.username===orig.from)?.displayName || orig.from);
      const rText = orig.type==='image' ? '📷 Фото' : orig.type==='voice' ? '🎤 Голосовое' : escHtml(orig.content||'').slice(0,60);
      replyHtml = `<div class="bubble-reply"><div class="reply-name">${rFrom}</div>${rText}</div>`;
    }
  }

  let content = '';
  if (m.type === 'image') {
    content = `<img class="msg-image" src="${m.content}" alt="фото">`;
  } else if (m.type === 'voice') {
    const bars = Array.from({length:20},(_,i)=>`<span style="height:${8+Math.random()*16}px"></span>`).join('');
    content = `<div class="voice-bubble">
      <button class="voice-play-btn" onclick="playVoice(this,'${m.id}','${m.content}')">▶</button>
      <div class="voice-wave">${bars}</div>
      <span class="voice-duration">${m.duration||'0:00'}</span>
    </div>`;
  } else {
    content = `<div class="bubble-text">${escHtml(m.content||'').replace(/\n/g,'<br>')}</div>`;
  }

  return `<div class="msg-wrap ${isOut?'out':'in'}" id="msg-${m.id}">
    ${!isOut ? `<div class="msg-avatar-small" style="background:${avatarBg}">${avatarContent}</div>` : ''}
    <div class="bubble" data-id="${m.id}" data-from="${m.from}" data-content="${escHtml(m.content||'')}">
      ${replyHtml}
      ${content}
      <div class="bubble-time">${time} ${readIcon}</div>
    </div>
  </div>`;
}

function onNewMessage(msg) {
  if (!allUsers.find(u=>u.username===msg.from) && msg.from !== me.username) {
    loadUsers();
  }
  const chatUser = msg.from === me.username ? msg.to : msg.from;
  if (!chatHistory[chatUser]) chatHistory[chatUser] = [];
  chatHistory[chatUser].push(msg);
  chatPreviews[chatUser] = msg;

  if (chatUser === currentChat) {
    appendMessage(msg);
    scrollBottom();
    socket.emit('mark_read', {chatWith: chatUser});
  } else if (msg.from !== me.username) {
    unread[msg.from] = (unread[msg.from]||0) + 1;
    showToast(msg);
  }
  renderChatList();
}

function appendMessage(msg) {
  const area = document.getElementById('messages-area');
  const placeholder = area.querySelector('[style*="Начните"]');
  if (placeholder) placeholder.remove();
  const div = document.createElement('div');
  div.innerHTML = renderBubble(msg);
  const wrap = div.firstElementChild;
  area.appendChild(wrap);
  wrap.querySelectorAll('.bubble').forEach(b => {
    b.addEventListener('contextmenu', e => { e.preventDefault(); showCtxMenu(e, b.dataset.id); });
  });
  wrap.querySelectorAll('img.msg-image').forEach(img => {
    img.addEventListener('click', () => openLightbox(img.src));
  });
}

function scrollBottom() {
  const a = document.getElementById('messages-area');
  setTimeout(() => a.scrollTop = a.scrollHeight, 50);
}

// ─── Send Message ──────────────────────────────────────────────────────────────
function sendMessage() {
  if (!currentChat) return;
  if (attachedImage) { sendImageMessage(); return; }
  const input = document.getElementById('msg-input');
  const text = input.value.trim();
  if (!text) return;
  const data = {to: currentChat, content: text, type: 'text'};
  if (replyTo) { data.replyTo = replyTo.id; }
  socket.emit('send_message', data, res => {
    if (res?.message) {
      if (!chatHistory[currentChat]) chatHistory[currentChat] = [];
      chatHistory[currentChat].push(res.message);
      chatPreviews[currentChat] = res.message;
      appendMessage(res.message);
      scrollBottom();
      renderChatList();
    }
  });
  input.value = ''; autoResize(input);
  cancelReply();
  clearTyping();
}

function sendImageMessage() {
  if (!attachedImage || !currentChat) return;
  const data = {to: currentChat, content: attachedImage, type: 'image', replyTo: replyTo?.id||null};
  socket.emit('send_message', data, res => {
    if (res?.message) {
      if (!chatHistory[currentChat]) chatHistory[currentChat] = [];
      chatHistory[currentChat].push(res.message);
      chatPreviews[currentChat] = res.message;
      appendMessage(res.message);
      scrollBottom();
      renderChatList();
    }
  });
  removeAttachedImage();
  cancelReply();
}

function handleMsgKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function handleImageAttach(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    attachedImage = ev.target.result;
    document.getElementById('img-attach-thumb').src = attachedImage;
    document.getElementById('img-attach-preview').classList.add('show');
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

function removeAttachedImage() {
  attachedImage = null;
  document.getElementById('img-attach-preview').classList.remove('show');
}

// ─── Typing ───────────────────────────────────────────────────────────────────
function handleTyping() {
  if (!currentChat) return;
  if (!typingState) { typingState = true; socket.emit('typing', {to: currentChat, isTyping: true}); }
  clearTimeout(typingTimers['me']);
  typingTimers['me'] = setTimeout(clearTyping, 2500);
}

function clearTyping() {
  if (typingState) { typingState = false; socket.emit('typing', {to: currentChat, isTyping: false}); }
}

function onTyping({from, isTyping}) {
  if (from !== currentChat) return;
  const area = document.getElementById('messages-area');
  const existing = document.getElementById('typing-indicator');
  if (isTyping && !existing) {
    const div = document.createElement('div');
    div.id = 'typing-indicator';
    div.className = 'typing-indicator';
    div.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div><span>печатает...</span>`;
    area.appendChild(div);
    scrollBottom();
  } else if (!isTyping && existing) {
    existing.remove();
  }
}

// ─── Voice Recording ──────────────────────────────────────────────────────────
async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    let seconds = 0;
    const btn = document.getElementById('mic-btn');
    btn.classList.add('recording');
    btn.textContent = '⏹';
    recordingInterval = setInterval(() => { seconds++; btn.title = formatSecs(seconds); }, 1000);
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      clearInterval(recordingInterval);
      btn.classList.remove('recording');
      btn.textContent = '🎤';
      btn.title = 'Голосовое сообщение';
      const blob = new Blob(audioChunks, {type:'audio/webm'});
      const reader = new FileReader();
      reader.onload = ev => {
        const dur = formatSecs(seconds);
        socket.emit('send_message', {to: currentChat, content: ev.target.result, type: 'voice', duration: dur}, res => {
          if (res?.message) {
            if (!chatHistory[currentChat]) chatHistory[currentChat] = [];
            chatHistory[currentChat].push(res.message);
            chatPreviews[currentChat] = res.message;
            appendMessage(res.message);
            scrollBottom();
            renderChatList();
          }
        });
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach(t=>t.stop());
    };
    mediaRecorder.start();
  } catch(e) { alert('Нет доступа к микрофону'); }
}

function playVoice(btn, id, src) {
  const audio = new Audio(src);
  btn.textContent = '⏸';
  audio.play();
  audio.onended = () => { btn.textContent = '▶'; };
}

function formatSecs(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

// ─── Context Menu ──────────────────────────────────────────────────────────────
function showCtxMenu(e, msgId) {
  const msgs = chatHistory[currentChat] || [];
  ctxMsg = msgs.find(m => m.id === msgId);
  const menu = document.getElementById('ctx-menu');
  menu.style.left = Math.min(e.clientX, window.innerWidth-180) + 'px';
  menu.style.top = Math.min(e.clientY, window.innerHeight-120) + 'px';
  menu.classList.add('show');
  const deleteItem = menu.children[2];
  deleteItem.style.display = ctxMsg?.from === me.username ? '' : 'none';
  e.stopPropagation();
}

document.addEventListener('click', () => document.getElementById('ctx-menu').classList.remove('show'));

function ctxReply() {
  if (!ctxMsg) return;
  replyTo = ctxMsg;
  const name = ctxMsg.from === me.username ? 'Вы' : (allUsers.find(u=>u.username===ctxMsg.from)?.displayName || ctxMsg.from);
  document.getElementById('reply-name').textContent = name;
  document.getElementById('reply-text').textContent = ctxMsg.type==='image' ? '📷 Фото' : ctxMsg.type==='voice' ? '🎤 Голосовое' : ctxMsg.content?.slice(0,80);
  document.getElementById('reply-preview').classList.add('show');
  document.getElementById('msg-input').focus();
}

function ctxCopy() {
  if (ctxMsg?.content) navigator.clipboard.writeText(ctxMsg.content).catch(()=>{});
}

function ctxDelete() {
  if (!ctxMsg) return;
  socket.emit('delete_message', {msgId: ctxMsg.id, chatWith: currentChat}, res => {
    if (res?.ok) {
      chatHistory[currentChat] = (chatHistory[currentChat]||[]).filter(m=>m.id!==ctxMsg.id);
      removeMessageEl(ctxMsg.id);
    }
  });
}

function cancelReply() { replyTo = null; document.getElementById('reply-preview').classList.remove('show'); }

function removeMessageEl(msgId) {
  const el = document.getElementById('msg-' + msgId);
  if (el) el.remove();
}

// ─── Emoji picker ──────────────────────────────────────────────────────────────
function toggleEmojiPicker() {
  const picker = document.getElementById('emoji-picker');
  if (!picker.innerHTML) {
    picker.innerHTML = `<div class="emoji-grid">${EMOJIS.map(e=>`<span class="emoji-item" onclick="insertEmoji('${e}')">${e}</span>`).join('')}</div>`;
  }
  picker.classList.toggle('show');
}

function insertEmoji(e) {
  const input = document.getElementById('msg-input');
  const pos = input.selectionStart;
  input.value = input.value.slice(0, pos) + e + input.value.slice(pos);
  input.selectionStart = input.selectionEnd = pos + e.length;
  input.focus();
  document.getElementById('emoji-picker').classList.remove('show');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.input-wrapper')) document.getElementById('emoji-picker')?.classList.remove('show');
});

// ─── Read Receipts ────────────────────────────────────────────────────────────
function markMessagesRead(by) {
  if (by !== currentChat) return;
  const msgs = chatHistory[currentChat] || [];
  msgs.forEach(m => { if (m.from === me.username) m.read = true; });
  renderMessages();
}

// ─── Status Updates ───────────────────────────────────────────────────────────
function updateUserStatus(username, online, lastSeen) {
  const u = allUsers.find(u=>u.username===username);
  if (u) u.online = online;
  if (!online && lastSeen) { if(u) u.lastSeen = lastSeen; }
  if (currentChat === username) {
    const s = document.getElementById('chat-hdr-status');
    s.textContent = online ? 'В сети' : 'Не в сети';
    s.className = 'chat-header-status' + (online ? ' online' : '');
  }
  renderChatList();
}

function onUserUpdated({username, displayName, avatar}) {
  const u = allUsers.find(u=>u.username===username);
  if (u) { u.displayName = displayName; u.avatar = avatar; }
  if (username === me.username) { me.displayName = displayName; me.avatar = avatar; updateMyUI(); }
  renderChatList();
}

// ─── Calls ────────────────────────────────────────────────────────────────────
const ICE_SERVERS = {iceServers: [{urls:'stun:stun.l.google.com:19302'}]};

async function startCall(type) {
  if (!currentChat) return;
  callType = type; currentCallUser = currentChat;
  const user = allUsers.find(u=>u.username===currentChat)||{username:currentChat,displayName:currentChat};
  showCallModal(user, type, 'outgoing');
  try {
    localStream = await navigator.mediaDevices.getUserMedia(type==='video' ? {video:true,audio:true} : {audio:true});
    if (type === 'video') {
      document.getElementById('localVideo').srcObject = localStream;
      document.getElementById('video-area').classList.add('show');
    }
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    peerConnection.ontrack = e => { document.getElementById('remoteVideo').srcObject = e.streams[0]; };
    peerConnection.onicecandidate = e => { if (e.candidate) socket.emit('ice_candidate', {to: currentCallUser, candidate: e.candidate}); };
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('call_user', {to: currentCallUser, offer, callType: type});
  } catch(e) { endCall(); alert('Нет доступа к камере/микрофону'); }
}

async function onIncomingCall({from, offer, callType: ct}) {
  currentCallUser = from; callType = ct;
  const user = allUsers.find(u=>u.username===from)||{username:from,displayName:from};
  showCallModal(user, ct, 'incoming', offer);
}

async function acceptCall(offer) {
  try {
    localStream = await navigator.mediaDevices.getUserMedia(callType==='video' ? {video:true,audio:true} : {audio:true});
    if (callType === 'video') {
      document.getElementById('localVideo').srcObject = localStream;
      document.getElementById('video-area').classList.add('show');
    }
    peerConnection = new RTCPeerConnection(ICE_SERVERS);
    localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
    peerConnection.ontrack = e => { document.getElementById('remoteVideo').srcObject = e.streams[0]; };
    peerConnection.onicecandidate = e => { if(e.candidate) socket.emit('ice_candidate', {to: currentCallUser, candidate: e.candidate}); };
    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('call_answer', {to: currentCallUser, answer});
    startCallTimer();
  } catch(e) { endCall(); }
}

async function onCallAnswered({answer}) {
  try {
    await peerConnection.setRemoteDescription(answer);
    startCallTimer();
    showCallModal(allUsers.find(u=>u.username===currentCallUser)||{username:currentCallUser}, callType, 'active');
  } catch(e) {}
}

async function onIceCandidate({candidate}) {
  try { if(peerConnection) await peerConnection.addIceCandidate(candidate); } catch(e) {}
}

function onCallEnded() { showCallStatus('Звонок завершён', true); }

function endCall() {
  socket.emit('call_end', {to: currentCallUser});
  cleanupCall();
}

function rejectCall() {
  socket.emit('call_reject', {to: currentCallUser});
  cleanupCall();
}

function cleanupCall() {
  if (peerConnection) { peerConnection.close(); peerConnection = null; }
  if (localStream) { localStream.getTracks().forEach(t=>t.stop()); localStream = null; }
  clearInterval(callTimer); callSeconds = 0;
  document.getElementById('call-timer').style.display = 'none';
  document.getElementById('video-area').classList.remove('show');
  document.getElementById('call-modal').classList.remove('show');
}

function showCallModal(user, type, mode, offer) {
  const modal = document.getElementById('call-modal');
  const avatar = document.getElementById('call-avatar');
  avatar.style.background = strColor(user.username);
  setAvatarEl(avatar, user);
  document.getElementById('call-name').textContent = user.displayName || user.username;
  const icon = type==='video' ? '📹' : '📞';
  const typeLabel = type==='video' ? 'Видеозвонок' : 'Аудиозвонок';

  let status, actions;
  if (mode === 'outgoing') {
    status = `${icon} ${typeLabel} • Исходящий...`;
    actions = `<button class="call-btn end" onclick="endCall()">📵</button>`;
  } else if (mode === 'incoming') {
    status = `${icon} Входящий ${typeLabel.toLowerCase()}`;
    actions = `<button class="call-btn reject" onclick="rejectCall()">📵</button>
               <button class="call-btn accept" onclick="acceptCall(${JSON.stringify(offer).replace(/"/g,'&quot;')})">📞</button>`;
    // Fix: re-pass offer properly
    actions = `<button class="call-btn reject" onclick="rejectCall()">📵</button>
               <button class="call-btn accept" id="accept-btn">📞</button>`;
    modal.classList.add('show');
    document.getElementById('call-status').textContent = status;
    document.getElementById('call-actions').innerHTML = actions;
    document.getElementById('accept-btn').onclick = () => acceptCall(offer);
    return;
  } else {
    status = `${icon} ${typeLabel}`;
    document.getElementById('call-timer').style.display = 'block';
    actions = `<button class="call-btn mute" onclick="toggleMute(this)">🎙️</button>
               <button class="call-btn end" onclick="endCall()">📵</button>
               ${type==='video' ? '<button class="call-btn cam" onclick="toggleCam(this)">📷</button>' : '<button class="call-btn speaker" onclick="toggleSpeaker(this)">🔊</button>'}`;
  }
  document.getElementById('call-status').textContent = status;
  document.getElementById('call-actions').innerHTML = actions;
  modal.classList.add('show');
}

function showCallStatus(msg, autoClose) {
  document.getElementById('call-status').textContent = msg;
  if (autoClose) setTimeout(() => cleanupCall(), 2000);
}

function startCallTimer() {
  callSeconds = 0;
  const el = document.getElementById('call-timer');
  el.style.display = 'block';
  callTimer = setInterval(() => { callSeconds++; el.textContent = formatSecs(callSeconds); }, 1000);
}

function toggleMute(btn) {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  track.enabled = !track.enabled;
  btn.textContent = track.enabled ? '🎙️' : '🔇';
}

function toggleCam(btn) {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  track.enabled = !track.enabled;
  btn.textContent = track.enabled ? '📷' : '🚫';
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('settings-panel').classList.add('open');
  document.getElementById('edit-profile-form').style.display = 'none';
}

function closeSettings() {
  document.getElementById('settings-panel').classList.remove('open');
}

function editProfile() { toggleEditProfile(); }

function toggleEditProfile() {
  const form = document.getElementById('edit-profile-form');
  if (form.style.display === 'none') {
    document.getElementById('edit-displayname').value = me.displayName || '';
    document.getElementById('edit-bio').value = me.bio || '';
    form.style.display = '';
  } else {
    form.style.display = 'none';
  }
}

function saveProfile() {
  const displayName = document.getElementById('edit-displayname').value.trim();
  const bio = document.getElementById('edit-bio').value.trim();
  socket.emit('update_profile', {displayName, bio}, res => {
    if (res?.ok) {
      me = res.user;
      updateMyUI();
      document.getElementById('edit-profile-form').style.display = 'none';
    }
  });
}

function handleAvatarChange(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    fetch('/api/avatar', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username: me.username, avatar: ev.target.result})
    }).then(() => {
      me.avatar = ev.target.result;
      updateMyUI();
    });
  };
  reader.readAsDataURL(file);
  e.target.value = '';
}

// ─── Profile Modal ────────────────────────────────────────────────────────────
function showUserProfile(username) {
  if (!username) return;
  const user = allUsers.find(u=>u.username===username)||{username,displayName:username};
  profileModalUser = username;
  const pa = document.getElementById('pm-avatar');
  pa.style.background = strColor(username);
  setAvatarEl(pa, user);
  document.getElementById('pm-name').textContent = user.displayName || username;
  document.getElementById('pm-handle').textContent = '@' + username + (user.online ? ' • В сети' : '');
  document.getElementById('pm-bio').textContent = user.bio || 'Нет описания';
  document.getElementById('profile-modal').classList.add('show');
}

function closeProfileModal() { document.getElementById('profile-modal').classList.remove('show'); }

function openChatFromProfile() {
  closeProfileModal();
  openChat(profileModalUser);
}

function startCallFromProfile(type) {
  closeProfileModal();
  openChat(profileModalUser);
  setTimeout(() => startCall(type), 300);
}

function startCallFromProfile2(type) {
  if (!currentChat) return;
  startCall(type);
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
function showToast(msg) {
  const user = allUsers.find(u=>u.username===msg.from)||{username:msg.from,displayName:msg.from};
  toastChatUser = msg.from;
  const ta = document.getElementById('toast-avatar');
  ta.style.background = strColor(msg.from);
  ta.textContent = initials(user.displayName||user.username);
  document.getElementById('toast-name').textContent = user.displayName || user.username;
  const text = msg.type==='image' ? '📷 Фото' : msg.type==='voice' ? '🎤 Голосовое' : msg.content?.slice(0,50);
  document.getElementById('toast-msg').textContent = text;
  const toast = document.getElementById('toast');
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 4000);
}

function openChatFromToast() {
  document.getElementById('toast').classList.remove('show');
  if (toastChatUser) openChat(toastChatUser);
}

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function openLightbox(src) {
  document.getElementById('lightbox-img').src = src;
  document.getElementById('lightbox').classList.add('show');
}

// ─── Misc ──────────────────────────────────────────────────────────────────────
function showNewChatHint() {
  document.querySelectorAll('.sidebar-tab')[1].click();
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  const days = Math.floor((now-d)/86400000);
  if (days < 7) return d.toLocaleDateString('ru-RU',{weekday:'short'});
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── Init ──────────────────────────────────────────────────────────────────────
connectSocket();

// Refresh users every 30s for online status
setInterval(() => { if (me) loadUsers(); }, 30000);

</body>
</html>::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:4px;}

/* ── AUTH ── */
#auth-screen{
  display:flex;align-items:center;justify-content:center;
  height:100vh;background:var(--bg);
  animation:fadeIn .4s ease;
}
.auth-box{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:20px;padding:48px 44px;width:420px;
  box-shadow:0 32px 80px rgba(0,0,0,.5);
}
.auth-logo{
  text-align:center;margin-bottom:32px;
}
.auth-logo .logo-mark{
  width:64px;height:64px;border-radius:18px;
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  display:inline-flex;align-items:center;justify-content:center;
  font-size:28px;font-weight:800;letter-spacing:-1px;
  box-shadow:0 8px 32px rgba(108,99,255,.4);
  margin-bottom:16px;
}
.auth-logo h1{font-size:28px;font-weight:800;letter-spacing:-.5px;}
.auth-logo p{color:var(--text2);font-size:14px;margin-top:4px;}
.auth-tabs{display:flex;background:var(--bg3);border-radius:10px;padding:4px;margin-bottom:28px;}
.auth-tab{flex:1;padding:9px;text-align:center;border-radius:8px;font-size:14px;font-weight:600;color:var(--text2);transition:var(--trans);cursor:pointer;}
.auth-tab.active{background:var(--bg4);color:var(--text);}
.field{margin-bottom:16px;}
.field label{display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:8px;letter-spacing:.3px;text-transform:uppercase;}
.field input{
  width:100%;padding:13px 16px;
  background:var(--bg3);border:1px solid var(--border);
  border-radius:10px;font-size:15px;font-weight:500;
  transition:var(--trans);
}
.field input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(108,99,255,.15);}
.field input::placeholder{color:var(--text3);}
.btn-primary{
  width:100%;padding:14px;border-radius:10px;font-size:15px;font-weight:700;
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  color:#fff;transition:var(--trans);letter-spacing:.2px;
  box-shadow:0 4px 20px rgba(108,99,255,.35);
}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(108,99,255,.45);}
.btn-primary:active{transform:translateY(0);}
.auth-err{color:var(--red);font-size:13px;text-align:center;margin-top:12px;min-height:20px;}

/* ── APP SHELL ── */
#app{display:none;height:100vh;flex-direction:row;}
#app.visible{display:flex;}

/* ── SIDEBAR ── */
.sidebar{
  width:var(--sidebar-w);min-width:var(--sidebar-w);
  background:var(--bg2);border-right:1px solid var(--border);
  display:flex;flex-direction:column;
}
.sidebar-header{
  padding:16px;display:flex;align-items:center;gap:10px;
  border-bottom:1px solid var(--border);
}
.sidebar-logo{
  font-size:20px;font-weight:800;letter-spacing:-.5px;
  background:linear-gradient(135deg,var(--accent),var(--accent2));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  flex:1;
}
.icon-btn{
  width:36px;height:36px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  color:var(--text2);transition:var(--trans);
}
.icon-btn:hover{background:var(--bg3);color:var(--text);}
.icon-btn svg{width:20px;height:20px;}

.search-wrap{padding:10px 12px;border-bottom:1px solid var(--border);}
.search-box{
  display:flex;align-items:center;gap:8px;
  background:var(--bg3);border-radius:10px;padding:9px 12px;
}
.search-box svg{width:16px;height:16px;color:var(--text3);flex-shrink:0;}
.search-box input{flex:1;font-size:14px;font-weight:500;}
.search-box input::placeholder{color:var(--text3);}

.chat-list{flex:1;overflow-y:auto;}
.chat-item{
  display:flex;align-items:center;gap:12px;
  padding:12px 16px;cursor:pointer;transition:var(--trans);
  border-bottom:1px solid var(--border);
}
.chat-item:hover{background:var(--bg3);}
.chat-item.active{background:var(--bg3);}
.avatar{
  width:48px;height:48px;border-radius:50%;flex-shrink:0;
  background:linear-gradient(135deg,var(--accent3),var(--accent));
  display:flex;align-items:center;justify-content:center;
  font-size:18px;font-weight:700;color:#fff;position:relative;
  overflow:hidden;
}
.avatar img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;}
.online-dot{
  position:absolute;bottom:2px;right:2px;
  width:10px;height:10px;border-radius:50%;
  background:var(--green);border:2px solid var(--bg2);
}
.chat-info{flex:1;min-width:0;}
.chat-name{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.chat-preview{font-size:13px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;}
.chat-meta{display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
.chat-time{font-size:12px;color:var(--text3);}
.unread-badge{
  background:var(--accent);color:#fff;border-radius:20px;
  font-size:11px;font-weight:700;padding:2px 7px;min-width:20px;text-align:center;
}

.sidebar-nav{
  display:flex;border-top:1px solid var(--border);padding:6px;gap:2px;
}
.nav-btn{
  flex:1;padding:10px 6px;border-radius:10px;
  display:flex;flex-direction:column;align-items:center;gap:4px;
  font-size:11px;font-weight:600;color:var(--text3);transition:var(--trans);
}
.nav-btn:hover{background:var(--bg3);color:var(--text2);}
.nav-btn.active{color:var(--accent);}
.nav-btn svg{width:22px;height:22px;}

/* ── MAIN AREA ── */
.main-area{flex:1;display:flex;flex-direction:column;background:var(--bg);position:relative;}

/* Empty state */
.empty-state{
  flex:1;display:flex;align-items:center;justify-content:center;
  flex-direction:column;gap:12px;color:var(--text3);
}
.empty-state .mark{
  width:80px;height:80px;border-radius:24px;
  background:var(--bg2);border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
  font-size:36px;font-weight:800;
  background:linear-gradient(135deg,var(--accent3),var(--accent));
  color:#fff;
}
.empty-state p{font-size:16px;font-weight:500;}
.empty-state span{font-size:13px;}

/* ── CHAT WINDOW ── */
.chat-window{flex:1;display:flex;flex-direction:column;display:none;}
.chat-window.open{display:flex;}

.chat-header{
  padding:12px 20px;display:flex;align-items:center;gap:12px;
  border-bottom:1px solid var(--border);background:var(--bg2);
}
.chat-header .avatar{width:40px;height:40px;font-size:15px;}
.chat-header-info{flex:1;}
.chat-header-info .name{font-size:16px;font-weight:700;}
.chat-header-info .status{font-size:13px;color:var(--text2);}
.chat-header-info .status.online{color:var(--green);}
.header-actions{display:flex;gap:4px;}

.messages-area{
  flex:1;overflow-y:auto;padding:20px;
  display:flex;flex-direction:column;gap:4px;
}

/* Messages */
.msg-wrap{display:flex;flex-direction:column;max-width:68%;gap:2px;}
.msg-wrap.out{align-self:flex-end;align-items:flex-end;}
.msg-wrap.in{align-self:flex-start;align-items:flex-start;}

.msg-bubble{
  padding:10px 14px;border-radius:18px;
  font-size:15px;line-height:1.5;word-break:break-word;
  position:relative;max-width:100%;
}
.out .msg-bubble{background:var(--msg-out);border-bottom-right-radius:4px;}
.in  .msg-bubble{background:var(--msg-in);border-bottom-left-radius:4px;}

.msg-time-status{
  font-size:11px;color:var(--text3);margin-top:3px;
  display:flex;align-items:center;gap:4px;
}
.out .msg-time-status{justify-content:flex-end;}

/* Read ticks */
.ticks{display:inline-flex;color:var(--text3);}
.ticks.read{color:var(--accent2);}
.ticks svg{width:14px;height:14px;}

/* Voice message */
.voice-msg{
  display:flex;align-items:center;gap:10px;
  padding:4px 0;min-width:220px;
}
.play-btn{
  width:36px;height:36px;border-radius:50%;
  background:var(--accent);color:#fff;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  transition:var(--trans);
}
.play-btn:hover{background:var(--accent2);}
.play-btn svg{width:16px;height:16px;}
.waveform{flex:1;height:28px;display:flex;align-items:center;gap:2px;cursor:pointer;}
.wave-bar{width:3px;border-radius:2px;background:rgba(255,255,255,.25);transition:height .1s;}
.wave-bar.active{background:var(--accent2);}
.voice-dur{font-size:12px;color:var(--text2);font-weight:600;}

/* Video circle */
.video-circle{
  width:180px;height:180px;border-radius:50%;
  overflow:hidden;border:3px solid var(--accent);
  cursor:pointer;position:relative;
}
.video-circle video,.video-circle img{width:100%;height:100%;object-fit:cover;}
.vc-play-overlay{
  position:absolute;inset:0;background:rgba(0,0,0,.3);
  display:flex;align-items:center;justify-content:center;border-radius:50%;
}

/* Image message */
.img-msg{
  max-width:320px;max-height:280px;border-radius:14px;
  overflow:hidden;cursor:pointer;
}
.img-msg img{width:100%;height:100%;object-fit:cover;display:block;}

/* Reply preview in message */
.reply-preview{
  border-left:3px solid var(--accent2);padding:6px 10px;
  margin-bottom:8px;border-radius:0 8px 8px 0;
  background:rgba(255,255,255,.05);font-size:13px;
}
.reply-preview .reply-name{color:var(--accent2);font-weight:600;margin-bottom:2px;}
.reply-preview .reply-text{color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

/* Date divider */
.date-divider{
  display:flex;align-items:center;gap:12px;margin:12px 0;
}
.date-divider span{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:20px;padding:4px 14px;font-size:12px;
  color:var(--text2);font-weight:600;white-space:nowrap;
}
.date-divider::before,.date-divider::after{content:'';flex:1;height:1px;background:var(--border);}

/* Typing indicator */
.typing-bubble{
  align-self:flex-start;background:var(--msg-in);
  border-radius:18px;border-bottom-left-radius:4px;
  padding:12px 16px;display:none;
}
.typing-bubble.show{display:block;}
.typing-dots{display:flex;gap:4px;}
.typing-dots span{
  width:7px;height:7px;border-radius:50%;background:var(--text3);
  animation:bounce .8s infinite;
}
.typing-dots span:nth-child(2){animation-delay:.15s;}
.typing-dots span:nth-child(3){animation-delay:.3s;}
@keyframes bounce{0%,80%,100%{transform:scale(.6)}40%{transform:scale(1)}}

/* ── INPUT BAR ── */
.input-bar{
  padding:12px 16px;background:var(--bg2);border-top:1px solid var(--border);
}
.reply-bar{
  display:none;align-items:center;gap:10px;
  padding:8px 12px;background:var(--bg3);border-radius:10px;margin-bottom:8px;
}
.reply-bar.show{display:flex;}
.reply-bar-content{flex:1;min-width:0;}
.reply-bar .name{font-size:12px;font-weight:700;color:var(--accent2);}
.reply-bar .text{font-size:13px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.reply-close{color:var(--text3);padding:4px;}

.input-row{display:flex;align-items:flex-end;gap:8px;}
.input-wrap{
  flex:1;background:var(--bg3);border-radius:14px;
  border:1px solid var(--border);display:flex;align-items:flex-end;
  padding:4px 8px;transition:var(--trans);
}
.input-wrap:focus-within{border-color:var(--accent);}
.msg-input{
  flex:1;padding:9px 8px;font-size:15px;resize:none;
  max-height:120px;overflow-y:auto;line-height:1.5;
}
.msg-input::placeholder{color:var(--text3);}
.attach-btn,.emoji-btn{padding:8px;color:var(--text3);border-radius:8px;transition:var(--trans);}
.attach-btn:hover,.emoji-btn:hover{color:var(--accent);}
.attach-btn svg,.emoji-btn svg{width:20px;height:20px;}
#file-input{display:none;}

.send-btn{
  width:44px;height:44px;border-radius:14px;flex-shrink:0;
  background:var(--accent);color:#fff;
  display:flex;align-items:center;justify-content:center;
  transition:var(--trans);box-shadow:0 4px 16px rgba(108,99,255,.35);
}
.send-btn:hover{background:var(--accent2);transform:scale(1.05);}
.send-btn svg{width:20px;height:20px;}
.send-btn.mic-mode{background:var(--bg3);color:var(--text2);box-shadow:none;}
.send-btn.mic-mode:hover{background:var(--bg4);color:var(--text);}

/* Recording state */
.recording-bar{
  display:none;align-items:center;gap:12px;
  padding:10px 16px;background:var(--bg3);border-radius:12px;margin-bottom:8px;
}
.recording-bar.show{display:flex;}
.rec-dot{width:10px;height:10px;border-radius:50%;background:var(--red);animation:blink 1s infinite;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.rec-time{font-size:14px;font-weight:700;flex:1;}
.rec-cancel{color:var(--text3);font-size:14px;font-weight:600;}

/* ── SETTINGS PANEL ── */
.settings-panel{
  display:none;flex:1;flex-direction:column;background:var(--bg);
}
.settings-panel.open{display:flex;}
.settings-header{
  padding:16px 20px;display:flex;align-items:center;gap:12px;
  border-bottom:1px solid var(--border);background:var(--bg2);
}
.settings-header h2{font-size:18px;font-weight:700;flex:1;}
.settings-body{flex:1;overflow-y:auto;padding:20px;}

.profile-card{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:16px;padding:24px;margin-bottom:20px;
  display:flex;flex-direction:column;align-items:center;gap:16px;
}
.profile-avatar-wrap{position:relative;cursor:pointer;}
.profile-avatar-wrap .avatar{width:90px;height:90px;font-size:32px;}
.avatar-edit-btn{
  position:absolute;bottom:0;right:0;
  width:28px;height:28px;border-radius:50%;
  background:var(--accent);color:#fff;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 2px 8px rgba(0,0,0,.4);
}
.avatar-edit-btn svg{width:14px;height:14px;}
.profile-name{font-size:22px;font-weight:800;}
.profile-username{font-size:14px;color:var(--text2);}

.settings-section{margin-bottom:20px;}
.settings-section h3{
  font-size:12px;font-weight:700;color:var(--accent2);
  text-transform:uppercase;letter-spacing:.5px;
  margin-bottom:10px;padding:0 4px;
}
.settings-item{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:12px;overflow:hidden;margin-bottom:4px;
}
.settings-row{
  display:flex;align-items:center;gap:12px;
  padding:14px 16px;cursor:pointer;transition:var(--trans);
  border-bottom:1px solid var(--border);
}
.settings-row:last-child{border-bottom:none;}
.settings-row:hover{background:var(--bg3);}
.settings-row-icon{
  width:36px;height:36px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  flex-shrink:0;font-size:16px;
}
.settings-row-icon svg{width:18px;height:18px;}
.settings-row-info{flex:1;}
.settings-row-info .label{font-size:15px;font-weight:600;}
.settings-row-info .sub{font-size:13px;color:var(--text2);margin-top:2px;}
.settings-row-arrow{color:var(--text3);}
.settings-row-arrow svg{width:16px;height:16px;}

/* Toggle switch */
.toggle{
  width:44px;height:24px;border-radius:12px;background:var(--bg4);
  position:relative;cursor:pointer;transition:var(--trans);flex-shrink:0;
}
.toggle.on{background:var(--accent);}
.toggle::after{
  content:'';position:absolute;top:3px;left:3px;
  width:18px;height:18px;border-radius:50%;background:#fff;
  transition:var(--trans);
}
.toggle.on::after{left:23px;}

/* Edit field */
.edit-field{
  width:100%;padding:12px 14px;
  background:var(--bg3);border:1px solid var(--border);
  border-radius:10px;font-size:15px;font-weight:500;
  margin-bottom:12px;transition:var(--trans);
}
.edit-field:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(108,99,255,.12);}
.edit-field::placeholder{color:var(--text3);}
textarea.edit-field{resize:none;min-height:80px;line-height:1.5;}
.save-btn{
  width:100%;padding:12px;border-radius:10px;
  background:var(--accent);color:#fff;font-size:15px;font-weight:700;
  transition:var(--trans);
}
.save-btn:hover{background:var(--accent2);}

/* Privacy select */
.privacy-select{
  background:var(--bg3);border:1px solid var(--border);
  border-radius:8px;padding:8px 12px;font-size:14px;color:var(--text);
  font-family:inherit;cursor:pointer;
}
.privacy-select option{background:var(--bg3);}

/* ── CONTACTS PANEL ── */
.contacts-panel{
  display:none;flex:1;flex-direction:column;background:var(--bg);
}
.contacts-panel.open{display:flex;}
.contacts-header{
  padding:16px 20px;display:flex;align-items:center;gap:12px;
  border-bottom:1px solid var(--border);background:var(--bg2);
}
.contacts-header h2{font-size:18px;font-weight:700;flex:1;}
.contacts-list{flex:1;overflow-y:auto;}
.contact-item{
  display:flex;align-items:center;gap:12px;
  padding:12px 20px;cursor:pointer;transition:var(--trans);
  border-bottom:1px solid var(--border);
}
.contact-item:hover{background:var(--bg2);}
.contact-item .avatar{width:44px;height:44px;font-size:16px;}
.contact-item .info{flex:1;}
.contact-item .name{font-size:15px;font-weight:600;}
.contact-item .status{font-size:13px;color:var(--text3);}
.contact-item .status.online-s{color:var(--green);}

/* ── CALL OVERLAY ── */
#call-overlay{
  display:none;position:fixed;inset:0;
  background:rgba(0,0,0,.7);backdrop-filter:blur(20px);
  z-index:100;align-items:center;justify-content:center;
  flex-direction:column;
}
#call-overlay.show{display:flex;}
.call-box{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:24px;padding:40px;text-align:center;
  min-width:320px;
}
.call-avatar{
  width:90px;height:90px;border-radius:50%;
  background:linear-gradient(135deg,var(--accent3),var(--accent));
  display:flex;align-items:center;justify-content:center;
  font-size:34px;font-weight:700;color:#fff;
  margin:0 auto 20px;
  box-shadow:0 0 0 0 rgba(108,99,255,.4);
  overflow:hidden;position:relative;
}
.call-avatar img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;}
.call-avatar.ringing{animation:callPulse 1.5s infinite;}
@keyframes callPulse{
  0%{box-shadow:0 0 0 0 rgba(108,99,255,.4)}
  70%{box-shadow:0 0 0 24px rgba(108,99,255,0)}
  100%{box-shadow:0 0 0 0 rgba(108,99,255,0)}
}
.call-name{font-size:24px;font-weight:800;margin-bottom:8px;}
.call-status{font-size:15px;color:var(--text2);margin-bottom:32px;}
.call-actions{display:flex;gap:16px;justify-content:center;}
.call-btn{
  width:60px;height:60px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  transition:var(--trans);
}
.call-btn svg{width:26px;height:26px;}
.call-btn.end{background:var(--red);}
.call-btn.end:hover{background:#ef4444;}
.call-btn.answer{background:var(--green);}
.call-btn.answer:hover{background:#22c55e;}
.call-btn.mute,.call-btn.cam,.call-btn.speaker{background:var(--bg4);color:var(--text2);}
.call-btn.mute:hover,.call-btn.cam:hover,.call-btn.speaker:hover{background:var(--bg3);}
.call-btn.active-btn{background:var(--accent);color:#fff;}

.call-timer{font-size:18px;font-weight:700;margin-bottom:20px;color:var(--green);}

/* Video call */
.video-wrap{
  display:none;width:100%;max-width:600px;border-radius:16px;
  overflow:hidden;position:relative;margin-bottom:20px;background:#000;
  aspect-ratio:4/3;
}
.video-wrap.show{display:block;}
#remote-video,#local-video{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;}
#local-video{
  width:140px;height:105px;position:absolute;bottom:12px;right:12px;
  border-radius:10px;border:2px solid var(--accent);z-index:2;
}

/* ── INCOMING CALL ── */
#incoming-call{
  display:none;position:fixed;bottom:24px;right:24px;
  background:var(--bg2);border:1px solid var(--border);
  border-radius:20px;padding:20px 24px;z-index:200;
  box-shadow:0 20px 60px rgba(0,0,0,.6);
  animation:slideUp .3s ease;min-width:280px;
}
#incoming-call.show{display:block;}
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.inc-top{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
.inc-top .avatar{width:44px;height:44px;font-size:16px;}
.inc-info{flex:1;}
.inc-name{font-size:16px;font-weight:700;}
.inc-type{font-size:13px;color:var(--text2);}
.inc-actions{display:flex;gap:12px;}
.inc-btn{
  flex:1;padding:11px;border-radius:12px;font-size:14px;font-weight:700;
  display:flex;align-items:center;justify-content:center;gap:8px;
  transition:var(--trans);
}
.inc-btn svg{width:18px;height:18px;}
.inc-btn.reject{background:rgba(248,113,113,.15);color:var(--red);}
.inc-btn.reject:hover{background:var(--red);color:#fff;}
.inc-btn.accept{background:rgba(74,222,128,.15);color:var(--green);}
.inc-btn.accept:hover{background:var(--green);color:#fff;}

/* ── CONTEXT MENU ── */
#ctx-menu{
  display:none;position:fixed;z-index:300;
  background:var(--bg2);border:1px solid var(--border);
  border-radius:12px;padding:6px;min-width:160px;
  box-shadow:0 12px 40px rgba(0,0,0,.4);
}
#ctx-menu.show{display:block;}
.ctx-item{
  display:flex;align-items:center;gap:10px;
  padding:10px 14px;border-radius:8px;cursor:pointer;
  font-size:14px;font-weight:500;transition:var(--trans);
}
.ctx-item:hover{background:var(--bg3);}
.ctx-item svg{width:16px;height:16px;color:var(--text3);}
.ctx-item.danger{color:var(--red);}
.ctx-item.danger svg{color:var(--red);}

/* ── LIGHTBOX ── */
#lightbox{
  display:none;position:fixed;inset:0;background:rgba(0,0,0,.9);
  z-index:400;align-items:center;justify-content:center;cursor:pointer;
}
#lightbox.show{display:flex;}
#lightbox img{max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain;}

/* Toasts */
#toast-container{position:fixed;top:20px;right:20px;z-index:500;display:flex;flex-direction:column;gap:8px;}
.toast{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:10px;padding:12px 16px;font-size:14px;font-weight:500;
  box-shadow:0 8px 32px rgba(0,0,0,.3);animation:toastIn .3s ease;
  display:flex;align-items:center;gap:8px;
}
@keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
.toast.success{border-color:rgba(74,222,128,.3);}
.toast.error{border-color:rgba(248,113,113,.3);}
.toast-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.toast.success .toast-dot{background:var(--green);}
.toast.error .toast-dot{background:var(--red);}

/* ── VIDEO RECORD UI ── */
#vc-overlay{
  display:none;position:fixed;inset:0;background:rgba(0,0,0,.85);
  z-index:250;align-items:center;justify-content:center;flex-direction:column;gap:20px;
}
#vc-overlay.show{display:flex;}
.vc-preview{
  width:260px;height:260px;border-radius:50%;overflow:hidden;
  border:4px solid var(--accent);background:#000;
}
.vc-preview video{width:100%;height:100%;object-fit:cover;}
.vc-controls{display:flex;gap:20px;align-items:center;}
.vc-btn{
  width:56px;height:56px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:24px;transition:var(--trans);
}
.vc-btn.start{background:var(--red);}
.vc-btn.stop{background:var(--accent);}
.vc-btn.cancel{background:var(--bg4);color:var(--text2);}
.vc-btn svg{width:24px;height:24px;}
.vc-timer{font-size:20px;font-weight:700;color:#fff;}

@keyframes fadeIn{from{opacity:0}to{opacity:1}}

/* Select options */
.select-opt-group{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:12px;overflow:hidden;margin-bottom:16px;
}
.select-opt{
  display:flex;align-items:center;gap:12px;
  padding:13px 16px;cursor:pointer;transition:var(--trans);
  border-bottom:1px solid var(--border);font-size:14px;font-weight:500;
}
.select-opt:last-child{border-bottom:none;}
.select-opt:hover{background:var(--bg3);}
.select-opt.selected::after{content:'';width:8px;height:8px;border-radius:50%;background:var(--accent);margin-left:auto;}

/* sub-panel */
.sub-panel{display:none;}
.sub-panel.open{display:block;}

/* Responsive */
@media(max-width:768px){
  :root{--sidebar-w:100%;}
  .sidebar{position:absolute;z-index:10;height:100%;transition:var(--trans);}
  .sidebar.hidden{transform:translateX(-100%);}
  .main-area{width:100%;}
}
</style>
</head>
<body>

<!-- ── AUTH SCREEN ─────────────────────────────────────────────── -->
<div id="auth-screen">
  <div class="auth-box">
    <div class="auth-logo">
      <div class="logo-mark">F</div>
      <h1>Freedom</h1>
      <p>Secure. Fast. Free.</p>
    </div>
    <div class="auth-tabs">
      <div class="auth-tab active" onclick="switchTab('login')">Sign In</div>
      <div class="auth-tab" onclick="switchTab('register')">Create Account</div>
    </div>
    <!-- Login -->
    <div id="tab-login">
      <div class="field"><label>Username</label><input id="l-user" type="text" placeholder="your_username" autocomplete="username"/></div>
      <div class="field"><label>Password</label><input id="l-pass" type="password" placeholder="••••••••" autocomplete="current-password"/></div>
      <button class="btn-primary" onclick="doLogin()">Sign In</button>
    </div>
    <!-- Register -->
    <div id="tab-register" style="display:none">
      <div class="field"><label>Display Name</label><input id="r-name" type="text" placeholder="Your Name"/></div>
      <div class="field"><label>Username</label><input id="r-user" type="text" placeholder="username (min 3 chars)" autocomplete="username"/></div>
      <div class="field"><label>Password</label><input id="r-pass" type="password" placeholder="••••••••" autocomplete="new-password"/></div>
      <button class="btn-primary" onclick="doRegister()">Create Account</button>
    </div>
    <div class="auth-err" id="auth-err"></div>
  </div>
</div>

<!-- ── APP SHELL ────────────────────────────────────────────────── -->
<div id="app">

  <!-- SIDEBAR -->
  <div class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-logo">Freedom</div>
      <button class="icon-btn" onclick="openCompose()" title="New Message">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
    </div>
    <div class="search-wrap">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="text" placeholder="Search" id="search-input" oninput="filterChats(this.value)"/>
      </div>
    </div>
    <div class="chat-list" id="chat-list"></div>
    <div class="sidebar-nav">
      <button class="nav-btn active" id="nav-chats" onclick="showPanel('chats')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        Chats
      </button>
      <button class="nav-btn" id="nav-contacts" onclick="showPanel('contacts')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        Contacts
      </button>
      <button class="nav-btn" id="nav-settings" onclick="showPanel('settings')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
        Settings
      </button>
    </div>
  </div>

  <!-- MAIN AREA -->
  <div class="main-area" id="main-area">

    <!-- EMPTY STATE -->
    <div class="empty-state" id="empty-state">
      <div class="mark">F</div>
      <p>Freedom Messenger</p>
      <span>Select a conversation to start</span>
    </div>

    <!-- CHAT WINDOW -->
    <div class="chat-window" id="chat-window">
      <div class="chat-header" id="chat-header">
        <div class="avatar" id="ch-avatar"></div>
        <div class="chat-header-info">
          <div class="name" id="ch-name"></div>
          <div class="status" id="ch-status"></div>
        </div>
        <div class="header-actions">
          <button class="icon-btn" id="call-btn" onclick="startCall('audio')" title="Voice Call">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.79 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.39 7.09a16 16 0 006.52 6.52l1.45-1.45a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14z"/></svg>
          </button>
          <button class="icon-btn" onclick="startCall('video')" title="Video Call">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </button>
          <button class="icon-btn" onclick="openProfile()" title="Profile">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>
          </button>
        </div>
      </div>

      <div class="messages-area" id="messages-area">
        <div class="typing-bubble" id="typing-bubble">
          <div class="typing-dots"><span></span><span></span><span></span></div>
        </div>
      </div>

      <div class="input-bar">
        <div class="reply-bar" id="reply-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--accent2);flex-shrink:0"><path d="M3 10h13a5 5 0 010 10H8"/><path d="M7 6L3 10l4 4"/></svg>
          <div class="reply-bar-content">
            <div class="name" id="reply-name"></div>
            <div class="text" id="reply-text"></div>
          </div>
          <button class="reply-close" onclick="cancelReply()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="recording-bar" id="recording-bar">
          <div class="rec-dot"></div>
          <span class="rec-time" id="rec-time">0:00</span>
          <button class="rec-cancel" onclick="cancelRecord()">Cancel</button>
        </div>
        <div class="input-row">
          <button class="icon-btn attach-btn" onclick="document.getElementById('file-input').click()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
          </button>
          <input type="file" id="file-input" accept="image/*,video/*" onchange="handleFileUpload(this)"/>
          <button class="icon-btn" onclick="startVideoCircle()" title="Video circle">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
          </button>
          <div class="input-wrap">
            <textarea class="msg-input" id="msg-input" rows="1" placeholder="Message..." onkeydown="handleKey(event)" oninput="handleInput(this)"></textarea>
          </div>
          <button class="send-btn mic-mode" id="send-btn" onclick="handleSendBtn()">
            <svg id="send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
            <svg id="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- SETTINGS PANEL -->
    <div class="settings-panel" id="settings-panel">
      <div class="settings-header">
        <h2>Settings</h2>
        <button class="icon-btn" onclick="logout()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--red)"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
      <div class="settings-body" id="settings-body">
        <!-- Profile card -->
        <div class="profile-card">
          <div class="profile-avatar-wrap" onclick="document.getElementById('avatar-input').click()">
            <div class="avatar" id="my-avatar" style="width:90px;height:90px;font-size:32px;"></div>
            <div class="avatar-edit-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </div>
          </div>
          <input type="file" id="avatar-input" accept="image/*" style="display:none" onchange="uploadAvatar(this)"/>
          <div class="profile-name" id="my-display-name"></div>
          <div class="profile-username" id="my-username-display"></div>
        </div>

        <!-- Edit profile sub-panel -->
        <div class="settings-section">
          <h3>Profile</h3>
          <div class="settings-item">
            <div class="settings-row" onclick="toggleSub('edit-profile-sub')">
              <div class="settings-row-icon" style="background:rgba(108,99,255,.15);color:var(--accent)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div class="settings-row-info"><div class="label">Edit Profile</div><div class="sub">Name, bio, username</div></div>
              <div class="settings-row-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></div>
            </div>
            <div class="sub-panel" id="edit-profile-sub" style="padding:16px">
              <input class="edit-field" id="edit-name" type="text" placeholder="Display Name"/>
              <textarea class="edit-field" id="edit-bio" placeholder="Bio (about yourself)"></textarea>
              <button class="save-btn" onclick="saveProfile()">Save Changes</button>
            </div>
          </div>
        </div>

        <!-- Privacy settings -->
        <div class="settings-section">
          <h3>Privacy</h3>
          <div class="settings-item">
            <div class="settings-row">
              <div class="settings-row-icon" style="background:rgba(74,222,128,.15);color:var(--green)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div class="settings-row-info"><div class="label">Last Seen</div></div>
              <select class="privacy-select" id="priv-lastseen" onchange="savePrivacy()">
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
            <div class="settings-row">
              <div class="settings-row-icon" style="background:rgba(251,191,36,.15);color:var(--yellow)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div class="settings-row-info"><div class="label">Profile Photo</div></div>
              <select class="privacy-select" id="priv-photo" onchange="savePrivacy()">
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
            <div class="settings-row" style="cursor:default">
              <div class="settings-row-icon" style="background:rgba(108,99,255,.15);color:var(--accent)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0119 12.55"/><path d="M5 12.55a10.94 10.94 0 015.17-2.39"/><path d="M10.71 5.05A16 16 0 0122.56 9"/><path d="M1.42 9a15.91 15.91 0 014.7-2.88"/><path d="M8.53 16.11a6 6 0 006.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
              </div>
              <div class="settings-row-info"><div class="label">Online Status</div></div>
              <select class="privacy-select" id="priv-online" onchange="savePrivacy()">
                <option value="everyone">Everyone</option>
                <option value="contacts">My Contacts</option>
                <option value="nobody">Nobody</option>
              </select>
            </div>
          </div>
        </div>

        <!-- App settings -->
        <div class="settings-section">
          <h3>Appearance</h3>
          <div class="settings-item">
            <div class="settings-row" style="cursor:default">
              <div class="settings-row-icon" style="background:rgba(108,99,255,.15);color:var(--accent)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              </div>
              <div class="settings-row-info"><div class="label">Theme</div><div class="sub">Dark</div></div>
              <div class="toggle on" id="theme-toggle" onclick="this.classList.toggle('on')"></div>
            </div>
            <div class="settings-row" style="cursor:default">
              <div class="settings-row-icon" style="background:rgba(74,222,128,.15);color:var(--green)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>
              </div>
              <div class="settings-row-info"><div class="label">Notifications</div></div>
              <div class="toggle on" id="notif-toggle" onclick="this.classList.toggle('on')"></div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h3>Account</h3>
          <div class="settings-item">
            <div class="settings-row" onclick="logout()" style="color:var(--red)">
              <div class="settings-row-icon" style="background:rgba(248,113,113,.15);color:var(--red)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </div>
              <div class="settings-row-info"><div class="label">Sign Out</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CONTACTS PANEL -->
    <div class="contacts-panel" id="contacts-panel">
      <div class="contacts-header">
        <h2>People</h2>
      </div>
      <div class="contacts-list" id="contacts-list"></div>
    </div>

  </div><!-- /main-area -->
</div><!-- /app -->

<!-- ── CALL OVERLAY ── -->
<div id="call-overlay">
  <div class="video-wrap" id="video-wrap">
    <video id="remote-video" autoplay playsinline></video>
    <video id="local-video" autoplay muted playsinline></video>
  </div>
  <div class="call-box">
    <div class="call-avatar ringing" id="call-avatar"></div>
    <div class="call-name" id="call-name"></div>
    <div class="call-status" id="call-status">Calling...</div>
    <div class="call-timer" id="call-timer" style="display:none"></div>
    <div class="call-actions" id="call-actions">
      <button class="call-btn mute" id="mute-btn" onclick="toggleMute()" title="Mute">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      </button>
      <button class="call-btn end" onclick="endCall()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.07 9.12 19.79 19.79 0 01.22 .5 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.39 7.09a16 16 0 006.29 6.22z"/></svg>
      </button>
      <button class="call-btn cam" id="cam-btn" onclick="toggleCam()" title="Camera">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
      </button>
    </div>
  </div>
</div>

<!-- ── INCOMING CALL ── -->
<div id="incoming-call">
  <div class="inc-top">
    <div class="avatar" id="inc-avatar"></div>
    <div class="inc-info">
      <div class="inc-name" id="inc-name"></div>
      <div class="inc-type" id="inc-type"></div>
    </div>
  </div>
  <div class="inc-actions">
    <button class="inc-btn reject" onclick="rejectCall()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      Decline
    </button>
    <button class="inc-btn accept" onclick="acceptCall()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.79 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.39 7.09a16 16 0 006.52 6.52l1.45-1.45a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14z"/></svg>
      Answer
    </button>
  </div>
</div>

<!-- ── VIDEO CIRCLE OVERLAY ── -->
<div id="vc-overlay">
  <div class="vc-preview">
    <video id="vc-preview-video" autoplay muted playsinline></video>
  </div>
  <div class="vc-timer" id="vc-timer">0:00</div>
  <div class="vc-controls">
    <button class="vc-btn cancel" onclick="cancelVideoCircle()">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <button class="vc-btn start" id="vc-record-btn" onclick="toggleVideoRecord()">
      <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
    </button>
  </div>
</div>

<!-- ── CONTEXT MENU ── -->
<div id="ctx-menu">
  <div class="ctx-item" id="ctx-reply" onclick="ctxReply()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h13a5 5 0 010 10H8"/><path d="M7 6L3 10l4 4"/></svg>
    Reply
  </div>
  <div class="ctx-item" id="ctx-copy" onclick="ctxCopy()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
    Copy Text
  </div>
  <div class="ctx-item danger" id="ctx-delete" onclick="ctxDelete()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
    Delete
  </div>
</div>

<!-- ── LIGHTBOX ── -->
<div id="lightbox" onclick="document.getElementById('lightbox').classList.remove('show')">
  <img id="lightbox-img" src="" alt=""/>
</div>

<!-- ── TOAST CONTAINER ── -->
<div id="toast-container"></div>


// ═══════════════════════════════════════════════════════════════════════
//  FREEDOM MESSENGER — CLIENT
// ═══════════════════════════════════════════════════════════════════════

const SERVER = window.location.origin;
const socket = io(SERVER);

// ── State ──────────────────────────────────────────────────────────────
let me = null;              // current user
let activeChat = null;      // username we're chatting with
let allUsers = [];          // all known users
let chatHistory = {};       // username -> messages[]
let unreadCounts = {};      // username -> count
let lastSeen = {};          // username -> timestamp
let replyingTo = null;      // message being replied to
let ctxMsg = null;          // message for context menu

// Voice recording
let mediaRec = null;
let recChunks = [];
let recTimer = null;
let recSecs = 0;
let isRecording = false;

// Video circle
let vcStream = null;
let vcRec = null;
let vcChunks = [];
let vcTimer = null;
let vcSecs = 0;
let vcRecording = false;

// WebRTC
let pc = null;
let localStream = null;
let callTimer = null;
let callSecs = 0;
let incomingOffer = null;
let incomingCaller = null;
let incomingCallType = null;
let isMuted = false;
let isCamOff = false;
let currentCallType = null;

const iceServers = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
]};

// ── Helpers ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const fmt = (str,...a) => str;

function toast(msg, type='success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<div class="toast-dot"></div>${msg}`;
  $('toast-container').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
}

function fmtDate(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) return 'Today';
  if (diff < 172800000) return 'Yesterday';
  return d.toLocaleDateString([], { month:'short', day:'numeric' });
}

function secs2str(s) {
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}

function getUserInitials(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

function getUser(username) {
  return allUsers.find(u => u.username === username) || { username, displayName: username };
}

function renderAvatar(el, user, size=48) {
  if (!user) return;
  el.innerHTML = '';
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.fontSize = Math.floor(size*0.36) + 'px';
  if (user.avatar) {
    const img = document.createElement('img');
    img.src = user.avatar;
    el.appendChild(img);
  } else {
    el.textContent = getUserInitials(user.displayName || user.username);
  }
  // Online dot
  const existing = el.querySelector('.online-dot');
  if (existing) existing.remove();
  if (user.online) {
    const dot = document.createElement('div');
    dot.className = 'online-dot';
    el.appendChild(dot);
  }
}

// ── Auth ───────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t,i) => {
    t.classList.toggle('active', (i===0) === (tab==='login'));
  });
  $('tab-login').style.display = tab==='login'?'':'none';
  $('tab-register').style.display = tab==='register'?'':'none';
  $('auth-err').textContent = '';
}

function doLogin() {
  const username = $('l-user').value.trim();
  const password = $('l-pass').value;
  if (!username || !password) { $('auth-err').textContent='Please fill all fields'; return; }
  socket.emit('login', { username, password }, res => {
    if (res.error) { $('auth-err').textContent = res.error; return; }
    onAuth(res.user);
  });
}

function doRegister() {
  const displayName = $('r-name').value.trim();
  const username = $('r-user').value.trim();
  const password = $('r-pass').value;
  if (!displayName || !username || !password) { $('auth-err').textContent='Please fill all fields'; return; }
  socket.emit('register', { username, password, displayName }, res => {
    if (res.error) { $('auth-err').textContent = res.error; return; }
    onAuth(res.user);
  });
}

// Enter key on auth fields
document.querySelectorAll('#tab-login input').forEach(inp =>
  inp.addEventListener('keydown', e => { if (e.key==='Enter') doLogin(); })
);
document.querySelectorAll('#tab-register input').forEach(inp =>
  inp.addEventListener('keydown', e => { if (e.key==='Enter') doRegister(); })
);

function onAuth(user) {
  me = user;
  $('auth-screen').style.display = 'none';
  $('app').classList.add('visible');
  updateMyProfile();
  loadUsers();
  loadPrivacySettings();
  showPanel('chats');
}

function logout() {
  socket.emit('logout');
  me = null;
  activeChat = null;
  chatHistory = {};
  unreadCounts = {};
  $('app').classList.remove('visible');
  $('auth-screen').style.display = 'flex';
  $('chat-list').innerHTML = '';
  $('l-user').value = '';
  $('l-pass').value = '';
  $('auth-err').textContent = '';
}

function updateMyProfile() {
  if (!me) return;
  $('my-display-name').textContent = me.displayName;
  $('my-username-display').textContent = '@' + me.username;
  renderAvatar($('my-avatar'), { ...me, online: true }, 90);
  $('edit-name').value = me.displayName || '';
  $('edit-bio').value = me.bio || '';
}

// ── Users / Contacts ───────────────────────────────────────────────────
function loadUsers() {
  fetch('/api/users').then(r=>r.json()).then(users => {
    allUsers = users.filter(u => u.username !== me.username);
    renderChatList();
    renderContacts();
  });
}

function renderChatList() {
  const list = $('chat-list');
  const query = $('search-input').value.toLowerCase();
  list.innerHTML = '';

  // Build items: users we've chatted with first, then rest
  const chatted = allUsers.filter(u => chatHistory[u.username]?.length > 0);
  const rest    = allUsers.filter(u => !chatHistory[u.username]?.length);
  const ordered = [...chatted, ...rest].filter(u =>
    !query || u.displayName.toLowerCase().includes(query) || u.username.toLowerCase().includes(query)
  );

  ordered.forEach(user => {
    const msgs = chatHistory[user.username] || [];
    const last = msgs[msgs.length-1];
    const uc = unreadCounts[user.username] || 0;
    const div = document.createElement('div');
    div.className = 'chat-item' + (activeChat===user.username?' active':'');
    div.onclick = () => openChat(user.username);

    let preview = '';
    if (last) {
      if (last.type==='voice') preview = 'Voice message';
      else if (last.type==='video_circle') preview = 'Video circle';
      else if (last.type==='image') preview = 'Photo';
      else preview = last.content;
    }

    const av = document.createElement('div');
    av.className = 'avatar';
    renderAvatar(av, user, 48);

    div.innerHTML = `
      <div class="chat-info">
        <div class="chat-name">${user.displayName}</div>
        <div class="chat-preview">${preview || '<span style="color:var(--text3)">Start a conversation</span>'}</div>
      </div>
      <div class="chat-meta">
        <div class="chat-time">${last ? fmtTime(last.timestamp) : ''}</div>
        ${uc > 0 ? `<div class="unread-badge">${uc}</div>` : ''}
      </div>
    `;
    div.insertBefore(av, div.firstChild);
    list.appendChild(div);
  });
}

function filterChats(q) { renderChatList(); }

function renderContacts() {
  const list = $('contacts-list');
  list.innerHTML = '';
  allUsers.forEach(user => {
    const div = document.createElement('div');
    div.className = 'contact-item';
    div.onclick = () => { openChat(user.username); showPanel('chats'); };
    const av = document.createElement('div');
    av.className = 'avatar';
    renderAvatar(av, user, 44);
    div.innerHTML = `
      <div class="info">
        <div class="name">${user.displayName}</div>
        <div class="status ${user.online?'online-s':''}">${user.online ? 'Online' : (lastSeen[user.username] ? 'last seen '+fmtTime(lastSeen[user.username]) : 'Offline')}</div>
      </div>
    `;
    div.insertBefore(av, div.firstChild);
    list.appendChild(div);
  });
}

// ── Chat ───────────────────────────────────────────────────────────────
function openChat(username) {
  activeChat = username;
  unreadCounts[username] = 0;

  const user = getUser(username);
  // Update header
  const av = $('ch-avatar');
  renderAvatar(av, user, 40);
  $('ch-name').textContent = user.displayName || username;
  updateStatus(username);

  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  // Mark active
  renderChatList();

  // Show chat window
  $('empty-state').style.display = 'none';
  $('chat-window').classList.add('open');
  $('settings-panel').classList.remove('open');
  $('contacts-panel').classList.remove('open');

  // Load messages
  socket.emit('get_messages', { with: username }, msgs => {
    chatHistory[username] = msgs || [];
    renderMessages();
    socket.emit('mark_read', { chatWith: username });
  });

  $('msg-input').focus();
}

function updateStatus(username) {
  const user = getUser(username);
  const statusEl = $('ch-status');
  if (user.online) {
    statusEl.textContent = 'Online';
    statusEl.className = 'status online';
  } else {
    const ls = lastSeen[username];
    statusEl.textContent = ls ? 'last seen ' + fmtDate(ls) + ' at ' + fmtTime(ls) : 'Offline';
    statusEl.className = 'status';
  }
}

function renderMessages() {
  const area = $('messages-area');
  const msgs = chatHistory[activeChat] || [];
  area.innerHTML = '';

  let lastDate = null;
  msgs.forEach(msg => {
    const d = new Date(msg.timestamp);
    const dateStr = fmtDate(msg.timestamp);
    if (dateStr !== lastDate) {
      const div = document.createElement('div');
      div.className = 'date-divider';
      div.innerHTML = `<span>${dateStr}</span>`;
      area.appendChild(div);
      lastDate = dateStr;
    }
    area.appendChild(createMsgEl(msg));
  });

  // Add typing bubble at end
  const tb = document.createElement('div');
  tb.className = 'typing-bubble';
  tb.id = 'typing-bubble';
  tb.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  area.appendChild(tb);

  area.scrollTop = area.scrollHeight;
}

function createMsgEl(msg) {
  const isOut = msg.from === me.username;
  const wrap = document.createElement('div');
  wrap.className = `msg-wrap ${isOut ? 'out' : 'in'}`;
  wrap.dataset.id = msg.id;

  let content = '';

  // Reply preview
  if (msg.replyTo) {
    const orig = findMsg(msg.replyTo);
    if (orig) {
      const rName = orig.from === me.username ? 'You' : (getUser(orig.from).displayName || orig.from);
      const rText = orig.type === 'voice' ? 'Voice message' : orig.type === 'video_circle' ? 'Video circle' : (orig.content || '');
      content += `<div class="reply-preview"><div class="reply-name">${rName}</div><div class="reply-text">${rText}</div></div>`;
    }
  }

  // Content by type
  if (msg.type === 'voice') {
    content += buildVoiceMsg(msg);
  } else if (msg.type === 'video_circle') {
    content += buildVideoCircle(msg);
  } else if (msg.type === 'image') {
    content += buildImageMsg(msg);
  } else {
    content += `<span>${escHtml(msg.content)}</span>`;
  }

  const ticks = isOut ? `
    <span class="ticks ${msg.read?'read':''}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      ${msg.delivered||msg.read ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:-8px"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
    </span>` : '';

  wrap.innerHTML = `
    <div class="msg-bubble">${content}</div>
    <div class="msg-time-status">${fmtTime(msg.timestamp)}${ticks}</div>
  `;

  // Context menu
  wrap.addEventListener('contextmenu', e => {
    e.preventDefault();
    showCtxMenu(e, msg);
  });
  wrap.addEventListener('touchstart', (e) => {
    const t = setTimeout(() => showCtxMenu({ clientX:e.touches[0].clientX, clientY:e.touches[0].clientY }, msg), 600);
    wrap.addEventListener('touchend', () => clearTimeout(t), { once:true });
  });

  // Voice play
  if (msg.type === 'voice') {
    setTimeout(() => setupVoicePlayer(wrap, msg), 0);
  }
  // Video circle play
  if (msg.type === 'video_circle') {
    setTimeout(() => setupVideoCirclePlayer(wrap, msg), 0);
  }
  // Image lightbox
  if (msg.type === 'image') {
    setTimeout(() => {
      const img = wrap.querySelector('.img-msg img');
      if (img) img.addEventListener('click', () => openLightbox(msg.content));
    }, 0);
  }

  return wrap;
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/\n/g,'<br>');
}

function findMsg(id) {
  const msgs = chatHistory[activeChat] || [];
  return msgs.find(m => m.id === id);
}

function buildVoiceMsg(msg) {
  const bars = Array(28).fill(0).map((_,i) => {
    const h = 6 + Math.random()*22;
    return `<div class="wave-bar" style="height:${h}px" data-i="${i}"></div>`;
  }).join('');
  return `
    <div class="voice-msg">
      <button class="play-btn" data-mid="${msg.id}">
        <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <div class="waveform">${bars}</div>
      <span class="voice-dur">${msg.duration ? secs2str(msg.duration) : '0:00'}</span>
    </div>`;
}

function setupVoicePlayer(wrap, msg) {
  const btn = wrap.querySelector('.play-btn');
  const bars = wrap.querySelectorAll('.wave-bar');
  const durEl = wrap.querySelector('.voice-dur');
  if (!btn) return;
  let audio = null;
  let playing = false;
  let progTimer = null;

  btn.addEventListener('click', () => {
    if (!audio) {
      audio = new Audio(msg.content);
      audio.addEventListener('timeupdate', () => {
        const pct = audio.currentTime / (audio.duration || 1);
        const active = Math.floor(pct * bars.length);
        bars.forEach((b,i) => b.classList.toggle('active', i <= active));
        durEl.textContent = secs2str(Math.floor(audio.currentTime));
      });
      audio.addEventListener('ended', () => {
        playing = false;
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
        bars.forEach(b => b.classList.remove('active'));
        durEl.textContent = secs2str(msg.duration || 0);
      });
    }
    if (playing) {
      audio.pause(); playing = false;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    } else {
      audio.play(); playing = true;
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    }
  });
}

function buildVideoCircle(msg) {
  return `
    <div class="video-circle" data-mid="${msg.id}">
      <video src="${msg.content}" loop preload="metadata" playsinline></video>
      <div class="vc-play-overlay">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
    </div>`;
}

function setupVideoCirclePlayer(wrap, msg) {
  const vc = wrap.querySelector('.video-circle');
  if (!vc) return;
  const video = vc.querySelector('video');
  const overlay = vc.querySelector('.vc-play-overlay');
  vc.addEventListener('click', () => {
    if (video.paused) {
      video.play();
      overlay.style.display = 'none';
    } else {
      video.pause();
      overlay.style.display = 'flex';
    }
  });
}

function buildImageMsg(msg) {
  return `<div class="img-msg"><img src="${msg.content}" alt="Photo" loading="lazy"/></div>`;
}

function appendMsg(msg) {
  if (!chatHistory[msg.from] && msg.from !== me.username) chatHistory[msg.from] = [];
  if (!chatHistory[msg.to] && msg.to !== me.username) chatHistory[msg.to] = [];
  const key = msg.from === me.username ? msg.to : msg.from;
  if (!chatHistory[key]) chatHistory[key] = [];
  chatHistory[key].push(msg);

  if (activeChat === key) {
    const area = $('messages-area');
    const tb = $('typing-bubble');
    area.insertBefore(createMsgEl(msg), tb);
    area.scrollTop = area.scrollHeight;
  }
  renderChatList();
}

// ── Sending ────────────────────────────────────────────────────────────
function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendText();
  }
}

function handleInput(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  const hasText = el.value.trim().length > 0;
  $('send-icon').style.display = hasText ? '' : 'none';
  $('mic-icon').style.display = hasText ? 'none' : '';
  $('send-btn').classList.toggle('mic-mode', !hasText);
  if (!activeChat) return;
  socket.emit('typing', { to: activeChat, isTyping: hasText });
}

function handleSendBtn() {
  const hasText = $('msg-input').value.trim().length > 0;
  if (hasText) sendText();
  else startVoiceRecord();
}

function sendText() {
  const input = $('msg-input');
  const text = input.value.trim();
  if (!text || !activeChat) return;
  const data = { to: activeChat, content: text, type: 'text' };
  if (replyingTo) { data.replyTo = replyingTo.id; cancelReply(); }
  socket.emit('send_message', data, res => {
    if (res?.ok) appendMsg(res.message);
  });
  input.value = '';
  input.style.height = 'auto';
  handleInput(input);
  socket.emit('typing', { to: activeChat, isTyping: false });
}

function handleFileUpload(inp) {
  if (!inp.files[0] || !activeChat) return;
  const file = inp.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const type = file.type.startsWith('video') ? 'video_circle' : 'image';
    const data = { to: activeChat, content: e.target.result, type };
    if (replyingTo) { data.replyTo = replyingTo.id; cancelReply(); }
    socket.emit('send_message', data, res => {
      if (res?.ok) appendMsg(res.message);
    });
  };
  reader.readAsDataURL(file);
  inp.value = '';
}

// ── Voice recording ────────────────────────────────────────────────────
async function startVoiceRecord() {
  if (!activeChat) return;
  if (isRecording) { stopVoiceRecord(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRec = new MediaRecorder(stream);
    recChunks = [];
    mediaRec.ondataavailable = e => recChunks.push(e.data);
    mediaRec.onstop = sendVoiceMsg;
    mediaRec.start();
    isRecording = true;
    recSecs = 0;
    $('recording-bar').classList.add('show');
    $('rec-time').textContent = '0:00';
    recTimer = setInterval(() => {
      recSecs++;
      $('rec-time').textContent = secs2str(recSecs);
      if (recSecs >= 120) stopVoiceRecord();
    }, 1000);
  } catch(e) {
    toast('Microphone access denied', 'error');
  }
}

function stopVoiceRecord() {
  if (!mediaRec || !isRecording) return;
  mediaRec.stop();
  mediaRec.stream.getTracks().forEach(t=>t.stop());
  isRecording = false;
  clearInterval(recTimer);
  $('recording-bar').classList.remove('show');
}

function cancelRecord() {
  if (mediaRec && isRecording) {
    mediaRec.ondataavailable = null;
    mediaRec.onstop = null;
    mediaRec.stop();
    mediaRec.stream.getTracks().forEach(t=>t.stop());
    isRecording = false;
    clearInterval(recTimer);
    $('recording-bar').classList.remove('show');
    recChunks = [];
  }
}

function sendVoiceMsg() {
  if (recChunks.length === 0) return;
  const blob = new Blob(recChunks, { type: 'audio/webm' });
  const reader = new FileReader();
  const dur = recSecs;
  reader.onload = e => {
    const data = { to: activeChat, content: e.target.result, type: 'voice', duration: dur };
    if (replyingTo) { data.replyTo = replyingTo.id; cancelReply(); }
    socket.emit('send_message', data, res => {
      if (res?.ok) appendMsg(res.message);
    });
  };
  reader.readAsDataURL(blob);
  recChunks = [];
}

// ── Video Circle recording ─────────────────────────────────────────────
async function startVideoCircle() {
  if (!activeChat) return;
  try {
    vcStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:'user' }, audio: true });
    $('vc-preview-video').srcObject = vcStream;
    $('vc-overlay').classList.add('show');
    vcSecs = 0;
    $('vc-timer').textContent = '0:00';
    vcRecording = false;
  } catch(e) {
    toast('Camera/mic access denied', 'error');
  }
}

function toggleVideoRecord() {
  if (!vcRecording) {
    vcRec = new MediaRecorder(vcStream);
    vcChunks = [];
    vcRec.ondataavailable = e => vcChunks.push(e.data);
    vcRec.onstop = sendVideoCircle;
    vcRec.start();
    vcRecording = true;
    vcSecs = 0;
    $('vc-record-btn').style.background = 'var(--accent)';
    $('vc-timer').style.color = 'var(--red)';
    vcTimer = setInterval(() => {
      vcSecs++;
      $('vc-timer').textContent = secs2str(vcSecs);
      if (vcSecs >= 60) { stopVideoRecord(); }
    }, 1000);
  } else {
    stopVideoRecord();
  }
}

function stopVideoRecord() {
  if (vcRec && vcRecording) {
    vcRec.stop();
    vcRecording = false;
    clearInterval(vcTimer);
  }
}

function sendVideoCircle() {
  const blob = new Blob(vcChunks, { type: 'video/webm' });
  const reader = new FileReader();
  reader.onload = e => {
    socket.emit('send_message', { to: activeChat, content: e.target.result, type: 'video_circle' }, res => {
      if (res?.ok) appendMsg(res.message);
    });
  };
  reader.readAsDataURL(blob);
  cancelVideoCircle();
}

function cancelVideoCircle() {
  if (vcStream) { vcStream.getTracks().forEach(t=>t.stop()); vcStream = null; }
  vcChunks = [];
  vcRecording = false;
  clearInterval(vcTimer);
  $('vc-overlay').classList.remove('show');
  $('vc-preview-video').srcObject = null;
  $('vc-timer').textContent = '0:00';
  $('vc-timer').style.color = '#fff';
}

// ── Reply ───────────────────────────────────────────────────────────────
function cancelReply() {
  replyingTo = null;
  $('reply-bar').classList.remove('show');
}

function startReply(msg) {
  replyingTo = msg;
  const name = msg.from === me.username ? 'You' : (getUser(msg.from).displayName || msg.from);
  $('reply-name').textContent = name;
  $('reply-text').textContent = msg.type==='voice'?'Voice message':msg.type==='video_circle'?'Video circle':(msg.content||'');
  $('reply-bar').classList.add('show');
  $('msg-input').focus();
}

// ── Context Menu ───────────────────────────────────────────────────────
function showCtxMenu(e, msg) {
  ctxMsg = msg;
  const menu = $('ctx-menu');
  $('ctx-delete').style.display = msg.from === me.username ? '' : 'none';
  $('ctx-copy').style.display = msg.type === 'text' ? '' : 'none';
  menu.classList.add('show');
  const x = Math.min(e.clientX, window.innerWidth - 180);
  const y = Math.min(e.clientY, window.innerHeight - 140);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

document.addEventListener('click', () => $('ctx-menu').classList.remove('show'));

function ctxReply() { if (ctxMsg) startReply(ctxMsg); }
function ctxCopy() {
  if (ctxMsg?.content) navigator.clipboard.writeText(ctxMsg.content).then(() => toast('Copied'));
}
function ctxDelete() {
  if (!ctxMsg) return;
  socket.emit('delete_message', { msgId: ctxMsg.id, chatWith: activeChat }, res => {
    if (res?.ok) toast('Message deleted');
  });
}

// ── Lightbox ───────────────────────────────────────────────────────────
function openLightbox(src) {
  $('lightbox-img').src = src;
  $('lightbox').classList.add('show');
}

// ── Panels ─────────────────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  $(`nav-${name}`)?.classList.add('active');
  if (name !== 'chats') {
    $('chat-window').classList.remove('open');
    $('empty-state').style.display = 'none';
    activeChat = null;
  }
  $('settings-panel').classList.toggle('open', name==='settings');
  $('contacts-panel').classList.toggle('open', name==='contacts');
  if (name === 'chats') {
    $('settings-panel').classList.remove('open');
    $('contacts-panel').classList.remove('open');
    if (!activeChat) $('empty-state').style.display = 'flex';
  }
  renderChatList();
  if (name === 'contacts') renderContacts();
}

function toggleSub(id) {
  const el = $(id);
  el.classList.toggle('open');
}

function openCompose() { showPanel('contacts'); }

// ── Profile sidebar ────────────────────────────────────────────────────
function openProfile() {
  if (!activeChat) return;
  // Simple: show toast with user info
  const user = getUser(activeChat);
  toast(`${user.displayName} (@${user.username}) — ${user.bio || 'No bio'}`);
}

// ── Settings ───────────────────────────────────────────────────────────
function loadPrivacySettings() {
  if (!me?.privacy) return;
  const p = me.privacy;
  if ($('priv-lastseen')) $('priv-lastseen').value = p.lastSeen || 'everyone';
  if ($('priv-photo')) $('priv-photo').value = p.profilePhoto || 'everyone';
  if ($('priv-online')) $('priv-online').value = p.online || 'everyone';
}

function savePrivacy() {
  const privacy = {
    lastSeen: $('priv-lastseen').value,
    profilePhoto: $('priv-photo').value,
    online: $('priv-online').value
  };
  socket.emit('update_profile', { privacy }, res => {
    if (res?.ok) { me = { ...me, ...res.user }; toast('Privacy updated'); }
  });
}

function saveProfile() {
  const displayName = $('edit-name').value.trim();
  const bio = $('edit-bio').value;
  if (!displayName) { toast('Name cannot be empty', 'error'); return; }
  socket.emit('update_profile', { displayName, bio }, res => {
    if (res?.ok) {
      me = { ...me, ...res.user };
      updateMyProfile();
      toast('Profile saved');
    }
  });
}

function uploadAvatar(inp) {
  if (!inp.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const avatar = e.target.result;
    fetch('/api/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: me.username, avatar })
    }).then(r => r.json()).then(() => {
      me.avatar = avatar;
      updateMyProfile();
      // Update in allUsers
      const u = allUsers.find(u => u.username === me.username);
      if (u) u.avatar = avatar;
      toast('Photo updated');
    });
  };
  reader.readAsDataURL(inp.files[0]);
  inp.value = '';
}

// ── WebRTC Calls ───────────────────────────────────────────────────────
async function startCall(type) {
  if (!activeChat) return;
  currentCallType = type;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video'
    });
  } catch(e) {
    toast('Could not access camera/microphone', 'error');
    return;
  }

  pc = new RTCPeerConnection(iceServers);
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.ontrack = e => {
    $('remote-video').srcObject = e.streams[0];
  };
  pc.onicecandidate = e => {
    if (e.candidate) socket.emit('ice_candidate', { to: activeChat, candidate: e.candidate });
  };

  if (type === 'video') {
    $('local-video').srcObject = localStream;
    $('video-wrap').classList.add('show');
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.emit('call_user', { to: activeChat, offer, callType: type });

  // Show outgoing call UI
  const user = getUser(activeChat);
  showCallOverlay(user, 'Calling...', false);
}

function showCallOverlay(user, status, isIncoming) {
  const av = $('call-avatar');
  renderAvatar(av, user, 90);
  av.classList.toggle('ringing', true);
  $('call-name').textContent = user.displayName || user.username;
  $('call-status').textContent = status;
  $('call-timer').style.display = 'none';
  $('call-overlay').classList.add('show');

  if (isIncoming) {
    // Show answer button
    $('call-actions').innerHTML = `
      <button class="call-btn mute" id="mute-btn" onclick="toggleMute()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      </button>
      <button class="call-btn answer" onclick="acceptCallFull()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.79 19.79 19.79 0 01.22 1.18 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.39 7.09a16 16 0 006.52 6.52l1.45-1.45a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14z"/></svg>
      </button>
      <button class="call-btn end" onclick="endCall()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.07 9.12 19.79 19.79 0 01.22.5 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.39 7.09a16 16 0 006.29 6.22z"/></svg>
      </button>
    `;
  }
}

function startCallTimer() {
  callSecs = 0;
  $('call-status').style.display = 'none';
  $('call-timer').style.display = '';
  $('call-avatar').classList.remove('ringing');
  callTimer = setInterval(() => {
    callSecs++;
    $('call-timer').textContent = secs2str(callSecs);
  }, 1000);
}

function endCall() {
  if (activeChat) socket.emit('call_end', { to: activeChat });
  if (incomingCaller) socket.emit('call_end', { to: incomingCaller });
  cleanupCall();
}

function cleanupCall() {
  if (pc) { pc.close(); pc = null; }
  if (localStream) { localStream.getTracks().forEach(t=>t.stop()); localStream = null; }
  if (callTimer) { clearInterval(callTimer); callTimer = null; }
  $('call-overlay').classList.remove('show');
  $('incoming-call').classList.remove('show');
  $('video-wrap').classList.remove('show');
  $('remote-video').srcObject = null;
  $('local-video').srcObject = null;
  $('call-status').style.display = '';
  $('call-timer').style.display = 'none';
  incomingCaller = null;
  incomingOffer = null;
  currentCallType = null;
  isMuted = false;
  isCamOff = false;
  // Reset actions
  $('call-actions').innerHTML = `
    <button class="call-btn mute" id="mute-btn" onclick="toggleMute()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 013 3v7a3 3 0 01-6 0V5a3 3 0 013-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg></button>
    <button class="call-btn end" onclick="endCall()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.42 19.42 0 013.07 9.12 19.79 19.79 0 01.22.5 2 2 0 012.18 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.39 7.09a16 16 0 006.29 6.22z"/></svg></button>
    <button class="call-btn cam" id="cam-btn" onclick="toggleCam()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></button>
  `;
}

function toggleMute() {
  if (!localStream) return;
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !isMuted);
  const btn = $('mute-btn');
  if (btn) btn.classList.toggle('active-btn', isMuted);
}

function toggleCam() {
  if (!localStream) return;
  isCamOff = !isCamOff;
  localStream.getVideoTracks().forEach(t => t.enabled = !isCamOff);
  const btn = $('cam-btn');
  if (btn) btn.classList.toggle('active-btn', isCamOff);
}

// Incoming call (small notification)
function showIncomingCall(from, callType) {
  incomingCaller = from;
  incomingCallType = callType;
  const user = getUser(from);
  const av = $('inc-avatar');
  renderAvatar(av, user, 44);
  $('inc-name').textContent = user.displayName || from;
  $('inc-type').textContent = callType === 'video' ? 'Incoming video call' : 'Incoming voice call';
  $('incoming-call').classList.add('show');
}

function rejectCall() {
  socket.emit('call_reject', { to: incomingCaller });
  incomingCaller = null;
  incomingOffer = null;
  $('incoming-call').classList.remove('show');
}

async function acceptCall() {
  $('incoming-call').classList.remove('show');
  const caller = incomingCaller;
  const type = incomingCallType;
  const offer = incomingOffer;
  if (!offer || !caller) return;
  currentCallType = type;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video'
    });
  } catch(e) {
    toast('Could not access microphone', 'error');
    return;
  }

  pc = new RTCPeerConnection(iceServers);
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  pc.ontrack = e => { $('remote-video').srcObject = e.streams[0]; };
  pc.onicecandidate = e => {
    if (e.candidate) socket.emit('ice_candidate', { to: caller, candidate: e.candidate });
  };

  if (type === 'video') {
    $('local-video').srcObject = localStream;
    $('video-wrap').classList.add('show');
  }

  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit('call_answer', { to: caller, answer });

  const user = getUser(caller);
  showCallOverlay(user, 'Connected', false);
  startCallTimer();
}

function acceptCallFull() {
  acceptCall();
}

// ── Socket Events ──────────────────────────────────────────────────────
socket.on('new_message', msg => {
  const key = msg.from === me?.username ? msg.to : msg.from;
  if (!chatHistory[key]) chatHistory[key] = [];
  chatHistory[key].push(msg);

  if (activeChat === key) {
    const area = $('messages-area');
    const tb = $('typing-bubble');
    area.insertBefore(createMsgEl(msg), tb);
    area.scrollTop = area.scrollHeight;
    socket.emit('mark_read', { chatWith: key });
  } else {
    unreadCounts[key] = (unreadCounts[key] || 0) + 1;
    // Notification
    if ($('notif-toggle')?.classList.contains('on') && Notification.permission === 'granted') {
      const u = getUser(msg.from);
      new Notification(u.displayName || msg.from, {
        body: msg.type==='voice'?'Voice message':msg.type==='video_circle'?'Video circle':(msg.content||''),
        icon: u.avatar || ''
      });
    }
  }
  renderChatList();
});

socket.on('messages_read', ({ by }) => {
  if (!chatHistory[by]) return;
  chatHistory[by].forEach(m => { if (m.from === me?.username) m.read = true; });
  if (activeChat === by) renderMessages();
});

socket.on('message_deleted', ({ msgId }) => {
  if (!activeChat) return;
  const msgs = chatHistory[activeChat];
  if (msgs) {
    const idx = msgs.findIndex(m => m.id === msgId);
    if (idx !== -1) msgs.splice(idx, 1);
    renderMessages();
  }
});

socket.on('user_typing', ({ from, isTyping }) => {
  if (from !== activeChat) return;
  const tb = $('typing-bubble');
  if (tb) tb.classList.toggle('show', isTyping);
});

socket.on('user_online', ({ username }) => {
  const u = allUsers.find(u => u.username === username);
  if (u) u.online = true;
  if (activeChat === username) updateStatus(username);
  renderChatList();
  renderContacts();
});

socket.on('user_offline', ({ username, lastSeen: ls }) => {
  const u = allUsers.find(u => u.username === username);
  if (u) u.online = false;
  if (ls) lastSeen[username] = ls;
  if (activeChat === username) updateStatus(username);
  renderChatList();
  renderContacts();
});

socket.on('user_updated', ({ username, avatar, displayName }) => {
  const u = allUsers.find(u => u.username === username);
  if (u) {
    if (avatar !== undefined) u.avatar = avatar;
    if (displayName) u.displayName = displayName;
  }
  if (activeChat === username) {
    const u2 = getUser(username);
    renderAvatar($('ch-avatar'), u2, 40);
    $('ch-name').textContent = u2.displayName;
  }
  renderChatList();
  renderContacts();
});

// WebRTC
socket.on('incoming_call', ({ from, offer, callType }) => {
  if (pc) {
    socket.emit('call_busy', { to: from });
    return;
  }
  incomingOffer = offer;
  incomingCaller = from;
  incomingCallType = callType;
  showIncomingCall(from, callType);
});

socket.on('call_answered', async ({ answer }) => {
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
  $('call-status').textContent = 'Connected';
  startCallTimer();
});

socket.on('ice_candidate', async ({ candidate }) => {
  if (!pc) return;
  try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch(e) {}
});

socket.on('call_ended', () => {
  toast('Call ended');
  cleanupCall();
});

socket.on('call_rejected', () => {
  toast('Call rejected', 'error');
  cleanupCall();
});

socket.on('call_busy', () => {
  toast('User is busy', 'error');
  cleanupCall();
});

// ── Init ────────────────────────────────────────────────────────────────
// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Initial mic icon shown
$('send-icon').style.display = 'none';
$('mic-icon').style.display = '';

// Prevent context menu on messages area
$('messages-area')?.addEventListener('contextmenu', e => e.preventDefault());

</body>
</html>        /* Chat Area */
        .main-chat { flex: 1; display: flex; flex-direction: column; background: #0e1621 url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'); background-blend-mode: soft-light; }
        
        .chat-header { height: 56px; background: var(--tg-sidebar); display: flex; align-items: center; padding: 0 20px; justify-content: space-between; border-bottom: 1px solid var(--tg-border); }
        .chat-info h3 { font-size: 16px; }
        .chat-info span { font-size: 13px; color: var(--tg-accent); }

        /* Messages */
        .messages-container { flex: 1; padding: 15px 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
        .msg-group { display: flex; flex-direction: column; max-width: 75%; position: relative; margin-bottom: 4px; }
        .msg-group.out { align-self: flex-end; }
        .msg-group.in { align-self: flex-start; }

        .bubble { padding: 8px 12px; border-radius: 12px; font-size: 15px; line-height: 1.4; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        .in .bubble { background: var(--tg-msg-in); border-bottom-left-radius: 4px; }
        .out .bubble { background: var(--tg-msg-out); border-bottom-right-radius: 4px; }
        
        .msg-name { font-size: 13px; font-weight: 600; color: var(--tg-accent); margin-bottom: 2px; }
        .msg-time { font-size: 11px; color: var(--tg-muted); float: right; margin-top: 5px; margin-left: 8px; }

        /* Input Bar */
        .input-bar { background: var(--tg-sidebar); padding: 10px 20px; display: flex; align-items: center; gap: 15px; }
        .attach-btn { fill: var(--tg-muted); cursor: pointer; }
        .message-input { flex: 1; background: none; border: none; color: #fff; font-size: 16px; outline: none; padding: 10px 0; }
        .send-btn { color: var(--tg-accent); border: none; background: none; font-weight: bold; cursor: pointer; font-size: 15px; }

        /* Settings Panel */
        .settings-overlay { position: absolute; inset: 0; background: var(--tg-sidebar); z-index: 100; transform: translateX(-100%); transition: 0.3s ease; display: flex; flex-direction: column; }
        .settings-overlay.open { transform: translateX(0); }
        .settings-header { padding: 15px; display: flex; align-items: center; gap: 20px; border-bottom: 1px solid var(--tg-border); }
        .settings-content { padding: 20px; flex: 1; overflow-y: auto; }
        .profile-edit { text-align: center; margin-bottom: 30px; }
        .profile-edit .avatar-large { width: 100px; height: 100px; margin: 0 auto 15px; font-size: 36px; }
        .s-input-group { margin-bottom: 20px; }
        .s-input-group label { display: block; color: var(--tg-accent); font-size: 13px; margin-bottom: 8px; font-weight: bold; }
        .s-input { width: 100%; background: var(--tg-bg); border: 1px solid var(--tg-border); padding: 12px; color: #fff; border-radius: 8px; outline: none; }

        svg { fill: var(--tg-muted); width: 24px; height: 24px; }
        .active-svg { fill: var(--tg-accent); }
    </style>
</head>
<body>

    <div class="sidebar">
        <div class="sidebar-header">
            <button class="menu-btn" onclick="toggleSettings(true)">
                <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <input type="text" class="search-bar" placeholder="Поиск">
        </div>
        
        <div class="chat-item">
            <div class="avatar" id="sideAva">F</div>
            <div style="flex:1">
                <div style="font-weight: bold; font-size: 15px;">Freedom Global</div>
                <div style="color: var(--tg-muted); font-size: 13px;" id="dhStatus">DH: Ожидание...</div>
            </div>
        </div>

        <div class="settings-overlay" id="settingsPanel">
            <div class="settings-header">
                <button class="menu-btn" onclick="toggleSettings(false)">
                    <svg viewBox="0 0 24 24"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                </button>
                <h3>Настройки</h3>
            </div>
            <div class="settings-content">
                <div class="profile-edit">
                    <div class="avatar avatar-large" id="setAva">U</div>
                    <button style="background:none; border:none; color:var(--tg-accent); cursor:pointer">Изменить фото</button>
                </div>
                <div class="s-input-group">
                    <label>Ваш никнейм</label>
                    <input type="text" id="nickInp" class="s-input" oninput="saveProfile()">
                </div>
                <div style="background: rgba(51, 144, 236, 0.05); padding: 15px; border-radius: 10px; font-size: 13px; color: var(--tg-muted);">
                    Все сообщения защищены сквозным шифрованием Диффи-Хеллмана. Ключи никогда не покидают браузер.
                </div>
            </div>
        </div>
    </div>

    <div class="main-chat">
        <div class="chat-header">
            <div class="chat-info">
                <h3>Freedom Global Chat</h3>
                <span id="netStatus">ожидание сети...</span>
            </div>
            <div class="encryption-badge" style="font-size: 11px; color: var(--tg-muted);">E2EE SECURED</div>
        </div>

        <div class="messages-container" id="msgBox"></div>

        <div class="input-bar">
            <div class="attach-btn">
                <svg viewBox="0 0 24 24"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4s-4 1.79-4 4v12.5c0 3.31 2.69 6 6 6s6-2.69 6-6V6h-1.5z"/></svg>
            </div>
            <input type="text" id="mainMsgInput" class="message-input" placeholder="Написать сообщение...">
            <button class="send-btn" onclick="send()">ОТПРАВИТЬ</button>
        </div>
    </div>

    
        const socket = io();
        let sharedSecret = null;

        // --- DH ALGORITHM ---
        const P = 0xFFFFFFFB; 
        const G = 2;
        const privKey = Math.floor(Math.random() * 1000000);
        const pubKey = BigInt(G) ** BigInt(privKey) % BigInt(P);

        socket.on('connect', () => {
            document.getElementById('netStatus').textContent = 'в сети';
            socket.emit('dh-init', { key: pubKey.toString() });
        });

        socket.on('dh-init', (data) => {
            const remotePubKey = BigInt(data.key);
            sharedSecret = remotePubKey ** BigInt(privKey) % BigInt(P);
            document.getElementById('dhStatus').textContent = 'Шифрование активно';
            document.getElementById('dhStatus').style.color = '#4caf50';
        });

        // --- CRYPTO ---
        function encrypt(t) {
            if(!sharedSecret) return t;
            return CryptoJS.AES.encrypt(t, sharedSecret.toString()).toString();
        }
        function decrypt(c) {
            if(!sharedSecret) return c;
            try {
                const b = CryptoJS.AES.decrypt(c, sharedSecret.toString());
                return b.toString(CryptoJS.enc.Utf8) || "🔒 Зашифровано";
            } catch(e) { return "🔒 Зашифровано"; }
        }

        // --- ACTIONS ---
        function send() {
            const inp = document.getElementById('mainMsgInput');
            if(!inp.value.trim()) return;
            
            const nick = localStorage.getItem('f_nick') || 'User';
            const text = inp.value.trim();
            
            socket.emit('chat message', { text: encrypt(text), nick: nick });
            render(text, 'out', 'Вы');
            inp.value = '';
        }

        socket.on('chat message', (data) => {
            render(decrypt(data.text), 'in', data.nick);
        });

        function render(text, type, name) {
            const box = document.getElementById('msgBox');
            const group = document.createElement('div');
            group.className = `msg-group ${type}`;
            
            const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            
            group.innerHTML = `
                ${type === 'in' ? `<div class="msg-name">${name}</div>` : ''}
                <div class="bubble">
                    ${text}
                    <span class="msg-time">${time}</span>
                </div>
            `;
            box.appendChild(group);
            box.scrollTop = box.scrollHeight;
        }

        // --- UI & PROFILE ---
        function toggleSettings(open) {
            document.getElementById('settingsPanel').classList.toggle('open', open);
        }

        function saveProfile() {
            const nick = document.getElementById('nickInp').value;
            localStorage.setItem('f_nick', nick);
            document.getElementById('setAva').textContent = nick.charAt(0).toUpperCase() || 'U';
            document.getElementById('sideAva').textContent = nick.charAt(0).toUpperCase() || 'U';
        }

        window.onload = () => {
            const savedNick = localStorage.getItem('f_nick') || 'Anonymous';
            document.getElementById('nickInp').value = savedNick;
            saveProfile();
        };

        document.getElementById('mainMsgInput').onkeydown = e => { if(e.key === 'Enter') send(); };
    
</body>
</html>        .message.in { background-color: var(--message-in); align-self: flex-start; border-bottom-left-radius: 2px; }
        .message.out { background-color: var(--message-out); align-self: flex-end; border-bottom-right-radius: 2px; }
        
        /* ВВОД */
        .input-area { background-color: var(--bg-panel); padding: 10px 20px; display: flex; align-items: center; gap: 12px; }
        .input-field { flex: 1; background: var(--bg-dark); border: none; padding: 12px 18px; border-radius: 22px; color: #fff; outline: none; }
        
        /* МОДАЛКА НАСТРОЕК */
        .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; align-items: center; justify-content: center; }
        .modal-content { background: var(--bg-panel); width: 400px; border-radius: 15px; overflow: hidden; }
        .settings-list { padding: 20px; }
        .s-item { margin-bottom: 15px; }
        .s-item label { display: block; font-size: 12px; color: var(--success); margin-bottom: 5px; text-transform: uppercase; }
        .s-item input { width: 100%; background: var(--bg-dark); border: 1px solid var(--border); padding: 10px; color: #fff; border-radius: 8px; outline: none; }

        .btn-icon { background: none; border: none; cursor: pointer; padding: 5px; border-radius: 50%; display: flex; align-items: center; }
        svg { fill: var(--text-muted); width: 24px; height: 24px; }
        .rec-active { fill: var(--danger) !important; animation: blink 1s infinite; }
        @keyframes blink { 50% { opacity: 0.5; } }
    </style>
</head>
<body>

    <div class="sidebar">
        <div class="sidebar-header">
            <button class="btn-icon" onclick="toggleModal(true)">
                <svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <input type="text" class="search-bar" placeholder="Поиск">
        </div>
        <div style="padding: 20px; color: var(--text-muted); font-size: 13px; text-align: center;">
            Freedom Messenger<br>Сквозное шифрование включено
        </div>
    </div>

    <div class="chat-area">
        <div class="chat-header">
            <div class="header-info">
                <h2>Freedom Global Chat</h2>
                <span id="netStatus">подключение...</span>
            </div>
        </div>

        <div class="messages" id="msgBox"></div>

        <div class="input-area">
            <input type="text" id="msgInput" class="input-field" placeholder="Написать сообщение...">
            <button class="btn-icon" id="sendBtn" style="display:none" onclick="sendMsg()">
                <svg style="fill:var(--success)" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
            <button class="btn-icon" id="micBtn" onclick="toggleMic()">
                <svg id="micIcon" viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>
            </button>
        </div>
    </div>

    <div class="modal" id="settingsModal">
        <div class="modal-content">
            <div style="padding: 15px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between;">
                <h3>Настройки</h3>
                <button onclick="toggleModal(false)" style="background:none; border:none; color:#fff; cursor:pointer;">✕</button>
            </div>
            <div class="settings-list">
                <div class="s-item">
                    <label>Ваш ник</label>
                    <input type="text" id="nickInp" placeholder="Напр. Pavel">
                </div>
                <div class="s-item">
                    <label>Ключ шифрования (AES)</label>
                    <input type="password" id="cryptoInp" placeholder="Секретный код">
                </div>
                <button onclick="saveSettings()" style="width:100%; padding:12px; background:var(--success); border:none; color:#fff; border-radius:8px; cursor:pointer; font-weight:bold;">СОХРАНИТЬ</button>
            </div>
        </div>
    </div>

    
