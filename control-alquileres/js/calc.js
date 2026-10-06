'use strict';
/* Motor de cálculo. Todo se obtiene exclusivamente de los datos introducidos.
   Criterio de caja: ingresos = importes efectivamente cobrados; gastos = importes pagados. */

const CAT_GASTO = ['Comunidad ordinaria', 'Derramas', 'IBI', 'Seguro del inmueble', 'Seguro de impago', 'Basuras',
  'Agua', 'Electricidad', 'Gas', 'Caldera', 'Mantenimiento de caldera', 'Reparaciones', 'Fontanería',
  'Electricidad (reparación)', 'Pintura', 'Cerrajería', 'Electrodomésticos', 'Mobiliario',
  'Administración de fincas', 'Agencia', 'Honorarios jurídicos', 'Impuestos', 'Otros'];
const CAT_REPAR = ['Reparaciones', 'Fontanería', 'Electricidad (reparación)', 'Pintura', 'Cerrajería'];
const PERIODICIDAD = ['mensual', 'trimestral', 'semestral', 'anual', 'extraordinaria'];
const PER_MESES = { mensual: 1, trimestral: 3, semestral: 6, anual: 12 };
const SUMIN = { agua: 'Agua', electricidad: 'Electricidad', gas: 'Gas', caldera: 'Electricidad de caldera', otros: 'Otros suministros' };
const FORMAS_PAGO = ['Transferencia', 'Domiciliación', 'Bizum', 'Efectivo', 'Ingreso en cuenta', 'Tarjeta', 'Otra'];
const COMPRA = [
  ['precio', 'Precio de compra'], ['itp', 'ITP'], ['iva', 'IVA (si procede)'], ['impuestos', 'Otros impuestos (AJD u otros)'],
  ['notaria', 'Notaría'], ['registro', 'Registro'], ['gestoria', 'Gestoría'], ['agencia', 'Comisión de agencia'],
  ['reformas', 'Reformas iniciales'], ['mobiliario', 'Mobiliario'], ['electrodomesticos', 'Electrodomésticos'], ['otros', 'Otros gastos']
];
const TIPOS_DOC = ['Escritura', 'Nota simple', 'Contrato de alquiler', 'Anexos', 'Inventario', 'Seguros', 'Facturas', 'Recibos',
  'Presupuestos', 'Documentos hipotecarios', 'Certificados', 'Comunicaciones', 'Fotografías', 'Otros'];
const INSUF = 'Datos insuficientes para realizar este cálculo.';

