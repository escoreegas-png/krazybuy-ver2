'use strict';

/**
 * KRAZYBUY PRICE INTELLIGENCE ENGINE — PRODUCTION V5
 *
 * PIPELINE
 *   BROWSER
 *      -> POST /api/jobs
 *   JOB ORCHESTRATOR
 *      -> upstream search -> COMPLETE SSE COLLECTION
 *
 * STAGE 1  STRUCTURE + PRESERVATION
 * STAGE 2  DETERMINISTIC NORMALIZATION + PRODUCT MATCHING
 * STAGE 3  DETERMINISTIC PRICE / STORE / VERIFICATION ANALYSIS
 * STAGE 4  ONE RETZ 1.0 AI VERDICT
 * STAGE 5  FINAL KRAZYBUY JSON CONTRACT
 *
 * PRINCIPLE
 *   CODE = FACTS
 *   RETZ = JUDGMENT
 *
 * KEY MANAGER
 * - Rolling 60-second token window per Groq key.
 * - Lowest-load / lowest-token eligible key is selected.
 * - 429/5xx/timeout failures cooldown the affected key.
 * - Schema-validation 400s DO NOT cooldown the key.
 * - One final Retz request per job; key failover is allowed only if
 *   the request is retryable and another key is available.
 *
 * VERIFICATION
 * - VERIFIED only when upstream explicitly signals verification.
 * - Recognized store domain != verified listing.
 * - No domain is treated as proof of authenticity.
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');

const app = express();

/* ============================================================
   CONFIG
============================================================ */

const PORT = Number(process.env.PORT || 5174);
const UPSTREAM_BASE_API = process.env.SAVE8_BASE_API || 'https://prod-api.save8.ai';
const UPSTREAM_SEARCH_PATH = process.env.SAVE8_SEARCH_PATH || '/v2/product-compare/search';
const CONNECT_TIMEOUT = Number(process.env.CONNECT_TIMEOUT || 20000);
const STREAM_TIMEOUT = Number(process.env.STREAM_TIMEOUT || 120000);
const MAX_JOBS = Number(process.env.MAX_JOBS || 100);

const GROQ_ENDPOINT = process.env.GROQ_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_TIMEOUT = Number(process.env.GROQ_TIMEOUT || 25000);
const GROQ_MAX_KEYS = Math.max(1, Math.min(16, Number(process.env.GROQ_MAX_KEYS || 7)));
const GROQ_COOLDOWN_MS = Number(process.env.GROQ_COOLDOWN_MS || 15000);
const GROQ_TPM_LIMIT = Number(process.env.GROQ_TPM_LIMIT || 7600);
const GROQ_MAX_TPM_WAIT = Number(process.env.GROQ_MAX_TPM_WAIT || 15000);
const RETZO_TOKEN_RESERVE = Math.max(1200, Number(process.env.RETZO_TOKEN_RESERVE || 2400));

const RETZO_MAX_EXACT = Number(process.env.RETZO_MAX_EXACT || 10);
const RETZO_MAX_ALTS = Number(process.env.RETZO_MAX_ALTS || 5);
const RETZO_MAX_RELATED = Number(process.env.RETZO_MAX_RELATED || 4);
const RETZO_MAX_SUSPICIOUS = Number(process.env.RETZO_MAX_SUSPICIOUS || 4);

const GROQ_RETRYABLE_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);
const GROQ_SCHEMA_STATUS = 400;

/* ============================================================
   GROQ KEY MANAGER
============================================================ */

function getEnvGroqKeys() {
    const keys = [];
    const add = value => {
        const key = String(value || '').trim();
        if (key && !keys.includes(key)) keys.push(key);
    };

    add(process.env.GROQ_API_KEY);
    for (let i = 1; i <= GROQ_MAX_KEYS; i += 1) add(process.env[`GROQ_API_KEY_${i}`]);
    if (process.env.GROQ_API_KEYS) {
        for (const key of String(process.env.GROQ_API_KEYS).split(',')) add(key);
    }
    return keys;
}

function getGroqModel(index) {
    return process.env[`GROQ_MODEL_${index}`] || process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
}

const GROQ_KEYS = getEnvGroqKeys().map((key, index) => ({
    id: index,
    key,
    model: getGroqModel(index),
    cooldownUntil: 0,
    inFlight: 0,
    failures: 0,
    successes: 0,
    lastUsedAt: 0,
    tokenWindow: []
}));

function groqEnabled() {
    return GROQ_KEYS.length > 0;
}

function pruneKeyWindow(item) {
    const cutoff = Date.now() - 60000;
    while (item.tokenWindow.length && item.tokenWindow[0].at < cutoff) item.tokenWindow.shift();
}

function keyTokensUsed(item) {
    pruneKeyWindow(item);
    return item.tokenWindow.reduce((sum, entry) => sum + entry.tokens, 0);
}

function recordKeyTokens(item, tokens, purpose = 'RETZO') {
    const entry = { at: Date.now(), tokens: Math.max(1, Number(tokens) || 1), purpose };
    item.tokenWindow.push(entry);
    return entry;
}

function tokensUsedLastMinute() {
    return GROQ_KEYS.reduce((sum, item) => sum + keyTokensUsed(item), 0);
}

function estimateTokens(text) {
    return Math.max(1, Math.ceil(String(text || '').length / 3.5));
}

function parseRetryAfterMs(response, bodyText = '') {
    const header = response?.headers?.get?.('retry-after');
    if (header) {
        const seconds = Number(header);
        if (Number.isFinite(seconds)) return Math.max(250, seconds * 1000);
        const date = Date.parse(header);
        if (Number.isFinite(date)) return Math.max(250, date - Date.now());
    }

    const match = String(bodyText).match(/(?:retry(?:-after)?|try again in)\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(ms|seconds?|s)?/i);
    if (match) {
        const value = Number(match[1]);
        const unit = String(match[2] || 'seconds').toLowerCase();
        if (Number.isFinite(value)) return unit === 'ms' ? Math.max(250, value) : Math.max(250, value * 1000);
    }
    return GROQ_COOLDOWN_MS;
}

function isGroqSchemaValidationError(status, body) {
    if (Number(status) !== GROQ_SCHEMA_STATUS) return false;
    const text = String(body || '').toLowerCase();
    return text.includes('json_validate_failed') ||
        text.includes('jsonschema') ||
        text.includes('does not match the expected schema') ||
        text.includes('invalid json schema for response_format');
}

function keyHasBudget(item, estimated) {
    return keyTokensUsed(item) + estimated <= GROQ_TPM_LIMIT;
}

function pickGroqKey(excluded, estimated) {
    if (!groqEnabled()) return null;
    const nowMs = Date.now();
    let best = null;

    for (const item of GROQ_KEYS) {
        if (excluded.has(item.id)) continue;
        if (item.cooldownUntil > nowMs) continue;
        if (!keyHasBudget(item, estimated)) continue;

        if (!best || item.inFlight < best.inFlight) {
            best = item;
            continue;
        }

        if (item.inFlight === best.inFlight) {
            const itemUsed = keyTokensUsed(item);
            const bestUsed = keyTokensUsed(best);
            if (itemUsed < bestUsed || (itemUsed === bestUsed && item.lastUsedAt < best.lastUsedAt)) best = item;
        }
    }

    if (best) best.lastUsedAt = nowMs;
    return best;
}

async function acquireGroqKey(excluded, estimated) {
    const started = Date.now();

    while (true) {
        const key = pickGroqKey(excluded, estimated);
        if (key) return key;
        if (GROQ_KEYS.every(item => excluded.has(item.id))) return null;
        if (Date.now() - started > GROQ_MAX_TPM_WAIT) throw new Error('Retz token budget wait exceeded.');

        console.warn(
            `[TPM/RETZO] waiting · used=${tokensUsedLastMinute()} · ` +
            `poolLimit=${GROQ_KEYS.length * GROQ_TPM_LIMIT} · estimated=${estimated}`
        );
        await sleep(500);
    }
}

function markGroqFailure(item, retryMs) {
    item.failures += 1;
    item.cooldownUntil = Math.max(item.cooldownUntil, Date.now() + Math.max(250, retryMs || GROQ_COOLDOWN_MS));
}

function markGroqSuccess(item) {
    item.successes += 1;
    item.failures = Math.max(0, item.failures - 1);
    item.cooldownUntil = 0;
}

function groqPublicState() {
    return GROQ_KEYS.map(item => ({
        id: item.id + 1,
        model: item.model,
        cooldown: Math.max(0, item.cooldownUntil - Date.now()),
        inFlight: item.inFlight,
        failures: item.failures,
        successes: item.successes,
        tokensUsedLastMinute: keyTokensUsed(item),
        tpmLimit: GROQ_TPM_LIMIT
    }));
}

/* ============================================================
   JOB STORAGE / HELPERS
============================================================ */

const jobs = new Map();

function now() { return new Date().toISOString(); }
function createId() { return crypto.randomUUID(); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function safeJson(value) { try { return JSON.stringify(value); } catch { return '{}'; } }

function stringValue(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return '';
}

function numberValue(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const text = String(value).trim();
    if (!text) return null;
    const cleaned = text.replace(/,/g, '').replace(/[^\d.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}

function uniqueBy(items, keyFn) {
    const seen = new Set();
    const result = [];
    for (const item of items) {
        const key = keyFn(item);
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(item);
    }
    return result;
}

function isHttpUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch { return false; }
}

function normalizeText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[™®©]/g, '')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9.]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function canonicalUrl(value) {
    if (!value) return '';
    try {
        const url = new URL(value);
        url.hash = '';
        for (const key of ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref','ref_','tag','affid','gclid','fbclid']) {
            url.searchParams.delete(key);
        }
        return url.toString();
    } catch { return String(value).trim(); }
}

