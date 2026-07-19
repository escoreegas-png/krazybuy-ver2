/* ============================================================
   KRAZYBUY — SHARED UTILITIES v3
   auth · wishlist · history · toast · nav · theme · network
   + smart Amazon URL normalization (AI-first pipeline)
============================================================ */
window.KB = (() => {
'use strict';

const API_BASE = window.__KB_API__ || atob('aHR0cHM6Ly9nYXRld2F5LnZpc2NvY29tcGFyZS5vbmxpbmU=');

/* ── Theme ── */
const getTheme = () => localStorage.getItem('kb_theme') || 'light';
function applyTheme(t){
  document.documentElement.dataset.theme = t;
  localStorage.setItem('kb_theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = t === 'dark' ? '#131211' : '#FAF7F2';
}
applyTheme(getTheme());

/* ── Helpers ── */
const $  = (s,c=document)=>c.querySelector(s);
const $$ = (s,c=document)=>[...c.querySelectorAll(s)];
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cssEsc = s => (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/["\\]/g,'\\$&');
const fmtPrice = n => { const x=Number(n); return (!x||isNaN(x)||x<=0) ? '—' : '₹'+x.toLocaleString('en-IN',{maximumFractionDigits:0}); };
const debounce = (fn,ms=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

/* ── Smart Amazon URL normalization ──
   Extracts the ASIN from ANY Amazon URL format and returns a
   clean canonical DP URL. Strips ref / tag / qid / dib / sr /
   keywords / affiliate / tracking — everything.
   Supported paths: /dp/ · /gp/product/ · /gp/aw/d/ · /product/
   Non-Amazon input is returned unchanged. */
function normalizeAmazonUrl(input){
  if (!input) return input;

  input = String(input).trim();

  let url;
  try{
    url = new URL(input);
  }catch{
    return input;
  }

  const host = url.hostname
    .toLowerCase()
    .replace(/^www\./,'')
    .replace(/^m\./,'');

  if(!/^amazon\.[a-z.]+$/.test(host))
    return input;

  const m = url.pathname.match(
    /(?:\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\/)([A-Z0-9]{10})/i
  );

  if(!m)
    return input;

  const asin = m[1].toUpperCase();

  return `https://www.${host}/dp/${asin}`;
}

function timeAgo(ts){
  const s=Math.floor((Date.now()-(typeof ts==='string'?new Date(ts).getTime():ts))/1000);
  if(s<60) return 'just now';
  if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago';
  if(s<604800) return Math.floor(s/86400)+'d ago';
  return new Date(ts).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
}

/* Remove element with micro-animation, then run callback */
function animateOut(el, cb){
  if (matchMedia('(prefers-reduced-motion:reduce)').matches){ cb(); return; }
  el.classList.add('removing');
  setTimeout(cb, 270);
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
  const kill=()=>{ if(t._d)return; t._d=1; clearTimeout(t._t); t.classList.add('out'); setTimeout(()=>t.remove(),250); };
  t.querySelector('.toast-close').onclick=kill;
  area.appendChild(t); t._t=setTimeout(kill,dur);
}

/* ── Auth ── */
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

/* ── Wishlist (with price-drop tracking) ── */
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
  /* ★ CHANGED: always store the clean canonical URL, never a tracking URL */
  if(item && item.url) item = { ...item, url: normalizeAmazonUrl(item.url) };
  if(item && item.query) item = { ...item, query: normalizeAmazonUrl(item.query) };
  w.unshift({ id, ...item, added:Date.now() });
  saveWL(w.slice(0,100));
  if(getToken()) authFetch('/favorites',{method:'POST',body:JSON.stringify({product_id:id,...item})}).catch(()=>{});
  return true;
}
function removeWL(id){
  saveWL(getWL().filter(x=>x.id!==id));
  if(getToken()) authFetch('/favorites/'+encodeURIComponent(id),{method:'DELETE'}).catch(()=>{});
}
/* Call this whenever Retzo AI returns a fresh verified price for a saved product */
function updateWLPrice(id, newPrice){
  const w=getWL(); const i=w.findIndex(x=>x.id===id);
  if(i<0 || !Number(newPrice)) return;
  if(Number(newPrice)!==Number(w[i].price)){ w[i].prevPrice=w[i].price; w[i].price=Number(newPrice); w[i].priceTs=Date.now(); saveWL(w); }
}
const priceDrop = item => (item.prevPrice && item.prevPrice > item.price) ? item.prevPrice - item.price : 0;

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
        store:f.store,
        url:normalizeAmazonUrl(f.url),          /* ★ CHANGED: clean server data too */
        query:normalizeAmazonUrl(f.query),      /* ★ CHANGED */
        added:new Date(f.created_at).getTime(),
      });
    });
    saveWL(local.slice(0,100));
  }catch{}
}

/* ── History (always stores the NORMALIZED clean URL) ── */
const getHist = () => { try{ return JSON.parse(localStorage.getItem('kb_hist')||'[]'); }catch{ return []; } };
const saveHist = h => localStorage.setItem('kb_hist', JSON.stringify(h));

