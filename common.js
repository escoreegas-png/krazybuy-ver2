/* ============================================================
   KRAZYBUY — SHARED UTILITIES (auth, wishlist, history, toast, nav, theme)
============================================================ */
window.KB = (() => {
'use strict';

const API_BASE = "https://api.viscocompare.online";

/* ── Theme (applied immediately to avoid flash) ── */
const getTheme = () => localStorage.getItem('kb_theme') || 'dark';
function applyTheme(t){
  document.documentElement.dataset.theme = t;
  localStorage.setItem('kb_theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'light' ? '#F7F0E6' : '#120B0B';
}
applyTheme(getTheme());

const $  = (s,c=document)=>c.querySelector(s);
const $$ = (s,c=document)=>[...c.querySelectorAll(s)];
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cssEsc = s => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g,'\\$&');
const fmtPrice = n => { const x=Number(n); return (!x||isNaN(x)||x<=0) ? '—' : '₹'+x.toLocaleString('en-IN',{maximumFractionDigits:0}); };

function timeAgo(ts){
  const s=Math.floor((Date.now()-(typeof ts==='string'?new Date(ts).getTime():ts))/1000);
  if(s<60) return 'just now';
  if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago';
  if(s<604800) return Math.floor(s/86400)+'d ago';
  return new Date(ts).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}

/* ── Toasts ── */
function toast(type,title,msg='',dur=4000){
  let area=$('#toastArea');
  if(!area){ area=document.createElement('div'); area.id='toastArea'; area.setAttribute('aria-live','polite'); document.body.appendChild(area); }
  const icons={
    success:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>',
    error:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    warning:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9 1.8 18a1.5 1.5 0 0 0 1.3 2.3h17.8a1.5 1.5 0 0 0 1.3-2.3L13.7 3.9a1.5 1.5 0 0 0-2.6 0zM12 9v5M12 16.5h.01"/></svg>',
    info:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>'};
  const t=document.createElement('div');
  t.className=`toast ${type}`;
  t.innerHTML=`<span class="toast-icon">${icons[type]||icons.info}</span>
    <div><div class="toast-title">${esc(title)}</div>${msg?`<div class="toast-msg">${esc(msg)}</div>`:''}</div>
    <button class="toast-close" aria-label="Close"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  const kill=()=>{ if(t._d)return; t._d=1; clearTimeout(t._t); t.classList.add('out'); setTimeout(()=>t.remove(),300); };
  t.querySelector('.toast-close').onclick=kill;
  area.appendChild(t); t._t=setTimeout(kill,dur);
}

/* ── Auth (Google via backend JWT) ── */
const getToken = () => localStorage.getItem('kb_token');
const getUser  = () => { try{ return JSON.parse(localStorage.getItem('kb_user')); }catch{ return null; } };
const setUser  = u => localStorage.setItem('kb_user', JSON.stringify(u));

function logout(){
  authFetch('/logout',{method:'POST'}).catch(()=>{});
  localStorage.removeItem('kb_token');
  localStorage.removeItem('kb_user');
  location.href='login.html';
}
const requireAuth = () => {
  if(!getUser()||!getToken()){
    location.href='login.html?next='+encodeURIComponent(location.pathname.split('/').pop());
    return false;
  }
  return true;
};

/* Authenticated fetch — auto-attaches JWT, kicks to login on 401 */
async function authFetch(path, opts={}){
  const token=getToken();
  const res=await fetch(API_BASE+path,{
    ...opts,
    headers:{ 'Content-Type':'application/json', ...(opts.headers||{}), ...(token?{Authorization:'Bearer '+token}:{}) },
  });
  if(res.status===401 && token){
    localStorage.removeItem('kb_token'); localStorage.removeItem('kb_user');
    toast('warning','Session expired','Please sign in again.');
  }
  return res;
}

/* ── Wishlist (localStorage + best-effort server sync when logged in) ── */
const getWL = () => { try{ return JSON.parse(localStorage.getItem('kb_wishlist')||'[]'); }catch{ return []; } };
const saveWL = w => localStorage.setItem('kb_wishlist', JSON.stringify(w));
const inWL = id => getWL().some(x=>x.id===id);

function toggleWL(id,item){
  let w=getWL();
  if(w.some(x=>x.id===id)){
    saveWL(w.filter(x=>x.id!==id));
    if(getToken()) authFetch('/favorites/'+encodeURIComponent(id),{method:'DELETE'}).catch(()=>{});
    return false;
  }
  w.unshift({ id, ...item, added:Date.now() });
  saveWL(w.slice(0,100));
  if(getToken()) authFetch('/favorites',{method:'POST',body:JSON.stringify({product_id:id,...item})}).catch(()=>{});
  return true;
}
function removeWL(id){
  saveWL(getWL().filter(x=>x.id!==id));
  if(getToken()) authFetch('/favorites/'+encodeURIComponent(id),{method:'DELETE'}).catch(()=>{});
}

/* Pull server favorites into local on login (call once per page if signed in) */
async function syncWL(){
  if(!getToken()) return;
  try{
    const r=await authFetch('/favorites');
    if(!r.ok) return;
    const { favorites=[] } = await r.json();
    const local=getWL(), ids=new Set(local.map(x=>x.id));
    favorites.forEach(f=>{
      if(!ids.has(f.product_id)) local.push({
        id:f.product_id, title:f.title, image:f.image, price:f.price,
        store:f.store, url:f.url, query:f.query,
        added:new Date(f.created_at).getTime(),
      });
    });
    saveWL(local.slice(0,100));
  }catch{}
}

/* ── History (localStorage + server sync) ── */
const getHist = () => { try{ return JSON.parse(localStorage.getItem('kb_hist')||'[]'); }catch{ return []; } };
function addHist(entry){
  let h=getHist().filter(x=>x.q.toLowerCase()!==entry.q.toLowerCase());
  h.unshift({ ...entry, ts:Date.now() });
  localStorage.setItem('kb_hist', JSON.stringify(h.slice(0,50)));
}
function updateHist(q,patch){
  const h=getHist();
  const i=h.findIndex(x=>x.q.toLowerCase()===q.toLowerCase());
  if(i>-1){ h[i]={...h[i],...patch}; localStorage.setItem('kb_hist',JSON.stringify(h)); }
  if(getToken()) authFetch('/history',{method:'POST',body:JSON.stringify({query:q,products:patch.products||0,low:patch.low||0})}).catch(()=>{});
}
function removeHist(q){
  localStorage.setItem('kb_hist', JSON.stringify(getHist().filter(x=>x.q!==q)));
}
function clearHist(){ localStorage.removeItem('kb_hist'); }

/* ── Shared sidebar ── */
const NAV_ICONS = {
  home:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  chat:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-8 8H4l1.5-3.2A8 8 0 1 1 21 12z"/></svg>',
  wishlist:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.7-9.5-9A5.5 5.5 0 0 1 12 6.5 5.5 5.5 0 0 1 21.5 12c-2 4.3-9.5 9-9.5 9z"/></svg>',
  history:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  sun:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>',
};

function mountSidebar(active){
  const sb=$('#sidebar');
  if(!sb) return;
  const user=getUser();
  const wlCount=getWL().length;
  const theme=getTheme();
  sb.innerHTML=`
    <div class="sb-head">
      <a href="index.html" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
        <div class="logo-mark">K</div>
        <div>
          <div class="logo-name">Krazy<span class="grad-text">Buy</span></div>
          <div class="logo-sub">AI Price Intelligence</div>
        </div>
      </a>
      <button class="theme-btn" id="themeBtn" aria-label="Toggle theme" title="Toggle light/dark">
        ${theme==='light'?NAV_ICONS.moon:NAV_ICONS.sun}
      </button>
    </div>
    <nav class="sb-nav">
      <a class="nav-item ${active==='home'?'active':''}" href="index.html">${NAV_ICONS.home} Home</a>
      <a class="nav-item ${active==='chat'?'active':''}" href="chat.html">${NAV_ICONS.chat} Retzo Chat</a>
      <a class="nav-item ${active==='wishlist'?'active':''}" href="wishlist.html">${NAV_ICONS.wishlist} Wishlist ${wlCount?`<span class="nav-badge">${wlCount}</span>`:''}</a>
      <a class="nav-item ${active==='history'?'active':''}" href="history.html">${NAV_ICONS.history} History</a>
    </nav>
    <div id="sbExtra" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;min-height:0"></div>
    <div class="sb-user">
      ${user?`
        ${user.picture
          ?`<img class="sb-avatar" src="${esc(user.picture)}" alt="" referrerpolicy="no-referrer" style="object-fit:cover">`
          :`<div class="sb-avatar">${esc((user.name||'U')[0].toUpperCase())}</div>`}
        <div style="flex:1;min-width:0">
          <div class="sb-uname">${esc(user.name)}</div>
          <div class="sb-uemail">${esc(user.email)}</div>
        </div>
        <button class="sb-logout" id="sbLogout" aria-label="Log out" title="Log out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
        </button>`
      :`<a class="sb-login-link" href="login.html">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
          Sign in with Google
        </a>`}
    </div>`;
  const lo=$('#sbLogout',sb);
  if(lo) lo.onclick=logout;

  $('#themeBtn',sb).onclick=()=>{
    const next=getTheme()==='light'?'dark':'light';
    applyTheme(next);
    mountSidebar(active); // refresh icon
  };

  const burger=$('#burger'), ov=$('#overlay');
  if(burger) burger.onclick=()=>{ sb.classList.add('open'); ov?.classList.add('active'); };
  if(ov) ov.onclick=()=>{ sb.classList.remove('open'); ov.classList.remove('active'); };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ sb.classList.remove('open'); ov?.classList.remove('active'); } });

  // pull server favorites once per page load when signed in
  if(user && getToken() && !window.__kbSynced){ window.__kbSynced=true; syncWL().then(()=>{}); }
}

function closeSidebar(){ $('#sidebar')?.classList.remove('open'); $('#overlay')?.classList.remove('active'); }

return { API_BASE, $, $$, esc, cssEsc, fmtPrice, timeAgo, toast,
  getUser, setUser, getToken, logout, requireAuth, authFetch,
  getWL, inWL, toggleWL, removeWL, syncWL,
  getHist, addHist, updateHist, removeHist, clearHist,
  getTheme, applyTheme,
  mountSidebar, closeSidebar };
})();