function truncate(value, max) {
    const text = String(value || '');
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function median(values) {
    const clean = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!clean.length) return null;
    const middle = Math.floor(clean.length / 2);
    return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

function parseJsonContent(content) {
    if (!content) throw new Error('AI returned no content.');
    if (typeof content !== 'string') return content;
    try { return JSON.parse(content); } catch {}
    const cleaned = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    return JSON.parse(cleaned);
}

function cleanupJobs() {
    while (jobs.size > MAX_JOBS) {
        const oldestId = jobs.keys().next().value;
        if (!oldestId) break;
        const oldJob = jobs.get(oldestId);
        if (oldJob?.clients) for (const client of oldJob.clients) { try { client.end(); } catch {} }
        jobs.delete(oldestId);
    }
}

/* ============================================================
   EXPRESS + SSE
============================================================ */

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'frontend')));

function publish(job, event) {
    job.latestEvent = event;
    const packet = `data: ${safeJson(event)}\n\n`;
    for (const client of job.clients) {
        try { if (!client.writableEnded) client.write(packet); } catch {}
    }
}

function publishPipeline(job, step, content) {
    publish(job, {
        type: 'pipeline', jobId: job.id, timestamp: now(),
        event: { type: 'system', step, content, status: 'in-progress', timestamp: now() }
    });
}

function setJobStatus(job, status, extra = {}) {
    job.status = status;
    job.updatedAt = now();
    publish(job, { type: 'job', jobId: job.id, status, timestamp: job.updatedAt, ...extra });
}

function storeStreamEvent(job, data) {
    const item = {
        eventId: job.streamEvents.length + 1,
        receivedAt: now(),
        type: stringValue(data?.type, data?.event, data?.step) || 'unknown',
        data
    };
    job.streamEvents.push(item);
    if (item.eventId === 1 || item.eventId % 8 === 0) {
        publishPipeline(job, 'stream-reading', `Receiving store and pricing data… (${item.eventId} events)`);
    }
    return item;
}

function walk(value, callback, depth = 0, visited = new Set()) {
    if (value === null || value === undefined || depth > 18) return;
    if (typeof value === 'object') {
        if (visited.has(value)) return;
        visited.add(value);
    }
    callback(value);
    if (Array.isArray(value)) {
        for (const child of value) walk(child, callback, depth + 1, visited);
        return;
    }
    if (isObject(value)) for (const child of Object.values(value)) walk(child, callback, depth + 1, visited);
}

/* ============================================================
   VARIANT EXTRACTION
============================================================ */

const COLORS = [
    'cosmic orange','natural titanium','desert titanium','deep blue','space black','urban olive',
    'noir black','lilac purple','sage green','starlight','midnight','silver','black','white',
    'gold','blue','orange','purple','green','red','pink','yellow'
].sort((a, b) => b.length - a.length);

function extractRam(text) {
    const value = String(text || '');
    let match = value.match(/(\d+(?:\.\d+)?)\s*GB\s*(?:RAM|memory)\b/i);
    if (match) return `${match[1]}gb`;
    match = value.match(/\bRAM\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*GB\b/i);
    if (match) return `${match[1]}gb`;
    match = value.match(/(\d+)\s*GB\s*[+\/|]\s*(\d+)\s*(GB|TB)/i);
    if (match) return `${match[1]}gb`;
    return '';
}

function extractStorage(text) {
    const value = String(text || '');
    let match = value.match(/(\d+(?:\.\d+)?)\s*TB\b/i);
    if (match) return `${match[1]}tb`;
    match = value.match(/(\d+(?:\.\d+)?)\s*GB\s*(?:ROM|storage|internal)/i);
    if (match) return `${match[1]}gb`;
    match = value.match(/\b(?:ROM|storage)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*GB\b/i);
    if (match) return `${match[1]}gb`;
    match = value.match(/(\d+)\s*GB\s*[+\/|]\s*(\d+)\s*(GB|TB)/i);
    if (match) return `${match[2]}${match[3].toLowerCase()}`;
    const ram = extractRam(value);
    const ramNum = ram ? parseFloat(ram) : null;
    const all = [...value.matchAll(/(\d+(?:\.\d+)?)\s*GB\b/gi)].map(m => parseFloat(m[1])).filter(Number.isFinite);
    const candidates = all.filter(n => n !== ramNum);
    if (candidates.length === 1 && candidates[0] >= 32) return `${candidates[0]}gb`;
    if (candidates.length > 1) return `${Math.max(...candidates)}gb`;
    return '';
}

function extractColors(text) {
    const normalized = ` ${normalizeText(text)} `;
    return COLORS.filter(color => normalized.includes(` ${color} `));
}

/* ============================================================
   PRODUCT IDENTITY
============================================================ */

function extractIdentity(product) {
    const name = stringValue(product?.name, product?.title, product?.productName, product?.product_name, product?.displayName, product?.display_name);
    const brand = stringValue(product?.brand, product?.brandName, product?.brand_name, product?.manufacturer);
    const model = stringValue(product?.model, product?.modelName, product?.model_name, product?.productModel, product?.product_model);
    const variant = product?.variant;
    const variantString = typeof variant === 'string' ? variant : (isObject(variant) ? Object.values(variant).join(' ') : '');
    const combined = [
        name, brand, model, variantString,
        product?.storage, product?.storageCapacity, product?.capacity, product?.rom, product?.internalStorage,
        product?.color, product?.colour, product?.ram, product?.memory, product?.ramCapacity,
        product?.description, product?.specifications ? safeJson(product.specifications) : ''
    ].filter(Boolean).join(' ');

    const explicitRam = stringValue(product?.ram, product?.memory, product?.ramCapacity, product?.ram_capacity);
    const explicitStorage = stringValue(product?.storage, product?.storageCapacity, product?.storage_capacity, product?.capacity, product?.rom, product?.internalStorage);
    const ram = extractRam(explicitRam ? `${explicitRam} RAM` : combined) || extractRam(combined);
    const storage = extractStorage(explicitStorage ? `${explicitStorage} storage` : combined) || extractStorage(combined);
    const colors = extractColors(combined);
    const explicitColor = normalizeText(product?.color || product?.colour || '');
    const color = explicitColor || colors[0] || '';
    return { name, brand, model, storage, ram, color, colors, text: normalizeText(combined) };
}

/* ============================================================
   STORE NORMALIZATION
============================================================ */

const STORE_RULES = [
    { name: 'Amazon', domains: ['amazon.in','amazon.com','amazon.ae','amazon.co.uk'] },
    { name: 'Flipkart', domains: ['flipkart.com'] },
    { name: 'Croma', domains: ['croma.com'] },
    { name: 'Vijay Sales', domains: ['vijaysales.com'] },
    { name: 'Reliance Digital', domains: ['reliancedigital.in'] },
    { name: 'Sangeetha Mobiles', domains: ['sangeethamobiles.com'] },
    { name: 'Bajaj Electronics', domains: ['bajajelectronics.com'] },
    { name: 'Poorvika', domains: ['poorvika.com'] },
    { name: 'Vasanth & Co', domains: ['vasanthandco.in'] },
    { name: 'Sathya', domains: ['sathya.store','sathyamobiles.com'] },
    { name: 'Imagine', domains: ['imagineonline.store'] },
    { name: 'Apple', domains: ['apple.com'] },
    { name: 'JioStore', domains: ['jiostore.online'] },
    { name: 'JioMart', domains: ['jiomart.com'] },
    { name: 'BuyHatke', domains: ['buyhatke.com'] }
];

function detectStoreFromUrl(url) {
    if (!url) return '';
    try {
        const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
        for (const rule of STORE_RULES) {
            if (rule.domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) return rule.name;
        }
    } catch {}
    return '';
}

function canonicalStore(fieldValue, url) {
    const urlStore = detectStoreFromUrl(url);
    if (urlStore) return urlStore;
    const text = normalizeText(fieldValue);
    for (const rule of STORE_RULES) {
        if (text && text.includes(normalizeText(rule.name))) return rule.name;
    }
    return fieldValue ? String(fieldValue).trim() : 'Independent seller';
}

/* ============================================================
   VERIFICATION
============================================================ */

function parseBooleanSignal(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
    }
    const text = normalizeText(value);
    if (!text) return null;
    if (['true','verified','yes','1'].includes(text)) return true;
    if (['false','unverified','no','0','not verified','rejected'].includes(text)) return false;
    return null;
}

function hostnameForUrl(url) {
    try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ''); } catch { return ''; }
}

function getExplicitVerification(raw) {
    const boolFields = [
        'isVerified','verified','is_verified',
        'sellerVerified','seller_verified',
        'merchantVerified','merchant_verified',
        'verifiedSeller','verified_seller',
        'storeVerified','store_verified'
    ];
    for (const field of boolFields) {
        if (!Object.prototype.hasOwnProperty.call(raw || {}, field)) continue;
        const parsed = parseBooleanSignal(raw[field]);
        if (parsed !== null) return { value: parsed, field, rawValue: raw[field] };
    }

    const statusFields = ['verificationStatus','verification_status','sellerVerificationStatus','seller_verification_status'];
    for (const field of statusFields) {
        if (!Object.prototype.hasOwnProperty.call(raw || {}, field)) continue;
        const parsed = parseBooleanSignal(raw[field]);
        if (parsed !== null) return { value: parsed, field, rawValue: raw[field] };
    }
    return null;
}

