/*
 * script.js - Mini Riset Kalkulus Diferensial
 * JavaScript murni, tanpa library eksternal, tanpa eval().
 *
 * Susunan berkas:
 *   1. Konstanta
 *   2. Format dan parsing angka
 *   3. Validasi data
 *   4. Interpolasi linear dan turunan
 *   5. Ringkasan dan kesimpulan
 *   6. Penyimpanan lokal (localStorage)
 *   7. Ekspor CSV
 *   8. Antarmuka (render, event) - hanya berjalan di browser
 *
 * Bagian 1-7 adalah fungsi murni sehingga dapat diuji di Node.js.
 */
(function () {
  'use strict';

  /* ======================================================
   * 1. KONSTANTA
   * ==================================================== */
  const STORAGE_KEY = 'miniRisetKalkulus.ramPhotoshop.v1';
  const STORAGE_VERSION = 1;
  const EPS = 1e-9;          // toleransi numerik untuk membandingkan waktu
  const MIN_POINTS = 2;
  const MAX_POINTS = 100;
  const MAX_VALUE = 1000000;
  const MAX_DECIMALS = 6;
  const MSG_CORNER = 'Turunan tidak terdefinisi secara dua sisi pada titik ini karena kemiringan kiri dan kanan berbeda.';

  // Data simulasi awal. Titik desimal dipakai di JavaScript.
  const INITIAL_DATA = [
    { t: 1, r: 2.5 },
    { t: 2, r: 3.1 },
    { t: 3, r: 3.6 },
    { t: 4, r: 4.0 },
    { t: 5, r: 4.4 }
  ];

  function cloneInitialData() {
    return INITIAL_DATA.map(function (p) { return { t: p.t, r: p.r }; });
  }

  /* ======================================================
   * 2. FORMAT DAN PARSING ANGKA
   * ==================================================== */

  // Menampilkan angka dengan koma desimal (format Indonesia).
  function formatNumber(value, maxDecimals) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '–';
    const d = maxDecimals === undefined ? 3 : maxDecimals;
    let v = Number(value.toFixed(d));
    if (v === 0) v = 0; // menghindari "-0"
    return String(v).replace('.', ',').replace('-', '\u2212');
  }

  // Menerima "6", "6.5", atau "6,5". Mengembalikan NaN jika tidak valid.
  function parseDecimal(raw) {
    if (raw === null || raw === undefined) return NaN;
    const s = String(raw).trim().replace(/\s+/g, '');
    if (s === '') return NaN;
    if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) return NaN;
    const parts = s.split(/[.,]/);
    if (parts.length > 1 && parts[1].length > MAX_DECIMALS) return NaN;
    return Number(s.replace(',', '.'));
  }

  /* ======================================================
   * 3. VALIDASI DATA
   * ==================================================== */
  function fail(field, message) {
    return { ok: false, field: field, message: message };
  }

  function sortPoints(points) {
    return points.slice().sort(function (a, b) { return a.t - b.t; });
  }

  // Memvalidasi satu pasang (durasi, RAM). ignoreIndex dipakai saat mengedit baris.
  function validateEntry(rawT, rawR, points, ignoreIndex) {
    const skip = ignoreIndex === undefined ? -1 : ignoreIndex;
    const tText = rawT === null || rawT === undefined ? '' : String(rawT).trim();
    const rText = rawR === null || rawR === undefined ? '' : String(rawR).trim();

    if (tText === '' && rText === '') return fail('t', 'Isi durasi (jam) dan penggunaan RAM (GB) terlebih dahulu.');
    if (tText === '') return fail('t', 'Durasi penggunaan belum diisi.');
    if (rText === '') return fail('r', 'Penggunaan RAM belum diisi.');

    const t = parseDecimal(tText);
    const r = parseDecimal(rText);
    if (!Number.isFinite(t)) return fail('t', 'Durasi harus berupa angka, misalnya 6 atau 6,5 (maksimal ' + MAX_DECIMALS + ' angka di belakang koma).');
    if (!Number.isFinite(r)) return fail('r', 'Penggunaan RAM harus berupa angka, misalnya 4,8 (maksimal ' + MAX_DECIMALS + ' angka di belakang koma).');
    if (t <= 0) return fail('t', 'Durasi harus lebih besar dari 0 jam.');
    if (r <= 0) return fail('r', 'Penggunaan RAM harus lebih besar dari 0 GB.');
    if (t > MAX_VALUE) return fail('t', 'Durasi terlalu besar (maksimum ' + MAX_VALUE + ' jam).');
    if (r > MAX_VALUE) return fail('r', 'Penggunaan RAM terlalu besar (maksimum ' + MAX_VALUE + ' GB).');

    const duplicate = points.some(function (p, i) { return i !== skip && Math.abs(p.t - t) <= EPS; });
    if (duplicate) {
      return fail('t', 'Durasi ' + formatNumber(t, MAX_DECIMALS) + ' jam sudah ada. Gunakan durasi yang berbeda atau ubah nilai RAM pada baris yang sudah ada.');
    }
    return { ok: true, t: t, r: r };
  }

  /* ======================================================
   * 4. INTERPOLASI LINEAR DAN TURUNAN
   * ==================================================== */

  // Kemiringan interval ke-i: (R_next - R_current) / (t_next - t_current)
  function intervalSlope(points, i) {
    const a = points[i];
    const b = points[i + 1];
    return (b.r - a.r) / (b.t - a.t);
  }

  function slopesEqual(a, b) {
    return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  }

  function isInRange(points, t) {
    return Number.isFinite(t) && t >= points[0].t - EPS && t <= points[points.length - 1].t + EPS;
  }

  // Indeks interval i sehingga t_i <= t <= t_{i+1}.
  function findIntervalIndex(points, t) {
    for (let i = 0; i < points.length - 1; i++) {
      if (t <= points[i + 1].t + EPS) return i;
    }
    return points.length - 2;
  }

  // R(t) dengan interpolasi linear. Hanya untuk t di dalam rentang data.
  function evaluateAt(points, t) {
    for (let k = 0; k < points.length; k++) {
      if (Math.abs(points[k].t - t) <= EPS) return points[k].r;
    }
    const i = findIntervalIndex(points, t);
    return points[i].r + intervalSlope(points, i) * (t - points[i].t);
  }

  // Informasi turunan di waktu t.
  // kind: 'interval' | 'smooth' | 'corner' | 'start' | 'end'
  function derivativeAt(points, t) {
    const n = points.length;
    const k = points.findIndex(function (p) { return Math.abs(p.t - t) <= EPS; });

    if (k === -1) {
      const i = findIntervalIndex(points, t);
      return { kind: 'interval', pointIndex: -1, intervalIndex: i, left: null, right: null, value: intervalSlope(points, i) };
    }
    if (k === 0) {
      const m = intervalSlope(points, 0);
      return { kind: 'start', pointIndex: 0, intervalIndex: 0, left: null, right: m, value: m };
    }
    if (k === n - 1) {
      const m = intervalSlope(points, n - 2);
      return { kind: 'end', pointIndex: k, intervalIndex: n - 2, left: m, right: null, value: m };
    }
    const left = intervalSlope(points, k - 1);
    const right = intervalSlope(points, k);
    if (slopesEqual(left, right)) {
      return { kind: 'smooth', pointIndex: k, intervalIndex: k, left: left, right: right, value: left };
    }
    return { kind: 'corner', pointIndex: k, intervalIndex: k, left: left, right: right, value: null };
  }

  // Laju perubahan rata-rata antara t1 dan t2.
  function calcAverageRate(points, rawT1, rawT2) {
    const s1 = rawT1 === null || rawT1 === undefined ? '' : String(rawT1).trim();
    const s2 = rawT2 === null || rawT2 === undefined ? '' : String(rawT2).trim();
    if (s1 === '' || s2 === '') return { ok: false, message: 'Isi waktu awal (t₁) dan waktu akhir (t₂) terlebih dahulu.' };
    const t1 = parseDecimal(s1);
    const t2 = parseDecimal(s2);
    if (!Number.isFinite(t1) || !Number.isFinite(t2)) return { ok: false, message: 'Waktu harus berupa angka, misalnya 2 atau 2,5.' };
    const lo = points[0].t;
    const hi = points[points.length - 1].t;
    if (!isInRange(points, t1) || !isInRange(points, t2)) {
      return { ok: false, message: 'Waktu harus berada dalam rentang data, yaitu ' + formatNumber(lo) + ' sampai ' + formatNumber(hi) + ' jam.' };
    }
    if (!(t1 < t2 - EPS)) return { ok: false, message: 'Waktu awal (t₁) harus lebih kecil dari waktu akhir (t₂).' };
    const r1 = evaluateAt(points, t1);
    const r2 = evaluateAt(points, t2);
    return { ok: true, t1: t1, t2: t2, r1: r1, r2: r2, rate: (r2 - r1) / (t2 - t1) };
  }

  // Laju perubahan sesaat (turunan) di waktu t.
  function calcInstantRate(points, rawT) {
    const s = rawT === null || rawT === undefined ? '' : String(rawT).trim();
    if (s === '') return { ok: false, message: 'Isi waktu (t) terlebih dahulu.' };
    const t = parseDecimal(s);
    if (!Number.isFinite(t)) return { ok: false, message: 'Waktu harus berupa angka, misalnya 2 atau 2,5.' };
    const lo = points[0].t;
    const hi = points[points.length - 1].t;
    if (!isInRange(points, t)) {
      return { ok: false, message: 'Waktu harus berada dalam rentang data, yaitu ' + formatNumber(lo) + ' sampai ' + formatNumber(hi) + ' jam.' };
    }
    return { ok: true, t: t, r: evaluateAt(points, t), info: derivativeAt(points, t) };
  }

  /* ======================================================
   * 5. RINGKASAN DAN KESIMPULAN
   * ==================================================== */
  function computeSummary(points) {
    const n = points.length;
    const rs = points.map(function (p) { return p.r; });
    const first = points[0];
    const last = points[n - 1];
    const minR = Math.min.apply(null, rs);
    const maxR = Math.max.apply(null, rs);
    const change = last.r - first.r;
    const duration = last.t - first.t;

    const slopes = [];
    for (let i = 0; i < n - 1; i++) slopes.push(intervalSlope(points, i));
    let up = 0, down = 0, flat = 0, maxIdx = 0, minIdx = 0;
    slopes.forEach(function (m, i) {
      if (Math.abs(m) <= EPS) flat++;
      else if (m > 0) up++;
      else down++;
      if (m > slopes[maxIdx]) maxIdx = i;
      if (m < slopes[minIdx]) minIdx = i;
    });

    return {
      count: n, minR: minR, maxR: maxR, spread: maxR - minR,
      first: first, last: last, change: change,
      avgRate: change / duration,
      slopes: slopes, intervalCount: slopes.length,
      up: up, down: down, flat: flat,
      maxIdx: maxIdx, minIdx: minIdx
    };
  }

  function buildConclusion(points) {
    const S = computeSummary(points);
    const f = function (v) { return formatNumber(v); };
    const out = [];

    if (Math.abs(S.change) <= EPS) {
      out.push('Nilai awal dan akhir sama: RAM simulasi pada durasi terendah (t = ' + f(S.first.t) + ' jam) dan tertinggi (t = ' + f(S.last.t) + ' jam) sama-sama ' + f(S.first.r) + ' GB, sehingga laju perubahan rata-rata antara kedua ujung rentang adalah 0 GB/jam.');
    } else if (S.change > 0) {
      out.push('Nilai RAM simulasi meningkat secara keseluruhan dalam rentang yang ditampilkan: dari ' + f(S.first.r) + ' GB pada t = ' + f(S.first.t) + ' jam menjadi ' + f(S.last.r) + ' GB pada t = ' + f(S.last.t) + ' jam, atau naik ' + f(S.change) + ' GB dengan laju rata-rata ' + f(S.avgRate) + ' GB/jam.');
    } else {
      out.push('Nilai RAM simulasi menurun secara keseluruhan dalam rentang yang ditampilkan: dari ' + f(S.first.r) + ' GB pada t = ' + f(S.first.t) + ' jam menjadi ' + f(S.last.r) + ' GB pada t = ' + f(S.last.t) + ' jam, atau turun ' + f(-S.change) + ' GB dengan laju rata-rata ' + f(S.avgRate) + ' GB/jam (tanda negatif berarti menurun).');
    }

    if (S.intervalCount === 1) {
      out.push('Hanya ada satu interval, sehingga laju perubahan hanya menggambarkan kemiringan antara dua titik data. Pola di antara kedua titik tidak dapat disimpulkan.');
    } else {
      const maxM = S.slopes[S.maxIdx];
      const minM = S.slopes[S.minIdx];
      let text = 'Dari ' + S.intervalCount + ' interval, ' + S.up + ' menunjukkan kenaikan, ' + S.down + ' penurunan, dan ' + S.flat + ' tidak berubah. ';
      if (slopesEqual(maxM, minM)) {
        text += 'Semua interval memiliki kemiringan yang sama, yaitu ' + f(maxM) + ' GB/jam.';
      } else {
        text += 'Kemiringan terbesar adalah ' + f(maxM) + ' GB/jam pada interval t = ' + f(points[S.maxIdx].t) + ' sampai ' + f(points[S.maxIdx + 1].t) + ' jam, dan yang terkecil adalah ' + f(minM) + ' GB/jam pada interval t = ' + f(points[S.minIdx].t) + ' sampai ' + f(points[S.minIdx + 1].t) + ' jam.';
        let nonInc = true, nonDec = true;
        for (let i = 0; i < S.slopes.length - 1; i++) {
          if (S.slopes[i + 1] > S.slopes[i] + EPS) nonInc = false;
          if (S.slopes[i + 1] < S.slopes[i] - EPS) nonDec = false;
        }
        if (nonInc) text += ' Dari kiri ke kanan, kemiringan antar interval tidak pernah bertambah.';
        else if (nonDec) text += ' Dari kiri ke kanan, kemiringan antar interval tidak pernah berkurang.';
        else text += ' Kemiringan antar interval berubah naik dan turun.';
      }
      out.push(text);
    }

    out.push('Kesimpulan ini hanya mengikuti data simulasi yang sedang digunakan. Hasil ini tidak dapat digeneralisasi menjadi perilaku nyata Adobe Photoshop atau pengguna aplikasi tersebut.');
    return out;
  }

  /* ======================================================
   * 6. PENYIMPANAN LOKAL
   * ==================================================== */
  function getStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    } catch (e) { /* akses ditolak */ }
    return null;
  }

  function isValidStoredPoint(p) {
    return p !== null && typeof p === 'object' &&
      typeof p.t === 'number' && typeof p.r === 'number' &&
      Number.isFinite(p.t) && Number.isFinite(p.r) &&
      p.t > 0 && p.r > 0 && p.t <= MAX_VALUE && p.r <= MAX_VALUE;
  }

  // Mengembalikan array titik terurut, atau null jika data tidak valid.
  function validateStoredData(obj) {
    if (!obj || typeof obj !== 'object') return null;
    if (obj.version !== STORAGE_VERSION || !Array.isArray(obj.points)) return null;
    if (obj.points.length < MIN_POINTS || obj.points.length > MAX_POINTS) return null;
    if (!obj.points.every(isValidStoredPoint)) return null;
    const sorted = sortPoints(obj.points.map(function (p) { return { t: p.t, r: p.r }; }));
    for (let i = 0; i < sorted.length - 1; i++) {
      if (Math.abs(sorted[i + 1].t - sorted[i].t) <= EPS) return null;
    }
    return sorted;
  }

  // status: 'default' | 'loaded' | 'recovered' | 'unavailable'
  function loadPoints(storage) {
    if (!storage) return { points: cloneInitialData(), status: 'unavailable' };
    let raw;
    try {
      raw = storage.getItem(STORAGE_KEY);
    } catch (e) {
      return { points: cloneInitialData(), status: 'unavailable' };
    }
    if (raw === null) return { points: cloneInitialData(), status: 'default' };
    try {
      const valid = validateStoredData(JSON.parse(raw));
      if (valid) return { points: valid, status: 'loaded' };
    } catch (e) { /* JSON rusak */ }
    return { points: cloneInitialData(), status: 'recovered' };
  }

  function savePoints(storage, points) {
    if (!storage) return false;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, points: points }));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ======================================================
   * 7. EKSPOR CSV
   * ==================================================== */
  // Pemisah kolom koma, desimal titik.
  function toCsv(points) {
    const lines = ['durasi_jam,ram_gb'];
    points.forEach(function (p) { lines.push(String(p.t) + ',' + String(p.r)); });
    return lines.join('\n') + '\n';
  }

  /* ======================================================
   * Pembantu grafik (murni): skala dan tick "rapi"
   * ==================================================== */
  function niceStep(range, targetTicks) {
    if (!(range > 0)) return 1;
    const raw = range / targetTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    let factor;
    if (norm <= 1) factor = 1;
    else if (norm <= 2) factor = 2;
    else if (norm <= 5) factor = 5;
    else factor = 10;
    return factor * mag;
  }

  function makeTicks(min, max, step) {
    const out = [];
    const start = Math.ceil(min / step - 1e-9);
    const end = Math.floor(max / step + 1e-9);
    for (let k = start; k <= end; k++) out.push(Number((k * step).toFixed(10)));
    return out;
  }

  function computeChartScale(points) {
    const ts = points.map(function (p) { return p.t; });
    const rs = points.map(function (p) { return p.r; });
    const tMin = Math.min.apply(null, ts);
    const tMax = Math.max.apply(null, ts);
    const rMin = Math.min.apply(null, rs);
    const rMax = Math.max.apply(null, rs);
    const tSpan = tMax - tMin;

    const xLo = Math.max(0, tMin - tSpan * 0.06);
    const xHi = tMax + tSpan * 0.06;
    const xStep = niceStep(xHi - xLo, 6);

    const spread = rMax - rMin;
    let yLo = 0;
    let yHi;
    let yStep;
    let truncated = false;

    if (spread > 0 && spread < 0.2 * rMax) {
      // Data sangat rapat: sumbu dipotong agar perubahan kecil tetap terbaca (diberi catatan).
      truncated = true;
      const lo = Math.max(0, rMin - spread * 0.3);
      const hi = rMax + spread * 0.3;
      yStep = niceStep(hi - lo, 5);
      yLo = Math.floor(lo / yStep + 1e-9) * yStep;
      yHi = Math.ceil(hi / yStep - 1e-9) * yStep;
      if (yLo <= 0) { yLo = 0; truncated = false; }
    } else {
      yStep = niceStep(rMax * 1.08, 5);
      yHi = Math.ceil((rMax * 1.08) / yStep - 1e-9) * yStep;
    }

    return {
      xLo: xLo, xHi: xHi, yLo: yLo, yHi: yHi,
      xTicks: makeTicks(xLo, xHi, xStep),
      yTicks: makeTicks(yLo, yHi, yStep),
      truncated: truncated
    };
  }

  /* ======================================================
   * API untuk pengujian di Node.js
   * ==================================================== */
  const api = {
    INITIAL_DATA: INITIAL_DATA, MSG_CORNER: MSG_CORNER,
    cloneInitialData: cloneInitialData, formatNumber: formatNumber, parseDecimal: parseDecimal,
    validateEntry: validateEntry, sortPoints: sortPoints,
    intervalSlope: intervalSlope, evaluateAt: evaluateAt, derivativeAt: derivativeAt,
    calcAverageRate: calcAverageRate, calcInstantRate: calcInstantRate,
    computeSummary: computeSummary, buildConclusion: buildConclusion,
    validateStoredData: validateStoredData, loadPoints: loadPoints, savePoints: savePoints,
    toCsv: toCsv, computeChartScale: computeChartScale, STORAGE_KEY: STORAGE_KEY
  };
  if (typeof module === 'object' && module && module.exports) module.exports = api;

  if (typeof document === 'undefined') return;

  /* ======================================================
   * 8. ANTARMUKA (BROWSER)
   * ==================================================== */
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function h(tag, options, children) {
    const node = document.createElement(tag);
    if (options) {
      Object.keys(options).forEach(function (key) {
        const v = options[key];
        if (v === undefined || v === null || v === false) return;
        if (key === 'text') node.textContent = v;
        else node.setAttribute(key, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function s(tag, attrs, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clear(node) { node.textContent = ''; }
  function fmt(v) { return formatNumber(v); }

  function rateWords(m) {
    if (Math.abs(m) <= EPS) return 'tidak berubah (laju 0 GB per jam)';
    if (m > 0) return 'meningkat rata-rata ' + fmt(m) + ' GB per jam';
    return 'menurun rata-rata ' + fmt(-m) + ' GB per jam';
  }

  function startApp() {
    const $ = function (sel) { return document.querySelector(sel); };
    const el = {
      dataBody: $('#data-body'), notice: $('#notice-storage'),
      formTambah: $('#form-tambah'), inputT: $('#input-t'), inputR: $('#input-r'),
      formMessage: $('#form-message'), btnReset: $('#btn-reset'), btnCsv: $('#btn-csv'),
      chartWrap: $('#chart-wrap'), chartSvg: $('#chart-svg'), tooltip: $('#chart-tooltip'),
      readout: $('#titik-terpilih'), axisNote: $('#chart-axis-note'),
      exampleSelect: $('#contoh-interval'), exampleOut: $('#contoh-hasil'),
      tblInterval: $('#tabel-interval-body'), tblTitik: $('#tabel-titik-body'),
      calcRange: $('#calc-rentang'), calcT1: $('#calc-t1'), calcT2: $('#calc-t2'), calcT: $('#calc-t'),
      formRata: $('#form-rata'), formSesaat: $('#form-sesaat'),
      outRata: $('#hasil-rata'), outSesaat: $('#hasil-sesaat'),
      summary: $('#ringkasan-grid'), conclusion: $('#kesimpulan')
    };

    const state = {
      points: cloneInitialData(),
      storage: getStorage(),
      selectedT: null,
      hoverIndex: -1,
      chartPts: [],
      exampleIndex: null,
      lastChartWidth: 0
    };

    /* ---------- Pesan & penyimpanan ---------- */
    function setMessage(text, type) {
      el.formMessage.textContent = text;
      el.formMessage.className = 'message' + (type ? ' ' + type : '');
    }

    function showNotice(text) {
      el.notice.textContent = text;
      el.notice.hidden = false;
    }

    function persist() {
      const ok = savePoints(state.storage, state.points);
      if (!ok) showNotice('Penyimpanan lokal tidak tersedia di browser ini, sehingga perubahan hanya berlaku selama halaman terbuka.');
      return ok;
    }

    /* ---------- Tabel data ---------- */
    function buildRow(p, i) {
      const tInput = h('input', {
        type: 'text', inputmode: 'decimal', autocomplete: 'off',
        'data-field': 't', 'data-index': String(i),
        'aria-label': 'Durasi titik ke-' + (i + 1) + ' (jam)'
      });
      tInput.value = formatNumber(p.t, MAX_DECIMALS);
      const rInput = h('input', {
        type: 'text', inputmode: 'decimal', autocomplete: 'off',
        'data-field': 'r', 'data-index': String(i),
        'aria-label': 'Penggunaan RAM titik ke-' + (i + 1) + ' (GB)'
      });
      rInput.value = formatNumber(p.r, MAX_DECIMALS);
      const del = h('button', {
        type: 'button', className: null, class: 'btn small-btn danger',
        'data-action': 'hapus', 'data-index': String(i),
        'aria-label': 'Hapus titik ke-' + (i + 1), text: 'Hapus'
      });
      return h('tr', { 'data-row': String(i) }, [
        h('td', { text: String(i + 1) }),
        h('td', null, [tInput]),
        h('td', null, [rInput]),
        h('td', null, [del])
      ]);
    }

    function renderTable() {
      clear(el.dataBody);
      state.points.forEach(function (p, i) { el.dataBody.appendChild(buildRow(p, i)); });
      updateDeleteButtons();
    }

    function updateDeleteButtons() {
      const disable = state.points.length <= MIN_POINTS;
      el.dataBody.querySelectorAll('button[data-action="hapus"]').forEach(function (b) {
        b.disabled = disable;
        b.title = disable ? 'Minimal ' + MIN_POINTS + ' titik data harus tersisa.' : '';
      });
    }

    function syncRowInputs(i) {
      const row = el.dataBody.querySelector('tr[data-row="' + i + '"]');
      if (!row) return;
      row.querySelector('[data-field="t"]').value = formatNumber(state.points[i].t, MAX_DECIMALS);
      row.querySelector('[data-field="r"]').value = formatNumber(state.points[i].r, MAX_DECIMALS);
    }

    function handleCellEdit(input) {
      const idx = Number(input.dataset.index);
      if (!Number.isInteger(idx) || idx < 0 || idx >= state.points.length) return;
      const row = input.closest('tr');
      const tText = row.querySelector('[data-field="t"]').value;
      const rText = row.querySelector('[data-field="r"]').value;
      const check = validateEntry(tText, rText, state.points, idx);
      if (!check.ok) {
        setMessage('Baris ke-' + (idx + 1) + ' tidak diubah. ' + check.message, 'error');
        syncRowInputs(idx);
        return;
      }
      const old = state.points[idx];
      if (Math.abs(old.t - check.t) <= EPS && Math.abs(old.r - check.r) <= EPS) {
        syncRowInputs(idx);
        return;
      }
      const edited = state.points.map(function (p, i) { return i === idx ? { t: check.t, r: check.r } : p; });
      const sorted = sortPoints(edited);
      const newIndex = sorted.findIndex(function (p) { return p.t === check.t; });
      state.points = sorted;
      persist();
      setMessage('Berhasil: titik data diperbarui menjadi t = ' + fmt(check.t) + ' jam dan R = ' + fmt(check.r) + ' GB.', 'ok');
      if (newIndex !== idx) {
        refreshAll(true);
      } else {
        syncRowInputs(idx);
        refreshAll(false);
      }
    }

    function addPoint(rawT, rawR) {
      if (state.points.length >= MAX_POINTS) {
        setMessage('Jumlah titik data sudah mencapai batas maksimum (' + MAX_POINTS + ' titik).', 'error');
        return;
      }
      const check = validateEntry(rawT, rawR, state.points, -1);
      if (!check.ok) {
        setMessage(check.message, 'error');
        (check.field === 'r' ? el.inputR : el.inputT).focus();
        return;
      }
      state.points = sortPoints(state.points.concat([{ t: check.t, r: check.r }]));
      persist();
      el.inputT.value = '';
      el.inputR.value = '';
      el.inputT.focus();
      setMessage('Berhasil: titik data t = ' + fmt(check.t) + ' jam, R = ' + fmt(check.r) + ' GB ditambahkan. Data diurutkan berdasarkan durasi.', 'ok');
      refreshAll(true);
    }

    function deletePoint(idx) {
      if (state.points.length <= MIN_POINTS) {
        setMessage('Titik tidak dapat dihapus. Minimal ' + MIN_POINTS + ' titik data harus tersisa.', 'error');
        return;
      }
      const removed = state.points[idx];
      state.points = state.points.filter(function (_, i) { return i !== idx; });
      persist();
      setMessage('Berhasil: titik t = ' + fmt(removed.t) + ' jam dihapus.', 'ok');
      refreshAll(true);
    }

    function resetData() {
      state.points = cloneInitialData();
      state.selectedT = null;
      state.exampleIndex = null;
      setCalcDefaults();
      persist();
      setMessage('Berhasil: data dikembalikan ke data simulasi awal.', 'ok');
      refreshAll(true);
    }

    function downloadCsv() {
      try {
        const blob = new Blob(['\uFEFF' + toCsv(state.points)], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'data-simulasi-ram-photoshop.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
        setMessage('Berhasil: berkas CSV berisi ' + state.points.length + ' titik data diunduh.', 'ok');
      } catch (e) {
        setMessage('Gagal membuat berkas CSV di browser ini.', 'error');
      }
    }

    /* ---------- Grafik ---------- */
    function describePoint(i) {
      const p = state.points[i];
      const d = derivativeAt(state.points, p.t);
      const lines = ['Titik ke-' + (i + 1), 'Durasi t = ' + fmt(p.t) + ' jam', 'R(t) = ' + fmt(p.r) + ' GB'];
      if (d.kind === 'start') lines.push('Kemiringan kanan = ' + fmt(d.right) + ' GB/jam (turunan satu sisi)');
      else if (d.kind === 'end') lines.push('Kemiringan kiri = ' + fmt(d.left) + ' GB/jam (turunan satu sisi)');
      else if (d.kind === 'smooth') lines.push('R′(t) = ' + fmt(d.value) + ' GB/jam (kemiringan kiri dan kanan sama)');
      else lines.push('Kemiringan kiri = ' + fmt(d.left) + ' dan kanan = ' + fmt(d.right) + ' GB/jam. Turunan dua sisi tidak terdefinisi.');
      return lines;
    }

    function selectedIndex() {
      if (state.selectedT === null) return -1;
      const i = state.points.findIndex(function (p) { return Math.abs(p.t - state.selectedT) <= EPS; });
      if (i === -1) state.selectedT = null;
      return i;
    }

    function updateTooltip() {
      const idx = state.hoverIndex >= 0 ? state.hoverIndex : selectedIndex();
      const pt = state.chartPts[idx];
      if (idx < 0 || !pt) { el.tooltip.hidden = true; return; }
      clear(el.tooltip);
      describePoint(idx).forEach(function (line, k) {
        el.tooltip.appendChild(h('p', { class: k === 0 ? 'tip-title' : null, text: line }));
      });
      el.tooltip.hidden = false;
      const w = el.tooltip.offsetWidth;
      const hh = el.tooltip.offsetHeight;
      const W = el.chartWrap.clientWidth;
      let left = pt.cx - w / 2;
      left = Math.max(4, Math.min(W - w - 4, left));
      let top = pt.cy - hh - 14;
      if (top < 4) top = pt.cy + 14;
      el.tooltip.style.left = left + 'px';
      el.tooltip.style.top = top + 'px';
    }

    function renderReadout() {
      clear(el.readout);
      const idx = selectedIndex();
      if (idx < 0) {
        el.readout.appendChild(h('p', { text: 'Pilih sebuah titik pada grafik (klik, ketuk, atau tekan Enter saat titik difokuskan) untuk melihat nilainya.' }));
        return;
      }
      describePoint(idx).forEach(function (line, k) {
        el.readout.appendChild(h('p', { class: k === 0 ? 'readout-title' : null, text: line }));
      });
    }

    function applySelectionClasses() {
      const idx = selectedIndex();
      el.chartSvg.querySelectorAll('.pt').forEach(function (g) {
        const on = Number(g.getAttribute('data-index')) === idx;
        g.classList.toggle('is-selected', on);
        g.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    function setSelected(idx) {
      state.selectedT = idx >= 0 ? state.points[idx].t : null;
      applySelectionClasses();
      renderReadout();
      updateTooltip();
    }

    function renderChart() {
      const pts = state.points;
      const measured = Math.floor(el.chartWrap.clientWidth);
      state.lastChartWidth = measured;
      const W = Math.max(280, measured || 640);
      const H = W < 480 ? 320 : (W < 760 ? 380 : 420);
      const m = { l: W < 480 ? 48 : 60, r: W < 480 ? 14 : 24, t: 18, b: W < 480 ? 52 : 58 };
      const plotW = W - m.l - m.r;
      const plotH = H - m.t - m.b;
      const sc = computeChartScale(pts);
      const x = function (t) { return m.l + ((t - sc.xLo) / (sc.xHi - sc.xLo)) * plotW; };
      const y = function (r) { return m.t + plotH - ((r - sc.yLo) / (sc.yHi - sc.yLo)) * plotH; };

      const svg = el.chartSvg;
      clear(svg);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', String(W));
      svg.setAttribute('height', String(H));

      // grid dan skala
      sc.yTicks.forEach(function (v) {
        svg.appendChild(s('line', { class: 'grid-line', x1: m.l, x2: m.l + plotW, y1: y(v), y2: y(v) }));
        svg.appendChild(s('text', { class: 'tick-label', x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, fmt(v)));
      });
      sc.xTicks.forEach(function (v) {
        svg.appendChild(s('line', { class: 'grid-line', x1: x(v), x2: x(v), y1: m.t, y2: m.t + plotH }));
        svg.appendChild(s('line', { class: 'tick-line', x1: x(v), x2: x(v), y1: m.t + plotH, y2: m.t + plotH + 5 }));
        svg.appendChild(s('text', { class: 'tick-label', x: x(v), y: m.t + plotH + 19, 'text-anchor': 'middle' }, fmt(v)));
      });

      // sumbu
      svg.appendChild(s('line', { class: 'axis-line', x1: m.l, x2: m.l + plotW, y1: m.t + plotH, y2: m.t + plotH }));
      svg.appendChild(s('line', { class: 'axis-line', x1: m.l, x2: m.l, y1: m.t, y2: m.t + plotH }));
      svg.appendChild(s('text', { class: 'axis-title', x: m.l + plotW / 2, y: H - 10, 'text-anchor': 'middle' }, 'Durasi penggunaan, t (jam)'));
      svg.appendChild(s('text', {
        class: 'axis-title', x: 14, y: m.t + plotH / 2, 'text-anchor': 'middle',
        transform: 'rotate(-90 14 ' + (m.t + plotH / 2) + ')'
      }, 'Penggunaan RAM, R(t) (GB)'));

      // area dan garis
      const coords = pts.map(function (p) { return x(p.t) + ',' + y(p.r); });
      svg.appendChild(s('polygon', {
        class: 'series-area',
        points: x(pts[0].t) + ',' + (m.t + plotH) + ' ' + coords.join(' ') + ' ' + x(pts[pts.length - 1].t) + ',' + (m.t + plotH)
      }));
      svg.appendChild(s('polyline', { class: 'series-line', points: coords.join(' ') }));

      // titik data interaktif
      state.chartPts = [];
      pts.forEach(function (p, i) {
        const cx = x(p.t);
        const cy = y(p.r);
        state.chartPts.push({ cx: cx, cy: cy });
        const g = s('g', {
          class: 'pt', tabindex: '0', role: 'button', 'data-index': String(i), 'aria-pressed': 'false',
          'aria-label': 'Titik ke-' + (i + 1) + ': t = ' + fmt(p.t) + ' jam, R = ' + fmt(p.r) + ' GB'
        });
        g.appendChild(s('circle', { class: 'pt-hit', cx: cx, cy: cy, r: 18 }));
        g.appendChild(s('circle', { class: 'pt-halo', cx: cx, cy: cy, r: 12 }));
        g.appendChild(s('circle', { class: 'pt-dot', cx: cx, cy: cy, r: 5.5 }));
        g.addEventListener('pointerenter', function (e) {
          if (e.pointerType === 'mouse') { state.hoverIndex = i; updateTooltip(); }
        });
        g.addEventListener('pointerleave', function (e) {
          if (e.pointerType === 'mouse') { state.hoverIndex = -1; updateTooltip(); }
        });
        g.addEventListener('focus', function () { state.hoverIndex = i; updateTooltip(); });
        g.addEventListener('blur', function () { state.hoverIndex = -1; updateTooltip(); });
        g.addEventListener('click', function (e) {
          e.stopPropagation();
          setSelected(selectedIndex() === i ? -1 : i);
        });
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelected(selectedIndex() === i ? -1 : i);
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const next = svg.querySelector('.pt[data-index="' + (i + (e.key === 'ArrowRight' ? 1 : -1)) + '"]');
            if (next) next.focus();
          } else if (e.key === 'Escape') {
            setSelected(-1);
          }
        });
        svg.appendChild(g);
      });

      el.axisNote.textContent = sc.truncated
        ? 'Perhatian: sumbu vertikal tidak dimulai dari 0 GB agar perubahan kecil tetap terbaca. Perhatikan angka pada skala saat membandingkan tinggi titik.'
        : 'Sumbu vertikal dimulai dari 0 GB, sehingga tinggi titik sebanding dengan nilai RAM simulasi.';

      applySelectionClasses();
      renderReadout();
      updateTooltip();
    }

    /* ---------- Model dan turunan ---------- */
    function intervalFormula(i) {
      const a = state.points[i];
      const m = intervalSlope(state.points, i);
      return 'R(t) = ' + fmt(a.r) + ' ' + (m < 0 ? '\u2212' : '+') + ' ' + fmt(Math.abs(m)) + '(t \u2212 ' + fmt(a.t) + ')';
    }

    function renderExample() {
      const pts = state.points;
      const i = state.exampleIndex;
      const a = pts[i];
      const b = pts[i + 1];
      const m = intervalSlope(pts, i);
      clear(el.exampleOut);
      el.exampleOut.appendChild(h('p', { text: 'Dua titik berurutan: (t; R) = (' + fmt(a.t) + '; ' + fmt(a.r) + ') dan (' + fmt(b.t) + '; ' + fmt(b.r) + ').' }));
      el.exampleOut.appendChild(h('p', { class: 'eq', text: 'R′(t) = (' + fmt(b.r) + ' \u2212 ' + fmt(a.r) + ') / (' + fmt(b.t) + ' \u2212 ' + fmt(a.t) + ') = ' + fmt(m) + ' GB/jam' }));
      el.exampleOut.appendChild(h('p', { text: 'Interpretasi: pada interval t = ' + fmt(a.t) + ' sampai t = ' + fmt(b.t) + ' jam, penggunaan RAM simulasi ' + rateWords(m) + '. Karena model pada interval tersebut berupa garis lurus, laju perubahan di bagian dalam interval itu juga bernilai ' + fmt(m) + ' GB/jam.' }));
      el.exampleOut.appendChild(h('p', { class: 'note', text: 'Satuan: GB dibagi jam = GB/jam. Contoh ini memakai data simulasi, bukan hasil pengukuran nyata.' }));
    }

    function renderModel() {
      const pts = state.points;
      const nInt = pts.length - 1;

      clear(el.tblInterval);
      for (let i = 0; i < nInt; i++) {
        el.tblInterval.appendChild(h('tr', null, [
          h('td', { text: String(i + 1) }),
          h('td', { text: fmt(pts[i].t) + ' \u2264 t \u2264 ' + fmt(pts[i + 1].t) + ' jam' }),
          h('td', { class: 'math', text: intervalFormula(i) }),
          h('td', { text: fmt(intervalSlope(pts, i)) + ' GB/jam' })
        ]));
      }

      clear(el.tblTitik);
      pts.forEach(function (p) {
        const d = derivativeAt(pts, p.t);
        let status;
        let note;
        if (d.kind === 'start') { status = 'Satu sisi (kanan)'; note = 'Titik awal: hanya turunan satu sisi dalam domain data, sama dengan kemiringan interval pertama.'; }
        else if (d.kind === 'end') { status = 'Satu sisi (kiri)'; note = 'Titik akhir: hanya turunan satu sisi dalam domain data, sama dengan kemiringan interval terakhir.'; }
        else if (d.kind === 'smooth') { status = 'Ada: ' + fmt(d.value) + ' GB/jam'; note = 'Kemiringan kiri dan kanan sama, sehingga turunan dua sisi ada.'; }
        else { status = 'Tidak terdefinisi (dua sisi)'; note = MSG_CORNER; }
        el.tblTitik.appendChild(h('tr', null, [
          h('td', { text: fmt(p.t) }),
          h('td', { text: d.left === null ? '–' : fmt(d.left) }),
          h('td', { text: d.right === null ? '–' : fmt(d.right) }),
          h('td', { text: status }),
          h('td', { text: note })
        ]));
      });

      // pilihan interval contoh
      if (state.exampleIndex === null || state.exampleIndex < 0 || state.exampleIndex >= nInt) {
        let def = 0;
        for (let i = 0; i < nInt; i++) {
          if (Math.abs(pts[i].t - 2) <= EPS && Math.abs(pts[i + 1].t - 3) <= EPS) { def = i; break; }
        }
        state.exampleIndex = def;
      }
      clear(el.exampleSelect);
      for (let i = 0; i < nInt; i++) {
        el.exampleSelect.appendChild(h('option', { value: String(i), text: 'Interval ' + (i + 1) + ': t = ' + fmt(pts[i].t) + ' sampai ' + fmt(pts[i + 1].t) + ' jam' }));
      }
      el.exampleSelect.value = String(state.exampleIndex);
      renderExample();
    }

    /* ---------- Kalkulator ---------- */
    function setCalcDefaults() {
      const pts = state.points;
      el.calcT1.value = formatNumber(pts[0].t, MAX_DECIMALS);
      el.calcT2.value = formatNumber(pts[pts.length - 1].t, MAX_DECIMALS);
      el.calcT.value = formatNumber((pts[0].t + pts[1].t) / 2, MAX_DECIMALS);
    }

    function showResult(box, type, title, lines) {
      clear(box);
      const wrap = h('div', { class: 'result' + (type ? ' ' + type : '') });
      wrap.appendChild(h('p', { class: 'result-main', text: title }));
      lines.forEach(function (line) { wrap.appendChild(h('p', { class: line.note ? 'result-note' : null, text: line.text })); });
      box.appendChild(wrap);
    }

    const SIM_NOTE = { note: true, text: 'Hasil ini dihitung dari data simulasi, bukan pengukuran Adobe Photoshop.' };

    function renderAverage() {
      const r = calcAverageRate(state.points, el.calcT1.value, el.calcT2.value);
      if (!r.ok) { showResult(el.outRata, 'error', 'Input belum valid', [{ text: r.message }]); return; }
      const lines = [
        { text: 'R(t\u2081) = R(' + fmt(r.t1) + ') = ' + fmt(r.r1) + ' GB dan R(t\u2082) = R(' + fmt(r.t2) + ') = ' + fmt(r.r2) + ' GB.' },
        { text: 'Laju rata-rata = (' + fmt(r.r2) + ' \u2212 ' + fmt(r.r1) + ') / (' + fmt(r.t2) + ' \u2212 ' + fmt(r.t1) + ') = ' + fmt(r.rate) + ' GB/jam.' },
        { text: 'Artinya, dari t = ' + fmt(r.t1) + ' sampai t = ' + fmt(r.t2) + ' jam, penggunaan RAM simulasi ' + rateWords(r.rate) + '.' },
        { note: true, text: 'Nilai R(t) di antara titik data dihitung dengan interpolasi linear pada interval yang sesuai.' },
        SIM_NOTE
      ];
      showResult(el.outRata, '', 'Laju rata-rata = ' + fmt(r.rate) + ' GB/jam', lines);
    }

    function renderInstant() {
      const r = calcInstantRate(state.points, el.calcT.value);
      if (!r.ok) { showResult(el.outSesaat, 'error', 'Input belum valid', [{ text: r.message }]); return; }
      const d = r.info;
      const pts = state.points;
      const rLine = { text: 'Nilai model pada titik ini: R(' + fmt(r.t) + ') = ' + fmt(r.r) + ' GB.' };
      if (d.kind === 'interval') {
        const a = pts[d.intervalIndex];
        const b = pts[d.intervalIndex + 1];
        showResult(el.outSesaat, '', 'R\u2032(' + fmt(r.t) + ') = ' + fmt(d.value) + ' GB/jam', [
          { text: 'Waktu ini berada di dalam interval t = ' + fmt(a.t) + ' sampai ' + fmt(b.t) + ' jam, dengan model garis lurus. Pada saat itu penggunaan RAM simulasi ' + rateWords(d.value) + '.' },
          rLine, SIM_NOTE
        ]);
      } else if (d.kind === 'smooth') {
        showResult(el.outSesaat, '', 'R\u2032(' + fmt(r.t) + ') = ' + fmt(d.value) + ' GB/jam', [
          { text: 'Titik ini adalah titik sambungan. Kemiringan kiri (' + fmt(d.left) + ') dan kanan (' + fmt(d.right) + ') sama, sehingga turunan dua sisi ada.' },
          rLine, SIM_NOTE
        ]);
      } else if (d.kind === 'corner') {
        showResult(el.outSesaat, 'warn', 'Turunan dua sisi tidak terdefinisi di t = ' + fmt(r.t) + ' jam', [
          { text: 'Kemiringan kiri = ' + fmt(d.left) + ' GB/jam dan kemiringan kanan = ' + fmt(d.right) + ' GB/jam.' },
          { text: MSG_CORNER },
          rLine, SIM_NOTE
        ]);
      } else if (d.kind === 'start') {
        showResult(el.outSesaat, '', 'Turunan satu sisi (kanan) = ' + fmt(d.right) + ' GB/jam', [
          { text: 'Ini adalah titik awal data (t = ' + fmt(r.t) + ' jam). Hanya turunan satu sisi dalam domain data yang tersedia, yaitu dari sisi kanan.' },
          rLine, SIM_NOTE
        ]);
      } else {
        showResult(el.outSesaat, '', 'Turunan satu sisi (kiri) = ' + fmt(d.left) + ' GB/jam', [
          { text: 'Ini adalah titik akhir data (t = ' + fmt(r.t) + ' jam). Hanya turunan satu sisi dalam domain data yang tersedia, yaitu dari sisi kiri.' },
          rLine, SIM_NOTE
        ]);
      }
    }

    function renderCalculators() {
      const pts = state.points;
      el.calcRange.textContent = 'Rentang waktu yang dapat dipakai: ' + fmt(pts[0].t) + ' sampai ' + fmt(pts[pts.length - 1].t) + ' jam (sesuai data aktif). Waktu di luar rentang ditolak karena model tidak melakukan ekstrapolasi.';
      renderAverage();
      renderInstant();
    }

    /* ---------- Ringkasan ---------- */
    function renderSummary() {
      const S = computeSummary(state.points);
      const items = [
        ['Jumlah titik data', String(S.count)],
        ['RAM minimum', fmt(S.minR) + ' GB'],
        ['RAM maksimum', fmt(S.maxR) + ' GB'],
        ['Selisih maksimum dan minimum', fmt(S.spread) + ' GB'],
        ['Perubahan RAM, titik pertama ke terakhir', (S.change > 0 ? '+' : '') + fmt(S.change) + ' GB'],
        ['Laju rata-rata, durasi terendah ke tertinggi', fmt(S.avgRate) + ' GB/jam']
      ];
      clear(el.summary);
      items.forEach(function (it) {
        el.summary.appendChild(h('div', null, [h('dt', { text: it[0] }), h('dd', { text: it[1] })]));
      });
      clear(el.conclusion);
      buildConclusion(state.points).forEach(function (txt) { el.conclusion.appendChild(h('p', { text: txt })); });
    }

    /* ---------- Render semua komponen dari satu sumber data ---------- */
    function refreshAll(rebuildTable) {
      if (rebuildTable) renderTable();
      else updateDeleteButtons();
      renderChart();
      renderModel();
      renderCalculators();
      renderSummary();
    }

    /* ---------- Event ---------- */
    el.dataBody.addEventListener('change', function (e) {
      if (e.target && e.target.matches('input[data-field]')) handleCellEdit(e.target);
    });
    el.dataBody.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.matches('input[data-field]')) {
        e.preventDefault();
        e.target.blur();
      }
    });
    el.dataBody.addEventListener('click', function (e) {
      const btn = e.target && e.target.closest ? e.target.closest('button[data-action="hapus"]') : null;
      if (btn && !btn.disabled) deletePoint(Number(btn.dataset.index));
    });
    el.formTambah.addEventListener('submit', function (e) {
      e.preventDefault();
      addPoint(el.inputT.value, el.inputR.value);
    });
    el.btnReset.addEventListener('click', resetData);
    el.btnCsv.addEventListener('click', downloadCsv);

    el.formRata.addEventListener('submit', function (e) { e.preventDefault(); renderAverage(); });
    el.formSesaat.addEventListener('submit', function (e) { e.preventDefault(); renderInstant(); });
    el.calcT1.addEventListener('input', renderAverage);
    el.calcT2.addEventListener('input', renderAverage);
    el.calcT.addEventListener('input', renderInstant);

    el.exampleSelect.addEventListener('change', function () {
      state.exampleIndex = Number(el.exampleSelect.value);
      renderExample();
    });

    el.chartSvg.addEventListener('click', function (e) {
      if (!(e.target.closest && e.target.closest('.pt'))) setSelected(-1);
    });

    if ('ResizeObserver' in window) {
      new ResizeObserver(function () {
        if (Math.floor(el.chartWrap.clientWidth) !== state.lastChartWidth) renderChart();
      }).observe(el.chartWrap);
    } else {
      window.addEventListener('resize', function () {
        if (Math.floor(el.chartWrap.clientWidth) !== state.lastChartWidth) renderChart();
      });
    }

    /* ---------- Inisialisasi ---------- */
    const loaded = loadPoints(state.storage);
    state.points = loaded.points;
    if (loaded.status === 'recovered') {
      persist();
      showNotice('Data yang tersimpan di browser rusak atau tidak valid, sehingga situs dikembalikan ke data simulasi awal.');
    } else if (loaded.status === 'unavailable') {
      showNotice('Penyimpanan lokal tidak tersedia di browser ini, sehingga perubahan hanya berlaku selama halaman terbuka.');
    }
    setCalcDefaults();
    refreshAll(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startApp);
  else startApp();
})();
