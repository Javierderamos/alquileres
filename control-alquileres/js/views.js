'use strict';
/* Pantallas generales de la aplicación. */

const V = {
  TIPO_MOV: { ingreso: 'Ingreso', gasto: 'Gasto', hipoteca: 'Cuota hipoteca', amortExtra: 'Amortización extraordinaria', evento: 'Registro' },

  /* ---------- Ayudantes de pantalla ---------- */
  f(k, def) { const v = App.st.f[k]; return v === undefined ? def : v; },
  sel(k, opts, label, def) {
    const v = V.f(k, def);
    return '<label class="flt"><span>' + label + '</span><select data-f="' + k + '">' + opts.map(o => {
      const [val, l] = Array.isArray(o) ? o : [o, o];
      return '<option value="' + U.esc(val) + '"' + (String(val) === String(v ?? '') ? ' selected' : '') + '>' + U.esc(l) + '</option>';
    }).join('') + '</select></label>';
  },
  inp(k, type, label, def) { return '<label class="flt"><span>' + label + '</span><input type="' + type + '" data-f="' + k + '" value="' + U.esc(V.f(k, def) || '') + '"></label>'; },
  vivSel(k = 'viv', label = 'Vivienda') { return V.sel(k, [['', 'Todas'], ...C.vivs().map(v => [v.id, v.nombre])], label, ''); },
  anios() {
    const ys = new Set([U.year(U.today())]);
    ['mensualidades', 'gastos', 'cuotas', 'suministros', 'ingresos', 'amortizaciones', 'incidencias'].forEach(s => DB.S[s].forEach(x => {
      const f = x.fecha || x.fechaPago || x.fechaPrevista || (x.mes ? x.mes + '-01' : '');
      if (f) ys.add(U.year(f));
    }));
    DB.S.viviendas.forEach(v => { if (v.compra && v.compra.fecha) ys.add(U.year(v.compra.fecha)); });
    return Array.from(ys).filter(Boolean).sort().reverse();
  },
  anioSel(k = 'anio', label = 'Año', def = '') { return V.sel(k, [['', 'Todos'], ...V.anios().map(y => [y, y])], label, def); },
  mesSel(k = 'mes') { return V.sel(k, [['', 'Todos'], ...MESES.map((m, i) => [U.z(i + 1), U.cap(m)])], 'Mes', ''); },
  tabs(g, list, def) {
    const cur = App.st.tabs[g] || def || list[0][0];
    return ['<div class="tabs" role="tablist">' + list.map(([k, l]) => '<button type="button" role="tab" class="tab' + (k === cur ? ' on' : '') + '" data-act="tab" data-g="' + g + '" data-t="' + k + '">' + l + '</button>').join('') + '</div>', cur];
  },
  page(title, actions, body, sub) {
    return '<div class="page-h"><div><h1>' + title + '</h1>' + (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div><div class="page-a">' + (actions || '') + '</div></div>' + body;
  },
  filters(html) { return '<div class="filters">' + html + '</div>'; },
  money(n, cls) { return '<span class="' + (cls || '') + (n < -0.004 ? ' neg' : '') + '">' + U.eur(n) + '</span>'; },
  signed(n) { return '<b class="' + (n < -0.004 ? 'neg' : n > 0.004 ? 'pos' : '') + '">' + U.eur(n) + '</b>'; },
  vlink(vid) { return '<a href="#/vivienda/' + vid + '/resumen" class="lnk">' + U.esc(C.nomViv(vid)) + '</a>'; },
  quickButtons(vid) {
    const d = vid ? ' data-vid="' + vid + '"' : '';
    return [
      ['cobrar', '💶', 'COBRAR ALQUILER'], ['gasto', '🧾', 'AÑADIR GASTO'], ['suministro', '💧', 'REGISTRAR AGUA'],
      ['cuota', '🏦', 'REGISTRAR CUOTA HIPOTECA'], ['amortizacion', '📉', 'AMORTIZACIÓN EXTRAORDINARIA'], ['incidencia', '🔧', 'NUEVA INCIDENCIA']
    ].map(([a, i, l]) => '<button type="button" class="qbtn" data-act="q" data-a="' + a + '"' + d + (a === 'suministro' ? ' data-tipo="agua"' : '') + '><span class="qi">' + i + '</span><span>' + l + '</span></button>').join('');
  },
  alertList(A, max) {
    if (!A.length) return '<div class="ok-box">✔ No hay asuntos pendientes de su atención.</div>';
    const list = max ? A.slice(0, max) : A;
    return '<ul class="alerts">' + list.map(a => '<li class="al al-' + a.cls + '" data-go="' + a.go + '"><div class="al-m">' + (a.cls === 'vencido' ? '<span class="tag vencido">VENCIDO</span> ' : '') + '<b>' + U.esc(a.t) + '</b><small>' + U.esc(a.d || '') + '</small></div>' +
      (a.act ? '<button type="button" class="btn btn-sm" data-act="q" data-a="' + (a.act.a === 'exportar' ? 'exportar' : a.act.a) + '"' + (a.act.vid ? ' data-vid="' + a.act.vid + '"' : '') + (a.act.hid ? ' data-hid="' + a.act.hid + '"' : '') + '>' + ({ cobrar: 'Cobrar', cuota: 'Registrar', exportar: 'Exportar' }[a.act.a] || 'Abrir') + '</button>' : '<span class="al-go">›</span>') + '</li>').join('') + '</ul>' +
      (max && A.length > max ? '<a class="more-lnk" href="#/alertas">Ver las ' + A.length + ' alertas ›</a>' : '');
  },

  /* ======================= RESUMEN — MI CARTERA ======================= */
  resumen() {
    const vs = C.vivs();
    if (!vs.length) return V.page('Mi cartera', '', V.bienvenidaHtml());
    const P = App.periodo();
    const hoy = U.today();
    const est = vs.map(v => C.estadoViv(v));
    const nAlq = est.filter(e => e === 'alquilada').length;
    const nVac = est.filter(e => e === 'vacia').length;
    const R = C.resumen(null, P.from, P.to);
    const prev = C.previsto(null, P.from, P.to);
    const RY = C.resumen(null, U.year(hoy) + '-01-01', hoy);
    const costes = vs.map(C.costeTotal);
    const costeTot = U.sum(costes.filter(x => x !== null));
    const faltaCoste = costes.filter(x => x === null).length;
    const valores = vs.map(C.valor);
    const valorTot = U.sum(valores.filter(x => x !== null));
    const faltaValor = valores.filter(x => x === null).length;
    const deuda = C.deudaTotal();
    const deudaConValor = U.sum(vs.filter(v => C.valor(v) !== null), v => C.deudaTotal(v.id));
    const w = C.ventana12();
    const conCoste = vs.filter(v => C.costeTotal(v) !== null);
    const benef12 = U.sum(conCoste, v => C.resumen(v.id, w.from, w.to).beneficio);
    const rentMedia = conCoste.length ? benef12 / U.sum(conCoste, C.costeTotal) * 100 : null;
    const pendP = C.pendientePeriodo(null, P.from, P.to);
    const pendT = C.pendienteAlquiler();
    const aguaP = C.aguaPendiente();
    const A = C.alertas();
    const nota = n => n ? '<span class="warn-t">' + n + ' sin datos</span>' : '';

    const per = '<div class="per">' + [['mes', 'Mes actual'], ['mesAnt', 'Mes anterior'], ['anio', 'Año actual'], ['anioAnt', 'Año anterior'], ['pers', 'Personalizado']].map(([k, l]) =>
      '<button type="button" class="chip' + (V.f('per', 'mes') === k ? ' on' : '') + '" data-act="setf" data-k="per" data-v="' + k + '">' + l + '</button>').join('') +
      (V.f('per', 'mes') === 'pers' ? '<span class="per-c">' + V.inp('desde', 'date', 'Desde', U.year(hoy) + '-01-01') + V.inp('hasta', 'date', 'Hasta', hoy) + '</span>' : '') + '</div>';

    const kpis = '<div class="kpis">' + [
      UI.kpi('Viviendas', vs.length, nAlq + ' alquiladas · ' + nVac + ' vacías', '', '#/inmuebles'),
      UI.kpi('Alquiladas', nAlq, '', 'k-ok', '#/inmuebles'),
      UI.kpi('Vacías', nVac, est.filter(e => e === 'reservada' || e === 'reforma').length ? est.filter(e => e === 'reservada' || e === 'reforma').length + ' reservadas / en reforma' : '', nVac ? 'k-danger' : '', '#/inmuebles'),
      UI.kpi('Ocupación', U.pct(nAlq / vs.length * 100), 'Alquiladas / total'),
      UI.kpi('Ingresos previstos', U.eur(prev.total), 'Rentas ' + U.eur(prev.alquiler) + (prev.repercusiones ? ' + repercusiones ' + U.eur(prev.repercusiones) : ''), '', '#/alquileres'),
      UI.kpi('Ingresos cobrados', U.eur(R.ingresos), 'Alquiler ' + U.eur(R.ingAlquiler) + (R.ingAgua + R.ingSumin + R.ingOtros ? ' · otros ' + U.eur(R.ingAgua + R.ingSumin + R.ingOtros) : ''), 'k-ok', '#/informes'),
      UI.kpi('Alquileres pendientes', U.eur(pendP), 'Deuda total acumulada: ' + U.eur(pendT), pendT > 0 ? 'k-danger' : '', '#/alquileres'),
      UI.kpi('Agua pendiente', U.eur(aguaP), 'Pendiente de cobro al inquilino', aguaP > 0 ? 'k-warn' : '', '#/agua'),
      UI.kpi('Gastos', U.eur(R.gastos), 'Cuotas hipoteca: ' + U.eur(R.cuotas), '', '#/gastos'),
      UI.kpi('Flujo de caja', V.signed(R.flujo), 'Cobrado − gastos − cuotas', R.flujo < 0 ? 'k-danger' : 'k-ok'),
      UI.kpi('Beneficio del año ' + U.year(hoy), V.signed(RY.beneficio), 'Ingresos − gastos − intereses (a ' + U.fdate(hoy) + ')'),
      UI.kpi('Coste de adquisición', U.eur(costeTot), nota(faltaCoste)),
      UI.kpi('Valor actual estimado', faltaValor === vs.length ? '—' : U.eur(valorTot), nota(faltaValor)),
      UI.kpi('Deuda hipotecaria', U.eur(deuda), DB.S.hipotecas.length + ' préstamos', '', '#/hipotecas'),
      UI.kpi('Patrimonio neto', faltaValor === vs.length ? '—' : U.eur(valorTot - deudaConValor), 'Valor actual − deuda' + (faltaValor ? ' · ' + nota(faltaValor) : '')),
      UI.kpi('Rentabilidad media neta', rentMedia === null ? '—' : U.pct(rentMedia), 'Últimos 12 meses · ponderada por coste', '', '#/rentabilidad')
    ].join('') + '</div>';

    const ranking = vs.map(v => ({ v, r: C.costeTotal(v) ? C.resumen(v.id, w.from, w.to).beneficio / C.costeTotal(v) * 100 : null })).filter(x => x.r !== null).sort((a, b) => b.r - a.r);
    const best = ranking.length ? '<div class="duo"><div class="duo-i pos-b"><small>Más rentable (neta 12 m)</small><b>' + V.vlink(ranking[0].v.id) + '</b><span>' + U.pct(ranking[0].r) + '</span></div>' +
      (ranking.length > 1 ? '<div class="duo-i neg-b"><small>Menos rentable (neta 12 m)</small><b>' + V.vlink(ranking[ranking.length - 1].v.id) + '</b><span>' + U.pct(ranking[ranking.length - 1].r) + '</span></div>' : '') + '</div>' : '';

    return V.page('Mi cartera', UI.btn('＋ Vivienda', 'vivienda', {}, 'btn-primary'),
      per +
      '<div class="cols-2 top-grid">' +
      UI.card('PENDIENTE DE TU ATENCIÓN', V.alertList(A, 8), '<a href="#/alertas" class="lnk">Todas (' + A.length + ')</a>', 'card-alerts') +
      UI.card('Acciones rápidas', '<div class="quick-grid">' + V.quickButtons() + '</div>') +
      '</div>' +
      '<h2 class="sec-t">Indicadores · ' + U.esc(P.label) + '</h2>' + kpis + best +
      V.resultadoMes() +
      UI.card('Panel global', V.panelTable(), UI.btn('CSV', 'csvPanel', {}, 'btn-sm')),
      'Situación a ' + U.fdate(hoy));
  },
  /** Resultado real mensual de cada piso (dinero efectivo que deja cada vivienda) */
  resultadoMes() {
    const ym = App.st.resMes;
    const from = ym + '-01', to = U.ymLast(ym);
    const cards = C.vivs().map(v => {
      const R = C.resumen(v.id, from, to);
      return '<div class="rm"><div class="rm-h">' + V.vlink(v.id) + '</div>' + UI.dl([
        ['Ingresos cobrados', U.eur(R.ingresos)], ['Gastos', U.eur(R.gastos)], ['Cuota hipotecaria', U.eur(R.cuotas)],
        ['Flujo de caja', V.signed(R.flujo), 'tot']
      ]) + '</div>';
    }).join('');
    return UI.card('Resultado real del mes · ' + U.fmonth(ym), '<div class="rm-grid">' + cards + '</div><p class="muted small">Flujo de caja = ingresos cobrados − gastos pagados − cuotas hipotecarias pagadas.</p>',
      UI.ibtn('‹', 'Mes anterior', 'resMove', { n: -1 }) + UI.ibtn('›', 'Mes siguiente', 'resMove', { n: 1 }));
  },
  panelRows() {
    const P = App.periodo();
    const ym = U.ym(U.today());
    return C.vivs().map(v => {
      const c = C.contratoActivo(v.id);
      const R = C.resumen(v.id, P.from, P.to);
      const Rm = C.resumen(v.id, ym + '-01', U.ymLast(ym));
      const w = C.ventana12();
      const coste = C.costeTotal(v);
      const valor = C.valor(v);
      const deuda = C.deudaTotal(v.id);
      return {
        v, c, estado: C.estadoViv(v), inq: c ? C.nomInq(c.inquilinoId) : '—', dias: c ? C.diasRest(c) : null, alquiler: c ? +c.rentaActual : null,
        cobrado: Rm.ingAlquiler, pendiente: C.pendienteAlquiler(v.id), gastos: R.gastos, flujo: R.flujo,
        neta: coste ? C.resumen(v.id, w.from, w.to).beneficio / coste * 100 : null, deuda, valor, patrimonio: valor !== null ? U.r2(valor - deuda) : null
      };
    });
  },
  panelTable(id = 'panel') {
    const rows = V.panelRows();
    const P = App.periodo();
    return UI.table(id, [
      { k: 'nombre', l: 'Vivienda', v: r => r.v.nombre, f: r => '<b>' + U.esc(r.v.nombre) + '</b>' },
      { k: 'estado', l: 'Estado', v: r => r.estado, f: r => UI.st(r.estado) },
      { k: 'inq', l: 'Inquilino', v: r => r.inq, f: r => U.esc(r.inq) },
      { k: 'fc', l: 'Fecha contrato', v: r => r.c ? r.c.fechaInicio : '', f: r => r.c ? U.fdate(r.c.fechaInicio) : '—' },
      { k: 'venc', l: 'Vencimiento', v: r => r.c ? r.c.fechaVencimiento : '', f: r => r.c ? (C.vencido(r.c) ? '<span class="tag vencido">VENCIDO</span> ' + U.fdate(r.c.fechaVencimiento) : U.fdate(r.c.fechaVencimiento) + ' ' + (C.estadoContrato(r.c) === 'Próximo a vencer' ? UI.st('Próximo a vencer') : '')) : '—', cls: '' },
      { k: 'dias', l: 'Días restantes', v: r => r.dias, f: r => r.dias === null ? '—' : (r.dias < 0 ? '<b class="neg">' + r.dias + '</b>' : r.dias), cls: 'num' },
      { k: 'alq', l: 'Alquiler', v: r => r.alquiler, f: r => U.eur(r.alquiler), cls: 'num' },
      { k: 'cob', l: 'Cobrado este mes', v: r => r.cobrado, f: r => U.eur(r.cobrado), cls: 'num' },
      { k: 'pend', l: 'Pendiente', v: r => r.pendiente, f: r => r.pendiente > 0 ? '<b class="neg">' + U.eur(r.pendiente) + '</b>' : U.eur(0), cls: 'num' },
      { k: 'gas', l: 'Gastos (' + P.short + ')', v: r => r.gastos, f: r => U.eur(r.gastos), cls: 'num' },
      { k: 'flujo', l: 'Flujo de caja (' + P.short + ')', v: r => r.flujo, f: r => V.signed(r.flujo), cls: 'num' },
      { k: 'rent', l: 'Rentab. neta 12 m', v: r => r.neta, f: r => U.pct(r.neta), cls: 'num' },
      { k: 'deuda', l: 'Hipoteca pendiente', v: r => r.deuda, f: r => U.eur(r.deuda), cls: 'num' },
      { k: 'valor', l: 'Valor actual', v: r => r.valor, f: r => U.eur(r.valor), cls: 'num' },
      { k: 'pat', l: 'Patrimonio neto', v: r => r.patrimonio, f: r => U.eur(r.patrimonio), cls: 'num' }
    ], rows, { rowCls: r => r.c && C.vencido(r.c) ? 'row-vencido' : '', go: r => '#/vivienda/' + r.v.id + '/resumen' });
  },

  /* ======================= INMUEBLES ======================= */
  inmuebles() {
    const vs = C.vivs();
    const body = vs.length ? '<div class="viv-grid">' + vs.map(v => {
      const c = C.contratoActivo(v.id);
      const e = C.estadoViv(v);
      const pend = C.pendienteAlquiler(v.id);
      return '<article class="viv-card" data-go="#/vivienda/' + v.id + '/resumen" tabindex="0">' +
        (v.foto ? '<div class="viv-img" style="background-image:url(' + v.foto + ')"></div>' : '<div class="viv-img ph">🏠</div>') +
        '<div class="viv-b"><div class="viv-t"><h3>' + U.esc(v.nombre) + '</h3>' + UI.st(e) + '</div>' +
        '<p class="muted">' + U.esc([v.direccion, v.municipio].filter(Boolean).join(', ') || 'Sin dirección') + '</p>' +
        (c && C.vencido(c) ? UI.vencidoBanner(c) : '') +
        UI.dl([
          ['Inquilino', c ? U.esc(C.nomInq(c.inquilinoId)) : '—'],
          ['Renta', c ? U.eur(c.rentaActual) : '—'],
          ['Vencimiento', c ? U.fdate(c.fechaVencimiento) + ' ' + UI.st(C.estadoContrato(c)) : '—'],
          ['Pendiente', pend > 0 ? '<b class="neg">' + U.eur(pend) + '</b>' : U.eur(0)]
        ]) + '</div></article>';
    }).join('') + '</div>' : V.bienvenidaHtml();
    return V.page('Inmuebles', UI.btn('＋ Nueva vivienda', 'vivienda', {}, 'btn-primary'), body, vs.length + ' viviendas' + (vs.length > 10 ? ' · La aplicación está pensada para carteras pequeñas, pero no hay límite.' : ''));
  },

  /* ======================= ALQUILERES ======================= */
  alquileres(tabArg) {
    if (tabArg) App.st.tabs.alq = tabArg;
    const [tabs, t] = V.tabs('alq', [['cobros', 'Cobros'], ['contratos', 'Contratos'], ['inquilinos', 'Inquilinos'], ['rentas', 'Actualizaciones de renta'], ['ingresos', 'Otros ingresos']]);
    let body = '';
    const vid = V.f('viv', '');
    if (t === 'cobros') {
      const anio = V.f('anioA', U.year(U.today()));
      const est = V.f('estA', 'todas');
      let ms = C.mensualidades(vid).filter(m => !anio || U.year(m.mes) === anio);
      if (est === 'pend') ms = ms.filter(m => C.pendM(m) > 0 && C.exigible(m));
      else if (est !== 'todas') ms = ms.filter(m => C.estadoM(m) === est);
      ms = ms.filter(m => m.mes <= U.ymAdd(U.ym(U.today()), V.f('futA', '') ? 120 : 1));
      const totPend = C.pendienteAlquiler(vid || null);
      body = V.filters(V.vivSel() + V.anioSel('anioA', 'Año', U.year(U.today())) + V.sel('estA', [['todas', 'Todas'], ['pend', 'Pendientes exigibles'], 'Pagado', 'Pago parcial', 'Pendiente', 'Impagado', 'Exonerado'], 'Estado', 'todas') + V.sel('futA', [['', 'Hasta el mes próximo'], ['1', 'Incluir meses futuros']], 'Meses', '')) +
        '<div class="kpis kpis-3">' + UI.kpi('TOTAL PENDIENTE DE INQUILINOS', U.eur(totPend), 'Mensualidades exigibles no cobradas', totPend > 0 ? 'k-danger' : 'k-ok') +
        UI.kpi('Esperado (filtro)', U.eur(U.sum(ms, m => m.exonerado ? 0 : m.esperado))) + UI.kpi('Cobrado (filtro)', U.eur(U.sum(ms, C.cobradoM))) + '</div>' +
        V.tablaMensualidades('alqT', ms, !vid);
    } else if (t === 'contratos') {
      const cs = C.contratos(vid);
      body = V.filters(V.vivSel()) + V.tablaContratos('contT', cs, true);
    } else if (t === 'inquilinos') {
      body = V.filters(V.vivSel()) + V.tablaInquilinos('inqT', C.byViv('inquilinos', vid), true);
    } else if (t === 'rentas') {
      body = V.filters(V.vivSel()) + V.tablaRentas('rentT', C.byViv('rentas', vid), true);
    } else {
      const list = C.byViv('ingresos', vid).sort((a, b) => b.fecha.localeCompare(a.fecha));
      body = V.filters(V.vivSel()) + UI.table('ingT', [
        { k: 'fecha', l: 'Fecha', f: r => U.fdate(r.fecha) },
        { k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.viviendaId), f: r => V.vlink(r.viviendaId) },
        { k: 'tipo', l: 'Tipo' }, { k: 'concepto', l: 'Concepto' },
        { k: 'importe', l: 'Importe', f: r => U.eur(r.importe), cls: 'num' },
        { k: 'a', l: '', sort: false, f: r => UI.ibtn('✎', 'Editar', 'ingreso', { id: r.id }) }
      ], list, { empty: 'No hay otros ingresos registrados.' });
    }
    const acts = UI.btn('💶 Cobrar alquiler', 'cobrar', vid ? { vid } : {}, 'btn-primary') + (t === 'contratos' ? UI.btn('＋ Contrato', 'contrato', vid ? { vid } : {}) : '') + (t === 'ingresos' ? UI.btn('＋ Ingreso', 'ingreso', vid ? { vid } : {}) : '') + (t === 'inquilinos' ? UI.btn('＋ Inquilino', 'inquilino', vid ? { vid } : {}) : '');
    return V.page('Alquileres', acts, tabs + body);
  },
  tablaMensualidades(id, ms, conViv) {
    return UI.table(id, [
      { k: 'mes', l: 'Mes', f: r => '<b>' + U.cap(U.fmonth(r.mes)) + '</b>' },
      ...(conViv ? [{ k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.viviendaId), f: r => V.vlink(r.viviendaId) }] : []),
      { k: 'esperado', l: 'Esperado', f: r => U.eur(r.esperado), cls: 'num' },
      { k: 'cobrado', l: 'Cobrado', v: r => C.cobradoM(r), f: r => U.eur(C.cobradoM(r)), cls: 'num' },
      { k: 'fechaPrevista', l: 'Fecha prevista', f: r => U.fdate(r.fechaPrevista) },
      { k: 'real', l: 'Fecha real', v: r => C.fechaRealM(r), f: r => U.fdate(C.fechaRealM(r)) },
      { k: 'dif', l: 'Diferencia', v: r => C.cobradoM(r) - (r.exonerado ? 0 : r.esperado), f: r => V.signed(U.r2(C.cobradoM(r) - (r.exonerado ? 0 : r.esperado))), cls: 'num' },
      { k: 'estado', l: 'Estado', v: r => C.estadoM(r), f: r => UI.st(C.estadoM(r)) },
      { k: 'obs', l: 'Observaciones', f: r => U.esc(r.obs || '') },
      { k: 'a', l: '', sort: false, cls: 'acts', f: r => (C.pendM(r) > 0 ? UI.btn('Cobrar', 'cobrar', { mid: r.id, vid: r.viviendaId }, 'btn-sm btn-primary') : '') + UI.ibtn('✎', 'Editar / ver cobros', 'mensualidad', { id: r.id }) }
    ], ms, { empty: 'No hay mensualidades para estos filtros. Se generan automáticamente al registrar un contrato.', rowCls: r => ({ 'Impagado': 'row-danger', 'Pago parcial': 'row-warn' }[C.estadoM(r)] || '') });
  },
  tablaContratos(id, cs, conViv) {
    return UI.table(id, [
      ...(conViv ? [{ k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.viviendaId), f: r => V.vlink(r.viviendaId) }] : []),
      { k: 'inq', l: 'Inquilino', v: r => C.nomInq(r.inquilinoId), f: r => U.esc(C.nomInq(r.inquilinoId)) },
      { k: 'fechaFirma', l: 'Firma', f: r => U.fdate(r.fechaFirma) },
      { k: 'fechaInicio', l: 'Inicio', f: r => U.fdate(r.fechaInicio) },
      { k: 'fechaVencimiento', l: 'Vencimiento', f: r => C.vencido(r) ? '<b>' + U.fdate(r.fechaVencimiento) + '</b>' : U.fdate(r.fechaVencimiento) },
      { k: 'dias', l: 'Días rest.', v: r => r.estado === 'activo' ? C.diasRest(r) : null, f: r => r.estado === 'activo' ? C.diasRest(r) : '—', cls: 'num' },
      { k: 'rentaInicial', l: 'Renta inicial', f: r => U.eur(r.rentaInicial), cls: 'num' },
      { k: 'rentaFinal', l: 'Renta actual / final', v: r => r.estado === 'activo' ? +r.rentaActual : +r.rentaFinal, f: r => U.eur(r.estado === 'activo' ? r.rentaActual : (r.rentaFinal || r.rentaActual)), cls: 'num' },
      { k: 'estado', l: 'Estado', v: r => C.estadoContrato(r), f: r => UI.st(C.estadoContrato(r)) },
      { k: 'motivo', l: 'Motivo finalización', v: r => r.motivoFin, f: r => U.esc(r.motivoFin || '') },
      { k: 'obs', l: 'Observaciones', f: r => U.esc(r.obs || '') },
      { k: 'a', l: '', sort: false, f: r => UI.ibtn('✎', 'Editar', 'contrato', { id: r.id, vid: r.viviendaId }) }
    ], cs, { empty: 'No hay contratos registrados.', rowCls: r => C.vencido(r) ? 'row-vencido' : '' });
  },
  tablaInquilinos(id, list, conViv) {
    return UI.table(id, [
      { k: 'nombre', l: 'Nombre', f: r => '<b>' + U.esc(r.nombre) + '</b>' + (C.contratos(r.viviendaId).some(c => c.estado === 'activo' && c.inquilinoId === r.id) ? ' ' + UI.tag('Actual', 'ok') : ' ' + UI.tag('Anterior', 'muted')) },
      ...(conViv ? [{ k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.viviendaId), f: r => V.vlink(r.viviendaId) }] : []),
      { k: 'telefono', l: 'Teléfono', f: r => r.telefono ? '<a href="tel:' + U.esc(r.telefono) + '">' + U.esc(r.telefono) + '</a>' : '—' },
      { k: 'email', l: 'Correo', f: r => r.email ? '<a href="mailto:' + U.esc(r.email) + '">' + U.esc(r.email) + '</a>' : '—' },
      { k: 'entrada', l: 'Entrada', f: r => U.fdate(r.entrada) },
      { k: 'salida', l: 'Salida', f: r => U.fdate(r.salida) },
      { k: 'ocupantes', l: 'Ocupantes', f: r => r.ocupantes || '—', cls: 'num' },
      { k: 'obs', l: 'Observaciones', f: r => U.esc(r.obs || '') },
      { k: 'a', l: '', sort: false, f: r => UI.ibtn('✎', 'Editar', 'inquilino', { id: r.id }) }
    ], list.sort((a, b) => (b.entrada || '').localeCompare(a.entrada || '')), { empty: 'No hay inquilinos registrados.' });
  },
  tablaRentas(id, list, conViv) {
    return UI.table(id, [
      { k: 'fecha', l: 'Fecha', f: r => U.fdate(r.fecha) },
      ...(conViv ? [{ k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.viviendaId), f: r => V.vlink(r.viviendaId) }] : []),
      { k: 'anterior', l: 'Renta anterior', f: r => U.eur(r.anterior), cls: 'num' },
      { k: 'nueva', l: 'Renta nueva', f: r => '<b>' + U.eur(r.nueva) + '</b>', cls: 'num' },
      { k: 'var', l: 'Variación', v: r => r.nueva - r.anterior, f: r => V.signed(r.nueva - r.anterior) + ' <small>(' + (r.anterior ? U.pct((r.nueva - r.anterior) / r.anterior * 100) : '—') + ')</small>', cls: 'num' },
      { k: 'motivo', l: 'Motivo', f: r => U.esc(r.motivo || '') },
      { k: 'obs', l: 'Observaciones', f: r => U.esc(r.obs || '') },
      { k: 'a', l: '', sort: false, f: r => UI.ibtn('🗑', 'Eliminar', 'delRenta', { id: r.id }) }
    ], list.sort((a, b) => b.fecha.localeCompare(a.fecha)), { empty: 'Sin actualizaciones de renta registradas.' });
  },

  /* ======================= GASTOS ======================= */
  gastos(tabArg) {
    if (tabArg) App.st.tabs.gas = tabArg;
    const [tabs, t] = V.tabs('gas', [['gastos', 'Gastos'], ['comunidad', 'Comunidad'], ['derramas', 'Derramas'], ['incidencias', 'Reparaciones e incidencias']]);
    const vid = V.f('viv', '');
    let body = '', acts = '';
    if (t === 'gastos') {
      const anio = V.f('anioG', U.year(U.today())), mes = V.f('mesG', ''), cat = V.f('catG', ''), est = V.f('estG', '');
      const list = C.byViv('gastos', vid).filter(g => (!anio || U.year(g.fecha) === anio) && (!mes || g.fecha.slice(5, 7) === mes) && (!cat || g.categoria === cat) && (!est || (est === 'pagado' ? g.pagado : !g.pagado)));
      const porCat = {};
      list.filter(g => g.pagado).forEach(g => { porCat[g.categoria] = (porCat[g.categoria] || 0) + (+g.importe || 0); });
      body = V.filters(V.vivSel() + V.anioSel('anioG', 'Año', U.year(U.today())) + V.mesSel('mesG') + V.sel('catG', [['', 'Todas'], ...C.cats()], 'Categoría', '') + V.sel('estG', [['', 'Todos'], ['pagado', 'Pagados'], ['pendiente', 'Pendientes']], 'Estado', '')) +
        '<div class="kpis kpis-3">' + UI.kpi('Pagado', U.eur(U.sum(list.filter(g => g.pagado), g => g.importe))) + UI.kpi('Pendiente de pago', U.eur(U.sum(list.filter(g => !g.pagado), g => g.importe)), '', list.some(g => !g.pagado) ? 'k-warn' : '') + UI.kpi('Nº de gastos', list.length) + '</div>' +
        '<p class="muted small">Esta lista recoge los gastos registrados aquí. Las facturas de agua y suministros (módulo Agua) y las cuotas de derramas se suman automáticamente en informes y rentabilidad.</p>' +
        V.tablaGastos('gasT', list, !vid) +
        UI.card('Gastos pagados por categoría', UI.bars(Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([l, v]) => ({ l, v })))) ;
      acts = UI.btn('＋ Añadir gasto', 'gasto', vid ? { vid } : {}, 'btn-primary');
    } else if (t === 'comunidad') {
      body = V.filters(V.vivSel()) + V.comunidadHtml(vid);
    } else if (t === 'derramas') {
      body = V.filters(V.vivSel()) + V.derramasHtml(vid);
      acts = UI.btn('＋ Nueva derrama', 'derrama', vid ? { vid } : {}, 'btn-primary');
    } else {
      body = V.filters(V.vivSel() + V.sel('estI', [['', 'Todas'], 'Pendiente', 'En curso', 'Resuelto'], 'Estado', '')) + V.incidenciasHtml(vid, V.f('estI', ''));
      acts = UI.btn('＋ Nueva incidencia', 'incidencia', vid ? { vid } : {}, 'btn-primary');
    }
    return V.page('Gastos', acts, tabs + body);
  },
  tablaGastos(id, list, conViv) {
    return UI.table(id, [
      { k: 'fecha', l: 'Fecha', f: r => U.fdate(r.fecha) },
      ...(conViv ? [{ k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.viviendaId), f: r => V.vlink(r.viviendaId) }] : []),
      { k: 'concepto', l: 'Concepto', f: r => '<b>' + U.esc(r.concepto) + '</b>' },
      { k: 'categoria', l: 'Categoría' },
      { k: 'importe', l: 'Importe', f: r => U.eur(r.importe), cls: 'num' },
      { k: 'proveedor', l: 'Proveedor', f: r => U.esc(r.proveedor || '') },
      { k: 'periodicidad', l: 'Periodicidad', f: r => U.cap(r.periodicidad || '') },
      { k: 'pagado', l: 'Estado', v: r => r.pagado ? 1 : 0, f: r => '<button type="button" class="tag-btn" data-act="togglePagado" data-id="' + r.id + '" title="Cambiar estado">' + (r.pagado ? UI.tag('Pagado', 'ok') : UI.tag(r.fecha < U.today() ? 'Pendiente (vencido)' : 'Pendiente', r.fecha < U.today() ? 'danger' : 'neutral')) + '</button>' },
      { k: 'formaPago', l: 'Forma de pago', f: r => U.esc(r.formaPago || '') },
      { k: 'obs', l: 'Observaciones', f: r => U.esc(r.obs || '') },
      { k: 'a', l: '', sort: false, f: r => UI.ibtn('✎', 'Editar', 'gasto', { id: r.id }) }
    ], list.sort((a, b) => b.fecha.localeCompare(a.fecha)), { empty: 'No hay gastos para estos filtros.' });
  },
  comunidadHtml(vid) {
    const vs = vid ? [C.viv(vid)] : C.vivs();
    return vs.map(v => {
      const cfg = v.comunidad;
      const list = DB.S.gastos.filter(g => g.viviendaId === v.id && g.categoria === 'Comunidad ordinaria').sort((a, b) => b.fecha.localeCompare(a.fecha));
      const pend = list.filter(g => !g.pagado);
      return UI.card('Comunidad · ' + U.esc(v.nombre),
        UI.dl([['Cuota ordinaria', cfg ? U.eur(cfg.importe) : 'Sin configurar'], ['Periodicidad', cfg ? U.cap(cfg.periodicidad) : '—'], ['Día de pago', cfg ? cfg.dia : '—'], ['Pagado este año', U.eur(U.sum(list.filter(g => g.pagado && U.year(g.fecha) === U.year(U.today())), g => g.importe))], ['Pendiente', pend.length ? '<b class="neg">' + U.eur(U.sum(pend, g => g.importe)) + '</b> (' + pend.length + ')' : U.eur(0)]]) +
        '<div class="sub-h">Histórico de cuotas</div>' + V.tablaGastos('comT' + v.id, list, false),
        UI.btn('Configurar cuota / generar año', 'comunidadCfg', { vid: v.id }, 'btn-sm') + UI.btn('＋ Cuota', 'gasto', { vid: v.id, cat: 'Comunidad ordinaria' }, 'btn-sm btn-primary'));
    }).join('') || UI.empty('No hay viviendas.');
  },
  derramasHtml(vid) {
    const list = C.byViv('derramas', vid).sort((a, b) => (b.fechaAprobacion || '').localeCompare(a.fechaAprobacion || ''));
    const tot = C.derramasPendientes(vid || null);
    return '<div class="kpis kpis-3">' + UI.kpi('TOTAL DE DERRAMAS PENDIENTES', U.eur(tot), '', tot > 0 ? 'k-warn' : 'k-ok') + '</div>' + (list.length ? list.map(d => {
      const i = C.infoDerrama(d);
      return UI.card(U.esc(d.concepto) + (vid ? '' : ' · ' + U.esc(C.nomViv(d.viviendaId))),
        UI.dl([['Fecha de aprobación', U.fdate(d.fechaAprobacion)], ['Importe total', U.eur(d.total)], ['Número de cuotas', (d.cuotas || []).length], ['Importe por cuota', U.eur(d.importeCuota)], ['Fecha inicial', U.fdate(d.fechaInicial)], ['Fecha final', U.fdate(i.fechaFinal)], ['Cuotas pagadas', i.pagadas], ['Cuotas pendientes', i.pendientes], ['Importe pendiente', '<b class="' + (i.importePendiente > 0 ? 'neg' : '') + '">' + U.eur(i.importePendiente) + '</b>']]) +
        (d.obs ? '<p class="muted">' + U.esc(d.obs) + '</p>' : '') +
        '<div class="cuotas">' + (d.cuotas || []).map(q => '<button type="button" class="cq ' + (q.pagada ? 'pag' : (q.fecha < U.today() ? 'atr' : '')) + '" data-act="cuotaDerrama" data-id="' + d.id + '" data-n="' + q.n + '" title="Pulse para cambiar el estado"><b>' + q.n + '</b><span>' + U.fdate(q.fecha) + '</span><span>' + U.eur(q.importe) + '</span><small>' + (q.pagada ? '✔ Pagada' + (q.fechaPago ? ' ' + U.fdate(q.fechaPago) : '') : (q.fecha < U.today() ? 'Vencida' : 'Pendiente')) + '</small></button>').join('') + '</div>',
        UI.ibtn('✎', 'Editar', 'derrama', { id: d.id }));
    }).join('') : UI.empty('No hay derramas registradas.'));
  },
  incidenciasHtml(vid, est) {
    const list = C.byViv('incidencias', vid).filter(i => !est || i.estado === est).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return UI.table('incT' + (vid || ''), [
      { k: 'fecha', l: 'Fecha', f: r => U.fdate(r.fecha) },
      ...(!vid ? [{ k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.viviendaId), f: r => V.vlink(r.viviendaId) }] : []),
      { k: 'problema', l: 'Problema', f: r => '<b>' + U.esc(r.problema) + '</b>' + (DB.S.documentos.some(d => d.incidenciaId === r.id) ? ' 📎' : '') },
      { k: 'categoria', l: 'Categoría' },
      { k: 'urgencia', l: 'Urgencia', f: r => UI.st(r.urgencia || 'Media') },
      { k: 'comunica', l: 'Comunica', f: r => U.esc(r.comunica || '') },
      { k: 'profesional', l: 'Profesional', f: r => U.esc(r.profesional || '') },
      { k: 'presupuesto', l: 'Presupuesto', f: r => U.eur(r.presupuesto), cls: 'num' },
      { k: 'costeFinal', l: 'Coste final', f: r => U.eur(r.costeFinal) + (r.gastoId ? ' <small class="muted">(en gastos)</small>' : ''), cls: 'num' },
      { k: 'fechaReparacion', l: 'Reparación', f: r => U.fdate(r.fechaReparacion) },
      { k: 'estado', l: 'Estado', f: r => UI.st(r.estado || 'Pendiente') },
      { k: 'obs', l: 'Observaciones', f: r => U.esc(r.obs || '') },
      { k: 'a', l: '', sort: false, f: r => UI.ibtn('✎', 'Editar', 'incidencia', { id: r.id }) }
    ], list, { empty: 'No hay incidencias registradas.', rowCls: r => r.estado !== 'Resuelto' && r.urgencia === 'Urgente' ? 'row-danger' : '' });
  },

  /* ======================= AGUA Y SUMINISTROS ======================= */
  agua(tabArg) {
    if (tabArg) App.st.tabs.agua = tabArg;
    const [tabs, t] = V.tabs('agua', [['agua', 'Agua'], ['otros', 'Otros suministros']]);
    const vid = V.f('viv', '');
    const anio = V.f('anioW', '');
    const isA = t === 'agua';
    const list = C.byViv('suministros', vid).filter(s => (isA ? s.tipo === 'agua' : s.tipo !== 'agua') && (!anio || U.year(s.fechaFactura || s.fechaPrevista) === anio));
    const pend = isA ? C.aguaPendiente(vid || null) : C.suminPendiente(vid || null);
    const body = V.filters(V.vivSel() + V.anioSel('anioW', 'Año', '')) +
      '<div class="kpis kpis-3">' + UI.kpi(isA ? 'AGUA PENDIENTE DE COBRO' : 'SUMINISTROS PENDIENTES DE COBRO', U.eur(pend), '', pend > 0 ? 'k-warn' : 'k-ok') +
      UI.kpi('Coste soportado (filtro)', U.eur(U.sum(list.filter(s => s.costePagado !== false), s => s.coste))) + UI.kpi('Repercutido (filtro)', U.eur(U.sum(list, s => s.repercutido))) + '</div>' +
      V.tablaSumin('sumT' + t, list, !vid, !isA);
    return V.page(isA ? 'Agua' : 'Suministros', UI.btn(isA ? '💧 Registrar agua' : '＋ Suministro', 'suministro', Object.assign({ tipo: isA ? 'agua' : 'electricidad' }, vid ? { vid } : {}), 'btn-primary'), tabs + body);
  },
  tablaSumin(id, list, conViv, conTipo) {
    return UI.table(id, [
      { k: 'periodo', l: 'Periodo', f: r => '<b>' + U.esc(r.periodo || '') + '</b>', v: r => r.fechaFactura || r.fechaPrevista },
      ...(conTipo ? [{ k: 'tipo', l: 'Suministro', v: r => SUMIN[r.tipo], f: r => SUMIN[r.tipo] }] : []),
      ...(conViv ? [{ k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.viviendaId), f: r => V.vlink(r.viviendaId) }] : []),
      { k: 'coste', l: conTipo ? 'Coste propietario' : 'Coste total', f: r => U.eur(r.coste) + (r.costePagado === false ? ' <small class="muted">(no lo paga el propietario)</small>' : ''), cls: 'num' },
      { k: 'repercutido', l: 'Repercutido', f: r => U.eur(r.repercutido), cls: 'num' },
      { k: 'fechaPrevista', l: 'Fecha prevista', f: r => U.fdate(r.fechaPrevista) },
      { k: 'real', l: 'Fecha real', v: r => C.fechaRealS(r), f: r => U.fdate(C.fechaRealS(r)) },
      { k: 'cobrado', l: 'Cobrado', v: r => C.cobradoS(r), f: r => U.eur(C.cobradoS(r)), cls: 'num' },
      { k: 'pend', l: 'Pendiente', v: r => C.pendS(r), f: r => C.pendS(r) > 0 ? '<b class="neg">' + U.eur(C.pendS(r)) + '</b>' : U.eur(0), cls: 'num' },
      { k: 'estado', l: 'Estado', v: r => C.estadoS(r), f: r => UI.st(C.estadoS(r)) },
      { k: 'obs', l: 'Observaciones', f: r => U.esc(r.obs || '') },
      { k: 'a', l: '', sort: false, cls: 'acts', f: r => (C.pendS(r) > 0 ? UI.btn('Cobrar', 'cobrarSum', { id: r.id }, 'btn-sm btn-primary') : '') + UI.ibtn('✎', 'Editar', 'suministro', { id: r.id }) }
    ], list.sort((a, b) => (b.fechaFactura || b.fechaPrevista || '').localeCompare(a.fechaFactura || a.fechaPrevista || '')), { empty: 'No hay registros.' });
  },

  /* ======================= HIPOTECAS ======================= */
  hipotecas(tabArg) {
    if (tabArg) App.st.tabs.hip = tabArg;
    const [tabs, t] = V.tabs('hip', [['lista', 'Préstamos'], ['sim', 'Simulador'], ['cuadro', 'Cuadro de amortización']]);
    const vid = V.f('viv', '');
    let body = '';
    const hs = C.byViv('hipotecas', vid);
    if (t === 'lista') {
      const deuda = U.sum(hs, h => C.pendienteH(h));
      const ini = U.sum(hs, h => h.capitalInicial);
      body = V.filters(V.vivSel()) + '<div class="kpis kpis-3">' + UI.kpi('Capital pendiente total', U.eur(deuda), hs.length + ' préstamos') + UI.kpi('Capital inicial total', U.eur(ini)) + UI.kpi('Amortizado', ini ? U.pct((ini - deuda) / ini * 100) : '—') + '</div>' +
        (hs.length ? hs.map(h => V.hipotecaCard(h, !vid)).join('') : UI.empty('No hay hipotecas registradas.', UI.btn('＋ Nueva hipoteca', 'hipoteca', vid ? { vid } : {}, 'btn-primary')));
    } else if (t === 'sim') body = V.simulador();
    else body = V.cuadro();
    return V.page('Hipotecas', UI.btn('🏦 Registrar cuota', 'cuota', {}, 'btn-primary') + UI.btn('＋ Hipoteca', 'hipoteca', vid ? { vid } : {}), tabs + body);
  },
  hipotecaCard(h, conViv, full) {
    const i = C.infoH(h);
    const prev = (h.previstas || []).filter(p => p.ym >= i.prox);
    const simP = prev.length ? C.simBase(h, prev) : null;
    const cs = C.cuotasH(h.id);
    const saldos = C.saldosH(h);
    const head = UI.dl([
      ['Banco', U.esc(h.banco)], ['Capital inicial', U.eur(h.capitalInicial)], ['Capital pendiente actual', '<b>' + U.eur(i.pendiente) + '</b>'],
      ['Porcentaje amortizado', U.pct(i.pct)], ['Formalización', U.fdate(h.fechaFormalizacion)], ['Primera cuota', U.fdate(h.fechaPrimeraCuota)],
      ['Duración inicial', U.dur(h.plazoMeses) + ' (' + h.plazoMeses + ' meses)'], ['Tipo', U.cap(h.modalidad) + ' · ' + U.pct(+h.tipoInteres)], ['Cuota mensual', U.eur(i.cuota)],
      ['Día de cargo', h.diaCargo], ['Fin previsto inicial', h.fechaPrimeraCuota && h.plazoMeses ? U.fmonth(U.ymAdd(U.ym(h.fechaPrimeraCuota), h.plazoMeses - 1)) : '—'],
      ['Intereses pagados (registrados)', U.eur(i.interesesPagados)], ['Amortizaciones extraordinarias', U.eur(i.extra)]
    ]);
    const canc = '<div class="cancel-box"><div class="f-t">FECHA ESTIMADA DE CANCELACIÓN</div>' + (i.cancelada ? '<p><b>Préstamo cancelado.</b></p>' : i.noAmortiza ? '<p class="neg">La cuota no cubre los intereses: con estos datos el préstamo no se amortiza.</p>' :
      UI.dl([['Capital pendiente', U.eur(i.pendiente)], ['Cuota', U.eur(i.cuota)], ['Tipo de interés', U.pct(+h.tipoInteres)], ['Meses restantes', i.meses + ' (' + U.dur(i.meses) + ')'], ['Próxima cuota', U.fmonth(i.prox)], ['Fecha estimada de cancelación', '<b>' + U.cap(U.fmonth(i.fin)) + '</b>', 'tot'],
        ['Amortizaciones extraordinarias previstas', prev.length ? prev.map(p => U.fmonth(p.ym) + ': ' + U.eur(p.importe) + ' ' + UI.ibtn('✕', 'Quitar', 'delPrevista', { hid: h.id, pid: p.id }, 'xs')).join('<br>') : 'Ninguna'],
        ...(simP && !simP.error ? [['Cancelación con amortizaciones previstas', '<b>' + U.cap(U.fmonth(simP.fin)) + '</b> (' + simP.meses + ' meses)', 'tot']] : [])]) +
      '<p class="muted small">Estimación basada en los datos introducidos (capital pendiente, cuota y tipo vigentes).</p>') + '</div>';
    const tabla = full ? '<div class="sub-h">Mensualidades registradas</div>' + UI.table('cuoT' + h.id, [
      { k: 'mes', l: 'Mes', f: r => U.cap(U.fmonth(r.mes)) + (r.teorica ? ' <small class="muted" title="Reparto teórico; corríjalo con el recibo">(teórica)</small>' : '') },
      { k: 'cuotaPrevista', l: 'Cuota prevista', f: r => U.eur(r.cuotaPrevista), cls: 'num' },
      { k: 'cuotaPagada', l: 'Cuota pagada', f: r => U.eur(r.cuotaPagada), cls: 'num' },
      { k: 'fechaPago', l: 'Fecha de pago', f: r => U.fdate(r.fechaPago) },
      { k: 'capital', l: 'Capital amortizado', f: r => U.eur(r.capital), cls: 'num' },
      { k: 'intereses', l: 'Intereses pagados', f: r => U.eur(r.intereses), cls: 'num' },
      { k: 'tras', l: 'Capital pendiente tras la cuota', v: r => saldos[r.id], f: r => U.eur(saldos[r.id]), cls: 'num' },
      { k: 'a', l: '', sort: false, f: r => UI.ibtn('✎', 'Editar', 'cuota', { id: r.id }) }
    ], cs.slice().reverse(), { empty: 'Aún no hay cuotas registradas.' }) : '';
    return UI.card('🏦 ' + U.esc(h.banco || 'Hipoteca') + (conViv ? ' · ' + V.vlink(h.viviendaId) : ''),
      '<div class="hip-g">' + head + canc + '</div>' + tabla,
      UI.btn('Registrar cuota', 'cuota', { hid: h.id }, 'btn-sm btn-primary') + UI.btn('Cuotas atrasadas', 'cuotasTeoricas', { hid: h.id }, 'btn-sm') + UI.btn('Amortizar', 'amortizacion', { hid: h.id }, 'btn-sm') + UI.btn('Prevista', 'prevista', { hid: h.id }, 'btn-sm') + UI.ibtn('✎', 'Editar hipoteca', 'hipoteca', { id: h.id }) +
      (full ? '' : '<a class="btn btn-sm" href="#/vivienda/' + h.viviendaId + '/hipoteca">Detalle ›</a>'));
  },
  simulador() {
    const hs = DB.S.hipotecas.filter(h => !C.infoH(h).cancelada);
    if (!hs.length) return UI.empty('Registre una hipoteca para usar el simulador.');
    const hid = V.f('simH', hs[0].id);
    const h = DB.get('hipotecas', hid) || hs[0];
    const i = C.infoH(h);
    const s = App.st.sim;
    const form = '<div class="sim-f">' + V.sel('simH', hs.map(x => [x.id, C.nomViv(x.viviendaId) + ' · ' + (x.banco || '')]), 'Hipoteca', hs[0].id) +
      '<label class="flt"><span>Amortización puntual (€)</span><input type="text" inputmode="decimal" data-sim="puntual" value="' + U.esc(U.inNum(s.puntual)) + '" placeholder="Ej.: 5000"></label>' +
      '<label class="flt"><span>Mes de la amortización puntual</span><input type="month" data-sim="puntualYm" value="' + U.esc(s.puntualYm || '') + '" placeholder="AAAA-MM"></label>' +
      '<label class="flt"><span>Amortización anual (€)</span><input type="text" inputmode="decimal" data-sim="anual" value="' + U.esc(U.inNum(s.anual)) + '" placeholder="Ej.: 2000"></label>' +
      '<label class="flt"><span>Mes de cada año</span><select data-sim="anualMes">' + MESES.map((m, k) => '<option value="' + (k + 1) + '"' + (+s.anualMes === k + 1 ? ' selected' : '') + '>' + U.cap(m) + '</option>').join('') + '</select></label>' +
      '<label class="flt"><span>Desde el año</span><input type="number" data-sim="anualDesde" value="' + U.esc(s.anualDesde || U.year(U.today())) + '"></label>' +
      '<label class="flt"><span>Nueva cuota mensual (€)</span><input type="text" inputmode="decimal" data-sim="nuevaCuota" value="' + U.esc(U.inNum(s.nuevaCuota)) + '" placeholder="Actual: ' + U.inNum(i.cuota) + '"></label>' +
      '<label class="flt"><span>Efecto de las amortizaciones</span><select data-sim="modo"><option value="plazo"' + (s.modo !== 'cuota' ? ' selected' : '') + '>Reducir plazo</option><option value="cuota"' + (s.modo === 'cuota' ? ' selected' : '') + '>Reducir cuota</option></select></label>' +
      '<label class="flt"><span>Ver capital pendiente a</span><input type="month" data-sim="verYm" value="' + U.esc(s.verYm || '') + '" placeholder="AAAA-MM"></label>' +
      '</div><div class="form-actions">' + UI.btn('Limpiar', 'simReset') + '<button type="button" class="btn btn-primary" data-act="simRun">Calcular</button></div>';
    if (!i.cuota || i.noAmortiza) return UI.card('Simulador hipotecario', form + '<p class="neg">' + INSUF + '</p>');
    const base = C.simular({ P: i.pendiente, cuota: i.cuota, r: i.r, desde: i.prox });
    const extras = [];
    if (s.puntual > 0 && s.puntualYm) extras.push({ ym: s.puntualYm, importe: s.puntual });
    const anual = s.anual > 0 ? { importe: s.anual, mes: +s.anualMes || 1, desde: +s.anualDesde || +U.year(U.today()) } : null;
    const esc = C.simular({ P: i.pendiente, cuota: i.cuota, r: i.r, desde: i.prox, extras, anual, nuevaCuota: s.nuevaCuota > 0 ? s.nuevaCuota : null, modo: s.modo || 'plazo' });
    const hay = extras.length || anual || s.nuevaCuota > 0;
    let res;
    if (esc.error) res = '<p class="neg">' + esc.error + '</p>';
    else {
      const capA = ym => { if (!ym) return null; const f = base.filas.find(x => x.ym === ym); return f ? f.pend : (ym < i.prox ? i.pendiente : 0); };
      const capB = ym => { if (!ym) return null; const f = esc.filas.find(x => x.ym === ym); return f ? f.pend : (ym < i.prox ? i.pendiente : 0); };
      const totExtra = U.sum(esc.filas, f => f.extra);
      res = '<div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th></th><th class="num">Situación actual</th><th class="num">Escenario</th><th class="num">Diferencia</th></tr></thead><tbody>' +
        '<tr><td data-label="">Capital pendiente hoy</td><td class="num" data-label="Actual">' + U.eur(i.pendiente) + '</td><td class="num" data-label="Escenario">' + U.eur(i.pendiente) + '</td><td class="num" data-label="Diferencia">—</td></tr>' +
        '<tr><td data-label="">Meses restantes</td><td class="num" data-label="Actual">' + base.meses + '</td><td class="num" data-label="Escenario">' + esc.meses + '</td><td class="num" data-label="Meses ahorrados"><b class="pos">' + (base.meses - esc.meses) + ' meses ahorrados</b></td></tr>' +
        '<tr><td data-label="">Fecha estimada de finalización</td><td class="num" data-label="Actual">' + U.fmonth(base.fin) + '</td><td class="num" data-label="Escenario"><b>' + U.fmonth(esc.fin) + '</b></td><td class="num" data-label="Diferencia">' + U.dur(base.meses - esc.meses) + '</td></tr>' +
        '<tr><td data-label="">Intereses futuros</td><td class="num" data-label="Actual">' + U.eur(base.intereses) + '</td><td class="num" data-label="Escenario">' + U.eur(esc.intereses) + '</td><td class="num" data-label="Ahorro de intereses"><b class="pos">' + U.eur(base.intereses - esc.intereses) + ' de ahorro</b></td></tr>' +
        '<tr><td data-label="">Amortizaciones extraordinarias</td><td class="num" data-label="Actual">0,00 €</td><td class="num" data-label="Escenario">' + U.eur(totExtra) + '</td><td class="num" data-label=""></td></tr>' +
        '<tr><td data-label="">Cuota final</td><td class="num" data-label="Actual">' + U.eur(i.cuota) + '</td><td class="num" data-label="Escenario">' + U.eur(esc.filas.length ? esc.filas[esc.filas.length > 1 ? esc.filas.length - 2 : 0].cuota : 0) + '</td><td class="num" data-label=""></td></tr>' +
        (s.verYm ? '<tr><td data-label="">Capital pendiente en ' + U.fmonth(s.verYm) + '</td><td class="num" data-label="Actual">' + U.eur(capA(s.verYm)) + '</td><td class="num" data-label="Escenario">' + U.eur(capB(s.verYm)) + '</td><td class="num" data-label="Diferencia">' + U.eur(capA(s.verYm) - capB(s.verYm)) + '</td></tr>' : '') +
        '</tbody></table></div>' +
        UI.line([{ name: 'Situación actual', pts: base.filas.filter((f, k) => k % 3 === 0 || k === base.filas.length - 1).map(f => ({ x: f.ym, y: f.pend })) },
          { name: 'Escenario', pts: esc.filas.filter((f, k) => k % 3 === 0 || k === esc.filas.length - 1).map(f => ({ x: f.ym, y: f.pend })) }]) +
        '<p class="note"><b>Estimación basada en los datos introducidos.</b> Calculada con el capital pendiente (' + U.eur(i.pendiente) + '), la cuota (' + U.eur(i.cuota) + ') y el tipo vigente (' + U.pct(+h.tipoInteres) + '), suponiendo que no cambia. En préstamos variables o mixtos el resultado real dependerá de las revisiones del tipo. No incluye comisiones.</p>' +
        (hay ? '<div class="form-actions">' + UI.btn('Guardar estas amortizaciones como previstas', 'simGuardar', { hid: h.id }) + '</div>' : '');
    }
    return UI.card('Simulador hipotecario · ' + U.esc(C.nomViv(h.viviendaId)), form + (hay ? res : '<p class="muted">Introduzca uno o varios escenarios (amortización puntual, anual o nueva cuota) y pulse «Calcular».</p>' + (esc.error ? '' : '<p>Situación actual: ' + base.meses + ' meses restantes, fin estimado <b>' + U.fmonth(base.fin) + '</b>, intereses futuros ' + U.eur(base.intereses) + '.</p>')));
  },
  cuadro() {
    const hs = DB.S.hipotecas;
    if (!hs.length) return UI.empty('No hay hipotecas registradas.');
    const hid = V.f('cuaH', hs[0].id);
    const h = DB.get('hipotecas', hid) || hs[0];
    const i = C.infoH(h);
    const sim = C.simBase(h);
    const rows = sim && !sim.error ? sim.filas : [];
    return V.filters(V.sel('cuaH', hs.map(x => [x.id, C.nomViv(x.viviendaId) + ' · ' + (x.banco || '')]), 'Hipoteca', hs[0].id)) +
      UI.card('Cuadro de amortización previsto desde ' + U.fmonth(i.prox),
        '<p class="muted small">Proyección por sistema francés con capital pendiente ' + U.eur(i.pendiente) + ', cuota ' + U.eur(i.cuota) + ' y tipo ' + U.pct(+h.tipoInteres) + '. Estimación basada en los datos introducidos.</p>' +
        (rows.length ? '<div class="tbl-wrap tall"><table class="tbl"><thead><tr><th>Nº</th><th>Mes</th><th class="num">Cuota</th><th class="num">Intereses</th><th class="num">Capital</th><th class="num">Pendiente</th></tr></thead><tbody>' +
          rows.map((r, k) => '<tr><td data-label="Nº">' + (k + 1) + '</td><td data-label="Mes">' + U.fmonth(r.ym) + '</td><td class="num" data-label="Cuota">' + U.eur(r.cuota) + '</td><td class="num" data-label="Intereses">' + U.eur(r.int) + '</td><td class="num" data-label="Capital">' + U.eur(r.cap) + '</td><td class="num" data-label="Pendiente">' + U.eur(r.pend) + '</td></tr>').join('') +
          '</tbody><tfoot><tr><td></td><td>Total</td><td class="num">' + U.eur(U.sum(rows, r => r.cuota)) + '</td><td class="num">' + U.eur(U.sum(rows, r => r.int)) + '</td><td class="num">' + U.eur(U.sum(rows, r => r.cap)) + '</td><td></td></tr></tfoot></table></div>' : '<p>' + INSUF + '</p>'));
  },

  /* ======================= AMORTIZACIONES ======================= */
  amortizaciones() {
    const vid = V.f('viv', '');
    const list = C.byViv('amortizaciones', vid).sort((a, b) => b.fecha.localeCompare(a.fecha));
    return V.page('Amortizaciones extraordinarias', UI.btn('📉 Nueva amortización', 'amortizacion', {}, 'btn-primary') + '<a class="btn" href="#/hipotecas/sim">Simulador</a>',
      V.filters(V.vivSel()) + '<div class="kpis kpis-3">' + UI.kpi('Total amortizado', U.eur(U.sum(list, a => a.importe)), list.length + ' operaciones') + '</div>' + V.tablaAmort('amT', list, !vid));
  },
  tablaAmort(id, list, conViv) {
    return UI.table(id, [
      { k: 'fecha', l: 'Fecha', f: r => U.fdate(r.fecha) },
      ...(conViv ? [{ k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.viviendaId), f: r => V.vlink(r.viviendaId) }] : []),
      { k: 'hip', l: 'Hipoteca', v: r => (DB.get('hipotecas', r.hipotecaId) || {}).banco, f: r => U.esc((DB.get('hipotecas', r.hipotecaId) || {}).banco || '—') },
      { k: 'importe', l: 'Importe', f: r => '<b>' + U.eur(r.importe) + '</b>', cls: 'num' },
      { k: 'capitalAntes', l: 'Capital antes', f: r => U.eur(r.capitalAntes), cls: 'num' },
      { k: 'imp2', l: 'Importe amortizado', v: r => r.importe, f: r => U.eur(r.importe), cls: 'num' },
      { k: 'capitalDespues', l: 'Capital después', f: r => U.eur(r.capitalDespues), cls: 'num' },
      { k: 'tipo', l: 'Tipo', f: r => r.tipo === 'cuota' ? 'Reducción de cuota' : 'Reducción de plazo' },
      { k: 'efecto', l: 'Efecto', sort: false, f: r => r.tipo === 'cuota' ? 'Cuota ' + U.eur(r.cuotaAntes) + ' → ' + U.eur(r.cuotaDespues) : (r.mesesAntes ? r.mesesAntes + ' → ' + r.mesesDespues + ' meses' : '—') },
      { k: 'obs', l: 'Observaciones', f: r => U.esc(r.obs || '') },
      { k: 'a', l: '', sort: false, f: r => UI.ibtn('🗑', 'Eliminar', 'delAmort', { id: r.id }) }
    ], list, { empty: 'No hay amortizaciones extraordinarias registradas.' });
  },

  /* ======================= CALENDARIO ======================= */
  calendario() {
    const ym = App.st.calYm;
    const vid = V.f('viv', '');
    const from = ym + '-01', to = U.ymLast(ym);
    const E = C.eventos(from, to, vid || null);
    const first = U.parse(from);
    const lead = (first.getDay() + 6) % 7;
    const dm = U.dim(+ym.slice(0, 4), +ym.slice(5, 7));
    const hoy = U.today();
    let cells = '';
    for (let k = 0; k < lead; k++) cells += '<div class="cd empty"></div>';
    for (let d = 1; d <= dm; d++) {
      const f = ym + '-' + U.z(d);
      const ev = E.filter(e => e.f === f);
      cells += '<div class="cd' + (f === hoy ? ' today' : '') + (ev.some(e => e.st === 'vencido') ? ' has-venc' : '') + '"><span class="dn">' + d + '</span>' +
        ev.slice(0, 3).map(e => '<a class="ev ev-' + e.st + '" href="' + e.go + '" title="' + U.esc(C.nomViv(e.vid) + ': ' + e.t) + '">' + (e.st === 'vencido' ? 'VENCIDO ' : '') + U.esc(e.tipo) + '</a>').join('') +
        (ev.length > 3 ? '<span class="ev-more">+' + (ev.length - 3) + '</span>' : '') +
        '<span class="dots">' + ev.map(e => '<i class="dot ev-' + e.st + '"></i>').join('') + '</span></div>';
    }
    const leg = '<div class="legend cal-leg">' + [['pagado', 'Pagado / hecho'], ['pendiente', 'Pendiente'], ['proximo', 'Próximo (7 días)'], ['atrasado', 'Atrasado'], ['vencido', 'Contrato VENCIDO']].map(([k, l]) => '<span><i class="sw ev-' + k + '"></i>' + l + '</span>').join('') + '</div>';
    const lista = E.length ? '<ul class="ev-list">' + E.map(e => '<li class="ev-li ev-b-' + e.st + '" data-go="' + e.go + '"><span class="ev-d">' + U.fdate(e.f).slice(0, 5) + '</span><span class="ev-t">' + (e.st === 'vencido' ? '<span class="tag vencido">VENCIDO</span> ' : '') + '<b>' + U.esc(e.tipo) + '</b> · ' + U.esc(C.nomViv(e.vid)) + '<small>' + U.esc(e.t) + '</small></span><span class="tag ' + ({ pagado: 'ok', pendiente: 'neutral', proximo: 'info', atrasado: 'danger', vencido: 'vencido' }[e.st]) + '">' + ({ pagado: 'Pagado', pendiente: 'Pendiente', proximo: 'Próximo', atrasado: 'Atrasado', vencido: 'VENCIDO' }[e.st]) + '</span></li>').join('') + '</ul>' : UI.empty('Sin vencimientos este mes.');
    const vencidos = DB.S.contratos.filter(c => C.vencido(c) && (!vid || c.viviendaId === vid));
    return V.page('Calendario', UI.btn('Hoy', 'calMove', { ym: U.ym(hoy) }),
      (vencidos.length ? vencidos.map(c => '<div class="vencido-banner" data-go="#/vivienda/' + c.viviendaId + '/contrato"><span class="tag vencido">VENCIDO</span> <strong>CONTRATO VENCIDO — ' + U.fdate(c.fechaVencimiento) + '</strong> · ' + U.esc(C.nomViv(c.viviendaId)) + '</div>').join('') : '') +
      V.filters(V.vivSel()) +
      '<div class="cal-nav">' + UI.ibtn('‹', 'Mes anterior', 'calMove', { n: -1 }) + '<h2>' + U.cap(U.fmonth(ym)) + '</h2>' + UI.ibtn('›', 'Mes siguiente', 'calMove', { n: 1 }) + '</div>' +
      '<div class="cal"><div class="cw">Lun</div><div class="cw">Mar</div><div class="cw">Mié</div><div class="cw">Jue</div><div class="cw">Vie</div><div class="cw">Sáb</div><div class="cw">Dom</div>' + cells + '</div>' + leg +
      UI.card('Vencimientos de ' + U.fmonth(ym) + ' (' + E.length + ')', lista));
  },

  /* ======================= RENTABILIDAD ======================= */
  rentabilidad(tabArg) {
    if (tabArg) App.st.tabs.rent = tabArg;
    const [tabs, t] = V.tabs('rent', [['vivienda', 'Por vivienda'], ['panel', 'Panel global'], ['comparativa', 'Comparativa'], ['anual', 'Histórico anual']]);
    let body = '';
    if (!DB.S.viviendas.length) body = UI.empty('No hay viviendas.');
    else if (t === 'vivienda') {
      const vid = V.f('rentViv', C.vivs()[0].id);
      const v = C.viv(vid) || C.vivs()[0];
      body = V.filters(V.sel('rentViv', C.vivs().map(x => [x.id, x.nombre]), 'Vivienda', C.vivs()[0].id) + V.rentPerSel()) + Ficha.rentabilidadHtml(v);
    } else if (t === 'panel') body = '<p class="muted">Pulse una cabecera para ordenar. Gastos y flujo según el periodo elegido en «Mi cartera» (' + U.esc(App.periodo().label) + ').</p>' + V.panelTable('panelR');
    else if (t === 'comparativa') body = V.comparativa();
    else body = V.historicoAnual();
    return V.page('Rentabilidad', '', tabs + body);
  },
  rentPerSel() { return V.sel('rentPer', [['12m', 'Últimos 12 meses'], ...V.anios().map(y => [y, 'Año ' + y])], 'Periodo', '12m'); },
  rentPer() {
    const p = V.f('rentPer', '12m');
    if (p === '12m') return C.ventana12();
    return { from: p + '-01-01', to: p + '-12-31', label: 'año ' + p + (p === U.year(U.today()) ? ' (ejercicio en curso)' : '') };
  },
  comparativa() {
    const per = V.rentPer();
    const rows = C.vivs().map(v => {
      const r = C.rentab(v, per.from, per.to);
      const val = C.valor(v), coste = C.costeTotal(v);
      return { v, r, deuda: C.deudaTotal(v.id), reval: val !== null && coste !== null ? val - coste : null, revalPct: val !== null && coste ? (val - coste) / coste * 100 : null };
    });
    const pick = (fn, max = true) => { const l = rows.filter(x => fn(x) !== null && fn(x) !== undefined); if (!l.length) return null; return l.reduce((a, b) => (max ? fn(b) > fn(a) : fn(b) < fn(a)) ? b : a); };
    const box = (t, x, val, cls) => '<div class="rank ' + (cls || '') + '"><small>' + t + '</small>' + (x ? '<b>' + V.vlink(x.v.id) + '</b><span>' + val(x) + '</span>' : '<span class="muted">' + INSUF + '</span>') + '</div>';
    const best = pick(x => x.r.neta), worst = pick(x => x.r.neta, false);
    const ranks = '<div class="ranks">' +
      box('Más rentable (neta)', best, x => U.pct(x.r.neta), 'pos-b') + box('Menos rentable (neta)', worst, x => U.pct(x.r.neta), 'neg-b') +
      box('Mayor flujo de caja', pick(x => x.r.R.flujo), x => U.eur(x.r.R.flujo)) + box('Mayor deuda', pick(x => x.deuda || null), x => U.eur(x.deuda)) +
      box('Mayor revalorización', pick(x => x.reval), x => U.eur(x.reval) + ' (' + U.pct(x.revalPct) + ')') + box('Mayor gasto anual', pick(x => x.r.R.gastos || null), x => U.eur(x.r.R.gastos)) + '</div>';
    const chart = (t, fn, fmt) => UI.card(t, UI.bars(rows.map(x => ({ l: x.v.nombre, v: fn(x) })).filter(i => i.v !== null).sort((a, b) => b.v - a.v), fmt));
    const tabla = UI.table('cmpT', [
      { k: 'n', l: 'Vivienda', v: x => x.v.nombre, f: x => V.vlink(x.v.id) },
      { k: 'ing', l: 'Ingresos', v: x => x.r.R.ingresos, f: x => U.eur(x.r.R.ingresos), cls: 'num' },
      { k: 'gas', l: 'Gastos', v: x => x.r.R.gastos, f: x => U.eur(x.r.R.gastos), cls: 'num' },
      { k: 'int', l: 'Intereses', v: x => x.r.R.intereses, f: x => U.eur(x.r.R.intereses), cls: 'num' },
      { k: 'ben', l: 'Beneficio', v: x => x.r.R.beneficio, f: x => V.signed(x.r.R.beneficio), cls: 'num' },
      { k: 'flu', l: 'Flujo de caja', v: x => x.r.R.flujo, f: x => V.signed(x.r.R.flujo), cls: 'num' },
      { k: 'bru', l: 'Rent. bruta', v: x => x.r.bruta, f: x => U.pct(x.r.bruta), cls: 'num' },
      { k: 'net', l: 'Rent. neta', v: x => x.r.neta, f: x => U.pct(x.r.neta), cls: 'num' },
      { k: 'roe', l: 'Rent. s/ capital aportado', v: x => x.r.roe, f: x => U.pct(x.r.roe), cls: 'num' },
      { k: 'deu', l: 'Deuda', v: x => x.deuda, f: x => U.eur(x.deuda), cls: 'num' },
      { k: 'rev', l: 'Revalorización', v: x => x.reval, f: x => x.reval === null ? '—' : V.signed(x.reval), cls: 'num' }
    ], rows);
    return V.filters(V.rentPerSel()) + '<p class="muted">Periodo: ' + U.esc(per.label) + '. Criterio de caja (cobros y pagos efectivos).</p>' + ranks + UI.card('Comparativa de todas las viviendas', tabla) +
      '<div class="cols-2">' + chart('Rentabilidad neta', x => x.r.neta, U.pct) + chart('Flujo de caja', x => x.r.R.flujo) + chart('Deuda pendiente', x => x.deuda) + chart('Revalorización', x => x.reval) + chart('Gasto del periodo', x => x.r.R.gastos) + chart('Rentabilidad bruta', x => x.r.bruta, U.pct) + '</div>';
  },
  historicoAnual() {
    const ys = V.anios();
    const a = V.f('cmpA', ys[1] || ys[0]), b = V.f('cmpB', ys[0]);
    const vid = V.f('viv', '');
    const RA = C.resumen(vid || null, a + '-01-01', a + '-12-31'), RB = C.resumen(vid || null, b + '-01-01', b + '-12-31');
    const vs = vid ? [C.viv(vid)] : C.vivs();
    const coste = U.sum(vs.map(C.costeTotal).filter(x => x !== null));
    const filas = [['Ingresos', 'ingresos'], ['  · Alquileres', 'ingAlquiler'], ['  · Agua repercutida', 'ingAgua'], ['  · Suministros repercutidos', 'ingSumin'], ['  · Otros ingresos', 'ingOtros'], ['Gastos operativos', 'gOperativo'], ['Reparaciones', 'gReparacion'], ['Gastos extraordinarios', 'gExtra'], ['Intereses hipotecarios', 'intereses'], ['Beneficio (ingresos − gastos − intereses)', 'beneficio'], ['Amortización de capital (no es gasto)', 'capital'], ['Cuotas hipotecarias pagadas', 'cuotas'], ['Flujo de caja (cash flow)', 'flujo'], ['Amortizaciones extraordinarias', 'amortExtra']];
    const t = '<div class="tbl-wrap"><table class="tbl cmp"><thead><tr><th>Concepto</th><th class="num">' + a + '</th><th class="num">' + b + '</th><th class="num">Variación</th></tr></thead><tbody>' +
      filas.map(([l, k]) => '<tr class="' + (['beneficio', 'flujo', 'ingresos'].includes(k) ? 'strong' : '') + '"><td data-label="">' + l.replace(/^ {2}/, '&nbsp;&nbsp;&nbsp;') + '</td><td class="num" data-label="' + a + '">' + U.eur(RA[k]) + '</td><td class="num" data-label="' + b + '">' + U.eur(RB[k]) + '</td><td class="num" data-label="Variación">' + V.signed(RB[k] - RA[k]) + (RA[k] ? ' <small>(' + U.pct((RB[k] - RA[k]) / Math.abs(RA[k]) * 100) + ')</small>' : '') + '</td></tr>').join('') +
      '<tr class="strong"><td data-label="">Rentabilidad neta (beneficio / coste adquisición)</td><td class="num" data-label="' + a + '">' + (coste ? U.pct(RA.beneficio / coste * 100) : '—') + '</td><td class="num" data-label="' + b + '">' + (coste ? U.pct(RB.beneficio / coste * 100) : '—') + '</td><td class="num" data-label="Variación">' + (coste ? U.pct((RB.beneficio - RA.beneficio) / coste * 100) + ' pts' : '—') + '</td></tr>' +
      '</tbody></table></div>';
    const meses = U.ymRange(b + '-01', b + '-12').map(ym => { const R = C.resumen(vid || null, ym + '-01', U.ymLast(ym)); return { x: ym, ing: R.ingresos, gas: R.gastos + R.cuotas, flu: R.flujo }; });
    return V.filters(V.sel('cmpA', ys.map(y => [y, y]), 'Ejercicio A', a) + V.sel('cmpB', ys.map(y => [y, y]), 'Ejercicio B', b) + V.vivSel()) +
      UI.card('Comparativa ' + a + ' vs ' + b + (vid ? ' · ' + U.esc(C.nomViv(vid)) : ' · toda la cartera'), t + (coste ? '' : '<p class="muted">' + INSUF + ' (rentabilidad: falta el coste de adquisición).</p>')) +
      UI.card('Evolución mensual ' + b, UI.line([{ name: 'Ingresos', pts: meses.map(m => ({ x: m.x, y: m.ing })) }, { name: 'Gastos + cuotas', pts: meses.map(m => ({ x: m.x, y: m.gas })) }, { name: 'Flujo de caja', pts: meses.map(m => ({ x: m.x, y: m.flu })) }]));
  },

  /* ======================= INFORMES E HISTÓRICO ======================= */
  informes(tabArg) {
    if (tabArg) App.st.tabs.inf = tabArg;
    const [tabs, t] = V.tabs('inf', [['informe', 'Informes'], ['historico', 'Histórico'], ['anual', 'Histórico anual']]);
    let body = '';
    if (t === 'informe') body = V.informeHtml();
    else if (t === 'historico') body = V.historicoHtml();
    else body = V.historicoAnual();
    return V.page('Informes', t === 'informe' ? UI.btn('🖨 Imprimir / PDF', 'print', {}, 'btn-primary') : (t === 'historico' ? UI.btn('Exportar CSV', 'csvMovs') : ''), tabs + body);
  },
  informeHtml() {
    const tipo = V.f('infTipo', 'mensual');
    const hoy = U.today();
    const ys = V.anios();
    let from, to, label;
    const ctrl = [V.sel('infTipo', [['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['anual', 'Anual'], ['vivienda', 'Por vivienda'], ['global', 'Global de cartera']], 'Informe', 'mensual')];
    if (tipo === 'mensual') {
      const ym = V.f('infYm', U.ym(hoy));
      ctrl.push(V.inp('infYm', 'month', 'Mes', U.ym(hoy)));
      from = ym + '-01'; to = U.ymLast(ym); label = U.cap(U.fmonth(ym));
    } else if (tipo === 'trimestral') {
      const y = V.f('infAnio', U.year(hoy)), q = +V.f('infQ', String(Math.floor((+hoy.slice(5, 7) - 1) / 3) + 1));
      ctrl.push(V.sel('infAnio', ys.map(x => [x, x]), 'Año', U.year(hoy)), V.sel('infQ', [['1', '1er trimestre'], ['2', '2º trimestre'], ['3', '3er trimestre'], ['4', '4º trimestre']], 'Trimestre', String(q)));
      from = y + '-' + U.z((q - 1) * 3 + 1) + '-01'; to = U.ymLast(y + '-' + U.z(q * 3)); label = q + 'º trimestre ' + y;
    } else {
      const y = V.f('infAnio', U.year(hoy));
      ctrl.push(V.sel('infAnio', ys.map(x => [x, x]), 'Año', U.year(hoy)));
      from = y + '-01-01'; to = y + '-12-31'; label = 'Año ' + y;
    }
    let vs = C.vivs();
    if (tipo === 'vivienda') {
      if (!vs.length) return UI.empty('No hay viviendas.');
      const vid = V.f('infViv', vs[0].id);
      ctrl.push(V.sel('infViv', vs.map(v => [v.id, v.nombre]), 'Vivienda', vs[0].id));
      vs = [C.viv(vid) || vs[0]];
    }
    const titulo = { mensual: 'Informe mensual', trimestral: 'Informe trimestral', anual: 'Informe anual', vivienda: 'Informe por vivienda', global: 'Informe global de cartera' }[tipo];
    const vids = vs.map(v => v.id);
    const one = vs.length === 1 && tipo === 'vivienda';
    const Rs = vs.map(v => ({ v, R: C.resumen(v.id, from, to) }));
    const T = C.resumen(one ? vs[0].id : null, from, to);
    const anual = ['anual', 'vivienda', 'global'].includes(tipo);
    const tablaRes = '<table class="tbl rep"><thead><tr><th>Vivienda</th><th class="num">Ingresos</th><th class="num">Gastos operativos</th><th class="num">Reparaciones</th><th class="num">Extraordinarios</th><th class="num">Intereses</th><th class="num">Beneficio</th><th class="num">Amort. capital</th><th class="num">Flujo de caja</th>' + (anual ? '<th class="num">Rent. neta</th>' : '') + '</tr></thead><tbody>' +
      Rs.map(({ v, R }) => { const c = C.costeTotal(v); return '<tr><td data-label="Vivienda">' + U.esc(v.nombre) + '</td><td class="num" data-label="Ingresos">' + U.eur(R.ingresos) + '</td><td class="num" data-label="Gastos operativos">' + U.eur(R.gOperativo) + '</td><td class="num" data-label="Reparaciones">' + U.eur(R.gReparacion) + '</td><td class="num" data-label="Extraordinarios">' + U.eur(R.gExtra) + '</td><td class="num" data-label="Intereses">' + U.eur(R.intereses) + '</td><td class="num" data-label="Beneficio">' + V.signed(R.beneficio) + '</td><td class="num" data-label="Amort. capital">' + U.eur(R.capital) + '</td><td class="num" data-label="Flujo de caja">' + V.signed(R.flujo) + '</td>' + (anual ? '<td class="num" data-label="Rent. neta">' + (c ? U.pct(R.beneficio / c * 100) : '—') + '</td>' : '') + '</tr>'; }).join('') +
      (one ? '' : '<tr class="strong"><td data-label="">TOTAL</td><td class="num" data-label="Ingresos">' + U.eur(T.ingresos) + '</td><td class="num" data-label="Gastos operativos">' + U.eur(T.gOperativo) + '</td><td class="num" data-label="Reparaciones">' + U.eur(T.gReparacion) + '</td><td class="num" data-label="Extraordinarios">' + U.eur(T.gExtra) + '</td><td class="num" data-label="Intereses">' + U.eur(T.intereses) + '</td><td class="num" data-label="Beneficio">' + V.signed(T.beneficio) + '</td><td class="num" data-label="Amort. capital">' + U.eur(T.capital) + '</td><td class="num" data-label="Flujo de caja">' + V.signed(T.flujo) + '</td>' + (anual ? '<td class="num" data-label="Rent. neta">' + (U.sum(vs.map(C.costeTotal).filter(x => x)) ? U.pct(T.beneficio / U.sum(vs.map(C.costeTotal).filter(x => x)) * 100) : '—') + '</td>' : '') + '</tr>') +
      '</tbody></table>';
    const mensual = anual ? '<h3>Evolución mensual</h3><table class="tbl rep"><thead><tr><th>Mes</th><th class="num">Ingresos</th><th class="num">Gastos</th><th class="num">Intereses</th><th class="num">Cuotas hipoteca</th><th class="num">Beneficio</th><th class="num">Flujo de caja</th></tr></thead><tbody>' +
      U.ymRange(U.ym(from), U.ym(to)).map(ym => { const R = C.resumen(one ? vs[0].id : null, ym + '-01', U.ymLast(ym)); return '<tr><td data-label="Mes">' + U.cap(U.fmonth(ym)) + '</td><td class="num" data-label="Ingresos">' + U.eur(R.ingresos) + '</td><td class="num" data-label="Gastos">' + U.eur(R.gastos) + '</td><td class="num" data-label="Intereses">' + U.eur(R.intereses) + '</td><td class="num" data-label="Cuotas">' + U.eur(R.cuotas) + '</td><td class="num" data-label="Beneficio">' + V.signed(R.beneficio) + '</td><td class="num" data-label="Flujo">' + V.signed(R.flujo) + '</td></tr>'; }).join('') + '</tbody></table>' : '';
    const pendAlq = DB.S.mensualidades.filter(m => vids.includes(m.viviendaId) && C.exigible(m) && C.pendM(m) > 0);
    const pendSum = DB.S.suministros.filter(s => vids.includes(s.viviendaId) && C.pendS(s) > 0);
    const pendGas = DB.S.gastos.filter(g => vids.includes(g.viviendaId) && !g.pagado && g.fecha <= U.addMonths(hoy, 1));
    const pendDer = DB.S.derramas.filter(d => vids.includes(d.viviendaId) && C.infoDerrama(d).importePendiente > 0);
    const pend = '<h3>Pagos pendientes (a ' + U.fdate(hoy) + ')</h3><ul class="rep-l">' +
      pendAlq.map(m => '<li>Alquiler ' + U.fmonth(m.mes) + ' · ' + U.esc(C.nomViv(m.viviendaId)) + ': <b>' + U.eur(C.pendM(m)) + '</b> (' + C.estadoM(m) + ')</li>').join('') +
      pendSum.map(s => '<li>' + SUMIN[s.tipo] + ' ' + U.esc(s.periodo || '') + ' · ' + U.esc(C.nomViv(s.viviendaId)) + ': <b>' + U.eur(C.pendS(s)) + '</b> (a cobrar al inquilino)</li>').join('') +
      pendGas.map(g => '<li>Gasto a pagar: ' + U.esc(g.concepto) + ' · ' + U.esc(C.nomViv(g.viviendaId)) + ' · ' + U.fdate(g.fecha) + ': <b>' + U.eur(g.importe) + '</b></li>').join('') +
      pendDer.map(d => '<li>Derrama ' + U.esc(d.concepto) + ' · ' + U.esc(C.nomViv(d.viviendaId)) + ': <b>' + U.eur(C.infoDerrama(d).importePendiente) + '</b> pendiente</li>').join('') +
      (pendAlq.length + pendSum.length + pendGas.length + pendDer.length ? '' : '<li>No hay pagos pendientes.</li>') + '</ul>';
    const hips = DB.S.hipotecas.filter(h => vids.includes(h.viviendaId));
    const hipHtml = '<h3>Evolución hipotecaria y capital pendiente</h3>' + (hips.length ? '<table class="tbl rep"><thead><tr><th>Préstamo</th><th class="num">Capital inicial</th><th class="num">Capital amortizado en el periodo</th><th class="num">Intereses del periodo</th><th class="num">Amort. extraordinarias periodo</th><th class="num">Capital pendiente actual</th><th>Cancelación estimada</th></tr></thead><tbody>' +
      hips.map(h => { const i = C.infoH(h); const cs = C.cuotasH(h.id).filter(q => U.inR(q.fechaPago || U.ymDay(q.mes, h.diaCargo), from, to)); const ae = C.amortsH(h.id).filter(a => U.inR(a.fecha, from, to)); return '<tr><td data-label="Préstamo">' + U.esc(C.nomViv(h.viviendaId) + ' · ' + (h.banco || '')) + '</td><td class="num" data-label="Capital inicial">' + U.eur(h.capitalInicial) + '</td><td class="num" data-label="Amortizado">' + U.eur(U.sum(cs, q => q.capital)) + '</td><td class="num" data-label="Intereses">' + U.eur(U.sum(cs, q => q.intereses)) + '</td><td class="num" data-label="Extra">' + U.eur(U.sum(ae, a => a.importe)) + '</td><td class="num" data-label="Pendiente"><b>' + U.eur(i.pendiente) + '</b></td><td data-label="Cancelación">' + (i.fin ? U.fmonth(i.fin) : '—') + '</td></tr>'; }).join('') + '</tbody></table>' : '<p>Sin hipotecas.</p>');
    const incs = DB.S.incidencias.filter(i => vids.includes(i.viviendaId) && (U.inR(i.fecha, from, to) || i.estado !== 'Resuelto'));
    const incHtml = '<h3>Incidencias</h3>' + (incs.length ? '<ul class="rep-l">' + incs.map(i => '<li>' + U.fdate(i.fecha) + ' · ' + U.esc(C.nomViv(i.viviendaId)) + ' · ' + U.esc(i.problema) + ' — ' + U.esc(i.estado) + (i.costeFinal ? ' · coste ' + U.eur(i.costeFinal) : '') + '</li>').join('') + '</ul>' : '<p>Sin incidencias en el periodo.</p>');
    const venc = DB.S.contratos.filter(c => vids.includes(c.viviendaId) && c.estado === 'activo').sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
    const vencHtml = '<h3>Vencimientos de contratos</h3>' + (venc.length ? '<ul class="rep-l">' + venc.map(c => '<li class="' + (C.vencido(c) ? 'li-vencido' : '') + '">' + (C.vencido(c) ? '<span class="tag vencido">VENCIDO</span> CONTRATO VENCIDO — ' : '') + U.esc(C.nomViv(c.viviendaId)) + ' · ' + U.esc(C.nomInq(c.inquilinoId)) + ' · vence ' + U.fdate(c.fechaVencimiento) + ' (' + C.estadoContrato(c) + (C.vencido(c) ? '' : ', faltan ' + C.diasRest(c) + ' días') + ')</li>').join('') + '</ul>' : '<p>Sin contratos activos.</p>');
    const fichaViv = one ? (() => {
      const v = vs[0]; const r = C.rentab(v, from, to); const c = C.contratoActivo(v.id); const val = C.valor(v);
      return '<h3>Datos de la vivienda</h3>' + UI.dl([['Dirección', U.esc([v.direccion, v.municipio, v.provincia].filter(Boolean).join(', '))], ['Estado', C.ESTADO_TXT[C.estadoViv(v)]], ['Inquilino', c ? U.esc(C.nomInq(c.inquilinoId)) : '—'], ['Renta actual', c ? U.eur(c.rentaActual) : '—'], ['Coste total de adquisición', U.eur(r.coste)], ['Valor actual', U.eur(val)], ['Deuda pendiente', U.eur(C.deudaTotal(v.id))], ['Patrimonio neto', val !== null ? U.eur(val - C.deudaTotal(v.id)) : '—'], ['Rentabilidad bruta', U.pct(r.bruta)], ['Rentabilidad neta', U.pct(r.neta)], ['Rentabilidad s/ capital aportado', U.pct(r.roe)]]);
    })() : '';
    return V.filters(ctrl.join('')) +
      '<article class="report"><header><h2>' + titulo + ' · ' + U.esc(label) + (one ? ' · ' + U.esc(vs[0].nombre) : '') + '</h2><p class="muted">Periodo: ' + U.fdate(from) + ' – ' + U.fdate(to) + ' · Generado el ' + U.fdate(hoy) + ' · Cifras calculadas exclusivamente con los datos introducidos (criterio de caja).</p></header>' +
      '<div class="kpis kpis-4">' + UI.kpi('Ingresos', U.eur(T.ingresos)) + UI.kpi('Gastos', U.eur(T.gastos)) + UI.kpi('Beneficio', V.signed(T.beneficio)) + UI.kpi('Flujo de caja', V.signed(T.flujo)) + '</div>' +
      fichaViv + '<h3>Resultado económico</h3><div class="tbl-wrap">' + tablaRes + '</div>' + mensual + pend + hipHtml + incHtml + vencHtml + '</article>';
  },
  histFiltrados() {
    const anio = V.f('hAnio', U.year(U.today())), mes = V.f('hMes', ''), vid = V.f('viv', ''), cat = V.f('hCat', '');
    let from = anio ? anio + '-01-01' : null, to = anio ? anio + '-12-31' : null;
    if (anio && mes) { from = anio + '-' + mes + '-01'; to = U.ymLast(anio + '-' + mes); }
    let list = C.movimientos(vid || null, from, to);
    const ev = [];
    const ok = x => (!vid || x.viviendaId === vid);
    const pushE = (fecha, vidd, cat2, concepto) => { if (U.inR(fecha, from, to) && (!mes || anio || fecha.slice(5, 7) === mes)) ev.push({ fecha, vid: vidd, tipo: 'evento', cat: cat2, concepto, importe: null }); };
    DB.S.contratos.filter(ok).forEach(c => {
      if (c.fechaFirma) pushE(c.fechaFirma, c.viviendaId, 'Contratos', 'Firma de contrato con ' + C.nomInq(c.inquilinoId));
      if (c.fechaFin) pushE(c.fechaFin, c.viviendaId, 'Contratos', 'Fin de contrato (' + (c.motivoFin || '') + ') — ' + C.nomInq(c.inquilinoId));
      (c.prorrogas || []).forEach(p => pushE(p.fecha, c.viviendaId, 'Contratos', 'Prórroga: vencimiento ' + U.fdate(p.anterior) + ' → ' + U.fdate(p.nuevo)));
      (c.cambiosVenc || []).forEach(p => pushE(p.fecha, c.viviendaId, 'Contratos', 'Modificación del vencimiento: ' + U.fdate(p.anterior) + ' → ' + U.fdate(p.nuevo)));
    });
    DB.S.inquilinos.filter(ok).forEach(i => { if (i.entrada) pushE(i.entrada, i.viviendaId, 'Inquilinos', 'Entrada de ' + i.nombre); if (i.salida) pushE(i.salida, i.viviendaId, 'Inquilinos', 'Salida de ' + i.nombre); });
    DB.S.rentas.filter(ok).forEach(r => pushE(r.fecha, r.viviendaId, 'Modificaciones de renta', 'Renta ' + U.eur(r.anterior) + ' → ' + U.eur(r.nueva) + (r.motivo ? ' (' + r.motivo + ')' : '')));
    DB.S.incidencias.filter(ok).forEach(i => pushE(i.fecha, i.viviendaId, 'Reparaciones', 'Incidencia: ' + i.problema + ' — ' + i.estado));
    DB.S.derramas.filter(ok).forEach(d => { if (d.fechaAprobacion) pushE(d.fechaAprobacion, d.viviendaId, 'Derramas', 'Aprobación de derrama: ' + d.concepto + ' (' + U.eur(d.total) + ')'); });
    if (mes && !anio) list = list.filter(m => m.fecha.slice(5, 7) === mes);
    list = list.concat(ev);
    const grupo = m => {
      if (m.tipo === 'evento') return m.cat;
      if (m.tipo === 'hipoteca') return 'Hipotecas';
      if (m.tipo === 'amortExtra') return 'Amortizaciones extraordinarias';
      if (m.tipo === 'ingreso') return { alquiler: 'Alquileres', agua: 'Agua', suministros: 'Suministros', otros: 'Otros ingresos' }[m.clase];
      if (m.cat === 'Agua') return 'Agua';
      if (Object.values(SUMIN).includes(m.cat)) return 'Suministros';
      if (/comunidad/i.test(m.cat)) return 'Comunidad';
      if (m.cat === 'Derramas') return 'Derramas';
      if (m.clase === 'reparacion') return 'Reparaciones';
      return 'Gastos';
    };
    list.forEach(m => { m.grupo = grupo(m); });
    if (cat) list = list.filter(m => m.grupo === cat);
    return list.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  },
  historicoHtml() {
    const list = V.histFiltrados();
    const cats = ['Alquileres', 'Agua', 'Suministros', 'Otros ingresos', 'Gastos', 'Comunidad', 'Derramas', 'Reparaciones', 'Hipotecas', 'Amortizaciones extraordinarias', 'Contratos', 'Inquilinos', 'Modificaciones de renta'];
    const ing = U.sum(list.filter(m => m.tipo === 'ingreso'), m => m.importe);
    const sal = U.sum(list.filter(m => ['gasto', 'hipoteca', 'amortExtra'].includes(m.tipo)), m => m.importe);
    return V.filters(V.anioSel('hAnio', 'Año', U.year(U.today())) + V.mesSel('hMes') + V.vivSel() + V.sel('hCat', [['', 'Todas'], ...cats], 'Categoría', '')) +
      '<div class="kpis kpis-3">' + UI.kpi('Entradas', U.eur(ing)) + UI.kpi('Salidas', U.eur(sal)) + UI.kpi('Saldo', V.signed(ing - sal)) + '</div>' +
      UI.table('histT', [
        { k: 'fecha', l: 'Fecha', f: r => U.fdate(r.fecha) },
        { k: 'viv', l: 'Vivienda', v: r => C.nomViv(r.vid), f: r => V.vlink(r.vid) },
        { k: 'grupo', l: 'Categoría' },
        { k: 'concepto', l: 'Concepto', f: r => U.esc(r.concepto) + (r.tipo === 'hipoteca' ? ' <small class="muted">(intereses ' + U.eur(r.intereses) + ' · capital ' + U.eur(r.capital) + ')</small>' : '') },
        { k: 'importe', l: 'Importe', v: r => r.importe === null ? null : (r.tipo === 'ingreso' ? r.importe : -r.importe), f: r => r.importe === null ? '—' : V.signed(r.tipo === 'ingreso' ? r.importe : -r.importe), cls: 'num' }
      ], list, { empty: 'Sin movimientos para estos filtros.', go: r => r.vid ? '#/vivienda/' + r.vid + '/historico' : '' });
  },

  /* ======================= ALERTAS / BUSCAR / MÁS ======================= */
  alertas() { const A = C.alertas(); return V.page('Pendiente de tu atención', '', V.alertList(A), A.length + ' avisos ordenados por prioridad'); },
  buscar(q) {
    q = decodeURIComponent(q || '');
    const res = q ? C.buscar(q) : [];
    const grupos = {};
    res.forEach(r => { (grupos[r.tipo] = grupos[r.tipo] || []).push(r); });
    return V.page('Buscar', '', '<form class="search-big" data-search="1"><input type="search" name="q" value="' + U.esc(q) + '" placeholder="Ej.: caldera, 2026, nombre del inquilino…" autofocus><button class="btn btn-primary">Buscar</button></form>' +
      (q ? '<p class="muted">' + res.length + ' resultados para «' + U.esc(q) + '»</p>' + Object.entries(grupos).map(([t, l]) => UI.card(t + ' (' + l.length + ')', '<ul class="res">' + l.slice(0, 200).map(r => '<li data-go="' + r.go + '"><div><b>' + U.esc(r.titulo) + '</b><small>' + U.esc(r.sub || '') + '</small></div><span>' + (r.fecha ? U.fdate(r.fecha) : '') + (r.importe ? '<br><b>' + U.eur(r.importe) + '</b>' : '') + '</span></li>').join('') + '</ul>')).join('') : ''));
  },
  mas() {
    const items = [['#/resumen', '📊', 'Resumen'], ['#/inmuebles', '🏠', 'Inmuebles'], ['#/alquileres', '💶', 'Alquileres'], ['#/gastos', '🧾', 'Gastos'], ['#/agua', '💧', 'Agua y suministros'], ['#/hipotecas', '🏦', 'Hipotecas'], ['#/amortizaciones', '📉', 'Amortizaciones'], ['#/calendario', '📅', 'Calendario'], ['#/rentabilidad', '📈', 'Rentabilidad'], ['#/informes', '📄', 'Informes'], ['#/alertas', '🔔', 'Alertas'], ['#/buscar', '🔎', 'Buscar'], ['#/config', '⚙️', 'Configuración']];
    return V.page('Más', '', '<div class="more-grid">' + items.map(([h, i, l]) => '<a href="' + h + '" class="more-i"><span>' + i + '</span>' + l + '</a>').join('') + '</div>');
  },
  bienvenidaHtml() {
    return '<div class="welcome"><h2>Bienvenido a Control de Alquileres</h2><p>Todo se guarda <b>solo en este dispositivo</b>; no hay cuentas ni servidores. Haga copias de seguridad periódicas (Configuración).</p>' +
      '<div class="w-acts">' + UI.btn('＋ Crear mi primera vivienda', 'vivienda', {}, 'btn-primary btn-lg') + UI.btn('Ver datos de EJEMPLO', 'cargarDemo', {}, 'btn-lg') + UI.btn('Importar una copia', 'importar', {}, 'btn-lg') + '</div>' +
      '<p class="muted small">Los datos de ejemplo son ficticios, aparecen marcados como «[EJEMPLO]» y se eliminan con un botón desde Configuración.</p></div>';
  },

  /* ======================= CONFIGURACIÓN ======================= */
  config() {
    const c = DB.cfg;
    const nDemo = DB.S.viviendas.filter(v => v.demo).length;
    const tot = STORES.reduce((a, s) => a + DB.S[s].length, 0);
    const docBytes = U.sum(DB.S.documentos, d => d.size) + U.sum(DB.S.viviendas, v => v.foto ? v.foto.length * 0.75 : 0);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return V.page('Configuración', '',
      UI.card('Copia de seguridad', '<p>La información se guarda únicamente en este navegador y dispositivo. Para pasar los datos de <b>Android a Windows</b> (o al revés) exporte la copia en un dispositivo e impórtela en el otro (por correo, Drive, WhatsApp, cable USB…).</p>' +
        UI.dl([['Última copia exportada', c.ultimaCopia ? U.fdate(c.ultimaCopia.slice(0, 10)) + ' ' + c.ultimaCopia.slice(11, 16) : '<b class="neg">Nunca</b>'], ['Registros guardados', tot], ['Documentos y fotos', U.size(docBytes)], ['Almacenamiento', DB.mode === 'idb' ? 'IndexedDB' + (DB.persistente ? ' (persistente)' : '') : 'localStorage (modo alternativo)']]) +
        '<div class="big-acts">' + UI.btn('⬇ EXPORTAR COPIA DE SEGURIDAD', 'exportar', {}, 'btn-primary btn-lg') + UI.btn('⬆ IMPORTAR COPIA DE SEGURIDAD', 'importar', {}, 'btn-lg') + (navigator.share ? UI.btn('📤 Compartir copia', 'compartir', {}, 'btn-lg') : '') + '</div>') +
      UI.card('Avisos y cálculos',
        '<div class="grid-f">' +
        '<div class="fld"><label for="cfg-plazos">Avisos de vencimiento de contrato (días, separados por comas)</label><input id="cfg-plazos" value="' + U.esc((c.plazos || []).join(', ')) + '"><small class="help">Por defecto 180, 90, 30 (≈ 6, 3 y 1 mes). «Próximo a vencer» se aplica desde el plazo mayor.</small></div>' +
        '<div class="fld"><label for="cfg-gracia">Días de cortesía antes de marcar un alquiler como impagado</label><input id="cfg-gracia" type="number" min="0" value="' + U.esc(c.gracia) + '"></div>' +
        '<div class="fld"><label for="cfg-seguro">Aviso de seguros próximos (días)</label><input id="cfg-seguro" type="number" min="1" value="' + U.esc(c.seguroDias) + '"></div>' +
        '<div class="fld"><label for="cfg-revision">Aviso de revisión de renta (días)</label><input id="cfg-revision" type="number" min="1" value="' + U.esc(c.revisionDias) + '"></div>' +
        '<div class="fld"><label for="cfg-copia">Recordar copia de seguridad cada (días)</label><input id="cfg-copia" type="number" min="1" value="' + U.esc(c.avisoCopiaDias) + '"></div>' +
        '<div class="fld chk-fld"><label class="chk"><input type="checkbox" id="cfg-prorrateo"' + (c.prorrateo ? ' checked' : '') + '> <span>Prorratear la primera y la última mensualidad del contrato</span></label></div>' +
        '</div><div class="form-actions">' + UI.btn('Guardar configuración', 'cfgGuardar', {}, 'btn-primary') + '</div>') +
      UI.card('Categorías de gasto personalizadas', '<div class="chips">' + ((c.catPers || []).length ? c.catPers.map(x => '<span class="chip on">' + U.esc(x) + ' <button type="button" class="x" data-act="delCat" data-cat="' + U.esc(x) + '" aria-label="Eliminar">✕</button></span>').join('') : '<span class="muted">Ninguna.</span>') + '</div>' +
        '<div class="inline-add"><input id="cfg-newcat" placeholder="Nueva categoría (ej.: Jardinería)"><button type="button" class="btn" data-act="addCat">Añadir</button></div><p class="muted small">Categorías fijas: ' + CAT_GASTO.join(', ') + '.</p>') +
      UI.card('Datos de ejemplo', '<p>' + (nDemo ? 'Hay <b>' + nDemo + '</b> viviendas de EJEMPLO cargadas (datos ficticios).' : 'No hay datos de ejemplo cargados.') + '</p><div class="big-acts">' + (nDemo ? UI.btn('Eliminar datos de ejemplo', 'borrarDemo', {}, 'btn-danger-o') : UI.btn('Cargar datos de EJEMPLO', 'cargarDemo')) + '</div>') +
      UI.card('Instalar como aplicación', '<p>' + (standalone ? '✔ Está usando la aplicación instalada.' : App.installEvt ? 'Este navegador permite instalarla.' : 'En <b>Android (Chrome)</b>: menú ⋮ → «Instalar aplicación» o «Añadir a pantalla de inicio». En <b>Windows (Edge/Chrome)</b>: icono de instalar en la barra de direcciones o menú → «Aplicaciones» → «Instalar». Requiere abrir la aplicación desde una dirección http(s) (consulte LEEME.txt).') + '</p>' +
        (App.installEvt ? UI.btn('Instalar aplicación', 'instalar', {}, 'btn-primary') : '') + '<p class="muted small">Modo sin conexión: ' + ('serviceWorker' in navigator && location.protocol !== 'file:' ? (navigator.serviceWorker.controller ? '✔ activo' : 'se activará en la próxima apertura') : 'no disponible al abrir como archivo local (file://); la aplicación funciona igualmente sin Internet.') + '</p>') +
      UI.card('Zona de peligro', '<p>Borra todos los datos guardados en este dispositivo.</p>' + UI.btn('Borrar todos los datos', 'borrarTodo', {}, 'btn-danger')) +
      UI.card('Acerca de', '<p><b>Control de Alquileres e Inversiones Inmobiliarias</b> · versión 1.0<br>Aplicación local para pequeños propietarios. Sin cuentas, sin servidores, sin envío de datos.</p><p class="muted small">Criterios de cálculo: rentabilidad bruta = alquiler anual / coste total de adquisición; neta = (ingresos − gastos − intereses) / coste total; flujo de caja = cobros − pagos − cuotas hipotecarias. La amortización de capital no se considera gasto. Las cifras dependen exclusivamente de los datos introducidos.</p>'));
  }
};