function buildVerification(raw, store, url) {
    const explicit = getExplicitVerification(raw);
    const hostname = hostnameForUrl(url);
    const recognizedStore = Boolean(detectStoreFromUrl(url));

    if (explicit?.value === true) {
        return {
            status: 'VERIFIED',
            level: 'EXPLICIT_UPSTREAM',
            label: 'Verified listing',
            reason: `Upstream explicitly marked this listing as verified (${explicit.field}).`,
            evidence: [explicit.field],
            storeIdentified: recognizedStore,
            domain: hostname || null
        };
    }

    if (explicit?.value === false) {
        return {
            status: 'UNVERIFIED',
            level: 'EXPLICIT_UPSTREAM_NEGATIVE',
            label: 'Unverified listing',
            reason: `Upstream explicitly marked this listing as unverified (${explicit.field}).`,
            evidence: [explicit.field],
            storeIdentified: recognizedStore,
            domain: hostname || null
        };
    }

    if (recognizedStore) {
        return {
            status: 'STORE_IDENTIFIED',
            level: 'DOMAIN_MATCH',
            label: 'Store identified',
            reason: `The retailer domain matches the recognized ${store} store domain; this does not prove listing verification.`,
            evidence: ['recognized_store_domain'],
            storeIdentified: true,
            domain: hostname || null
        };
    }

    return {
        status: 'UNVERIFIED',
        level: 'NO_EVIDENCE',
        label: 'Unverified listing',
        reason: 'No explicit verification evidence was supplied by the source.',
        evidence: [],
        storeIdentified: false,
        domain: hostname || null
    };
}

function verificationRank(value) {
    const status = String(value?.status || '').toUpperCase();
    if (status === 'VERIFIED') return 3;
    if (status === 'STORE_IDENTIFIED') return 2;
    return 1;
}

/* ============================================================
   PRODUCT DETECTION / EXTRACTION
============================================================ */

function productScore(value) {
    if (!isObject(value)) return -Infinity;
    const identity = extractIdentity(value);
    if (!identity.name) return -Infinity;
    let score = 30;
    if (identity.brand) score += 10;
    if (identity.model) score += 10;
    if (identity.storage) score += 10;
    if (identity.ram) score += 8;
    if (identity.color) score += 8;
    if (value.images || value.thumbnail || value.image) score += 5;
    if (value.specifications || value.specs) score += 5;
    if (value.description) score += 4;
    if (value.price !== undefined || value.currentPrice !== undefined || value.current_price !== undefined) score += 5;
    return score;
}

function findSourceProduct(events) {
    let best = null;
    let bestScore = -Infinity;
    let bestEventId = null;

    for (const item of events) {
        const isSourceEvent = /source[-_]?product/i.test(item.type) || item?.data?.type === 'source-product';
        const candidates = [item.data?.data?.product, item.data?.product, item.data?.productData, item.data?.product_data];
        for (const candidate of candidates) {
            const baseScore = productScore(candidate);
            let score = baseScore;
            if (isSourceEvent && Number.isFinite(score)) score += 25;
            if (score > bestScore) { best = candidate; bestScore = score; bestEventId = item.eventId; }
        }
    }

    for (const item of events) {
        walk(item.data, candidate => {
            const score = productScore(candidate);
            if (score > bestScore) { best = candidate; bestScore = score; bestEventId = item.eventId; }
        });
    }

    return { product: best || {}, eventId: bestEventId };
}

const OFFER_LIST_KEYS = [
    'deals','offers','listings','products','results','sourceListings','source_listings','listingDeals',
    'marketplaceOffers','marketplace_offers','priceComparison','price_comparison','shoppingResults',
    'shopping_results','merchantOffers','merchant_offers'
];

function looksLikeDeal(value) {
    if (!isObject(value)) return false;
    const price = numberValue(
        value.price ?? value.currentPrice ?? value.current_price ?? value.salePrice ?? value.sale_price ??
        value.listedPrice ?? value.listed_price ?? value.priceWithGiftCard ?? value.price_with_gift_card ??
        value.effectivePrice ?? value.effective_price
    );
    if (price === null || price <= 0) return false;
    return Boolean(
        value.url || value.productUrl || value.product_url || value.link || value.targetUrl ||
        value.title || value.name || value.store || value.platform || value.merchant || value.retailer ||
        value.sku || value.productId || value.product_id
    );
}

function collectRawDeals(events) {
    const deals = [];
    for (const item of events) {
        walk(item.data, value => {
            if (Array.isArray(value)) {
                for (const candidate of value) if (looksLikeDeal(candidate)) deals.push({ raw: candidate, eventId: item.eventId });
            }
            if (!isObject(value)) return;
            for (const key of OFFER_LIST_KEYS) {
                const list = value[key];
                if (!Array.isArray(list)) continue;
                for (const candidate of list) if (looksLikeDeal(candidate)) deals.push({ raw: candidate, eventId: item.eventId });
            }
        });
    }
    return deals;
}

/* ============================================================
   NORMALIZE CANDIDATE
============================================================ */

function normalizeCandidate(entry, candidateIndex) {
    const raw = entry.raw;
    if (!isObject(raw)) return null;

    const url = canonicalUrl(stringValue(raw.url, raw.productUrl, raw.product_url, raw.link, raw.targetUrl, raw.target_url));
    const rawStore = stringValue(
        raw.platformDisplayName, raw.platformName, raw.platform_name, raw.platform,
        raw.store, raw.storeName, raw.store_name, raw.retailer, raw.merchant, raw.merchantName, raw.seller
    );
    const store = canonicalStore(rawStore, url);
    const title = stringValue(raw.title, raw.name, raw.productName, raw.product_name, raw.displayName, raw.display_name);

    const listed = numberValue(raw.price ?? raw.currentPrice ?? raw.current_price ?? raw.salePrice ?? raw.sale_price ?? raw.listedPrice ?? raw.listed_price);
    const rewardAdjusted = numberValue(raw.priceWithGiftCard ?? raw.price_with_gift_card);
    const explicitEffective = numberValue(raw.effectivePrice ?? raw.effective_price);
    const original = numberValue(raw.originalPrice ?? raw.original_price ?? raw.mrp ?? raw.listPrice ?? raw.list_price);
    const anyPrice = listed ?? explicitEffective ?? rewardAdjusted;
    if (anyPrice === null || anyPrice <= 0) return null;

    const listedPrice = listed ?? anyPrice;
    const effectivePrice = explicitEffective ?? listedPrice;
    const stockRaw = stringValue(raw.stockStatus, raw.stock_status, raw.availability, raw.availabilityStatus, raw.availability_status);
    const unavailable = /out[\s_-]?of[\s_-]?stock|unavailable|sold[\s_-]?out/i.test(stockRaw);
    const availabilityStatus = unavailable ? 'unavailable' : (stockRaw ? 'available' : 'unknown');

    const combinedText = [
        title, url, raw.description, raw.storage, raw.storageCapacity, raw.capacity, raw.rom,
        raw.ram, raw.memory, raw.ramCapacity, raw.color, raw.colour,
        raw.variant ? safeJson(raw.variant) : ''
    ].filter(Boolean).join(' ');

    const explicitRam = stringValue(raw.ram, raw.memory, raw.ramCapacity);
    const explicitStorage = stringValue(raw.storage, raw.storageCapacity, raw.capacity, raw.rom, raw.internalStorage);
    const explicitColor = normalizeText(raw.color || raw.colour || '');
    const ram = extractRam(explicitRam ? `${explicitRam} RAM` : '') || extractRam(combinedText) || null;
    const storage = extractStorage(explicitStorage ? `${explicitStorage} storage` : '') || extractStorage(combinedText) || null;
    const colors = extractColors(combinedText);
    const color = explicitColor || colors[0] || null;

    const rewardSavings = numberValue(raw.giftCardDiscount ?? raw.gift_card_discount ?? raw.savings ?? raw.rewardSavings ?? raw.reward_savings);
    const identifiers = {
        sku: stringValue(raw.sku, raw.SKU, raw.productSku, raw.product_sku) || null,
        productId: stringValue(raw.productId, raw.product_id, raw.id) || null,
        mpn: stringValue(raw.mpn, raw.MPN) || null,
        asin: stringValue(raw.asin, raw.ASIN) || null,
        ean: stringValue(raw.ean, raw.EAN) || null,
        upc: stringValue(raw.upc, raw.UPC) || null,
        modelNumber: stringValue(raw.modelNumber, raw.model_number) || null
    };

    const verification = buildVerification(raw, store, url);

    return {
        id: `candidate-${String(candidateIndex + 1).padStart(3, '0')}`,
        store,
        seller: stringValue(raw.seller, raw.sellerName, raw.seller_name) || null,
        originalStoreField: rawStore || null,
        title: title || null,
        url: url || null,
        brand: stringValue(raw.brand, raw.brandName, raw.brand_name) || null,
        model: stringValue(raw.model, raw.modelName, raw.model_name) || null,
        price: {
            listed: listedPrice,
            effective: effectivePrice,
            original,
            rewardAdjusted,
            currency: stringValue(raw.currency) || 'INR'
        },
        availability: {
            status: availabilityStatus,
            raw: stockRaw || null,
            isAvailable: unavailable ? false : (stockRaw ? true : null)
        },
        variant: { ram, storage, color, colors },
        rewards: {
            giftCardSavings: rewardSavings,
            rewardAdjustedPrice: rewardAdjusted,
            discountPercentage: numberValue(raw.discountPercentage ?? raw.discount_percentage)
        },
        identifiers,
        verification,
        isVerified: verification.status === 'VERIFIED',
        missingFields: [!ram && 'ram', !storage && 'storage', !color && 'color', !url && 'url', !title && 'title'].filter(Boolean),
        evidence: { sourceEventIds: [entry.eventId], rawFragmentCount: 1 },
        source: raw
    };
}

