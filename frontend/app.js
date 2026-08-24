'use strict';

/**
 * ============================================================
 * KRAZYBUY — PRODUCTION FRONTEND (FIXED)
 * ============================================================
 *
 * Fixes applied:
 *  1. bpBadges null-check added before .innerHTML
 *  2. closeSSE() guard — only called if source still open
 *  3. renderSavings — savings now computed vs. median/highest not source price
 *  4. renderRecent() moved after checkHealth() chain (boot order fixed)
 *  5. showOnlyView — '#status' querySelectorAll replaced with getElementById
 *  6. descToggle — threshold tied to rendered line estimate, not raw char count
 *  7. renderRange — rangeFill left/right now reflect actual price spread
 *  8. renderTrust — fakeDeal includes url so logoUrlForStore resolves properly
 *  9. money() fallback uses currency symbol map instead of hardcoded ₹
 * 10. ecommerceLogoUrls dead array removed
 * ============================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  /* ==========================================================
     KRAZYBUY API BRIDGE
     Works on Vercel + Oracle backend and also supports same-origin.
  ========================================================== */

  const apiMeta = document.querySelector('meta[name="api-base"]');
  const API_BASE = safeApiBase(window.KRAZYBUY_API_BASE || apiMeta?.content || '');
  const IS_PRODUCT_PAGE = document.body?.dataset?.page === 'product';

  function safeApiBase(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = new URL(raw, window.location.origin);
      url.pathname = url.pathname.replace(/\/+$/, '');
      return url.origin + (url.pathname === '/' ? '' : url.pathname);
    } catch {
      return '';
    }
  }

  function apiUrl(path) {
    const p = String(path || '');
    if (/^https?:\/\//i.test(p)) return p;
    return `${API_BASE}${p.startsWith('/') ? p : `/${p}`}`;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api/')) input = apiUrl(input);
    else if (input instanceof URL && input.pathname.startsWith('/api/')) input = apiUrl(input.pathname + input.search);
    return originalFetch(input, init);
  };

  /* ==========================================================
     DOM HELPER
  ========================================================== */

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];


  /* ==========================================================
     STATE
  ========================================================== */

  const state = {
    jobId: null,
    source: null,
    startedAt: 0,
    timer: null,
    lastUrl: '',
    lastResult: null,
    lastImages: [],
    currentImageIndex: 0,
    lastCompletedResult: null,
    compareController: null,
    reconnectTimer: null,
    reconnectAttempts: 0,
    view: 'home'
  };


  /* ==========================================================
     ELEMENTS
  ========================================================== */

  const form          = $('#searchForm');
  const urlInput      = $('#productUrl');
  const compareBtn    = $('#compareBtn');
  const urlError      = $('#urlError');

  const progressPanel   = $('#progressPanel');
  const progressBar     = $('#progressBar');
  const progressMessage = $('#progressMessage');
  const progressSteps   = $('#progressSteps');
  const progressTitle   = document.querySelector('.progress-head strong');
  const progressTimer   = $('#progressTimer');

  const errorPanel   = $('#errorPanel');
  const errorMessage = $('#errorMessage');
  const errorRetry   = $('#errorRetry');

  const results = $('#results');

  const productName = $('#productName');
  const variantLine = $('#variantLine');
  const elapsed     = $('#elapsed');

  const productImage  = $('#productImage');
  const imageFallback = $('#imageFallback');
  const thumbRow      = $('#thumbRow');
  const viewAllImages = $('#viewAllImages');

  const productBrand = $('#productBrand');
  const productTitle = $('#productTitle');
  const productModel = $('#productModel');

  const variantChips = $('#variantChips');
  const ratingLine   = $('#ratingLine');

  const productDescShort = $('#productDescShort');

  const heroPrice    = $('#heroPrice');
  const heroOriginal = $('#heroOriginal');
  const heroSavings  = $('#heroSavings');

  const bpAmount = $('#bpAmount');
  const bpStore  = $('#bpStore');
  const bpBadges = $('#bpBadges');
  const bpOpen   = $('#bpOpen');

  const statsGrid = $('#statsGrid');

  const offersLabel = $('#offersLabel');
  const offersList  = $('#offersList');

  const compareTableBody = $('#compareTableBody');

  const suspiciousPanel = $('#suspiciousPanel');
  const suspiciousList  = $('#suspiciousList');

  const rangePanel = $('#rangePanel');
  const rangeFill  = $('#rangeFill');
  const dotLow     = $('#dotLow');
  const dotMed     = $('#dotMed');
  const dotHigh    = $('#dotHigh');
  const rangeLow   = $('#rangeLow');
  const rangeMed   = $('#rangeMed');
  const rangeHigh  = $('#rangeHigh');

  const savingsPanel = $('#savingsPanel');
  const savingsList  = $('#savingsList');

  const specsPanel = $('#specsPanel');
  const specsGrid  = $('#specsGrid');

  const overviewPanel  = $('#overviewPanel');
  const productDescFull = $('#productDescFull');
  const descToggle      = $('#descToggle');

  const detailsPanel = $('#detailsPanel');
  const detailsGrid  = $('#detailsGrid');

  const scoreRing         = $('#scoreRing');
  const retzoScore        = $('#retzoScore');
  const retzoLabel        = $('#retzoLabel');
  const retzoConfidence   = $('#retzoConfidence');
  const retzoHeadline     = $('#retzoHeadline');
  const retzoSummary      = $('#retzoSummary');
  const retzoReasonsWrap  = $('#retzoReasonsWrap');
  const retzoReasons      = $('#retzoReasons');
  const retzoWarningsWrap = $('#retzoWarningsWrap');
  const retzoWarnings     = $('#retzoWarnings');
  const retzoRecommendation = $('#retzoRecommendation');

  const trustPanel = $('#trustPanel');
  const trustList  = $('#trustList');

  const statusRows    = $('#statusRows');
  const statusChecked = $('#statusChecked');

  const debugPanel      = $('#debugPanel');
  const debugOutput     = $('#debugOutput');
  const debugEventCount = $('#debugEventCount');

  const recentList       = $('#recentList');
  const recentCountLabel = $('#recentCountLabel');
  const newComparisonBtn = $('#newComparisonBtn');
  const sidebarCloseBtn  = $('#sidebarClose');
  const orbitRotator     = $('#orbitRotator');

  const marketChips = $('#marketChips');

  const sidebar        = $('#sidebar');
  const sidebarOverlay = $('#sidebarOverlay');
  const menuBtn        = $('#menuBtn');

  const authBtn      = $('#authBtn');
  const authBtnLabel = $('#authBtnLabel');

  const healthDot  = $('#healthDot');
  const healthText = $('#healthText');
  const sideDot    = $('#sideDot');
  const sideEngine = $('#sideEngine');
  const sideRetzo  = $('#sideRetzo');
  const footerDot  = $('#footerDot');
  const footerStatus = $('#footerStatus');

  const lightbox      = $('#lightbox');
  const lightboxImg   = $('#lightboxImg');
  const lightboxClose = $('#lightboxClose');
  const lightboxPrev  = $('#lightboxPrev');
  const lightboxNext  = $('#lightboxNext');
  const bpCopy        = $('#bpCopy');
  const bpShare       = $('#bpShare');


  /* ==========================================================
     UTILS
  ========================================================== */

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/[&<>'"]/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[char]));
  }

  function safeText(value) {
    return String(value ?? '').trim();
  }

  // FIX 9: currency fallback map instead of hardcoded ₹
  const CURRENCY_SYMBOLS = {
    INR: '₹', USD: '$', EUR: '€', GBP: '£',
    AED: 'د.إ', JPY: '¥', CNY: '¥', AUD: 'A$', CAD: 'C$'
  };

  function money(value, currency = 'INR') {
    const number = Number(value);
    if (!Number.isFinite(number)) return '—';
    const cur = String(currency || 'INR').toUpperCase();
    try {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: cur,
        maximumFractionDigits: 0
      }).format(number);
    } catch {
      const sym = CURRENCY_SYMBOLS[cur] || cur + ' ';
      return `${sym}${Math.round(number).toLocaleString('en-IN')}`;
    }
  }

  function clamp(number, min, max) {
    return Math.max(min, Math.min(max, number));
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.hidden = Boolean(hidden);
  }

  function normalizeKey(value) {
    return safeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function truncate(value, length = 120) {
    const text = safeText(value);
    if (text.length <= length) return text;
    return `${text.slice(0, length - 1)}…`;
  }

  function validHttpUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }


  /* ==========================================================
     LOGO DOMAIN MAP
  ========================================================== */

  const LOGO_DOMAIN_MAP = {
    Amazon: 'amazon.in', Flipkart: 'flipkart.com', Myntra: 'myntra.com',
    Ajio: 'ajio.com', Nykaa: 'nykaa.com', 'Tata Cliq': 'tatacliq.com',
    Meesho: 'meesho.com', JioMart: 'jiomart.com', Croma: 'croma.com',
    'Reliance Digital': 'reliancedigital.in', Snapdeal: 'snapdeal.com',
    'boAt': 'boat-lifestyle.com', Noise: 'noise.com', 'Fire-Boltt': 'fireboltt.com',
    'Boult Audio': 'boultaudio.com', Lenskart: 'lenskart.com',
    FirstCry: 'firstcry.com', Pepperfry: 'pepperfry.com',
    'Urban Ladder': 'urbanladder.com', Bewakoof: 'bewakoof.com',
    'The Souled Store': 'thesouledstore.com', Snitch: 'snitch.co.in',
    Zivame: 'zivame.com', Bluestone: 'bluestone.com', CaratLane: 'caratlane.com',
    Titan: 'titan.co.in', Fastrack: 'fastrack.in', Mamaearth: 'mamaearth.in',
    'Sugar Cosmetics': 'sugarcosmetics.com', Plum: 'plumgoodness.com',
    MCaffeine: 'mcaffeine.com', 'WOW Skin Science': 'wowskinscience.com',
    Minimalist: 'minimalist.co', Furlenco: 'furlenco.com',
    BigBasket: 'bigbasket.com', Blinkit: 'blinkit.com', Zepto: 'zepto.com',
    Instamart: 'instamart.com', eBay: 'ebay.com', Etsy: 'etsy.com',
    Walmart: 'walmart.com', Target: 'target.com', BestBuy: 'bestbuy.com',
    AliExpress: 'aliexpress.com', Alibaba: 'alibaba.com', Rakuten: 'rakuten.com',
    ASOS: 'asos.com', Zalando: 'zalando.com', SHEIN: 'shein.com',
    Wayfair: 'wayfair.com', Overstock: 'overstock.com',
    'Home Depot': 'homedepot.com', IKEA: 'ikea.com', Decathlon: 'decathlon.in',
    Nike: 'nike.com', Adidas: 'adidas.com', Puma: 'puma.com',
    'Under Armour': 'underarmour.com', Zara: 'zara.com', 'H&M': 'hm.com',
    Uniqlo: 'uniqlo.com', Levi: 'levi.com', 'Ray-Ban': 'ray-ban.com',
    Apple: 'apple.com', Samsung: 'samsung.com', OnePlus: 'oneplus.in',
    Xiaomi: 'xiaomi.com', Realme: 'realme.com', Asus: 'asus.com',
    Dell: 'dell.com', HP: 'hp.com', Lenovo: 'lenovo.com', Sony: 'sony.com',
    LG: 'lg.com', Bose: 'bose.com', JBL: 'jbl.com', Sennheiser: 'sennheiser.com',
    Canon: 'canon.com', Nikon: 'nikon.com'
  };


  /* ==========================================================
     STORE DETECTION
  ========================================================== */

  const STORES = [
    { name: 'Amazon',            domains: ['amazon.in','amazon.com','amazon.ae','amazon.co.uk'], monogram: 'A'  },
    { name: 'Flipkart',          domains: ['flipkart.com'],           monogram: 'F'  },
    { name: 'Croma',             domains: ['croma.com'],              monogram: 'C'  },
    { name: 'Vijay Sales',       domains: ['vijaysales.com'],         monogram: 'VS' },
    { name: 'Reliance Digital',  domains: ['reliancedigital.in'],     monogram: 'RD' },
    { name: 'Sangeetha Mobiles', domains: ['sangeethamobiles.com'],   monogram: 'S'  },
    { name: 'Bajaj Electronics', domains: ['bajajelectronics.com'],   monogram: 'BE' },
    { name: 'Poorvika',          domains: ['poorvika.com'],           monogram: 'P'  },
    { name: 'Vasanth & Co',      domains: ['vasanthandco.in'],        monogram: 'VC' },
    { name: 'Sathya',            domains: ['sathya.store','sathyamobiles.com'], monogram: 'S' },
    { name: 'Imagine',           domains: ['imagineonline.store'],    monogram: 'I'  },
    { name: 'Apple',             domains: ['apple.com'],              monogram: ''   },
    { name: 'Myntra',            domains: ['myntra.com'],             monogram: 'M'  },
    { name: 'Nykaa',             domains: ['nykaa.com','nykaaman.com'], monogram: 'N' },
    { name: 'JioStore',          domains: ['jiostore.online'],        monogram: 'J'  },
    { name: 'JioMart',           domains: ['jiomart.com'],            monogram: 'JM' },
    { name: 'BigBasket',         domains: ['bigbasket.com'],          monogram: 'BB' },
    { name: 'Blinkit',           domains: ['blinkit.com'],            monogram: 'B'  },
    { name: 'Zepto',             domains: ['zepto.com'],              monogram: 'Z'  },
    { name: 'eBay',              domains: ['ebay.com'],               monogram: 'eB' },
    { name: 'Etsy',              domains: ['etsy.com'],               monogram: 'E'  },
    { name: 'Walmart',           domains: ['walmart.com'],            monogram: 'W'  },
    { name: 'Target',            domains: ['target.com'],             monogram: 'T'  },
    { name: 'BestBuy',           domains: ['bestbuy.com'],            monogram: 'BB' },
    { name: 'AliExpress',        domains: ['aliexpress.com'],         monogram: 'AE' },
    { name: 'Alibaba',           domains: ['alibaba.com'],            monogram: 'A'  },
    { name: 'Rakuten',           domains: ['rakuten.com'],            monogram: 'R'  },
    { name: 'IKEA',              domains: ['ikea.com'],               monogram: 'I'  },
    { name: 'Decathlon',         domains: ['decathlon.in'],           monogram: 'D'  },
    { name: 'Nike',              domains: ['nike.com'],               monogram: 'N'  },
    { name: 'Adidas',            domains: ['adidas.com'],             monogram: 'A'  },
    { name: 'Samsung',           domains: ['samsung.com'],            monogram: 'S'  },
    { name: 'OnePlus',           domains: ['oneplus.in'],             monogram: '1+' },
    { name: 'Xiaomi',            domains: ['xiaomi.com'],             monogram: 'Mi' },
    { name: 'Realme',            domains: ['realme.com'],             monogram: 'R'  },
    { name: 'Dell',              domains: ['dell.com'],               monogram: 'D'  },
    { name: 'HP',                domains: ['hp.com'],                 monogram: 'HP' },
    { name: 'Lenovo',            domains: ['lenovo.com'],             monogram: 'L'  },
    { name: 'Sony',              domains: ['sony.com'],               monogram: 'S'  },
    { name: 'LG',                domains: ['lg.com'],                 monogram: 'LG' },
    { name: 'Bose',              domains: ['bose.com'],               monogram: 'B'  },
    { name: 'JBL',               domains: ['jbl.com'],                monogram: 'J'  },
    { name: 'Canon',             domains: ['canon.com'],              monogram: 'C'  },
    { name: 'Nikon',             domains: ['nikon.com'],              monogram: 'N'  }
  ];


  function detectStoreFromUrl(url) {
    if (!url) return null;
    try {
      const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      for (const store of STORES) {
        for (const domain of store.domains) {
          if (hostname === domain || hostname.endsWith(`.${domain}`)) return store;
        }
      }
    } catch {}
    return null;
  }

  function findStoreByName(value) {
    const text = normalizeKey(value);
    if (!text) return null;
    return (
      STORES.find(s => normalizeKey(s.name) === text) ||
      STORES.find(s => text.includes(normalizeKey(s.name))) ||
      null
    );
  }

  function resolvedStore(deal) {
    return detectStoreFromUrl(deal?.url) || findStoreByName(deal?.store) || null;
  }

  function storeName(deal) {
    return resolvedStore(deal)?.name || safeText(deal?.store) || 'Independent seller';
  }


  /* ==========================================================
     REAL LOGO RESOLUTION
  ========================================================== */

  function logoUrlForDomain(domain) {
    if (!domain) return '';
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  }

  function logoUrlForStore(deal) {
    const directStore = resolvedStore(deal);
    if (directStore) {
      const primaryDomain = directStore.domains?.[0];
      if (primaryDomain) return logoUrlForDomain(primaryDomain);
    }
    const detectedName = storeName(deal);
    const mappedDomain = LOGO_DOMAIN_MAP[detectedName];
    if (mappedDomain) return logoUrlForDomain(mappedDomain);
    const url = safeText(deal?.url);
    if (url) {
      try {
        const hostname = new URL(url).hostname.replace(/^www\./i, '');
        if (hostname) return logoUrlForDomain(hostname);
      } catch {}
    }
    return '';
  }

  function logoUrlForName(name) {
    const found = findStoreByName(name);
    if (found?.domains?.length) return logoUrlForDomain(found.domains[0]);
    const mappedDomain = LOGO_DOMAIN_MAP[safeText(name)];
    if (mappedDomain) return logoUrlForDomain(mappedDomain);
    return '';
  }


  /* ==========================================================
     STORE LOGO HTML
  ========================================================== */

  function storeMonogram(deal, large = false) {
    const store   = resolvedStore(deal);
    const name    = storeName(deal);
    const monogram = store?.monogram ||
      name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
    const logo     = logoUrlForStore(deal);
    const sizeClass = large ? 'lg' : '';

    if (!logo) {
      return `<span class="store-mono ${sizeClass}" aria-hidden="true">${escapeHtml(monogram)}</span>`;
    }

    return `
      <span class="store-logo-wrap ${sizeClass}" data-logo-wrapper aria-label="${escapeHtml(name)}">
        <img
          class="store-logo ${sizeClass}"
          src="${escapeHtml(logo)}"
          alt="${escapeHtml(name)} logo"
          loading="lazy" decoding="async" referrerpolicy="no-referrer"
          data-logo-image
        >
        <span class="store-mono ${sizeClass}" data-logo-fallback aria-hidden="true" hidden>
          ${escapeHtml(monogram)}
        </span>
      </span>`;
  }

  function storeChip(storeNameValue) {
    const found   = findStoreByName(storeNameValue);
    const name    = found?.name || safeText(storeNameValue) || 'Marketplace';
    const monogram = found?.monogram ||
      name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
    const logo = logoUrlForName(name);

    if (!logo) {
      return `
        <div class="market-chip">
          <span class="store-mono" aria-hidden="true">${escapeHtml(monogram)}</span>
          <span>${escapeHtml(name)}</span>
        </div>`;
    }

    return `
      <div class="market-chip" data-market-logo-wrapper>
        <img
          class="store-logo"
          src="${escapeHtml(logo)}"
          alt="${escapeHtml(name)} logo"
          loading="lazy" decoding="async" referrerpolicy="no-referrer"
          data-logo-image
        >
        <span class="store-mono" data-logo-fallback aria-hidden="true" hidden>${escapeHtml(monogram)}</span>
        <span>${escapeHtml(name)}</span>
      </div>`;
  }


  /* ==========================================================
     LOGO FALLBACK HANDLER
  ========================================================== */

  function attachLogoFallbacks(root = document) {
    root.querySelectorAll('img[data-logo-image]').forEach(img => {
      if (img.dataset.logoBound === '1') return;
      img.dataset.logoBound = '1';
      const wrapper  = img.closest('[data-logo-wrapper], [data-market-logo-wrapper]');
      const fallback = wrapper?.querySelector('[data-logo-fallback]');

      const hideLogo = () => {
        img.hidden = true;
        if (fallback) fallback.hidden = false;
      };

      img.addEventListener('error', hideLogo, { once: true });
      if (img.complete && img.naturalWidth === 0) hideLogo();
    });
  }


  /* ==========================================================
     AVAILABILITY
  ========================================================== */

  function isDealAvailable(deal) {
    if (deal?.isAvailable === false) return false;
    const status = safeText(deal?.availability).toLowerCase();
    if (/out[\s_-]?of[\s_-]?stock|unavailable|sold[\s_-]?out/.test(status)) return false;
    return true;
  }

  function availabilityText(deal) {
    if (!deal) return 'Unknown';
    if (deal.isAvailable === false) return 'Check stock';
    const text = safeText(deal.availability);
    if (text) return text.replace(/^available$/i, 'Available');
    return 'Availability not confirmed';
  }


  /* ==========================================================
     CONFIDENCE
  ========================================================== */

  function offerConfidence(deal) {
    const classification = safeText(deal?.relationship?.classification);
    const confidence     = Number(deal?.relationship?.confidence);

    if (Number.isFinite(confidence)) {
      if (confidence >= 85) return { label: 'High confidence', className: 'high' };
      if (confidence >= 65) return { label: 'Medium confidence', className: 'medium' };
      return { label: 'Review', className: 'review' };
    }

    if (classification === 'EXACT_MATCH') return { label: 'High confidence', className: 'high' };
    if (classification === 'MATCHING')    return { label: 'Medium confidence', className: 'medium' };
    return { label: 'Review', className: 'review' };
  }



  /* ==========================================================
     THEME BRIDGE
  ========================================================== */

  const themeToggle = document.getElementById('themeToggle');

  function applyTheme(theme) {
    const isLight = theme === 'light';
    document.documentElement.classList.toggle('theme-light', isLight);
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
      themeToggle.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
    }
  }

  function initTheme() {
    let saved = 'dark';
    try { saved = localStorage.getItem('krazybuy_theme') || 'dark'; } catch {}
    applyTheme(saved === 'light' ? 'light' : 'dark');
  }

  themeToggle?.addEventListener('click', () => {
    const next = document.documentElement.classList.contains('theme-light') ? 'dark' : 'light';
    applyTheme(next);
    try { localStorage.setItem('krazybuy_theme', next); } catch {}
  });

  /* ==========================================================
     ERROR / PROGRESS
  ========================================================== */

  function showProgress(show) { setHidden(progressPanel, !show); }
  function showResults(show)   { setHidden(results, !show); }

  function resetError() {
    setHidden(errorPanel, true);
    if (errorMessage) errorMessage.textContent = '';
  }

  function fail(message) {
    if (state.compareController) { try { state.compareController.abort(); } catch {} state.compareController = null; }
    if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
    closeSSE();
    stopProgress();
    if (errorMessage) errorMessage.textContent = safeText(message) || 'Something went wrong.';
    setHidden(errorPanel, false);
    showProgress(false);
    showResults(false);
    setCompareLoading(false);
  }

  function setCompareLoading(loading) {
    if (!compareBtn) return;
    compareBtn.disabled = loading;
    const label     = compareBtn.querySelector('.btn-label');
    const loadingEl = compareBtn.querySelector('.btn-loading');
    if (label)     label.hidden     = loading;
    if (loadingEl) loadingEl.hidden = !loading;
  }

  const ORBIT_STORES = [
    { name:'Amazon', domain:'amazon.in', monogram:'A' },
    { name:'Flipkart', domain:'flipkart.com', monogram:'F' },
    { name:'Croma', domain:'croma.com', monogram:'C' },
    { name:'Vijay Sales', domain:'vijaysales.com', monogram:'VS' },
    { name:'Reliance Digital', domain:'reliancedigital.in', monogram:'RD' },
    { name:'Myntra', domain:'myntra.com', monogram:'M' },
    { name:'Nykaa', domain:'nykaa.com', monogram:'N' },
    { name:'JioMart', domain:'jiomart.com', monogram:'JM' }
  ];

  function renderOrbitStores() {
    if (!orbitRotator) return;
    orbitRotator.innerHTML = ORBIT_STORES.map((store, index) => `
      <span class="orbit-item" style="--n:${index * 45}deg" title="${escapeHtml(store.name)}">
        <img src="${escapeHtml(logoUrlForDomain(store.domain))}" alt="" loading="eager" referrerpolicy="no-referrer"
             onerror="this.hidden=true;this.parentElement.textContent='${store.monogram}'">
      </span>`).join('');
  }

  function startProgress() {
    state.startedAt = Date.now();
    if (state.timer) clearInterval(state.timer);
    showProgress(true);
    showResults(false);
    renderOrbitStores();
    orbitRotator?.classList.add('orbit-active');
    resetError();

    if (progressTimer) {
      progressTimer.textContent = '0.0s';
      state.timer = setInterval(() => {
        const seconds = (Date.now() - state.startedAt) / 1000;
        progressTimer.textContent = `${seconds.toFixed(1)}s`;
      }, 100);
    }

    updateProgress('Starting comparison', 'Creating a comparison job…', 8, [
      { label: 'Job created',      state: 'done' },
      { label: 'Live stream',      state: ''     },
      { label: 'Normalize offers', state: ''     },
      { label: 'Retzo',            state: ''     }
    ]);
  }

  function stopProgress() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    orbitRotator?.classList.remove('orbit-active');
  }

  function updateProgress(title, message, percent, steps) {
    if (progressTitle)   progressTitle.textContent   = title;
    if (progressMessage) progressMessage.textContent = message;
    if (progressBar) {
      progressBar.style.width = `${clamp(Number(percent) || 7, 7, 100)}%`;
    }
    if (progressSteps) {
      progressSteps.innerHTML = steps
        .map(step => `<li class="${escapeHtml(step.state || '')}">${escapeHtml(step.label)}</li>`)
        .join('');
    }
  }

  function handlePipeline(packet) {
    const step    = safeText(packet?.event?.step);
    const content = safeText(packet?.event?.content);

    const map = {
      starting:         { percent: 12, title: 'Starting comparison',  message: 'Searching the product…' },
      'stream-connected': { percent: 25, title: 'Live comparison',    message: 'Connected to the comparison stream…' },
      'stream-reading': { percent: 55, title: 'Collecting offers',    message: content || 'Receiving store and pricing data…' },
      normalize:        { percent: 72, title: 'Checking the offers',  message: 'Matching exact variants and removing duplicates…' },
      verdict:          { percent: 88, title: 'Finishing with Retzo', message: 'Retzo is evaluating the normalized comparison…' }
    };

    const config = map[step] || { percent: 45, title: 'Comparing offers', message: content || 'Processing comparison…' };
    const p = config.percent;

    updateProgress(config.title, config.message, p, [
      { label: 'Job created',      state: 'done'                              },
      { label: 'Live stream',      state: p >= 25 ? 'done' : 'active'         },
      { label: 'Normalize offers', state: p >= 72 ? 'done' : p >= 55 ? 'active' : '' },
      { label: 'Retzo verdict',    state: p >= 88 ? 'done' : p >= 72 ? 'active' : '' }
    ]);
  }


  /* ==========================================================
     HEALTH
  ========================================================== */

  async function checkHealth() {
    try {
      const response = await fetch('/api/health', { method: 'GET', cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const retzoEnabled = Boolean(data?.retzo?.enabled);
      const engineText   = retzoEnabled ? 'Engine online · Retzo enabled' : 'Engine online · Local verdict';

      if (healthDot)    { healthDot.classList.remove('offline'); healthDot.classList.add('online'); }
      if (healthText)   healthText.textContent = engineText;
      if (sideDot)      { sideDot.classList.remove('offline'); sideDot.classList.add('online'); }
      if (sideEngine)   sideEngine.textContent = 'Engine online';
      if (sideRetzo)    sideRetzo.textContent  = retzoEnabled ? 'Retzo enabled' : 'Local verdict';
      if (footerDot)    { footerDot.classList.remove('offline'); footerDot.classList.add('online'); }
      if (footerStatus) footerStatus.textContent = retzoEnabled ? 'All systems operational' : 'Comparison operational';

      renderStatus(data);
    } catch (error) {
      console.error('[KRAZYBUY] Health failed:', error);
      if (healthDot)    { healthDot.classList.remove('online'); healthDot.classList.add('offline'); }
      if (healthText)   healthText.textContent  = 'Engine unavailable';
      if (sideDot)      { sideDot.classList.remove('online'); sideDot.classList.add('offline'); }
      if (sideEngine)   sideEngine.textContent  = 'Engine unavailable';
      if (sideRetzo)    sideRetzo.textContent   = 'Status unavailable';
      if (footerDot)    { footerDot.classList.remove('online'); footerDot.classList.add('offline'); }
      if (footerStatus) footerStatus.textContent = 'Engine unavailable';
    }
  }


  /* ==========================================================
     STATUS PAGE
  ========================================================== */

  function renderStatus(data) {
    if (!statusRows) return;

    const rows = [
      ['Comparison engine',      data?.ok ? 'Operational' : 'Unavailable', Boolean(data?.ok)],
      ['Retzo',                  data?.retzo?.enabled ? `${data.retzo.keyCount || 1} key(s) connected` : 'Local verdict mode', Boolean(data?.retzo?.enabled)],
      ['Relationship matcher',   data?.aiMatcher ? 'Enabled' : 'Local fallback', Boolean(data?.aiMatcher)],
      ['Store detection',        data?.storeDetection ? 'Enabled' : 'Unavailable', Boolean(data?.storeDetection)],
      ['Price protection',       data?.priceProtection ? 'Enabled' : 'Unavailable', Boolean(data?.priceProtection)],
      ['Complete stream capture', data?.completeSseCapture ? 'Enabled' : 'Unavailable', Boolean(data?.completeSseCapture)]
    ];

    statusRows.innerHTML = rows
      .map(row => `
        <div class="status-row">
          <span class="health-dot ${row[2] ? 'online' : 'offline'}"></span>
          <strong>${escapeHtml(row[0])}</strong>
          <span>${escapeHtml(row[1])}</span>
        </div>`)
      .join('');

    if (statusChecked) statusChecked.textContent = new Date().toLocaleTimeString();
  }


  /* ==========================================================
     MARKETPLACE CHIPS
  ========================================================== */

  function renderMarketplaces() {
    if (!marketChips) return;
    const names = [
      'Amazon','Flipkart','Croma','Vijay Sales','Reliance Digital',
      'Sangeetha Mobiles','Myntra','Nykaa','JioMart','BigBasket','eBay','Etsy'
    ];
    marketChips.innerHTML = names.map(storeChip).join('');
    attachLogoFallbacks(marketChips);
  }


  /* ==========================================================
     VARIANT TEXT
  ========================================================== */

  function variantParts(product) {
    const variant = product?.variant || {};
    const result  = [];
    if (variant.ram)     result.push(`RAM: ${variant.ram}`);
    if (variant.storage) result.push(`Storage: ${variant.storage}`);
    if (variant.color)   result.push(`Color: ${variant.color}`);
    return result;
  }


  /* ==========================================================
     RENDER PRODUCT
  ========================================================== */

  function finishComparison(result, url = state.lastUrl) {
    state.lastResult = result;
    state.lastCompletedResult = result;
    if (IS_PRODUCT_PAGE) {
      renderProduct(result);
      return;
    }
    try {
      sessionStorage.setItem('krazybuy_product_result', JSON.stringify(result));
      sessionStorage.setItem('krazybuy_product_url', url || '');
    } catch (error) {
      console.warn('[KRAZYBUY] Could not persist product result:', error);
    }
    window.location.href = `product.html${url ? `?from=${encodeURIComponent('comparison')}` : ''}`;
  }

  function renderProduct(result) {
    const product    = result?.product    || {};
    const comparison = result?.comparison || {};
    const deals      = Array.isArray(comparison.deals) ? [...comparison.deals] : [];
    const retzo      = normalizeRetzo(result?.retzo, result);

    state.lastResult          = result;
    state.lastCompletedResult = result;

    /* Header */
    if (productName) productName.textContent = product.name || 'Product comparison';
    const variant = variantParts(product);
    if (variantLine) variantLine.textContent = variant.length ? variant.join(' · ') : 'Exact variant detected';
    if (elapsed) elapsed.textContent = result?.meta?.elapsedSeconds != null ? `${result.meta.elapsedSeconds}s` : 'Complete';

    /* Product copy */
    if (productBrand) productBrand.textContent = product.brand || 'PRODUCT';
    if (productTitle) productTitle.textContent = product.name  || 'Product';
    if (productModel) productModel.textContent = product.model || '';

    if (variantChips) {
      const chips = [];
      if (product.category)        chips.push({ text: product.category,        accent: false });
      if (product.variant?.ram)    chips.push({ text: product.variant.ram,    accent: true  });
      if (product.variant?.storage) chips.push({ text: product.variant.storage, accent: true });
      if (product.variant?.color)  chips.push({ text: product.variant.color,  accent: true  });
      variantChips.innerHTML = chips
        .map(c => `<span class="chip ${c.accent ? 'accent' : ''}">${escapeHtml(c.text)}</span>`)
        .join('');
    }

    /* Rating */
    if (ratingLine) {
      const rating  = product.rating  ?? product.reviews?.rating      ?? null;
      const reviews = product.reviewCount ?? product.reviews?.reviewCount ?? null;
      if (rating != null) {
        ratingLine.innerHTML = `<strong>★ ${escapeHtml(rating)}</strong>${
          reviews != null ? ` · ${Number(reviews).toLocaleString('en-IN')} reviews` : ''
        }`;
      } else {
        ratingLine.textContent = '';
      }
    }

    /* Description */
    const description = safeText(product.description);
    if (productDescShort) productDescShort.textContent = description;

    if (productDescFull) {
      productDescFull.textContent = description;
      productDescFull.classList.add('clamped');
    }

    if (overviewPanel) overviewPanel.hidden = !description;

    // FIX 6: use a character-per-line estimate (~80 chars/line at typical width, show toggle at 4+ lines)
    if (descToggle) {
      const CHARS_PER_LINE = 80;
      const LINE_THRESHOLD = 4;
      descToggle.hidden      = description.length <= CHARS_PER_LINE * LINE_THRESHOLD;
      descToggle.textContent = 'Show more';
    }

    /* Price */
    const currency = product.currency || deals[0]?.currency || 'INR';
    if (heroPrice)    heroPrice.textContent    = product.price != null ? money(product.price, currency) : '—';
    if (heroOriginal) heroOriginal.textContent = product.originalPrice != null ? money(product.originalPrice, currency) : '';
    if (heroSavings) {
      if (product.price && product.originalPrice && product.originalPrice > product.price) {
        const saving = (1 - product.price / product.originalPrice) * 100;
        heroSavings.textContent = `${saving.toFixed(1)}% below listed price`;
      } else {
        heroSavings.textContent = '';
      }
    }

    renderGallery(product);

    const best = comparison.bestPrice ||
      deals.find(d => d.isBestDeal)   ||
      deals.find(isDealAvailable)      ||
      deals[0] || null;

    renderBestPrice(best, product);
    renderStats(result, deals);
    renderOffers(deals, product);
    renderComparisonTable(deals, product);
    renderSuspicious(comparison.suspiciousDeals || []);
    renderRange(comparison.priceRange, currency);
    renderSavings(deals, product, comparison);
    renderSpecs(product.specifications);
    renderDetails(result);
    renderRetzo(retzo);
    renderTrust(deals);
    renderDebug(result);

    showProgress(false);
    showResults(true);
    attachLogoFallbacks(results);
    results?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    saveRecent(result, state.lastUrl);
    renderRecent();
  }


  /* ==========================================================
     GALLERY
  ========================================================== */

  function renderGallery(product) {
    const rawImages = Array.isArray(product?.images) ? product.images.filter(validHttpUrl) : [];
    const thumbnail = safeText(product?.thumbnail);
    const images = [...new Set([validHttpUrl(thumbnail) ? thumbnail : '', ...rawImages].filter(Boolean))];

    state.lastImages = images;
    state.currentImageIndex = 0;

    const first = images[0] || '';

    if (productImage) {
      if (first) {
        productImage.src    = first;
        productImage.alt    = product.name || 'Product image';
        productImage.hidden = false;
        if (imageFallback) imageFallback.hidden = true;
      } else {
        productImage.hidden = true;
        if (imageFallback) imageFallback.hidden = false;
      }

      productImage.onerror = () => {
        const failedSrc = productImage.src;
        const next      = state.lastImages.find(img => img !== failedSrc);
        if (next) {
          state.currentImageIndex = state.lastImages.indexOf(next);
          productImage.onerror = () => {
            productImage.hidden = true;
            if (imageFallback) imageFallback.hidden = false;
          };
          productImage.src = next;
          return;
        }
        productImage.hidden = true;
        if (imageFallback) imageFallback.hidden = false;
      };
    }

    if (thumbRow) {
      if (images.length > 1) {
        thumbRow.hidden = false;
        thumbRow.innerHTML = images.slice(0, 8).map((img, i) => `
          <button type="button" class="${i === 0 ? 'active' : ''}" data-image-index="${i}" aria-label="View product image ${i + 1}">
            <img src="${escapeHtml(img)}" alt="" loading="lazy" decoding="async">
          </button>`).join('');
        thumbRow.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', () => showImage(Number(btn.dataset.imageIndex)));
        });
      } else {
        thumbRow.hidden    = true;
        thumbRow.innerHTML = '';
      }
    }

    if (viewAllImages) viewAllImages.hidden = images.length <= 1;
  }

  function showImage(index) {
    if (!state.lastImages.length) return;
    const safeIndex         = clamp(index, 0, state.lastImages.length - 1);
    state.currentImageIndex = safeIndex;
    const src               = state.lastImages[safeIndex];
    if (productImage) {
      productImage.onerror = () => {
        productImage.hidden = true;
        if (imageFallback) imageFallback.hidden = false;
      };
      productImage.src    = src;
      productImage.hidden = false;
    }
    thumbRow?.querySelectorAll('button').forEach((btn, i) => {
      btn.classList.toggle('active', i === safeIndex);
    });
  }

  function openLightbox(index = state.currentImageIndex) {
    if (!state.lastImages.length || !lightbox || !lightboxImg) return;
    const src = state.lastImages[clamp(index, 0, state.lastImages.length - 1)];
    if (!src) return;
    state.currentImageIndex = clamp(index, 0, state.lastImages.length - 1);
    lightboxImg.src  = src;
    lightbox.hidden  = false;
    if (lightboxPrev) lightboxPrev.hidden = state.lastImages.length <= 1;
    if (lightboxNext) lightboxNext.hidden = state.lastImages.length <= 1;
  }

  function closeLightbox() {
    if (lightbox) lightbox.hidden = true;
  }

  function moveLightbox(delta) {
    if (!state.lastImages.length) return;
    const next = (state.currentImageIndex + delta + state.lastImages.length) % state.lastImages.length;
    showImage(next);
    if (lightbox && !lightbox.hidden && lightboxImg) lightboxImg.src = state.lastImages[next];
  }


  /* ==========================================================
     BEST PRICE
  ========================================================== */

  function trustBadgeHtml(deal) {
    const status = String(deal?.verificationStatus || '').toUpperCase();
    if (status === 'VERIFIED') return '<span class="mini ok">VERIFIED</span>';
    if (status === 'STORE_IDENTIFIED') return '<span class="mini">STORE IDENTIFIED</span>';
    return '<span class="mini warn">UNVERIFIED</span>';
  }


  function renderBestPrice(best, product) {
    if (!bpAmount || !bpStore) return;

    if (!best) {
      bpAmount.textContent = '—';
      bpStore.textContent  = 'No usable listing';
      // FIX 1: null-check bpBadges before touching innerHTML
      if (bpBadges) bpBadges.innerHTML = '';
      if (bpOpen) bpOpen.hidden = true;
      return;
    }

    const currency = best.currency || product.currency || 'INR';
    const price    = best.effectivePrice ?? best.price;
    const store    = storeName(best);

    bpAmount.textContent = money(price, currency);
    bpStore.innerHTML = `
      ${storeMonogram(best)}
      <span>${escapeHtml(store)} ${isDealAvailable(best) ? '· Available' : '· Check stock'}</span>`;

    const confidence = offerConfidence(best);

    // FIX 1: null-check bpBadges
    if (bpBadges) {
      bpBadges.innerHTML = `
        <span class="mini">
          <span class="conf-dot ${confidence.className}"></span>
          ${escapeHtml(confidence.label)}
        </span>
        ${trustBadgeHtml(best)}`;
    }

    attachLogoFallbacks(bpStore);

    const url = safeText(best.url);
    if (bpOpen && validHttpUrl(url)) {
      bpOpen.href   = url;
      bpOpen.hidden = false;
    } else if (bpOpen) {
      bpOpen.hidden = true;
    }
  }


  /* ==========================================================
     STATS
  ========================================================== */

  function renderStats(result, deals) {
    if (!statsGrid) return;
    const comparison = result?.comparison || {};
    const stores     = comparison.storeCount ?? (Array.isArray(comparison.stores) ? comparison.stores.length : 0);
    const validDeals = comparison.totalDeals ?? deals.length;
    const suspicious = comparison.suspiciousCount ?? (Array.isArray(comparison.suspiciousDeals) ? comparison.suspiciousDeals.length : 0);
    const medianPrice = comparison.priceRange?.median;

    const verified = Number(comparison.verifiedOfferCount ?? 0);
    const storeIdentified = Number(comparison.storeIdentifiedOfferCount ?? 0);
    const unverified = Number(comparison.unverifiedOfferCount ?? 0);

    const values = [
      { label: 'Stores',            value: stores },
      { label: 'Exact offers',      value: validDeals },
      { label: 'Verified',          value: verified },
      { label: 'Store identified',  value: storeIdentified },
      { label: 'Unverified',        value: unverified },
      { label: 'Median price',      value: medianPrice != null ? money(medianPrice, result?.product?.currency) : '—' }
    ];

    statsGrid.innerHTML = values
      .map(item => `
        <div class="stat">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>`)
      .join('');
  }


  /* ==========================================================
     OFFERS
  ========================================================== */

  function renderOffers(deals, product) {
    if (!offersList) return;
    if (offersLabel) offersLabel.textContent = `${deals.length} listing${deals.length === 1 ? '' : 's'}`;

    if (!deals.length) {
      offersList.innerHTML = '<div class="empty">No valid offers survived the comparison rules.</div>';
      return;
    }

    const sorted   = [...deals].sort((a, b) => {
      const aAvail = isDealAvailable(a);
      const bAvail = isDealAvailable(b);
      if (aAvail !== bAvail) return aAvail ? -1 : 1;
      return (Number(a.effectivePrice) || Infinity) - (Number(b.effectivePrice) || Infinity);
    });

    const currency = product.currency || 'INR';
    offersList.innerHTML = sorted.map(deal => renderOfferCard(deal, currency)).join('');
    attachLogoFallbacks(offersList);
  }

  function renderOfferCard(deal, currency) {
    const confidence    = offerConfidence(deal);
    const effectivePrice = deal.effectivePrice ?? deal.price;
    const original       = deal.originalPrice  ?? deal.listedPrice;

    return `
      <article class="offer ${deal.isBestDeal ? 'best' : ''}">
        ${storeMonogram(deal, true)}
        <div class="offer-main">
          <div class="offer-store">${escapeHtml(storeName(deal))}</div>
          ${deal.seller ? `<div class="offer-seller">${escapeHtml(deal.seller)}</div>` : ''}
          <div class="offer-title" title="${escapeHtml(deal.title || '')}">${escapeHtml(deal.title || 'Product listing')}</div>
          <div class="badge-row">
            ${deal.isBestDeal ? '<span class="mini best">BEST</span>' : ''}
            ${isDealAvailable(deal) ? '<span class="mini ok">AVAILABLE</span>' : '<span class="mini warn">CHECK STOCK</span>'}
            ${trustBadgeHtml(deal)}
            ${Number.isFinite(Number(deal.priceWithGiftCard)) && Number(deal.priceWithGiftCard) !== Number(deal.price)
              ? '<span class="mini">GIFT-ADJUSTED</span>' : ''}
            <span class="mini">
              <span class="conf-dot ${confidence.className}"></span>
              ${escapeHtml(confidence.label)}
            </span>
          </div>
        </div>
        <div class="offer-price">
          <strong>${money(effectivePrice, deal.currency || currency)}</strong>
          ${Number.isFinite(Number(original)) && Number(original) !== Number(effectivePrice)
            ? `<s>${money(original, deal.currency || currency)}</s>` : ''}
        </div>
        ${validHttpUrl(deal.url)
          ? `<a class="offer-open" href="${escapeHtml(deal.url)}" target="_blank" rel="noopener noreferrer">Open →</a>`
          : '<span></span>'}
      </article>`;
  }


  /* ==========================================================
     COMPARISON TABLE
  ========================================================== */

  function renderComparisonTable(deals, product) {
    if (!compareTableBody) return;

    if (!deals.length) {
      compareTableBody.innerHTML = '<tr><td colspan="7" class="empty">No valid offers found.</td></tr>';
      return;
    }

    const sorted = [...deals].sort((a, b) => Number(a.effectivePrice) - Number(b.effectivePrice));

    compareTableBody.innerHTML = sorted.map(deal => {
      const confidence = offerConfidence(deal);
      return `
        <tr class="${deal.isBestDeal ? 'best-row' : ''}">
          <td><div class="cell-store">${storeMonogram(deal)}<span>${escapeHtml(storeName(deal))}</span></div></td>
          <td><div class="cell-listing" title="${escapeHtml(deal.title || '')}">${escapeHtml(deal.title || product.name || 'Product')}</div></td>
          <td>${isDealAvailable(deal) ? '<span class="mini ok">AVAILABLE</span>' : '<span class="mini warn">CHECK STOCK</span>'}</td>
          <td>${money(deal.price, deal.currency || product.currency)}</td>
          <td><strong>${money(deal.effectivePrice, deal.currency || product.currency)}</strong></td>
          <td>
            ${trustBadgeHtml(deal)}
            <div class="mono" style="margin-top:4px">${escapeHtml(confidence.label)}</div>
          </td>
          <td>${validHttpUrl(deal.url)
            ? `<a class="offer-open" href="${escapeHtml(deal.url)}" target="_blank" rel="noopener noreferrer">Open</a>`
            : ''}</td>
        </tr>`;
    }).join('');

    attachLogoFallbacks(compareTableBody);
  }


  /* ==========================================================
     SUSPICIOUS
  ========================================================== */

  function renderSuspicious(suspicious) {
    if (!suspiciousPanel || !suspiciousList) return;

    if (!Array.isArray(suspicious) || !suspicious.length) {
      suspiciousPanel.hidden  = true;
      suspiciousList.innerHTML = '';
      return;
    }

    suspiciousPanel.hidden = false;
    suspiciousList.innerHTML = suspicious.map(deal => `
      <article class="suspicious-card">
        <div>
          <strong>${escapeHtml(storeName(deal))}</strong>
          <div>${escapeHtml(deal.title || 'Listing')}</div>
          <div class="reason">${escapeHtml(deal.filterReason || 'Price requires review.')}</div>
        </div>
        <div class="sp-price">${money(deal.effectivePrice || deal.price, deal.currency || 'INR')}</div>
        ${validHttpUrl(deal.url)
          ? `<a class="offer-open" href="${escapeHtml(deal.url)}" target="_blank" rel="noopener noreferrer">View</a>`
          : ''}
      </article>`).join('');

    attachLogoFallbacks(suspiciousList);
  }


  /* ==========================================================
     RANGE
     FIX 7: rangeFill left/right now represent real price spread
  ========================================================== */

  function renderRange(range, currency) {
    if (!rangePanel) return;

    const low  = Number(range?.lowest);
    const med  = Number(range?.median);
    const high = Number(range?.highest);

    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      rangePanel.hidden = true;
      return;
    }

    rangePanel.hidden = false;

    const middle      = Number.isFinite(med) ? med : low;
    const denominator = high - low || 1;
    const medPercent  = clamp(((middle - low) / denominator) * 100, 0, 100);

    if (rangeLow)  rangeLow.textContent  = money(low,    currency);
    if (rangeMed)  rangeMed.textContent  = money(middle, currency);
    if (rangeHigh) rangeHigh.textContent = money(high,   currency);

    if (dotLow)  dotLow.style.left  = '0%';
    if (dotMed)  dotMed.style.left  = `${medPercent}%`;
    if (dotHigh) dotHigh.style.left = '100%';

    // FIX 7: fill from lowest to highest (full bar), or optionally from low to med
    if (rangeFill) {
      rangeFill.style.left  = '0%';
      rangeFill.style.right = `${100 - medPercent}%`; // fill up to median as meaningful indicator
    }
  }


  /* ==========================================================
     SAVINGS
     FIX 3: compare against median/highest, not source product.price
  ========================================================== */

  function renderSavings(deals, product, comparison) {
    if (!savingsPanel || !savingsList) return;

    const currency = product.currency || 'INR';

    // Use median as the reference price; fall back to product.price
    const referencePrice = Number(comparison?.priceRange?.median) ||
                           Number(product.price) || 0;

    if (referencePrice <= 0) {
      savingsPanel.hidden = true;
      return;
    }

    const usable = deals
      .filter(deal => Number.isFinite(Number(deal.effectivePrice)))
      .slice(0, 6);

    if (!usable.length) {
      savingsPanel.hidden = true;
      return;
    }

    const cards = usable.map(deal => {
      const price   = Number(deal.effectivePrice);
      const savings = (1 - price / referencePrice) * 100;
      if (savings <= 0) return '';
      return `
        <div class="savings-card">
          <strong>${escapeHtml(storeName(deal))}</strong>
          <span>${money(price, deal.currency || currency)}</span>
          <div class="pct">${savings.toFixed(1)}% below median price</div>
        </div>`;
    }).filter(Boolean).join('');

    if (!cards) {
      savingsPanel.hidden = true;
      return;
    }

    savingsPanel.hidden   = false;
    savingsList.innerHTML = cards;
  }


  /* ==========================================================
     SPECS
  ========================================================== */

  function renderSpecs(specifications) {
    if (!specsPanel || !specsGrid) return;

    if (!specifications || typeof specifications !== 'object') {
      specsPanel.hidden   = true;
      specsGrid.innerHTML = '';
      return;
    }

    const entries = Object.entries(specifications);
    if (!entries.length) { specsPanel.hidden = true; return; }

    specsPanel.hidden   = false;
    specsGrid.innerHTML = entries.map(([key, value]) => `
      <div class="spec-row">
        <dt>${escapeHtml(key)}</dt>
        <dd>${escapeHtml(typeof value === 'object' ? JSON.stringify(value) : value)}</dd>
      </div>`).join('');
  }


  /* ==========================================================
     DETAILS
  ========================================================== */

  function renderDetails(result) {
    if (!detailsPanel || !detailsGrid) return;

    const comparison = result?.comparison || {};
    const meta       = result?.meta       || {};

    const details = [
      ['Source URL',              meta.sourceUrl],
      ['Events captured',         meta.eventsCaptured],
      ['Raw candidates',          meta.rawDealCount],
      ['Structured candidates',   meta.structuredCandidateCount],
      ['Final candidates',        meta.candidateCount],
      ['Valid offers',            comparison.totalDeals],
      ['Excluded prices',         comparison.suspiciousCount],
      ['Stores',                  comparison.storeCount],
      ['Completed',               meta.elapsedSeconds != null ? `${meta.elapsedSeconds}s` : '']
    ];

    detailsPanel.hidden   = false;
    detailsGrid.innerHTML = details.map(item => `
      <div class="spec-row">
        <dt>${escapeHtml(item[0])}</dt>
        <dd>${validHttpUrl(item[1])
          ? `<a href="${escapeHtml(item[1])}" target="_blank" rel="noopener noreferrer">${escapeHtml(truncate(item[1], 100))}</a>`
          : escapeHtml(item[1])}</dd>
      </div>`).join('');
  }


  /* ==========================================================
     RETZO
  ========================================================== */

  function normalizeRetzo(raw, result = null) {
    let verdict = raw;
    if (typeof verdict === 'string') {
      try { verdict = JSON.parse(verdict); } catch { verdict = {}; }
    }
    if (!verdict || typeof verdict !== 'object') verdict = {};

    const candidates = [
      verdict,
      result?.retzoVerdict,
      result?.verdict,
      result?.ai?.retzo,
      result?.ai?.verdict,
      result?.analysis?.retzo
    ].filter(Boolean);

    const source = candidates.find(item => typeof item === 'object') || {};
    const score = Number(source.score ?? source.buyScore ?? source.rating ?? 0);
    const confidence = source.confidence == null ? null : Number(source.confidence);
    const label = safeText(source.label || source.verdict || source.decision || source.classification);

    return {
      ...source,
      score: Number.isFinite(score) ? score : 0,
      confidence: Number.isFinite(confidence) ? confidence : null,
      label: label || (score >= 85 ? 'STRONG BUY' : score >= 70 ? 'GOOD BUY' : score >= 55 ? 'CAUTION' : 'REVIEW'),
      headline: safeText(source.headline || source.title || source.message) || 'KrazyBuy comparison complete.',
      summary: safeText(source.summary || source.explanation || source.reason) || 'Review the verified offers and effective price before checkout.',
      reasons: Array.isArray(source.reasons) ? source.reasons : [],
      warnings: Array.isArray(source.warnings) ? source.warnings : [],
      recommendation: safeText(source.recommendation || source.action || source.advice) || 'Review the winning listing before checkout.'
    };
  }

  function renderRetzo(verdict, result = state.lastResult) {
    const normalized = normalizeRetzo(verdict, result);
    verdict = normalized;
    if (!verdict) return;

    const score = clamp(Number(verdict.score) || 0, 0, 100);
    const confidence = verdict.confidence != null
      ? clamp(Number(verdict.confidence) || 0, 0, 100)
      : null;
    const label = safeText(verdict.label) || 'COMPARE';

    if (retzoScore) retzoScore.textContent = `${score}`;
    if (retzoLabel) {
      retzoLabel.textContent = label;
      retzoLabel.classList.remove('strong', 'good', 'caution');
      if (label === 'STRONG BUY') retzoLabel.classList.add('strong');
      else if (label === 'GOOD BUY') retzoLabel.classList.add('good');
      else if (label === 'CAUTION')  retzoLabel.classList.add('caution');
    }

    if (scoreRing) {
      const degrees = score * 3.6;
      scoreRing.style.setProperty('--fill', `${degrees}deg`);
      scoreRing.style.setProperty('--ring-color',
        score >= 85 ? 'var(--kb-green)' : score >= 70 ? 'var(--kb-skin)' : 'var(--kb-red)');
    }

    if (retzoConfidence)    retzoConfidence.textContent   = confidence != null ? `${confidence}% confidence` : '';
    if (retzoHeadline)      retzoHeadline.textContent     = safeText(verdict.headline) || 'KrazyBuy comparison complete.';
    if (retzoSummary)       retzoSummary.textContent      = safeText(verdict.summary);

    const reasons = Array.isArray(verdict.reasons) ? verdict.reasons : [];
    if (retzoReasonsWrap) retzoReasonsWrap.hidden = !reasons.length;
    if (retzoReasons) {
      retzoReasons.innerHTML = reasons.slice(0, 5).map(r => `<li>${escapeHtml(r)}</li>`).join('');
    }

    const warnings = Array.isArray(verdict.warnings) ? verdict.warnings : [];
    if (retzoWarningsWrap) retzoWarningsWrap.hidden = !warnings.length;
    if (retzoWarnings) {
      retzoWarnings.innerHTML = warnings.slice(0, 5).map(w => `<li>${escapeHtml(w)}</li>`).join('');
    }

    if (retzoRecommendation) {
      retzoRecommendation.textContent = safeText(verdict.recommendation) || 'Review the winning listing before checkout.';
    }
  }


  /* ==========================================================
     STORE TRUST
     FIX 8: include real url on fakeDeal so logo resolution works
  ========================================================== */

  function renderTrust(deals) {
    if (!trustPanel || !trustList) return;

    if (!deals.length) { trustPanel.hidden = true; return; }

    const grouped = new Map();

    for (const deal of deals) {
      const name  = storeName(deal);
      const key   = normalizeKey(name);
      if (!grouped.has(key)) {
        grouped.set(key, {
          name,
          url: deal.url || '',   // FIX 8: keep url for logo resolution
          verified: 0,
          storeIdentified: 0,
          unverified: 0,
          total: 0,
          available: 0
        });
      }
      const entry = grouped.get(key);
      entry.total += 1;
      const status = String(deal.verificationStatus || '').toUpperCase();
      if (status === 'VERIFIED') entry.verified += 1;
      else if (status === 'STORE_IDENTIFIED') entry.storeIdentified += 1;
      else entry.unverified += 1;
      if (isDealAvailable(deal)) entry.available += 1;
    }

    trustPanel.hidden   = false;
    trustList.innerHTML = [...grouped.values()].slice(0, 10).map(entry => {
      let label = `${entry.unverified} unverified`;
      if (entry.verified > 0) label = `${entry.verified} verified`;
      else if (entry.storeIdentified > 0) label = `${entry.storeIdentified} store identified · verification not confirmed`;

      // FIX 8: pass a real deal-like object so logoUrlForStore can extract domain
      const fakeDeal = { store: entry.name, url: entry.url };

      return `
        <div class="trust-row">
          ${storeMonogram(fakeDeal)}
          <div class="t-copy">
            <strong>${escapeHtml(entry.name)}</strong>
            <span>${entry.total} listing${entry.total === 1 ? '' : 's'} · ${entry.available} available · ${escapeHtml(label)}</span>
          </div>
        </div>`;
    }).join('');

    attachLogoFallbacks(trustList);
  }


  /* ==========================================================
     DEBUG
  ========================================================== */

  function renderDebug(result) {
    const debugEnabled = new URLSearchParams(location.search).get('debug') === '1';
    if (!debugPanel) return;
    if (!debugEnabled) { debugPanel.hidden = true; return; }

    debugPanel.hidden = false;
    const events = result?.debug?.upstreamEventCount ?? result?.meta?.eventsCaptured ?? 0;
    if (debugEventCount) debugEventCount.textContent = `${events} events`;
    if (debugOutput) {
      debugOutput.textContent = JSON.stringify(
        { schemaVersion: result?.schemaVersion, meta: result?.meta, comparison: result?.comparison, retzo: result?.retzo },
        null, 2
      );
    }
  }


  /* ==========================================================
     RECENT SEARCHES
  ========================================================== */

  const RECENT_KEY = 'krazybuy_recent_comparisons';

  function getRecent() {
    try {
      const value = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveRecent(result, url) {
    if (!url) return;
    const current = getRecent();
    const product = result?.product || {};
    const item = {
      url,
      name:      product.name   || 'Product',
      brand:     product.brand  || '',
      variant:   variantParts(product).join(' · '),
      price:     result?.comparison?.bestPrice?.effectivePrice ?? result?.product?.price ?? null,
      currency:  product.currency || 'INR',
      image:     product.thumbnail || product.images?.[0] || '',
      updatedAt: new Date().toISOString()
    };
    const filtered = current.filter(prev => prev.url !== url);
    filtered.unshift(item);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, 8))); } catch {}
  }

  function renderRecent() {
    if (!recentList) return;
    const items = getRecent();
    if (recentCountLabel) {
      recentCountLabel.textContent = items.length ? `${items.length}` : '';
      recentCountLabel.hidden = !items.length;
    }

    if (!items.length) {
      recentList.innerHTML = `<div class="history-empty"><span>◌</span><p>No comparisons yet.</p><small>Your searched products will appear here.</small></div>`;
      return;
    }

    const groups = {};
    items.forEach((item, index) => {
      const date = new Date(item.updatedAt || Date.now());
      const key = new Date().toDateString() === date.toDateString() ? 'Today' : 'Earlier';
      (groups[key] ||= []).push({ item, index });
    });

    recentList.innerHTML = ['Today','Earlier'].filter(k => groups[k]?.length).map(group => `
      <div class="history-group">
        <div class="history-group-title">${group}</div>
        ${groups[group].map(({item,index}) => `
          <button class="history-item" type="button" data-recent-open="${index}" title="${escapeHtml(item.name)}">
            <span class="history-thumb">${validHttpUrl(item.image) ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy">` : 'KB'}</span>
            <span class="history-main">
              <strong>${escapeHtml(truncate(item.name, 34))}</strong>
              <span>${escapeHtml(item.variant || 'Product comparison')}</span>
            </span>
            <span class="history-price">${item.price != null ? escapeHtml(money(item.price, item.currency)) : '—'}</span>
            <span class="history-more" data-recent-remove="${index}" aria-label="Remove comparison">×</span>
          </button>`).join('')}
      </div>`).join('');

    recentList.querySelectorAll('[data-recent-open]').forEach(btn => {
      btn.addEventListener('click', event => {
        if (event.target.closest('[data-recent-remove]')) return;
        const item = items[Number(btn.dataset.recentOpen)];
        if (item?.url) {
          urlInput.value = item.url;
          closeSidebar();
          void compare(item.url);
        }
      });
    });

    recentList.querySelectorAll('[data-recent-remove]').forEach(btn => {
      btn.addEventListener('click', event => {
        event.stopPropagation();
        const latest = getRecent();
        latest.splice(Number(btn.dataset.recentRemove), 1);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(latest)); } catch {}
        renderRecent();
      });
    });
  }


  /* ==========================================================
     JOB
  ========================================================== */

  async function compare(url) {
    if (!validHttpUrl(url)) { urlError.hidden = false; return; }
    urlError.hidden = true;
    state.lastUrl = url;
    state.reconnectAttempts = 0;
    if (state.compareController) { try { state.compareController.abort(); } catch {} }
    closeSSE();
    if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }

    const controller = new AbortController();
    state.compareController = controller;
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    setCompareLoading(true);
    startProgress();

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });

      let data = null;
      try { data = await response.json(); } catch { throw new Error('Backend returned invalid JSON.'); }
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      if (!data?.jobId) throw new Error('Backend did not return a job ID.');

      if (controller.signal.aborted || state.compareController !== controller) return;
      state.jobId = data.jobId;
      connectSSE(state.jobId);
    } catch (error) {
      if (error?.name === 'AbortError' && state.compareController !== controller) return;
      console.error('[KRAZYBUY] Compare failed:', error);
      fail(error?.name === 'AbortError' ? 'The comparison request timed out. Please try again.' : (error?.message || 'Comparison failed.'));
    } finally {
      clearTimeout(timeoutId);
      if (state.compareController === controller) state.compareController = null;
    }
  }


  /* ==========================================================
     SSE
  ========================================================== */

  function closeSSE() {
    if (state.source) {
      try { state.source.close(); } catch {}
      state.source = null;
    }
  }

  function connectSSE(jobId) {
    closeSSE();
    if (!jobId) return;

    const url    = `/api/jobs/${encodeURIComponent(jobId)}/events`;
    console.log('[KRAZYBUY] SSE:', url);
    const source = new EventSource(apiUrl(url));
    state.source = source;

    source.onopen = () => {
      console.log('[KRAZYBUY] SSE connected.');
      updateProgress('Live comparison', 'Connection established. Receiving normalized data…', 30, [
        { label: 'Job created',      state: 'done'   },
        { label: 'Live stream',      state: 'active' },
        { label: 'Normalize offers', state: ''       },
        { label: 'Retzo',            state: ''       }
      ]);
    };

    source.onmessage = event => {
      let packet;
      try { packet = JSON.parse(event.data); } catch { return; }
      handlePacket(packet);
    };

    ['connected', 'pipeline', 'upstream', 'job', 'result', 'error'].forEach(eventName => {
      source.addEventListener(eventName, event => {
        let packet;
        try { packet = JSON.parse(event.data); } catch { return; }
        if (!packet.type) packet.type = eventName;
        handlePacket(packet);
      });
    });

    source.onerror = async () => {
      console.warn('[KRAZYBUY] SSE reconnect/fallback.');
      try { source.close(); } catch {}
      if (state.source === source) state.source = null;
      if (state.jobId !== jobId) return;

      try {
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (state.jobId !== jobId) return;
        if (data.status === 'complete' && data.result) {
          finishComparison(data.result, state.lastUrl);
          setCompareLoading(false);
          return;
        }
        if (data.status === 'failed') { fail(data.error || 'Comparison failed.'); return; }

        if (data.status === 'queued' || data.status === 'running') {
          state.reconnectAttempts = Math.min(state.reconnectAttempts + 1, 7);
          if (state.reconnectAttempts > 6) {
            fail('The live stream keeps disconnecting. Please retry the comparison.');
            return;
          }
          const delay = Math.min(1000 * (2 ** (state.reconnectAttempts - 1)), 8000);
          if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
          state.reconnectTimer = setTimeout(() => {
            state.reconnectTimer = null;
            if (state.jobId === jobId) connectSSE(jobId);
          }, delay);
        }
      } catch (error) {
        console.error('[KRAZYBUY] SSE fallback failed:', error);
        state.reconnectAttempts = Math.min(state.reconnectAttempts + 1, 7);
        if (state.reconnectAttempts > 6) {
          fail('The comparison service could not be reached. Please retry.');
          return;
        }
        const delay = Math.min(1000 * (2 ** (state.reconnectAttempts - 1)), 8000);
        state.reconnectTimer = setTimeout(() => {
          state.reconnectTimer = null;
          if (state.jobId === jobId) connectSSE(jobId);
        }, delay);
      }
    };
  }

  function handlePacket(packet) {
    if (!packet) return;

    if (packet.type === 'connected') {
      updateProgress('Live comparison', 'Live comparison stream connected…', 25, [
        { label: 'Job created',      state: 'done'   },
        { label: 'Live stream',      state: 'active' },
        { label: 'Normalize offers', state: ''       },
        { label: 'Retzo',            state: ''       }
      ]);
      return;
    }

    if (packet.type === 'pipeline') { handlePipeline(packet); return; }

    if (packet.type === 'upstream') {
      updateProgress('Collecting offers', `Receiving marketplace data… ${packet.index || ''} events`,
        Math.min(70, 30 + (Number(packet.index) || 0) * 1.2), [
          { label: 'Job created',      state: 'done'   },
          { label: 'Live stream',      state: 'done'   },
          { label: 'Normalize offers', state: 'active' },
          { label: 'Retzo',            state: ''       }
        ]);
      return;
    }

    if (packet.type === 'job') {
      if (packet.status === 'running') {
        updateProgress('Comparing offers', 'KrazyBuy is processing the comparison…', 48, [
          { label: 'Job created',      state: 'done'   },
          { label: 'Live stream',      state: 'done'   },
          { label: 'Normalize offers', state: 'active' },
          { label: 'Retzo',            state: ''       }
        ]);
      }
      if (packet.status === 'failed') fail(packet.error || 'Comparison failed.');
      return;
    }

    if (packet.type === 'result') {
      const result = packet.result || packet.data || packet.payload || packet;
      updateProgress('Complete', 'Comparison complete.', 100, [
        { label: 'Job created',      state: 'done' },
        { label: 'Live stream',      state: 'done' },
        { label: 'Normalize offers', state: 'done' },
        { label: 'Retzo verdict',    state: 'done' }
      ]);
      finishComparison(result, state.lastUrl);
      state.reconnectAttempts = 0;
      if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
      stopProgress();
      setCompareLoading(false);
      // FIX 2: closeSSE is safe here — guard inside closeSSE handles null source
      closeSSE();
      return;
    }
  }


  /* ==========================================================
     NAVIGATION
  ========================================================== */

  function closeSidebar() {
    sidebar?.classList.remove('open');
    if (sidebarOverlay) sidebarOverlay.hidden = true;
    menuBtn?.setAttribute('aria-expanded', 'false');
  }

  function openSidebar() {
    sidebar?.classList.add('open');
    if (sidebarOverlay) sidebarOverlay.hidden = false;
    menuBtn?.setAttribute('aria-expanded', 'true');
  }

  function navigate(target) {
    const normalized = String(target || '').replace('#', '').trim();
    if (normalized === 'results' && state.lastResult) {
      state.view = 'results';
      showOnlyView('results');
    } else {
      newComparison();
    }
    closeSidebar();
  }

  function showOnlyView(id) {
    if (id === 'results' && state.lastResult) {
      setHidden(results, false);
      setHidden(document.getElementById('home'), true);
    } else {
      setHidden(results, true);
      setHidden(document.getElementById('home'), false);
      state.view = 'home';
    }
  }

  function newComparison() {
    if (state.compareController) { try { state.compareController.abort(); } catch {} state.compareController = null; }
    if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
    closeSSE();
    stopProgress();
    state.jobId = null;
    state.lastResult = null;
    state.lastCompletedResult = null;
    state.lastImages = [];
    setHidden(errorPanel, true);
    setHidden(results, true);
    setHidden(progressPanel, true);
    setCompareLoading(false);
    if (urlInput) urlInput.value = '';
    state.view = 'home';
    setHidden(document.getElementById('home'), false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => urlInput?.focus(), 120);
  }


  /* ==========================================================
     AUTH
  ========================================================== */

  function handleAuth(action = 'login') {
    window.dispatchEvent(new CustomEvent('krazybuy:auth', { detail: { action } }));
    console.log('[KRAZYBUY] Auth action:', action);
    alert(action === 'signup'
      ? 'KrazyBuy sign-up is ready to connect to your login system.'
      : 'KrazyBuy login is ready to connect to your login system.');
  }


  /* ==========================================================
     RETRY
  ========================================================== */

  function retry() {
    if (state.lastUrl) { void compare(state.lastUrl); return; }
    urlInput?.focus();
  }


  /* ==========================================================
     EVENT LISTENERS
  ========================================================== */

  form?.addEventListener('submit', event => {
    event.preventDefault();
    const url = safeText(urlInput?.value);
    if (!validHttpUrl(url)) { urlError.hidden = false; urlInput?.focus(); return; }
    urlError.hidden = true;
    try { localStorage.setItem('krazybuy_last_url', url); } catch {}
    void compare(url);
  });

  errorRetry?.addEventListener('click', retry);
  newComparisonBtn?.addEventListener('click', newComparison);
  sidebarCloseBtn?.addEventListener('click', closeSidebar);


  sidebarOverlay?.addEventListener('click', closeSidebar);

  $$('.nav-item[data-nav]').forEach(nav => {
    nav.addEventListener('click', event => { event.preventDefault(); navigate(nav.dataset.nav); });
  });

  $$('.footer-cols a[data-nav]').forEach(link => {
    link.addEventListener('click', event => { event.preventDefault(); navigate(link.dataset.nav); });
  });

  $$('.footer-cols a[data-auth]').forEach(link => {
    link.addEventListener('click', event => { event.preventDefault(); handleAuth(link.dataset.auth); });
  });

  authBtn?.addEventListener('click', () => handleAuth('login'));

  const productMenu = document.getElementById('productMenu');
  const productMenuRefresh = document.getElementById('productMenuRefresh');
  const productMenuTop = document.getElementById('productMenuTop');
  const resultBack = document.getElementById('resultBack');
  const resultNewComparison = document.getElementById('resultNewComparison');

  function closeProductMenu() {
    if (productMenu) productMenu.hidden = true;
    menuBtn?.setAttribute('aria-expanded', 'false');
  }
  function toggleProductMenu() {
    if (!productMenu || !IS_PRODUCT_PAGE) return;
    productMenu.hidden = !productMenu.hidden;
    menuBtn?.setAttribute('aria-expanded', String(!productMenu.hidden));
  }
  menuBtn?.addEventListener('click', () => {
    if (IS_PRODUCT_PAGE) toggleProductMenu();
    else { sidebar?.classList.contains('open') ? closeSidebar() : openSidebar(); }
  });
  productMenu?.addEventListener('click', event => event.stopPropagation());
  productMenuRefresh?.addEventListener('click', () => {
    closeProductMenu();
    location.reload();
  });
  productMenuTop?.addEventListener('click', () => {
    closeProductMenu();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  resultBack?.addEventListener('click', () => { window.location.href = 'index.html'; });
  resultNewComparison?.addEventListener('click', () => { window.location.href = 'index.html'; });
  document.addEventListener('click', event => {
    if (IS_PRODUCT_PAGE && productMenu && !productMenu.hidden && !productMenu.contains(event.target) && event.target !== menuBtn) closeProductMenu();
  });

  viewAllImages?.addEventListener('click', () => openLightbox(state.currentImageIndex));
  productImage?.addEventListener('click',  () => openLightbox(state.currentImageIndex));
  lightboxClose?.addEventListener('click', closeLightbox);
  lightboxPrev?.addEventListener('click', () => moveLightbox(-1));
  lightboxNext?.addEventListener('click', () => moveLightbox(1));

  bpCopy?.addEventListener('click', async () => {
    const url = safeText(bpOpen?.href || state.lastUrl);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      bpCopy.textContent = 'Copied ✓';
      setTimeout(() => { bpCopy.textContent = 'Copy link'; }, 1400);
    } catch {
      window.prompt('Copy this link:', url);
    }
  });

  bpShare?.addEventListener('click', async () => {
    const url = safeText(bpOpen?.href || state.lastUrl);
    const title = safeText(productName?.textContent) || 'KrazyBuy comparison';
    try {
      if (navigator.share) await navigator.share({ title, text: 'KrazyBuy price comparison', url });
      else { await navigator.clipboard.writeText(url); bpShare.textContent = 'Link copied ✓'; setTimeout(() => { bpShare.textContent = 'Share result ↗'; }, 1400); }
    } catch {}
  });
  lightbox?.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeLightbox(); closeSidebar(); closeProductMenu?.(); }
    if (!lightbox?.hidden && event.key === 'ArrowLeft') moveLightbox(-1);
    if (!lightbox?.hidden && event.key === 'ArrowRight') moveLightbox(1);
    if ((event.key === '/' && !/input|textarea/i.test(document.activeElement?.tagName || '')) || (event.ctrlKey && event.key.toLowerCase() === 'k')) {
      event.preventDefault();
      if (state.view !== 'home') newComparison();
      closeSidebar();
      urlInput?.focus();
    }
  });

  descToggle?.addEventListener('click', () => {
    if (!productDescFull) return;
    const expanded = productDescFull.classList.contains('expanded');
    productDescFull.classList.toggle('clamped',  expanded);
    productDescFull.classList.toggle('expanded', !expanded);
    descToggle.textContent = expanded ? 'Show more' : 'Show less';
  });

  window.addEventListener('popstate', () => {
    navigate(location.hash.replace('#', '') || 'home');
  });


  /* ==========================================================
     BOOT
     FIX 4: renderRecent() after DOM is ready (already in DOMContentLoaded),
     but now ordered explicitly after all setup is complete
  ========================================================== */

  initTheme();
  renderMarketplaces();
  renderRecent();

  if (IS_PRODUCT_PAGE) {
    setHidden(document.getElementById('home'), true);
    setHidden(progressPanel, true);
    setHidden(errorPanel, true);
    setHidden(results, true);
    let savedResult = null;
    try {
      const raw = sessionStorage.getItem('krazybuy_product_result');
      if (raw) savedResult = JSON.parse(raw);
      const savedUrl = sessionStorage.getItem('krazybuy_product_url');
      if (savedUrl) state.lastUrl = savedUrl;
    } catch (error) {
      console.warn('[KRAZYBUY] Could not restore product result:', error);
    }
    if (savedResult) finishComparison(savedResult, state.lastUrl);
    else {
      setHidden(results, false);
      if (productName) productName.textContent = 'No product loaded';
      if (variantLine) variantLine.textContent = 'Start a comparison from the search page.';
    }
  } else {
    showOnlyView('home');
  }

  void checkHealth();
  console.info(`[KrazyBuy] frontend bridge → ${API_BASE || 'same-origin'} · Retz 1.0 · Powered by Retzo AI`);
  setInterval(() => {
    if (!document.hidden) void checkHealth();
  }, 30000);

  try {
    const lastUrl = localStorage.getItem('krazybuy_last_url');
    if (lastUrl && urlInput) urlInput.value = lastUrl;
  } catch {}

  console.log('[KRAZYBUY] Frontend initialized.');

});