// ═══════════════════════════════════════════════════════════
// MESSAGES.JS - Отправка и рендеринг сообщений
// ═══════════════════════════════════════════════════════════

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