function mergeKey(candidate) {
    if (candidate.url) return `url|${normalizeText(candidate.url)}`;
    if (candidate.identifiers.productId) return ['pid', normalizeText(candidate.store), candidate.identifiers.productId].join('|');
    if (candidate.identifiers.sku) return ['sku', normalizeText(candidate.store), candidate.identifiers.sku].join('|');
    return ['st', normalizeText(candidate.store), normalizeText(candidate.title || ''), candidate.price.listed].join('|');
}

function mergeInto(target, incoming) {
    for (const key of ['title','url','brand','model','seller']) if (!target[key] && incoming[key]) target[key] = incoming[key];
    for (const key of ['listed','effective','original','rewardAdjusted']) if (target.price[key] === null && incoming.price[key] !== null) target.price[key] = incoming.price[key];
    for (const key of ['ram','storage','color']) if (!target.variant[key] && incoming.variant[key]) target.variant[key] = incoming.variant[key];
    target.variant.colors = uniqueBy([...target.variant.colors, ...incoming.variant.colors], color => color);
    for (const key of Object.keys(incoming.identifiers)) if (!target.identifiers[key] && incoming.identifiers[key]) target.identifiers[key] = incoming.identifiers[key];
    if (target.availability.status === 'unknown' && incoming.availability.status !== 'unknown') target.availability = incoming.availability;
    if (incoming.rewards.giftCardSavings !== null && target.rewards.giftCardSavings === null) target.rewards = incoming.rewards;
    if (verificationRank(incoming.verification) > verificationRank(target.verification)) target.verification = incoming.verification;
    target.isVerified = target.verification?.status === 'VERIFIED';
    target.evidence.sourceEventIds = uniqueBy([...target.evidence.sourceEventIds, ...incoming.evidence.sourceEventIds], id => id);
    target.evidence.rawFragmentCount += incoming.evidence.rawFragmentCount;
    target.missingFields = [!target.variant.ram && 'ram', !target.variant.storage && 'storage', !target.variant.color && 'color', !target.url && 'url', !target.title && 'title'].filter(Boolean);
}

function mergeAndDeduplicate(candidates) {
    const byKey = new Map();
    for (const candidate of candidates) {
        const key = mergeKey(candidate);
        if (byKey.has(key)) mergeInto(byKey.get(key), candidate);
        else byKey.set(key, candidate);
    }
    return [...byKey.values()];
}

/* ============================================================
   IMAGES / GIFTS / PRODUCT NORMALIZATION
============================================================ */

