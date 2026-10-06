'use strict';
/* Ficha de cada vivienda: 16 pestañas. Cada vivienda es una unidad económica independiente. */

const FICHA_TABS = [['resumen', 'Resumen'], ['compra', 'Compra'], ['inquilino', 'Inquilino'], ['contrato', 'Contrato'], ['alquileres', 'Alquileres'],
  ['suministros', 'Agua y suministros'], ['gastos', 'Gastos'], ['comunidad', 'Comunidad'], ['derramas', 'Derramas'], ['hipoteca', 'Hipoteca'],
  ['amortizaciones', 'Amortizaciones'], ['incidencias', 'Reparaciones e incidencias'], ['documentos', 'Documentos'], ['rentabilidad', 'Rentabilidad'],
  ['historico', 'Histórico'], ['notas', 'Notas']];

const Ficha = {
  render(id, tab) {
    const v = C.viv(id);
    if (!v) return V.page('Vivienda no encontrada', '', UI.empty('La vivienda no existe o ha sido eliminada.', '<a class="btn" href="#/inmuebles">Volver a inmuebles</a>'));
    tab = FICHA_TABS.some(t => t[0] === tab) ? tab : 'resumen';
    const c = C.contratoActivo(v.id);
    const e = C.estadoViv(v);
    const head = '<div class="ficha-h">' + (v.foto ? '<div class="fh-img" style="background-image:url(' + v.foto + ')"></div>' : '<div class="fh-img ph">🏠</div>') +
      '<div class="fh-t"><a href="#/inmuebles" class="back">‹ Inmuebles</a><h1>' + U.esc(v.nombre) + ' ' + UI.st(e) + (v.demo ? ' ' + UI.tag('EJEMPLO', 'info') : '') + '</h1>' +
      '<p class="muted">' + U.esc([v.direccion, v.municipio, v.provincia].filter(Boolean).join(', ') || 'Sin dirección') + (v.ref ? ' · Ref. ' + U.esc(v.ref) : '') + '</p></div>' +
      '<div class="page-a">' + UI.btn('✎ Editar', 'vivienda', { id: v.id }) + UI.btn('🗑', 'delVivienda', { id: v.id }, 'btn-danger-o') + '</div></div>' +
      (c && C.vencido(c) ? UI.vencidoBanner(c) : '');
    const tabs = '<div class="tabs ficha-tabs" role="tablist">' + FICHA_TABS.map(([k, l]) => '<a role="tab" class="tab' + (k === tab ? ' on' : '') + '" href="#/vivienda/' + v.id + '/' + k + '">' + l + '</a>').join('') + '</div>';
    return head + tabs + '<div class="ficha-b">' + Ficha[tab](v) + '</div>';
  },

  /* 1. RESUMEN — panel individual */
  resumen(v) {
    const hoy = U.today(), ym = U.ym(hoy), y = U.year(hoy);
    const c = C.contratoActivo(v.id);
    const coste = C.costeTotal(v), val = C.valor(v);
    const Rm = C.resumen(v.id, ym + '-01', U.ymLast(ym));
    const Ry = C.resumen(v.id, y + '-01-01', y + '-12-31');
    const w = C.ventana12();
    const r = C.rentab(v, w.from, w.to);
    const hs = C.byViv('hipotecas', v.id);
    const ini = U.sum(hs, h => h.capitalInicial), pend = C.deudaTotal(v.id);
    const fins = hs.map(h => C.infoH(h).fin).filter(Boolean).sort();
    const prox = C.proximoVencimiento(v.id);
    const dias = c ? C.diasRest(c) : null;
    const vac = C.vacancia(v);
    const items = [
      ['Precio de compra', U.eur(v.compra && v.compra.precio)], ['Coste total de adquisición', U.eur(coste)], ['Valor actual', U.eur(val)],
      ['Inquilino', c ? U.esc(C.nomInq(c.inquilinoId)) : '—'], ['Fecha de contrato', c ? U.fdate(c.fechaInicio) : '—'],
      ['Fecha de vencimiento', c ? U.fdate(c.fechaVencimiento) : '—', c && C.vencido(c) ? 'dl-vencido' : ''], ['Estado del contrato', c ? UI.st(C.estadoContrato(c)) : '—', c && C.vencido(c) ? 'dl-vencido' : ''],
      ['Días restantes', dias === null ? '—' : (dias < 0 ? '<b class="neg">Vencido hace ' + (-dias) + ' días</b>' : dias)],
      ['Alquiler mensual', c ? U.eur(c.rentaActual) : '—'], ['Alquiler anual', c ? U.eur(c.rentaActual * 12) : '—'],
      ['Cobrado este mes', U.eur(Rm.ingAlquiler)], ['Pendiente (alquiler)', V.money(C.pendienteAlquiler(v.id), C.pendienteAlquiler(v.id) > 0 ? 'neg b' : '')],
      ['Agua pendiente', U.eur(C.aguaPendiente(v.id))], ['Gastos del mes', U.eur(Rm.gastos)], ['Gastos del año ' + y, U.eur(Ry.gastos)],
      ['Beneficio año ' + y, V.signed(Ry.beneficio)], ['Flujo de caja año ' + y, V.signed(Ry.flujo)],
      ['Rentabilidad bruta', U.pct(r.bruta)], ['Rentabilidad neta (12 m)', U.pct(r.neta)],
      ['Capital hipotecario inicial', hs.length ? U.eur(ini) : 'Sin hipoteca'], ['Capital pendiente', hs.length ? U.eur(pend) : '—'],
      ['Porcentaje amortizado', ini ? U.pct((ini - pend) / ini * 100) : '—'], ['Fecha estimada de cancelación', fins.length ? U.cap(U.fmonth(fins[fins.length - 1])) : '—'],
      ['Patrimonio neto', val !== null ? '<b>' + U.eur(val - pend) + '</b>' : '<span class="muted small">' + INSUF + '</span>'],
      ['Próximo vencimiento', prox ? U.fdate(prox.f) + ' · ' + U.esc(prox.tipo) + '<br><small>' + U.esc(prox.t) + '</small>' : '—']
    ];
    const resMes = UI.card('Resultado real del mes · ' + U.fmonth(ym), UI.dl([['Ingresos cobrados', U.eur(Rm.ingresos)], ['Gastos', U.eur(Rm.gastos)], ['Cuota hipotecaria', U.eur(Rm.cuotas)], ['Flujo de caja', V.signed(Rm.flujo), 'tot']]) + '<p class="muted small">Dinero efectivo que deja la vivienda este mes.</p>');
    const vacHtml = vac ? UI.card('Vivienda VACÍA', vac.desde ? UI.dl([['Vacía desde', U.fdate(vac.desde)], ['Días vacía', vac.dias], ['Meses vacía', vac.meses.toFixed(1).replace('.', ',')], ['Último alquiler', U.eur(vac.ultimo)], ['Alquiler previsto', U.eur(vac.previsto)], ['Ingresos dejados de percibir', vac.dejados !== null ? U.eur(vac.dejados) : INSUF], ['Gastos durante el periodo vacío', U.eur(vac.gastos)], ['Coste de vacancia', vac.coste !== null ? '<b class="neg">' + U.eur(vac.coste) + '</b>' : INSUF, 'tot']]) +
      '<p class="muted small">Coste de vacancia = ingresos dejados de percibir (alquiler previsto × meses vacía) + gastos soportados en el periodo. Las cuotas hipotecarias del periodo (' + U.eur(vac.cuotas) + ') se muestran aparte.</p>' : '<p>' + INSUF + ' Indique la fecha desde la que está vacía.</p>', UI.btn('Datos de vacancia', 'vacia', { vid: v.id }, 'btn-sm'), 'card-warn') : '';
    const A = C.alertas(v.id);
    return '<div class="quick-grid compact">' + V.quickButtons(v.id) + '</div>' + vacHtml +
      '<div class="cols-2">' + UI.card('Panel de la vivienda', UI.dl(items)) + '<div>' + resMes + UI.card('Pendiente de atención', V.alertList(A, 6)) + '</div></div>';
  },

  /* 2. COMPRA, VALOR Y PATRIMONIO */
  compra(v) {
    const c = v.compra || {};
    const fields = [{ k: 'fecha', l: 'Fecha de compra', t: 'date' }, ...COMPRA.map(([k, l]) => ({ k, l, t: 'money', req: k === 'precio' })),
      { t: 'calc', k: 'total' },
      { t: 'section', l: 'Valor actual y capital aportado' },
      { k: 'valorActual', l: 'Valor actual estimado', t: 'money' }, { k: 'valorFecha', l: 'Fecha de la estimación', t: 'date' },
      { k: 'valorFuente', l: 'Fuente de la estimación', ph: 'Tasación, portal inmobiliario, estimación propia…', full: true },
      { k: 'capitalAportado', l: 'Capital realmente aportado (opcional)', t: 'money', help: 'Si lo deja vacío: coste total − capital inicial de las hipotecas (' + U.eur(C.prestamoInicial(v.id)) + ').' },
      { k: 'alquilerPrevisto', l: 'Alquiler previsto (si está vacía)', t: 'money' }];
    const html = UI.formHtml({
      inline: true, values: Object.assign({}, c, { valorActual: v.valorActual, valorFecha: v.valorFecha, valorFuente: v.valorFuente, capitalAportado: v.capitalAportado, alquilerPrevisto: v.alquilerPrevisto }), fields, submit: 'Guardar datos de compra',
      onChange: (x, form) => {
        const tot = U.sum(COMPRA, ([k]) => x[k] || 0);
        UI.setCalc(form, 'total', '<div class="formula"><div class="f-t">COSTE TOTAL DE ADQUISICIÓN</div><code>Precio de compra + impuestos (ITP / IVA / otros) + notaría + registro + gestoría + agencia + reformas + mobiliario + electrodomésticos + otros gastos</code>' +
          '<div class="f-vals">' + COMPRA.map(([k, l]) => '<div><span>' + l + '</span><b>' + U.eur(x[k] || 0) + '</b></div>').join('') + '</div><div class="f-res">= ' + U.eur(tot) + '</div></div>');
      },
      onSubmit: async x => {
        v.compra = { fecha: x.fecha };
        COMPRA.forEach(([k]) => { v.compra[k] = x[k]; });
        v.valorActual = x.valorActual; v.valorFecha = x.valorFecha; v.valorFuente = x.valorFuente; v.capitalAportado = x.capitalAportado; v.alquilerPrevisto = x.alquilerPrevisto;
        await DB.put('viviendas', v);
      }
    });
    return '<div class="cols-2"><div>' + UI.card('Datos de compra', html) + '</div><div>' + Ficha.valorHtml(v) + '</div></div>';
  },
  valorHtml(v) {
    const coste = C.costeTotal(v), val = C.valor(v), pend = C.deudaTotal(v.id);
    const miss = [];
    if (coste === null) miss.push('precio de compra');
    if (val === null) miss.push('valor actual');
    return UI.card('Valor actual y revalorización',
      UI.dl([['Precio de compra', U.eur(v.compra && v.compra.precio)], ['Coste total de adquisición', U.eur(coste)], ['Valor actual', U.eur(val) + (v.valorFecha ? ' <small>(' + U.fdate(v.valorFecha) + (v.valorFuente ? ', ' + U.esc(v.valorFuente) : '') + ')</small>' : '')]]) +
      UI.formula('REVALORIZACIÓN', 'Valor actual − coste total de adquisición', [['Valor actual', U.eur(val)], ['Coste total', U.eur(coste)], ['Porcentaje', coste && val !== null ? U.pct((val - coste) / coste * 100) : '—']], val !== null && coste !== null ? V.signed(val - coste) : '', miss) +
      UI.formula('PATRIMONIO NETO ESTIMADO', 'Valor actual − capital hipotecario pendiente', [['Valor actual', U.eur(val)], ['Capital pendiente', U.eur(pend)]], val !== null ? '<b>' + U.eur(val - pend) + '</b>' : '', val === null ? ['valor actual'] : []));
  },

  /* 3. INQUILINO */
  inquilino(v) {
    const c = C.contratoActivo(v.id);
    const act = c ? C.inq(c.inquilinoId) : null;
    const actual = act ? UI.card('Inquilino actual', UI.dl([['Nombre', '<b>' + U.esc(act.nombre) + '</b>'], ['Teléfono', act.telefono ? '<a href="tel:' + U.esc(act.telefono) + '">' + U.esc(act.telefono) + '</a>' : '—'], ['Correo electrónico', act.email ? '<a href="mailto:' + U.esc(act.email) + '">' + U.esc(act.email) + '</a>' : '—'], ['Fecha de entrada', U.fdate(act.entrada)], ['Fecha de salida', U.fdate(act.salida)], ['Número de ocupantes', act.ocupantes || '—'], ['Observaciones', U.esc(act.obs || '')]]), UI.ibtn('✎', 'Editar', 'inquilino', { id: act.id }))
      : UI.card('Inquilino actual', '<p>No hay inquilino con contrato activo. Para alquilar la vivienda registre un contrato.</p>' + UI.btn('＋ Registrar contrato', 'contrato', { vid: v.id }, 'btn-primary'));
    return actual + UI.card('Histórico de inquilinos', '<p class="muted small">Los antiguos inquilinos nunca se borran automáticamente.</p>' + V.tablaInquilinos('inqV', C.byViv('inquilinos', v.id), false), UI.btn('＋ Inquilino', 'inquilino', { vid: v.id }, 'btn-sm'));
  },

  /* 4. CONTRATO */
  contrato(v) {
    const c = C.contratoActivo(v.id);
    let act;
    if (c) {
      const est = C.estadoContrato(c);
      const venc = C.vencido(c);
      act = UI.card('Contrato actual ' + UI.st(est),
        UI.dl([['Inquilino', '<b>' + U.esc(C.nomInq(c.inquilinoId)) + '</b>'], ['Fecha de firma', U.fdate(c.fechaFirma)], ['Fecha de inicio efectivo', U.fdate(c.fechaInicio)],
          ['Fecha de vencimiento', (venc ? '<span class="tag vencido">VENCIDO</span> ' : '') + '<b>' + U.fdate(c.fechaVencimiento) + '</b>', venc ? 'dl-vencido' : ''],
          ['Días restantes', venc ? 'Vencido hace ' + (-C.diasRest(c)) + ' días' : C.diasRest(c)],
          ['Renta mensual inicial', U.eur(c.rentaInicial)], ['Renta mensual actual', '<b>' + U.eur(c.rentaActual) + '</b>'], ['Día habitual de pago', c.diaPago], ['Fianza', U.eur(c.fianza)],
          ['Garantías adicionales', U.esc(c.garantias || '—')], ['Forma de pago', U.esc(c.formaPago || '—')], ['Cuenta bancaria', U.esc(c.cuenta || '—')],
          ['Próxima revisión de renta', U.fdate(c.proximaRevision)], ['Criterio de actualización', U.esc(c.indice || '—')], ['Observaciones', U.esc(c.obs || '')],
          ['Total pendiente del inquilino', V.money(C.pendienteAlquiler(v.id, c.id), C.pendienteAlquiler(v.id, c.id) > 0 ? 'neg b' : '')]]) +
        ((c.prorrogas || []).length ? '<div class="sub-h">Prórrogas</div><ul class="plist">' + c.prorrogas.map(p => '<li>' + U.fdate(p.fecha) + ': vencimiento ' + U.fdate(p.anterior) + ' → <b>' + U.fdate(p.nuevo) + '</b>' + (p.obs ? ' · ' + U.esc(p.obs) : '') + '</li>').join('') + '</ul>' : '') +
        ((c.cambiosVenc || []).length ? '<div class="sub-h">Modificaciones de la fecha de vencimiento</div><ul class="plist">' + c.cambiosVenc.map(p => '<li>' + U.fdate(p.fecha) + ': ' + U.fdate(p.anterior) + ' → <b>' + U.fdate(p.nuevo) + '</b></li>').join('') + '</ul>' : '') +
        '<div class="btn-row">' + UI.btn('Renovación / prórroga', 'renovar', { id: c.id }, 'btn-primary') + UI.btn('Actualizar renta', 'actualizarRenta', { id: c.id }) + UI.btn('Editar contrato', 'contrato', { id: c.id, vid: v.id }) + UI.btn('Finalizar contrato', 'finalizar', { id: c.id }, 'btn-danger-o') + UI.btn('＋ Nuevo contrato', 'contrato', { vid: v.id }) + '</div>');
    } else act = UI.card('Contrato actual', '<p>No hay contrato activo.</p>' + UI.btn('＋ Registrar nuevo contrato', 'contrato', { vid: v.id }, 'btn-primary'));
    const rentas = C.byViv('rentas', v.id);
    const evo = [];
    C.contratos(v.id).slice().reverse().forEach(k => {
      evo.push({ x: U.ym(k.fechaInicio), y: +k.rentaInicial });
      C.rentasDe(k.id).forEach(r => evo.push({ x: U.ym(r.fecha), y: +r.nueva }));
    });
    evo.push({ x: U.ym(U.today()), y: c ? +c.rentaActual : (evo.length ? evo[evo.length - 1].y : 0) });
    const dedup = Object.values(evo.reduce((a, p) => { a[p.x] = p; return a; }, {}));
    return act + UI.card('Histórico de contratos', V.tablaContratos('contV', C.contratos(v.id), false)) +
      UI.card('Actualizaciones de renta', V.tablaRentas('rentV', rentas, false) + (dedup.length > 1 ? '<div class="sub-h">Evolución del alquiler</div>' + UI.line([{ name: 'Renta mensual', pts: dedup }]) : ''));
  },

  /* 5. ALQUILERES */
  alquileres(v) {
    const anio = V.f('fAlqV', '');
    const ms = C.mensualidades(v.id).filter(m => (!anio || U.year(m.mes) === anio) && m.mes <= U.ymAdd(U.ym(U.today()), 2));
    const pend = C.pendienteAlquiler(v.id);
    const c = C.contratoActivo(v.id);
    return '<div class="kpis kpis-3">' + UI.kpi('TOTAL PENDIENTE DEL INQUILINO', U.eur(pend), C.pendientesLista(v.id).filter(C.exigible).length + ' mensualidades', pend > 0 ? 'k-danger' : 'k-ok') +
      UI.kpi('Cobrado este año', U.eur(C.resumen(v.id, U.year(U.today()) + '-01-01', U.today()).ingAlquiler)) + UI.kpi('Renta actual', c ? U.eur(c.rentaActual) : '—') + '</div>' +
      V.filters(V.anioSel('fAlqV', 'Año', '') + '<span class="sp"></span>' + UI.btn('💶 Cobrar', 'cobrar', { vid: v.id }, 'btn-primary') + (c ? UI.btn('＋ Mes manual', 'mensualidad', { vid: v.id }) : '')) +
      '<p class="muted small">Los meses se crean automáticamente según el contrato (se muestran hasta dos meses adelante). Para registrar pagos parciales indique un importe menor al pendiente.</p>' +
      V.tablaMensualidades('mV', ms, false);
  },

  /* 6. AGUA Y SUMINISTROS */
  suministros(v) {
    const agua = DB.S.suministros.filter(s => s.viviendaId === v.id && s.tipo === 'agua');
    const otros = DB.S.suministros.filter(s => s.viviendaId === v.id && s.tipo !== 'agua');
    return '<div class="kpis kpis-3">' + UI.kpi('AGUA PENDIENTE DE COBRO', U.eur(C.aguaPendiente(v.id)), '', C.aguaPendiente(v.id) > 0 ? 'k-warn' : 'k-ok') + UI.kpi('Otros suministros pendientes', U.eur(C.suminPendiente(v.id))) + '</div>' +
      UI.card('💧 Agua · histórico', V.tablaSumin('agV', agua, false, false), UI.btn('＋ Registrar agua', 'suministro', { vid: v.id, tipo: 'agua' }, 'btn-sm btn-primary')) +
      UI.card('⚡ Electricidad, gas, caldera y otros', '<p class="muted small">Se diferencia el coste soportado por el propietario y el importe repercutido al inquilino.</p>' + V.tablaSumin('suV', otros, false, true), UI.btn('＋ Suministro', 'suministro', { vid: v.id, tipo: 'electricidad' }, 'btn-sm'));
  },

  /* 7. GASTOS */
  gastos(v) {
    const anio = V.f('fGasV', U.year(U.today()));
    const list = DB.S.gastos.filter(g => g.viviendaId === v.id && (!anio || U.year(g.fecha) === anio));
    const R = C.resumen(v.id, anio ? anio + '-01-01' : null, anio ? anio + '-12-31' : null);
    return V.filters(V.anioSel('fGasV', 'Año', U.year(U.today())) + '<span class="sp"></span>' + UI.btn('＋ Añadir gasto', 'gasto', { vid: v.id }, 'btn-primary')) +
      '<div class="kpis kpis-4">' + UI.kpi('Gastos operativos', U.eur(R.gOperativo)) + UI.kpi('Reparaciones', U.eur(R.gReparacion)) + UI.kpi('Extraordinarios', U.eur(R.gExtra)) + UI.kpi('Pendiente de pago', U.eur(U.sum(list.filter(g => !g.pagado), g => g.importe))) + '</div>' +
      '<p class="muted small">Los totales incluyen facturas de suministros pagadas por el propietario y cuotas de derramas pagadas.</p>' + V.tablaGastos('gV', list, false);
  },
  comunidad(v) { return V.comunidadHtml(v.id); },
  derramas(v) { return '<div class="btn-row">' + UI.btn('＋ Nueva derrama', 'derrama', { vid: v.id }, 'btn-primary') + '</div>' + V.derramasHtml(v.id); },

  /* 10. HIPOTECA */
  hipoteca(v) {
    const hs = C.byViv('hipotecas', v.id);
    return '<div class="btn-row">' + UI.btn('＋ Nueva hipoteca', 'hipoteca', { vid: v.id }, hs.length ? '' : 'btn-primary') + '<a class="btn" href="#/hipotecas/sim">Simulador</a></div>' +
      (hs.length ? hs.map(h => V.hipotecaCard(h, false, true)).join('') : UI.empty('Esta vivienda no tiene hipoteca registrada.')) +
      '<div class="note">La <b>amortización de capital</b> no es un gasto económico (aumenta su patrimonio). Los <b>intereses</b> sí son coste financiero. La <b>cuota completa</b> se descuenta del flujo de caja.</div>';
  },
  amortizaciones(v) {
    return '<div class="btn-row">' + UI.btn('📉 Nueva amortización extraordinaria', 'amortizacion', { hid: (C.byViv('hipotecas', v.id).find(h => !C.infoH(h).cancelada) || {}).id || '' }, 'btn-primary') + '</div>' +
      V.tablaAmort('amV', DB.S.amortizaciones.filter(a => a.viviendaId === v.id).sort((a, b) => b.fecha.localeCompare(a.fecha)), false);
  },
  incidencias(v) { return '<div class="btn-row">' + UI.btn('🔧 Nueva incidencia', 'incidencia', { vid: v.id }, 'btn-primary') + '</div>' + V.incidenciasHtml(v.id, ''); },

  /* 13. DOCUMENTOS */
  documentos(v) {
    const docs = DB.S.documentos.filter(d => d.viviendaId === v.id).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const tipos = TIPOS_DOC.map(t => [t, docs.filter(d => d.tipo === t)]);
    return '<div class="btn-row">' + UI.btn('＋ Añadir documento', 'documento', { vid: v.id }, 'btn-primary') + '</div>' +
      '<p class="muted small">Los archivos se guardan dentro de la aplicación, en este dispositivo, y se incluyen en la copia de seguridad. Total: ' + U.size(U.sum(docs, d => d.size)) + '.</p>' +
      '<div class="doc-grid">' + tipos.map(([t, l]) => '<div class="doc-f"><div class="doc-h"><b>📁 ' + t + '</b><span class="muted">' + l.length + '</span>' + UI.ibtn('＋', 'Añadir a ' + t, 'documento', { vid: v.id, tipo: t }, 'xs') + '</div>' +
        (l.length ? '<ul class="docs">' + l.map(d => '<li><button type="button" class="lnk-btn" data-act="verDoc" data-id="' + d.id + '">' + (/^image/.test(d.mime || '') ? '🖼' : /pdf/.test(d.mime || '') ? '📄' : '📎') + ' ' + U.esc(d.nombre) + '</button><small>' + U.fdate(d.fecha) + ' · ' + U.size(d.size) + (d.notas ? ' · ' + U.esc(d.notas) : '') + '</small><span class="d-a">' + UI.ibtn('⬇', 'Descargar', 'bajarDoc', { id: d.id }, 'xs') + UI.ibtn('✎', 'Editar', 'documento', { id: d.id }, 'xs') + '</span></li>').join('') + '</ul>' : '') + '</div>').join('') + '</div>';
  },

  /* 14. RENTABILIDAD */
  rentabilidad(v) { return V.filters(V.rentPerSel()) + Ficha.rentabilidadHtml(v); },
  rentabilidadHtml(v) {
    const per = V.rentPer();
    const r = C.rentab(v, per.from, per.to);
    const R = r.R;
    const missCoste = r.coste === null ? ['precio de compra (pestaña Compra)'] : [];
    const rec = C.recuperacion(v);
    const anual = '<div class="tbl-wrap"><table class="tbl cmp"><tbody>' +
      [['Ingresos del periodo', R.ingresos, 'strong'], ['  Alquileres', R.ingAlquiler], ['  Agua repercutida', R.ingAgua], ['  Suministros repercutidos', R.ingSumin], ['  Otros ingresos', R.ingOtros],
        ['− Gastos operativos', -R.gOperativo], ['− Reparaciones', -R.gReparacion], ['− Gastos extraordinarios', -R.gExtra], ['− Intereses hipotecarios', -R.intereses],
        ['= RESULTADO ECONÓMICO (beneficio)', R.beneficio, 'strong'], ['Amortización de capital (no es gasto, aumenta patrimonio)', R.capital, 'muted'],
        ['Flujo de caja = ingresos − gastos − cuotas hipotecarias (' + U.eur(R.cuotas) + ')', R.flujo, 'strong'], ['Amortizaciones extraordinarias', -R.amortExtra, 'muted'], ['Flujo de caja tras amortizaciones extraordinarias', R.flujoTrasExtra]]
        .map(([l, n, cls]) => '<tr class="' + (cls || '') + '"><td data-label="">' + U.esc(l).replace(/^ {2}/, '&nbsp;&nbsp;&nbsp;') + '</td><td class="num" data-label="Importe">' + V.signed(n) + '</td></tr>').join('') + '</tbody></table></div>';
    const recHtml = rec ? UI.formula('RECUPERACIÓN DE LA INVERSIÓN', 'Beneficio acumulado desde la compra / capital aportado × 100',
      [['Inversión inicial (capital aportado)', U.eur(rec.cap)], ['Beneficio acumulado desde ' + U.fdate(rec.desde), U.eur(rec.acum)], ['Beneficio últimos 12 meses', U.eur(rec.anual)]],
      '<div class="big-line">INVERSIÓN RECUPERADA: ' + U.pct(rec.pct) + '</div><div class="big-line">TIEMPO ESTIMADO PARA RECUPERAR LA INVERSIÓN: ' + (rec.restante === 0 ? 'ya recuperada' : rec.restante === null ? 'no estimable con el beneficio actual (≤ 0)' : U.dur(rec.restante) + ' más') + '</div>' +
      (rec.total !== null ? '<small>Tiempo total estimado desde la compra: ' + U.dur(rec.total) + ' (transcurrido: ' + U.dur(rec.transcurridos) + '). Años restantes = (inversión − beneficio acumulado) / beneficio de los últimos 12 meses.</small>' : ''))
      : UI.formula('RECUPERACIÓN DE LA INVERSIÓN', 'Beneficio acumulado / capital aportado × 100', [], '', ['fecha y precio de compra o capital aportado positivo']);
    return '<p class="muted">Periodo analizado: <b>' + U.esc(per.label) + '</b>. Criterio de caja: importes efectivamente cobrados y pagados.</p>' +
      '<div class="formulas">' +
      UI.formula('RENTABILIDAD BRUTA', 'Alquiler anual / coste total de adquisición × 100', [['Alquiler anual (renta actual × 12)', U.eur(r.alqAnual)], ['Coste total de adquisición', U.eur(r.coste)]], U.pct(r.bruta), r.alqAnual === null ? missCoste.concat(['contrato activo con renta']) : missCoste) +
      UI.formula('RENTABILIDAD NETA', '(Ingresos − gastos operativos − intereses hipotecarios) / coste total de adquisición × 100', [['Ingresos cobrados', U.eur(R.ingresos)], ['Gastos (operativos + reparaciones + extraordinarios)', U.eur(R.gastos)], ['Intereses hipotecarios', U.eur(R.intereses)], ['Beneficio', U.eur(R.beneficio)], ['Coste total de adquisición', U.eur(r.coste)]], U.pct(r.neta), missCoste) +
      UI.formula('RENTABILIDAD SOBRE CAPITAL APORTADO', 'Beneficio anual / capital realmente aportado × 100', [['Beneficio', U.eur(R.beneficio)], ['Capital aportado' + (r.capManual ? ' (indicado)' : ' (coste total − préstamo inicial)'), U.eur(r.capAportado)]], U.pct(r.roe), r.capAportado === null ? missCoste : (r.capAportado <= 0 ? ['capital aportado positivo'] : [])) +
      UI.formula('FLUJO DE CAJA', 'Ingresos cobrados − gastos pagados − cuotas hipotecarias pagadas', [['Ingresos cobrados', U.eur(R.ingresos)], ['Gastos pagados', U.eur(R.gastos)], ['Cuotas hipotecarias pagadas', U.eur(R.cuotas)]], V.signed(R.flujo), []) +
      '</div>' +
      UI.card('Resultado anual separado', anual) + recHtml + Ficha.valorHtml(v) +
      '<div class="note">Diferencias: <b>rentabilidad</b> = beneficio relativo a la inversión; <b>beneficio</b> = ingresos − gastos − intereses; <b>cash flow</b> = dinero que entra y sale realmente (incluye la cuota completa); <b>amortización patrimonial</b> = capital devuelto al banco, que aumenta su patrimonio neto y no es gasto.</div>';
  },

  /* 15. HISTÓRICO */
  historico(v) {
    const prev = App.st.f.viv;
    App.st.f.viv = v.id;
    const html = V.historicoHtml();
    App.st.f.viv = prev;
    return html.replace(/<label class="flt"><span>Vivienda<\/span>[\s\S]*?<\/label>/, '');
  },

  /* 16. NOTAS */
  notas(v) {
    return UI.card('Notas', '<textarea id="notas-' + v.id + '" class="notes" rows="12" placeholder="Escriba aquí sus notas sobre la vivienda…">' + U.esc(v.notas || '') + '</textarea><div class="form-actions">' + UI.btn('Guardar notas', 'guardarNotas', { vid: v.id }, 'btn-primary') + '</div>');
  }
};

/* Datos de vacancia (vivienda vacía) */
F.vacia = function (d) {
  const v = DB.get('viviendas', d.vid);
  const va = C.vacancia(v) || {};
  UI.form({
    title: 'Vivienda vacía — ' + v.nombre, values: { vaciaDesde: v.vaciaDesde || va.desde, alquilerPrevisto: v.alquilerPrevisto || va.ultimo },
    fields: [{ k: 'vaciaDesde', l: 'Vacía desde', t: 'date', req: true }, { k: 'alquilerPrevisto', l: 'Alquiler previsto', t: 'money' }],
    onSubmit: async x => { v.vaciaDesde = x.vaciaDesde; v.alquilerPrevisto = x.alquilerPrevisto; await DB.put('viviendas', v); }
  });
};
V.vivienda = (id, tab) => Ficha.render(id, tab);
