'use strict';
/* Arranque, navegación y gestión de eventos. */

const NAV = [
  ['resumen', '📊', 'Resumen'], ['inmuebles', '🏠', 'Inmuebles'], ['alquileres', '💶', 'Alquileres'], ['gastos', '🧾', 'Gastos'],
  ['agua', '💧', 'Agua'], ['hipotecas', '🏦', 'Hipotecas'], ['amortizaciones', '📉', 'Amortizaciones'], ['calendario', '📅', 'Calendario'],
  ['rentabilidad', '📈', 'Rentabilidad'], ['informes', '📄', 'Informes'], ['config', '⚙️', 'Configuración']
];
const BOTTOM = [['resumen', '📊', 'Inicio'], ['inmuebles', '🏠', 'Pisos'], ['alquileres', '💶', 'Cobros'], ['gastos', '🧾', 'Gastos'], ['mas', '☰', 'Más']];

const App = {
  st: { f: {}, tabs: {}, calYm: U.ym(U.today()), resMes: U.ym(U.today()), sim: { modo: 'plazo', anualMes: 1 } },
  installEvt: null,
  lastRoute: '',

  periodo() {
    const hoy = U.today(), y = +U.year(hoy), ym = U.ym(hoy);
    const p = V.f('per', 'mes');
    if (p === 'mesAnt') { const m = U.ymAdd(ym, -1); return { from: m + '-01', to: U.ymLast(m), label: U.cap(U.fmonth(m)), short: 'mes ant.' }; }
    if (p === 'anio') return { from: y + '-01-01', to: y + '-12-31', label: 'Año ' + y, short: y };
    if (p === 'anioAnt') return { from: (y - 1) + '-01-01', to: (y - 1) + '-12-31', label: 'Año ' + (y - 1), short: y - 1 };
    if (p === 'pers') {
      const a = V.f('desde', y + '-01-01') || y + '-01-01', b = V.f('hasta', hoy) || hoy;
      return { from: a, to: b, label: U.fdate(a) + ' – ' + U.fdate(b), short: 'periodo' };
    }
    return { from: ym + '-01', to: U.ymLast(ym), label: U.cap(U.fmonth(ym)), short: 'mes' };
  },

  parse() {
    const h = (location.hash || '#/resumen').replace(/^#\/?/, '');
    const [name, ...args] = h.split('/');
    return { name: name || 'resumen', args };
  },

  render() {
    const r = App.parse();
    const view = document.getElementById('view');
    const fn = V[r.name] || V.resumen;
    let html;
    try { html = fn(...r.args); } catch (e) {
      console.error(e);
      html = '<div class="empty"><p>Se produjo un error al mostrar esta pantalla: ' + U.esc(e.message) + '</p><a class="btn" href="#/resumen">Volver al inicio</a></div>';
    }
    view.innerHTML = html;
    UI.afterRender(view);
    const sec = r.name === 'vivienda' ? 'inmuebles' : (r.name === 'buscar' || r.name === 'alertas' ? '' : r.name);
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.dataset.nav === sec || (a.dataset.nav === 'mas' && !BOTTOM.some(b => b[0] === sec) && sec !== 'inmuebles')));
    const n = C.alertas().filter(a => a.p <= 2).length;
    document.querySelectorAll('.badge-al').forEach(b => { b.textContent = n; b.hidden = !n; });
    const key = r.name + '/' + (r.args[0] || '') + '/' + (r.args[1] || '');
    if (key !== App.lastRoute) { window.scrollTo(0, 0); App.lastRoute = key; }
    document.body.classList.remove('side-open', 'more-open');
    const t = (NAV.find(x => x[0] === r.name) || [])[2] || (r.name === 'vivienda' ? C.nomViv(r.args[0]) : '');
    document.title = (t ? t + ' · ' : '') + 'Control de Alquileres';
    const ib = document.getElementById('btn-install');
    if (ib) ib.hidden = !App.installEvt;
  },

  shell() {
    document.getElementById('side-nav').innerHTML = NAV.map(([k, i, l]) => '<a href="#/' + k + '" data-nav="' + k + '"><span class="ni">' + i + '</span>' + l + '</a>').join('') +
      '<a href="#/alertas" data-nav="alertas"><span class="ni">🔔</span>Alertas <span class="badge badge-al" hidden></span></a>';
    document.getElementById('bottomnav').innerHTML = BOTTOM.map(([k, i, l]) => '<a href="#/' + k + '" data-nav="' + k + '"><span class="ni">' + i + '</span><span>' + l + '</span></a>').join('');
  },

  bind() {
    document.addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (act) {
        if (act.tagName === 'BUTTON' && act.type === 'submit') return;
        e.preventDefault();
        const name = act.dataset.act;
        const d = Object.assign({}, act.dataset);
        if (App.acts[name]) App.acts[name](d, act);
        else if (F[name]) F[name](d, act);
        else console.warn('Acción desconocida', name);
        return;
      }
      const go = e.target.closest('[data-go]');
      if (go && !e.target.closest('a,button,input,select,textarea,label')) {
        if (go.dataset.go) { UI.closeAll(); location.hash = go.dataset.go; }
      }
      if (e.target.classList.contains('overlay')) { /* no se cierra al pulsar fuera para no perder datos */ }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.getElementById('modal-root').children.length) { UI.close(); return; }
      if (e.key === 'Enter' && (e.target.matches('[data-go]') || e.target.matches('th[data-act]'))) e.target.click();
    });
    document.addEventListener('change', e => {
      const el = e.target;
      if (el.matches('[data-f]')) { App.st.f[el.dataset.f] = el.value; App.render(); return; }
      if (el.matches('[data-sortsel]')) {
        const [k, dir] = el.value.split(':');
        if (k) UI.sort[el.dataset.sortsel] = { k, dir }; else delete UI.sort[el.dataset.sortsel];
        App.render(); return;
      }
      const form = el.closest('form[data-fid]');
      if (form && el.name) UI.refreshForm(form, el.name);
    });
    document.addEventListener('input', e => {
      const el = e.target;
      const form = el.closest('form[data-fid]');
      if (form && el.name && el.type !== 'file' && el.tagName !== 'SELECT' && el.type !== 'checkbox' && el.type !== 'date' && el.type !== 'month') UI.refreshForm(form, el.name);
    });
    document.addEventListener('submit', e => {
      const f = e.target;
      if (f.matches('form[data-fid]')) { e.preventDefault(); UI.submit(f); }
      else if (f.matches('[data-search]')) {
        e.preventDefault();
        const q = (f.elements.q.value || '').trim();
        if (f.elements.q.blur) f.elements.q.blur();
        location.hash = '#/buscar/' + encodeURIComponent(q);
      }
    });
    window.addEventListener('hashchange', () => { UI.closeAll(); App.render(); });
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); App.installEvt = e; App.render(); });
    window.addEventListener('appinstalled', () => { App.installEvt = null; UI.toast('Aplicación instalada'); App.render(); });
    let lastDay = U.today();
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && U.today() !== lastDay) {
        lastDay = U.today();
        await C.syncMensualidades();
        App.render();
      }
    });
  },

  /* Acciones propias de la navegación */
  acts: {
    setf(d) { App.st.f[d.k] = d.v; App.render(); },
    tab(d) {
      App.st.tabs[d.g] = d.t;
      const r = App.parse();
      if (r.name !== 'vivienda' && r.args.length) location.hash = '#/' + r.name;
      else App.render();
    },
    simRun() {
      const s = App.st.sim;
      document.querySelectorAll('[data-sim]').forEach(el => {
        const k = el.dataset.sim;
        s[k] = ['puntual', 'anual', 'nuevaCuota'].includes(k) ? U.num(el.value) : el.value;
      });
      if (s.puntual > 0 && !s.puntualYm) { UI.toast('Indique el mes de la amortización puntual.', 'err'); return; }
      App.render();
    },
    simReset() { App.st.sim = { modo: 'plazo', anualMes: 1 }; App.render(); },
    async simGuardar(d) {
      const h = DB.get('hipotecas', d.hid);
      const s = App.st.sim;
      const list = [];
      if (s.puntual > 0 && s.puntualYm) list.push({ id: U.uid(), ym: s.puntualYm, importe: s.puntual });
      if (s.anual > 0) {
        const fin = C.infoH(h).fin || U.ymAdd(U.ym(U.today()), 360);
        for (let yy = +s.anualDesde || +U.year(U.today()); yy <= +fin.slice(0, 4) && list.length < 60; yy++) {
          const ym = yy + '-' + U.z(+s.anualMes || 1);
          if (ym >= C.infoH(h).prox) list.push({ id: U.uid(), ym, importe: s.anual });
        }
      }
      if (!list.length) { UI.toast('No hay amortizaciones que guardar.', 'warn'); return; }
      h.previstas = (h.previstas || []).concat(list);
      await DB.put('hipotecas', h);
      UI.toast(list.length + ' amortizaciones previstas guardadas en la hipoteca');
      App.render();
    }
  },

  async init() {
    App.shell();
    try { await DB.init(); } catch (e) {
      document.getElementById('view').innerHTML = '<div class="empty"><p>No se pudo abrir el almacenamiento local: ' + U.esc(e.message) + '</p></div>';
      return;
    }
    await C.syncMensualidades();
    App.bind();
    App.render();
    if (!DB.cfg.inicio && !DB.S.viviendas.length) {
      UI.modal(V.bienvenidaHtml() + '<div class="form-actions"><button class="btn" data-act="empezar">Empezar con la aplicación vacía</button></div>', { title: 'Control de Alquileres' });
    }
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('Service worker no registrado', err));
    }
  }
};

document.addEventListener('DOMContentLoaded', App.init);
