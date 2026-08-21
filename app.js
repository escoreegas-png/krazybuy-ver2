/*
 * WOBZ Production Workspace — V1.2 Frontend
 *
 * This client is intentionally built around real backend routes.
 * PDF, image and ZIP workflows are runnable against the current
 * Render V1.2.1 backend. PPT/DOC/XLS tools are shown as planned
 * until their routes are actually present on the deployed server.
 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const extOf = n => { const i = String(n || '').lastIndexOf('.'); return i < 0 ? '' : String(n).slice(i + 1).toLowerCase(); };
  const fmtSize = n => { let x = Number(n) || 0, u = 'B'; if (x >= 1024) { x /= 1024; u = 'KB'; } if (x >= 1024) { x /= 1024; u = 'MB'; } if (x >= 1024) { x /= 1024; u = 'GB'; } return `${x.toFixed(u === 'B' ? 0 : 1)} ${u}`; };
  const apiBase = String(window.WOBZ_CONFIG?.apiBase || '/api').replace(/\/$/, '');
  const api = p => `${apiBase}${p}`;
  const MAX_MB = 200;
  const IMAGE_EXT = ['jpg','jpeg','png','webp','bmp','gif','tiff','avif'];

  const ICONS = {
    home:'M3 10.5 12 3l9 7.5M5 9.8V20h14V9.8',
    pdf:'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',
    edit:'M4 20h4L19 9l-4-4L4 16zM14.5 5.5 18.5 9.5',
    image:'M3 5h18v14H3zM3 15l5-4 4 3 3-3 6 5',
    merge:'M4 7h6v10H4M14 7h6v10h-6M10 12h4',
    split:'M4 6h7M4 18h7M11 6v12M13 12h7M20 12l-3-3M20 12l-3 3',
    compress:'M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4',
    lock:'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',
    upload:'M12 17V4m0 0-4 4m4-4 4 4M4 20h16',
    download:'M12 4v13m0 0-4-4m4 4 4-4M4 20h16',
    trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
    refresh:'M4 12a8 8 0 0 1 13.6-5.7M20 12a8 8 0 0 1-13.6 5.7M18 3v4h-4M6 21v-4h4',
    info:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10v6M12 7.2v.4',
    help:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0-16zM9.6 9.5a2.4 2.4 0 1 1 3.6 2.1c-.8.5-1.2 1-1.2 1.9M12 16.6v.4',
    check:'M4 12.5 9 17.5 20 6.5',
    alert:'M12 4 2.5 20h19zM12 10v4M12 17.5v.5',
    menu:'M4 7h16M4 12h16M4 17h16',
    search:'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2',
    star:'M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.9-5 2.9 1-5.6-4-3.9 5.5-.8z',
    folder:'M3 6h6l2 2h10v12H3z',
    zip:'M6 3h12v18H6zM11 3v4M13 7v4M11 11v4M13 15v3',
    wrench:'M14.5 6.5a4 4 0 1 0 3 3L21 13l-3 3-3.5-3.5a4 4 0 0 0 0-6zM5 19l4-4',
    close:'M6 6l12 12M18 6 6 18',
    chev:'M9 5l7 7-7 7'
  };
  const ico = (name, cls='') => `<svg class="${esc(cls)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[name] || ICONS.help}"></path></svg>`;

  const state = {
    tool: 'dashboard',
    files: [],
    health: null,
    recent: JSON.parse(localStorage.getItem('wobz.recent') || '[]'),
    favorite: new Set(JSON.parse(localStorage.getItem('wobz.favorites') || '[]')),
    ui: { sidebarOpen: false, busy: false },
    scratch: {}
  };

  const tools = [
    {id:'dashboard', name:'Dashboard', group:'Home', icon:'home', accept:null, status:'live', desc:'Workspace overview and live backend status.'},
    {id:'pdf-organize', name:'Organize PDF', group:'PDF', icon:'edit', accept:['pdf'], status:'live', desc:'Read page count, delete, rotate and reorder PDF pages.', mode:'pdf-organize'},
    {id:'pdf-edit', name:'Edit PDF', group:'PDF', icon:'edit', accept:['pdf'], status:'live', desc:'Add text, watermark, page numbers, rotation and deletion.', mode:'pdf-edit'},
    {id:'pdf-merge', name:'Merge PDF', group:'PDF', icon:'merge', accept:['pdf'], multiple:true, min:2, status:'live', desc:'Combine multiple PDFs into one.', mode:'pdf-merge'},
    {id:'pdf-split', name:'Split PDF', group:'PDF', icon:'split', accept:['pdf'], status:'live', desc:'Extract selected pages or ranges.', mode:'pdf-split'},
    {id:'pdf-compress', name:'Compress PDF', group:'PDF', icon:'compress', accept:['pdf'], status:'live', desc:'Optimize a PDF with the deployed Ghostscript pipeline.', mode:'pdf-compress'},
    {id:'pdf-protect', name:'Protect PDF', group:'PDF', icon:'lock', accept:['pdf'], status:'live', desc:'Add a PDF open password using qpdf.', mode:'pdf-protect'},
    {id:'pdf-image', name:'PDF → All Images', group:'PDF', icon:'image', accept:['pdf'], status:'live', desc:'Render every PDF page and download one ZIP.', mode:'pdf-image'},
    {id:'images-pdf', name:'Images → PDF', group:'PDF', icon:'pdf', accept:IMAGE_EXT, multiple:true, status:'live', desc:'Create one PDF containing your images.', mode:'images-pdf'},
    {id:'img-edit', name:'Image Editor', group:'Images & Files', icon:'image', accept:IMAGE_EXT, status:'live', desc:'Resize, rotate, flip, crop and add overlays.', mode:'img-edit'},
    {id:'img-convert', name:'Convert Image', group:'Images & Files', icon:'refresh', accept:IMAGE_EXT, status:'live', desc:'Convert images to JPG, PNG or WebP.', mode:'img-convert'},
    {id:'img-compress', name:'Compress Image', group:'Images & Files', icon:'compress', accept:IMAGE_EXT, status:'live', desc:'Re-encode images with quality control.', mode:'img-compress'},
    {id:'zip-create', name:'Files → ZIP', group:'Images & Files', icon:'zip', accept:null, multiple:true, status:'live', desc:'Create ZIP archives while preserving relative paths.', mode:'zip-create'},
    {id:'ppt-edit', name:'Edit PPTX', group:'PowerPoint', icon:'wrench', accept:['pptx'], status:'planned', desc:'Waiting for the PPTX editing route to be deployed.'},
    {id:'ppt-create', name:'Create PPTX', group:'PowerPoint', icon:'plus', accept:null, status:'planned', desc:'Waiting for the PPTX creation route to be deployed.'},
    {id:'ppt-pdf', name:'PPTX → PDF', group:'PowerPoint', icon:'pdf', accept:['pptx','ppt'], status:'planned', desc:'Waiting for the PPT conversion route to be deployed.'},
    {id:'doc-edit', name:'Edit DOCX', group:'Documents', icon:'edit', accept:['docx'], status:'planned', desc:'Waiting for the DOCX route to be deployed.'},
    {id:'doc-create', name:'Create DOCX', group:'Documents', icon:'plus', accept:null, status:'planned', desc:'Waiting for the DOCX route to be deployed.'},
    {id:'doc-pdf', name:'DOCX → PDF', group:'Documents', icon:'pdf', accept:['docx'], status:'planned', desc:'Waiting for the DOCX conversion route to be deployed.'},
    {id:'xlsx-edit', name:'Edit XLSX', group:'Spreadsheets', icon:'edit', accept:['xlsx'], status:'planned', desc:'Waiting for the XLSX route to be deployed.'}
  ];

  const byId = id => tools.find(t => t.id === id) || tools[0];
  const liveTools = () => tools.filter(t => t.status === 'live');

  function saveLocal() {
    localStorage.setItem('wobz.recent', JSON.stringify(state.recent.slice(0,60)));
    localStorage.setItem('wobz.favorites', JSON.stringify([...state.favorite].slice(0,20)));
  }
  function addRecent(files, toolId) {
    const now = Date.now();
    for (const f of files) state.recent.unshift({name:f.name,size:f.size,tool:toolId,when:now});
    const seen = new Set();
    state.recent = state.recent.filter(x => { const k = `${x.name}|${x.size}|${x.tool}`; if(seen.has(k)) return false; seen.add(k); return true; }).slice(0,60);
    saveLocal();
  }

  function toast(msg, kind='ok') {
    const n = $('#toast'); n.dataset.kind = kind; n.innerHTML = `${ico(kind==='error'?'alert':kind==='info'?'info':'check')}<span>${esc(msg)}</span>`; n.classList.add('show');
    clearTimeout(n._t); n._t = setTimeout(() => n.classList.remove('show'), 3500);
  }

  function setBusy(v, text='Processing…') {
    state.ui.busy = v;
    const p = $('#phase');
    if (p) { p.hidden = !v; if (v) p.innerHTML = `<div class="phase-top">${ico('refresh','spin')}<span>${esc(text)}</span></div><div class="phase-bar indeterminate"><i></i></div>`; }
    $$('.run-btn').forEach(b => b.disabled = v);
  }

  function humanError(text, status) {
    const m = String(text || '');
    if (/qpdf/i.test(m)) return 'Password protection needs qpdf installed on the Render server.';
    if (/poppler|pdftoppm/i.test(m)) return 'PDF rendering needs Poppler (pdftoppm) installed on the Render server.';
    if (/ghostscript|compression/i.test(m)) return 'PDF compression needs Ghostscript installed on the Render server.';
    if (/unsupported/i.test(m)) return 'That file type is not supported by this workflow.';
    if (status === 413) return 'The selected file is too large for the configured upload limit.';
    return m.split('\n')[0].slice(0,220) || `Request failed (${status || 'unknown'})`;
  }

  function request(path, {body=null, timeout=180000, progress}={}) {
    return new Promise((resolve,reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', api(path), true);
      xhr.responseType = 'blob'; xhr.timeout = timeout;
      xhr.setRequestHeader('X-Wobz-Client','v1.2-production');
      xhr.upload.onprogress = e => { if(e.lengthComputable) progress?.(Math.min(1,e.loaded/e.total)); };
      xhr.onerror = () => reject(new Error('Wobz cannot reach the Render backend. Check the deployment URL and service status.'));
      xhr.ontimeout = () => reject(new Error('The backend took too long to respond.'));
      xhr.onabort = () => reject(Object.assign(new Error('Cancelled.'),{cancelled:true}));
      xhr.onload = async () => {
        const blob = xhr.response instanceof Blob ? xhr.response : new Blob([xhr.response || '']);
        if(xhr.status < 200 || xhr.status >= 300){
          let msg='Request failed';
          try { const txt=await blob.text(); try { const j=JSON.parse(txt); msg=j.error||j.message||msg; } catch { msg=txt || msg; } } catch {}
          reject(new Error(humanError(msg,xhr.status))); return;
        }
        const cd=xhr.getResponseHeader('content-disposition')||'';
        const m=cd.match(/filename\*?=(?:UTF-8''|\")?([^;\"]+)/i);
        let filename=m?decodeURIComponent(m[1].trim().replace(/^"|"$/g,'')):'';
        resolve({blob,filename});
      };
      xhr.send(body);
      state._xhr=xhr;
    }).finally(()=>{ state._xhr=null; });
  }

  async function getJSON(path) {
    const r=await fetch(api(path),{cache:'no-store'});
    const txt=await r.text(); let j={}; try{j=JSON.parse(txt);}catch{}
    if(!r.ok) throw new Error(humanError(j.error||j.message||txt,r.status));
    return j;
  }

  function download(blob, filename) {
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename||'wobz-output'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),8000);
  }

  function acceptFile(f, tool){
    if(!f || f.size <= 0) return 'File is empty.';
    if(f.size > MAX_MB*1024*1024) return `File exceeds ${MAX_MB} MB.`;
    if(tool.accept && !tool.accept.includes(extOf(f.name))) return `Expected ${tool.accept.map(x=>'.'+x).join(', ')}`;
    return '';
  }

  function setFiles(files) {
    const t=byId(state.tool);
    const incoming=[...files]; const bad=[], good=[];
    for(const f of incoming){ const why=acceptFile(f,t); if(why) bad.push(`${f.name} — ${why}`); else good.push(f); }
    state.files=t.multiple ? [...state.files,...good].slice(0,100) : good.slice(-1);
    if(good.length) addRecent(good,state.tool);
    renderCurrent();
    if(bad.length) toast(bad[0], 'error');
  }

  function filePicker() {
    const t=byId(state.tool); const input=document.createElement('input'); input.type='file'; input.multiple=!!t.multiple; if(t.accept) input.accept=t.accept.map(x=>'.'+x).join(',');
    input.onchange=()=>setFiles(input.files||[]); input.click();
  }

  function formatList(t) { return t.accept ? t.accept.map(x=>'.'+x).join(' · ') : 'Any file type'; }
  function fileRows() {
    if(!state.files.length) return `<div class="empty small-empty">${ico('upload')}<h3>No files selected</h3><p>Add a file to begin the workflow.</p></div>`;
    return `<div class="file-list">${state.files.map((f,i)=>`<div class="file-row"><div class="thumb">${extOf(f.name).toUpperCase().slice(0,4)||'FILE'}</div><div class="file-meta"><b title="${esc(f.name)}">${esc(f.name)}</b><span>${fmtSize(f.size)} · ${esc(f.type||'file')}</span></div><button class="icon-btn icon-btn--bare" data-act="remove-file" data-i="${i}" aria-label="Remove file">${ico('close')}</button></div>`).join('')}</div>`;
  }

  function uploadZone(t){
    return `<div class="dropzone" id="dropzone"><div class="dz-orb">${ico('upload')}</div><div class="dz-title">${t.multiple?'Drop your files here':'Drop your file here'}</div><div class="dz-hint">Drag and drop, or browse from your device.</div><button class="btn btn--primary" data-act="browse">${ico('upload')}Browse files</button><div class="dz-meta">${esc(formatList(t))} · max ${MAX_MB} MB each${t.multiple?' · multiple files':''}</div></div>`;
  }

  function optionsFor(t){
    switch(t.mode){
      case 'pdf-organize': return `<div class="grid-2"><div class="field"><label for="deletePages">Delete pages</label><input id="deletePages" placeholder="2,4,7"></div><div class="field"><label for="reorder">Reorder</label><input id="reorder" placeholder="3,1,2,4"></div><div class="field"><label for="rotate">Rotate</label><select id="rotate"><option value="0">No rotation</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></div></div><div class="note">${ico('info')} The deployed PDF engine applies a single rotation value to all remaining pages.</div>`;
      case 'pdf-edit': return `<div class="grid-2"><div class="field field--full"><label for="text">Text to add</label><input id="text" placeholder="Approved — internal copy"></div><div class="field"><label for="page">Target page</label><input id="page" type="number" min="1" value="1"></div><div class="field"><label for="fontSize">Font size</label><input id="fontSize" type="number" min="6" max="120" value="18"></div><div class="field field--full"><label for="watermark">Watermark</label><input id="watermark" placeholder="Optional"></div><div class="field"><label for="editRotate">Rotate all pages</label><select id="editRotate"><option value="0">No rotation</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></div><label class="check"><input id="pageNumbers" type="checkbox"> Add page numbers</label></div>`;
      case 'pdf-split': return `<div class="field"><label for="ranges">Pages / ranges</label><input id="ranges" placeholder="1-3,5,8-10"><small>Use 1-based page numbers.</small></div>`;
      case 'pdf-compress': return `<div class="field"><label for="level">Optimization</label><select id="level"><option value="medium">Balanced</option><option value="low">Higher quality</option><option value="high">Smaller file</option></select></div>`;
      case 'pdf-protect': return `<div class="field"><label for="password">Open password</label><input id="password" type="password" autocomplete="new-password" placeholder="At least 6 characters"><small>Applied server-side. Wobz does not store the password.</small></div>`;
      case 'pdf-image': return `<div class="field"><label for="format">Output format</label><select id="format"><option value="png">PNG</option><option value="jpg">JPG</option></select><small>The backend packages every rendered page into one ZIP.</small></div>`;
      case 'images-pdf': return `<div class="note">${ico('info')} Each image becomes one PDF page in the listed order.</div>`;
      case 'img-edit': case 'img-convert': case 'img-compress': return `<div class="grid-2"><div class="field"><label for="format">Output format</label><select id="format"><option value="webp">WebP</option><option value="png">PNG</option><option value="jpg">JPG</option></select></div><div class="field"><label for="quality">Quality</label><input id="quality" type="number" min="1" max="100" value="82"></div><div class="field"><label for="width">Width</label><input id="width" type="number" min="1" placeholder="Keep"></div><div class="field"><label for="height">Height</label><input id="height" type="number" min="1" placeholder="Keep"></div><div class="field"><label for="degrees">Rotation</label><input id="degrees" type="number" value="0" step="90"></div><div class="field"><label for="flip">Flip</label><select id="flip"><option value="">None</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></div><div class="field field--full"><label for="text">Text overlay</label><input id="text" placeholder="Optional"></div><div class="field field--full"><label for="watermark">Watermark</label><input id="watermark" placeholder="Optional"></div></div>`;
      case 'zip-create': return `<div class="field"><label for="zipName">Archive name</label><input id="zipName" value="wobz-files.zip"><small>Relative folder paths are preserved when the browser supplies them.</small></div>`;
      default:return '';
    }
  }

  function renderDashboard(){
    const live=liveTools().filter(t=>t.id!=='dashboard');
    const planned=tools.filter(t=>t.status==='planned');
    $('#workspace').innerHTML=`<section class="hero"><div><div class="eyebrow">WOBZ WORKSPACE · PRODUCTION</div><h1>Every file tool.<br><em>One warm workspace.</em></h1><p class="lede">Real uploads, real downloads, live Render processing and a responsive interface. No fake buttons.</p><div class="btn-row" style="margin-top:18px"><button class="btn btn--primary" data-nav="pdf-image">${ico('image')}Open PDF tools</button><button class="btn btn--soft" data-act="refresh-health">${ico('refresh')}Check backend</button></div><div class="trust"><span>✓ Orange Wobz UI</span><span>✓ Render API</span><span>✓ Mobile ready</span></div></div><div class="hero-card"><span class="pill pill-dark">BACKEND</span><strong id="heroTitle">Checking…</strong><p id="heroSub">Connecting to Render.</p><div class="stat-row"><div><b>${live.length}</b><small>live workflows</small></div><div><b>${planned.length}</b><small>planned</small></div><div><b>${state.recent.length}</b><small>recent files</small></div></div></div></section>
    <div class="section-head"><div><div class="eyebrow">LIVE TOOLS</div><h2>Working today</h2></div><span class="pill">${live.length} real workflows</span></div>
    <div class="tool-grid">${live.map(t=>toolCard(t)).join('')}</div>
    <div class="section-head"><div><div class="eyebrow">ROADMAP</div><h2>Coming after backend expansion</h2></div></div>
    <div class="tool-grid">${planned.map(t=>toolCard(t)).join('')}</div>`;
    updateHero();
  }

  function toolCard(t){
    const disabled=t.status!=='live';
    return `<button class="tool-card ${disabled?'is-disabled':''}" ${disabled?'disabled':''} data-nav="${t.id}"><span class="tool-ico">${ico(t.icon)}</span><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p><span class="tool-link">${disabled?'Backend route required':'Open workflow'} ${ico('chev')}</span></button>`;
  }

  function renderWorkflow(t){
    if(t.status!=='live') { renderPlanned(t); return; }
    state.scratch={};
    $('#workspace').innerHTML=`<div class="page-top"><div><div class="eyebrow">${esc(t.group.toUpperCase())}</div><h1 class="page-title">${esc(t.name)}</h1><p class="lede">${esc(t.desc)}</p></div><button class="btn btn--soft" data-nav="dashboard">${ico('home')}Dashboard</button></div><div class="work-layout"><section class="panel">${uploadZone(t)}<div id="files">${fileRows()}</div><div id="options">${optionsFor(t)}</div><div id="phase" class="phase" hidden></div><div class="btn-row sticky-cta"><button class="btn btn--primary run-btn" data-act="run">${ico('download')}${primaryLabel(t)}</button><button class="btn" data-act="clear">${ico('trash')}Clear</button></div></section><aside class="aside"><div class="panel"><span class="pill pill-ok">${ico('check')}Real backend</span><p>Requests go through Vercel to your Render API. Final output is downloaded to the device.</p></div><div class="panel"><h3>Accepted</h3><p>${esc(formatList(t))}</p></div><div class="panel"><h3>Maximum</h3><p>${MAX_MB} MB per file</p></div></aside></div>`;
    paintSelectedFiles();
  }

  function renderPlanned(t){
    $('#workspace').innerHTML=`<div class="page-top"><div><div class="eyebrow">${esc(t.group.toUpperCase())}</div><h1 class="page-title">${esc(t.name)}</h1><p class="lede">${esc(t.desc)}</p></div><button class="btn btn--soft" data-nav="dashboard">${ico('home')}Dashboard</button></div><div class="panel roadmap-panel"><div class="tool-ico">${ico(t.icon)}</div><h2>Backend route not deployed yet</h2><p>This frontend intentionally does not fake this workflow. Your current deployed Render V1.2.1 advertises the capability, but the uploaded server code does not contain a runnable ${esc(t.name)} route.</p><div class="note note--warn">${ico('alert')} Deploy the full PPTX/DOCX/XLSX backend before enabling this button.</div><button class="btn btn--primary" data-nav="dashboard">Back to live tools</button></div>`;
  }

  function primaryLabel(t){ return ({
    'pdf-organize':'Apply changes','pdf-edit':'Save edited PDF','pdf-merge':'Merge PDFs','pdf-split':'Extract pages','pdf-compress':'Compress PDF','pdf-protect':'Protect PDF','pdf-image':'Render all pages','images-pdf':'Create PDF','img-edit':'Process image','img-convert':'Convert image','img-compress':'Compress image','zip-create':'Create ZIP'
  }[t.id] || 'Run'); }

  function paintSelectedFiles(){
    const box=$('#files'); if(box) box.innerHTML=fileRows();
    const dz=$('#dropzone'); if(!dz) return;
    ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('is-drag');}));
    ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('is-drag');}));
    dz.addEventListener('drop',e=>setFiles(e.dataTransfer.files));
  }

  function renderCurrent(){
    const t=byId(state.tool);
    if(t.id==='dashboard') renderDashboard(); else renderWorkflow(t);
  }

  async function runCurrent(){
    const t=byId(state.tool); if(t.status!=='live') return;
    if(t.accept && !state.files.length) return toast(`Add ${formatList(t)} first.`,'error');
    if(state.files.length < (t.min||1)) return toast(`This workflow needs at least ${t.min||1} file${(t.min||1)>1?'s':''}.`,'error');
    setBusy(true,'Uploading…');
    const fd=new FormData();
    try{
      let route='', filename='wobz-output';
      const v=id=>document.getElementById(id)?.value ?? '';
      if(t.id==='pdf-merge'){ state.files.forEach(f=>fd.append('files',f,f.name)); route='/pdf/merge'; filename='wobz-merged.pdf'; }
      else if(t.id==='pdf-split'){ fd.append('file',state.files[0]); fd.append('ranges',v('ranges')); if(!v('ranges').trim()) throw new Error('Enter pages or ranges first.'); route='/pdf/split'; filename='wobz-split.pdf'; }
      else if(t.id==='pdf-edit'||t.id==='pdf-organize'){
        fd.append('file',state.files[0]);
        fd.append('text',v('text')); fd.append('page',v('page')||'1'); fd.append('fontSize',v('fontSize')||'18'); fd.append('watermark',v('watermark')); fd.append('rotate',v(t.id==='pdf-organize'?'rotate':'editRotate')||'0');
        fd.append('pageNumbers',String(!!document.getElementById('pageNumbers')?.checked));
        fd.append('deletePages',v('deletePages')); fd.append('reorder',JSON.stringify(v('reorder').trim()?v('reorder').split(',').map(x=>Number(x.trim())).filter(Number.isFinite):[]));
        route='/pdf/edit'; filename=t.id==='pdf-organize'?'wobz-organized.pdf':'wobz-edited.pdf';
      }
      else if(t.id==='pdf-compress'){ fd.append('file',state.files[0]); fd.append('level',v('level')); route='/pdf/compress'; filename='wobz-compressed.pdf'; }
      else if(t.id==='pdf-protect'){ const pw=v('password'); if(pw.length<6) throw new Error('Use a password of at least 6 characters.'); fd.append('file',state.files[0]); fd.append('password',pw); route='/pdf/protect'; filename='wobz-protected.pdf'; }
      else if(t.id==='pdf-image'){ fd.append('file',state.files[0]); fd.append('format',v('format')); route='/pdf/to-image'; filename='wobz-pdf-images.zip'; }
      else if(t.id==='images-pdf'){ state.files.forEach(f=>fd.append('files',f,f.name)); route='/pdf/images-to-pdf'; filename='wobz-images.pdf'; }
      else if(t.id.startsWith('img-')){
        fd.append('file',state.files[0]);
        for(const id of ['format','quality','width','height','degrees','text','watermark']){ const e=document.getElementById(id); if(e && e.value!=='') fd.append(id,e.value); }
        const flip=v('flip'); if(flip) fd.append('horizontal',flip==='horizontal'?'1':'0');
        route=t.id==='img-convert'?'/image/convert':t.id==='img-compress'?'/image/compress':'/image/edit'; filename=`wobz-image.${v('format')||'webp'}`;
      }
      else if(t.id==='zip-create'){ state.files.forEach(f=>fd.append('files',f,f.name)); fd.append('relativePaths',JSON.stringify(state.files.map(f=>f.webkitRelativePath||f.name))); route='/archive/create'; filename=v('zipName')||'wobz-files.zip'; }
      else throw new Error('This workflow is not deployed on the current backend.');

      const result=await request(route,{body:fd,progress:p=>{const n=$('#phase'); if(n)n.innerHTML=`<div class="phase-top">${ico('refresh','spin')}<span>Uploading… ${Math.round(p*100)}%</span></div><div class="phase-bar"><i style="width:${Math.round(p*100)}%"></i></div>`;}});
      download(result.blob,result.filename||filename);
      const p=$('#phase'); if(p){p.hidden=false;p.dataset.state='ok';p.innerHTML=`<div class="phase-top">${ico('check')}<span>Done — ${esc(result.filename||filename)} downloaded.</span></div>`;}
      toast(`Downloaded ${result.filename||filename}`);
    }catch(err){
      const p=$('#phase'); if(p){p.hidden=false;p.dataset.state='error';p.innerHTML=`<div class="phase-top">${ico('alert')}<span>${esc(err.cancelled?'Cancelled':err.message)}</span></div><div class="phase-actions"><button class="btn btn--sm btn--soft" data-act="run">Try again</button></div>`;}
      if(!err.cancelled) toast(err.message,'error');
    }finally{setBusy(false);}
  }

  async function loadHealth(){
    try{
      const j=await getJSON('/health'); state.health=j; updateHealthUI();
    }catch(e){ state.health={success:false,error:e.message}; updateHealthUI(); }
  }
  function updateHealthUI(){
    const h=state.health; const ok=!!h?.success && h.status==='online';
    $('#serverDot')?.classList.toggle('off',!ok);
    const txt=ok?`Render online · ${esc(h.version||'')}`:'Render backend unavailable';
    const dot=$('#serverDot'); if(dot) dot.innerHTML=`<span class="dot"></span><b>${txt}</b>`;
    const hero=$('#heroTitle'); if(hero) hero.textContent=ok?'Backend connected':'Backend unavailable';
    const sub=$('#heroSub'); if(sub) sub.textContent=ok?`Render · ${h.version||'live'}`:'Check your Render deployment.';
  }
  function updateHero(){ if(state.health) updateHealthUI(); }

  function renderShell(){
    const groups=['PDF','PowerPoint','Documents','Spreadsheets','Images & Files'];
    $('#app').innerHTML=`<div class="shell"><aside class="sidebar" id="sidebar"><div class="brand"><img src="/images/logo.png" alt="Wobz"><div class="brand-copy"><strong>Wobz</strong><span>Document Workspace</span></div></div><nav class="nav-scroll"><div class="nav-label">HOME</div><button class="nav-item" data-nav="dashboard">${ico('home')}<span>Dashboard</span></button>${groups.map(g=>`<div class="nav-label">${g.toUpperCase()}</div>${tools.filter(t=>t.group===g).map(t=>`<button class="nav-item ${t.status!=='live'?'planned':''}" ${t.status==='planned'?'disabled':''} data-nav="${t.id}">${ico(t.icon)}<span>${esc(t.name)}</span></button>`).join('')}`).join('')}</nav><div class="side-foot"><div class="dot-row" id="serverDot"><span class="dot"></span><b>Checking Render…</b></div><small>Frontend on Vercel · processing backend on Render</small></div></aside><div class="main"><header class="topbar"><button class="icon-btn mobile-only" data-act="menu" aria-label="Open menu">${ico('menu')}</button><div class="mobile-brand"><img src="/images/logo.png" alt=""><strong>Wobz</strong></div><div class="top-spacer"></div><button class="icon-btn" data-act="refresh-health" aria-label="Refresh backend status">${ico('refresh')}</button><button class="icon-btn" data-act="search" aria-label="Search tools">${ico('search')}</button><div class="avatar">W</div></header><main class="content" id="workspace" tabindex="-1"></main></div><nav class="mobile-nav"><button data-nav="dashboard">${ico('home')}<span>Home</span></button><button data-nav="pdf-image">${ico('image')}<span>PDF</span></button><button data-nav="pdf-edit">${ico('edit')}<span>Edit</span></button><button data-nav="img-edit">${ico('image')}<span>Image</span></button><button data-act="menu">${ico('menu')}<span>More</span></button></nav></div>`;
  }

  document.addEventListener('click', e=>{
    const nav=e.target.closest('[data-nav]'); const act=e.target.closest('[data-act]');
    if(nav && !nav.disabled){ state.tool=nav.dataset.nav; state.files=[]; location.hash=state.tool; renderCurrent(); return; }
    if(!act) return;
    switch(act.dataset.act){
      case 'browse': filePicker(); break;
      case 'run': runCurrent(); break;
      case 'clear': state.files=[]; renderCurrent(); break;
      case 'remove-file': state.files.splice(Number(act.dataset.i),1); renderCurrent(); break;
      case 'refresh-health': loadHealth(); toast('Refreshing backend status','info'); break;
      case 'menu': $('#sidebar')?.classList.toggle('open'); break;
      case 'search': document.querySelector('.nav-item')?.scrollIntoView({block:'nearest'}); toast('Use the sidebar to choose a workflow.','info'); break;
    }
  });

  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='enter'){e.preventDefault();$('.run-btn')?.click();}
    if(e.key==='Escape') $('#sidebar')?.classList.remove('open');
  });

  window.addEventListener('hashchange',()=>{ const id=location.hash.slice(1); if(id && byId(id).id===id){state.tool=id;state.files=[];renderCurrent();} });
  window.addEventListener('dragover',e=>e.preventDefault());
  window.addEventListener('drop',e=>e.preventDefault());

  renderShell();
  state.tool=byId(location.hash.slice(1)||'dashboard').id;
  renderCurrent();
  loadHealth();
})();
