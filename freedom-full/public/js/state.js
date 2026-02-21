// ═══════════════════════════════════════════════════════════
// STATE.JS - Глобальное состояние приложения
// ═══════════════════════════════════════════════════════════

let socket, me = null, cur = null;
let currentChat = null;
let users = [], hist = {}, unread = {}, prev = {};
let replyMsg = null, ctxMsg = null;
let tyTimer = null, typing = false;
let recorder = null, chunks = [], recInt = null;
let pc = null, localStream = null, incomingOffer = null;
let callInt = null, callSecs = 0, callUser = null, callKind = 'audio';
let attachImg = null, toastTimer = null, toastUser = null, pmUser = null;
let notifEnabled = false;
let currentTheme = localStorage.getItem('theme') || 'dark';

// Apply saved theme immediately
document.documentElement.setAttribute('data-theme', currentTheme);