function cleanImages(product, objects) {
    const urls = [];
    function add(value) {
        if (!value) return;
        if (Array.isArray(value)) { for (const item of value) add(item); return; }
        if (typeof value === 'string') {
            const url = value.trim();
            if (!/^https?:\/\//i.test(url)) return;
            const lower = url.toLowerCase();
            const blocked = ['nav-sprite','transparent-pixel','grey-pixel','sprite','favicon','tracking','prime_logo','privacy','privacy-img'];
            if (blocked.some(token => lower.includes(token))) return;
            urls.push(url);
            return;
        }
        if (isObject(value)) { add(value.url); add(value.src); add(value.image); add(value.imageUrl); add(value.thumbnail); }
    }
    add(product?.images); add(product?.thumbnail); add(product?.image);
    for (const object of objects) { add(object.images); add(object.gallery); add(object.galleryImages); }
    return uniqueBy(urls, value => value).slice(0, 16);
}

function collectGiftCards(objects) {
    const offers = [];
    for (const object of objects) {
        const lists = [object.giftCardOffers, object.gift_card_offers, object.allGiftCardOffers, object.all_gift_card_offers, object.giftOffers, object.gift_offers, object.cardRewards, object.card_rewards];
        for (const list of lists) {
            if (!Array.isArray(list)) continue;
            for (const offer of list) if (isObject(offer)) offers.push(offer);
        }
    }
    return uniqueBy(offers, offer => safeJson(offer));
}

function normalizeProduct(sourceProduct, images) {
    const identity = extractIdentity(sourceProduct);
    const reviews = isObject(sourceProduct.reviews) ? sourceProduct.reviews : {};
    const specifications = isObject(sourceProduct.specifications) ? sourceProduct.specifications : (isObject(sourceProduct.specs) ? sourceProduct.specs : {});
    return {
        name: identity.name,
        brand: identity.brand,
        model: identity.model,
        category: stringValue(sourceProduct.standardizedCategory, sourceProduct.category),
        description: stringValue(sourceProduct.description),
        price: numberValue(sourceProduct.price ?? sourceProduct.currentPrice ?? sourceProduct.current_price),
        originalPrice: numberValue(sourceProduct.originalPrice ?? sourceProduct.original_price ?? sourceProduct.mrp),
        currency: stringValue(sourceProduct.currency) || 'INR',
        variant: { ram: identity.ram || null, storage: identity.storage || null, color: identity.color || null, colors: identity.colors },
        confidence: sourceProduct.confidence ?? null,
        validProduct: sourceProduct.validProduct !== false,
        thumbnail: images[0] || '',
        images,
        reviews,
        rating: sourceProduct.rating ?? reviews.rating ?? null,
        reviewCount: sourceProduct.reviewCount ?? sourceProduct.review_count ?? reviews.reviewCount ?? null,
        specifications
    };
}

/* ============================================================
   DETERMINISTIC PRODUCT MATCHING
============================================================ */

function hasConflict(targetValue, candidateValue) {
    if (!targetValue || !candidateValue) return false;
    return normalizeText(targetValue) !== normalizeText(candidateValue);
}

function modelTokens(text) {
    return new Set(normalizeText(text).split(' ').filter(word => word.length > 1));
}

function titleSimilarity(targetName, candidateTitle) {
    const a = modelTokens(targetName);
    const b = modelTokens(candidateTitle);
    if (!a.size || !b.size) return 0;
    let common = 0;
    for (const token of a) if (b.has(token)) common += 1;
    return common / a.size;
}

function explicitDifferentVariant(product, candidate) {
    const target = product.variant || {};
    const variant = candidate.variant || {};
    if (hasConflict(target.ram, variant.ram)) return 'RAM differs';
    if (hasConflict(target.storage, variant.storage)) return 'Storage differs';
    if (target.color && variant.colors?.length && !variant.colors.some(color => normalizeText(color) === normalizeText(target.color))) return 'Color differs';

    const targetModel = normalizeText(product.model || '');
    const candidateModel = normalizeText(candidate.model || '');
    if (targetModel && candidateModel && targetModel !== candidateModel) {
        const targetProMax = targetModel.includes('pro max');
        const candidateProMax = candidateModel.includes('pro max');
        if (targetProMax !== candidateProMax) return 'Model differs';
    }

    const targetName = normalizeText(product.name);
    const candidateTitle = normalizeText(candidate.title || candidate.url || '');
    if (targetName.includes('pro max') !== candidateTitle.includes('pro max')) return 'Pro / Pro Max mismatch';
    return '';
}

function classifyCandidateDeterministically(product, candidate) {
    const explicitConflict = explicitDifferentVariant(product, candidate);
    if (explicitConflict) return { classification: 'SAME_PRODUCT_DIFFERENT_VARIANT', confidence: 96, reason: explicitConflict };

    const productModel = normalizeText(product.model || '');
    const candidateModel = normalizeText(candidate.model || '');
    if (productModel && candidateModel && productModel === candidateModel) return { classification: 'EXACT_MATCH', confidence: 96, reason: 'Explicit model identity matches the requested product.' };

    const similarity = titleSimilarity(product.name, candidate.title || candidate.url || '');
    if (similarity >= 0.68) return { classification: 'EXACT_MATCH', confidence: 90, reason: 'Strong title and variant evidence match the requested product.' };
    if (similarity >= 0.46) return { classification: 'MATCHING', confidence: 76, reason: 'The listing strongly resembles the requested product and has no explicit variant conflict.' };
    if (similarity >= 0.28) return { classification: 'AMBIGUOUS', confidence: 58, reason: 'The listing may be related but the available evidence is insufficient for an exact match.' };
    return { classification: 'RELATED_PRODUCT', confidence: 42, reason: 'The listing does not contain enough matching product identity evidence.' };
}

/* ============================================================
   PRICE SAFETY / FRONTEND CONTRACT
============================================================ */

function priceCheck(candidate, sourcePrice, peerMedian) {
    const price = Number(candidate.price.effective);
    if (!Number.isFinite(price) || price <= 0) return { suspicious: true, reason: 'Invalid price.' };

    if (sourcePrice && sourcePrice > 0) {
        const ratio = price / sourcePrice;
        if (ratio < 0.20) return { suspicious: true, reason: 'Extreme low-price anomaly relative to the source product.' };
        if (ratio > 3.0) return { suspicious: true, reason: 'Extreme high-price anomaly relative to the source product.' };
    }

    if (peerMedian && peerMedian > 0) {
        const ratio = price / peerMedian;
        if (ratio < 0.25) return { suspicious: true, reason: 'Extreme low-price outlier compared with the peer set.' };
        if (ratio > 2.5) return { suspicious: true, reason: 'Extreme high-price outlier compared with the peer set.' };
    }
    return { suspicious: false, reason: '' };
}

function toFrontendDeal(candidate, productCurrency, relationship) {
    return {
        store: candidate.store,
        seller: candidate.seller,
        title: candidate.title || '',
        url: candidate.url || '',
        price: candidate.price.listed,
        listedPrice: candidate.price.listed,
        effectivePrice: candidate.price.effective,
        originalPrice: candidate.price.original,
        priceWithGiftCard: candidate.price.rewardAdjusted,
        currency: candidate.price.currency || productCurrency || 'INR',
        availability: candidate.availability.status,
        isAvailable: candidate.availability.isAvailable !== false,
        isVerified: candidate.isVerified,
        verification: candidate.verification,
        verificationStatus: candidate.verification?.status || 'UNVERIFIED',
        verificationLabel: candidate.verification?.label || 'Unverified listing',
        variant: candidate.variant,
        rewards: candidate.rewards,
        identifiers: candidate.identifiers,
        relationship: {
            classification: relationship.classification,
            confidence: relationship.confidence,
            reason: relationship.reason
        },
        evidence: { sourceEventIds: candidate.evidence.sourceEventIds }
    };
}

function buildPriceInsights(exactDeals, comparableCount, sourcePrice) {
    const prices = exactDeals.map(d => Number(d.effectivePrice)).filter(Number.isFinite);
    const availableSorted = exactDeals.filter(d => d.isAvailable).sort((a, b) => Number(a.effectivePrice) - Number(b.effectivePrice));
    const verifiedAvailableSorted = availableSorted.filter(d => d.verificationStatus === 'VERIFIED');
    const bestVerified = verifiedAvailableSorted[0] || null;
    const best = bestVerified || availableSorted[0] || exactDeals[0] || null;
    const lowest = availableSorted.length ? Number(availableSorted[0].effectivePrice) : (prices.length ? Math.min(...prices) : null);
    return {
        lowestExact: lowest,
        medianExact: median(prices),
        highestExact: prices.length ? Math.max(...prices) : null,
        exactOfferCount: exactDeals.length,
        comparableOfferCount: comparableCount,
        sourcePrice,
        bestOffer: best ? { store: best.store, price: best.effectivePrice, url: best.url, verificationStatus: best.verificationStatus } : null,
        bestVerifiedOffer: bestVerified ? { store: bestVerified.store, price: bestVerified.effectivePrice, url: bestVerified.url } : null,
        lowestObservedOffer: availableSorted[0] ? { store: availableSorted[0].store, price: availableSorted[0].effectivePrice, url: availableSorted[0].url, verificationStatus: availableSorted[0].verificationStatus } : null,
        sourceSavingsPercent: sourcePrice && lowest !== null && sourcePrice > 0 ? Number(((1 - lowest / sourcePrice) * 100).toFixed(1)) : null
    };
}

/* ============================================================
   LOCAL FALLBACK
============================================================ */

function localRetzoFallback(product, exactDeals, suspicious, bestDeal, stores, alternatives = []) {
    let score = 50;
    const reasons = [];
    const warnings = [];

    if (product.variant?.storage) { score += 8; reasons.push(`Requested storage: ${product.variant.storage}.`); }
    if (product.variant?.ram) { score += 6; reasons.push(`Requested RAM: ${product.variant.ram}.`); }
    if (product.variant?.color) { score += 6; reasons.push(`Requested color: ${product.variant.color}.`); }

    if (stores.length >= 5) { score += 12; reasons.push(`${stores.length} stores provide broad comparison coverage.`); }
    else if (stores.length >= 2) { score += 6; reasons.push(`${stores.length} stores provide comparison coverage.`); }
    else if (stores.length === 1) warnings.push('Only one store provided a usable exact offer.');

    if (exactDeals.length >= 8) { score += 12; reasons.push(`${exactDeals.length} exact offers were found.`); }
    else if (exactDeals.length >= 3) { score += 8; reasons.push(`${exactDeals.length} exact offers were found.`); }
    else if (exactDeals.length >= 1) { score += 2; warnings.push('Comparison coverage is limited.'); }
    else warnings.push('No exact valid offer was found.');

    if (suspicious.length) warnings.push(`${suspicious.length} listings were excluded by price protection.`);
    else { score += 4; reasons.push('No major deterministic price anomaly was detected.'); }
    if (alternatives.length) warnings.push(`${alternatives.length} alternative variants were kept separate from exact offers.`);

    const verifiedDeals = exactDeals.filter(deal => deal.verificationStatus === 'VERIFIED');
    if (exactDeals.length && verifiedDeals.length === 0) warnings.push('No exact offer carries an explicit upstream verification signal.');
    if (bestDeal && bestDeal.verificationStatus !== 'VERIFIED') warnings.push('The lowest usable price is not explicitly verified by the source.');

    score = clamp(Math.round(score), 0, 100);
    const label = score >= 88 ? 'STRONG BUY' : score >= 70 ? 'GOOD BUY' : score < 55 ? 'CAUTION' : 'COMPARE';

    return {
        provider: 'Retz',
        model: 'local-fallback',
        label,
        score,
        confidence: score,
        headline: 'KrazyBuy generated a conservative comparison assessment.',
        summary: 'AI was unavailable, so KrazyBuy used the structured comparison and price-safety layer.',
        reasons: reasons.slice(0, 5),
        warnings: warnings.slice(0, 5),
        recommendations: [],
        bestValueOffer: bestDeal ? { store: bestDeal.store, price: bestDeal.effectivePrice, url: bestDeal.url } : null,
        recommendation: bestDeal ? 'Verify seller details, return policy, availability and checkout price before purchase.' : 'Wait for a stronger exact offer.',
        ai: false
    };
}

/* ============================================================
   RETZ INPUT / STRICT SCHEMA
============================================================ */

function compactRetzoOffer(deal) {
    return {
        store: truncate(deal.store, 26),
        title: truncate(deal.title, 72),
        price: deal.effectivePrice,
        original: deal.originalPrice,
        currency: deal.currency,
        available: deal.isAvailable,
        verificationStatus: deal.verificationStatus,
        verificationLevel: deal.verification?.level || null,
        verificationEvidence: Array.isArray(deal.verification?.evidence) ? deal.verification.evidence.slice(0, 3) : [],
        variant: deal.variant ? { ram: deal.variant.ram, storage: deal.variant.storage, color: deal.variant.color } : null,
        url: truncate(deal.url, 90)
    };
}

function buildRetzoInput(normalized) {
    const comparison = normalized.comparison;
    const priceInsights = comparison.priceInsights;
    return {
        product: {
            name: truncate(normalized.product.name, 120),
            brand: truncate(normalized.product.brand, 40),
            model: truncate(normalized.product.model, 60),
            category: truncate(normalized.product.category, 40),
            variant: normalized.product.variant,
            sourcePrice: normalized.product.price,
            originalPrice: normalized.product.originalPrice,
            currency: normalized.product.currency
        },
        market: {
            stores: comparison.stores,
            storeCount: comparison.storeCount,
            validOfferCount: comparison.exactDealCount,
            suspiciousCount: comparison.suspiciousCount,
            alternativeCount: comparison.variantAlternativeCount,
            relatedCount: comparison.relatedProductCount,
            ambiguousCount: comparison.ambiguousCount,
            wrongCount: comparison.wrongCount,
            verifiedOfferCount: comparison.verifiedOfferCount,
            storeIdentifiedOfferCount: comparison.storeIdentifiedOfferCount,
            unverifiedOfferCount: comparison.unverifiedOfferCount
        },
        priceInsights: {
            lowestExact: priceInsights.lowestExact,
            medianExact: priceInsights.medianExact,
            highestExact: priceInsights.highestExact,
            sourcePrice: priceInsights.sourcePrice,
            sourceSavingsPercent: priceInsights.sourceSavingsPercent,
            bestOffer: priceInsights.bestOffer,
            bestVerifiedOffer: priceInsights.bestVerifiedOffer,
            lowestObservedOffer: priceInsights.lowestObservedOffer
        },
        exactOffers: comparison.deals.slice(0, RETZO_MAX_EXACT).map(compactRetzoOffer),
        alternatives: comparison.variantAlternatives.slice(0, RETZO_MAX_ALTS).map(compactRetzoOffer),
        related: comparison.relatedProducts.slice(0, RETZO_MAX_RELATED).map(compactRetzoOffer),
        suspicious: comparison.suspiciousDeals.slice(0, RETZO_MAX_SUSPICIOUS).map(deal => ({ store: truncate(deal.store, 26), price: deal.effectivePrice, reason: truncate(deal.filterReason, 90) }))
    };
}

function getRetzoResponseSchema() {
    return {
        type: 'json_schema',
        json_schema: {
            name: 'krazybuy_retz_verdict',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    label: { type: 'string', enum: ['STRONG BUY', 'GOOD BUY', 'COMPARE', 'CAUTION'] },
                    score: { type: 'integer', minimum: 0, maximum: 100 },
                    confidence: { type: 'integer', minimum: 0, maximum: 100 },
                    headline: { type: 'string' },
                    summary: { type: 'string' },
                    bestValueOffer: {
                        type: ['object', 'null'],
                        properties: {
                            store: { type: 'string' },
                            price: { type: ['number', 'null'] },
                            url: { type: 'string' }
                        },
                        required: ['store', 'price', 'url'],
                        additionalProperties: false
                    },
                    recommendations: { type: 'array', items: { type: 'string' } },
                    reasons: { type: 'array', items: { type: 'string' } },
                    warnings: { type: 'array', items: { type: 'string' } },
                    recommendation: { type: 'string' }
                },
                /* IMPORTANT: Groq strict JSON schema requires EVERY property to be required. */
                required: [
                    'label','score','confidence','headline','summary','bestValueOffer',
                    'recommendations','reasons','warnings','recommendation'
                ],
                additionalProperties: false
            }
        }
    };
}

