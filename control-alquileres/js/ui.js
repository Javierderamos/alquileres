'use strict';
/* Componentes de interfaz: ventanas modales, formularios, tablas, etiquetas, gráficos y fórmulas. */

const UI = {
  defs: {},
  sort: {},
  _n: 0,

  /* ---------- Avisos ---------- */
  toast(msg, type) {
    const t = document.getElementById('toast');
    const d = document.createElement('div');
    d.className = 'toast-item ' + (type || 'ok');
    d.textContent = msg;
    t.appendChild(d);
    setTimeout(() => d.classList.add('out'), 3200);
    setTimeout(() => d.remove(), 3700);
  },

  /* ---------- Ventanas modales ---------- */
  modal(inner, opts = {}) {
    const root = document.getElementById('modal-root');
    const wrap = document.createElement('div');
    wrap.className = 'overlay';
    wrap.innerHTML = '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="modal-h"><h2>' + U.esc(opts.title || '') + '</h2><button class="icon-btn" data-act="closeModal" aria-label="Cerrar">✕</button></div>' +
      '<div class="modal-b">' + inner + '</div></div>';
    root.appendChild(wrap);
    document.body.classList.add('modal-open');
    const f = wrap.querySelector('input:not([type=hidden]):not([type=checkbox]),select,textarea');
    if (f && window.matchMedia('(pointer:fine)').matches) setTimeout(() => f.focus(), 30);
    return wrap;
  },
  close() {
    const root = document.getElementById('modal-root');
    const last = root.lastElementChild;
    if (last) last.remove();
    if (!root.children.length) document.body.classList.remove('modal-open');
  },
  closeAll() { document.getElementById('modal-root').innerHTML = ''; document.body.classList.remove('modal-open'); },
  confirm(msg, { ok = 'Eliminar', danger = true, title = 'Confirmar' } = {}) {
    return new Promise(res => {
      const w = UI.modal('<p class="confirm-msg">' + msg + '</p><div class="form-actions"><button class="btn" data-c="0">Cancelar</button><button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-c="1">' + U.esc(ok) + '</button></div>', { title });
      w.addEventListener('click', e => {
        const b = e.target.closest('[data-c]');
        if (b) { e.stopPropagation(); UI.close(); res(b.dataset.c === '1'); }
        else if (e.target.closest('[data-act=closeModal]')) res(false);
      });
    });
  },

  /* ---------- Formularios ----------
     Campo: {k, l, t, o, req, help, full, ph, show(vals), attrs}
     t: text | money | number | date | month | select | textarea | checkbox | tel | email | file | section | calc | html */
  fieldHtml(f, v) {
    const id = 'f_' + f.k + '_' + (++UI._n);
    const req = f.req ? ' required' : '';
    const ph = f.ph ? ' placeholder="' + U.esc(f.ph) + '"' : '';
    const cls = 'fld' + (f.full ? ' full' : '') + (f.t === 'checkbox' ? ' chk-fld' : '');
    const lab = '<label for="' + id + '">' + U.esc(f.l) + (f.req ? ' <span class="req">*</span>' : '') + '</label>';
    const help = f.help ? '<small class="help">' + f.help + '</small>' : '';
    const attrs = f.attrs || '';
    if (f.t === 'section') return '<div class="f-sec full">' + U.esc(f.l) + (f.help ? '<small>' + f.help + '</small>' : '') + '</div>';
    if (f.t === 'calc') return '<div class="fld full"><div class="calc" data-calc="' + f.k + '"></div></div>';
    if (f.t === 'html') return '<div class="fld full">' + (f.html || '') + '</div>';
    let input;
    switch (f.t) {
      case 'select': {
        const opts = (typeof f.o === 'function' ? f.o() : f.o) || [];
        input = '<select id="' + id + '" name="' + f.k + '"' + req + ' ' + attrs + '>' + opts.map(o => {
          const [val, lb] = Array.isArray(o) ? o : [o, o];
          return '<option value="' + U.esc(val) + '"' + (String(val) === String(v ?? '') ? ' selected' : '') + '>' + U.esc(lb) + '</option>';
        }).join('') + '</select>';
        break;
      }
      case 'textarea':
        input = '<textarea id="' + id + '" name="' + f.k + '" rows="' + (f.rows || 3) + '"' + req + ph + ' ' + attrs + '>' + U.esc(v ?? '') + '</textarea>';
        break;
      case 'checkbox':
        return '<div class="' + cls + '"><label class="chk"><input type="checkbox" id="' + id + '" name="' + f.k + '"' + (v ? ' checked' : '') + ' ' + attrs + '> <span>' + U.esc(f.l) + '</span></label>' + help + '</div>';
      case 'money': case 'number':
        input = '<div class="inp-suf"><input type="text" inputmode="decimal" autocomplete="off" id="' + id + '" name="' + f.k + '" value="' + U.esc(U.inNum(v)) + '"' + req + ph + ' ' + attrs + '>' + (f.t === 'money' ? '<span>€</span>' : f.suf ? '<span>' + f.suf + '</span>' : '') + '</div>';
        break;
      case 'file':
        input = '<input type="file" id="' + id + '" name="' + f.k + '" ' + (f.accept ? 'accept="' + f.accept + '"' : '') + ' ' + attrs + '>';
        break;
      case 'month':
        input = '<input type="month" id="' + id + '" name="' + f.k + '" value="' + U.esc(v ?? '') + '" placeholder="AAAA-MM" pattern="\\d{4}-\\d{2}"' + req + ' ' + attrs + '>';
        break;
      default:
        input = '<input type="' + (f.t || 'text') + '" id="' + id + '" name="' + f.k + '" value="' + U.esc(v ?? '') + '"' + req + ph + ' ' + attrs + '>';
    }
    return '<div class="' + cls + '" data-fk="' + f.k + '">' + lab + input + help + '</div>';
  },
  formHtml(def) {
    const fid = def.id || ('frm' + (++UI._n));
    def.id = fid;
    UI.defs[fid] = def;
    const vals = def.values || {};
    return '<form class="frm" data-fid="' + fid + '" novalidate>' +
      (def.intro ? '<div class="frm-intro">' + def.intro + '</div>' : '') +
      '<div class="grid-f">' + def.fields.map(f => UI.fieldHtml(f, vals[f.k])).join('') + '</div>' +
      '<div class="form-actions">' +
      (def.onDelete ? '<button type="button" class="btn btn-danger-o" data-act="formDelete" data-fid="' + fid + '">Eliminar</button><span class="sp"></span>' : '') +
      (def.inline ? '' : '<button type="button" class="btn" data-act="closeModal">Cancelar</button>') +
      '<button type="submit" class="btn btn-primary">' + U.esc(def.submit || 'Guardar') + '</button></div></form>';
  },
  /** Abre un formulario en ventana modal */
  form(def) {
    const w = UI.modal(UI.formHtml(def), { title: def.title, wide: def.wide });
    UI.afterRender(w);
    return w;
  },
  /** Ejecuta onChange inicial y visibilidad condicional de los formularios presentes en el elemento */
  afterRender(root) {
    (root || document).querySelectorAll('form[data-fid]').forEach(f => UI.refreshForm(f, null));
  },
  read(form) {
    const def = UI.defs[form.dataset.fid];
    const out = {};
    def.fields.forEach(f => {
      if (['section', 'calc', 'html'].includes(f.t)) return;
      const el = form.elements[f.k];
      if (!el) return;
      if (f.t === 'checkbox') out[f.k] = el.checked;
      else if (f.t === 'money' || f.t === 'number') out[f.k] = U.num(el.value);
      else if (f.t === 'file') out[f.k] = el.files && el.files[0] ? el.files[0] : null;
      else out[f.k] = (el.value || '').trim();
    });
    return out;
  },
  set(form, k, v) {
    const el = form.elements[k];
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!v;
    else el.value = (typeof v === 'number') ? U.inNum(U.r2(v)) : (v ?? '');
  },
  setCalc(form, k, html) { const el = form.querySelector('[data-calc="' + k + '"]'); if (el) el.innerHTML = html; },
  setOptions(form, k, opts, sel) {
    const el = form.elements[k];
    if (!el) return;
    el.innerHTML = opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + U.esc(v) + '"' + (String(v) === String(sel ?? '') ? ' selected' : '') + '>' + U.esc(l) + '</option>'; }).join('');
  },
  refreshForm(form, changed) {
    const def = UI.defs[form.dataset.fid];
    if (!def) return;
    if (def.onChange) def.onChange(UI.read(form), form, changed);
    const vals = UI.read(form);
    def.fields.forEach(f => {
      if (!f.show) return;
      const box = form.querySelector('[data-fk="' + f.k + '"]');
      if (box) box.style.display = f.show(vals) ? '' : 'none';
    });
  },
  async submit(form) {
    const def = UI.defs[form.dataset.fid];
    if (!def) return;
    const vals = UI.read(form);
    let bad = null;
    form.querySelectorAll('.fld.err').forEach(x => x.classList.remove('err'));
    def.fields.forEach(f => {
      if (!f.req) return;
      if (f.show && !f.show(vals)) return;
      const v = vals[f.k];
      if (v === null || v === undefined || v === '') {
        const box = form.querySelector('[data-fk="' + f.k + '"]');
        if (box) box.classList.add('err');
        bad = bad || f.l;
      }
    });
    if (bad) { UI.toast('Complete el campo obligatorio: ' + bad, 'err'); return; }
    const btn = form.querySelector('button[type=submit]');
    if (btn) btn.disabled = true;
    try {
      const r = await def.onSubmit(vals, form);
      if (r === false) { if (btn) btn.disabled = false; return; }
      if (!def.inline) UI.close();
      if (!def.silent) UI.toast(def.okMsg || 'Guardado');
      App.render();
    } catch (e) {
      console.error(e);
      UI.toast('Error al guardar: ' + (e.message || e), 'err');
      if (btn) btn.disabled = false;
    }
  },

  /* ---------- Etiquetas de estado ---------- */
  tag(txt, cls) { return '<span class="tag ' + (cls || '') + '">' + U.esc(txt) + '</span>'; },
  TAGCLS: {
    'Pagado': 'ok', 'Pago parcial': 'warn', 'Pendiente': 'neutral', 'Impagado': 'danger', 'Exonerado': 'muted',
    'Vigente': 'ok', 'Próximo a vencer': 'warn', 'Vencido': 'vencido', 'Renovado': 'info', 'Finalizado': 'muted',
    'No repercutido': 'muted', 'Resuelto': 'ok', 'En curso': 'info',
    alquilada: 'ok', vacia: 'danger', reservada: 'info', reforma: 'warn',
    'Urgente': 'danger', 'Alta': 'warn', 'Media': 'neutral', 'Baja': 'muted'
  },
  st(txt) {
    if (txt === 'Vencido') return '<span class="tag vencido">VENCIDO</span>';
    return UI.tag(C.ESTADO_TXT[txt] || txt, UI.TAGCLS[txt] || 'neutral');
  },
  /** Bloque destacado de contrato vencido: fondo amarillo + texto */
  vencidoBanner(c) {
    return '<div class="vencido-banner" role="alert"><span class="tag vencido">VENCIDO</span> <strong>CONTRATO VENCIDO — ' + U.fdate(c.fechaVencimiento) + '</strong>' +
      '<span class="vb-sub">Se mantendrá resaltado hasta registrar un nuevo contrato, una renovación o prórroga, o modificar la fecha de vencimiento.</span></div>';
  },

  /* ---------- Tarjetas KPI ---------- */
  kpi(label, value, sub, cls, go) {
    return '<div class="kpi ' + (cls || '') + '"' + (go ? ' data-go="' + go + '" tabindex="0" role="link"' : '') + '><div class="kpi-l">' + label + '</div><div class="kpi-v">' + value + '</div>' + (sub ? '<div class="kpi-s">' + sub + '</div>' : '') + '</div>';
  },
  dl(items) {
    return '<dl class="dl">' + items.filter(Boolean).map(([k, v, cls]) => '<div class="' + (cls || '') + '"><dt>' + k + '</dt><dd>' + (v === null || v === undefined || v === '' ? '—' : v) + '</dd></div>').join('') + '</dl>';
  },
  empty(msg, action) { return '<div class="empty"><p>' + msg + '</p>' + (action || '') + '</div>'; },
  card(title, body, actions, cls) {
    return '<section class="card ' + (cls || '') + '">' + (title || actions ? '<div class="card-h"><h3>' + (title || '') + '</h3><div class="card-a">' + (actions || '') + '</div></div>' : '') + '<div class="card-b">' + body + '</div></section>';
  },
  btn(label, act, data = {}, cls = '') {
    return '<button type="button" class="btn ' + cls + '" data-act="' + act + '"' + Object.entries(data).map(([k, v]) => ' data-' + k + '="' + U.esc(v) + '"').join('') + '>' + label + '</button>';
  },
  ibtn(icon, title, act, data = {}, cls = '') {
    return '<button type="button" class="icon-btn ' + cls + '" title="' + U.esc(title) + '" aria-label="' + U.esc(title) + '" data-act="' + act + '"' + Object.entries(data).map(([k, v]) => ' data-' + k + '="' + U.esc(v) + '"').join('') + '>' + icon + '</button>';
  },

  /* ---------- Tablas (se convierten en tarjetas en el móvil) ---------- */
  table(id, cols, rows, opts = {}) {
    if (!rows.length) return UI.empty(opts.empty || 'Sin registros.', opts.emptyAction);
    const s = UI.sort[id];
    let list = rows.slice();
    if (s) {
      const col = cols.find(c => c.k === s.k);
      if (col) {
        const val = col.v || (r => r[col.k]);
        list.sort((a, b) => {
          const x = val(a), y = val(b);
          if (x === y) return 0;
          if (x === null || x === undefined || x === '') return 1;
          if (y === null || y === undefined || y === '') return -1;
          const r = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'es', { numeric: true });
          return s.dir === 'asc' ? r : -r;
        });
      }
    }
    const sortable = cols.filter(c => c.l && c.sort !== false);
    const sel = '<div class="m-sort"><label>Ordenar por <select data-sortsel="' + id + '">' +
      '<option value="">—</option>' + sortable.map(c => ['asc', 'desc'].map(d => '<option value="' + c.k + ':' + d + '"' + (s && s.k === c.k && s.dir === d ? ' selected' : '') + '>' + U.esc(c.l) + (d === 'asc' ? ' ↑' : ' ↓') + '</option>').join('')).join('') + '</select></label></div>';
    return (opts.noMobileSort ? '' : sel) + '<div class="tbl-wrap"><table class="tbl" data-tid="' + id + '"><thead><tr>' + cols.map(c => {
      const ar = s && s.k === c.k ? (s.dir === 'asc' ? ' ▲' : ' ▼') : '';
      return '<th class="' + (c.cls || '') + '"' + (c.l && c.sort !== false ? ' data-act="sort" data-tid="' + id + '" data-k="' + c.k + '" tabindex="0"' : '') + '>' + U.esc(c.l || '') + ar + '</th>';
    }).join('') + '</tr></thead><tbody>' + list.map(r => {
      const rc = opts.rowCls ? opts.rowCls(r) : '';
      const go = opts.go ? opts.go(r) : '';
      return '<tr class="' + rc + (go ? ' clickable' : '') + '"' + (go ? ' data-go="' + go + '"' : '') + '>' + cols.map(c => '<td class="' + (c.cls || '') + '" data-label="' + U.esc(c.l || '') + '">' + (c.f ? c.f(r) : U.esc(r[c.k])) + '</td>').join('') + '</tr>';
    }).join('') + '</tbody>' + (opts.foot ? '<tfoot>' + opts.foot + '</tfoot>' : '') + '</table></div>';
  },

  /* ---------- Gráficos ---------- */
  bars(items, fmt = U.eur) {
    if (!items.length) return UI.empty('Sin datos para el gráfico.');
    const max = Math.max(...items.map(i => Math.abs(i.v || 0)), 0.0001);
    return '<div class="bars">' + items.map(i => {
      const w = Math.abs(i.v || 0) / max * 100;
      return '<div class="bar-row"><span class="bl" title="' + U.esc(i.l) + '">' + U.esc(i.l) + '</span><div class="bt"><div class="bf ' + ((i.v || 0) < 0 ? 'neg' : (i.cls || '')) + '" style="width:' + w.toFixed(1) + '%"></div></div><span class="bv">' + (i.v === null ? '—' : fmt(i.v)) + '</span></div>';
    }).join('') + '</div>';
  },
  /** Gráfico de líneas. series: [{name, cls, pts:[{x:'YYYY-MM', y}]}] */
  line(series, fmt = U.eur) {
    const all = series.flatMap(s => s.pts);
    if (all.length < 2) return UI.empty('Se necesitan al menos dos puntos para el gráfico.');
    const xs = Array.from(new Set(all.map(p => p.x))).sort();
    const W = 640, H = 220, L = 70, R = 12, T = 12, B = 30;
    let ymin = Math.min(...all.map(p => p.y)), ymax = Math.max(...all.map(p => p.y));
    if (ymin === ymax) { ymin -= 1; ymax += 1; }
    const pad = (ymax - ymin) * 0.08; ymin -= pad; ymax += pad;
    if (ymin < 0 && Math.min(...all.map(p => p.y)) >= 0) ymin = 0;
    const X = x => L + (xs.length === 1 ? 0 : xs.indexOf(x) / (xs.length - 1) * (W - L - R));
    const Y = y => T + (1 - (y - ymin) / (ymax - ymin)) * (H - T - B);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(k => ymin + (ymax - ymin) * k);
    const step = Math.max(1, Math.ceil(xs.length / 8));
    let svg = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" preserveAspectRatio="xMidYMid meet">';
    ticks.forEach(t => { svg += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" class="grid"/><text x="' + (L - 6) + '" y="' + (Y(t) + 4) + '" text-anchor="end" class="ax">' + U.esc(fmt(t).replace(',00', '')) + '</text>'; });
    xs.forEach((x, i) => { if (i % step === 0 || i === xs.length - 1) svg += '<text x="' + X(x) + '" y="' + (H - 8) + '" text-anchor="middle" class="ax">' + U.esc(x.length === 7 ? U.fmonthC(x) : x) + '</text>'; });
    series.forEach((s, si) => {
      const pts = s.pts.slice().sort((a, b) => a.x.localeCompare(b.x));
      svg += '<polyline fill="none" class="ln s' + si + '" points="' + pts.map(p => X(p.x).toFixed(1) + ',' + Y(p.y).toFixed(1)).join(' ') + '"/>';
      if (pts.length <= 40) pts.forEach(p => { svg += '<circle cx="' + X(p.x).toFixed(1) + '" cy="' + Y(p.y).toFixed(1) + '" r="3" class="pt s' + si + '"><title>' + U.esc(s.name + ' · ' + (p.x.length === 7 ? U.fmonth(p.x) : p.x) + ': ' + fmt(p.y)) + '</title></circle>'; });
    });
    svg += '</svg>';
    const leg = series.length > 1 ? '<div class="legend">' + series.map((s, i) => '<span><i class="sw s' + i + '"></i>' + U.esc(s.name) + '</span>').join('') + '</div>' : '';
    return '<div class="chart-box">' + svg + leg + '</div>';
  },

  /* ---------- Fórmulas visibles ---------- */
  formula(title, expr, vals, result, missing) {
    const body = missing && missing.length
      ? '<div class="f-insuf">' + INSUF + '<small>Falta: ' + missing.map(U.esc).join(', ') + '.</small></div>'
      : '<div class="f-vals">' + vals.map(([k, v]) => '<div><span>' + k + '</span><b>' + v + '</b></div>').join('') + '</div><div class="f-res">= ' + result + '</div>';
    return '<div class="formula"><div class="f-t">' + title + '</div><code>' + expr + '</code>' + body + '</div>';
  }
};
