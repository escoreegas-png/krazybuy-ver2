(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ext = n => { const s = String(n || '').toLowerCase(); const i = s.lastIndexOf('.'); return i < 0 ? '' : s.slice(i + 1); };
  const size = n => { let x = Number(n) || 0; const u = ['B','KB','MB','GB']; let i = 0; while (x >= 1024 && i < u.length - 1) { x /= 1024; i++; } return `${x.toFixed(i ? 1 : 0)} ${u[i]}`; };
  const clamp = (n,a=0,b=100) => Math.max(a, Math.min(b, Number(n) || 0));

  const cfg = Object.assign({
    apiBase: '/api',
    renderApiBase: '',
    requestTimeoutMs: 180000,
    healthTimeoutMs: 10000,
    maxFileMB: 200
  }, window.KRAZYBUY_CONFIG || {});

  const icons = {
    home:'M3 10.5 12 3l9 7.5M5 9.8V20h14V9.8', pdf:'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4', ppt:'M4 4h16v11H4zM12 15v5M8 20h8M9 8h4a2 2 0 1 1 0 4H9zm0 0v4', doc:'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 12h6M9 16h6', xls:'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16', image:'M3 5h18v14H3zM3 15l5-4 4 3 3-3 6 5', zip:'M6 3h12v18H6zM11 3v4M13 7v4M11 11v4M13 15v3', upload:'M12 17V4m0 0-4 4m4-4 4 4M4 20h16', download:'M12 4v13m0 0-4-4m4 4 4-4M4 20h16', menu:'M4 7h16M4 12h16M4 17h16', plus:'M12 5v14M5 12h14', close:'M6 6l12 12M18 6 6 18', check:'M4 12.5 9 17.5 20 6.5', alert:'M12 4 2.5 20h19zM12 10v4M12 17.5v.5', refresh:'M4 12a8 8 0 0 1 13.6-5.7M20 12a8 8 0 0 1-13.6 5.7M18 3v4h-4M6 21v-4h4', lock:'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3', copy:'M9 9h11v11H9zM15 5H4v11h3', split:'M4 6h7M4 18h7M11 6v12M13 12h7M20 12l-3-3M20 12l-3 3', compress:'M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4', grid:'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', swap:'M4 8h13l-3-3M20 16H7l3 3', edit:'M4 20h4L19 9l-4-4L4 16zM14.5 5.5 18.5 9.5', trash:'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6', rotate:'M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4'
  };
  const ico = n => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n] || icons.menu}"></path></svg>`;

  const IMG = ['png','jpg','jpeg','webp','gif','bmp'];
  const GROUPS = ['PDF','PowerPoint','Documents','Spreadsheets','Images & Files'];
  const TOOLS = [
    {id:'pdf-merge',name:'Merge PDF',group:'PDF',icon:'copy',accept:['pdf'],multiple:true,desc:'Combine multiple PDFs into one.',endpoint:'/pdf/merge'},
    {id:'pdf-split',name:'Split PDF',group:'PDF',icon:'split',accept:['pdf'],desc:'Extract pages and ranges.',endpoint:'/pdf/split'},
    {id:'pdf-organize',name:'Organize PDF',group:'PDF',icon:'grid',accept:['pdf'],desc:'Delete, rotate and reorder PDF pages.',endpoint:'/pdf/edit'},
    {id:'pdf-edit',name:'Edit PDF',group:'PDF',icon:'edit',accept:['pdf'],desc:'Add text, watermark, page numbers and rotation.',endpoint:'/pdf/edit'},
    {id:'pdf-compress',name:'Compress PDF',group:'PDF',icon:'compress',accept:['pdf'],desc:'Optimize a PDF with server-side compression.',endpoint:'/pdf/compress'},
    {id:'pdf-protect',name:'Protect PDF',group:'PDF',icon:'lock',accept:['pdf'],desc:'Password protect a PDF when qpdf is available.',endpoint:'/pdf/protect'},
    {id:'pdf-image',name:'PDF → Images',group:'PDF',icon:'image',accept:['pdf'],desc:'Render all PDF pages and download a ZIP.',endpoint:'/pdf/to-image'},
    {id:'images-pdf',name:'Images → PDF',group:'PDF',icon:'pdf',accept:IMG,multiple:true,desc:'Create a PDF with one image per page.',endpoint:'/pdf/images-to-pdf'},
    {id:'ppt-edit',name:'Edit PPTX',group:'PowerPoint',icon:'ppt',accept:['pptx'],desc:'Inspect slide text and save real replacements.',endpoint:'/ppt/edit'},
    {id:'ppt-create',name:'Create PPTX',group:'PowerPoint',icon:'plus',accept:null,desc:'Generate a real PowerPoint presentation.',endpoint:'/ppt/create'},
    {id:'ppt-pdf',name:'PPTX → PDF',group:'PowerPoint',icon:'pdf',accept:['pptx','ppt'],desc:'Convert a deck with LibreOffice.',endpoint:'/ppt/to-pdf'},
    {id:'ppt-images',name:'PPTX → Images',group:'PowerPoint',icon:'image',accept:['pptx','ppt'],desc:'Render slides and download a ZIP.',endpoint:'/ppt/to-images'},
    {id:'images-ppt',name:'Images → PPTX',group:'PowerPoint',icon:'ppt',accept:IMG,multiple:true,desc:'Create one slide per image.',endpoint:'/ppt/images-to-pptx'},
    {id:'pdf-ppt',name:'PDF → PPTX',group:'PowerPoint',icon:'ppt',accept:['pdf'],desc:'Create slide pages from a PDF.',endpoint:'/ppt/pdf-to-pptx'},
    {id:'doc-edit',name:'Edit DOCX',group:'Documents',icon:'doc',accept:['docx'],desc:'Read, replace and export document text.',endpoint:'/documents/edit'},
    {id:'doc-create',name:'Create DOCX',group:'Documents',icon:'doc',accept:null,desc:'Generate a real DOCX document.',endpoint:'/documents/create'},
    {id:'doc-pdf',name:'DOCX → PDF',group:'Documents',icon:'pdf',accept:['docx'],desc:'Convert DOCX using the backend converter.',endpoint:'/documents/to-pdf'},
    {id:'doc-txt',name:'DOCX → TXT',group:'Documents',icon:'doc',accept:['docx'],desc:'Extract readable text from DOCX.',endpoint:'/documents/to-txt'},
    {id:'pdf-docx',name:'PDF → DOCX',group:'Documents',icon:'doc',accept:['pdf'],desc:'Extract PDF text into a DOCX.',endpoint:'/documents/pdf-to-docx'},
    {id:'xlsx-edit',name:'Edit XLSX',group:'Spreadsheets',icon:'xls',accept:['xlsx'],desc:'Inspect and edit workbook cell values.',endpoint:'/xlsx/edit'},
    {id:'csv-xlsx',name:'CSV → XLSX',group:'Spreadsheets',icon:'swap',accept:['csv'],desc:'Convert CSV into a workbook.',endpoint:'/xlsx/csv-to-xlsx'},
    {id:'xlsx-csv',name:'XLSX → CSV',group:'Spreadsheets',icon:'swap',accept:['xlsx'],desc:'Export the first worksheet to CSV.',endpoint:'/xlsx/xlsx-to-csv'},
    {id:'xlsx-pdf',name:'XLSX → PDF',group:'Spreadsheets',icon:'pdf',accept:['xlsx'],desc:'Render a workbook report as PDF.',endpoint:'/xlsx/to-pdf'},
    {id:'img-edit',name:'Image Editor',group:'Images & Files',icon:'image',accept:IMG,desc:'Resize, rotate, flip and watermark.',endpoint:'/image/edit'},
    {id:'img-convert',name:'Convert Image',group:'Images & Files',icon:'swap',accept:IMG,desc:'Convert between JPG, PNG and WebP.',endpoint:'/image/convert'},
    {id:'img-resize',name:'Resize Image',group:'Images & Files',icon:'image',accept:IMG,desc:'Resize an image while preserving quality.',endpoint:'/image/resize'},
    {id:'img-crop',name:'Crop Image',group:'Images & Files',icon:'grid',accept:IMG,desc:'Crop exact image pixels.',endpoint:'/image/crop'},
    {id:'img-rotate',name:'Rotate Image',group:'Images & Files',icon:'rotate',accept:IMG,desc:'Rotate an image by a chosen angle.',endpoint:'/image/rotate'},
    {id:'img-flip',name:'Flip Image',group:'Images & Files',icon:'swap',accept:IMG,desc:'Flip horizontally or vertically.',endpoint:'/image/flip'},
    {id:'img-compress',name:'Compress Image',group:'Images & Files',icon:'compress',accept:IMG,desc:'Compress image output with quality control.',endpoint:'/image/compress'},
    {id:'img-watermark',name:'Watermark Image',group:'Images & Files',icon:'edit',accept:IMG,desc:'Add text watermark to an image.',endpoint:'/image/watermark'},
    {id:'zip-create',name:'Files → ZIP',group:'Images & Files',icon:'zip',accept:null,multiple:true,folder:true,desc:'Create a ZIP while preserving folder paths.',endpoint:'/archive/create'}
  ];
  const byId = id => TOOLS.find(t => t.id === id);

  const state = { tool:'dashboard', files:new Map(), scratch:{}, server:null, busy:false };
  const apiState = { current:String(cfg.apiBase || '/api').replace(/\/$/,''), mode:'unknown', healthy:false, checked:false, probing:false };
  const files = () => state.files.get(state.tool) || [];
  const setFiles = v => state.files.set(state.tool, v);

  function human(err) {
    const msg = String(err?.message || err || 'Operation failed.');
    if (/pdftoppm|poppler/i.test(msg)) return 'PDF image rendering requires Poppler on the backend.';
    if (/qpdf/i.test(msg)) return 'PDF protection requires qpdf on the backend.';
    if (/libreoffice|soffice/i.test(msg)) return 'This conversion requires LibreOffice on the backend.';
    if (/cors/i.test(msg)) return 'The backend rejected this frontend origin. Check Render CORS or use the Vercel /api proxy.';
    if (/failed to fetch|networkerror|network request failed/i.test(msg)) return 'Could not reach the processing backend. Check the Vercel API proxy, Render URL and CORS settings.';
    if (/413|payload too large/i.test(msg)) return `The file is too large for the configured ${cfg.maxFileMB} MB limit.`;
    if (/429/.test(msg)) return 'Too many requests. Please try again in a moment.';
    if (/500|502|503|504/.test(msg)) return 'The backend failed while processing the file. Check the Render server logs.';
    return msg.slice(0, 420);
  }
  function toast(msg, kind='ok') { const n = $('#toast'); if (n) { n.textContent = msg; n.className = `toast show ${kind==='error'?'error':kind==='info'?'info':''}`; clearTimeout(toast.t); toast.t=setTimeout(()=>n.classList.remove('show'),3500); } const sr=$('#sr'); if(sr) sr.textContent=msg; }

  const api = path => `${String(apiState.current || '/api').replace(/\/$/,'')}${path}`;
  function candidates() {
    const list=[];
    const explicit=window.KRAZYBUY_CONFIG?.apiBase;
    if(explicit) list.push(String(explicit).replace(/\/$/,''));
    if(!list.includes('/api')) list.push('/api');
    const render=String(window.KRAZYBUY_CONFIG?.renderApiBase || cfg.renderApiBase || '').replace(/\/$/,'');
    if(render && !list.includes(render)) list.push(render);
    return list;
  }
  async function fetchTimeout(url, opts={}, timeout=cfg.healthTimeoutMs) {
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeout);
    try { return await fetch(url,{...opts,signal:controller.signal}); } finally { clearTimeout(timer); }
  }
  async function resolveApiBase() {
    if(apiState.probing) return {base:apiState.current,data:state.server};
    apiState.probing=true;
    for(const base of candidates()) {
      try {
        const r=await fetchTimeout(`${base}/health`,{method:'GET',cache:'no-store',headers:{Accept:'application/json','X-KrazyBuy-Client':'workspace-production'}});
        if(r.ok) {
          let data={}; try{data=await r.json();}catch{}
          apiState.current=base; apiState.healthy=true; apiState.checked=true;
          apiState.mode=base==='/api'?'vercel-proxy':base.includes('onrender.com')?'render-direct':'custom';
          apiState.probing=false; return {base,data};
        }
      } catch {}
    }
    apiState.healthy=false; apiState.checked=true; apiState.mode='offline'; apiState.probing=false;
    return {base:apiState.current,data:null};
  }

  function renderShell() {
    const app=$('#app'); app.className='';
    app.innerHTML=`
      <div class="site">
        <header class="site-header" id="siteHeader">
          <a class="site-brand" href="#home" data-route="home" aria-label="KrazyBuy home">
            <img src="/images/logo.svg" alt="KrazyBuy" class="site-logo">
            <span><b>KrazyBuy</b><small>Document &amp; File Workspace</small></span>
          </a>
          <nav class="site-nav" aria-label="Primary">
            <a href="#features" data-scroll="features">Features</a>
            <a href="#pdf-tools" data-scroll="pdf-tools">PDF Tools</a>
            <a href="#documents" data-scroll="documents">Documents</a>
            <a href="#images" data-scroll="images">Images</a>
          </nav>
          <div class="site-actions">
            <button class="icon-btn mobile-only" id="landingMenu" aria-label="Open menu">${ico('menu')}</button>
            <button class="btn btn--primary btn--sm" data-route="workspace">Open Workspace</button>
          </div>
        </header>
        <main>
          <section class="landing-hero" id="home">
            <div class="hero-copy">
              <div class="eyebrow">DOCUMENT &amp; FILE WORKSPACE</div>
              <h1>Powerful document and file tools, <em>in one workspace.</em></h1>
              <p>Work with PDFs, presentations, documents, spreadsheets, images and archives through one focused browser workspace connected to the configured processing backend.</p>
              <div class="hero-actions"><button class="btn btn--primary" data-route="workspace">Open KrazyBuy Workspace ${ico('refresh')}</button><a class="btn" href="#pdf-tools" data-scroll="pdf-tools">Explore PDF Tools ${ico('pdf')}</a></div>
              <div class="hero-points"><span>Real backend workflows</span><span>Drag &amp; drop upload</span><span>Local result download</span></div>
            </div>
            <div class="hero-product-preview" aria-hidden="true">
              <div class="preview-window">
                <div class="preview-sidebar"><div class="preview-brand"><img src="/images/logo.svg" alt=""><span>KrazyBuy</span></div><div class="preview-nav-label">WORKSPACE</div><div class="preview-nav active">${ico('pdf')}PDF</div><div class="preview-nav">${ico('ppt')}PowerPoint</div><div class="preview-nav">${ico('doc')}Documents</div><div class="preview-nav">${ico('xls')}Spreadsheets</div><div class="preview-nav">${ico('image')}Images &amp; Files</div></div>
                <div class="preview-main"><div class="preview-top"><span class="preview-badge">Online · API</span><span class="preview-avatar">ME</span></div><div class="preview-title">PDF Workspace</div><div class="preview-upload">${ico('upload')}<strong>Drop your file here</strong><small>Drag &amp; drop or browse from your device</small></div><div class="preview-file"><span class="preview-thumb">PDF</span><span><b>annual-report.pdf</b><small>12.4 MB</small></span><span class="preview-status">Ready</span></div><div class="preview-progress"><div><b>Uploading files…</b><span>██████████████░░░░░░ 72%</span></div><i style="width:72%"></i></div><button class="preview-run">${ico('download')} Run workflow</button></div>
              </div>
            </div>
          </section>

          <section class="landing-section" id="features"><div class="section-heading"><div><div class="eyebrow">WHY KRAZYBUY</div><h2>A workspace built around the file, not the clutter.</h2></div><p>Clear controls, real backend calls and honest status feedback across every workflow.</p></div><div class="feature-grid"><article class="feature-card"><div class="feature-icon">${ico('upload')}</div><h3>Simple file flow</h3><p>Choose a file, configure the workflow and send it to the backend without leaving the workspace.</p></article><article class="feature-card"><div class="feature-icon">${ico('refresh')}</div><h3>Real operation status</h3><p>Upload progress comes from the browser transfer itself. Backend processing is shown separately when exact progress is unavailable.</p></article><article class="feature-card"><div class="feature-icon">${ico('download')}</div><h3>Immediate results</h3><p>Generated files are returned to the browser and downloaded directly to the device.</p></article></div></section>

          <section class="landing-section" id="pdf-tools"><div class="section-heading"><div><div class="eyebrow">PDF</div><h2>Focused PDF workflows</h2></div></div><div class="landing-tool-grid">${TOOLS.filter(t=>t.group==='PDF').map(t=>landingTool(t)).join('')}</div></section>
          <section class="landing-section" id="documents"><div class="section-heading"><div><div class="eyebrow">DOCUMENTS &amp; OFFICE</div><h2>Work with the formats you already use</h2></div></div><div class="landing-tool-grid">${TOOLS.filter(t=>['Documents','PowerPoint','Spreadsheets'].includes(t.group)).map(t=>landingTool(t)).join('')}</div></section>
          <section class="landing-section" id="images"><div class="section-heading"><div><div class="eyebrow">IMAGES &amp; FILES</div><h2>Image operations and archives</h2></div></div><div class="landing-tool-grid">${TOOLS.filter(t=>t.group==='Images & Files').map(t=>landingTool(t)).join('')}</div></section>

          <section class="landing-section workflow-section"><div class="section-heading"><div><div class="eyebrow">WORKFLOW</div><h2>From file to result in five clear steps.</h2></div></div><div class="workflow-grid"><div class="workflow-step"><span>01</span><b>Select file</b><p>Choose one or multiple supported files.</p></div><div class="workflow-step"><span>02</span><b>Configure</b><p>Set the options for the selected tool.</p></div><div class="workflow-step"><span>03</span><b>Upload</b><p>Watch the real browser upload progress.</p></div><div class="workflow-step"><span>04</span><b>Process</b><p>The configured backend performs the operation.</p></div><div class="workflow-step"><span>05</span><b>Download</b><p>Receive the generated file directly.</p></div></div></section>

          <section class="landing-cta"><div><div class="eyebrow">READY WHEN YOU ARE</div><h2>Start working with your files.</h2><p>Open the workspace and choose the tool that matches the file you have.</p></div><button class="btn btn--primary" data-route="workspace">Open KrazyBuy Workspace ${ico('refresh')}</button></section>
        </main>
        <footer class="site-footer"><div><a class="site-brand footer-brand" href="#home" data-route="home"><img src="/images/logo.svg" alt="KrazyBuy" class="site-logo"><span><b>KrazyBuy</b><small>Document &amp; File Workspace</small></span></a><p>Browser workspace for document and file operations.</p></div><div class="footer-links"><a href="#pdf-tools">PDF</a><a href="#documents">Documents</a><a href="#images">Images &amp; Files</a><button class="footer-link-btn" data-route="workspace">Workspace</button></div><div class="footer-meta">Processed by the configured backend. No cloud persistence is claimed by this interface.</div></footer>
      </div>`;
    bindLanding();
  }
  function landingTool(t){return `<button class="landing-tool" data-route="${t.id}"><span class="landing-tool-icon">${ico(t.icon)}</span><span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></span>${ico('refresh')}</button>`;}

  function renderWorkspace(){
    const app=$('#app'); app.className='';
    app.innerHTML=`<div class="shell"><aside class="sidebar" id="sidebar"></aside><div class="main"><header class="topbar"><button class="icon-btn mobile-only" id="menuBtn" aria-label="Menu">${ico('menu')}</button><a class="mobile-brand" href="#home" data-route="home"><img src="/images/logo.svg" alt="KrazyBuy"><span>KrazyBuy</span></a><div class="top-spacer"></div><span class="pill" id="backendBadge">Connecting…</span><button class="icon-btn" id="healthBtn" aria-label="Refresh backend status">${ico('refresh')}</button><div class="avatar">ME</div></header><main class="content" id="workspace" tabindex="-1"></main></div><nav class="mobile-nav"><button data-route="dashboard">${ico('home')}<span>Home</span></button><button data-route="pdf-image">${ico('pdf')}<span>PDF</span></button><button data-route="ppt-edit">${ico('ppt')}<span>PPT</span></button><button data-route="doc-edit">${ico('doc')}<span>Docs</span></button><button id="moreBtn">${ico('menu')}<span>More</span></button></nav></div><div id="operationProgress" class="operation-progress" hidden aria-live="polite"><div class="operation-progress-card"><div class="operation-progress-head"><div><strong id="operationTitle">Preparing…</strong><small id="operationSubtitle">Preparing your files</small></div><strong id="operationPercent">0%</strong></div><div class="operation-bar"><i id="operationBar"></i></div><div class="operation-block"><span id="operationBlockText">░░░░░░░░░░░░░░░░░░░░ 0%</span></div></div></div>`;
    renderNav();
    $('#menuBtn')?.addEventListener('click',()=>$('#sidebar')?.classList.toggle('open'));
    $('#moreBtn')?.addEventListener('click',()=>$('#sidebar')?.classList.toggle('open'));
    $('#healthBtn')?.addEventListener('click',health);
    dashboard();
  }

  function renderNav(){const s=$('#sidebar'); if(!s)return; s.innerHTML=`<div class="brand-side"><a class="brand-mark" href="#home" data-route="home"><img src="/images/logo.svg" alt="KrazyBuy"></a><div class="brand-copy"><strong>KrazyBuy</strong><span>Document Workspace</span></div></div><nav class="nav-scroll"><div class="nav-label">HOME</div><button class="nav-item" data-route="dashboard" ${state.tool==='dashboard'?'aria-current="page"':''}>${ico('home')}<span>Dashboard</span></button>${GROUPS.map(g=>`<div class="nav-label">${g}</div>${TOOLS.filter(t=>t.group===g).map(t=>`<button class="nav-item" data-route="${t.id}" ${state.tool===t.id?'aria-current="page"':''}>${ico(t.icon)}<span>${esc(t.name)}</span></button>`).join('')}`).join('')}</nav><div class="side-foot"><div class="dot-row" id="serverDot"><span class="dot"></span><b>Checking backend…</b></div><small>Vercel serves the workspace. File processing uses the configured backend.</small></div>`;}

  function dashboard(){const w=$('#workspace'); if(!w)return; w.innerHTML=`<section class="dashboard-hero"><div><div class="eyebrow">WORKSPACE</div><h1>Powerful document tools in <em>one workspace.</em></h1><p class="lede">Choose a real workflow, upload your file and receive the generated result from the configured backend.</p><div class="btn-row hero-buttons"><button class="btn btn--primary" data-route="pdf-image">PDF → Images ${ico('pdf')}</button><button class="btn btn--soft" data-route="pdf-edit">Edit PDF ${ico('edit')}</button><button class="btn" data-route="ppt-edit">Edit PPTX ${ico('ppt')}</button></div></div><div class="workspace-status-card"><span class="pill pill-dark">KRAZYBUY WORKSPACE</span><strong>Real workflows, visible status.</strong><p>Backend health, upload progress and operation errors are surfaced directly.</p><div class="status-stats"><div><b>${TOOLS.length}</b><small>workflows</small></div><div><b>${GROUPS.length}</b><small>families</small></div><div><b>${state.server?'ON':'—'}</b><small>backend</small></div></div></div></section><div class="section-head"><div><div class="eyebrow">TOOLS</div><h2>Choose a workflow</h2></div><span class="pill">${TOOLS.length} real tool definitions</span></div><div class="tool-grid">${TOOLS.map(t=>`<button class="tool-card" data-route="${t.id}"><span class="tool-ico">${ico(t.icon)}</span><h3>${esc(t.name)}</h3><p>${esc(t.desc)}</p><span class="tool-link">Open workflow ${ico('refresh')}</span></button>`).join('')}</div>`; renderNav(); }

  function uploadHTML(t){return `<div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload ${t.multiple?'files':'file'}"><div class="dz-orb">${ico('upload')}</div><div class="dz-title">${t.multiple?'Drop your files here':'Drop your file here'}</div><div class="dz-hint">Drag and drop or browse from your device.</div><div class="btn-row"><button type="button" class="btn btn--primary" id="browse">${ico('upload')}Browse files</button>${t.folder?`<button type="button" class="btn" id="folder">${ico('zip')}Choose folder</button>`:''}</div><div class="dz-meta">${t.accept?t.accept.map(x=>'.'+x).join(' · '):'Any supported file'} · ${t.multiple?'multiple files':'single file'} · max ${cfg.maxFileMB} MB each</div></div>`;}
  function fileList(t){const fs=files(); if(!fs.length)return `<div class="note">No files selected yet.</div>`; return `<div class="file-list">${fs.map((f,i)=>`<div class="file-row"><div class="thumb" data-thumb="${i}">${IMG.includes(ext(f.name))?'IMG':esc(ext(f.name)||'FILE').toUpperCase()}</div><div class="file-meta"><b title="${esc(f.name)}">${esc(f.name)}</b><span>${size(f.size)}${f.webkitRelativePath?' · '+esc(f.webkitRelativePath):''}</span></div><button type="button" class="icon-btn icon-btn--bare" data-remove="${i}" title="Remove file" aria-label="Remove file">${ico('trash')}</button></div>`).join('')}</div><div class="btn-row file-actions"><span class="pill">${fs.length} file${fs.length>1?'s':''}</span>${t.multiple?`<button type="button" class="btn btn--sm" id="addMore">${ico('plus')}Add more</button>`:''}<button type="button" class="btn btn--sm" id="clearFiles">${ico('trash')}Clear all</button></div>`;}

  function fields(t){switch(t.id){
    case 'pdf-split':return `<div class="field"><label>Pages / ranges</label><input id="ranges" placeholder="1-3,5,8-10"></div>`;
    case 'pdf-edit':return `<div class="grid-2"><div class="field field--full"><label>Text to add</label><input id="text" placeholder="Approved — internal copy"></div><div class="field"><label>Target page</label><input id="page" type="number" min="1" value="1"></div><div class="field"><label>Font size</label><input id="fontSize" type="number" min="6" max="200" value="18"></div><div class="field field--full"><label>Watermark</label><input id="watermark"></div><div class="field"><label>Rotate all pages</label><select id="rotate"><option value="0">No rotation</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></div><label class="check"><input id="pageNumbers" type="checkbox">Add page numbers</label></div>`;
    case 'pdf-organize':return `<div class="toolbar"><button type="button" class="btn btn--sm" id="loadPages">${ico('refresh')}Load pages</button><button type="button" class="btn btn--sm" id="selectAll">Select all</button><button type="button" class="btn btn--sm" id="selectNone">Clear selection</button><button type="button" class="btn btn--sm" id="rotateSelected">${ico('rotate')}Rotate</button><button type="button" class="btn btn--sm" id="deleteSelected">${ico('trash')}Delete selected</button><button type="button" class="btn btn--sm" id="restorePages">Restore</button></div><div class="tile-strip" id="tiles"><div class="empty">Load the PDF to see its real pages.</div></div>`;
    case 'pdf-compress':return `<div class="field"><label>Compression</label><select id="level"><option value="medium">Balanced</option><option value="low">High quality</option><option value="high">Smallest</option></select></div>`;
    case 'pdf-protect':return `<div class="field"><label>Password</label><input id="password" type="password" minlength="6" placeholder="At least 6 characters"></div>`;
    case 'pdf-image':return `<div class="field"><label>Output format</label><select id="format"><option value="png">PNG</option><option value="jpg">JPG</option></select></div>`;
    case 'ppt-create':return `<div class="grid-2"><div class="field"><label>Title</label><input id="title" value="KrazyBuy Presentation"></div><div class="field"><label>Subtitle</label><input id="subtitle" value="Created with KrazyBuy"></div><div class="field"><label>Slides</label><input id="slides" type="number" min="1" max="100" value="5"></div><div class="field field--full"><label>Content</label><textarea id="contentText" placeholder="One line per slide works well…"></textarea></div></div>`;
    case 'ppt-edit':return `<div class="btn-row"><button type="button" class="btn btn--soft" id="inspectSlides">${ico('refresh')}Load slides</button></div><div id="slideEditor" class="editor-list"><div class="empty">Load the deck to inspect its real slide text.</div></div><div class="note">Only changed original strings are sent to the backend.</div>`;
    case 'doc-create':return `<div class="field"><label>Title</label><input id="title" value="KrazyBuy Document"></div><div class="field"><label>Body</label><textarea id="text" style="min-height:300px"></textarea></div>`;
    case 'doc-edit':return `<div class="btn-row"><button type="button" class="btn btn--soft" id="loadDoc">${ico('refresh')}Load text</button><button type="button" class="btn" id="exportDocPdf">${ico('pdf')}Export PDF</button></div><div class="field"><label>Document text</label><textarea id="docText" style="min-height:320px" placeholder="Load a DOCX first"></textarea><small id="docMeta">Not loaded.</small></div><div class="grid-2"><div class="field"><label>Find</label><input id="find"></div><div class="field"><label>Replace</label><input id="replace"></div></div>`;
    case 'xlsx-edit':return `<div class="btn-row"><button type="button" class="btn btn--soft" id="inspectXlsx">${ico('refresh')}Load workbook</button></div><div id="sheetEditor"><div class="empty">Load the workbook to view the real sheet data.</div></div><div class="grid-2"><div class="field"><label>Active sheet</label><input id="sheet" value="Sheet1"></div><div class="field"><label>Edited cells JSON</label><textarea id="cells" placeholder='{"A1":"Updated"}'></textarea></div></div>`;
    case 'img-edit':case 'img-convert':case 'img-resize':return `<div class="grid-2"><div class="field"><label>Width</label><input id="width" type="number" min="1"></div><div class="field"><label>Height</label><input id="height" type="number" min="1"></div><div class="field"><label>Format</label><select id="format"><option value="webp">WebP</option><option value="png">PNG</option><option value="jpg">JPG</option></select></div><div class="field"><label>Quality</label><input id="quality" type="number" min="1" max="100" value="82"></div><div class="field"><label>Degrees</label><input id="degrees" type="number" value="90"></div><div class="field"><label>Flip horizontal</label><input id="horizontal" type="checkbox"></div><div class="field field--full"><label>Watermark</label><input id="watermark"></div></div><div id="imagePreview" class="preview"><div class="empty">Select an image to preview it.</div></div>`;
    case 'img-crop':return `<div class="grid-2"><div class="field"><label>Crop width</label><input id="width" type="number" min="1"></div><div class="field"><label>Crop height</label><input id="height" type="number" min="1"></div><div class="field"><label>Left</label><input id="left" type="number" min="0" value="0"></div><div class="field"><label>Top</label><input id="top" type="number" min="0" value="0"></div></div><div id="imagePreview" class="preview"><div class="empty">Select an image to preview it.</div></div>`;
    case 'img-rotate':return `<div class="field"><label>Degrees</label><input id="degrees" type="number" value="90" step="90"></div><div id="imagePreview" class="preview"><div class="empty">Select an image to preview it.</div></div>`;
    case 'img-flip':return `<div class="field"><label>Direction</label><select id="horizontal"><option value="1">Horizontal</option><option value="0">Vertical</option></select></div>`;
    case 'img-compress':return `<div class="grid-2"><div class="field"><label>Quality</label><input id="quality" type="number" min="1" max="100" value="80"></div><div class="field"><label>Format</label><select id="format"><option value="webp">WebP</option><option value="jpg">JPG</option><option value="png">PNG</option></select></div></div><div id="imagePreview" class="preview"><div class="empty">Select an image to preview it.</div></div>`;
    case 'img-watermark':return `<div class="grid-2"><div class="field"><label>Quality</label><input id="quality" type="number" min="1" max="100" value="80"></div><div class="field"><label>Format</label><select id="format"><option value="webp">WebP</option><option value="jpg">JPG</option><option value="png">PNG</option></select></div><div class="field field--full"><label>Watermark text</label><input id="watermark"></div></div>`;
    case 'zip-create':return `<div class="field"><label>Archive name</label><input id="zipName" value="krazybuy-files.zip"></div><div class="note">Choose a folder to preserve nested folder paths where supported.</div>`;
    default:return '';
  }}

  const actionLabel = t => ({'pdf-merge':'Merge PDFs','pdf-split':'Extract pages','pdf-organize':'Apply page changes','pdf-edit':'Apply PDF edits','pdf-compress':'Compress PDF','pdf-protect':'Protect PDF','pdf-image':'Render pages','images-pdf':'Create PDF','ppt-edit':'Save presentation','ppt-create':'Create PPTX','ppt-pdf':'Convert to PDF','ppt-images':'Render slides','images-ppt':'Create PPTX','pdf-ppt':'Create PPTX','doc-edit':'Save DOCX','doc-create':'Create DOCX','doc-pdf':'Convert to PDF','doc-txt':'Export TXT','pdf-docx':'Convert to DOCX','xlsx-edit':'Save workbook','csv-xlsx':'Convert XLSX','xlsx-csv':'Export CSV','xlsx-pdf':'Export PDF','img-edit':'Process image','img-convert':'Convert image','img-resize':'Resize image','img-crop':'Crop image','img-rotate':'Rotate image','img-flip':'Flip image','img-compress':'Compress image','img-watermark':'Watermark image','zip-create':'Create ZIP'}[t.id] || 'Run');

  function toolView(id){const t=byId(id); if(!t){navigate('dashboard');return;} state.tool=id; state.scratch={}; const selected=files(); const w=$('#workspace'); w.innerHTML=`<div class="page-top"><div><div class="eyebrow">${esc(t.group)} WORKFLOW</div><h1 class="page-title">${esc(t.name)}</h1><p class="lede">${esc(t.desc)}</p></div><div class="btn-row"><button class="btn btn--soft" data-route="dashboard">Dashboard</button></div></div><div class="work-layout"><section class="panel">${t.accept!==null||t.multiple||t.folder?uploadHTML(t):''}<div id="fileArea">${t.accept!==null||t.multiple||t.folder?fileList(t):''}</div><div id="fields">${fields(t)}</div><div class="sticky-cta"><button type="button" class="btn btn--primary" id="run">${ico('download')}${actionLabel(t)}</button></div><div id="phase" class="phase" hidden></div></section><aside class="aside"><div class="panel"><span class="pill pill-ok">${ico('check')}API connected</span><p class="aside-copy">Files are sent to the configured processing backend. Results are returned to this browser for download.</p></div><div class="panel"><h3>Workflow</h3><ul><li>Select your file(s).</li><li>Configure the options.</li><li>Run the operation.</li><li>Wait for the backend.</li><li>Download the result.</li></ul></div></aside></div>`; renderNav(); bindTool(t); if(selected.length) refreshFilesUI(t);}

  function bindTool(t){const browse=$('#browse'),drop=$('#dropzone'),folder=$('#folder'); if(browse)browse.onclick=()=>choose(t,false); if(folder)folder.onclick=()=>choose(t,true); if(drop){drop.onclick=e=>{if(e.target.closest('button'))return;choose(t,false)}; drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(t,false)}}; ['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('is-drag')})); ['dragleave'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('is-drag')})); drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('is-drag');addFiles(t,[...(e.dataTransfer?.files||[])]);});}
    $('#run')?.addEventListener('click',()=>runTool(t)); $('#clearFiles')?.addEventListener('click',()=>{setFiles([]);refreshFilesUI(t);toast('Files cleared','info')}); $('#addMore')?.addEventListener('click',()=>choose(t,false,true)); $('#inspectSlides')?.addEventListener('click',loadPpt); $('#loadDoc')?.addEventListener('click',loadDoc); $('#exportDocPdf')?.addEventListener('click',exportDocPdf); $('#inspectXlsx')?.addEventListener('click',loadXlsx); $('#loadPages')?.addEventListener('click',loadPdfPages); $('#selectAll')?.addEventListener('click',()=>{state.scratch.pages?.forEach(p=>{if(!p.removed)p.sel=true});drawTiles()}); $('#selectNone')?.addEventListener('click',()=>{state.scratch.pages?.forEach(p=>p.sel=false);drawTiles()}); $('#rotateSelected')?.addEventListener('click',()=>{state.scratch.pages?.filter(p=>p.sel&&!p.removed).forEach(p=>p.rot=(p.rot+90)%360);drawTiles()}); $('#deleteSelected')?.addEventListener('click',()=>{state.scratch.pages?.filter(p=>p.sel&&!p.removed).forEach(p=>{p.removed=true;p.sel=false});drawTiles()}); $('#restorePages')?.addEventListener('click',()=>{state.scratch.pages?.forEach(p=>p.removed=false);drawTiles()}); if(IMG.includes(t.accept?.[0])) previewImage(); }

  function choose(t,folder=false,more=false){const i=document.createElement('input'); i.type='file'; i.accept=t.accept?t.accept.map(x=>'.'+x).join(','):''; i.multiple=Boolean(t.multiple||more||folder); if(folder){i.webkitdirectory=true;i.setAttribute('webkitdirectory','')}; i.onchange=()=>{addFiles(t,[...(i.files||[])]);i.remove()}; document.body.appendChild(i);i.click();}
  function addFiles(t,incoming){if(!incoming.length)return;const {ok,bad}=valid(incoming,t);let next=t.multiple?[...files(),...ok]:ok.slice(-1);const seen=new Set();next=next.filter(f=>{const k=`${f.name}:${f.size}:${f.lastModified}`;if(seen.has(k))return false;seen.add(k);return true});setFiles(next);refreshFilesUI(t);if(bad.length)toast(bad[0],'error');if(ok.length)toast(`${ok.length} file${ok.length>1?'s':''} added`);if(t.id.startsWith('img-'))previewImage();}
  function valid(incoming,t){const ok=[],bad=[];for(const f of incoming){const e=ext(f.name);if(t.accept&&!t.accept.includes(e)){bad.push(`${f.name}: unsupported file type`);continue}if(!f.size){bad.push(`${f.name}: empty file`);continue}if(f.size>cfg.maxFileMB*1024*1024){bad.push(`${f.name}: larger than ${cfg.maxFileMB} MB`);continue}ok.push(f)}return {ok,bad};}
  function refreshFilesUI(t){const area=$('#fileArea');if(!area)return;area.innerHTML=fileList(t);$$('[data-remove]').forEach(b=>b.onclick=()=>{const a=files().slice();a.splice(Number(b.dataset.remove),1);setFiles(a);refreshFilesUI(t);toast('File removed','info')});files().forEach((f,i)=>{if(!IMG.includes(ext(f.name)))return;const slot=$(`[data-thumb="${i}"]`);if(!slot)return;const u=URL.createObjectURL(f);slot.innerHTML=`<img src="${u}" alt="">`;slot.querySelector('img')?.addEventListener('load',()=>URL.revokeObjectURL(u),{once:true})});}

  function progressPanel(title,subtitle,p=0){const box=$('#operationProgress');if(!box)return;box.hidden=false;const n=clamp(p);$('#operationTitle').textContent=title;$('#operationSubtitle').textContent=subtitle;$('#operationPercent').textContent=`${n}%`;$('#operationBar').style.width=`${n}%`;const total=20,filled=Math.round(n/100*total);$('#operationBlockText').textContent=`${'█'.repeat(filled)}${'░'.repeat(total-filled)} ${n}%`;}
  function hideProgress(){const box=$('#operationProgress');if(box)box.hidden=true;}
  function phase(label,kind='busy',percent=null){const n=$('#phase');if(!n)return;n.hidden=false;n.className=`phase ${kind==='ok'?'ok':kind==='error'?'error':''}`;n.innerHTML=`<div class="phase-top">${ico(kind==='ok'?'check':kind==='error'?'alert':'refresh')}<span>${esc(label)}</span></div>${kind==='busy'?`<div class="progress"><i style="width:${percent==null?38:clamp(percent)}%"></i></div>`:''}`;}

  function xhrRequest(path,body,expect='blob',callbacks={},retry=true){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open('POST',api(path),true);xhr.responseType='blob';xhr.timeout=cfg.requestTimeoutMs;xhr.setRequestHeader('X-KrazyBuy-Client','workspace-production');xhr.setRequestHeader('Accept',expect==='json'?'application/json':'*/*');xhr.upload.onprogress=e=>{if(e.lengthComputable)callbacks.onUpload?.(Math.round(e.loaded/e.total*100),e.loaded,e.total)};xhr.onprogress=e=>{if(e.lengthComputable)callbacks.onDownload?.(Math.round(e.loaded/e.total*100),e.loaded,e.total)};xhr.onload=async()=>{const blob=xhr.response instanceof Blob?xhr.response:new Blob([xhr.response||'']);if(xhr.status<200||xhr.status>=300){let msg=`Request failed (${xhr.status})`;try{const text=await blob.text();try{const j=JSON.parse(text);msg=j.error||j.message||msg}catch{if(text.trim())msg=text.trim()}}catch{} if(retry && apiState.current==='/api' && [404,405,502,503].includes(xhr.status)){apiState.checked=false;await resolveApiBase();if(apiState.current!=='/api'){try{return resolve(await request(path,body,expect,callbacks,false));}catch(e){return reject(e);}}}return reject(new Error(human(msg)));} if(expect==='json'){try{return resolve(JSON.parse(await blob.text()))}catch{return reject(new Error('Backend returned invalid JSON.'))}} let filename='krazybuy-output.bin';const cd=xhr.getResponseHeader('content-disposition')||'';const u=cd.match(/filename\*=UTF-8''([^;]+)/i),n=cd.match(/filename="?([^";]+)"?/i);try{if(u)filename=decodeURIComponent(u[1]);else if(n)filename=n[1]}catch{}resolve({blob,name:filename});};xhr.onerror=async()=>{if(retry&&apiState.current==='/api'){apiState.checked=false;await resolveApiBase();if(apiState.current!=='/api'){try{return resolve(await request(path,body,expect,callbacks,false));}catch(e){return reject(e);}}}reject(new Error('Could not reach the processing backend.'))};xhr.ontimeout=()=>reject(new Error('The backend took too long to respond.'));xhr.onabort=()=>reject(new Error('Operation cancelled.'));try{xhr.send(body)}catch(e){reject(e)}})}
  async function request(path,body,expect='blob',callbacks={},retry=true){if(!apiState.checked)await resolveApiBase();return xhrRequest(path,body,expect,callbacks,retry);}
  function save(result){const u=URL.createObjectURL(result.blob);const a=document.createElement('a');a.href=u;a.download=result.name||'krazybuy-output.bin';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),8000);}
  const fdOne=f=>{const x=new FormData();x.append('file',f,f.name);return x;};

  async function runTool(t){if(state.busy)return;try{const fs=files();if(!['ppt-create','doc-create'].includes(t.id)&&!fs.length)throw Error(`Select ${t.multiple?'at least one file':'a file'} first.`);if(t.id==='pdf-merge'&&fs.length<2)throw Error('Select at least two PDF files to merge.');state.busy=true;$('#run').disabled=true;progressPanel('Preparing…','Preparing your files',0);phase('Preparing…','busy',0);let form;let path=t.endpoint;
      if(t.id==='ppt-create'){form=new FormData();form.append('title',$('#title')?.value||'');form.append('subtitle',$('#subtitle')?.value||'');form.append('slides',$('#slides')?.value||'5');form.append('content',$('#contentText')?.value||'');}
      else if(t.id==='doc-create'){const text=$('#text')?.value||'';if(!text.trim())throw Error('Write some document text first.');form=new URLSearchParams({title:$('#title')?.value||'KrazyBuy Document',text});}
      else if(t.multiple){form=new FormData();fs.forEach(f=>form.append('files',f,f.name));if(t.id==='zip-create'){form.append('relativePaths',JSON.stringify(fs.map(f=>f.webkitRelativePath||f.name)));form.append('archiveName',$('#zipName')?.value||'krazybuy-files.zip');}}
      else form=fdOne(fs[0]);
      if(t.id==='pdf-split'){const ranges=$('#ranges')?.value?.trim()||'';if(!ranges)throw Error('Enter the pages or ranges to extract.');form.append('ranges',ranges);}
      if(t.id==='pdf-edit'){const text=$('#text')?.value||'',wm=$('#watermark')?.value||'',rot=$('#rotate')?.value||'0',pn=Boolean($('#pageNumbers')?.checked);if(!text&&!wm&&!pn&&rot==='0')throw Error('Add text, watermark, page numbers or rotation before running.');for(const k of ['text','page','fontSize','watermark','rotate'])form.append(k,$(`#${k}`)?.value||'');form.append('pageNumbers',String(pn));form.append('deletePages','');form.append('reorder','[]');}
      if(t.id==='pdf-organize'){const p=state.scratch.pages||[];if(!p.length)throw Error('Load the PDF pages first.');const kept=p.filter(x=>!x.removed);if(!kept.length)throw Error('At least one page must remain.');form.append('deletePages',p.filter(x=>x.removed).map(x=>x.src).join(','));form.append('reorder',JSON.stringify(kept.map(x=>x.src)));const rots=new Set(kept.map(x=>x.rot));form.append('rotate',String(rots.size===1?[...rots][0]:0));form.append('text','');form.append('watermark','');form.append('pageNumbers','false');}
      if(t.id==='pdf-compress')form.append('level',$('#level')?.value||'medium');
      if(t.id==='pdf-protect'){const p=$('#password')?.value||'';if(p.length<6)throw Error('Password must contain at least 6 characters.');form.append('password',p);}
      if(t.id==='pdf-image')form.append('format',$('#format')?.value||'png');
      if(t.id==='ppt-edit'){const replacements={};$$('[data-slide-editor]').forEach(el=>{const s=state.scratch.deck?.[Number(el.dataset.slideEditor)];if(s&&s.orig&&el.value!==s.orig)replacements[s.orig]=el.value});if(!Object.keys(replacements).length)throw Error('Edit at least one slide text before saving.');form.append('textReplacements',JSON.stringify(replacements));form.append('deleteSlides','');form.append('reorderSlides','');form.append('duplicateSlide','');form.append('addSlide','false');}
      if(t.id==='doc-edit'){const find=$('#find')?.value||'';if(!find)throw Error('Enter the text to find.');form.append('find',find);form.append('replace',$('#replace')?.value||'');form.append('title','KrazyBuy Edited Document');}
      if(t.id==='xlsx-edit'){const cells=$('#cells')?.value?.trim()||'{}';try{JSON.parse(cells)}catch{throw Error('Edited cells must contain valid JSON.')}form.append('sheet',$('#sheet')?.value||'Sheet1');form.append('cells',cells);}
      if(t.id.startsWith('img-')){for(const k of ['width','height','left','top','degrees','quality','format']){const e=$(`#${k}`);if(e&&e.value!=='')form.append(k,e.value);}const h=$('#horizontal');if(h)form.append('horizontal',h.type==='checkbox'?(h.checked?'1':'0'):h.value);const wm=$('#watermark');if(wm)form.append('watermark',wm.value);}
      const result=await request(path,form,'blob',{onUpload:(p,loaded,total)=>{progressPanel('Uploading files…',total?`${size(loaded)} / ${size(total)}`:'Uploading files…',p);phase(`Uploading… ${p}%`,'busy',p)},onDownload:p=>{progressPanel('Receiving result…','Downloading generated file',p);phase(`Receiving result… ${p}%`,'busy',p)}});
      progressPanel('Completed','Preparing download',100);phase('Operation completed. Preparing download…','busy',100);save(result);phase(`Done — ${result.name} downloaded.`,'ok');toast(`Downloaded ${result.name}`);setTimeout(hideProgress,1200);
    }catch(e){const m=human(e);phase(m,'error');progressPanel('Operation failed',m,100);toast(m,'error');setTimeout(hideProgress,2500);}finally{state.busy=false;$('#run')&&($('#run').disabled=false);}}

  async function loadPpt(){const f=files()[0];if(!f)return toast('Select a PPTX first.','error');try{phase('Reading presentation…');const r=await request('/ppt/inspect',fdOne(f),'json');const items=r?.data?.items||r?.items||[];state.scratch.deck=items.map(x=>({orig:x.text||'',text:x.text||''}));const e=$('#slideEditor');if(e)e.innerHTML=state.scratch.deck.length?state.scratch.deck.map((s,i)=>`<div class="slide-row"><b>Slide ${i+1}</b><textarea data-slide-editor="${i}">${esc(s.text)}</textarea></div>`).join(''):'<div class="empty">No extractable slide text was returned by the backend.</div>';phase(`Loaded ${state.scratch.deck.length} slide${state.scratch.deck.length===1?'':'s'}.`,'ok')}catch(e){phase(human(e),'error')}}
  async function loadDoc(){const f=files()[0];if(!f)return toast('Select a DOCX first.','error');try{phase('Reading DOCX…');const r=await request('/documents/read',fdOne(f),'json');const text=r?.text??r?.data?.text??'';$('#docText').value=text;$('#docMeta').textContent=`${text.length.toLocaleString()} characters`;phase('Document loaded.','ok')}catch(e){phase(human(e),'error')}}
  async function exportDocPdf(){const text=$('#docText')?.value||'';if(!text.trim())return toast('Load or enter document text first.','error');try{const form=new URLSearchParams({text,title:'KrazyBuy Document'});progressPanel('Preparing PDF…','Rendering document',0);phase('Rendering PDF…');const r=await request('/documents/text-to-pdf',form,'blob',{onUpload:p=>progressPanel('Uploading document…','Sending document',p)});save(r);phase(`Done — ${r.name} downloaded.`,'ok');toast(`Downloaded ${r.name}`);hideProgress()}catch(e){const m=human(e);phase(m,'error');toast(m,'error');hideProgress()}}
  async function loadXlsx(){const f=files()[0];if(!f)return toast('Select an XLSX first.','error');try{phase('Reading workbook…');const r=await request('/xlsx/inspect',fdOne(f),'json');const ws=r?.data?.worksheets||r?.worksheets||[];$('#sheetEditor').innerHTML=ws.length?ws.map((s,i)=>{const rows=(s.rows||[]).map(row=>Array.isArray(row)?row:(row.cells||[]));return `<div class="note"><b>${esc(s.title||`Sheet ${i+1}`)}</b></div><div class="sheet-wrap"><table><tbody>${rows.slice(0,30).map(row=>`<tr>${row.slice(0,20).map(c=>`<td><input value="${esc(c??'')}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>`}).join(''):'<div class="empty">No worksheet data returned.</div>';phase(`Loaded ${ws.length} worksheet${ws.length===1?'':'s'}.`,'ok')}catch(e){phase(human(e),'error')}}
  async function loadPdfPages(){const f=files()[0];if(!f)return toast('Select a PDF first.','error');try{phase('Reading PDF page count…');const r=await request('/pdf/info',fdOne(f),'json');const n=Number(r?.data?.pages||r?.data?.pageCount||r?.pages||r?.pageCount||0);if(!n)throw Error('The backend did not return a page count.');state.scratch.pages=Array.from({length:n},(_,i)=>({src:i+1,rot:0,removed:false,sel:false}));drawTiles();phase(`${n} pages loaded.`,'ok')}catch(e){phase(human(e),'error')}}
  function drawTiles(){const c=$('#tiles'),p=state.scratch.pages||[];if(!c)return;if(!p.length){c.innerHTML='<div class="empty">No pages loaded.</div>';return}c.innerHTML=p.map((x,i)=>`<button type="button" class="tile ${x.sel?'selected':''} ${x.removed?'removed':''}" data-page="${i}" aria-pressed="${x.sel}">${x.src}<span class="tile-no">${i+1}</span></button>`).join('');$$('[data-page]').forEach(b=>b.onclick=()=>{const x=state.scratch.pages[Number(b.dataset.page)];if(x){x.sel=!x.sel;drawTiles()}})}
  function previewImage(){const f=files()[0],b=$('#imagePreview');if(!b||!f||!IMG.includes(ext(f.name)))return;const u=URL.createObjectURL(f);b.innerHTML=`<img src="${u}" alt="${esc(f.name)}">`;b.querySelector('img')?.addEventListener('load',()=>URL.revokeObjectURL(u),{once:true});}

  async function health(){const badge=$('#backendBadge');if(badge){badge.textContent='Connecting…';badge.className='pill';}const r=await resolveApiBase();if(!r.data){state.server=null;if(badge){badge.textContent='Backend offline';badge.className='pill pill-warn';}updateServerDot(false);return;}state.server=r.data;if(badge){badge.textContent=`Online · ${r.data.version||r.data.name||'API'}`;badge.className='pill pill-ok';}updateServerDot(true);}
  function updateServerDot(on){const d=$('#serverDot');if(!d)return;d.classList.toggle('off',!on);d.innerHTML=`<span class="dot"></span><b>${on?'Backend online':'Backend unavailable'}</b>`;}

  function navigate(id){if(id==='home'){renderShell();history.replaceState(null,'','#home');window.scrollTo({top:0,behavior:'smooth'});return;} if(!byId(id)&&id!=='dashboard'&&id!=='workspace')return; if(id==='workspace'){renderWorkspace();history.replaceState(null,'','#workspace');health();return;} state.tool=id; renderWorkspace(); if(id==='dashboard')dashboard(); else toolView(id); history.replaceState(null,'',`#${id}`); health();}
  function bindLanding(){
    $$('[data-route]').forEach(e=>e.addEventListener('click',ev=>{ev.preventDefault();navigate(e.dataset.route);}));
    $$('[data-scroll]').forEach(e=>e.addEventListener('click',ev=>{ev.preventDefault();document.getElementById(e.dataset.scroll)?.scrollIntoView({behavior:'smooth',block:'start'});}));
    $('#landingMenu')?.addEventListener('click',()=>document.querySelector('.site-nav')?.classList.toggle('open'));
  }
  document.addEventListener('click',e=>{const r=e.target.closest('[data-route]');if(r&&!r.dataset.route.startsWith('http')){e.preventDefault();navigate(r.dataset.route);}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#sidebar')?.classList.remove('open');if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){const run=$('#run');if(run&&!run.disabled){e.preventDefault();run.click();}}});
  window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(h==='home'||h==='workspace'||h==='dashboard'||byId(h))navigate(h);});

  if(location.hash && (location.hash==='#workspace'||location.hash==='#dashboard'||byId(location.hash.slice(1)))) navigate(location.hash.slice(1)); else renderShell();
  window.KRAZYBUY_API={config:cfg,state:apiState,resolve:resolveApiBase,health,url:api};
})();
