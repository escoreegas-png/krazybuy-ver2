/* ============================================================
   KRAZYBUY — RENDERERS v2 (requires common.js)
   KBR.productCard / KBR.attachCardEvents / KBR.retzoCard /
   KBR.searchStages / KBR.skeletons / KBR.bindSuggest
============================================================ */
window.KBR = (() => {
'use strict';
const { $, $$, esc, fmtPrice, inWL, toggleWL, toast, getHist, debounce, lazyImages } = KB;

const STORES = ['Amazon','Flipkart','Croma','Reliance Digital','Vijay Sales','Tata Cliq','Myntra','AJIO','Nykaa','Blinkit','Zepto'];
const TRENDING = ['iPhone 16','Sony WH-1000XM5','MacBook Air M4','Samsung S25 Ultra','Dyson V12','PS5 Slim'];

const HEART = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7.5-4.7-9.5-9A5.5 5.5 0 0 1 12 6.5 5.5 5.5 0 0 1 21.5 12c-2 4.3-9.5 9-9.5 9z"/></svg>';
const CHEV  = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';

const stars = r => {
  r = Number(r)||0;
  if(!r) return '';
  return `<span class="prating" role="img" aria-label="Rated ${r} out of 5">${'★'.repeat(Math.round(r))}${'☆'.repeat(5-Math.round(r))} <span style="color:var(--muted)">${r.toFixed(1)}</span></span>`;
};
const storeChip = s => s ? `<span class="pstore"><span class="pstore-ic">${esc(s[0].toUpperCase())}</span>${esc(s)}</span>` : '';

/* ── Product card ── */
function productCard(p, i=0, best=false){
  const id  = p.id || p.url || p.title;
  const off = (p.was && p.price && p.was > p.price) ? Math.round((1 - p.price/p.was)*100) : 0;
  return `
  <article class="pcard ${best?'best':''}" data-id="${esc(id)}" style="animation-delay:${Math.min(i,8)*40}ms">
    ${best?'<span class="best-tag">✦ Best Deal</span>':''}
    <button class="wish ${inWL(id)?'on':''}" data-wl='${esc(JSON.stringify({title:p.title,image:p.image,price:p.price,store:p.store,url:p.url}))}' aria-label="Save to wishlist" aria-pressed="${inWL(id)}">${HEART}</button>
    <div class="prow">
      <div class="pimg"><img ${p.image?`data-src="${esc(p.image)}"`:''} alt="" onerror="this.style.display='none'"></div>
      <div class="pbody">
        <span class="pcat">${storeChip(p.store) || esc(p.category||'')}</span>
        <h3 class="pname">${esc(p.title)}</h3>
        <div class="pmeta">
          ${stars(p.rating)}
          <span class="pavail ${p.inStock===false?'out':'in'}">${p.inStock===false?'Out of stock':'In stock'}</span>
          ${p.delivery?`<span class="pbadge">${esc(p.delivery)}</span>`:''}
          ${p.cashback?`<span class="pbadge green">${esc(p.cashback)} cashback</span>`:''}
          ${p.coupon?`<span class="pbadge green">Coupon: ${esc(p.coupon)}</span>`:''}
        </div>
      </div>
      <div class="pprice">
        <div class="pprice-v">${fmtPrice(p.price)}</div>
        ${off?`<div><span class="pprice-was">${fmtPrice(p.was)}</span> <span class="pprice-off">${off}% off</span></div>`:''}
      </div>
      <a class="buy-btn" href="${esc(p.url||'#')}" target="_blank" rel="noopener">Buy Now</a>
    </div>
    ${Array.isArray(p.offers)&&p.offers.length?offersBlock(p.offers):''}
  </article>`;
}

function offersBlock(offers){
  const min = Math.min(...offers.map(o=>Number(o.price)||Infinity));
  return `
  <div class="ptoggle" role="button" tabindex="0" aria-expanded="false">
    <span class="ptoggle-l">Compare ${offers.length} store prices</span>${CHEV}
  </div>
  <div class="offers"><div class="offers-in">
    ${offers.map((o,i)=>`
      <div class="orow ${Number(o.price)===min?'cheapest':''}" style="animation-delay:${i*35}ms">
        <div class="ologo">${o.logo?`<img data-src="${esc(o.logo)}" alt="">`:esc((o.store||'?')[0].toUpperCase())}</div>
        <div style="flex:1;min-width:0">
          <div class="ostore">${esc(o.store)}</div>
          <div class="otags">
            ${Number(o.price)===min?'<span class="otag free">Lowest price</span>':''}
            ${o.freeShip?'<span class="otag free">Free delivery</span>':''}
            ${o.inStock===false?'<span class="otag out">Out of stock</span>':''}
            ${o.coupon?`<span class="otag">${esc(o.coupon)}</span>`:''}
          </div>
        </div>
        <div><div class="oprice">${fmtPrice(o.price)}</div>
        ${Number(o.price)===min&&offers.length>1?`<div class="osave">Save ${fmtPrice(Math.max(...offers.map(x=>Number(x.price)||0))-min)}</div>`:''}</div>
        <a class="obuy" href="${esc(o.url||'#')}" target="_blank" rel="noopener">Go</a>
      </div>`).join('')}
  </div></div>`;
}

/* Delegated events: wishlist hearts + offer toggles + expanders */
function attachCardEvents(root){
  root.addEventListener('click', e=>{
    const w = e.target.closest('.wish');
    if(w){
      const card = w.closest('.pcard');
      let item={}; try{ item=JSON.parse(w.dataset.wl||'{}'); }catch{}
      const on = toggleWL(card.dataset.id, item);
      w.classList.toggle('on', on);
      w.setAttribute('aria-pressed', on);
      toast(on?'success':'info', on?'Saved to wishlist':'Removed from wishlist', on?esc(item.title||''):'');
      return;
    }
    const t = e.target.closest('.ptoggle');
    if(t){
      const open = t.classList.toggle('open');
      t.setAttribute('aria-expanded', open);
      const of = t.nextElementSibling;
      of.style.maxHeight = open ? of.scrollHeight+'px' : '0';
      return;
    }
    const eh = e.target.closest('.exp-h');
    if(eh) eh.closest('.exp').classList.toggle('open');
  });
  root.addEventListener('keydown', e=>{
    if(e.key==='Enter' && e.target.classList?.contains('ptoggle')) e.target.click();
  });
  lazyImages(root);
}

/* ── Retzo AI card ── */
const C = 2*Math.PI*34;
const gauge = (label,val)=>`
  <div class="gauge-card">
    <div class="gauge-svg">
      <svg width="80" height="80" aria-hidden="true">
        <circle class="gauge-bg" cx="40" cy="40" r="34"/>
        <circle class="gauge-fill" cx="40" cy="40" r="34" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-val="${val}"/>
      </svg>
      <span class="gauge-num">${val}</span>
    </div>
    <div class="gauge-label">${label}</div>
  </div>`;

function retzoCard(d){
  const dir = d.prediction?.direction || 'flat'; // 'up' | 'down' | 'flat'
  const arrows = {
    up:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 17 17 7M9 7h8v8"/></svg>',
    down:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 7l10 10M17 9v8H9"/></svg>',
    flat:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M4 12h16"/></svg>'
  };
  const predText = { up:'Price likely to rise', down:'Price likely to drop', flat:'Price stable' };
  return `
  <section class="retzo" aria-label="Retzo AI analysis">
    <div class="rz-head">
      <div class="rz-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z"/></svg></div>
      <div>
        <span class="rz-badge">Retzo AI <span class="rz-chip">Analysis</span></span>
        <div class="rz-powered">AI-powered price intelligence</div>
      </div>
      ${d.verdict?`<span class="rz-rating">${esc(d.verdict)}</span>`:''}
    </div>

    <p class="rz-summary" id="rzSummary"></p>

    ${d.recommendation?`
    <div class="rz-rec"><span class="rz-rec-tag">Recommendation</span>${esc(d.recommendation)}</div>`:''}

    ${d.bestStore?`
    <div class="rz-buy">
      <span class="rz-buy-dot"></span>
      <div><div class="rz-buy-store">${esc(d.bestStore.name)}</div><div class="rz-buy-sub">Best price right now</div></div>
      <div class="rz-buy-price">${fmtPrice(d.bestStore.price)}</div>
      <a class="rz-buy-btn" href="${esc(d.bestStore.url||'#')}" target="_blank" rel="noopener">Buy at best price</a>
    </div>`:''}

    <div class="gauges">
      ${gauge('AI Score', d.aiScore??0)}
      ${gauge('Trust', d.trustScore??0)}
      ${gauge('Value', d.valueScore??0)}
    </div>

    <div class="conf-row">
      <span class="conf-label">Confidence</span>
      <div class="conf-meter"><div class="conf-fill" data-val="${d.confidence??0}"></div></div>
      <span class="conf-val">${d.confidence??0}%</span>
    </div>

    <div class="pred-card">
      <div class="pred-arrow ${dir}">${arrows[dir]}</div>
      <div style="flex:1;min-width:0">
        <span class="pred-badge ${dir}">${predText[dir]}</span>
        <span class="pred-conf"> · ${d.prediction?.confidence??'—'}% confidence</span>
        ${d.prediction?.note?`<div class="pred-note">${esc(d.prediction.note)}</div>`:''}
      </div>
    </div>

    ${(d.pros?.length||d.cons?.length)?`
    <div class="pc-grid">
      <div class="pc-col pros"><h4>Pros</h4>${(d.pros||[]).map((p,i)=>`<div class="pc-item pro" style="animation-delay:${i*50}ms"><svg class="pc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M20 6 9 17l-5-5"/></svg>${esc(p)}</div>`).join('')}</div>
      <div class="pc-col cons"><h4>Cons</h4>${(d.cons||[]).map((c,i)=>`<div class="pc-item con" style="animation-delay:${i*50}ms"><svg class="pc-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>${esc(c)}</div>`).join('')}</div>
    </div>`:''}

    ${d.reasoning?`
    <div class="exp" style="margin-top:14px">
      <button class="exp-h">Why Retzo recommends this ${CHEV}</button>
      <div class="exp-b"><p>${esc(d.reasoning)}</p></div>
    </div>`:''}
  </section>`;
}

/* Call after inserting retzoCard() HTML — animates gauges, meter, typing */
function activateRetzo(root, summaryText=''){
  requestAnimationFrame(()=>{
    $$('.gauge-fill',root).forEach(g=>{ g.style.strokeDashoffset = (C*(1-Math.min(100,Number(g.dataset.val)||0)/100)).toFixed(1); });
    $$('.conf-fill',root).forEach(f=>{ f.style.width = Math.min(100,Number(f.dataset.val)||0)+'%'; });
  });
  const el = $('#rzSummary',root);
  if(!el) return;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches){ el.textContent=summaryText; return; }
  el.classList.add('type-cursor');
  let i=0;
  (function tick(){
    el.textContent = summaryText.slice(0, i+=3);
    if(i<summaryText.length) setTimeout(tick, 14);
    else el.classList.remove('type-cursor');
  })();
}

/* ── Animated multi-store search stages ── */
function searchStages(el){
  el.innerHTML = `
    <div class="loading-wrap">
      <div class="phrase">Retzo is scanning ${STORES.length} stores <span class="dots"><span></span><span></span><span></span></span></div>
      <div class="progress-track"><div class="progress-fill"></div></div>
      <div class="stage-list">${STORES.map(s=>`<div class="stage"><span class="st-dot"></span>Searching ${esc(s)}…</div>`).join('')}</div>
      ${skeletons.products(3)}
    </div>`;
  const stages = $$('.stage',el), fill = $('.progress-fill',el);
  let i=0, dead=false;
  const step=()=>{
    if(dead||i>=stages.length) return;
    stages.forEach((s,j)=>{ s.classList.toggle('done',j<i); s.classList.toggle('active',j===i); });
    fill.style.width = Math.round(((i+1)/stages.length)*92)+'%';
    i++; timer=setTimeout(step, 420 + Math.random()*380);
  };
  let timer=setTimeout(step,60);
  return {
    finish(){ dead=true; clearTimeout(timer); stages.forEach(s=>{s.classList.remove('active');s.classList.add('done');}); fill.style.width='100%'; },
    cancel(){ dead=true; clearTimeout(timer); }
  };
}

/* ── Skeletons ── */
const skeletons = {
  products: (n=3)=>`<div class="plist" aria-hidden="true">${Array.from({length:n},()=>`
    <div class="skel-card">
      <div class="skel skel-img" style="width:66px;height:66px"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:8px">
        <div class="skel skel-line" style="width:30%"></div>
        <div class="skel skel-line" style="width:82%;height:15px"></div>
        <div class="skel skel-line" style="width:55%"></div>
      </div>
      <div class="skel skel-pill" style="width:96px"></div>
    </div>`).join('')}</div>`,
  retzo: ()=>`<div class="retzo" aria-hidden="true"><div class="rz-skel">
    <div class="rz-skel-row"><div class="skel" style="width:34px;height:34px;border-radius:10px"></div><div class="skel skel-line" style="width:40%"></div></div>
    <div class="skel skel-line" style="width:95%"></div>
    <div class="skel skel-line" style="width:70%"></div>
    <div class="rz-skel-gauges">${'<div class="skel rz-skel-circle" style="margin:0 auto"></div>'.repeat(3)}</div>
    <div class="skel skel-pill" style="width:60%"></div>
  </div></div>`
};

/* ── Search suggestions (recent + trending) ── */
function bindSuggest(input, box, onPick){
  const render = q=>{
    q=(q||'').trim().toLowerCase();
    const recent = getHist().filter(h=>!q||h.q.toLowerCase().includes(q)).slice(0,5);
    const trend  = TRENDING.filter(t=>!q||t.toLowerCase().includes(q)).slice(0,4);
    if(!recent.length && !trend.length){ box.classList.remove('show'); return; }
    box.innerHTML =
      (recent.length?`<div class="sg-label">Recent</div>${recent.map(h=>`<button class="sg-item" data-q="${esc(h.q)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>${esc(h.q)}</button>`).join('')}`:'') +
      (trend.length?`<div class="sg-label">Trending</div>${trend.map(t=>`<button class="sg-item" data-q="${esc(t)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>${esc(t)}</button>`).join('')}`:'');
    box.classList.add('show');
  };
  input.addEventListener('input', debounce(()=>render(input.value),180));
  input.addEventListener('focus', ()=>render(input.value));
  document.addEventListener('click', e=>{
    const it=e.target.closest('.sg-item');
    if(it && box.contains(it)){ input.value=it.dataset.q; box.classList.remove('show'); onPick?.(it.dataset.q); }
    else if(!box.contains(e.target) && e.target!==input) box.classList.remove('show');
  });
  input.addEventListener('keydown', e=>{ if(e.key==='Escape') box.classList.remove('show'); });
}

return { productCard, offersBlock, attachCardEvents, retzoCard, activateRetzo, searchStages, skeletons, bindSuggest, STORES };
})();