function addHist(entry){
  entry = { ...entry, q: normalizeAmazonUrl(entry.q) };   // never save 1000-char tracking URLs
  let h=getHist();
  const prev=h.find(x=>x.q.toLowerCase()===entry.q.toLowerCase());
  h=h.filter(x=>x.q.toLowerCase()!==entry.q.toLowerCase());
  h.unshift({ ...entry, fav:prev?.fav||false, ts:Date.now() });
  saveHist(h.slice(0,50));
}
function updateHist(q,patch){
  q = normalizeAmazonUrl(q);
  const h=getHist();
  const i=h.findIndex(x=>x.q.toLowerCase()===q.toLowerCase());
  if(i>-1){ h[i]={...h[i],...patch}; saveHist(h); }
  if(getToken()) authFetch('/history',{method:'POST',body:JSON.stringify({query:q,products:patch.products||0,low:patch.low||0})}).catch(()=>{});
}
function removeHist(q){ saveHist(getHist().filter(x=>x.q!==q)); }
function clearHist(){ localStorage.removeItem('kb_hist'); }
function toggleHistFav(q){
  const h=getHist(); const i=h.findIndex(x=>x.q===q);
  if(i<0) return false;
  h[i].fav=!h[i].fav; saveHist(h); return h[i].fav;
}
/* Groups: Today · Yesterday · Last Week · Older */
function groupHist(list){
  const now=new Date();
  const dayStart=d=>new Date(now.getFullYear(),now.getMonth(),now.getDate()-d).getTime();
  const g={ Today:[], Yesterday:[], 'Last Week':[], Older:[] };
  (list||getHist()).forEach(h=>{
    if(h.ts>=dayStart(0)) g.Today.push(h);
    else if(h.ts>=dayStart(1)) g.Yesterday.push(h);
    else if(h.ts>=dayStart(7)) g['Last Week'].push(h);
    else g.Older.push(h);
  });
  return g;
}

/* ── Lazy image loading ── */
const _io = 'IntersectionObserver' in window ? new IntersectionObserver(es=>{
  es.forEach(e=>{ if(e.isIntersecting){ const img=e.target; if(img.dataset.src){ img.src=img.dataset.src; delete img.dataset.src; } _io.unobserve(img); } });
},{rootMargin:'240px'}) : null;
function lazyImages(root=document){
  $$('img[data-src]',root).forEach(img=>{ _io ? _io.observe(img) : (img.src=img.dataset.src); });
}

/* ── Network monitor ── */
function initNet(){
  if(!$('#netBanner')){
    const b=document.createElement('div');
    b.id='netBanner'; b.className='net-banner'; b.setAttribute('role','status');
    b.innerHTML='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22M9 9a9 9 0 0 1 11.5 1M5 12.5a13 13 0 0 1 4-2.7M12 20h.01"/></svg> You’re offline — showing saved data';
    document.body.appendChild(b);
  }
  const upd=()=>document.body.classList.toggle('offline', !navigator.onLine);
  addEventListener('online', ()=>{ upd(); toast('success','Back online'); });
  addEventListener('offline',()=>{ upd(); toast('warning','You’re offline','Cached wishlist & history still work.'); });
  upd();
}
document.readyState==='loading' ? document.addEventListener('DOMContentLoaded',initNet) : initNet();

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
        <div class="logo-mark"><img src="[krazybuy.online](https://www.krazybuy.online/images/logo.png)" alt="KrazyBuy" loading="eager" onerror="this.parentNode.textContent='K'"></div>
        <div>
          <div class="logo-name">Krazy<span class="grad-text">Buy</span></div>
          <div class="logo-sub">Price Intelligence</div>
        </div>
      </a>
      <button class="theme-btn" id="themeBtn" aria-label="Toggle theme" title="Toggle light/dark">
        ${theme==='dark'?NAV_ICONS.sun:NAV_ICONS.moon}
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
    applyTheme(getTheme()==='dark'?'light':'dark');
    mountSidebar(active);
  };

  const burger=$('#burger'), ov=$('#overlay');
  if(burger) burger.onclick=()=>{ sb.classList.add('open'); ov?.classList.add('active'); };
  if(ov) ov.onclick=()=>{ sb.classList.remove('open'); ov.classList.remove('active'); };
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ sb.classList.remove('open'); ov?.classList.remove('active'); } });

  if(user && getToken() && !window.__kbSynced){ window.__kbSynced=true; syncWL().then(()=>{}); }
}


function closeSidebar(){ $('#sidebar')?.classList.remove('open'); $('#overlay')?.classList.remove('active'); }

return { API_BASE, $, $$, esc, cssEsc, fmtPrice, timeAgo, debounce, toast, animateOut,
  normalizeAmazonUrl,
  getUser, setUser, getToken, logout, requireAuth, authFetch,
  getWL, inWL, toggleWL, removeWL, syncWL, updateWLPrice, priceDrop,
  getHist, addHist, updateHist, removeHist, clearHist, toggleHistFav, groupHist,
  lazyImages, getTheme, applyTheme,
  mountSidebar, closeSidebar };
})();