function sanitizeRetzText(text, normalized) {
    let value = String(text || '').trim();
    if (!value) return value;

    const comparison = normalized.comparison;
    const best = comparison.bestPrice;
    const bestStatus = String(best?.verificationStatus || 'UNVERIFIED').toUpperCase();

    if (bestStatus !== 'VERIFIED') {
        value = value
            .replace(/\bverified\s+seller\b/gi, 'seller with an explicit source verification signal')
            .replace(/\bverified\s+independent\s+seller\b/gi, 'independent seller with an explicit source verification signal')
            .replace(/\blowest\s+verified\b/gi, 'lowest observed')
            .replace(/\bbest\s+verified\b/gi, 'best observed');
    }

    value = value
        .replace(/\bensures?\s+authenticity\b/gi, 'does not by itself establish authenticity')
        .replace(/\bguarantees?\s+authenticity\b/gi, 'does not by itself establish authenticity');

    if (comparison.ambiguousCount > 0) value = value.replace(/\bno\s+ambiguous\s+(offers?|listings?)\b/gi, `${comparison.ambiguousCount} ambiguous listings remain outside the exact set`);
    if (comparison.suspiciousCount > 0) value = value.replace(/\bno\s+suspicious\s+(offers?|listings?)\b/gi, `${comparison.suspiciousCount} suspicious listings were excluded by price protection`);
    if (comparison.variantAlternativeCount > 0) value = value.replace(/\bno\s+alternative\s+variants?\b/gi, `${comparison.variantAlternativeCount} alternative variants were kept separate`);
    return value;
}

function enforceRetzOfferReference(offer, normalized) {
    if (!offer || !isObject(offer)) return null;
    const store = normalizeText(offer.store || '');
    const price = numberValue(offer.price);
    const url = canonicalUrl(offer.url || '');
    const exact = normalized.comparison.deals.find(deal => {
        const storeMatch = store && normalizeText(deal.store) === store;
        const priceMatch = price !== null && Number(deal.effectivePrice) === Number(price);
        const urlMatch = url && canonicalUrl(deal.url) === url;
        return (storeMatch && priceMatch) || urlMatch;
    });
    if (!exact) return null;
    return {
        store: exact.store,
        price: exact.effectivePrice,
        url: exact.url,
        verificationStatus: exact.verificationStatus,
        verificationSource: exact.verification?.level || null
    };
}

/* ============================================================
   GROQ REQUEST — ONE FINAL RETZ CALL PER JOB
============================================================ */

async function groqRetzRequest({ systemPrompt, userPrompt, maxTokens = 650 }) {
    if (!groqEnabled()) throw new Error('No Groq credentials configured.');

    const estimated = estimateTokens(systemPrompt) + estimateTokens(userPrompt) + maxTokens;
    const usedKeys = new Set();
    let lastError = null;

    for (let attempt = 0; attempt < GROQ_KEYS.length; attempt += 1) {
        let credential;
        try {
            credential = await acquireGroqKey(usedKeys, estimated);
        } catch (error) {
            lastError = error;
            break;
        }
        if (!credential) break;

        usedKeys.add(credential.id);
        credential.inFlight += 1;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GROQ_TIMEOUT);
        const tokenRecord = recordKeyTokens(credential, estimated, 'RETZO');

        console.log(`[RETZO] Groq key #${credential.id + 1} · ${credential.model} · estimated ${estimated} tokens · keyUsed=${keyTokensUsed(credential)}/${GROQ_TPM_LIMIT}`);

        try {
            const response = await fetch(GROQ_ENDPOINT, {
                method: 'POST',
                headers: { Authorization: `Bearer ${credential.key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: credential.model,
                    temperature: 0.1,
                    max_completion_tokens: maxTokens,
                    reasoning_effort: 'low',
                    response_format: getRetzoResponseSchema(),
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ]
                }),
                signal: controller.signal
            });

            const text = await response.text();
            try {
                const realTokens = Number(JSON.parse(text)?.usage?.total_tokens);
                if (Number.isFinite(realTokens) && realTokens > 0) tokenRecord.tokens = realTokens;
            } catch {}

            if (!response.ok) {
                if (isGroqSchemaValidationError(response.status, text)) {
                    lastError = new Error(`Groq schema validation failed: ${text.slice(0, 1200)}`);
                    console.error(`[RETZO] schema 400; key #${credential.id + 1} remains healthy`);
                    break;
                }

                if (GROQ_RETRYABLE_STATUSES.has(response.status)) {
                    const retryMs = parseRetryAfterMs(response, text);
                    markGroqFailure(credential, retryMs);
                    lastError = new Error(`Groq HTTP ${response.status}: ${text.slice(0, 700)}`);
                    console.warn(`[RETZO] key #${credential.id + 1} cooldown ${Math.ceil(retryMs / 1000)}s`);
                    continue;
                }

                throw new Error(`Groq HTTP ${response.status}: ${text.slice(0, 700)}`);
            }

            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error('Groq returned invalid JSON.'); }

            const content = data?.choices?.[0]?.message?.content;
            const parsed = parseJsonContent(content);
            markGroqSuccess(credential);
            return { parsed, keySlot: credential.id + 1, model: credential.model };
        } catch (error) {
            lastError = error;
            const message = String(error?.message || '');
            if (!message.includes('schema validation failed')) {
                if (error?.name === 'AbortError') markGroqFailure(credential, GROQ_COOLDOWN_MS);
                else if (!message.includes('Groq HTTP 429')) markGroqFailure(credential, GROQ_COOLDOWN_MS);
            }
            console.warn(`[RETZO] key #${credential.id + 1} failed: ${error?.message || error}`);
        } finally {
            clearTimeout(timer);
            credential.inFlight = Math.max(0, credential.inFlight - 1);
        }
    }

    throw lastError || new Error('All Groq credentials failed.');
}

/* ============================================================
   STAGE 4 — RETZ
============================================================ */

async function generateRetzoVerdict(normalized) {
    const comparison = normalized.comparison;

    if (!groqEnabled()) {
        return localRetzoFallback(normalized.product, comparison.deals, comparison.suspiciousDeals, comparison.bestPrice, comparison.stores, comparison.variantAlternatives);
    }

    const retzoInput = buildRetzoInput(normalized);
    const systemPrompt = `
You are Retz 1.0, the final buying intelligence model inside KrazyBuy.

The server has already performed:
- product identity extraction
- deterministic variant handling
- store detection
- normalization
- deduplication
- availability checks
- price safety filtering
- exact / alternative / related classification
- verification classification
- best-price calculation
- price statistics

Your job is ONLY to judge the buying decision from the supplied evidence.

RULES:
1. Never invent a store, price, product, seller or availability.
2. Never alter a price from the input.
3. Never call an alternative variant an exact offer.
4. Never choose a suspicious offer as best value.
5. Prefer available exact offers.
6. VERIFIED means the source explicitly supplied a verification signal.
7. STORE_IDENTIFIED means only that the domain matches a recognized retailer. It is NOT VERIFIED.
8. UNVERIFIED means there is no explicit verification evidence.
9. Never upgrade STORE_IDENTIFIED or UNVERIFIED into VERIFIED.
10. Never claim that verification proves authenticity.
11. Consider comparison coverage, price advantage, verification status and availability together.
12. A single cheap independent seller should reduce confidence when evidence is weak.
13. The bestValueOffer MUST match an actual exact offer.
14. Never claim zero ambiguous/suspicious/alternative listings when input counts are non-zero.
15. Return ALL fields in the schema.
16. ALWAYS return recommendations, reasons and warnings as arrays. Use [] when there is nothing to report.
17. Return ONLY the JSON object required by the schema.
`;

    try {
        const response = await groqRetzRequest({ systemPrompt, userPrompt: JSON.stringify(retzoInput), maxTokens: 650 });
        const value = response.parsed || {};
        const validLabels = new Set(['STRONG BUY','GOOD BUY','COMPARE','CAUTION']);
        const label = validLabels.has(String(value.label || '')) ? String(value.label) : 'COMPARE';
        const bestValueOffer = enforceRetzOfferReference(value.bestValueOffer, normalized);
        const normalizeArray = input => Array.isArray(input) ? input.slice(0, 5).map(String).map(item => sanitizeRetzText(item, normalized)) : [];

        return {
            provider: 'Retz',
            model: response.model,
            keySlot: response.keySlot,
            label,
            score: Math.round(clamp(Number(value.score) || 0, 0, 100)),
            confidence: Math.round(clamp(Number(value.confidence) || Number(value.score) || 0, 0, 100)),
            headline: sanitizeRetzText(value.headline || 'KrazyBuy comparison complete.', normalized),
            summary: sanitizeRetzText(value.summary || 'Retz evaluated the structured comparison.', normalized),
            bestValueOffer,
            recommendations: normalizeArray(value.recommendations),
            reasons: normalizeArray(value.reasons),
            warnings: normalizeArray(value.warnings),
            recommendation: sanitizeRetzText(value.recommendation || 'Verify availability and checkout price before buying.', normalized),
            ai: true,
            schemaNormalized: true
        };
    } catch (error) {
        console.error('[RETZO] Groq failed:', error?.message || error);
        return {
            ...localRetzoFallback(normalized.product, comparison.deals, comparison.suspiciousDeals, comparison.bestPrice, comparison.stores, comparison.variantAlternatives),
            fallbackReason: error?.message || 'Groq request failed.'
        };
    }
}

/* ============================================================
   UPSTREAM SEARCH / SSE
============================================================ */

async function fetchWithTimeout(url, options = {}, timeoutMs = CONNECT_TIMEOUT) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { ...options, signal: controller.signal }); }
    finally { clearTimeout(timer); }
}

