// ═══════════════════════════════════════════════════════════
// USERS.JS - Управление пользователями
// ═══════════════════════════════════════════════════════════

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
