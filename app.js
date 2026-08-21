/* ============================================================
 * KRAZYBUY DOCUMENT WORKSPACE
 * V1.2 UPGRADED APP.JS
 *
 * Frontend:
 * - PDF tools
 * - PowerPoint tools
 * - Document tools
 * - Spreadsheet tools
 * - Image tools
 * - ZIP tools
 *
 * IMPORTANT:
 * Backend endpoints remain the existing /api/* endpoints.
 * ============================================================ */

(() => {
  'use strict';

  /* ============================================================
   * DOM HELPERS
   * ============================================================ */

  const $ = (selector, root = document) => root.querySelector(selector);

  const $$ = (selector, root = document) =>
    [...root.querySelectorAll(selector)];

  /* ============================================================
   * BASIC HELPERS
   * ============================================================ */

  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[char]
    );

  const size = (bytes) => {
    let value = Number(bytes) || 0;
    const units = ['B', 'KB', 'MB', 'GB'];
    let index = 0;

    while (
      value >= 1024 &&
      index < units.length - 1
    ) {
      value /= 1024;
      index++;
    }

    return `${value.toFixed(index ? 1 : 0)} ${units[index]}`;
  };

  const ext = (name) => {
    const value = String(name || '').toLowerCase();
    const index = value.lastIndexOf('.');

    return index < 0 ? '' : value.slice(index + 1);
  };

  const cfg = Object.assign(
    {
      apiBase: '/api',
      requestTimeoutMs: 180000,
    },
    window.KRAZYBUY_CONFIG || {}
  );

  const api = (path) =>
    `${String(cfg.apiBase).replace(/\/$/, '')}${path}`;

  /* ============================================================
   * ICONS
   * ============================================================ */

  const icons = {
    home: 'M3 10.5 12 3l9 7.5M5 9.8V20h14V9.8',

    pdf:
      'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4',

    ppt:
      'M4 4h16v11H4zM12 15v5M8 20h8M9 8h4a2 2 0 1 1 0 4H9zm0 0v4',

    doc:
      'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 12h6M9 16h6',

    xls:
      'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16',

    image:
      'M3 5h18v14H3zM3 15l5-4 4 3 3-3 6 5',

    zip:
      'M6 3h12v18H6zM11 3v4M13 7v4M11 11v4M13 15v3',

    upload:
      'M12 17V4m0 0-4 4m4-4 4 4M4 20h16',

    download:
      'M12 4v13m0 0-4-4m4 4 4-4M4 20h16',

    search:
      'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2',

    menu:
      'M4 7h16M4 12h16M4 17h16',

    plus:
      'M12 5v14M5 12h14',

    close:
      'M6 6l12 12M18 6 6 18',

    check:
      'M4 12.5 9 17.5 20 6.5',

    alert:
      'M12 4 2.5 20h19zM12 10v4M12 17.5v.5',

    refresh:
      'M4 12a8 8 0 0 1 13.6-5.7M20 12a8 8 0 0 1-13.6 5.7M18 3v4h-4M6 21v-4h4',

    lock:
      'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3',

    copy:
      'M9 9h11v11H9zM15 5H4v11h3',

    split:
      'M4 6h7M4 18h7M11 6v12M13 12h7M20 12l-3-3M20 12l-3 3',

    compress:
      'M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4',

    grid:
      'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',

    swap:
      'M4 8h13l-3-3M20 16H7l3 3',

    edit:
      'M4 20h4L19 9l-4-4L4 16zM14.5 5.5 18.5 9.5',

    star:
      'M12 4l2.5 5.2 5.5.8-4 3.9 1 5.6-5-2.9-5 2.9 1-5.6-4-3.9 5.5-.8z',

    trash:
      'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',

    rotate:
      'M20 12a8 8 0 1 1-2.4-5.7M20 4v4h-4',
  };

  const ico = (name) =>
    `<svg viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true">
      <path d="${icons[name] || icons.menu}"></path>
    </svg>`;

  /* ============================================================
   * FILE TYPES
   * ============================================================ */

  const IMG = [
    'png',
    'jpg',
    'jpeg',
    'webp',
    'gif',
    'bmp',
  ];

  /* ============================================================
   * TOOL DEFINITIONS
   * ============================================================ */

  const TOOLS = [
    {
      id: 'pdf-merge',
      name: 'Merge PDF',
      group: 'PDF',
      icon: 'copy',
      accept: ['pdf'],
      multiple: true,
      desc: 'Combine multiple PDFs into one.',
      endpoint: '/pdf/merge',
    },

    {
      id: 'pdf-split',
      name: 'Split PDF',
      group: 'PDF',
      icon: 'split',
      accept: ['pdf'],
      desc: 'Extract pages and ranges.',
      endpoint: '/pdf/split',
    },

    {
      id: 'pdf-organize',
      name: 'Organize PDF',
      group: 'PDF',
      icon: 'grid',
      accept: ['pdf'],
      desc: 'Delete, rotate and reorder PDF pages.',
      endpoint: '/pdf/edit',
    },

    {
      id: 'pdf-edit',
      name: 'Edit PDF',
      group: 'PDF',
      icon: 'edit',
      accept: ['pdf'],
      desc: 'Add text, watermark, page numbers and rotation.',
      endpoint: '/pdf/edit',
    },

    {
      id: 'pdf-compress',
      name: 'Compress PDF',
      group: 'PDF',
      icon: 'compress',
      accept: ['pdf'],
      desc: 'Optimize a PDF with server-side compression.',
      endpoint: '/pdf/compress',
    },

    {
      id: 'pdf-protect',
      name: 'Protect PDF',
      group: 'PDF',
      icon: 'lock',
      accept: ['pdf'],
      desc: 'Password protect a PDF when qpdf is available.',
      endpoint: '/pdf/protect',
    },

    {
      id: 'pdf-image',
      name: 'PDF → Images',
      group: 'PDF',
      icon: 'image',
      accept: ['pdf'],
      desc: 'Render all PDF pages and download a ZIP.',
      endpoint: '/pdf/to-image',
    },

    {
      id: 'images-pdf',
      name: 'Images → PDF',
      group: 'PDF',
      icon: 'pdf',
      accept: IMG,
      multiple: true,
      desc: 'Create a PDF with one image per page.',
      endpoint: '/pdf/images-to-pdf',
    },

    {
      id: 'ppt-edit',
      name: 'Edit PPTX',
      group: 'PowerPoint',
      icon: 'ppt',
      accept: ['pptx'],
      desc: 'Inspect slide text and save real replacements.',
      endpoint: '/ppt/edit',
    },

    {
      id: 'ppt-create',
      name: 'Create PPTX',
      group: 'PowerPoint',
      icon: 'plus',
      accept: null,
      desc: 'Generate a real PowerPoint presentation.',
      endpoint: '/ppt/create',
    },

    {
      id: 'ppt-pdf',
      name: 'PPTX → PDF',
      group: 'PowerPoint',
      icon: 'pdf',
      accept: ['pptx', 'ppt'],
      desc: 'Convert a deck with LibreOffice.',
      endpoint: '/ppt/to-pdf',
    },

    {
      id: 'ppt-images',
      name: 'PPTX → Images',
      group: 'PowerPoint',
      icon: 'image',
      accept: ['pptx', 'ppt'],
      desc: 'Render slides and download a ZIP.',
      endpoint: '/ppt/to-images',
    },

    {
      id: 'images-ppt',
      name: 'Images → PPTX',
      group: 'PowerPoint',
      icon: 'ppt',
      accept: IMG,
      multiple: true,
      desc: 'Create one slide per image.',
      endpoint: '/ppt/images-to-pptx',
    },

    {
      id: 'pdf-ppt',
      name: 'PDF → PPTX',
      group: 'PowerPoint',
      icon: 'ppt',
      accept: ['pdf'],
      desc: 'Create slide pages from a PDF.',
      endpoint: '/ppt/pdf-to-pptx',
    },

    {
      id: 'doc-edit',
      name: 'Edit DOCX',
      group: 'Documents',
      icon: 'doc',
      accept: ['docx'],
      desc: 'Read, replace and export document text.',
      endpoint: '/documents/edit',
    },

    {
      id: 'doc-create',
      name: 'Create DOCX',
      group: 'Documents',
      icon: 'doc',
      accept: null,
      desc: 'Generate a real DOCX document.',
      endpoint: '/documents/create',
    },

    {
      id: 'doc-pdf',
      name: 'DOCX → PDF',
      group: 'Documents',
      icon: 'pdf',
      accept: ['docx'],
      desc: 'Convert DOCX using the backend converter.',
      endpoint: '/documents/to-pdf',
    },

    {
      id: 'doc-txt',
      name: 'DOCX → TXT',
      group: 'Documents',
      icon: 'doc',
      accept: ['docx'],
      desc: 'Extract readable text from DOCX.',
      endpoint: '/documents/to-txt',
    },

    {
      id: 'pdf-docx',
      name: 'PDF → DOCX',
      group: 'Documents',
      icon: 'doc',
      accept: ['pdf'],
      desc: 'Extract PDF text into a DOCX.',
      endpoint: '/documents/pdf-to-docx',
    },

    {
      id: 'xlsx-edit',
      name: 'Edit XLSX',
      group: 'Spreadsheets',
      icon: 'xls',
      accept: ['xlsx'],
      desc: 'Inspect and edit workbook cell values.',
      endpoint: '/xlsx/edit',
    },

    {
      id: 'csv-xlsx',
      name: 'CSV → XLSX',
      group: 'Spreadsheets',
      icon: 'swap',
      accept: ['csv'],
      desc: 'Convert CSV into a workbook.',
      endpoint: '/xlsx/csv-to-xlsx',
    },

    {
      id: 'xlsx-csv',
      name: 'XLSX → CSV',
      group: 'Spreadsheets',
      icon: 'swap',
      accept: ['xlsx'],
      desc: 'Export the first worksheet to CSV.',
      endpoint: '/xlsx/xlsx-to-csv',
    },

    {
      id: 'xlsx-pdf',
      name: 'XLSX → PDF',
      group: 'Spreadsheets',
      icon: 'pdf',
      accept: ['xlsx'],
      desc: 'Render a workbook report as PDF.',
      endpoint: '/xlsx/to-pdf',
    },

    {
      id: 'img-edit',
      name: 'Image Editor',
      group: 'Images & Files',
      icon: 'image',
      accept: IMG,
      desc: 'Resize, rotate, flip and watermark.',
      endpoint: '/image/edit',
    },

    {
      id: 'img-convert',
      name: 'Convert Image',
      group: 'Images & Files',
      icon: 'swap',
      accept: IMG,
      desc: 'Convert between JPG, PNG and WebP.',
      endpoint: '/image/convert',
    },

    {
      id: 'img-resize',
      name: 'Resize Image',
      group: 'Images & Files',
      icon: 'image',
      accept: IMG,
      desc: 'Resize an image while preserving quality.',
      endpoint: '/image/resize',
    },

    {
      id: 'img-crop',
      name: 'Crop Image',
      group: 'Images & Files',
      icon: 'grid',
      accept: IMG,
      desc: 'Crop exact image pixels.',
      endpoint: '/image/crop',
    },

    {
      id: 'img-rotate',
      name: 'Rotate Image',
      group: 'Images & Files',
      icon: 'rotate',
      accept: IMG,
      desc: 'Rotate an image by a chosen angle.',
      endpoint: '/image/rotate',
    },

    {
      id: 'img-flip',
      name: 'Flip Image',
      group: 'Images & Files',
      icon: 'swap',
      accept: IMG,
      desc: 'Flip horizontally or vertically.',
      endpoint: '/image/flip',
    },

    {
      id: 'img-compress',
      name: 'Compress Image',
      group: 'Images & Files',
      icon: 'compress',
      accept: IMG,
      desc: 'Compress image output with quality control.',
      endpoint: '/image/compress',
    },

    {
      id: 'img-watermark',
      name: 'Watermark Image',
      group: 'Images & Files',
      icon: 'edit',
      accept: IMG,
      desc: 'Add text watermark to an image.',
      endpoint: '/image/watermark',
    },

    {
      id: 'zip-create',
      name: 'Files → ZIP',
      group: 'Images & Files',
      icon: 'zip',
      accept: null,
      multiple: true,
      folder: true,
      desc: 'Create a ZIP while preserving folder paths.',
      endpoint: '/archive/create',
    },
  ];

  const byId = (id) =>
    TOOLS.find((tool) => tool.id === id);

  const GROUPS = [
    'PDF',
    'PowerPoint',
    'Documents',
    'Spreadsheets',
    'Images & Files',
  ];

  /* ============================================================
   * APPLICATION STATE
   * ============================================================ */

  const state = {
    tool: 'dashboard',

    files: new Map(),

    server: null,

    scratch: {},

    busy: false,
  };

  const files = () =>
    state.files.get(state.tool) || [];

  const setFiles = (value) =>
    state.files.set(state.tool, value);

  /* ============================================================
   * ERROR NORMALIZATION
   * ============================================================ */

  const human = (error) => {
    const message = String(
      error?.message || error || ''
    );

    if (/pdftoppm|poppler/i.test(message)) {
      return 'PDF image rendering needs Poppler (pdftoppm) on the backend.';
    }

    if (/qpdf/i.test(message)) {
      return 'PDF password protection needs qpdf on the backend.';
    }

    if (/libreoffice|soffice/i.test(message)) {
      return 'This conversion needs LibreOffice on the backend.';
    }

    if (
      /CORS|Failed to fetch|NetworkError/i.test(
        message
      )
    ) {
      return 'The frontend could not reach the backend. Check the API proxy and backend health.';
    }

    if (/413|payload too large/i.test(message)) {
      return 'The file is too large for the backend request limit.';
    }

    if (/429/i.test(message)) {
      return 'Too many requests. Please wait a moment and try again.';
    }

    if (/500|502|503|504/i.test(message)) {
      return 'The backend failed while processing the file. Check the server logs.';
    }

    return message.slice(0, 400);
  };

  /* ============================================================
   * TOAST
   * ============================================================ */

  function toast(message, kind = 'ok') {
    const node = $('#toast');

    if (node) {
      node.textContent = message;

      node.className =
        `toast show ${
          kind === 'error'
            ? 'error'
            : kind === 'info'
            ? 'info'
            : ''
        }`;

      clearTimeout(toast.timer);

      toast.timer = setTimeout(() => {
        node.classList.remove('show');
      }, 3500);
    }

    const sr = $('#sr');

    if (sr) {
      sr.textContent = message;
    }
  }

  /* ============================================================
   * FILE VALIDATION
   * ============================================================ */

  function fileAccept(tool) {
    return tool.accept
      ? tool.accept
          .map((value) => `.${value}`)
          .join(',')
      : '';
  }

  function valid(incoming, tool) {
    const ok = [];
    const bad = [];

    for (const file of incoming) {
      const extension = ext(file.name);

      if (
        tool.accept &&
        !tool.accept.includes(extension)
      ) {
        bad.push(
          `${file.name}: unsupported file type`
        );
        continue;
      }

      if (!file.size) {
        bad.push(`${file.name}: empty file`);
        continue;
      }

      if (
        file.size >
        200 * 1024 * 1024
      ) {
        bad.push(
          `${file.name}: larger than 200 MB`
        );
        continue;
      }

      ok.push(file);
    }

    return { ok, bad };
  }

  /* ============================================================
   * SIDEBAR
   * ============================================================ */

  function renderNav() {
    const sidebar = $('#sidebar');

    if (!sidebar) return;

    sidebar.innerHTML = `
      <div class="brand-side">
        <img
          src="/images/logo.png"
          alt="KrazyBuy"
        >

        <div class="brand-copy">
          <strong>KrazyBuy</strong>
          <span>Document Workspace</span>
        </div>
      </div>

      <nav class="nav-scroll">

        <div class="nav-label">
          HOME
        </div>

        <button
          class="nav-item"
          data-nav="dashboard"
        >
          ${ico('home')}
          <span>Dashboard</span>
        </button>

        ${GROUPS.map(
          (group) => `
            <div class="nav-label">
              ${esc(group.toUpperCase())}
            </div>

            ${TOOLS
              .filter(
                (tool) =>
                  tool.group === group
              )
              .map(
                (tool) => `
                  <button
                    class="nav-item"
                    data-nav="${tool.id}"
                  >
                    ${ico(tool.icon)}
                    <span>
                      ${esc(tool.name)}
                    </span>
                  </button>
                `
              )
              .join('')}
          `
        ).join('')}

      </nav>

      <div class="side-foot">

        <div
          class="dot-row"
          id="serverDot"
        >
          <span class="dot"></span>
          <b>Checking server…</b>
        </div>

        <small>
          Files are sent only to the configured
          processing backend.
        </small>

      </div>
    `;
  }

  /* ============================================================
   * APPLICATION SHELL
   * ============================================================ */

  function shell() {
    const app = $('#app');

    if (!app) return;

    app.className = '';

    app.innerHTML = `
      <div class="shell">

        <aside
          class="sidebar"
          id="sidebar"
        ></aside>

        <div class="main">

          <header class="topbar">

            <button
              class="icon-btn mobile-only"
              id="menuBtn"
              aria-label="Menu"
            >
              ${ico('menu')}
            </button>

            <div class="mobile-brand">
              <img
                src="/images/logo.png"
                alt="KrazyBuy"
              >
              <span>KrazyBuy</span>
            </div>

            <div class="top-spacer"></div>

            <span
              class="pill"
              id="backendBadge"
            >
              Connecting…
            </span>

            <button
              class="icon-btn"
              id="healthBtn"
              aria-label="Refresh backend status"
            >
              ${ico('refresh')}
            </button>

            <div class="avatar">
              ME
            </div>

          </header>

          <main
            class="content"
            id="workspace"
            tabindex="-1"
          ></main>

        </div>

        <nav class="mobile-nav">

          <button data-nav="dashboard">
            ${ico('home')}
            <span>Home</span>
          </button>

          <button data-nav="pdf-image">
            ${ico('pdf')}
            <span>PDF</span>
          </button>

          <button data-nav="ppt-edit">
            ${ico('ppt')}
            <span>PPT</span>
          </button>

          <button data-nav="doc-edit">
            ${ico('doc')}
            <span>Docs</span>
          </button>

          <button id="moreBtn">
            ${ico('menu')}
            <span>More</span>
          </button>

        </nav>

      </div>

      <!-- GLOBAL OPERATION PROGRESS -->

      <div
        id="operationProgress"
        class="operation-progress"
        hidden
      >
        <div class="operation-progress-card">

          <div class="operation-progress-head">

            <div>
              <strong id="operationTitle">
                Preparing…
              </strong>

              <small id="operationSubtitle">
                Please wait
              </small>
            </div>

            <strong id="operationPercent">
              0%
            </strong>

          </div>

          <div
            class="operation-bar"
            aria-hidden="true"
          >
            <i
              id="operationBar"
              style="width:0%"
            ></i>
          </div>

          <div
            id="operationBlock"
            class="operation-block"
          >
            <span id="operationBlockText">
              ░░░░░░░░░░░░░░░░░░░░ 0%
            </span>
          </div>

        </div>
      </div>
    `;

    renderNav();

    $('#menuBtn')?.addEventListener(
      'click',
      () =>
        $('#sidebar')?.classList.toggle(
          'open'
        )
    );

    $('#moreBtn')?.addEventListener(
      'click',
      () =>
        $('#sidebar')?.classList.toggle(
          'open'
        )
    );

    $('#healthBtn')?.addEventListener(
      'click',
      health
    );
  }

  /* ============================================================
   * GLOBAL PROGRESS
   * ============================================================ */

  function showOperationProgress(
    title = 'Uploading…',
    subtitle = 'Preparing your files',
    percent = 0
  ) {
    const box =
      $('#operationProgress');

    if (!box) return;

    box.hidden = false;

    updateOperationProgress(
      title,
      subtitle,
      percent
    );
  }

  function updateOperationProgress(
    title,
    subtitle,
    percent
  ) {
    const safePercent = Math.max(
      0,
      Math.min(100, Number(percent) || 0)
    );

    const titleNode =
      $('#operationTitle');

    const subtitleNode =
      $('#operationSubtitle');

    const percentNode =
      $('#operationPercent');

    const bar =
      $('#operationBar');

    const block =
      $('#operationBlockText');

    if (titleNode) {
      titleNode.textContent = title;
    }

    if (subtitleNode) {
      subtitleNode.textContent =
        subtitle;
    }

    if (percentNode) {
      percentNode.textContent =
        `${safePercent}%`;
    }

    if (bar) {
      bar.style.width =
        `${safePercent}%`;
    }

    if (block) {
      const total = 20;

      const filled = Math.round(
        (safePercent / 100) * total
      );

      block.textContent =
        `${'█'.repeat(filled)}${'░'.repeat(
          total - filled
        )} ${safePercent}%`;
    }
  }

  function hideOperationProgress() {
    const box =
      $('#operationProgress');

    if (box) {
      box.hidden = true;
    }
  }

  /* ============================================================
   * BACKEND HEALTH
   * ============================================================ */

  async function health() {
    const badge =
      $('#backendBadge');

    const dot =
      $('#serverDot');

    if (badge) {
      badge.textContent =
        'Checking…';
    }

    try {
      const response =
        await fetch(
          api('/health'),
          {
            cache: 'no-store',
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ||
            `HTTP ${response.status}`
        );
      }

      state.server = json;

      if (badge) {
        badge.textContent =
          `Online · ${
            json.version || 'API'
          }`;

        badge.className =
          'pill pill-ok';
      }

      if (dot) {
        dot.classList.remove('off');

        dot.innerHTML = `
          <span class="dot"></span>
          <b>Backend online</b>
        `;
      }
    } catch (error) {
      state.server = null;

      if (badge) {
        badge.textContent =
          'Backend offline';

        badge.className =
          'pill pill-warn';
      }

      if (dot) {
        dot.classList.add('off');

        dot.innerHTML = `
          <span class="dot"></span>
          <b>Backend unavailable</b>
        `;
      }
    }
  }

  /* ============================================================
   * DASHBOARD
   * ============================================================ */

  function dashboard() {
    const workspace =
      $('#workspace');

    if (!workspace) return;

    const cards = TOOLS.map(
      (tool) => `
        <button
          class="tool-card"
          data-tool="${tool.id}"
        >

          <span class="tool-ico">
            ${ico(tool.icon)}
          </span>

          <h3>
            ${esc(tool.name)}
          </h3>

          <p>
            ${esc(tool.desc)}
          </p>

          <span class="tool-link">
            Open workflow
            ${ico('refresh')}
          </span>

        </button>
      `
    ).join('');

    workspace.innerHTML = `
      <section class="hero">

        <div>

          <div class="eyebrow">
            KRAZYBUY PRODUCTION WORKSPACE
          </div>

          <h1>
            Powerful document tools in
            <em>one warm workspace.</em>
          </h1>

          <p class="lede">
            Upload a file, configure your
            workflow and receive the generated
            file directly on your device.
          </p>

          <div
            class="btn-row"
            style="margin-top:18px"
          >

            <button
              class="btn btn--primary"
              data-tool="pdf-image"
            >
              ${ico('pdf')}
              PDF → Images
            </button>

            <button
              class="btn btn--soft"
              data-tool="pdf-edit"
            >
              ${ico('edit')}
              Edit PDF
            </button>

            <button
              class="btn"
              data-tool="ppt-edit"
            >
              ${ico('ppt')}
              Edit PPTX
            </button>

          </div>

          <div class="trust">
            <span>Real API calls</span>
            <span>Mobile responsive</span>
            <span>Local file workflow</span>
          </div>

        </div>

        <div class="hero-card">

          <span class="pill pill-dark">
            KRAZYBUY V1.2
          </span>

          <strong>
            Production-first frontend.
          </strong>

          <p>
            Every workflow maps to a real
            backend route.
          </p>

          <div class="stat-row">

            <div>
              <b>${TOOLS.length}</b>
              <small>workflows</small>
            </div>

            <div>
              <b>${GROUPS.length}</b>
              <small>families</small>
            </div>

            <div>
              <b>
                ${state.server ? 'ON' : '—'}
              </b>
              <small>backend</small>
            </div>

          </div>

        </div>

      </section>

      <div class="section-head">

        <div>
          <div class="eyebrow">
            WORKFLOWS
          </div>

          <h2>
            Choose a real tool
          </h2>
        </div>

        <span class="pill">
          ${TOOLS.length}
          API-backed tools
        </span>

      </div>

      <div class="tool-grid">
        ${cards}
      </div>
    `;
  }

  /* ============================================================
   * UPLOAD UI
   * ============================================================ */

  function uploadHTML(tool) {
    return `
      <div
        class="dropzone"
        id="dropzone"
        tabindex="0"
      >

        <div class="dz-orb">
          ${ico('upload')}
        </div>

        <div class="dz-title">
          ${
            tool.multiple
              ? 'Drop your files here'
              : 'Drop your file here'
          }
        </div>

        <div class="dz-hint">
          Drag and drop or browse from
          your device.
        </div>

        <div class="btn-row">

          <button
            class="btn btn--primary"
            id="browse"
          >
            ${ico('upload')}
            Browse files
          </button>

          ${
            tool.folder
              ? `
                <button
                  class="btn"
                  id="folder"
                >
                  ${ico('zip')}
                  Choose folder
                </button>
              `
              : ''
          }

        </div>

        <div class="dz-meta">
          ${
            tool.accept
              ? tool.accept
                  .map(
                    (value) => `.${value}`
                  )
                  .join(' · ')
              : 'Any supported file'
          }

          ·

          ${
            tool.multiple
              ? 'multiple files'
              : 'single file'
          }

          · max 200 MB each
        </div>

      </div>
    `;
  }

  /* ============================================================
   * FILE LIST
   * ============================================================ */

  function fileList(tool) {
    const selected =
      files();

    if (!selected.length) {
      return `
        <div class="note">
          No files selected yet.
        </div>
      `;
    }

    return `
      <div class="file-list">

        ${selected
          .map(
            (file, index) => `
              <div
                class="file-row"
                ${
                  tool.multiple
                    ? 'draggable="true"'
                    : ''
                }
                data-index="${index}"
              >

                <div
                  class="thumb"
                  data-thumb="${index}"
                >
                  ${
                    IMG.includes(
                      ext(file.name)
                    )
                      ? 'IMG'
                      : esc(
                          ext(
                            file.name
                          ) ||
                            'FILE'
                        ).toUpperCase()
                  }
                </div>

                <div class="file-meta">

                  <b
                    title="${esc(
                      file.name
                    )}"
                  >
                    ${esc(file.name)}
                  </b>

                  <span>
                    ${size(file.size)}

                    ${
                      file.webkitRelativePath
                        ? `
                          ·
                          ${esc(
                            file.webkitRelativePath
                          )}
                        `
                        : ''
                    }
                  </span>

                </div>

                <button
                  class="icon-btn icon-btn--bare"
                  data-remove="${index}"
                  aria-label="Remove ${esc(
                    file.name
                  )}"
                  title="Remove file"
                >
                  ${ico('trash')}
                </button>

              </div>
            `
          )
          .join('')}

      </div>

      <div
        class="btn-row"
        style="margin-top:10px"
      >

        <span class="pill">
          ${selected.length}
          file${
            selected.length > 1
              ? 's'
              : ''
          }
        </span>

        ${
          tool.multiple
            ? `
              <button
                class="btn btn--sm"
                id="addMore"
              >
                ${ico('plus')}
                Add more
              </button>
            `
            : ''
        }

        <button
          class="btn btn--sm"
          id="clearFiles"
        >
          ${ico('trash')}
          Clear all
        </button>

      </div>
    `;
  }

  /* ============================================================
   * TOOL FIELDS
   * ============================================================ */

  function fields(tool) {
    switch (tool.id) {
      case 'pdf-split':
        return `
          <div class="field">
            <label>
              Pages / ranges
            </label>

            <input
              id="ranges"
              placeholder="1-3,5,8-10"
            >
          </div>
        `;

      case 'pdf-edit':
        return `
          <div class="grid-2">

            <div class="field field--full">
              <label>
                Text to add
              </label>

              <input
                id="text"
                placeholder="Approved — internal copy"
              >
            </div>

            <div class="field">
              <label>
                Target page
              </label>

              <input
                id="page"
                type="number"
                min="1"
                value="1"
              >
            </div>

            <div class="field">
              <label>
                Font size
              </label>

              <input
                id="fontSize"
                type="number"
                min="6"
                max="200"
                value="18"
              >
            </div>

            <div class="field field--full">
              <label>
                Watermark
              </label>

              <input id="watermark">
            </div>

            <div class="field">
              <label>
                Rotate all pages
              </label>

              <select id="rotate">
                <option value="0">
                  No rotation
                </option>

                <option value="90">
                  90°
                </option>

                <option value="180">
                  180°
                </option>

                <option value="270">
                  270°
                </option>
              </select>
            </div>

            <label class="check">
              <input
                id="pageNumbers"
                type="checkbox"
              >

              Add page numbers
            </label>

          </div>
        `;

      case 'pdf-organize':
        return `
          <div class="toolbar">

            <button
              class="btn btn--sm"
              id="loadPages"
            >
              ${ico('refresh')}
              Load pages
            </button>

            <button
              class="btn btn--sm"
              id="selectAll"
            >
              Select all
            </button>

            <button
              class="btn btn--sm"
              id="selectNone"
            >
              Clear selection
            </button>

            <button
              class="btn btn--sm"
              id="rotateSelected"
            >
              ${ico('rotate')}
              Rotate
            </button>

            <button
              class="btn btn--sm"
              id="deleteSelected"
            >
              ${ico('trash')}
              Delete selected
            </button>

            <button
              class="btn btn--sm"
              id="restorePages"
            >
              Restore
            </button>

          </div>

          <div
            class="tile-strip"
            id="tiles"
          >
            <div class="empty">
              Load the PDF to see its real pages.
            </div>
          </div>
        `;

      case 'pdf-compress':
        return `
          <div class="field">
            <label>
              Compression
            </label>

            <select id="level">
              <option value="medium">
                Balanced
              </option>

              <option value="low">
                High quality
              </option>

              <option value="high">
                Smallest
              </option>
            </select>
          </div>
        `;

      case 'pdf-protect':
        return `
          <div class="field">
            <label>
              Password
            </label>

            <input
              id="password"
              type="password"
              minlength="6"
              placeholder="At least 6 characters"
            >
          </div>
        `;

      case 'pdf-image':
        return `
          <div class="field">
            <label>
              Output format
            </label>

            <select id="format">
              <option value="png">
                PNG
              </option>

              <option value="jpg">
                JPG
              </option>
            </select>
          </div>
        `;

      case 'ppt-create':
        return `
          <div class="grid-2">

            <div class="field">
              <label>Title</label>

              <input
                id="title"
                value="KrazyBuy Presentation"
              >
            </div>

            <div class="field">
              <label>Subtitle</label>

              <input
                id="subtitle"
                value="Created with KrazyBuy"
              >
            </div>

            <div class="field">
              <label>Slides</label>

              <input
                id="slides"
                type="number"
                min="1"
                max="100"
                value="5"
              >
            </div>

            <div class="field field--full">
              <label>Content</label>

              <textarea
                id="contentText"
                placeholder="One line per slide works well…"
              ></textarea>
            </div>

          </div>
        `;

      case 'ppt-edit':
        return `
          <div class="btn-row">

            <button
              class="btn btn--soft"
              id="inspectSlides"
            >
              ${ico('refresh')}
              Load slides
            </button>

          </div>

          <div
            id="slideEditor"
            class="editor-list"
          >
            <div class="empty">
              Load the deck to inspect
              its real slide text.
            </div>
          </div>

          <div class="note">
            Edit the loaded slide text above.
            KrazyBuy sends changed text
            replacements to the backend.
          </div>
        `;

      case 'doc-create':
        return `
          <div class="field">

            <label>
              Title
            </label>

            <input
              id="title"
              value="KrazyBuy Document"
            >

          </div>

          <div class="field">

            <label>
              Body
            </label>

            <textarea
              id="text"
              style="min-height:300px"
            ></textarea>

          </div>
        `;

      case 'doc-edit':
        return `
          <div class="btn-row">

            <button
              class="btn btn--soft"
              id="loadDoc"
            >
              ${ico('refresh')}
              Load text
            </button>

            <button
              class="btn"
              id="exportDocPdf"
            >
              ${ico('pdf')}
              Export PDF
            </button>

          </div>

          <div class="field">

            <label>
              Document text
            </label>

            <textarea
              id="docText"
              style="min-height:320px"
              placeholder="Load a DOCX first"
            ></textarea>

            <small id="docMeta">
              Not loaded.
            </small>

          </div>

          <div class="grid-2">

            <div class="field">
              <label>Find</label>
              <input id="find">
            </div>

            <div class="field">
              <label>Replace</label>
              <input id="replace">
            </div>

          </div>
        `;

      case 'xlsx-edit':
        return `
          <div class="btn-row">

            <button
              class="btn btn--soft"
              id="inspectXlsx"
            >
              ${ico('refresh')}
              Load workbook
            </button>

          </div>

          <div
            id="sheetEditor"
            style="margin-top:12px"
          >
            <div class="empty">
              Load the workbook to view
              the real sheet data.
            </div>
          </div>

          <div class="grid-2">

            <div class="field">
              <label>
                Active sheet
              </label>

              <input
                id="sheet"
                value="Sheet1"
              >
            </div>

            <div class="field">
              <label>
                Edited cells JSON
              </label>

              <textarea
                id="cells"
                placeholder='{"A1":"Updated"}'
              ></textarea>
            </div>

          </div>
        `;

      case 'img-edit':
      case 'img-convert':
      case 'img-resize':
        return `
          <div class="grid-2">

            <div class="field">
              <label>Width</label>
              <input
                id="width"
                type="number"
                min="1"
              >
            </div>

            <div class="field">
              <label>Height</label>
              <input
                id="height"
                type="number"
                min="1"
              >
            </div>

            <div class="field">
              <label>Format</label>

              <select id="format">
                <option value="webp">
                  WebP
                </option>

                <option value="png">
                  PNG
                </option>

                <option value="jpg">
                  JPG
                </option>
              </select>
            </div>

            <div class="field">
              <label>Quality</label>

              <input
                id="quality"
                type="number"
                min="1"
                max="100"
                value="82"
              >
            </div>

            <div class="field">
              <label>Degrees</label>

              <input
                id="degrees"
                type="number"
                value="90"
              >
            </div>

            <div class="field">
              <label>
                Flip horizontal
              </label>

              <input
                id="horizontal"
                type="checkbox"
              >
            </div>

            <div class="field field--full">
              <label>
                Watermark
              </label>

              <input id="watermark">
            </div>

          </div>

          <div
            id="imagePreview"
            class="preview"
          >
            <div class="empty">
              Select an image to preview it.
            </div>
          </div>
        `;

      case 'img-crop':
        return `
          <div class="grid-2">

            <div class="field">
              <label>
                Crop width
              </label>

              <input
                id="width"
                type="number"
                min="1"
              >
            </div>

            <div class="field">
              <label>
                Crop height
              </label>

              <input
                id="height"
                type="number"
                min="1"
              >
            </div>

            <div class="field">
              <label>Left</label>

              <input
                id="left"
                type="number"
                min="0"
                value="0"
              >
            </div>

            <div class="field">
              <label>Top</label>

              <input
                id="top"
                type="number"
                min="0"
                value="0"
              >
            </div>

          </div>

          <div
            id="imagePreview"
            class="preview"
          >
            <div class="empty">
              Select an image to preview it.
            </div>
          </div>
        `;

      case 'img-rotate':
        return `
          <div class="field">

            <label>
              Degrees
            </label>

            <input
              id="degrees"
              type="number"
              value="90"
              step="90"
            >

          </div>

          <div
            id="imagePreview"
            class="preview"
          >
            <div class="empty">
              Select an image to preview it.
            </div>
          </div>
        `;

      case 'img-flip':
        return `
          <div class="field">

            <label>
              Direction
            </label>

            <select id="horizontal">

              <option value="1">
                Horizontal
              </option>

              <option value="0">
                Vertical
              </option>

            </select>

          </div>
        `;

      case 'img-compress':
        return `
          <div class="grid-2">

            <div class="field">
              <label>
                Quality
              </label>

              <input
                id="quality"
                type="number"
                min="1"
                max="100"
                value="80"
              >
            </div>

            <div class="field">
              <label>
                Format
              </label>

              <select id="format">

                <option value="webp">
                  WebP
                </option>

                <option value="jpg">
                  JPG
                </option>

                <option value="png">
                  PNG
                </option>

              </select>
            </div>

          </div>

          <div
            id="imagePreview"
            class="preview"
          >
            <div class="empty">
              Select an image to preview it.
            </div>
          </div>
        `;

      case 'img-watermark':
        return `
          <div class="grid-2">

            <div class="field">
              <label>
                Quality
              </label>

              <input
                id="quality"
                type="number"
                min="1"
                max="100"
                value="80"
              >
            </div>

            <div class="field">
              <label>
                Format
              </label>

              <select id="format">

                <option value="webp">
                  WebP
                </option>

                <option value="jpg">
                  JPG
                </option>

                <option value="png">
                  PNG
                </option>

              </select>
            </div>

            <div class="field field--full">
              <label>
                Watermark text
              </label>

              <input id="watermark">
            </div>

          </div>
        `;

      case 'zip-create':
        return `
          <div class="field">

            <label>
              Archive name
            </label>

            <input
              id="zipName"
              value="krazybuy-files.zip"
            >

          </div>

          <div class="note">
            Choose a folder to preserve
            nested folder paths where supported.
          </div>
        `;

      default:
        return '';
    }
  }

  /* ============================================================
   * ACTION LABELS
   * ============================================================ */

  function actionLabel(tool) {
    const labels = {
      'pdf-merge': 'Merge PDFs',
      'pdf-split': 'Extract pages',
      'pdf-organize': 'Apply page changes',
      'pdf-edit': 'Apply PDF edits',
      'pdf-compress': 'Compress PDF',
      'pdf-protect': 'Protect PDF',
      'pdf-image': 'Render pages',
      'images-pdf': 'Create PDF',

      'ppt-edit': 'Save presentation',
      'ppt-create': 'Create PPTX',
      'ppt-pdf': 'Convert to PDF',
      'ppt-images': 'Render slides',
      'images-ppt': 'Create PPTX',
      'pdf-ppt': 'Create PPTX',

      'doc-edit': 'Save DOCX',
      'doc-create': 'Create DOCX',
      'doc-pdf': 'Convert to PDF',
      'doc-txt': 'Export TXT',
      'pdf-docx': 'Convert to DOCX',

      'xlsx-edit': 'Save workbook',
      'csv-xlsx': 'Convert XLSX',
      'xlsx-csv': 'Export CSV',
      'xlsx-pdf': 'Export PDF',

      'img-edit': 'Process image',
      'img-convert': 'Convert image',
      'img-resize': 'Resize image',
      'img-crop': 'Crop image',
      'img-rotate': 'Rotate image',
      'img-flip': 'Flip image',
      'img-compress': 'Compress image',
      'img-watermark': 'Watermark image',

      'zip-create': 'Create ZIP',
    };

    return (
      labels[tool.id] ||
      'Run'
    );
  }

  /* ============================================================
   * SIDE INFORMATION
   * ============================================================ */

  function aside(tool) {
    return `
      <aside class="aside">

        <div class="panel">

          <span class="pill pill-ok">
            ${ico('check')}
            API connected
          </span>

          <p style="margin-top:8px">
            Your selected file is sent to
            the configured processing backend.
            The generated result is then
            downloaded to your device.
          </p>

        </div>

        <div class="panel">

          <h3>
            Workflow
          </h3>

          <ul>
            <li>
              Select your file(s).
            </li>

            <li>
              Configure the options.
            </li>

            <li>
              Run the operation.
            </li>

            <li>
              Wait for processing.
            </li>

            <li>
              Download the result.
            </li>
          </ul>

        </div>

      </aside>
    `;
  }

  /* ============================================================
   * TOOL VIEW
   * ============================================================ */

  function toolView(id) {
    const tool = byId(id);

    if (!tool) {
      dashboard();
      return;
    }

    state.tool = id;
    state.scratch = {};

    const selected =
      files();

    $('#workspace').innerHTML = `
      <div class="page-top">

        <div>

          <div class="eyebrow">
            ${esc(
              tool.group.toUpperCase()
            )}
            WORKFLOW
          </div>

          <h1 class="page-title">
            ${esc(tool.name)}
          </h1>

          <p class="lede">
            ${esc(tool.desc)}
          </p>

        </div>

        <div class="btn-row">

          <button
            class="btn btn--soft"
            data-nav="dashboard"
          >
            Dashboard
          </button>

        </div>

      </div>

      <div class="work-layout">

        <section class="panel">

          ${
            tool.accept !== null ||
            tool.multiple ||
            tool.folder
              ? uploadHTML(tool)
              : ''
          }

          <div id="fileArea">
            ${
              tool.accept !== null ||
              tool.multiple ||
              tool.folder
                ? fileList(tool)
                : ''
            }
          </div>

          <div id="fields">
            ${fields(tool)}
          </div>

          <div class="sticky-cta">

            <button
              class="btn btn--primary"
              id="run"
            >
              ${ico('download')}
              ${actionLabel(tool)}
            </button>

          </div>

          <div
            id="phase"
            class="phase"
            hidden
          ></div>

        </section>

        ${aside(tool)}

      </div>
    `;

    bindTool(tool);

    if (selected.length) {
      refreshFilesUI(tool);
    }
  }

  /* ============================================================
   * TOOL BINDING
   * ============================================================ */

  function bindTool(tool) {
    const browse =
      $('#browse');

    const drop =
      $('#dropzone');

    const folder =
      $('#folder');

    if (browse) {
      browse.onclick = () =>
        choose(tool, false);
    }

    if (folder) {
      folder.onclick = () =>
        choose(tool, true);
    }

    if (drop) {
      drop.addEventListener(
        'click',
        (event) => {
          if (
            event.target.closest(
              'button'
            )
          ) {
            return;
          }

          choose(tool, false);
        }
      );

      drop.addEventListener(
        'keydown',
        (event) => {
          if (
            event.key === 'Enter' ||
            event.key === ' '
          ) {
            event.preventDefault();
            choose(tool, false);
          }
        }
      );

      [
        'dragenter',
        'dragover',
      ].forEach((eventName) => {
        drop.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();
            drop.classList.add(
              'is-drag'
            );
          }
        );
      });

      [
        'dragleave',
        'drop',
      ].forEach((eventName) => {
        drop.addEventListener(
          eventName,
          (event) => {
            event.preventDefault();

            drop.classList.remove(
              'is-drag'
            );
          }
        );
      });

      drop.addEventListener(
        'drop',
        (event) => {
          const incoming = [
            ...event.dataTransfer.files,
          ];

          addFiles(
            tool,
            incoming
          );
        }
      );
    }

    $('#run')?.addEventListener(
      'click',
      () => runTool(tool)
    );

    $('#clearFiles')?.addEventListener(
      'click',
      () => {
        setFiles([]);
        refreshFilesUI(tool);
      }
    );

    $('#addMore')?.addEventListener(
      'click',
      () =>
        choose(
          tool,
          false,
          true
        )
    );

    $('#inspectSlides')?.addEventListener(
      'click',
      loadPpt
    );

    $('#loadDoc')?.addEventListener(
      'click',
      loadDoc
    );

    $('#exportDocPdf')?.addEventListener(
      'click',
      exportDocPdf
    );

    $('#inspectXlsx')?.addEventListener(
      'click',
      loadXlsx
    );

    $('#loadPages')?.addEventListener(
      'click',
      loadPdfPages
    );

    $('#selectAll')?.addEventListener(
      'click',
      () => {
        state.scratch.pages?.forEach(
          (page) => {
            if (!page.removed) {
              page.sel = true;
            }
          }
        );

        drawTiles();
      }
    );

    $('#selectNone')?.addEventListener(
      'click',
      () => {
        state.scratch.pages?.forEach(
          (page) => {
            page.sel = false;
          }
        );

        drawTiles();
      }
    );

    $('#rotateSelected')?.addEventListener(
      'click',
      () => {
        state.scratch.pages
          ?.filter(
            (page) =>
              page.sel &&
              !page.removed
          )
          .forEach(
            (page) => {
              page.rot =
                (page.rot + 90) %
                360;
            }
          );

        drawTiles();
      }
    );

    $('#deleteSelected')?.addEventListener(
      'click',
      () => {
        state.scratch.pages
          ?.filter(
            (page) =>
              page.sel &&
              !page.removed
          )
          .forEach(
            (page) => {
              page.removed = true;
              page.sel = false;
            }
          );

        drawTiles();
      }
    );

    $('#restorePages')?.addEventListener(
      'click',
      () => {
        state.scratch.pages?.forEach(
          (page) => {
            page.removed = false;
          }
        );

        drawTiles();
      }
    );

    if (
      IMG.some(
        (value) =>
          value ===
          tool.accept?.[0]
      )
    ) {
      previewImage();
    }
  }

  /* ============================================================
   * FILE CHOOSER
   * ============================================================ */

  function choose(
    tool,
    folder = false,
    more = false
  ) {
    const input =
      document.createElement(
        'input'
      );

    input.type = 'file';

    input.accept =
      fileAccept(tool);

    input.multiple =
      Boolean(
        tool.multiple ||
          more ||
          folder
      );

    if (folder) {
      input.webkitdirectory = true;
      input.setAttribute(
        'webkitdirectory',
        ''
      );
    }

    input.onchange = () => {
      const incoming = [
        ...input.files,
      ];

      addFiles(
        tool,
        incoming
      );

      input.remove();
    };

    document.body.appendChild(
      input
    );

    input.click();
  }

  /* ============================================================
   * ADD FILES
   * ============================================================ */

  function addFiles(
    tool,
    incoming
  ) {
    if (!incoming.length) {
      return;
    }

    const validation =
      valid(
        incoming,
        tool
      );

    let next;

    if (tool.multiple) {
      next = [
        ...files(),
        ...validation.ok,
      ];
    } else {
      next =
        validation.ok.slice(-1);
    }

    const seen =
      new Set();

    next =
      next.filter(
        (file) => {
          const key =
            `${file.name}:${file.size}:${file.lastModified}`;

          if (
            seen.has(key)
          ) {
            return false;
          }

          seen.add(key);

          return true;
        }
      );

    setFiles(next);

    refreshFilesUI(tool);

    if (validation.bad.length) {
      toast(
        validation.bad[0],
        'error'
      );
    }

    if (validation.ok.length) {
      toast(
        `${validation.ok.length} file${
          validation.ok.length > 1
            ? 's'
            : ''
        } added`
      );
    }

    if (
      tool.id.startsWith('img-')
    ) {
      previewImage();
    }
  }

  /* ============================================================
   * FILE LIST REFRESH
   * ============================================================ */

  function refreshFilesUI(tool) {
    const area =
      $('#fileArea');

    if (!area) return;

    area.innerHTML =
      fileList(tool);

    $$('[data-remove]').forEach(
      (button) => {
        button.onclick = () => {
          const index =
            Number(
              button.dataset
                .remove
            );

          const next =
            files().slice();

          next.splice(
            index,
            1
          );

          setFiles(next);

          refreshFilesUI(tool);

          toast(
            'File removed'
          );
        };
      }
    );

    files().forEach(
      (file, index) => {
        if (
          !IMG.includes(
            ext(file.name)
          )
        ) {
          return;
        }

        const slot =
          $(
            `[data-thumb="${index}"]`
          );

        if (!slot) return;

        const url =
          URL.createObjectURL(
            file
          );

        slot.innerHTML = `
          <img
            src="${url}"
            alt=""
          >
        `;

        slot
          .querySelector('img')
          .addEventListener(
            'load',
            () =>
              URL.revokeObjectURL(
                url
              )
          );
      }
    );
  }

  /* ============================================================
   * PHASE STATUS
   * ============================================================ */

  function phase(
    label,
    kind = 'busy',
    percent = null
  ) {
    const node =
      $('#phase');

    if (!node) return;

    node.hidden = false;

    node.className =
      `phase ${
        kind === 'ok'
          ? 'ok'
          : kind === 'error'
          ? 'error'
          : ''
      }`;

    node.innerHTML = `
      <div class="phase-top">

        ${ico(
          kind === 'ok'
            ? 'check'
            : kind === 'error'
            ? 'alert'
            : 'refresh'
        )}

        <span>
          ${esc(label)}
        </span>

      </div>

      ${
        kind === 'busy'
          ? `
            <div class="progress">

              <i
                style="width:${
                  percent == null
                    ? 38
                    : percent
                }%"
              ></i>

            </div>
          `
          : ''
      }
    `;
  }

  /* ============================================================
   * XHR REQUEST
   *
   * IMPORTANT:
   * Upload progress is real XMLHttpRequest
   * progress, not fake timer progress.
   * ============================================================ */

  async function request(
    path,
    body,
    expect = 'blob',
    callbacks = {}
  ) {
    return new Promise(
      (resolve, reject) => {
        const xhr =
          new XMLHttpRequest();

        xhr.open(
          'POST',
          api(path),
          true
        );

        xhr.responseType =
          'blob';

        xhr.timeout =
          cfg.requestTimeoutMs;

        /* -----------------------------
         * UPLOAD PROGRESS
         * ----------------------------- */

        xhr.upload.onprogress =
          (event) => {
            if (
              event.lengthComputable
            ) {
              const percent =
                Math.round(
                  (event.loaded /
                    event.total) *
                    100
                );

              callbacks.onUpload?.(
                percent,
                event.loaded,
                event.total
              );
            }
          };

        /* -----------------------------
         * DOWNLOAD / RESPONSE PROGRESS
         * ----------------------------- */

        xhr.onprogress =
          (event) => {
            if (
              event.lengthComputable
            ) {
              const percent =
                Math.round(
                  (event.loaded /
                    event.total) *
                    100
                );

              callbacks.onDownload?.(
                percent,
                event.loaded,
                event.total
              );
            }
          };

        /* -----------------------------
         * COMPLETE
         * ----------------------------- */

        xhr.onload = async () => {
          const blob =
            xhr.response instanceof Blob
              ? xhr.response
              : new Blob([
                  xhr.response ||
                    '',
                ]);

          if (
            xhr.status < 200 ||
            xhr.status >= 300
          ) {
            let message =
              `Request failed (${xhr.status})`;

            try {
              const text =
                await blob.text();

              try {
                const json =
                  JSON.parse(text);

                message =
                  json.error ||
                  json.message ||
                  message;
              } catch {
                if (
                  text.trim()
                ) {
                  message =
                    text.trim();
                }
              }
            } catch {}

            reject(
              new Error(
                human(message)
              )
            );

            return;
          }

          /* -----------------------------
           * JSON RESPONSE
           * ----------------------------- */

          if (
            expect === 'json'
          ) {
            try {
              const text =
                await blob.text();

              resolve(
                JSON.parse(text)
              );
            } catch {
              reject(
                new Error(
                  'Backend returned invalid JSON.'
                )
              );
            }

            return;
          }

          /* -----------------------------
           * OUTPUT FILENAME
           * ----------------------------- */

          const disposition =
            xhr.getResponseHeader(
              'content-disposition'
            ) || '';

          let filename =
            'krazybuy-output.bin';

          const utfMatch =
            disposition.match(
              /filename\*=UTF-8''([^;]+)/i
            );

          const normalMatch =
            disposition.match(
              /filename="?([^";]+)"?/i
            );

          try {
            if (utfMatch) {
              filename =
                decodeURIComponent(
                  utfMatch[1]
                );
            } else if (
              normalMatch
            ) {
              filename =
                normalMatch[1];
            }
          } catch {}

          resolve({
            blob,
            name: filename,
          });
        };

        /* -----------------------------
         * NETWORK ERROR
         * ----------------------------- */

        xhr.onerror = () => {
          reject(
            new Error(
              'Could not reach the backend API.'
            )
          );
        };

        /* -----------------------------
         * TIMEOUT
         * ----------------------------- */

        xhr.ontimeout = () => {
          reject(
            new Error(
              'The backend took too long to respond.'
            )
          );
        };

        /* -----------------------------
         * ABORT
         * ----------------------------- */

        xhr.onabort = () => {
          reject(
            new Error(
              'Operation cancelled.'
            )
          );
        };

        try {
          xhr.send(body);
        } catch (error) {
          reject(error);
        }
      }
    );
  }

  /* ============================================================
   * SAVE DOWNLOAD
   * ============================================================ */

  function save(result) {
    const url =
      URL.createObjectURL(
        result.blob
      );

    const anchor =
      document.createElement(
        'a'
      );

    anchor.href = url;

    anchor.download =
      result.name ||
      'krazybuy-output.bin';

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      8000
    );
  }

  /* ============================================================
   * FORM DATA HELPERS
   * ============================================================ */

  function fdOne(file) {
    const form =
      new FormData();

    form.append(
      'file',
      file,
      file.name
    );

    return form;
  }

  /* ============================================================
   * MAIN TOOL EXECUTION
   * ============================================================ */

  async function runTool(tool) {
    if (state.busy) {
      return;
    }

    try {
      const selected =
        files();

      /* -----------------------------
       * VALIDATE
       * ----------------------------- */

      if (
        tool.id !== 'ppt-create' &&
        tool.id !== 'doc-create' &&
        !selected.length
      ) {
        throw new Error(
          `Select ${
            tool.multiple
              ? 'at least one file'
              : 'a file'
          } first.`
        );
      }

      state.busy = true;

      const runButton =
        $('#run');

      if (runButton) {
        runButton.disabled =
          true;
      }

      /* -----------------------------
       * INITIAL PROGRESS
       * ----------------------------- */

      showOperationProgress(
        'Preparing…',
        'Preparing your files',
        0
      );

      phase(
        'Preparing…',
        'busy',
        0
      );

      let form;

      let path =
        tool.endpoint;

      /* -----------------------------
       * CREATE PPT
       * ----------------------------- */

      if (
        tool.id === 'ppt-create'
      ) {
        form =
          new FormData();

        form.append(
          'title',
          $('#title')?.value ||
            ''
        );

        form.append(
          'subtitle',
          $('#subtitle')?.value ||
            ''
        );

        form.append(
          'slides',
          $('#slides')?.value ||
            '5'
        );

        form.append(
          'content',
          $('#contentText')
            ?.value || ''
        );
      }

      /* -----------------------------
       * CREATE DOC
       * ----------------------------- */

      else if (
        tool.id === 'doc-create'
      ) {
        form =
          new URLSearchParams({
            title:
              $('#title')
                ?.value || '',
            text:
              $('#text')
                ?.value || '',
          });
      }

      /* -----------------------------
       * MULTIPLE FILES
       * ----------------------------- */

      else if (
        tool.multiple
      ) {
        form =
          new FormData();

        selected.forEach(
          (file) => {
            form.append(
              'files',
              file,
              file.name
            );
          }
        );

        if (
          tool.id ===
          'zip-create'
        ) {
          form.append(
            'relativePaths',
            JSON.stringify(
              selected.map(
                (file) =>
                  file.webkitRelativePath ||
                  file.name
              )
            )
          );

          form.append(
            'archiveName',
            $('#zipName')
              ?.value ||
              'krazybuy-files.zip'
          );
        }
      }

      /* -----------------------------
       * SINGLE FILE
       * ----------------------------- */

      else {
        form =
          fdOne(
            selected[0]
          );
      }

      /* -----------------------------
       * PDF SPLIT
       * ----------------------------- */

      if (
        tool.id ===
        'pdf-split'
      ) {
        form.append(
          'ranges',
          $('#ranges')
            ?.value || ''
        );
      }

      /* -----------------------------
       * PDF EDIT
       * ----------------------------- */

      if (
        tool.id ===
        'pdf-edit'
      ) {
        [
          'text',
          'page',
          'fontSize',
          'watermark',
          'rotate',
        ].forEach(
          (key) => {
            form.append(
              key,
              $(`#${key}`)
                ?.value || ''
            );
          }
        );

        form.append(
          'pageNumbers',
          String(
            $('#pageNumbers')
              ?.checked ||
              false
          )
        );

        form.append(
          'deletePages',
          ''
        );

        form.append(
          'reorder',
          '[]'
        );
      }

      /* -----------------------------
       * PDF ORGANIZE
       * ----------------------------- */

      if (
        tool.id ===
        'pdf-organize'
      ) {
        const pages =
          state.scratch
            .pages || [];

        if (!pages.length) {
          throw new Error(
            'Load the PDF pages first.'
          );
        }

        const kept =
          pages.filter(
            (page) =>
              !page.removed
          );

        if (!kept.length) {
          throw new Error(
            'At least one page must remain.'
          );
        }

        form.append(
          'deletePages',
          pages
            .filter(
              (page) =>
                page.removed
            )
            .map(
              (page) =>
                page.src
            )
            .join(',')
        );

        form.append(
          'reorder',
          JSON.stringify(
            kept.map(
              (page) =>
                page.src
            )
          )
        );

        const rotations =
          new Set(
            kept.map(
              (page) =>
                page.rot
            )
          );

        form.append(
          'rotate',
          String(
            rotations.size === 1
              ? [
                  ...rotations,
                ][0]
              : 0
          )
        );

        form.append(
          'text',
          ''
        );

        form.append(
          'watermark',
          ''
        );

        form.append(
          'pageNumbers',
          'false'
        );
      }

      /* -----------------------------
       * PDF COMPRESS
       * ----------------------------- */

      if (
        tool.id ===
        'pdf-compress'
      ) {
        form.append(
          'level',
          $('#level')
            ?.value ||
            'medium'
        );
      }

      /* -----------------------------
       * PDF PROTECT
       * ----------------------------- */

      if (
        tool.id ===
        'pdf-protect'
      ) {
        const password =
          $('#password')
            ?.value || '';

        if (
          password.length <
          6
        ) {
          throw new Error(
            'Password must contain at least 6 characters.'
          );
        }

        form.append(
          'password',
          password
        );
      }

      /* -----------------------------
       * PDF TO IMAGE
       * ----------------------------- */

      if (
        tool.id ===
        'pdf-image'
      ) {
        form.append(
          'format',
          $('#format')
            ?.value ||
            'png'
        );
      }

      /* -----------------------------
       * PPT EDIT
       * ----------------------------- */

      if (
        tool.id ===
        'ppt-edit'
      ) {
        const replacements =
          {};

        $$(
          '[data-slide-editor]'
        ).forEach(
          (element) => {
            const index =
              Number(
                element.dataset
                  .slideEditor
              );

            const slide =
              state.scratch
                .deck?.[
                index
              ];

            if (
              slide &&
              element.value !==
                slide.orig &&
              slide.orig
            ) {
              replacements[
                slide.orig
              ] =
                element.value;
            }
          }
        );

        form.append(
          'textReplacements',
          JSON.stringify(
            replacements
          )
        );

        form.append(
          'deleteSlides',
          ''
        );

        form.append(
          'reorderSlides',
          ''
        );

        form.append(
          'duplicateSlide',
          ''
        );

        form.append(
          'addSlide',
          'false'
        );
      }

      /* -----------------------------
       * DOC EDIT
       * ----------------------------- */

      if (
        tool.id ===
        'doc-edit'
      ) {
        form.append(
          'find',
          $('#find')
            ?.value || ''
        );

        form.append(
          'replace',
          $('#replace')
            ?.value || ''
        );

        form.append(
          'title',
          'KrazyBuy Edited Document'
        );
      }

      /* -----------------------------
       * XLSX EDIT
       * ----------------------------- */

      if (
        tool.id ===
        'xlsx-edit'
      ) {
        form.append(
          'sheet',
          $('#sheet')
            ?.value ||
            'Sheet1'
        );

        form.append(
          'cells',
          $('#cells')
            ?.value ||
            '{}'
        );
      }

      /* -----------------------------
       * IMAGE OPTIONS
       * ----------------------------- */

      if (
        tool.id.startsWith(
          'img-'
        )
      ) {
        [
          'width',
          'height',
          'left',
          'top',
          'degrees',
          'quality',
          'format',
        ].forEach(
          (key) => {
            const element =
              $(`#${key}`);

            if (
              element &&
              element.value !==
                ''
            ) {
              form.append(
                key,
                element.value
              );
            }
          }
        );

        const horizontal =
          $('#horizontal');

        if (
          horizontal
        ) {
          form.append(
            'horizontal',
            horizontal.type ===
              'checkbox'
              ? horizontal.checked
                ? '1'
                : '0'
              : horizontal.value
          );
        }

        const watermark =
          $('#watermark');

        if (
          watermark
        ) {
          form.append(
            'watermark',
            watermark.value
          );
        }
      }

      /* -----------------------------
       * IMAGE ENDPOINTS
       * ----------------------------- */

      if (
        tool.id ===
        'img-rotate'
      ) {
        path =
          '/image/rotate';
      }

      if (
        tool.id ===
        'img-flip'
      ) {
        path =
          '/image/flip';
      }

      if (
        tool.id ===
        'img-crop'
      ) {
        path =
          '/image/crop';
      }

      if (
        tool.id ===
        'img-resize'
      ) {
        path =
          '/image/resize';
      }

      if (
        tool.id ===
        'img-watermark'
      ) {
        path =
          '/image/watermark';
      }

      /* ========================================================
       * REAL REQUEST
       * ======================================================== */

      const result =
        await request(
          path,
          form,
          'blob',
          {
            /* -----------------------
             * UPLOAD
             * ----------------------- */

            onUpload: (
              percent,
              loaded,
              total
            ) => {
              const fileText =
                total
                  ? `${size(
                      loaded
                    )} / ${size(
                      total
                    )}`
                  : 'Uploading files…';

              showOperationProgress(
                'Uploading files…',
                fileText,
                percent
              );

              phase(
                `Uploading… ${percent}%`,
                'busy',
                percent
              );
            },

            /* -----------------------
             * BACKEND RESPONSE
             * ----------------------- */

            onDownload: (
              percent
            ) => {
              showOperationProgress(
                'Receiving result…',
                'Downloading generated file',
                percent
              );

              phase(
                `Receiving result… ${percent}%`,
                'busy',
                percent
              );
            },
          }
        );

      /* ========================================================
       * SUCCESS
       * ======================================================== */

      showOperationProgress(
        'Completed',
        'Preparing download',
        100
      );

      phase(
        'Operation completed. Preparing download…',
        'busy',
        100
      );

      save(result);

      phase(
        `Done — ${result.name} downloaded.`,
        'ok'
      );

      toast(
        `Downloaded ${result.name}`
      );

      setTimeout(
        hideOperationProgress,
        1200
      );
    } catch (error) {
      const message =
        human(error);

      phase(
        message,
        'error'
      );

      showOperationProgress(
        'Operation failed',
        message,
        100
      );

      toast(
        message,
        'error'
      );

      setTimeout(
        hideOperationProgress,
        2500
      );
    } finally {
      state.busy = false;

      const runButton =
        $('#run');

      if (runButton) {
        runButton.disabled =
          false;
      }
    }
  }

  /* ============================================================
   * PPT INSPECT
   * ============================================================ */

  async function loadPpt() {
    const selected =
      files();

    if (!selected.length) {
      toast(
        'Select a PPTX first.',
        'error'
      );

      return;
    }

    try {
      phase(
        'Reading presentation…'
      );

      const result =
        await request(
          '/ppt/inspect',
          fdOne(
            selected[0]
          ),
          'json'
        );

      const items =
        result?.data?.items ||
        result?.items ||
        [];

      state.scratch.deck =
        items.map(
          (item) => ({
            orig:
              item.text || '',
            text:
              item.text || '',
          })
        );

      const editor =
        $('#slideEditor');

      if (!editor) return;

      editor.innerHTML =
        state.scratch.deck
          .length
          ? state.scratch.deck
              .map(
                (slide, index) => `
                  <div
                    class="slide-row"
                  >

                    <b>
                      Slide
                      ${index + 1}
                    </b>

                    <textarea
                      data-slide-editor="${index}"
                    >${esc(
                      slide.text
                    )}</textarea>

                  </div>
                `
              )
              .join('')
          : `
              <div class="empty">
                No extractable slide text
                was returned by the backend.
              </div>
            `;

      phase(
        `Loaded ${
          state.scratch.deck.length
        } slide${
          state.scratch.deck.length ===
          1
            ? ''
            : 's'
        }.`,
        'ok'
      );
    } catch (error) {
      phase(
        human(error),
        'error'
      );
    }
  }

  /* ============================================================
   * DOC LOAD
   * ============================================================ */

  async function loadDoc() {
    const file =
      files()[0];

    if (!file) {
      toast(
        'Select a DOCX first.',
        'error'
      );

      return;
    }

    try {
      phase(
        'Reading DOCX…'
      );

      const result =
        await request(
          '/documents/read',
          fdOne(file),
          'json'
        );

      const text =
        result?.text ??
        result?.data?.text ??
        '';

      const textarea =
        $('#docText');

      if (textarea) {
        textarea.value =
          text;
      }

      const meta =
        $('#docMeta');

      if (meta) {
        meta.textContent =
          `${text.length.toLocaleString()} characters`;
      }

      phase(
        'Document loaded.',
        'ok'
      );
    } catch (error) {
      phase(
        human(error),
        'error'
      );
    }
  }

  /* ============================================================
   * DOC → PDF
   * ============================================================ */

  async function exportDocPdf() {
    const text =
      $('#docText')
        ?.value || '';

    if (!text.trim()) {
      toast(
        'Load or enter document text first.',
        'error'
      );

      return;
    }

    try {
      const form =
        new URLSearchParams({
          text,
          title:
            'KrazyBuy Document',
        });

      showOperationProgress(
        'Preparing PDF…',
        'Rendering document',
        0
      );

      phase(
        'Rendering PDF…'
      );

      const result =
        await request(
          '/documents/text-to-pdf',
          form,
          'blob',
          {
            onUpload: (
              percent
            ) => {
              showOperationProgress(
                'Uploading document…',
                'Sending document',
                percent
              );
            },
          }
        );

      save(result);

      phase(
        `Done — ${result.name} downloaded.`,
        'ok'
      );

      toast(
        `Downloaded ${result.name}`
      );

      hideOperationProgress();
    } catch (error) {
      const message =
        human(error);

      phase(
        message,
        'error'
      );

      toast(
        message,
        'error'
      );

      hideOperationProgress();
    }
  }

  /* ============================================================
   * XLSX INSPECT
   * ============================================================ */

  async function loadXlsx() {
    const file =
      files()[0];

    if (!file) {
      toast(
        'Select an XLSX first.',
        'error'
      );

      return;
    }

    try {
      phase(
        'Reading workbook…'
      );

      const result =
        await request(
          '/xlsx/inspect',
          fdOne(file),
          'json'
        );

      const worksheets =
        result?.data?.worksheets ||
        result?.worksheets ||
        [];

      const editor =
        $('#sheetEditor');

      if (!editor) return;

      editor.innerHTML =
        worksheets.length
          ? worksheets
              .map(
                (sheet, index) => {
                  const rows =
                    (
                      sheet.rows ||
                      []
                    ).map(
                      (row) =>
                        Array.isArray(
                          row
                        )
                          ? row
                          : row.cells ||
                            []
                    );

                  return `
                    <div class="note">
                      <b>
                        ${esc(
                          sheet.title ||
                            `Sheet ${
                              index + 1
                            }`
                        )}
                      </b>
                    </div>

                    <div class="sheet-wrap">

                      <table>

                        <tbody>

                          ${rows
                            .slice(
                              0,
                              30
                            )
                            .map(
                              (
                                row
                              ) => `
                                <tr>

                                  ${row
                                    .slice(
                                      0,
                                      20
                                    )
                                    .map(
                                      (
                                        cell
                                      ) => `
                                        <td>
                                          <input
                                            value="${esc(
                                              cell ??
                                                ''
                                            )}"
                                          >
                                        </td>
                                      `
                                    )
                                    .join(
                                      ''
                                    )}

                                </tr>
                              `
                            )
                            .join(
                              ''
                            )}

                        </tbody>

                      </table>

                    </div>
                  `;
                }
              )
              .join('')
          : `
              <div class="empty">
                No worksheet data
                returned.
              </div>
            `;

      phase(
        `Loaded ${
          worksheets.length
        } worksheet${
          worksheets.length === 1
            ? ''
            : 's'
        }.`,
        'ok'
      );
    } catch (error) {
      phase(
        human(error),
        'error'
      );
    }
  }

  /* ============================================================
   * PDF PAGE INFO
   * ============================================================ */

  async function loadPdfPages() {
    const file =
      files()[0];

    if (!file) {
      toast(
        'Select a PDF first.',
        'error'
      );

      return;
    }

    try {
      phase(
        'Reading PDF page count…'
      );

      const result =
        await request(
          '/pdf/info',
          fdOne(file),
          'json'
        );

      const count =
        Number(
          result?.data?.pages ||
            result?.pages ||
            0
        );

      if (!count) {
        throw new Error(
          'The backend did not return a page count.'
        );
      }

      state.scratch.pages =
        Array.from(
          {
            length: count,
          },
          (_, index) => ({
            src:
              index + 1,

            rot: 0,

            removed: false,

            sel: false,
          })
        );

      drawTiles();

      phase(
        `${count} pages loaded.`,
        'ok'
      );
    } catch (error) {
      phase(
        human(error),
        'error'
      );
    }
  }

  /* ============================================================
   * PDF PAGE TILES
   * ============================================================ */

  function drawTiles() {
    const container =
      $('#tiles');

    const pages =
      state.scratch.pages ||
      [];

    if (!container) return;

    if (!pages.length) {
      container.innerHTML = `
        <div class="empty">
          No pages loaded.
        </div>
      `;

      return;
    }

    container.innerHTML =
      pages
        .map(
          (page, index) => `
            <button
              class="tile ${
                page.sel
                  ? 'selected'
                  : ''
              } ${
                page.removed
                  ? 'removed'
                  : ''
              }"
              data-page="${index}"
              aria-pressed="${
                page.sel
              }"
            >

              ${page.src}

              <span class="tile-no">
                ${index + 1}
              </span>

            </button>
          `
        )
        .join('');

    $$('[data-page]').forEach(
      (button) => {
        button.onclick = () => {
          const page =
            state.scratch.pages[
              Number(
                button.dataset
                  .page
              )
            ];

          if (!page) return;

          page.sel =
            !page.sel;

          drawTiles();
        };
      }
    );
  }

  /* ============================================================
   * IMAGE PREVIEW
   * ============================================================ */

  function previewImage() {
    const file =
      files()[0];

    const box =
      $('#imagePreview');

    if (
      !box ||
      !file ||
      !IMG.includes(
        ext(file.name)
      )
    ) {
      return;
    }

    const url =
      URL.createObjectURL(
        file
      );

    box.innerHTML = `
      <img
        src="${url}"
        alt="${esc(file.name)}"
      >
    `;

    const image =
      box.querySelector(
        'img'
      );

    if (image) {
      image.onload = () =>
        URL.revokeObjectURL(
          url
        );
    }
  }

  /* ============================================================
   * GLOBAL NAVIGATION
   * ============================================================ */

  document.addEventListener(
    'click',
    (event) => {
      const nav =
        event.target.closest(
          '[data-nav]'
        );

      const tool =
        event.target.closest(
          '[data-tool]'
        );

      if (nav) {
        event.preventDefault();

        const id =
          nav.dataset.nav;

        state.tool = id;

        $('#sidebar')
          ?.classList.remove(
            'open'
          );

        renderNav();

        if (
          id ===
          'dashboard'
        ) {
          dashboard();
        } else {
          toolView(id);
        }

        return;
      }

      if (tool) {
        event.preventDefault();

        toolView(
          tool.dataset.tool
        );
      }
    }
  );

  /* ============================================================
   * HASH NAVIGATION
   * ============================================================ */

  window.addEventListener(
    'hashchange',
    () => {
      const id =
        location.hash.slice(
          1
        );

      if (id) {
        open(id);
      }
    }
  );

  function open(id) {
    state.tool = id;

    renderNav();

    if (
      id ===
      'dashboard'
    ) {
      dashboard();
    } else {
      toolView(id);
    }
  }

  /* ============================================================
   * START APPLICATION
   * ============================================================ */

  shell();

  dashboard();

  health();

  /* ============================================================
   * OPEN CURRENT HASH
   * ============================================================ */

  const initialHash =
    location.hash.slice(1);

  if (initialHash) {
    open(initialHash);
  }

})();