const C = {
  hoy() { return U.today(); },
  cats() { return [...CAT_GASTO, ...(DB.cfg.catPers || [])]; },
  viv(id) { return DB.get('viviendas', id); },
  vivs() { return DB.S.viviendas.slice().sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')); },
  nomViv(id) { const v = C.viv(id); return v ? v.nombre : '(sin vivienda)'; },
  byViv(store, vid) { return DB.S[store].filter(x => !vid || x.viviendaId === vid); },

  /* ---------- Compra y valor ---------- */
  costeTotal(v) {
    const c = v && v.compra;
    if (!c || !(U.num(c.precio) > 0)) return null;
    return U.r2(U.sum(COMPRA, k => U.num(c[k[0]]) || 0));
  },
  prestamoInicial(vid) { return U.sum(C.byViv('hipotecas', vid), h => h.capitalInicial); },
  capitalAportado(v) {
    if (v.capitalAportado !== null && v.capitalAportado !== undefined && v.capitalAportado !== '') return { valor: +v.capitalAportado, manual: true };
    const ct = C.costeTotal(v);
    if (ct === null) return { valor: null, manual: false };
    return { valor: U.r2(ct - C.prestamoInicial(v.id)), manual: false };
  },
  valor(v) { return U.num(v.valorActual); },

  /* ---------- Contratos ---------- */
  contratos(vid) { return C.byViv('contratos', vid).sort((a, b) => (b.fechaInicio || '').localeCompare(a.fechaInicio || '')); },
  contratoActivo(vid) { return C.contratos(vid).find(c => c.estado === 'activo') || null; },
  inq(id) { return DB.get('inquilinos', id); },
  nomInq(id) { const i = C.inq(id); return i ? i.nombre : '—'; },
  maxPlazo() { return Math.max(0, ...(DB.cfg.plazos || []).map(Number).filter(x => x > 0)); },
  diasRest(c) { return c && c.fechaVencimiento ? U.days(C.hoy(), c.fechaVencimiento) : null; },
  /** Vigente / Próximo a vencer / Vencido / Renovado / Finalizado */
  estadoContrato(c) {
    if (!c) return '—';
    if (c.estado === 'finalizado') return 'Finalizado';
    if (c.estado === 'renovado') return 'Renovado';
    const d = C.diasRest(c);
    if (d === null) return 'Vigente';
    if (d < 0) return 'Vencido';               // fecha_actual > fecha_vencimiento
    if (d <= C.maxPlazo()) return 'Próximo a vencer';
    return 'Vigente';
  },
  vencido(c) { return !!c && c.estado === 'activo' && C.estadoContrato(c) === 'Vencido'; },
  rentasDe(cid) { return DB.S.rentas.filter(r => r.contratoId === cid).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')); },
  rentaEnMes(c, ym) {
    const h = C.rentasDe(c.id);
    if (!h.length) return +c.rentaActual || +c.rentaInicial || 0;
    let r = +c.rentaInicial || 0;
    h.forEach(x => { if (U.ym(x.fecha) <= ym) r = +x.nueva; });
    return r;
  },

  /* ---------- Estado de la vivienda ---------- */
  estadoViv(v) {
    if (v.estado === 'reservada' || v.estado === 'reforma') return v.estado;
    const c = C.contratoActivo(v.id);
    if (c && (!c.fechaInicio || c.fechaInicio <= C.hoy())) return 'alquilada';
    return 'vacia';
  },
  ESTADO_TXT: { alquilada: 'Alquilada', vacia: 'Vacía', reservada: 'Reservada', reforma: 'En reforma' },

  /* ---------- Mensualidades de alquiler ---------- */
  async syncMensualidades(cid) {
    const list = cid ? [DB.get('contratos', cid)] : DB.S.contratos;
    const hoyYm = U.ym(C.hoy());
    const nuevos = [];
    for (const c of list) {
      if (!c || !c.fechaInicio || !c.viviendaId) continue;
      const ini = U.ym(c.fechaInicio);
      let fin;
      if (c.estado === 'finalizado') fin = U.ym(c.fechaFin || c.fechaVencimiento || C.hoy());
      else if (c.estado === 'renovado') fin = U.ym(c.fechaVencimiento || C.hoy());
      else {
        const v = c.fechaVencimiento ? U.ym(c.fechaVencimiento) : hoyYm;
        fin = v > hoyYm ? v : hoyYm; // contrato vencido sin finalizar: se siguen generando meses
      }
      const exist = new Set(DB.S.mensualidades.filter(m => m.viviendaId === c.viviendaId).map(m => m.mes));
      nuevos.filter(m => m.viviendaId === c.viviendaId).forEach(m => exist.add(m.mes));
      for (const ym of U.ymRange(ini, fin)) {
        if (exist.has(ym)) continue;
        let esperado = C.rentaEnMes(c, ym);
        let obs = '';
        let fp = U.ymDay(ym, c.diaPago || 1);
        if (ym === ini) {
          const day = +c.fechaInicio.slice(8, 10);
          if (DB.cfg.prorrateo && day > 1) {
            const dm = U.dim(+ym.slice(0, 4), +ym.slice(5, 7));
            esperado = U.r2(esperado * (dm - day + 1) / dm);
            obs = 'Primer mes prorrateado (' + (dm - day + 1) + ' de ' + dm + ' días)';
          }
          if (fp < c.fechaInicio) fp = c.fechaInicio;
        }
        if (c.estado === 'finalizado' && c.fechaFin && ym === U.ym(c.fechaFin) && ym !== ini) {
          const day = +c.fechaFin.slice(8, 10);
          const dm = U.dim(+ym.slice(0, 4), +ym.slice(5, 7));
          if (DB.cfg.prorrateo && day < dm) { esperado = U.r2(esperado * day / dm); obs = 'Último mes prorrateado (' + day + ' de ' + dm + ' días)'; }
        }
        nuevos.push({ id: U.uid(), viviendaId: c.viviendaId, contratoId: c.id, mes: ym, esperado, fechaPrevista: fp, pagos: [], exonerado: false, obs, demo: c.demo || undefined });
        exist.add(ym);
      }
    }
    if (nuevos.length) await DB.putMany('mensualidades', nuevos);
    return nuevos.length;
  },
  mensualidades(vid) { return C.byViv('mensualidades', vid).sort((a, b) => b.mes.localeCompare(a.mes)); },
  cobradoM(m) { return U.r2(U.sum(m.pagos, p => p.importe)); },
  pendM(m) { return m.exonerado ? 0 : Math.max(0, U.r2((+m.esperado || 0) - C.cobradoM(m))); },
  exigible(m) { return !!m.fechaPrevista && m.fechaPrevista <= C.hoy(); },
  estadoM(m) {
    if (m.exonerado) return 'Exonerado';
    const cob = C.cobradoM(m), esp = +m.esperado || 0;
    if (cob >= esp - 0.004) return 'Pagado';
    if (cob > 0) return 'Pago parcial';
    if (m.fechaPrevista && U.addDays(m.fechaPrevista, +DB.cfg.gracia || 0) < C.hoy()) return 'Impagado';
    return 'Pendiente';
  },
  fechaRealM(m) { const p = (m.pagos || []).map(x => x.fecha).filter(Boolean).sort(); return p.length ? p[p.length - 1] : null; },
  /** Deuda exigible de alquiler (vivienda o contrato) */
  pendienteAlquiler(vid, cid) {
    return U.r2(U.sum(DB.S.mensualidades.filter(m => (!vid || m.viviendaId === vid) && (!cid || m.contratoId === cid) && C.exigible(m)), C.pendM));
  },
  pendientesLista(vid) {
    return DB.S.mensualidades.filter(m => (!vid || m.viviendaId === vid) && C.pendM(m) > 0).sort((a, b) => a.mes.localeCompare(b.mes));
  },

  /* ---------- Agua y suministros ---------- */
  cobradoS(s) { return U.r2(U.sum(s.pagos, p => p.importe)); },
  pendS(s) { return Math.max(0, U.r2((+s.repercutido || 0) - C.cobradoS(s))); },
  estadoS(s) {
    if (!(+s.repercutido > 0)) return 'No repercutido';
    const p = C.pendS(s);
    if (p <= 0.004) return 'Pagado';
    if (C.cobradoS(s) > 0) return 'Pago parcial';
    return 'Pendiente';
  },
  fechaRealS(s) { const p = (s.pagos || []).map(x => x.fecha).filter(Boolean).sort(); return p.length ? p[p.length - 1] : null; },
  aguaPendiente(vid) { return U.r2(U.sum(DB.S.suministros.filter(s => s.tipo === 'agua' && (!vid || s.viviendaId === vid)), C.pendS)); },
  suminPendiente(vid) { return U.r2(U.sum(DB.S.suministros.filter(s => s.tipo !== 'agua' && (!vid || s.viviendaId === vid)), C.pendS)); },

  /* ---------- Gastos ---------- */
  claseGasto(g) {
    if (g.categoria === 'Derramas' || g.periodicidad === 'extraordinaria') return CAT_REPAR.includes(g.categoria) ? 'reparacion' : 'extraordinario';
    if (CAT_REPAR.includes(g.categoria)) return 'reparacion';
    return 'operativo';
  },

  /* ---------- Derramas ---------- */
  generarCuotasDerrama(d) {
    const n = Math.max(1, parseInt(d.numCuotas, 10) || 1);
    const per = Math.max(1, parseInt(d.periodicidadMeses, 10) || 1);
    const total = +d.total || 0;
    const base = d.importeCuota ? +d.importeCuota : U.r2(total / n);
    const prev = d.cuotas || [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const imp = (i === n - 1 && !d.importeCuotaManual) ? U.r2(total - base * (n - 1)) : base;
      const old = prev.find(q => q.n === i + 1);
      out.push({ n: i + 1, fecha: d.fechaInicial ? U.addMonths(d.fechaInicial, i * per) : '', importe: imp, pagada: old ? !!old.pagada : false, fechaPago: old ? old.fechaPago || '' : '' });
    }
    return out;
  },
  infoDerrama(d) {
    const q = d.cuotas || [];
    const pag = q.filter(x => x.pagada);
    return {
      pagadas: pag.length, pendientes: q.length - pag.length,
      importePagado: U.r2(U.sum(pag, x => x.importe)),
      importePendiente: U.r2(U.sum(q.filter(x => !x.pagada), x => x.importe)),
      fechaFinal: q.length ? q[q.length - 1].fecha : ''
    };
  },
  derramasPendientes(vid) { return U.r2(U.sum(C.byViv('derramas', vid), d => C.infoDerrama(d).importePendiente)); },

  /* ---------- Hipotecas ---------- */
  rM(h) { return (U.num(h.tipoInteres) || 0) / 100 / 12; },
  anualidad(P, r, n) {
    if (n <= 0) return P;
    if (r === 0) return P / n;
    return P * r / (1 - Math.pow(1 + r, -n));
  },
  cuotasH(hid) { return DB.S.cuotas.filter(q => q.hipotecaId === hid).sort((a, b) => a.mes.localeCompare(b.mes)); },
  amortsH(hid) { return DB.S.amortizaciones.filter(a => a.hipotecaId === hid).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')); },
  capRef(h) { return (h.capitalRef !== null && h.capitalRef !== undefined && h.capitalRef !== '') ? +h.capitalRef : (+h.capitalInicial || 0); },
  pendienteH(h) {
    const p = C.capRef(h) - U.sum(C.cuotasH(h.id), q => q.capital) - U.sum(C.amortsH(h.id), a => a.importe);
    return Math.max(0, U.r2(p));
  },
  cuotaH(h) {
    if (+h.cuota > 0) return +h.cuota;
    const n = +h.plazoMeses || 0;
    if (!(+h.capitalInicial > 0) || !n) return null;
    return U.ceil2(C.anualidad(+h.capitalInicial, C.rM(h), n));
  },
  mesesRest(P, cuota, r) {
    if (P <= 0.005) return 0;
    if (!(cuota > 0)) return Infinity;
    if (r === 0) return Math.ceil(P / cuota - 1e-9);
    const x = 1 - r * P / cuota;
    if (x <= 0) return Infinity;
    return Math.ceil(-Math.log(x) / Math.log(1 + r) - 0.02); // tolerancia por redondeo de céntimos
  },
  proxMes(h) {
    const cs = C.cuotasH(h.id);
    if (cs.length) return U.ymAdd(cs[cs.length - 1].mes, 1);
    const pm = U.ym(h.fechaPrimeraCuota || h.fechaFormalizacion || C.hoy());
    const ref = h.fechaRef ? U.ymAdd(U.ym(h.fechaRef), 1) : pm;
    return ref > pm ? ref : pm;
  },
  infoH(h) {
    const pend = C.pendienteH(h);
    const cuota = C.cuotaH(h);
    const r = C.rM(h);
    const cs = C.cuotasH(h.id);
    const n = cuota ? C.mesesRest(pend, cuota, r) : null;
    const prox = C.proxMes(h);
    let fin = null;
    if (pend <= 0.005) fin = cs.length ? cs[cs.length - 1].mes : null;
    else if (n !== null && isFinite(n)) fin = U.ymAdd(prox, n - 1);
    const ini = +h.capitalInicial || 0;
    return {
      pendiente: pend, cuota, r, meses: n, prox, fin,
      pct: ini > 0 ? (ini - pend) / ini * 100 : null,
      capitalAmortizado: ini > 0 ? U.r2(ini - pend) : null,
      interesesPagados: U.r2(U.sum(cs, q => q.intereses)),
      capitalCuotas: U.r2(U.sum(cs, q => q.capital)),
      extra: U.r2(U.sum(C.amortsH(h.id), a => a.importe)),
      noAmortiza: n === Infinity,
      cancelada: pend <= 0.005
    };
  },
  deudaTotal(vid) { return U.r2(U.sum(C.byViv('hipotecas', vid), h => C.pendienteH(h))); },
  /** Saldo vivo tras cada cuota (cálculo dinámico, incluye amortizaciones extra en su fecha) */
  saldosH(h) {
    const ev = [];
    C.cuotasH(h.id).forEach(q => ev.push({ k: q.mes + '-' + (q.fechaPago || '99').slice(8, 10), t: 'c', o: q }));
    C.amortsH(h.id).forEach(a => ev.push({ k: a.fecha, t: 'a', o: a }));
    ev.sort((a, b) => a.k.localeCompare(b.k));
    let s = C.capRef(h);
    const map = {};
    ev.forEach(e => { s = U.r2(s - (e.t === 'c' ? (+e.o.capital || 0) : (+e.o.importe || 0))); map[e.o.id] = Math.max(0, s); });
    return map;
  },
  /** Simulación mes a mes. extras: [{ym, importe}], anual: {importe, mes, desde} */
  simular({ P, cuota, r, desde, extras = [], anual = null, nuevaCuota = null, modo = 'plazo' }) {
    const filas = [];
    let C0 = nuevaCuota && nuevaCuota > 0 ? nuevaCuota : cuota;
    const nBase = C.mesesRest(P, cuota, r);
    let ym = desde, int = 0, i = 0;
    while (P > 0.005 && i < 1200) {
      const it = U.r2(P * r);
      if (C0 - it <= 0) return { error: 'Con esta cuota no se amortiza capital (la cuota no cubre los intereses).' };
      const cap = Math.min(P, U.r2(C0 - it));
      P = U.r2(P - cap);
      let ex = U.sum(extras.filter(e => e.ym === ym), e => e.importe);
      if (anual && anual.importe > 0 && +ym.slice(5, 7) === +anual.mes && +ym.slice(0, 4) >= +anual.desde) ex += +anual.importe;
      ex = Math.min(ex, P);
      P = U.r2(P - ex);
      int += it;
      filas.push({ ym, cuota: U.r2(cap + it), int: it, cap, extra: ex, pend: P });
      i++;
      if (ex > 0 && modo === 'cuota' && P > 0 && isFinite(nBase)) {
        const rem = nBase - i;
        if (rem > 0) C0 = U.ceil2(C.anualidad(P, r, rem));
      }
      ym = U.ymAdd(ym, 1);
    }
    return { meses: filas.length, fin: filas.length ? filas[filas.length - 1].ym : null, intereses: U.r2(int), filas };
  },
  simBase(h, extrasPrevistas) {
    const inf = C.infoH(h);
    if (!inf.cuota || inf.pendiente <= 0) return null;
    return C.simular({ P: inf.pendiente, cuota: inf.cuota, r: inf.r, desde: inf.prox, extras: extrasPrevistas || [] });
  },

  /* ---------- Movimientos económicos (base de todos los informes) ---------- */
  movimientos(vid, from, to) {
    const out = [];
    const ok = x => !vid || x.viviendaId === vid;
    DB.S.mensualidades.filter(ok).forEach(m => (m.pagos || []).forEach(p => out.push({
      fecha: p.fecha, vid: m.viviendaId, tipo: 'ingreso', clase: 'alquiler', cat: 'Alquiler',
      concepto: 'Alquiler ' + U.fmonth(m.mes) + (p.forma ? ' · ' + p.forma : ''), importe: +p.importe || 0, ref: ['mensualidades', m.id]
    })));
    DB.S.suministros.filter(ok).forEach(s => {
      const nom = SUMIN[s.tipo] || 'Suministro';
      (s.pagos || []).forEach(p => out.push({
        fecha: p.fecha, vid: s.viviendaId, tipo: 'ingreso', clase: s.tipo === 'agua' ? 'agua' : 'suministros',
        cat: nom + ' repercutido', concepto: nom + ' ' + (s.periodo || '') + ' (cobro al inquilino)', importe: +p.importe || 0, ref: ['suministros', s.id]
      }));
      if (s.costePagado !== false && +s.coste > 0) out.push({
        fecha: s.fechaFactura || s.fechaPrevista, vid: s.viviendaId, tipo: 'gasto', clase: 'operativo', cat: nom,
        concepto: nom + ' ' + (s.periodo || '') + ' (factura)', importe: +s.coste, ref: ['suministros', s.id]
      });
    });
    DB.S.ingresos.filter(ok).forEach(g => out.push({
      fecha: g.fecha, vid: g.viviendaId, tipo: 'ingreso', clase: 'otros', cat: g.tipo || 'Otros ingresos', concepto: g.concepto || '', importe: +g.importe || 0, ref: ['ingresos', g.id]
    }));
    DB.S.gastos.filter(ok).filter(g => g.pagado).forEach(g => out.push({
      fecha: g.fecha, vid: g.viviendaId, tipo: 'gasto', clase: C.claseGasto(g), cat: g.categoria || 'Otros',
      concepto: g.concepto || g.categoria, proveedor: g.proveedor, importe: +g.importe || 0, ref: ['gastos', g.id]
    }));
    DB.S.derramas.filter(ok).forEach(d => (d.cuotas || []).filter(q => q.pagada).forEach(q => out.push({
      fecha: q.fechaPago || q.fecha, vid: d.viviendaId, tipo: 'gasto', clase: 'extraordinario', cat: 'Derramas',
      concepto: 'Derrama: ' + (d.concepto || '') + ' (cuota ' + q.n + '/' + (d.cuotas || []).length + ')', importe: +q.importe || 0, ref: ['derramas', d.id]
    })));
    DB.S.cuotas.filter(ok).forEach(q => {
      const h = DB.get('hipotecas', q.hipotecaId);
      out.push({
        fecha: q.fechaPago || U.ymDay(q.mes, h ? h.diaCargo : 1), vid: q.viviendaId, tipo: 'hipoteca', clase: 'hipoteca', cat: 'Cuota hipoteca',
        concepto: 'Cuota ' + U.fmonth(q.mes) + (h ? ' · ' + (h.banco || '') : ''), importe: +q.cuotaPagada || 0,
        intereses: +q.intereses || 0, capital: +q.capital || 0, ref: ['cuotas', q.id]
      });
    });
    DB.S.amortizaciones.filter(ok).forEach(a => {
      const h = DB.get('hipotecas', a.hipotecaId);
      out.push({ fecha: a.fecha, vid: a.viviendaId, tipo: 'amortExtra', clase: 'amortExtra', cat: 'Amortización extraordinaria', concepto: 'Amortización extraordinaria' + (h ? ' · ' + (h.banco || '') : ''), importe: +a.importe || 0, ref: ['amortizaciones', a.id] });
    });
    return out.filter(x => U.inR(x.fecha, from, to)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  },
  resumen(vid, from, to) {
    const R = { ingAlquiler: 0, ingAgua: 0, ingSumin: 0, ingOtros: 0, ingresos: 0, gOperativo: 0, gReparacion: 0, gExtra: 0, gastos: 0, intereses: 0, capital: 0, cuotas: 0, amortExtra: 0 };
    const ms = C.movimientos(vid, from, to);
    ms.forEach(m => {
      if (m.tipo === 'ingreso') {
        R.ingresos += m.importe;
        if (m.clase === 'alquiler') R.ingAlquiler += m.importe;
        else if (m.clase === 'agua') R.ingAgua += m.importe;
        else if (m.clase === 'suministros') R.ingSumin += m.importe;
        else R.ingOtros += m.importe;
      } else if (m.tipo === 'gasto') {
        R.gastos += m.importe;
        if (m.clase === 'reparacion') R.gReparacion += m.importe;
        else if (m.clase === 'extraordinario') R.gExtra += m.importe;
        else R.gOperativo += m.importe;
      } else if (m.tipo === 'hipoteca') {
        R.cuotas += m.importe; R.intereses += m.intereses; R.capital += m.capital;
      } else if (m.tipo === 'amortExtra') R.amortExtra += m.importe;
    });
    Object.keys(R).forEach(k => { R[k] = U.r2(R[k]); });
    R.beneficio = U.r2(R.ingresos - R.gastos - R.intereses);
    R.flujo = U.r2(R.ingresos - R.gastos - R.cuotas);
    R.flujoTrasExtra = U.r2(R.flujo - R.amortExtra);
    R.movs = ms;
    return R;
  },
  /** Ingresos previstos de un periodo: rentas esperadas + repercusiones previstas */
  previsto(vid, from, to) {
    const alq = U.sum(DB.S.mensualidades.filter(m => (!vid || m.viviendaId === vid) && !m.exonerado && U.inR(m.fechaPrevista, from, to)), m => m.esperado);
    const sum = U.sum(DB.S.suministros.filter(s => (!vid || s.viviendaId === vid) && U.inR(s.fechaPrevista, from, to)), s => s.repercutido);
    return { alquiler: U.r2(alq), repercusiones: U.r2(sum), total: U.r2(alq + sum) };
  },
  pendientePeriodo(vid, from, to) {
    return U.r2(U.sum(DB.S.mensualidades.filter(m => (!vid || m.viviendaId === vid) && U.inR(m.fechaPrevista, from, to) && C.exigible(m)), C.pendM));
  },
  ventana12() { const h = C.hoy(); return { from: U.addDays(U.addMonths(h, -12), 1), to: h, label: 'últimos 12 meses (' + U.fdate(U.addDays(U.addMonths(h, -12), 1)) + ' – ' + U.fdate(h) + ')' }; },

  /* ---------- Rentabilidad ---------- */
  rentab(v, from, to) {
    const coste = C.costeTotal(v);
    const c = C.contratoActivo(v.id);
    const renta = c ? +c.rentaActual || 0 : null;
    const alqAnual = renta !== null ? U.r2(renta * 12) : null;
    const R = C.resumen(v.id, from, to);
    const cap = C.capitalAportado(v);
    return {
      coste, renta, alqAnual, R, capAportado: cap.valor, capManual: cap.manual,
      bruta: coste && alqAnual !== null ? alqAnual / coste * 100 : null,
      neta: coste ? R.beneficio / coste * 100 : null,
      roe: cap.valor > 0 ? R.beneficio / cap.valor * 100 : null
    };
  },
  recuperacion(v) {
    const cap = C.capitalAportado(v).valor;
    const f = v.compra && v.compra.fecha;
    if (!(cap > 0) || !f) return null;
    const acum = C.resumen(v.id, f, C.hoy()).beneficio;
    const w = C.ventana12();
    const anual = C.resumen(v.id, w.from, w.to).beneficio;
    const pct = acum / cap * 100;
    const transcurridos = U.monthsDiff(U.ym(f), U.ym(C.hoy()));
    let restante = null;
    if (pct >= 100) restante = 0;
    else if (anual > 0) restante = (cap - acum) / anual * 12;
    return { cap, acum, anual, pct, restante, transcurridos, total: restante !== null ? transcurridos + restante : null, desde: f };
  },
  vacancia(v) {
    if (C.estadoViv(v) !== 'vacia') return null;
    const prev = C.contratos(v.id).filter(c => c.estado !== 'activo');
    const ult = prev[0];
    let desde = v.vaciaDesde || (ult ? U.addDays(ult.fechaFin || ult.fechaVencimiento, 1) : null) || (v.compra && v.compra.fecha) || null;
    if (!desde) return { desde: null };
    if (desde > C.hoy()) desde = C.hoy();
    const dias = U.days(desde, C.hoy());
    const meses = dias / 30.4375;
    const ultimo = ult ? (+ult.rentaFinal || +ult.rentaActual || null) : null;
    const previsto = U.num(v.alquilerPrevisto) || ultimo;
    const R = C.resumen(v.id, desde, C.hoy());
    const dejados = previsto ? U.r2(previsto * meses) : null;
    return { desde, dias, meses, ultimo, previsto, dejados, gastos: R.gastos, cuotas: R.cuotas, coste: dejados !== null ? U.r2(dejados + R.gastos) : null };
  },

  /* ---------- Alertas ---------- */
  alertas(vid) {
    const A = [];
    const hoy = C.hoy(), cfg = DB.cfg;
    const ok = x => !vid || x.viviendaId === vid;
    const plazos = (cfg.plazos || []).map(Number).filter(x => x > 0).sort((a, b) => a - b);
    DB.S.contratos.filter(c => ok(c) && c.estado === 'activo').forEach(c => {
      const v = C.nomViv(c.viviendaId);
      const d = C.diasRest(c);
      if (d !== null && d < 0) {
        A.push({ p: 0, cls: 'vencido', tipo: 'Contrato', t: 'CONTRATO VENCIDO — ' + U.fdate(c.fechaVencimiento), d: v + ' · ' + C.nomInq(c.inquilinoId) + '. Venció hace ' + U.plural(-d, 'día', 'días') + '. Registre renovación, prórroga, nuevo contrato o corrija la fecha.', go: '#/vivienda/' + c.viviendaId + '/contrato' });
      } else if (d !== null) {
        const um = plazos.find(x => d <= x);
        if (um !== undefined) A.push({ p: d <= 30 ? 1 : d <= 90 ? 2 : 3, cls: 'warn', tipo: 'Contrato', t: 'El contrato de ' + v + ' vence el ' + U.fdate(c.fechaVencimiento) + '. Faltan ' + U.plural(d, 'día', 'días') + '.', d: 'Aviso de ' + um + ' días · Inquilino: ' + C.nomInq(c.inquilinoId), go: '#/vivienda/' + c.viviendaId + '/contrato' });
      }
      if (c.proximaRevision) {
        const dr = U.days(hoy, c.proximaRevision);
        if (dr <= (+cfg.revisionDias || 0)) A.push({ p: dr < 0 ? 2 : 3, cls: 'info', tipo: 'Renta', t: 'Revisión de renta ' + (dr < 0 ? 'atrasada' : 'próxima') + ': ' + v, d: 'Fecha prevista ' + U.fdate(c.proximaRevision) + (c.indice ? ' · Criterio: ' + c.indice : ''), go: '#/vivienda/' + c.viviendaId + '/contrato' });
      }
    });
    const porViv = {};
    DB.S.mensualidades.filter(m => ok(m) && C.exigible(m) && C.pendM(m) > 0).forEach(m => {
      (porViv[m.viviendaId] = porViv[m.viviendaId] || []).push(m);
    });
    Object.entries(porViv).forEach(([id, ms]) => {
      const imp = ms.some(m => C.estadoM(m) === 'Impagado');
      ms.sort((a, b) => a.mes.localeCompare(b.mes));
      A.push({ p: imp ? 1 : 2, cls: 'danger', tipo: 'Alquiler', t: (imp ? 'Alquiler impagado: ' : 'Alquiler pendiente: ') + C.nomViv(id) + ' — ' + U.eur(U.sum(ms, C.pendM)), d: ms.map(m => U.fmonth(m.mes) + ' (' + C.estadoM(m).toLowerCase() + ', ' + U.eur(C.pendM(m)) + ')').join(' · '), go: '#/vivienda/' + id + '/alquileres', act: { a: 'cobrar', vid: id } });
    });
    DB.S.suministros.filter(s => ok(s) && C.pendS(s) > 0).forEach(s => {
      const atr = s.fechaPrevista && s.fechaPrevista < hoy;
      A.push({ p: atr ? 2 : 3, cls: atr ? 'danger' : 'info', tipo: SUMIN[s.tipo], t: (s.tipo === 'agua' ? 'Agua pendiente: ' : SUMIN[s.tipo] + ' pendiente: ') + C.nomViv(s.viviendaId) + ' — ' + U.eur(C.pendS(s)), d: 'Periodo ' + (s.periodo || '—') + ' · Fecha prevista ' + U.fdate(s.fechaPrevista), go: '#/vivienda/' + s.viviendaId + '/suministros' });
    });
    DB.S.hipotecas.filter(h => ok(h)).forEach(h => {
      const inf = C.infoH(h);
      if (inf.cancelada || !h.diaCargo) return;
      const cur = U.ym(hoy);
      const ult = hoy >= U.ymDay(cur, h.diaCargo) ? cur : U.ymAdd(cur, -1);
      if (inf.prox <= ult) {
        const n = U.monthsDiff(inf.prox, ult) + 1;
        A.push({ p: 2, cls: 'warn', tipo: 'Hipoteca', t: 'Cuota de hipoteca sin registrar: ' + C.nomViv(h.viviendaId), d: (h.banco || 'Préstamo') + ' · ' + (n === 1 ? U.fmonth(inf.prox) : n + ' cuotas desde ' + U.fmonth(inf.prox)) + ' · Cuota ' + U.eur(inf.cuota), go: '#/vivienda/' + h.viviendaId + '/hipoteca', act: { a: 'cuota', hid: h.id } });
      }
    });
    DB.S.gastos.filter(g => ok(g) && !g.pagado && g.fecha).forEach(g => {
      const d = U.days(hoy, g.fecha);
      const seguro = /seguro/i.test(g.categoria || '');
      if (d < 0) A.push({ p: 2, cls: 'danger', tipo: 'Gasto', t: (seguro ? 'Seguro pendiente de pago: ' : 'Gasto pendiente vencido: ') + (g.concepto || g.categoria) + ' — ' + U.eur(g.importe), d: C.nomViv(g.viviendaId) + ' · ' + U.fdate(g.fecha), go: '#/vivienda/' + g.viviendaId + '/gastos' });
      else if (seguro && d <= (+cfg.seguroDias || 30)) A.push({ p: 2, cls: 'warn', tipo: 'Seguro', t: 'Seguro próximo a vencer: ' + (g.concepto || g.categoria) + ' — ' + U.eur(g.importe), d: C.nomViv(g.viviendaId) + ' · ' + U.fdate(g.fecha) + ' (faltan ' + U.plural(d, 'día', 'días') + ')', go: '#/vivienda/' + g.viviendaId + '/gastos' });
      else if (d <= 7) A.push({ p: 3, cls: 'info', tipo: 'Gasto', t: 'Gasto próximo: ' + (g.concepto || g.categoria) + ' — ' + U.eur(g.importe), d: C.nomViv(g.viviendaId) + ' · ' + U.fdate(g.fecha), go: '#/vivienda/' + g.viviendaId + '/gastos' });
    });
    DB.S.derramas.filter(ok).forEach(dr => (dr.cuotas || []).filter(q => !q.pagada && q.fecha).forEach(q => {
      const d = U.days(hoy, q.fecha);
      if (d < 0) A.push({ p: 2, cls: 'danger', tipo: 'Derrama', t: 'Derrama pendiente: ' + (dr.concepto || '') + ' — cuota ' + q.n + ' (' + U.eur(q.importe) + ')', d: C.nomViv(dr.viviendaId) + ' · vencida el ' + U.fdate(q.fecha), go: '#/vivienda/' + dr.viviendaId + '/derramas' });
      else if (d <= 15) A.push({ p: 3, cls: 'info', tipo: 'Derrama', t: 'Próxima cuota de derrama: ' + (dr.concepto || '') + ' — ' + U.eur(q.importe), d: C.nomViv(dr.viviendaId) + ' · ' + U.fdate(q.fecha), go: '#/vivienda/' + dr.viviendaId + '/derramas' });
    }));
    DB.S.incidencias.filter(i => ok(i) && i.estado !== 'Resuelto').forEach(i => {
      const p = i.urgencia === 'Urgente' ? 1 : i.urgencia === 'Alta' ? 2 : 3;
      A.push({ p, cls: p === 1 ? 'danger' : 'warn', tipo: 'Reparación', t: 'Reparación ' + (i.estado || 'Pendiente').toLowerCase() + ': ' + (i.problema || ''), d: C.nomViv(i.viviendaId) + ' · urgencia ' + (i.urgencia || '—').toLowerCase() + ' · desde ' + U.fdate(i.fecha), go: '#/vivienda/' + i.viviendaId + '/incidencias' });
    });
    DB.S.viviendas.filter(v => !vid || v.id === vid).forEach(v => {
      if (C.estadoViv(v) === 'vacia') {
        const va = C.vacancia(v);
        A.push({ p: 3, cls: 'info', tipo: 'Vivienda', t: 'Vivienda vacía: ' + v.nombre, d: va && va.desde ? 'Desde ' + U.fdate(va.desde) + ' (' + U.plural(va.dias, 'día', 'días') + ')' : 'Sin contrato activo', go: '#/vivienda/' + v.id + '/resumen' });
      }
    });
    if (!vid && DB.S.viviendas.length) {
      const u = cfg.ultimaCopia;
      const d = u ? U.days(u.slice(0, 10), hoy) : null;
      if (d === null || d > (+cfg.avisoCopiaDias || 30)) A.push({ p: 3, cls: 'info', tipo: 'Copia', t: u ? 'Han pasado ' + d + ' días desde la última copia de seguridad' : 'Aún no ha exportado ninguna copia de seguridad', d: 'Los datos solo están en este dispositivo. Exporte una copia JSON.', go: '#/config', act: { a: 'exportar' } });
    }
    return A.sort((a, b) => a.p - b.p);
  },

  /* ---------- Calendario ---------- */
  eventos(from, to, vid) {
    const E = [];
    const hoy = C.hoy();
    const ok = x => !vid || x.viviendaId === vid;
    const st = (pagado, fecha) => pagado ? 'pagado' : (fecha < hoy ? 'atrasado' : (U.days(hoy, fecha) <= 7 ? 'proximo' : 'pendiente'));
    DB.S.mensualidades.filter(m => ok(m) && U.inR(m.fechaPrevista, from, to)).forEach(m => {
      const e = C.estadoM(m);
      E.push({ f: m.fechaPrevista, tipo: 'Alquiler', vid: m.viviendaId, t: 'Cobro alquiler ' + U.fmonth(m.mes) + ' · ' + U.eur(m.esperado), st: (e === 'Pagado' || e === 'Exonerado') ? 'pagado' : st(false, m.fechaPrevista), go: '#/vivienda/' + m.viviendaId + '/alquileres' });
    });
    DB.S.suministros.filter(s => ok(s) && +s.repercutido > 0 && U.inR(s.fechaPrevista, from, to)).forEach(s => {
      E.push({ f: s.fechaPrevista, tipo: SUMIN[s.tipo], vid: s.viviendaId, t: SUMIN[s.tipo] + ' ' + (s.periodo || '') + ' · ' + U.eur(s.repercutido), st: st(C.pendS(s) <= 0, s.fechaPrevista), go: '#/vivienda/' + s.viviendaId + '/suministros' });
    });
    DB.S.hipotecas.filter(ok).forEach(h => {
      const inf = C.infoH(h);
      const regs = {};
      C.cuotasH(h.id).forEach(q => { regs[q.mes] = q; });
      const desde = U.ym(from), hasta = U.ym(to);
      U.ymRange(desde, hasta).forEach(ym => {
        const f = U.ymDay(ym, h.diaCargo || 1);
        if (!U.inR(f, from, to)) return;
        if (regs[ym]) E.push({ f, tipo: 'Hipoteca', vid: h.viviendaId, t: 'Cuota hipoteca ' + (h.banco || '') + ' · ' + U.eur(regs[ym].cuotaPagada), st: 'pagado', go: '#/vivienda/' + h.viviendaId + '/hipoteca' });
        else if (!inf.cancelada && ym >= inf.prox && (!inf.fin || ym <= inf.fin)) E.push({ f, tipo: 'Hipoteca', vid: h.viviendaId, t: 'Cuota hipoteca ' + (h.banco || '') + ' · ' + U.eur(inf.cuota), st: st(false, f), go: '#/vivienda/' + h.viviendaId + '/hipoteca' });
      });
    });
    DB.S.gastos.filter(g => ok(g) && U.inR(g.fecha, from, to)).forEach(g => {
      const tipo = /comunidad/i.test(g.categoria) ? 'Comunidad' : g.categoria === 'IBI' ? 'IBI' : /seguro/i.test(g.categoria) ? 'Seguro' : g.categoria === 'Derramas' ? 'Derrama' : 'Gasto';
      E.push({ f: g.fecha, tipo, vid: g.viviendaId, t: (g.concepto || g.categoria) + ' · ' + U.eur(g.importe), st: st(!!g.pagado, g.fecha), go: '#/vivienda/' + g.viviendaId + '/gastos' });
    });
    DB.S.derramas.filter(ok).forEach(d => (d.cuotas || []).filter(q => U.inR(q.fecha, from, to)).forEach(q => {
      E.push({ f: q.fecha, tipo: 'Derrama', vid: d.viviendaId, t: 'Derrama ' + (d.concepto || '') + ' ' + q.n + '/' + d.cuotas.length + ' · ' + U.eur(q.importe), st: st(q.pagada, q.fecha), go: '#/vivienda/' + d.viviendaId + '/derramas' });
    }));
    DB.S.contratos.filter(c => ok(c) && c.estado === 'activo').forEach(c => {
      if (U.inR(c.fechaVencimiento, from, to)) {
        const venc = C.vencido(c);
        E.push({ f: c.fechaVencimiento, tipo: 'Fin de contrato', vid: c.viviendaId, t: (venc ? 'VENCIDO — ' : 'Fin de contrato — ') + C.nomInq(c.inquilinoId), st: venc ? 'vencido' : st(false, c.fechaVencimiento), go: '#/vivienda/' + c.viviendaId + '/contrato' });
      }
      if (U.inR(c.proximaRevision, from, to)) E.push({ f: c.proximaRevision, tipo: 'Revisión de renta', vid: c.viviendaId, t: 'Revisión de renta' + (c.indice ? ' (' + c.indice + ')' : ''), st: st(false, c.proximaRevision), go: '#/vivienda/' + c.viviendaId + '/contrato' });
    });
    DB.S.incidencias.filter(ok).forEach(i => {
      if (U.inR(i.fecha, from, to)) E.push({ f: i.fecha, tipo: 'Reparación', vid: i.viviendaId, t: 'Incidencia: ' + (i.problema || ''), st: i.estado === 'Resuelto' ? 'pagado' : (i.fecha < hoy ? 'atrasado' : 'pendiente'), go: '#/vivienda/' + i.viviendaId + '/incidencias' });
      if (i.fechaReparacion && i.fechaReparacion !== i.fecha && U.inR(i.fechaReparacion, from, to)) E.push({ f: i.fechaReparacion, tipo: 'Reparación', vid: i.viviendaId, t: 'Reparación: ' + (i.problema || ''), st: i.estado === 'Resuelto' ? 'pagado' : st(false, i.fechaReparacion), go: '#/vivienda/' + i.viviendaId + '/incidencias' });
    });
    return E.sort((a, b) => a.f.localeCompare(b.f));
  },
  proximoVencimiento(vid) {
    const hoy = C.hoy();
    const e = C.eventos(hoy, U.addMonths(hoy, 12), vid).filter(x => x.st !== 'pagado');
    return e[0] || null;
  },

  /* ---------- Buscador ---------- */
  buscar(q) {
    const words = U.norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const res = [];
    const test = parts => {
      const txt = U.norm(parts.filter(x => x !== null && x !== undefined).map(x => {
        const s = String(x);
        return /^\d{4}-\d{2}(-\d{2})?$/.test(s) ? s + ' ' + (s.length > 7 ? U.fdate(s) : U.fmonth(s)) : s;
      }).join(' '));
      return words.every(w => txt.includes(w));
    };
    const add = (tipo, o, titulo, sub, fecha, importe, go) => res.push({ tipo, titulo, sub, fecha, importe, go });
    DB.S.viviendas.forEach(v => { if (test([v.nombre, v.direccion, v.municipio, v.provincia, v.ref, v.notas])) add('Vivienda', v, v.nombre, [v.direccion, v.municipio].filter(Boolean).join(', '), null, null, '#/vivienda/' + v.id + '/resumen'); });
    DB.S.inquilinos.forEach(i => { if (test([i.nombre, i.telefono, i.email, i.obs, i.entrada, i.salida, C.nomViv(i.viviendaId)])) add('Inquilino', i, i.nombre, C.nomViv(i.viviendaId), i.entrada, null, '#/vivienda/' + i.viviendaId + '/inquilino'); });
    DB.S.contratos.forEach(c => { if (test(['contrato', C.nomInq(c.inquilinoId), C.nomViv(c.viviendaId), c.fechaFirma, c.fechaInicio, c.fechaVencimiento, c.obs, c.indice, C.estadoContrato(c)])) add('Contrato', c, 'Contrato ' + C.nomInq(c.inquilinoId), C.nomViv(c.viviendaId) + ' · ' + C.estadoContrato(c), c.fechaInicio, c.rentaActual, '#/vivienda/' + c.viviendaId + '/contrato'); });
    DB.S.mensualidades.forEach(m => { if (test(['alquiler', C.nomViv(m.viviendaId), m.mes, m.obs, C.estadoM(m), ...(m.pagos || []).map(p => p.fecha)])) add('Alquiler', m, 'Alquiler ' + U.fmonth(m.mes), C.nomViv(m.viviendaId) + ' · ' + C.estadoM(m), m.fechaPrevista, m.esperado, '#/vivienda/' + m.viviendaId + '/alquileres'); });
    DB.S.suministros.forEach(s => { if (test([SUMIN[s.tipo], C.nomViv(s.viviendaId), s.periodo, s.obs, s.fechaPrevista, s.fechaFactura])) add(SUMIN[s.tipo], s, SUMIN[s.tipo] + ' ' + (s.periodo || ''), C.nomViv(s.viviendaId) + ' · ' + C.estadoS(s), s.fechaPrevista, s.coste, '#/vivienda/' + s.viviendaId + '/suministros'); });
    DB.S.gastos.forEach(g => { if (test(['gasto', g.concepto, g.categoria, g.proveedor, g.obs, g.fecha, C.nomViv(g.viviendaId)])) add('Gasto', g, g.concepto || g.categoria, C.nomViv(g.viviendaId) + ' · ' + g.categoria + (g.pagado ? '' : ' · pendiente'), g.fecha, g.importe, '#/vivienda/' + g.viviendaId + '/gastos'); });
    DB.S.ingresos.forEach(g => { if (test(['ingreso', g.concepto, g.tipo, g.obs, g.fecha, C.nomViv(g.viviendaId)])) add('Ingreso', g, g.concepto || 'Ingreso', C.nomViv(g.viviendaId), g.fecha, g.importe, '#/alquileres/ingresos'); });
    DB.S.derramas.forEach(d => { if (test(['derrama', d.concepto, d.obs, d.fechaAprobacion, ...(d.cuotas || []).map(q => q.fecha), C.nomViv(d.viviendaId)])) add('Derrama', d, d.concepto, C.nomViv(d.viviendaId), d.fechaAprobacion, d.total, '#/vivienda/' + d.viviendaId + '/derramas'); });
    DB.S.incidencias.forEach(i => { if (test(['incidencia reparacion', i.problema, i.categoria, i.profesional, i.comunica, i.obs, i.estado, i.fecha, i.fechaReparacion, C.nomViv(i.viviendaId)])) add('Incidencia', i, i.problema, C.nomViv(i.viviendaId) + ' · ' + (i.estado || ''), i.fecha, i.costeFinal || i.presupuesto, '#/vivienda/' + i.viviendaId + '/incidencias'); });
    DB.S.hipotecas.forEach(h => { if (test(['hipoteca prestamo', h.banco, h.fechaFormalizacion, h.obs, C.nomViv(h.viviendaId)])) add('Hipoteca', h, h.banco || 'Hipoteca', C.nomViv(h.viviendaId), h.fechaFormalizacion, h.capitalInicial, '#/vivienda/' + h.viviendaId + '/hipoteca'); });
    DB.S.cuotas.forEach(q => { if (test(['cuota hipoteca', q.mes, q.fechaPago, C.nomViv(q.viviendaId)])) add('Cuota hipoteca', q, 'Cuota ' + U.fmonth(q.mes), C.nomViv(q.viviendaId), q.fechaPago, q.cuotaPagada, '#/vivienda/' + q.viviendaId + '/hipoteca'); });
    DB.S.amortizaciones.forEach(a => { if (test(['amortizacion extraordinaria', a.fecha, a.obs, C.nomViv(a.viviendaId)])) add('Amortización', a, 'Amortización extraordinaria', C.nomViv(a.viviendaId), a.fecha, a.importe, '#/vivienda/' + a.viviendaId + '/amortizaciones'); });
    DB.S.documentos.forEach(d => { if (test(['documento', d.nombre, d.tipo, d.notas, d.fecha, C.nomViv(d.viviendaId)])) add('Documento', d, d.nombre, C.nomViv(d.viviendaId) + ' · ' + d.tipo, d.fecha, null, '#/vivienda/' + d.viviendaId + '/documentos'); });
    DB.S.rentas.forEach(r => { if (test(['actualizacion renta', r.motivo, r.obs, r.fecha, C.nomViv(r.viviendaId)])) add('Renta', r, 'Actualización de renta', C.nomViv(r.viviendaId) + ' · ' + U.eur(r.anterior) + ' → ' + U.eur(r.nueva), r.fecha, r.nueva, '#/vivienda/' + r.viviendaId + '/contrato'); });
    return res.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }
};
