'use strict';
/* Utilidades generales: fechas, importes, formato y escape de HTML. */

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const U = {
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
  z(n) { return String(n).padStart(2, '0'); },
  iso(d) { return d.getFullYear() + '-' + U.z(d.getMonth() + 1) + '-' + U.z(d.getDate()); },
  today() { return U.iso(new Date()); },
  parse(s) {
    if (!s) return null;
    const p = String(s).split('-').map(Number);
    return new Date(p[0], (p[1] || 1) - 1, p[2] || 1);
  },
  ym(s) { return s ? String(s).slice(0, 7) : ''; },
  year(s) { return s ? String(s).slice(0, 4) : ''; },
  /** días del mes (m de 1 a 12) */
  dim(y, m) { return new Date(y, m, 0).getDate(); },
  addMonths(s, n) {
    const d = U.parse(s);
    const day = d.getDate();
    const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
    t.setDate(Math.min(day, U.dim(t.getFullYear(), t.getMonth() + 1)));
    return U.iso(t);
  },
  addDays(s, n) { const d = U.parse(s); d.setDate(d.getDate() + n); return U.iso(d); },
  /** días naturales de a hasta b (b - a) */
  days(a, b) { return Math.round((U.parse(b) - U.parse(a)) / 86400000); },
  ymAdd(ym, n) {
    const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1);
    return d.getFullYear() + '-' + U.z(d.getMonth() + 1);
  },
  ymRange(a, b) {
    const out = [];
    let c = a, guard = 0;
    while (c <= b && guard++ < 1200) { out.push(c); c = U.ymAdd(c, 1); }
    return out;
  },
  ymDay(ym, day) {
    const y = +ym.slice(0, 4), m = +ym.slice(5, 7);
    return ym + '-' + U.z(Math.min(Math.max(1, +day || 1), U.dim(y, m)));
  },
  ymLast(ym) { return U.ymDay(ym, 31); },
  monthsDiff(a, b) { return (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7)); },
  fdate(s) { return s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '—'; },
  fmonth(ym) { return ym ? MESES[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : '—'; },
  fmonthC(ym) { return ym ? MESES_C[+ym.slice(5, 7) - 1] + ' ' + ym.slice(2, 4) : '—'; },
  cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; },
  /** Convierte texto introducido (1.234,56 / 1234.56 / 1234,5) en número. */
  num(v) {
    if (v === null || v === undefined || v === '') return null;
    if (typeof v === 'number') return isNaN(v) ? null : v;
    let t = String(v).trim().replace(/[\s€%]/g, '');
    if (!t) return null;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const n = parseFloat(t);
    return isNaN(n) ? null : n;
  },
  /** valor numérico para mostrar dentro de un input */
  inNum(n) { return (n === null || n === undefined || n === '') ? '' : String(n).replace('.', ','); },
  eur(n, dec = 2) {
    if (n === null || n === undefined || isNaN(n)) return '—';
    const neg = n < -0.0049;
    let [i, d] = Math.abs(n).toFixed(dec).split('.');
    i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (dec ? ',' + d : '') + ' €';
  },
  pct(n) { return (n === null || n === undefined || !isFinite(n)) ? '—' : n.toFixed(2).replace('.', ',') + ' %'; },
  r2(n) { return Math.round((+n + Number.EPSILON) * 100) / 100; },
  ceil2(n) { return Math.ceil(+n * 100 - 1e-6) / 100; },
  sum(a, f) { return (a || []).reduce((s, x) => s + (f ? (+f(x) || 0) : (+x || 0)), 0); },
  esc(s) {
    return s === null || s === undefined ? '' : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },
  inR(d, from, to) { return !!d && (!from || d >= from) && (!to || d <= to); },
  norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); },
  /** "X años y Y meses" */
  dur(months) {
    if (months === null || months === undefined || !isFinite(months)) return '—';
    const m = Math.max(0, Math.round(months));
    const y = Math.floor(m / 12), r = m % 12;
    const ys = y ? y + (y === 1 ? ' año' : ' años') : '';
    const ms = r ? r + (r === 1 ? ' mes' : ' meses') : '';
    return ys && ms ? ys + ' y ' + ms : (ys || ms || '0 meses');
  },
  plural(n, s, p) { return n + ' ' + (n === 1 ? s : p); },
  download(name, content, mime) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  },
  readFile(file, as) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = () => rej(r.error);
      if (as === 'text') r.readAsText(file); else r.readAsDataURL(file);
    });
  },
  /** Reduce una fotografía para guardarla sin ocupar demasiado. */
  async imgReduce(file, max = 1000, q = 0.8) {
    const url = await U.readFile(file);
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', q));
      };
      img.onerror = () => res(url);
      img.src = url;
    });
  },
  dataUrlToBlob(du) {
    const [h, b] = du.split(',');
    const mime = (h.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
    const bin = atob(b);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  },
  size(bytes) {
    if (!bytes) return '0 KB';
    return bytes > 1048576 ? (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
  },
  csv(rows) {
    return '﻿' + rows.map(r => r.map(v => {
      const s = v === null || v === undefined ? '' : (typeof v === 'number' ? String(v).replace('.', ',') : String(v));
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\r\n');
  }
};