async function triggerSearch(productUrl) {
    const endpoint = `${UPSTREAM_BASE_API}${UPSTREAM_SEARCH_PATH}`;
    console.log(`[SEARCH] POST ${endpoint}`);
    const response = await fetchWithTimeout(endpoint, {
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
            Accept: 'application/json, text/event-stream, */*',
            'Content-Type': 'application/json',
            Origin: 'https://www.save8.ai',
            Referer: 'https://www.save8.ai/'
        },
        body: JSON.stringify({ url: productUrl, device_type: 'web', app_version: '0.1.0' })
    }, CONNECT_TIMEOUT);

    const text = await response.text();
    if (!response.ok) throw new Error(`Search API HTTP ${response.status}: ${text.slice(0, 700)}`);
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('Search API returned invalid JSON.'); }
    const streamPath = data?.data?.streamUrl || data?.data?.stream_url || data?.streamUrl || data?.stream_url;
    if (!streamPath) throw new Error('Search API did not return a streamUrl.');
    console.log(`[STREAM] Stream URL: ${streamPath}`);
    return streamPath;
}

async function readSSE(job, streamPath) {
    const endpoint = streamPath.startsWith('/') ? `${UPSTREAM_BASE_API}${streamPath}` : streamPath;
    console.log(`[STREAM] Connecting ${endpoint}`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STREAM_TIMEOUT);

    try {
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36',
                Accept: 'text/event-stream, application/json, */*',
                'Cache-Control': 'no-cache',
                Origin: 'https://www.save8.ai',
                Referer: 'https://www.save8.ai/'
            },
            signal: controller.signal
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Stream HTTP ${response.status}: ${body.slice(0, 700)}`);
        }
        if (!response.body) throw new Error('Stream response has no readable body.');

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let finalPayload = null;

        const processLine = rawLine => {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) return;
            const chunk = line.slice(5).trim();
            if (!chunk) return;
            try {
                const parsed = JSON.parse(chunk);
                finalPayload = parsed;
                storeStreamEvent(job, parsed);
            } catch {}
        };

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';
            for (const line of lines) processLine(line);
        }

        buffer += decoder.decode();
        for (const line of buffer.split(/\r?\n/)) processLine(line);
        return finalPayload;
    } finally {
        clearTimeout(timer);
    }
}

/* ============================================================
   BUILD NORMALIZED RESULT
============================================================ */

async function buildNormalizedResult(job, finalPayload) {
    const events = job.streamEvents;
    const allObjects = [];
    for (const event of events) walk(event.data, value => { if (isObject(value)) allObjects.push(value); });

    const { product: sourceProduct } = findSourceProduct(events);
    const images = cleanImages(sourceProduct, allObjects);
    const product = normalizeProduct(sourceProduct, images);
    const giftCards = collectGiftCards(allObjects);
    const rawEntries = collectRawDeals(events);
    const structured = [];

    for (let i = 0; i < rawEntries.length; i += 1) {
        const candidate = normalizeCandidate(rawEntries[i], i);
        if (candidate) structured.push(candidate);
    }

    const deduplicated = mergeAndDeduplicate(structured);

    console.log('----------------------------------------------');
    console.log(`[STAGE 1] EVENTS CAPTURED:        ${events.length}`);
    console.log(`[STAGE 1] RAW CANDIDATES:         ${rawEntries.length}`);
    console.log(`[STAGE 1] STRUCTURED CANDIDATES:  ${structured.length}`);
    console.log(`[STAGE 1] DEDUPLICATED:           ${deduplicated.length}`);
    console.log('----------------------------------------------');

    publishPipeline(job, 'normalize', `Normalizing and deduplicating retailer offers… (${deduplicated.length} candidates)`);

    const classified = deduplicated.map(candidate => ({ candidate, relationship: classifyCandidateDeterministically(product, candidate) }));
    const count = classification => classified.filter(item => item.relationship.classification === classification).length;

    console.log(`[STAGE 2] EXACT:             ${count('EXACT_MATCH')}`);
    console.log(`[STAGE 2] MATCHING:          ${count('MATCHING')}`);
    console.log(`[STAGE 2] DIFFERENT VARIANT: ${count('SAME_PRODUCT_DIFFERENT_VARIANT')}`);
    console.log(`[STAGE 2] RELATED:           ${count('RELATED_PRODUCT')}`);
    console.log(`[STAGE 2] AMBIGUOUS:         ${count('AMBIGUOUS')}`);

    publishPipeline(job, 'analyze', 'Checking exact variants, availability, price safety and store coverage…');

    const exactCandidates = classified.filter(({ relationship }) => ['EXACT_MATCH','MATCHING'].includes(relationship.classification));
    const variantAltCandidates = classified.filter(({ relationship }) => relationship.classification === 'SAME_PRODUCT_DIFFERENT_VARIANT');
    const relatedCandidates = classified.filter(({ relationship }) => relationship.classification === 'RELATED_PRODUCT');
    const ambiguousCandidates = classified.filter(({ relationship }) => relationship.classification === 'AMBIGUOUS');
    const wrongCandidates = classified.filter(({ relationship }) => ['WRONG_VARIANT','WRONG_PRODUCT'].includes(relationship.classification));

    const sourcePrice = product.price;
    const peerMedian = median(exactCandidates.map(({ candidate }) => candidate.price.effective));
    const validDeals = [];
    const suspiciousDeals = [];

    for (const { candidate, relationship } of exactCandidates) {
        const safety = priceCheck(candidate, sourcePrice, peerMedian);
        const deal = toFrontendDeal(candidate, product.currency, relationship);
        if (safety.suspicious) suspiciousDeals.push({ ...deal, filterReason: safety.reason });
        else validDeals.push(deal);
    }

    validDeals.sort((a, b) => {
        if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
        if (a.verificationStatus !== b.verificationStatus) return a.verificationStatus === 'VERIFIED' ? -1 : 1;
        return Number(a.effectivePrice) - Number(b.effectivePrice);
    });

    const verifiedValidDeals = validDeals.filter(deal => deal.verificationStatus === 'VERIFIED');
    const storeIdentifiedValidDeals = validDeals.filter(deal => deal.verificationStatus === 'STORE_IDENTIFIED');
    const unverifiedValidDeals = validDeals.filter(deal => deal.verificationStatus === 'UNVERIFIED');
    const lowestObservedPrice = validDeals.length ? [...validDeals].sort((a, b) => Number(a.effectivePrice) - Number(b.effectivePrice))[0] : null;
    const verifiedAvailableDeals = verifiedValidDeals.filter(deal => deal.isAvailable);
    const bestVerifiedPrice = verifiedAvailableDeals.length ? [...verifiedAvailableDeals].sort((a, b) => Number(a.effectivePrice) - Number(b.effectivePrice))[0] : null;
    const bestPrice = bestVerifiedPrice || lowestObservedPrice || null;

    for (const deal of validDeals) {
        deal.isBestDeal = Boolean(bestPrice && deal === bestPrice);
        deal.isLowestPrice = Boolean(lowestObservedPrice && deal === lowestObservedPrice);
        deal.isBestVerifiedDeal = Boolean(bestVerifiedPrice && deal === bestVerifiedPrice);
    }

    const mapDeals = rows => rows.map(({ candidate, relationship }) => toFrontendDeal(candidate, product.currency, relationship));
    const variantAlternatives = mapDeals(variantAltCandidates);
    const relatedProducts = mapDeals(relatedCandidates);
    const ambiguousDeals = mapDeals(ambiguousCandidates);
    const wrongDeals = mapDeals(wrongCandidates);

    const stores = uniqueBy(validDeals, deal => normalizeText(deal.store)).map(deal => deal.store);
    const verifiedStores = uniqueBy(verifiedValidDeals, deal => normalizeText(deal.store)).map(deal => deal.store);
    const priceInsights = buildPriceInsights(validDeals, exactCandidates.length, sourcePrice);

    console.log(`[STAGE 3] VALID EXACT: ${validDeals.length}`);
    console.log(`[STAGE 3] SUSPICIOUS:  ${suspiciousDeals.length}`);
    console.log(`[STAGE 3] STORES:      ${stores.length}`);
    console.log(`[STAGE 3] VERIFIED:    ${verifiedValidDeals.length}`);
    console.log(`[STAGE 3] STORE ID:    ${storeIdentifiedValidDeals.length}`);
    console.log(`[STAGE 3] UNVERIFIED:  ${unverifiedValidDeals.length}`);
    console.log(`[STAGE 3] BEST PRICE:  ${bestPrice?.effectivePrice ?? 'none'}`);
    console.log(`[STAGE 3] LOWEST OBS:  ${lowestObservedPrice?.effectivePrice ?? 'none'}`);
    console.log(`[STAGE 3] BEST VERIFIED: ${bestVerifiedPrice?.effectivePrice ?? 'none'}`);

    const comparison = {
        stores,
        storeCount: stores.length,
        deals: validDeals,
        totalDeals: validDeals.length,
        exactDeals: validDeals,
        exactDealCount: validDeals.length,
        verifiedDeals: verifiedValidDeals,
        verifiedOfferCount: verifiedValidDeals.length,
        verifiedStores,
        verifiedStoreCount: verifiedStores.length,
        storeIdentifiedOfferCount: storeIdentifiedValidDeals.length,
        unverifiedOfferCount: unverifiedValidDeals.length,
        lowestObservedPrice,
        bestVerifiedPrice,
        variantAlternatives,
        variantAlternativeCount: variantAlternatives.length,
        relatedProducts,
        relatedProductCount: relatedProducts.length,
        ambiguousDeals,
        ambiguousCount: ambiguousDeals.length,
        wrongDeals,
        wrongCount: wrongDeals.length,
        suspiciousDeals,
        suspiciousCount: suspiciousDeals.length,
        bestPrice,
        priceRange: { lowest: priceInsights.lowestExact, highest: priceInsights.highestExact, median: priceInsights.medianExact, count: priceInsights.exactOfferCount },
        priceInsights
    };

    const elapsed = Number(((Date.now() - job.startedAt) / 1000).toFixed(1));

    const normalized = {
        schemaVersion: '5.0',
        product,
        comparison,
        offers: {
            exact: validDeals,
            alternatives: variantAlternatives,
            related: relatedProducts,
            ambiguous: ambiguousDeals,
            suspicious: suspiciousDeals.map(deal => ({ store: deal.store, title: deal.title, url: deal.url, price: deal.effectivePrice, reason: deal.filterReason })),
            giftCards
        },
        retzo: null,
        meta: {
            sourceUrl: job.productUrl,
            elapsedSeconds: elapsed,
            eventsCaptured: events.length,
            generatedAt: now(),
            rawDealCount: rawEntries.length,
            structuredCandidateCount: structured.length,
            candidateCount: deduplicated.length,
            exactCount: validDeals.length,
            verifiedOfferCount: verifiedValidDeals.length,
            storeIdentifiedOfferCount: storeIdentifiedValidDeals.length,
            unverifiedOfferCount: unverifiedValidDeals.length,
            alternativeCount: variantAlternatives.length,
            relatedCount: relatedCandidates.length,
            ambiguousCount: ambiguousCandidates.length,
            wrongCount: wrongCandidates.length,
            suspiciousCount: suspiciousDeals.length
        },
        debug: {
            finalPayload: finalPayload || null,
            rawDealCount: rawEntries.length,
            candidateCount: deduplicated.length,
            upstreamEventCount: events.length
        }
    };

    publishPipeline(job, 'verdict', 'Retz 1.0 is evaluating the filtered market evidence…');
    normalized.retzo = await generateRetzoVerdict(normalized);

    console.log('==============================================');
    console.log(' KRAZYBUY NORMALIZED RESULT');
    console.log('==============================================');
    console.log(`Product:      ${product.name || 'unknown'}`);
    console.log(`RAM:          ${product.variant.ram || 'unknown'}`);
    console.log(`Storage:      ${product.variant.storage || 'unknown'}`);
    console.log(`Color:        ${product.variant.color || 'unknown'}`);
    console.log(`Valid:        ${validDeals.length}`);
    console.log(`Suspicious:   ${suspiciousDeals.length}`);
    console.log(`Stores:       ${stores.length}`);
    console.log(`Verified:     ${verifiedValidDeals.length}`);
    console.log(`Best price:   ${bestPrice?.effectivePrice ?? 'none'}`);
    console.log(`Retz:         ${normalized.retzo.label} (${normalized.retzo.score})`);
    console.log(`Retz AI:      ${normalized.retzo.ai ? 'YES' : 'NO — FALLBACK'}`);
    console.log('==============================================');
    return normalized;
}

/* ============================================================
   JOB EXECUTION / ROUTES
============================================================ */

async function runJob(job) {
    job.startedAt = Date.now();
    try {
        setJobStatus(job, 'running');
        publishPipeline(job, 'starting', 'KrazyBuy is starting the comparison.');
        const streamPath = await triggerSearch(job.productUrl);
        job.streamPath = streamPath;
        publishPipeline(job, 'stream-connected', 'Live comparison stream connected.');
        const finalPayload = await readSSE(job, streamPath);
        console.log(`[STREAM] Total events collected: ${job.streamEvents.length}`);
        const result = await buildNormalizedResult(job, finalPayload);
        job.result = result;
        job.finishedAt = now();
        setJobStatus(job, 'complete', { elapsedSec: result.meta.elapsedSeconds });
        publish(job, { type: 'result', jobId: job.id, timestamp: now(), result });
        console.log(`[JOB ${job.id}] COMPLETE`);
    } catch (error) {
        const elapsed = Number(((Date.now() - job.startedAt) / 1000).toFixed(1));
        job.error = error?.name === 'AbortError' ? 'Comparison request timed out.' : (error?.message || String(error));
        job.finishedAt = now();
        console.error(`[JOB ${job.id}] FAILED: ${job.error}`);
        setJobStatus(job, 'failed', { error: job.error, elapsedSec: elapsed });
    }
}

app.post('/api/jobs', (req, res) => {
    const productUrl = String(req.body?.url || '').trim();
    if (!productUrl) return res.status(400).json({ error: 'Product URL is required.' });
    if (!isHttpUrl(productUrl)) return res.status(400).json({ error: 'Please provide a valid http:// or https:// product URL.' });

    const job = {
        id: createId(), productUrl, status: 'queued', createdAt: now(), updatedAt: now(), startedAt: null,
        finishedAt: null, streamPath: null, latestEvent: null, streamEvents: [], result: null, error: null, clients: new Set()
    };

    jobs.set(job.id, job);
    cleanupJobs();
    console.log(`[JOB ${job.id}] CREATED`);
    void runJob(job);
    return res.status(202).json({ jobId: job.id, status: job.status });
});

app.get('/api/jobs/:id/events', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    job.clients.add(res);

    res.write(`data: ${safeJson({ type: 'connected', jobId: job.id, status: job.status, timestamp: now() })}\n\n`);
    if (job.latestEvent) res.write(`data: ${safeJson(job.latestEvent)}\n\n`);
    if (job.status === 'complete' && job.result) res.write(`data: ${safeJson({ type: 'result', jobId: job.id, timestamp: now(), result: job.result })}\n\n`);
    if (job.status === 'failed') res.write(`data: ${safeJson({ type: 'job', jobId: job.id, status: 'failed', error: job.error, timestamp: now() })}\n\n`);

    const heartbeat = setInterval(() => {
        try { if (!res.writableEnded) res.write(`: heartbeat ${Date.now()}\n\n`); } catch {}
    }, 15000);

    req.on('close', () => { clearInterval(heartbeat); job.clients.delete(res); });
});

app.get('/api/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found.' });
    return res.json({
        jobId: job.id,
        productUrl: job.productUrl,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        elapsedSec: job.result?.meta?.elapsedSeconds ?? null,
        eventCount: job.streamEvents.length,
        result: job.result,
        error: job.error
    });
});

app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        service: 'krazybuy-price-intelligence',
        version: '5.0',
        pipeline: 'STRUCTURE → DETERMINISTIC ANALYSIS → RETZ 1.0',
        jobs: jobs.size,
        retzo: {
            enabled: groqEnabled(),
            keyCount: GROQ_KEYS.length,
            keys: groqPublicState(),
            model: groqEnabled() ? GROQ_KEYS[0].model : 'none',
            tokenReserve: RETZO_TOKEN_RESERVE,
            tpmLimitPerKey: GROQ_TPM_LIMIT,
            poolTpmLimit: GROQ_KEYS.length * GROQ_TPM_LIMIT,
            tokensUsedLastMinute: tokensUsedLastMinute(),
            oneFinalRequestPerJob: true
        },
        aiMatcher: false,
        aiMatcherRemoved: true,
        deterministicFiltering: true,
        verificationPolicy: 'EXPLICIT_UPSTREAM_SIGNAL_ONLY_NO_DOMAIN_VERIFICATION',
        storeIdentification: true,
        verifiedOffersOnlySelection: true,
        strictSchemaAllPropertiesRequired: true,
        schema400DoesNotCooldownKey: true,
        keyFailoverOnRetryableErrors: true,
        storeDetection: true,
        priceProtection: true,
        completeSseCapture: true,
        time: now()
    });
});

app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/')) return next();
    if (path.extname(req.path)) return next();
    return res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

app.use((error, _req, res, _next) => {
    console.error('[SERVER ERROR]', error);
    if (res.headersSent) return;
    return res.status(500).json({ error: error?.message || 'Internal server error.' });
});

app.listen(PORT, () => {
    console.log('');
    console.log('==============================================');
    console.log(' KRAZYBUY PRICE INTELLIGENCE — PRODUCTION V5');
    console.log(` Running: http://localhost:${PORT}`);
    console.log(` Health:  http://localhost:${PORT}/api/health`);
    console.log(` Retz:    ${groqEnabled() ? `ENABLED · ${GROQ_KEYS.length} KEY${GROQ_KEYS.length === 1 ? '' : 'S'}` : 'FALLBACK MODE'}`);
    console.log(` TPM per key:     ${GROQ_TPM_LIMIT}`);
    console.log(` Retz reserve:    ${RETZO_TOKEN_RESERVE}`);
    console.log(' Stage 1: STRUCTURE + PRESERVE');
    console.log(' Stage 2: DETERMINISTIC MATCHING');
    console.log(' Stage 3: DETERMINISTIC PRICE / STORE / VERIFICATION');
    console.log(' Stage 4: ONE RETZ 1.0 AI VERDICT');
    console.log(' Stage 5: FINAL KRAZYBUY JSON CONTRACT');
    console.log(' Small Retz matcher: REMOVED');
    console.log(' Complete SSE capture: ENABLED');
    console.log(' Exact variant filtering: ENABLED');
    console.log(' Store detection: ENABLED');
    console.log(' Wrong-price protection: ENABLED');
    console.log(' Listing verification: EXPLICIT UPSTREAM SIGNAL ONLY');
    console.log(' Store identification != verification: ENFORCED');
    console.log(' Strict schema: ALL PROPERTIES REQUIRED');
    console.log(' Schema 400 does not cooldown key: ENABLED');
    console.log(' Key failover on retryable errors: ENABLED');
    console.log(' Best price preference: VERIFIED AVAILABLE OFFER');
    console.log('==============================================');
    console.log('');
});
