'use strict';
/* Formularios y acciones: alta, edición y eliminación de todos los registros. */

const vivOpts = (blank) => [...(blank ? [['', blank]] : []), ...C.vivs().map(v => [v.id, v.nombre])];
const firstViv = () => (C.vivs()[0] || {}).id || '';
const needViv = () => { if (!DB.S.viviendas.length) { UI.toast('Primero cree una vivienda.', 'err'); location.hash = '#/inmuebles'; return true; } return false; };
const pagosSel = (sel) => FORMAS_PAGO.map(x => [x, x]).concat(sel && !FORMAS_PAGO.includes(sel) ? [[sel, sel]] : []);

const F = {
  /* ===================== VIVIENDAS ===================== */
  vivienda(d) {
    const v = d.id ? DB.get('viviendas', d.id) : { estado: 'auto' };
    UI.form({
      title: d.id ? 'Editar vivienda' : 'Nueva vivienda', wide: true, values: Object.assign({ estadoSel: v.estado === 'reservada' || v.estado === 'reforma' ? v.estado : 'auto' }, v),
      fields: [
        { k: 'nombre', l: 'Nombre identificativo', req: true, ph: 'Ej.: Piso Calle Mayor 12' },
        { k: 'ref', l: 'Referencia interna', ph: 'Ej.: V-01' },
        { k: 'direccion', l: 'Dirección', full: true },
        { k: 'municipio', l: 'Municipio' },
        { k: 'provincia', l: 'Provincia' },
        { k: 'estadoSel', l: 'Estado', t: 'select', o: [['auto', 'Automático (alquilada si hay contrato vigente; si no, vacía)'], ['reservada', 'Reservada'], ['reforma', 'En reforma']], full: true },
        { k: 'foto', l: 'Fotografía', t: 'file', accept: 'image/*', help: v.foto ? 'Ya tiene fotografía. Seleccione otra para sustituirla.' : 'Opcional. Se reduce automáticamente.' },
        { k: 'quitarFoto', l: 'Quitar fotografía actual', t: 'checkbox', show: () => !!v.foto },
        { k: 'notas', l: 'Notas', t: 'textarea', full: true }
      ],
      onSubmit: async (x) => {
        const o = d.id ? v : {};
        Object.assign(o, { nombre: x.nombre, ref: x.ref, direccion: x.direccion, municipio: x.municipio, provincia: x.provincia, notas: x.notas, estado: x.estadoSel === 'auto' ? '' : x.estadoSel });
        if (x.foto) o.foto = await U.imgReduce(x.foto);
        if (x.quitarFoto) o.foto = null;
        if (!o.compra) o.compra = {};
        await DB.put('viviendas', o);
        if (!d.id) setTimeout(() => { location.hash = '#/vivienda/' + o.id + '/compra'; }, 0);
      }
    });
  },
  async delVivienda(d) {
    const v = DB.get('viviendas', d.id);
    if (!v) return;
    const n = STORES.filter(s => s !== 'viviendas').reduce((a, s) => a + DB.S[s].filter(x => x.viviendaId === v.id).length, 0);
    if (!await UI.confirm('Se eliminará <b>' + U.esc(v.nombre) + '</b> y <b>' + n + '</b> registros asociados (contratos, inquilinos, cobros, gastos, hipotecas, documentos…). Esta acción no se puede deshacer.<br><br>Recomendación: exporte antes una copia de seguridad.', { ok: 'Eliminar vivienda' })) return;
    for (const s of STORES) {
      if (s === 'viviendas') continue;
      await DB.delMany(s, DB.S[s].filter(x => x.viviendaId === v.id).map(x => x.id));
    }
    await DB.del('viviendas', v.id);
    UI.toast('Vivienda eliminada');
    location.hash = '#/inmuebles';
    App.render();
  },

  /* ===================== INQUILINOS ===================== */
  inquilinoFields() {
    return [
      { k: 'nombre', l: 'Nombre y apellidos', req: true, full: true },
      { k: 'telefono', l: 'Teléfono', t: 'tel' },
      { k: 'email', l: 'Correo electrónico', t: 'email' },
      { k: 'entrada', l: 'Fecha de entrada', t: 'date' },
      { k: 'salida', l: 'Fecha de salida', t: 'date' },
      { k: 'ocupantes', l: 'Número de ocupantes', t: 'number' },
      { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
    ];
  },
  inquilino(d) {
    const o = d.id ? DB.get('inquilinos', d.id) : { viviendaId: d.vid || firstViv() };
    if (!d.id && needViv()) return;
    UI.form({
      title: d.id ? 'Editar inquilino' : 'Nuevo inquilino', values: o,
      fields: [{ k: 'viviendaId', l: 'Vivienda', t: 'select', o: vivOpts(), req: true, full: true }, ...F.inquilinoFields()],
      onDelete: d.id ? () => F.delInquilino(o) : null,
      onSubmit: async x => { Object.assign(o, x); await DB.put('inquilinos', o); }
    });
  },
  async delInquilino(o) {
    const n = DB.S.contratos.filter(c => c.inquilinoId === o.id).length;
    if (n) { UI.toast('No se puede eliminar: el inquilino figura en ' + U.plural(n, 'contrato', 'contratos') + ' del histórico.', 'err'); return; }
    if (!await UI.confirm('¿Eliminar definitivamente al inquilino <b>' + U.esc(o.nombre) + '</b>?')) return;
    await DB.del('inquilinos', o.id); UI.closeAll(); UI.toast('Inquilino eliminado'); App.render();
  },

  /* ===================== CONTRATOS ===================== */
  contratoFields(isNew, vid) {
    const inqs = DB.S.inquilinos.filter(i => i.viviendaId === vid).sort((a, b) => (b.entrada || '').localeCompare(a.entrada || ''));
    return [
      ...(isNew ? [
        { k: 'inquilinoId', l: 'Inquilino', t: 'select', o: [['__nuevo', '➕ Nuevo inquilino'], ...inqs.map(i => [i.id, i.nombre])], req: true, full: true },
        { k: 'inqNombre', l: 'Nombre del nuevo inquilino', req: true, show: x => x.inquilinoId === '__nuevo' },
        { k: 'inqTelefono', l: 'Teléfono', t: 'tel', show: x => x.inquilinoId === '__nuevo' },
        { k: 'inqEmail', l: 'Correo electrónico', t: 'email', show: x => x.inquilinoId === '__nuevo' },
        { k: 'inqOcupantes', l: 'Número de ocupantes', t: 'number', show: x => x.inquilinoId === '__nuevo' }
      ] : [{ k: 'inquilinoId', l: 'Inquilino', t: 'select', o: inqs.map(i => [i.id, i.nombre]), req: true, full: true }]),
      { t: 'section', l: 'Fechas' },
      { k: 'fechaFirma', l: 'Fecha de firma', t: 'date', req: true },
      { k: 'fechaInicio', l: 'Fecha de inicio efectivo', t: 'date', req: true },
      { k: 'duracion', l: 'Duración (meses) — calcula el vencimiento', t: 'number', help: 'Opcional. Vencimiento = inicio + duración − 1 día.' },
      { k: 'fechaVencimiento', l: 'Fecha de vencimiento', t: 'date', req: true },
      { t: 'calc', k: 'durTxt' },
      { t: 'section', l: 'Condiciones económicas' },
      { k: 'rentaInicial', l: 'Renta mensual inicial', t: 'money', req: true },
      { k: 'rentaActual', l: 'Renta mensual actual', t: 'money', req: true, help: 'Para cambios posteriores use «Actualizar renta» y quedará en el histórico.' },
      { k: 'diaPago', l: 'Día habitual de pago', t: 'number', req: true, ph: '1-31' },
      { k: 'fianza', l: 'Fianza', t: 'money', req: true },
      { k: 'garantias', l: 'Garantías adicionales', ph: 'Aval, depósito, seguro de impago…' },
      { k: 'formaPago', l: 'Forma de pago', t: 'select', o: pagosSel() },
      { k: 'cuenta', l: 'Cuenta bancaria utilizada', ph: 'IBAN o alias' },
      { k: 'proximaRevision', l: 'Fecha de próxima revisión de renta', t: 'date' },
      { k: 'indice', l: 'Criterio o índice de actualización', ph: 'Ej.: IRAV, IPC, pacto…' },
      { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
    ];
  },
  contratoChange(x, form, ch) {
    if (ch === 'duracion' || ch === 'fechaInicio') {
      if (x.fechaInicio && x.duracion > 0) UI.set(form, 'fechaVencimiento', U.addDays(U.addMonths(x.fechaInicio, Math.round(x.duracion)), -1));
    }
    if (ch === 'fechaInicio' && x.fechaInicio && !form.elements.proximaRevision.value) UI.set(form, 'proximaRevision', U.addMonths(x.fechaInicio, 12));
    if (ch === 'rentaInicial' && form.elements.rentaActual && !form.elements.rentaActual.dataset.touched) UI.set(form, 'rentaActual', x.rentaInicial);
    if (ch === 'rentaActual') form.elements.rentaActual.dataset.touched = '1';
    const fi = form.elements.fechaInicio.value, fv = form.elements.fechaVencimiento.value;
    let t = '';
    if (fi && fv) {
      if (fv < fi) t = '<span class="neg">El vencimiento es anterior al inicio.</span>';
      else {
        const m = U.monthsDiff(U.ym(fi), U.ym(U.addDays(fv, 1)));
        const d = U.days(U.today(), fv);
        t = 'Duración: <b>' + U.dur(m) + '</b> · ' + (d < 0 ? '<span class="tag vencido">VENCIDO</span> hace ' + (-d) + ' días' : 'faltan <b>' + d + '</b> días para el vencimiento');
      }
    }
    UI.setCalc(form, 'durTxt', t);
  },
  async contrato(d) {
    if (needViv()) return;
    const vid = d.vid || firstViv();
    const isNew = !d.id;
    const o = isNew ? { viviendaId: vid, estado: 'activo', formaPago: 'Transferencia', diaPago: 1, inquilinoId: '__nuevo' } : DB.get('contratos', d.id);
    const act = C.contratoActivo(vid);
    if (isNew && act) {
      if (!await UI.confirm('La vivienda tiene un contrato activo (' + U.esc(C.nomInq(act.inquilinoId)) + ', vence ' + U.fdate(act.fechaVencimiento) + ').<br><br>Al registrar un nuevo contrato, el anterior se marcará como <b>finalizado</b> y quedará en el histórico sin borrarse. ¿Continuar?', { ok: 'Continuar', danger: false })) return;
    }
    UI.form({
      title: isNew ? 'Nuevo contrato — ' + C.nomViv(o.viviendaId) : 'Editar contrato', wide: true, values: o,
      fields: F.contratoFields(isNew, o.viviendaId),
      onChange: F.contratoChange,
      onDelete: isNew ? null : () => F.delContrato(o),
      onSubmit: async x => {
        if (x.fechaVencimiento < x.fechaInicio) { UI.toast('El vencimiento no puede ser anterior al inicio.', 'err'); return false; }
        if (!(x.diaPago >= 1 && x.diaPago <= 31)) { UI.toast('El día de pago debe estar entre 1 y 31.', 'err'); return false; }
        if (isNew && x.inquilinoId === '__nuevo') {
          const inq = await DB.put('inquilinos', { viviendaId: o.viviendaId, nombre: x.inqNombre, telefono: x.inqTelefono, email: x.inqEmail, ocupantes: x.inqOcupantes, entrada: x.fechaInicio });
          x.inquilinoId = inq.id;
        } else if (isNew) {
          const inq = DB.get('inquilinos', x.inquilinoId);
          if (inq && !inq.entrada) { inq.entrada = x.fechaInicio; await DB.put('inquilinos', inq); }
        }
        ['inqNombre', 'inqTelefono', 'inqEmail', 'inqOcupantes', 'duracion'].forEach(k => delete x[k]);
        x.diaPago = Math.round(x.diaPago);
        if (isNew && act) {
          act.estado = 'finalizado';
          act.fechaFin = act.fechaFin || U.addDays(x.fechaInicio, -1);
          act.motivoFin = act.motivoFin || 'Sustituido por nuevo contrato';
          act.rentaFinal = act.rentaActual;
          await DB.put('contratos', act);
          await F.limpiarMeses(act);
        }
        const old = Object.assign({}, o);
        Object.assign(o, x);
        if (!isNew && old.fechaVencimiento !== o.fechaVencimiento) {
          o.cambiosVenc = (o.cambiosVenc || []).concat([{ fecha: U.today(), anterior: old.fechaVencimiento, nuevo: o.fechaVencimiento }]);
        }
        await DB.put('contratos', o);
        if (!isNew && old.fechaInicio !== o.fechaInicio) {
          await DB.delMany('mensualidades', DB.S.mensualidades.filter(m => m.contratoId === o.id && !(m.pagos || []).length && m.mes < U.ym(o.fechaInicio)).map(m => m.id));
        }
        await C.syncMensualidades(o.id);
        const v = DB.get('viviendas', o.viviendaId);
        if (v && v.vaciaDesde && o.estado === 'activo') { v.vaciaDesde = ''; await DB.put('viviendas', v); }
      }
    });
  },
  async delContrato(o) {
    const pag = DB.S.mensualidades.filter(m => m.contratoId === o.id && (m.pagos || []).length).length;
    if (!await UI.confirm('¿Eliminar este contrato del histórico? Se eliminarán también sus mensualidades (' + pag + ' con cobros registrados) y sus actualizaciones de renta. El inquilino se conserva.', { ok: 'Eliminar contrato' })) return;
    await DB.delMany('mensualidades', DB.S.mensualidades.filter(m => m.contratoId === o.id).map(m => m.id));
    await DB.delMany('rentas', DB.S.rentas.filter(r => r.contratoId === o.id).map(r => r.id));
    await DB.del('contratos', o.id);
    UI.closeAll(); UI.toast('Contrato eliminado'); App.render();
  },
  /** Elimina mensualidades sin cobros posteriores al fin del contrato */
  async limpiarMeses(c) {
    const finYm = U.ym(c.fechaFin);
    await DB.delMany('mensualidades', DB.S.mensualidades.filter(m => m.contratoId === c.id && m.mes > finYm && !(m.pagos || []).length).map(m => m.id));
  },
  finalizar(d) {
    const c = DB.get('contratos', d.id);
    UI.form({
      title: 'Finalizar contrato', values: { fechaFin: U.today(), motivo: 'Fin de plazo', fianzaDevuelta: c.fianza },
      intro: 'El contrato pasará al histórico. El inquilino y todos sus cobros se conservan. La vivienda quedará como <b>vacía</b> desde el día siguiente.',
      fields: [
        { k: 'fechaFin', l: 'Fecha de finalización / salida', t: 'date', req: true },
        { k: 'motivo', l: 'Motivo de finalización', t: 'select', o: ['Fin de plazo', 'Desistimiento del inquilino', 'Resolución por impago', 'Mutuo acuerdo', 'Venta de la vivienda', 'Otro'] },
        { k: 'fianzaDevuelta', l: 'Fianza devuelta', t: 'money' },
        { k: 'alquilerPrevisto', l: 'Alquiler previsto para el próximo inquilino', t: 'money', help: 'Se usa para calcular los ingresos dejados de percibir mientras esté vacía.' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
      ],
      onSubmit: async x => {
        c.estado = 'finalizado'; c.fechaFin = x.fechaFin; c.motivoFin = x.motivo; c.rentaFinal = c.rentaActual; c.fianzaDevuelta = x.fianzaDevuelta;
        if (x.obs) c.obsFin = x.obs;
        await DB.put('contratos', c);
        await F.limpiarMeses(c);
        const inq = DB.get('inquilinos', c.inquilinoId);
        if (inq && !inq.salida) { inq.salida = x.fechaFin; await DB.put('inquilinos', inq); }
        const v = DB.get('viviendas', c.viviendaId);
        v.vaciaDesde = U.addDays(x.fechaFin, 1);
        if (x.alquilerPrevisto) v.alquilerPrevisto = x.alquilerPrevisto;
        await DB.put('viviendas', v);
      }
    });
  },
  renovar(d) {
    const c = DB.get('contratos', d.id);
    const nv = U.addDays(U.addMonths(U.addDays(c.fechaVencimiento, 1), 12), -1);
    UI.form({
      title: 'Renovación o prórroga', values: { tipo: 'prorroga', nuevoVenc: nv, renta: c.rentaActual, fechaFirma: U.today() },
      intro: '<b>Prórroga</b>: se amplía el mismo contrato y queda registrado el cambio de fecha.<br><b>Renovación</b>: el contrato actual queda como «Renovado» en el histórico y se crea uno nuevo desde el día siguiente al vencimiento.',
      fields: [
        { k: 'tipo', l: 'Tipo', t: 'select', o: [['prorroga', 'Prórroga del contrato actual'], ['renovacion', 'Renovación (nuevo contrato)']], full: true },
        { k: 'nuevoVenc', l: 'Nueva fecha de vencimiento', t: 'date', req: true },
        { k: 'renta', l: 'Renta mensual a partir de la renovación', t: 'money', req: true },
        { k: 'fechaFirma', l: 'Fecha de firma de la renovación', t: 'date', show: x => x.tipo === 'renovacion' },
        { k: 'motivoRenta', l: 'Motivo del cambio de renta', ph: 'Ej.: actualización anual', show: x => x.tipo === 'prorroga' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
      ],
      onSubmit: async x => {
        if (x.nuevoVenc <= c.fechaVencimiento) { UI.toast('La nueva fecha debe ser posterior al vencimiento actual.', 'err'); return false; }
        if (x.tipo === 'prorroga') {
          c.prorrogas = (c.prorrogas || []).concat([{ fecha: U.today(), anterior: c.fechaVencimiento, nuevo: x.nuevoVenc, obs: x.obs }]);
          c.fechaVencimiento = x.nuevoVenc;
          await DB.put('contratos', c);
          if (x.renta !== +c.rentaActual) await F.aplicarRenta(c, U.addDays(c.prorrogas[c.prorrogas.length - 1].anterior, 1), x.renta, x.motivoRenta || 'Prórroga', x.obs);
          await C.syncMensualidades(c.id);
        } else {
          const ini = U.addDays(c.fechaVencimiento, 1);
          c.estado = 'renovado'; c.rentaFinal = c.rentaActual; c.motivoFin = 'Renovación'; c.fechaFin = c.fechaVencimiento;
          await DB.put('contratos', c);
          const n = Object.assign({}, c, { id: U.uid(), estado: 'activo', fechaFirma: x.fechaFirma || U.today(), fechaInicio: ini, fechaVencimiento: x.nuevoVenc, rentaInicial: x.renta, rentaActual: x.renta, renovacionDe: c.id, obs: x.obs, prorrogas: [], cambiosVenc: [], motivoFin: '', fechaFin: '', rentaFinal: null, proximaRevision: U.addMonths(ini, 12) });
          delete n.mod;
          await DB.put('contratos', n);
          // Las mensualidades ya generadas desde el inicio de la renovación pasan al nuevo contrato
          const mover = DB.S.mensualidades.filter(m => m.contratoId === c.id && m.mes > U.ym(c.fechaVencimiento));
          mover.forEach(m => { m.contratoId = n.id; if (!(m.pagos || []).length) m.esperado = x.renta; });
          await DB.putMany('mensualidades', mover);
          await C.syncMensualidades(n.id);
        }
      }
    });
  },
  async aplicarRenta(c, fecha, nueva, motivo, obs) {
    const ant = +c.rentaActual || 0;
    await DB.put('rentas', { viviendaId: c.viviendaId, contratoId: c.id, fecha, anterior: ant, nueva, motivo, obs });
    c.rentaActual = nueva;
    await DB.put('contratos', c);
    const desde = U.ym(fecha);
    const upd = DB.S.mensualidades.filter(m => m.contratoId === c.id && m.mes >= desde && !(m.pagos || []).length && !m.exonerado);
    upd.forEach(m => { m.esperado = nueva; });
    await DB.putMany('mensualidades', upd);
  },
  actualizarRenta(d) {
    const c = DB.get('contratos', d.id);
    UI.form({
      title: 'Actualizar renta', values: { fecha: c.proximaRevision || U.today(), anterior: c.rentaActual, siguiente: c.proximaRevision ? U.addMonths(c.proximaRevision, 12) : '' },
      intro: 'Las mensualidades sin cobros a partir del mes indicado se actualizarán con la nueva renta.',
      fields: [
        { k: 'fecha', l: 'Fecha de efecto', t: 'date', req: true },
        { k: 'anterior', l: 'Renta anterior', t: 'money', attrs: 'readonly' },
        { k: 'nueva', l: 'Renta nueva', t: 'money', req: true },
        { t: 'calc', k: 'var' },
        { k: 'motivo', l: 'Motivo', ph: 'Ej.: actualización anual según índice pactado', full: true },
        { k: 'siguiente', l: 'Próxima revisión', t: 'date' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
      ],
      onChange: (x, form) => {
        UI.setCalc(form, 'var', x.nueva && x.anterior ? 'Variación: <b>' + U.eur(x.nueva - x.anterior) + '</b> (' + U.pct((x.nueva - x.anterior) / x.anterior * 100) + ')' : '');
      },
      onSubmit: async x => {
        await F.aplicarRenta(c, x.fecha, x.nueva, x.motivo, x.obs);
        if (x.siguiente) { c.proximaRevision = x.siguiente; await DB.put('contratos', c); }
      }
    });
  },
  async delRenta(d) {
    const r = DB.get('rentas', d.id);
    if (!await UI.confirm('¿Eliminar este registro del histórico de rentas? La renta actual del contrato no se modifica.')) return;
    await DB.del('rentas', r.id); UI.toast('Eliminado'); App.render();
  },

  /* ===================== MENSUALIDADES Y COBROS ===================== */
  cobrar(d) {
    if (needViv()) return;
    const limite = U.ymAdd(U.ym(U.today()), 3);
    const pend = vid => C.pendientesLista(vid).filter(m => m.mes <= limite).map(m => [m.id, U.fmonth(m.mes) + ' — pendiente ' + U.eur(C.pendM(m)) + ' (' + C.estadoM(m) + (C.exigible(m) ? '' : ', anticipado') + ')']);
    const conPend = C.vivs().filter(v => C.pendienteAlquiler(v.id) > 0);
    let vid = d.vid || (conPend[0] || C.vivs()[0]).id;
    const first = (d.mid && DB.get('mensualidades', d.mid)) || C.pendientesLista(vid)[0];
    if (first) vid = first.viviendaId;
    const c = C.contratoActivo(vid);
    UI.form({
      title: 'Cobrar alquiler', submit: 'Registrar cobro', okMsg: 'Cobro registrado',
      values: { viviendaId: vid, mid: first ? first.id : '', importe: first ? C.pendM(first) : null, fecha: U.today(), forma: (c && c.formaPago) || 'Transferencia' },
      fields: [
        { k: 'viviendaId', l: 'Vivienda', t: 'select', o: C.vivs().map(v => [v.id, v.nombre + (C.pendienteAlquiler(v.id) > 0 ? ' · ' + U.eur(C.pendienteAlquiler(v.id)) + ' pendiente' : '')]), full: true },
        { k: 'mid', l: 'Mensualidad', t: 'select', o: pend(vid).length ? pend(vid) : [['', 'No hay mensualidades pendientes']], full: true },
        { k: 'importe', l: 'Importe cobrado', t: 'money', req: true },
        { k: 'fecha', l: 'Fecha de cobro', t: 'date', req: true },
        { k: 'forma', l: 'Forma de pago', t: 'select', o: pagosSel() },
        { k: 'nota', l: 'Nota', ph: 'Opcional' },
        { t: 'calc', k: 'info' }
      ],
      onChange: (x, form, ch) => {
        if (ch === 'viviendaId') {
          const opts = pend(x.viviendaId);
          UI.setOptions(form, 'mid', opts.length ? opts : [['', 'No hay mensualidades pendientes']], opts.length ? opts[0][0] : '');
          const cc = C.contratoActivo(x.viviendaId);
          if (cc && cc.formaPago) UI.set(form, 'forma', cc.formaPago);
        }
        const m = DB.get('mensualidades', form.elements.mid.value);
        if ((ch === 'viviendaId' || ch === 'mid') && m) UI.set(form, 'importe', C.pendM(m));
        const imp = U.num(form.elements.importe.value) || 0;
        let info = '';
        if (m) {
          const p = C.pendM(m);
          if (imp < p - 0.004 && imp > 0) info = 'Se registrará como <b>pago parcial</b>. Quedarán pendientes ' + U.eur(p - imp) + '.';
          else if (imp > p + 0.004) info = 'El exceso (' + U.eur(imp - p) + ') se aplicará a las siguientes mensualidades pendientes, por orden.';
          else info = 'La mensualidad quedará <b>pagada</b>.';
        }
        UI.setCalc(form, 'info', info);
      },
      onSubmit: async x => {
        if (!x.mid) { UI.toast('No hay ninguna mensualidad pendiente en esa vivienda.', 'err'); return false; }
        if (!(x.importe > 0)) { UI.toast('Indique un importe mayor que cero.', 'err'); return false; }
        let resto = x.importe;
        const lista = C.pendientesLista(x.viviendaId);
        const ordered = [DB.get('mensualidades', x.mid), ...lista.filter(m => m.id !== x.mid)];
        const touched = [];
        for (const m of ordered) {
          if (resto <= 0.004) break;
          const p = C.pendM(m);
          if (p <= 0) continue;
          const imp = U.r2(Math.min(p, resto));
          m.pagos = (m.pagos || []).concat([{ id: U.uid(), fecha: x.fecha, importe: imp, forma: x.forma, nota: x.nota }]);
          resto = U.r2(resto - imp);
          touched.push(m);
        }
        if (resto > 0.004) {
          const last = touched[touched.length - 1];
          last.pagos[last.pagos.length - 1].importe = U.r2(last.pagos[last.pagos.length - 1].importe + resto);
          UI.toast('Sobrante de ' + U.eur(resto) + ' anotado en la última mensualidad (pago a cuenta).', 'warn');
        }
        await DB.putMany('mensualidades', touched);
      }
    });
  },
  mensualidad(d) {
    const m = d.id ? DB.get('mensualidades', d.id) : { viviendaId: d.vid, mes: U.ym(U.today()), pagos: [], exonerado: false };
    const c = C.contratoActivo(m.viviendaId || d.vid);
    if (!d.id && !c) { UI.toast('La vivienda no tiene contrato activo.', 'err'); return; }
    if (!d.id) { m.contratoId = c.id; m.esperado = c.rentaActual; }
    const pagos = (m.pagos || []);
    UI.form({
      title: d.id ? 'Mensualidad ' + U.fmonth(m.mes) : 'Añadir mensualidad', values: Object.assign({ fechaPrevista: m.fechaPrevista || U.ymDay(m.mes, c ? c.diaPago : 1) }, m),
      fields: [
        { k: 'mes', l: 'Mes', t: 'month', req: true },
        { k: 'esperado', l: 'Importe esperado', t: 'money', req: true },
        { k: 'fechaPrevista', l: 'Fecha prevista de pago', t: 'date', req: true },
        { k: 'exonerado', l: 'Exonerado (no se reclama este mes)', t: 'checkbox' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true },
        { t: 'html', html: d.id ? '<div class="sub-h">Cobros registrados</div>' + (pagos.length ? '<ul class="plist">' + pagos.map(p => '<li><span>' + U.fdate(p.fecha) + ' · ' + U.eur(p.importe) + (p.forma ? ' · ' + U.esc(p.forma) : '') + (p.nota ? ' · ' + U.esc(p.nota) : '') + '</span>' + UI.ibtn('🗑', 'Eliminar cobro', 'delPago', { store: 'mensualidades', id: m.id, pid: p.id }) + '</li>').join('') + '</ul>' : '<p class="muted">Sin cobros.</p>') : '' }
      ],
      onDelete: d.id ? async () => {
        if (!await UI.confirm('¿Eliminar la mensualidad de ' + U.fmonth(m.mes) + (pagos.length ? ' y sus ' + pagos.length + ' cobros' : '') + '?')) return;
        await DB.del('mensualidades', m.id); UI.closeAll(); App.render();
      } : null,
      onSubmit: async x => {
        if (!d.id && DB.S.mensualidades.some(o => o.viviendaId === m.viviendaId && o.mes === x.mes)) { UI.toast('Ya existe una mensualidad para ese mes.', 'err'); return false; }
        Object.assign(m, x); await DB.put('mensualidades', m);
      }
    });
  },
  async delPago(d) {
    const o = DB.get(d.store, d.id);
    if (!await UI.confirm('¿Eliminar este cobro?')) return;
    o.pagos = (o.pagos || []).filter(p => p.id !== d.pid);
    await DB.put(d.store, o);
    UI.closeAll(); UI.toast('Cobro eliminado'); App.render();
  },

  /* ===================== OTROS INGRESOS ===================== */
  ingreso(d) {
    if (!d.id && needViv()) return;
    const o = d.id ? DB.get('ingresos', d.id) : { viviendaId: d.vid || firstViv(), fecha: U.today(), tipo: 'Otros ingresos' };
    UI.form({
      title: d.id ? 'Editar ingreso' : 'Otro ingreso', values: o,
      fields: [
        { k: 'viviendaId', l: 'Vivienda', t: 'select', o: vivOpts(), req: true, full: true },
        { k: 'tipo', l: 'Tipo', t: 'select', o: ['Otros ingresos', 'Suministros repercutidos', 'Indemnización', 'Penalización', 'Subvención', 'Garaje / trastero'] },
        { k: 'concepto', l: 'Concepto', req: true },
        { k: 'fecha', l: 'Fecha de cobro', t: 'date', req: true },
        { k: 'importe', l: 'Importe', t: 'money', req: true },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
      ],
      onDelete: d.id ? () => F.del('ingresos', o.id, '¿Eliminar este ingreso?') : null,
      onSubmit: async x => { Object.assign(o, x); await DB.put('ingresos', o); }
    });
  },

  /* ===================== AGUA Y SUMINISTROS ===================== */
  suministro(d) {
    if (!d.id && needViv()) return;
    const tipo = d.tipo || 'agua';
    const o = d.id ? DB.get('suministros', d.id) : { viviendaId: d.vid || firstViv(), tipo, costePagado: true, pagos: [], fechaFactura: U.today(), fechaPrevista: U.today() };
    const pagos = o.pagos || [];
    UI.form({
      title: (d.id ? 'Editar ' : 'Registrar ') + (SUMIN[o.tipo] || 'suministro').toLowerCase(), values: o, wide: true,
      fields: [
        { k: 'viviendaId', l: 'Vivienda', t: 'select', o: vivOpts(), req: true },
        { k: 'tipo', l: 'Suministro', t: 'select', o: Object.entries(SUMIN) },
        { k: 'periodo', l: 'Periodo', req: true, ph: 'Ej.: 3er trimestre 2026 / septiembre 2026' },
        { k: 'fechaFactura', l: 'Fecha de la factura', t: 'date' },
        { k: 'coste', l: 'Coste total (factura)', t: 'money', req: true, help: 'Importe de la factura de la compañía.' },
        { k: 'costePagado', l: 'La factura la paga el propietario (computa como gasto)', t: 'checkbox' },
        { k: 'repercutido', l: 'Importe repercutido al inquilino', t: 'money', help: 'Lo que debe abonarle el inquilino. Deje 0 si no se repercute.' },
        { k: 'fechaPrevista', l: 'Fecha prevista de pago del inquilino', t: 'date' },
        { k: 'cobroInicial', l: 'Importe ya cobrado ahora', t: 'money', show: () => !d.id },
        { k: 'fechaCobro', l: 'Fecha de cobro', t: 'date', show: x => !d.id && x.cobroInicial > 0 },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true },
        { t: 'calc', k: 'res' },
        { t: 'html', html: d.id ? '<div class="sub-h">Cobros al inquilino</div>' + (pagos.length ? '<ul class="plist">' + pagos.map(p => '<li><span>' + U.fdate(p.fecha) + ' · ' + U.eur(p.importe) + '</span>' + UI.ibtn('🗑', 'Eliminar cobro', 'delPago', { store: 'suministros', id: o.id, pid: p.id }) + '</li>').join('') + '</ul>' : '<p class="muted">Sin cobros.</p>') : '' }
      ],
      onChange: (x, form, ch) => {
        if (ch === 'coste' && !form.elements.repercutido.dataset.touched && x.tipo === 'agua') UI.set(form, 'repercutido', x.coste);
        if (ch === 'repercutido') form.elements.repercutido.dataset.touched = '1';
        if (ch === 'cobroInicial' && !form.elements.fechaCobro.value) UI.set(form, 'fechaCobro', U.today());
        const cob = U.sum(pagos, p => p.importe) + (d.id ? 0 : (x.cobroInicial || 0));
        UI.setCalc(form, 'res', x.repercutido > 0 ? 'Pendiente de cobro al inquilino: <b>' + U.eur(Math.max(0, x.repercutido - cob)) + '</b>' : 'No se repercute al inquilino.');
      },
      onDelete: d.id ? () => F.del('suministros', o.id, '¿Eliminar este registro de ' + (SUMIN[o.tipo] || '').toLowerCase() + ' y sus cobros?') : null,
      onSubmit: async x => {
        const ini = x.cobroInicial, fc = x.fechaCobro;
        delete x.cobroInicial; delete x.fechaCobro;
        Object.assign(o, x);
        if (!d.id && ini > 0) o.pagos = [{ id: U.uid(), fecha: fc || U.today(), importe: ini }];
        await DB.put('suministros', o);
      }
    });
  },
  cobrarSum(d) {
    const s = DB.get('suministros', d.id);
    UI.form({
      title: 'Cobrar ' + (SUMIN[s.tipo] || '').toLowerCase() + ' — ' + (s.periodo || ''), submit: 'Registrar cobro', okMsg: 'Cobro registrado',
      values: { importe: C.pendS(s), fecha: U.today() },
      intro: C.nomViv(s.viviendaId) + ' · Repercutido ' + U.eur(s.repercutido) + ' · Cobrado ' + U.eur(C.cobradoS(s)) + ' · <b>Pendiente ' + U.eur(C.pendS(s)) + '</b>',
      fields: [{ k: 'importe', l: 'Importe cobrado', t: 'money', req: true }, { k: 'fecha', l: 'Fecha de cobro', t: 'date', req: true }],
      onSubmit: async x => {
        if (!(x.importe > 0)) { UI.toast('Importe no válido', 'err'); return false; }
        s.pagos = (s.pagos || []).concat([{ id: U.uid(), fecha: x.fecha, importe: x.importe }]);
        await DB.put('suministros', s);
      }
    });
  },

  /* ===================== GASTOS ===================== */
  gasto(d) {
    if (!d.id && needViv()) return;
    const o = d.id ? DB.get('gastos', d.id) : { viviendaId: d.vid || firstViv(), fecha: U.today(), categoria: d.cat || 'Otros', periodicidad: d.cat === 'Comunidad ordinaria' ? 'mensual' : 'extraordinaria', pagado: true, formaPago: 'Transferencia' };
    const cats = C.cats();
    UI.form({
      title: d.id ? 'Editar gasto' : 'Añadir gasto', values: o, wide: true,
      fields: [
        { k: 'viviendaId', l: 'Vivienda', t: 'select', o: vivOpts(), req: true },
        { k: 'categoria', l: 'Categoría', t: 'select', o: cats.concat(o.categoria && !cats.includes(o.categoria) ? [o.categoria] : []), req: true },
        { k: 'concepto', l: 'Concepto', req: true, full: true, ph: 'Ej.: Recibo IBI 2026' },
        { k: 'fecha', l: 'Fecha', t: 'date', req: true },
        { k: 'importe', l: 'Importe', t: 'money', req: true },
        { k: 'proveedor', l: 'Proveedor' },
        { k: 'periodicidad', l: 'Periodicidad', t: 'select', o: PERIODICIDAD.map(p => [p, U.cap(p)]) },
        { k: 'pagado', l: 'Pagado', t: 'checkbox', help: 'Desmarcado = pendiente de pago (aparecerá en alertas y calendario).' },
        { k: 'formaPago', l: 'Forma de pago', t: 'select', o: pagosSel(o.formaPago) },
        { k: 'repetir', l: 'Generar también las próximas repeticiones (como pendientes)', t: 'checkbox', show: x => !d.id && x.periodicidad !== 'extraordinaria' },
        { k: 'repetirHasta', l: 'Repetir hasta', t: 'date', show: x => !d.id && x.repetir && x.periodicidad !== 'extraordinaria' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
      ],
      onChange: (x, form, ch) => {
        if (ch === 'repetir' && x.repetir && !form.elements.repetirHasta.value) UI.set(form, 'repetirHasta', U.year(x.fecha || U.today()) + '-12-31');
      },
      onDelete: d.id ? () => F.del('gastos', o.id, '¿Eliminar este gasto?') : null,
      onSubmit: async x => {
        const rep = x.repetir, hasta = x.repetirHasta;
        delete x.repetir; delete x.repetirHasta;
        Object.assign(o, x);
        await DB.put('gastos', o);
        if (!d.id && rep && hasta && PER_MESES[x.periodicidad]) {
          const list = [];
          let f = U.addMonths(x.fecha, PER_MESES[x.periodicidad]);
          while (f <= hasta && list.length < 120) {
            list.push(Object.assign({}, o, { id: U.uid(), fecha: f, pagado: false, serie: o.id }));
            f = U.addMonths(f, PER_MESES[x.periodicidad]);
          }
          await DB.putMany('gastos', list);
          if (list.length) UI.toast('Creadas ' + list.length + ' repeticiones pendientes', 'ok');
        }
      }
    });
  },
  async togglePagado(d) {
    const g = DB.get('gastos', d.id);
    g.pagado = !g.pagado;
    if (g.pagado && d.hoy) g.fecha = g.fecha > U.today() ? U.today() : g.fecha;
    await DB.put('gastos', g);
    UI.toast(g.pagado ? 'Marcado como pagado' : 'Marcado como pendiente');
    App.render();
  },
  async del(store, id, msg) {
    if (!await UI.confirm(msg || '¿Eliminar este registro?')) return;
    await DB.del(store, id);
    UI.closeAll(); UI.toast('Eliminado'); App.render();
  },
  delRec(d) { return F.del(d.store, d.id, d.msg); },

  /* ===================== COMUNIDAD ===================== */
  comunidadCfg(d) {
    const v = DB.get('viviendas', d.vid);
    const cfg = v.comunidad || { periodicidad: 'mensual', dia: 1, formaPago: 'Domiciliación' };
    UI.form({
      title: 'Cuota de comunidad — ' + v.nombre, values: Object.assign({ anio: U.year(U.today()), generar: false }, cfg),
      fields: [
        { k: 'importe', l: 'Importe de la cuota ordinaria', t: 'money', req: true },
        { k: 'periodicidad', l: 'Periodicidad', t: 'select', o: ['mensual', 'trimestral', 'semestral', 'anual'].map(p => [p, U.cap(p)]) },
        { k: 'dia', l: 'Día de pago', t: 'number' },
        { k: 'formaPago', l: 'Forma de pago', t: 'select', o: pagosSel(cfg.formaPago) },
        { k: 'proveedor', l: 'Comunidad / administrador', full: true },
        { k: 'generar', l: 'Generar las cuotas del año indicado (como pendientes, salvo las ya vencidas si marca la casilla siguiente)', t: 'checkbox', full: true },
        { k: 'anio', l: 'Año', t: 'number', show: x => x.generar },
        { k: 'vencidasPagadas', l: 'Marcar como pagadas las cuotas con fecha ya pasada', t: 'checkbox', show: x => x.generar }
      ],
      onSubmit: async x => {
        v.comunidad = { importe: x.importe, periodicidad: x.periodicidad, dia: x.dia || 1, formaPago: x.formaPago, proveedor: x.proveedor };
        await DB.put('viviendas', v);
        if (x.generar && x.anio) {
          const step = PER_MESES[x.periodicidad] || 1;
          const list = [];
          for (let m = 1; m <= 12; m += step) {
            const ym = Math.round(x.anio) + '-' + U.z(m);
            if (DB.S.gastos.some(g => g.viviendaId === v.id && g.categoria === 'Comunidad ordinaria' && U.ym(g.fecha) === ym)) continue;
            const f = U.ymDay(ym, x.dia || 1);
            list.push({ viviendaId: v.id, categoria: 'Comunidad ordinaria', concepto: 'Cuota comunidad ' + (step === 1 ? U.fmonth(ym) : step === 3 ? 'T' + ((m - 1) / 3 + 1) + ' ' + x.anio : step === 6 ? 'S' + ((m - 1) / 6 + 1) + ' ' + x.anio : x.anio), fecha: f, importe: x.importe, periodicidad: x.periodicidad, pagado: !!(x.vencidasPagadas && f <= U.today()), formaPago: x.formaPago, proveedor: x.proveedor });
          }
          await DB.putMany('gastos', list);
          UI.toast(list.length + ' cuotas generadas', 'ok');
        }
      }
    });
  },

  /* ===================== DERRAMAS ===================== */
  derrama(d) {
    if (!d.id && needViv()) return;
    const o = d.id ? DB.get('derramas', d.id) : { viviendaId: d.vid || firstViv(), fechaAprobacion: U.today(), numCuotas: 1, periodicidadMeses: 1, cuotas: [] };
    UI.form({
      title: d.id ? 'Editar derrama' : 'Nueva derrama', values: o, wide: true,
      fields: [
        { k: 'viviendaId', l: 'Vivienda', t: 'select', o: vivOpts(), req: true },
        { k: 'concepto', l: 'Concepto', req: true, ph: 'Ej.: Rehabilitación de fachada' },
        { k: 'fechaAprobacion', l: 'Fecha de aprobación', t: 'date' },
        { k: 'total', l: 'Importe total (cuota de la vivienda)', t: 'money', req: true },
        { k: 'numCuotas', l: 'Número de cuotas', t: 'number', req: true },
        { k: 'periodicidadMeses', l: 'Cada cuántos meses', t: 'select', o: [[1, 'Mensual'], [2, 'Bimestral'], [3, 'Trimestral'], [6, 'Semestral'], [12, 'Anual']] },
        { k: 'fechaInicial', l: 'Fecha de la primera cuota', t: 'date', req: true },
        { k: 'importeCuota', l: 'Importe por cuota', t: 'money', help: 'Se calcula automáticamente (total / nº cuotas). Puede modificarlo.' },
        { t: 'calc', k: 'res' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
      ],
      onChange: (x, form, ch) => {
        if ((ch === 'total' || ch === 'numCuotas') && x.total && x.numCuotas > 0) UI.set(form, 'importeCuota', U.r2(x.total / Math.round(x.numCuotas)));
        if (ch === 'importeCuota') form.elements.importeCuota.dataset.touched = '1';
        const n = Math.max(1, Math.round(x.numCuotas || 1));
        const ff = x.fechaInicial ? U.addMonths(x.fechaInicial, (n - 1) * (+x.periodicidadMeses || 1)) : '';
        UI.setCalc(form, 'res', 'Fecha final: <b>' + U.fdate(ff) + '</b>' + (x.importeCuota && x.total && Math.abs(x.importeCuota * n - x.total) > 0.05 ? ' · <span class="neg">Atención: ' + n + ' × ' + U.eur(x.importeCuota) + ' = ' + U.eur(x.importeCuota * n) + ' (difiere del total)</span>' : ''));
      },
      onDelete: d.id ? () => F.del('derramas', o.id, '¿Eliminar esta derrama y el registro de sus cuotas?') : null,
      onSubmit: async (x, form) => {
        const manual = !!form.elements.importeCuota.dataset.touched;
        Object.assign(o, x, { numCuotas: Math.max(1, Math.round(x.numCuotas)), importeCuotaManual: manual });
        if (!o.importeCuota) o.importeCuota = U.r2(o.total / o.numCuotas);
        o.cuotas = C.generarCuotasDerrama(o);
        o.fechaFinal = C.infoDerrama(o).fechaFinal;
        await DB.put('derramas', o);
      }
    });
  },
  async cuotaDerrama(d) {
    const o = DB.get('derramas', d.id);
    const q = o.cuotas.find(x => x.n === +d.n);
    q.pagada = !q.pagada;
    q.fechaPago = q.pagada ? (q.fecha && q.fecha < U.today() ? q.fecha : U.today()) : '';
    await DB.put('derramas', o);
    UI.toast(q.pagada ? 'Cuota marcada como pagada' : 'Cuota marcada como pendiente');
    App.render();
  },

  /* ===================== HIPOTECAS ===================== */
  hipoteca(d) {
    if (!d.id && needViv()) return;
    const o = d.id ? DB.get('hipotecas', d.id) : { viviendaId: d.vid || firstViv(), modalidad: 'fijo', diaCargo: 1 };
    UI.form({
      title: d.id ? 'Editar hipoteca' : 'Nueva hipoteca', wide: true, values: Object.assign({ plazoAnios: o.plazoMeses ? U.r2(o.plazoMeses / 12) : null }, o),
      fields: [
        { k: 'viviendaId', l: 'Vivienda', t: 'select', o: vivOpts(), req: true },
        { k: 'banco', l: 'Banco', req: true },
        { k: 'capitalInicial', l: 'Capital inicial', t: 'money', req: true },
        { k: 'fechaFormalizacion', l: 'Fecha de formalización', t: 'date', req: true },
        { k: 'fechaPrimeraCuota', l: 'Fecha de primera cuota', t: 'date', req: true },
        { k: 'plazoAnios', l: 'Duración inicial (años)', t: 'number' },
        { k: 'plazoMeses', l: 'Número de meses', t: 'number', req: true },
        { k: 'modalidad', l: 'Tipo', t: 'select', o: [['fijo', 'Fijo'], ['variable', 'Variable'], ['mixto', 'Mixto']] },
        { k: 'tipoInteres', l: 'Tipo de interés nominal anual vigente (%)', t: 'number', suf: '%', req: true },
        { k: 'cuota', l: 'Cuota mensual', t: 'money', help: 'Si la deja vacía se calcula por sistema francés con los datos iniciales. Mejor indicar la del recibo.' },
        { k: 'diaCargo', l: 'Día de cargo', t: 'number', req: true },
        { t: 'calc', k: 'cuotaCalc' },
        { t: 'section', l: 'Situación actual', help: 'Si da de alta un préstamo ya avanzado, indique el capital pendiente a una fecha (según el último recibo o certificado del banco). Las cuotas y amortizaciones posteriores se descontarán de ese importe.' },
        { k: 'capitalRef', l: 'Capital pendiente actual', t: 'money', help: 'Vacío = capital inicial.' },
        { k: 'fechaRef', l: 'Fecha a la que corresponde', t: 'date' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
      ],
      onChange: (x, form, ch) => {
        if (ch === 'plazoAnios' && x.plazoAnios) UI.set(form, 'plazoMeses', Math.round(x.plazoAnios * 12));
        if (ch === 'plazoMeses' && x.plazoMeses) UI.set(form, 'plazoAnios', U.r2(x.plazoMeses / 12));
        if (ch === 'fechaFormalizacion' && x.fechaFormalizacion && !form.elements.fechaPrimeraCuota.value) UI.set(form, 'fechaPrimeraCuota', U.addMonths(x.fechaFormalizacion, 1));
        if (ch === 'fechaPrimeraCuota' && x.fechaPrimeraCuota) UI.set(form, 'diaCargo', +x.fechaPrimeraCuota.slice(8, 10));
        const y = UI.read(form);
        let t = '';
        if (y.capitalInicial > 0 && y.plazoMeses > 0 && y.tipoInteres !== null) {
          const q = C.anualidad(y.capitalInicial, y.tipoInteres / 100 / 12, Math.round(y.plazoMeses));
          t = 'Cuota teórica inicial (sistema francés): <b>' + U.eur(q) + '</b>';
          if (y.fechaPrimeraCuota) t += ' · Fin teórico inicial: <b>' + U.fmonth(U.ymAdd(U.ym(y.fechaPrimeraCuota), Math.round(y.plazoMeses) - 1)) + '</b>';
        }
        UI.setCalc(form, 'cuotaCalc', t);
      },
      onDelete: d.id ? async () => {
        if (!await UI.confirm('¿Eliminar esta hipoteca con todas sus cuotas y amortizaciones registradas?')) return;
        await DB.delMany('cuotas', DB.S.cuotas.filter(q => q.hipotecaId === o.id).map(q => q.id));
        await DB.delMany('amortizaciones', DB.S.amortizaciones.filter(q => q.hipotecaId === o.id).map(q => q.id));
        await DB.del('hipotecas', o.id); UI.closeAll(); App.render();
      } : null,
      onSubmit: async x => {
        delete x.plazoAnios;
        x.plazoMeses = Math.round(x.plazoMeses); x.diaCargo = Math.min(31, Math.max(1, Math.round(x.diaCargo)));
        Object.assign(o, x);
        if (!(o.cuota > 0)) o.cuota = U.ceil2(C.anualidad(o.capitalInicial, C.rM(o), o.plazoMeses));
        await DB.put('hipotecas', o);
      }
    });
  },
  hipOpts() { return DB.S.hipotecas.filter(h => !C.infoH(h).cancelada).map(h => [h.id, C.nomViv(h.viviendaId) + ' · ' + (h.banco || 'Hipoteca') + ' · pendiente ' + U.eur(C.pendienteH(h))]); },
  cuota(d) {
    const opts = F.hipOpts();
    if (!opts.length && !d.id) { UI.toast('No hay hipotecas activas registradas.', 'err'); location.hash = '#/hipotecas'; return; }
    const q = d.id ? DB.get('cuotas', d.id) : null;
    let hid = q ? q.hipotecaId : (d.hid || opts[0][0]);
    const sug = (h, mes, pagada) => {
      const inf = C.infoH(h);
      const P = inf.pendiente;
      const it = U.r2(P * inf.r);
      const cp = pagada !== null && pagada !== undefined ? pagada : inf.cuota;
      return { mes: mes || inf.prox, cuotaPrevista: inf.cuota, cuotaPagada: cp, fechaPago: U.ymDay(mes || inf.prox, h.diaCargo), intereses: it, capital: U.r2(Math.min(P, cp - it)), P };
    };
    const h0 = DB.get('hipotecas', hid);
    const vals = q ? Object.assign({ hipotecaId: hid }, q) : Object.assign({ hipotecaId: hid }, sug(h0));
    UI.form({
      title: q ? 'Editar cuota de hipoteca' : 'Registrar cuota de hipoteca', okMsg: 'Cuota registrada', values: vals,
      intro: 'Los importes de intereses y capital se proponen por sistema francés sobre el capital pendiente. <b>Si dispone del recibo del banco, utilice sus cifras.</b>',
      fields: [
        { k: 'hipotecaId', l: 'Hipoteca', t: 'select', o: q ? [[hid, C.nomViv(h0.viviendaId) + ' · ' + (h0.banco || '')]] : opts, full: true },
        { k: 'mes', l: 'Mes', t: 'month', req: true },
        { k: 'fechaPago', l: 'Fecha de pago', t: 'date', req: true },
        { k: 'cuotaPrevista', l: 'Cuota prevista', t: 'money' },
        { k: 'cuotaPagada', l: 'Cuota pagada', t: 'money', req: true },
        { k: 'intereses', l: 'Intereses pagados', t: 'money', req: true },
        { k: 'capital', l: 'Capital amortizado', t: 'money', req: true },
        { t: 'calc', k: 'res' }
      ],
      onChange: (x, form, ch) => {
        const h = DB.get('hipotecas', x.hipotecaId);
        if (!q && (ch === 'hipotecaId')) {
          const s = sug(h);
          ['mes', 'cuotaPrevista', 'cuotaPagada', 'fechaPago', 'intereses', 'capital'].forEach(k => UI.set(form, k, s[k]));
        }
        if (!q && ch === 'mes' && x.mes) UI.set(form, 'fechaPago', U.ymDay(x.mes, h.diaCargo));
        if (ch === 'cuotaPagada' && x.cuotaPagada !== null) UI.set(form, 'capital', U.r2(x.cuotaPagada - (x.intereses || 0)));
        if (ch === 'intereses' && x.cuotaPagada !== null) UI.set(form, 'capital', U.r2(x.cuotaPagada - (x.intereses || 0)));
        const y = UI.read(form);
        const P = q ? C.pendienteH(h) + (+q.capital || 0) : C.pendienteH(h);
        const sumOk = Math.abs((y.intereses || 0) + (y.capital || 0) - (y.cuotaPagada || 0)) < 0.02;
        UI.setCalc(form, 'res', 'Capital pendiente antes: <b>' + U.eur(P) + '</b> · Capital pendiente tras la cuota: <b>' + U.eur(Math.max(0, P - (y.capital || 0))) + '</b>' + (sumOk ? '' : '<br><span class="neg">Intereses + capital (' + U.eur((y.intereses || 0) + (y.capital || 0)) + ') no coincide con la cuota pagada. Si el banco cobra comisiones o seguros en el recibo, es correcto.</span>'));
      },
      onDelete: q ? () => F.del('cuotas', q.id, '¿Eliminar esta cuota? El capital pendiente se recalculará.') : null,
      onSubmit: async x => {
        const h = DB.get('hipotecas', x.hipotecaId);
        if (!q && DB.S.cuotas.some(c => c.hipotecaId === h.id && c.mes === x.mes)) { UI.toast('Ya existe una cuota registrada para ' + U.fmonth(x.mes) + '.', 'err'); return false; }
        const o = q || { hipotecaId: h.id, viviendaId: h.viviendaId };
        Object.assign(o, x, { viviendaId: h.viviendaId });
        await DB.put('cuotas', o);
      }
    });
  },
  /** Registra las cuotas no anotadas hasta el mes actual con el reparto teórico del sistema francés */
  async cuotasTeoricas(d) {
    const h = DB.get('hipotecas', d.hid);
    const inf = C.infoH(h);
    const hoy = U.today(), cur = U.ym(hoy);
    const hasta = d.hasta || (hoy >= U.ymDay(cur, h.diaCargo) ? cur : U.ymAdd(cur, -1));
    if (inf.prox > hasta) { UI.toast('No hay cuotas atrasadas sin registrar.', 'ok'); return; }
    const n = U.monthsDiff(inf.prox, hasta) + 1;
    if (!d.silent && !await UI.confirm('Se registrarán <b>' + n + '</b> cuotas (' + U.fmonth(inf.prox) + ' a ' + U.fmonth(hasta) + ') con la cuota de ' + U.eur(inf.cuota) + ' y el reparto teórico de intereses y capital. Quedarán marcadas como «teóricas» para que pueda corregirlas con los recibos del banco.', { ok: 'Registrar', danger: false })) return;
    let P = inf.pendiente;
    const list = [];
    U.ymRange(inf.prox, hasta).forEach(ym => {
      if (P <= 0.005) return;
      const it = U.r2(P * inf.r);
      const cap = U.r2(Math.min(P, inf.cuota - it));
      P = U.r2(P - cap);
      list.push({ hipotecaId: h.id, viviendaId: h.viviendaId, mes: ym, cuotaPrevista: inf.cuota, cuotaPagada: U.r2(cap + it), fechaPago: U.ymDay(ym, h.diaCargo), intereses: it, capital: cap, teorica: true, demo: h.demo || undefined });
    });
    await DB.putMany('cuotas', list);
    if (!d.silent) { UI.toast(list.length + ' cuotas registradas'); App.render(); }
  },
  amortizacion(d) {
    const opts = F.hipOpts();
    if (!opts.length) { UI.toast('No hay hipotecas activas registradas.', 'err'); location.hash = '#/hipotecas'; return; }
    const hid = d.hid || opts[0][0];
    UI.form({
      title: 'Amortización extraordinaria', okMsg: 'Amortización registrada', values: { hipotecaId: hid, fecha: U.today(), tipo: 'plazo' },
      fields: [
        { k: 'hipotecaId', l: 'Hipoteca', t: 'select', o: opts, full: true },
        { k: 'fecha', l: 'Fecha', t: 'date', req: true },
        { k: 'importe', l: 'Importe amortizado', t: 'money', req: true },
        { k: 'tipo', l: 'Tipo', t: 'select', o: [['plazo', 'Reducción de plazo (se mantiene la cuota)'], ['cuota', 'Reducción de cuota (se mantiene el plazo)']], full: true },
        { k: 'comision', l: 'Comisión cobrada por el banco', t: 'money', help: 'Si la hay, se registrará como gasto (categoría Otros).' },
        { k: 'nuevaCuotaBanco', l: 'Nueva cuota comunicada por el banco', t: 'money', show: x => x.tipo === 'cuota', help: 'Opcional; si la deja vacía se calcula.' },
        { t: 'calc', k: 'prev' },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
      ],
      onChange: (x, form) => {
        const h = DB.get('hipotecas', x.hipotecaId);
        const inf = C.infoH(h);
        const imp = Math.min(x.importe || 0, inf.pendiente);
        const despues = U.r2(inf.pendiente - imp);
        let t = UI.dl([['Capital antes', U.eur(inf.pendiente)], ['Importe amortizado', U.eur(imp)], ['Capital después', '<b>' + U.eur(despues) + '</b>'], ['Cuota actual', U.eur(inf.cuota)], ['Meses restantes actuales', isFinite(inf.meses) ? inf.meses : '—']]);
        if (imp > 0 && inf.cuota) {
          if (x.tipo === 'plazo') {
            const n2 = C.mesesRest(despues, inf.cuota, inf.r);
            t += '<p>Con la misma cuota quedarían <b>' + n2 + '</b> meses (ahorro de <b>' + (inf.meses - n2) + '</b> meses). Fin estimado: <b>' + U.fmonth(U.ymAdd(inf.prox, n2 - 1)) + '</b>.</p>';
          } else {
            const nc = x.nuevaCuotaBanco || U.ceil2(C.anualidad(despues, inf.r, inf.meses));
            t += '<p>Manteniendo ' + inf.meses + ' meses, la nueva cuota sería <b>' + U.eur(nc) + '</b> (−' + U.eur(inf.cuota - nc) + '/mes).</p>';
          }
          t += '<p class="muted">Estimación basada en los datos introducidos.</p>';
        }
        UI.setCalc(form, 'prev', t);
      },
      onSubmit: async x => {
        const h = DB.get('hipotecas', x.hipotecaId);
        const inf = C.infoH(h);
        if (!(x.importe > 0)) { UI.toast('Importe no válido', 'err'); return false; }
        if (x.importe > inf.pendiente + 0.005) { UI.toast('El importe supera el capital pendiente (' + U.eur(inf.pendiente) + ').', 'err'); return false; }
        const despues = U.r2(inf.pendiente - x.importe);
        const a = { hipotecaId: h.id, viviendaId: h.viviendaId, fecha: x.fecha, importe: x.importe, tipo: x.tipo, capitalAntes: inf.pendiente, capitalDespues: despues, cuotaAntes: inf.cuota, mesesAntes: isFinite(inf.meses) ? inf.meses : null, comision: x.comision, obs: x.obs };
        if (x.tipo === 'cuota' && isFinite(inf.meses)) {
          a.cuotaDespues = x.nuevaCuotaBanco || U.ceil2(C.anualidad(despues, inf.r, inf.meses));
          a.mesesDespues = inf.meses;
          h.cuota = a.cuotaDespues;
          await DB.put('hipotecas', h);
        } else {
          a.cuotaDespues = inf.cuota;
          a.mesesDespues = C.mesesRest(despues, inf.cuota, inf.r);
        }
        await DB.put('amortizaciones', a);
        if (x.comision > 0) await DB.put('gastos', { viviendaId: h.viviendaId, categoria: 'Otros', concepto: 'Comisión amortización anticipada ' + (h.banco || ''), fecha: x.fecha, importe: x.comision, pagado: true, periodicidad: 'extraordinaria', formaPago: 'Domiciliación' });
      }
    });
  },
  async delAmort(d) {
    const a = DB.get('amortizaciones', d.id);
    const h = DB.get('hipotecas', a.hipotecaId);
    let msg = '¿Eliminar esta amortización extraordinaria? El capital pendiente se recalculará.';
    if (a.tipo === 'cuota' && h && a.cuotaAntes) msg += '<br><br>La cuota de la hipoteca volverá a ' + U.eur(a.cuotaAntes) + '.';
    if (!await UI.confirm(msg)) return;
    if (a.tipo === 'cuota' && h && a.cuotaAntes) { h.cuota = a.cuotaAntes; await DB.put('hipotecas', h); }
    await DB.del('amortizaciones', a.id);
    UI.toast('Amortización eliminada'); App.render();
  },
  prevista(d) {
    const h = DB.get('hipotecas', d.hid);
    UI.form({
      title: 'Amortización prevista — ' + (h.banco || ''), values: { ym: U.ymAdd(U.ym(U.today()), 6) },
      intro: 'Planificación: no modifica el capital. Se usa para calcular la fecha estimada de cancelación con amortizaciones previstas.',
      fields: [{ k: 'ym', l: 'Mes previsto', t: 'month', req: true }, { k: 'importe', l: 'Importe', t: 'money', req: true }],
      onSubmit: async x => { h.previstas = (h.previstas || []).concat([{ id: U.uid(), ym: x.ym, importe: x.importe }]); await DB.put('hipotecas', h); }
    });
  },
  async delPrevista(d) {
    const h = DB.get('hipotecas', d.hid);
    h.previstas = (h.previstas || []).filter(p => p.id !== d.pid);
    await DB.put('hipotecas', h); App.render();
  },

  /* ===================== INCIDENCIAS ===================== */
  incidencia(d) {
    if (!d.id && needViv()) return;
    const o = d.id ? DB.get('incidencias', d.id) : { viviendaId: d.vid || firstViv(), fecha: U.today(), estado: 'Pendiente', urgencia: 'Media', categoria: 'Fuga de agua' };
    UI.form({
      title: d.id ? 'Editar incidencia' : 'Nueva incidencia', values: o, wide: true,
      fields: [
        { k: 'viviendaId', l: 'Vivienda', t: 'select', o: vivOpts(), req: true },
        { k: 'fecha', l: 'Fecha', t: 'date', req: true },
        { k: 'problema', l: 'Problema', req: true, full: true, ph: 'Describa brevemente la incidencia' },
        { k: 'categoria', l: 'Categoría', t: 'select', o: ['Fuga de agua', 'Caldera', 'Electricidad', 'Cerradura', 'Humedades', 'Electrodomésticos', 'Fontanería', 'Carpintería', 'Pintura', 'Otros'] },
        { k: 'urgencia', l: 'Urgencia', t: 'select', o: ['Baja', 'Media', 'Alta', 'Urgente'] },
        { k: 'comunica', l: 'Quién comunica la incidencia', ph: 'Inquilino, vecino, administrador…' },
        { k: 'profesional', l: 'Profesional contratado' },
        { k: 'presupuesto', l: 'Presupuesto', t: 'money' },
        { k: 'costeFinal', l: 'Coste final', t: 'money' },
        { k: 'fechaReparacion', l: 'Fecha de reparación', t: 'date' },
        { k: 'estado', l: 'Estado', t: 'select', o: ['Pendiente', 'En curso', 'Resuelto'] },
        { k: 'adjunto', l: 'Fotografía o documento', t: 'file', accept: 'image/*,application/pdf', help: 'Se guarda en Documentos de la vivienda.' },
        { k: 'gasto', l: 'Registrar el coste final como gasto pagado (categoría Reparaciones)', t: 'checkbox', show: x => x.costeFinal > 0 && !o.gastoId, full: true },
        { k: 'obs', l: 'Observaciones', t: 'textarea', full: true }
      ],
      onDelete: d.id ? () => F.del('incidencias', o.id, '¿Eliminar esta incidencia? (El gasto asociado, si lo hay, se conserva.)') : null,
      onSubmit: async x => {
        const file = x.adjunto, gasto = x.gasto;
        delete x.adjunto; delete x.gasto;
        Object.assign(o, x);
        await DB.put('incidencias', o);
        if (file) await F.guardarDoc(o.viviendaId, file, { tipo: /^image/.test(file.type) ? 'Fotografías' : 'Presupuestos', nombre: file.name, incidenciaId: o.id, notas: 'Incidencia: ' + o.problema });
        if (gasto && o.costeFinal > 0) {
          const g = await DB.put('gastos', { viviendaId: o.viviendaId, categoria: CAT_REPAR.includes(o.categoria) ? o.categoria : 'Reparaciones', concepto: 'Reparación: ' + o.problema, fecha: o.fechaReparacion || U.today(), importe: o.costeFinal, proveedor: o.profesional, pagado: true, periodicidad: 'extraordinaria', formaPago: 'Transferencia', incidenciaId: o.id });
          o.gastoId = g.id; await DB.put('incidencias', o);
        }
      }
    });
  },

  /* ===================== DOCUMENTOS ===================== */
  async guardarDoc(vid, file, extra) {
    if (file.size > 15 * 1048576) { UI.toast('Archivo demasiado grande (máx. 15 MB).', 'err'); return null; }
    const data = /^image\//.test(file.type) && file.size > 600000 ? await U.imgReduce(file, 1800, 0.85) : await U.readFile(file);
    return DB.put('documentos', Object.assign({ viviendaId: vid, nombre: file.name, fecha: U.today(), mime: file.type, size: Math.round(data.length * 0.75), data }, extra));
  },
  documento(d) {
    if (!d.id && needViv()) return;
    const o = d.id ? DB.get('documentos', d.id) : { viviendaId: d.vid || firstViv(), tipo: d.tipo || 'Contrato de alquiler', fecha: U.today() };
    UI.form({
      title: d.id ? 'Editar documento' : 'Añadir documento', values: o,
      fields: [
        { k: 'viviendaId', l: 'Vivienda', t: 'select', o: vivOpts(), req: true },
        { k: 'tipo', l: 'Tipo', t: 'select', o: TIPOS_DOC },
        { k: 'archivo', l: 'Archivo', t: 'file', req: !d.id, help: d.id ? 'Seleccione otro solo si quiere sustituirlo.' : 'PDF, imagen u otro (máx. 15 MB). Se guarda en este dispositivo.' },
        { k: 'nombre', l: 'Nombre', ph: 'Por defecto, el del archivo' },
        { k: 'fecha', l: 'Fecha', t: 'date' },
        { k: 'notas', l: 'Notas', t: 'textarea', full: true }
      ],
      onDelete: d.id ? () => F.del('documentos', o.id, '¿Eliminar el documento «' + U.esc(o.nombre) + '»?') : null,
      onSubmit: async x => {
        const file = x.archivo; delete x.archivo;
        if (file) {
          const n = await F.guardarDoc(x.viviendaId, file, { tipo: x.tipo, nombre: x.nombre || file.name, fecha: x.fecha, notas: x.notas, id: o.id });
          if (!n) return false;
        } else { Object.assign(o, x, { nombre: x.nombre || o.nombre }); await DB.put('documentos', o); }
      }
    });
  },
  verDoc(d) {
    const o = DB.get('documentos', d.id);
    if (!o || !o.data) return;
    const blob = U.dataUrlToBlob(o.data);
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (!w) U.download(o.nombre || 'documento', blob);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  bajarDoc(d) { const o = DB.get('documentos', d.id); U.download(o.nombre || 'documento', U.dataUrlToBlob(o.data)); },

  /* ===================== DATOS DE LA FICHA ===================== */
  async guardarNotas(d) {
    const v = DB.get('viviendas', d.vid);
    v.notas = document.getElementById('notas-' + v.id).value;
    await DB.put('viviendas', v); UI.toast('Notas guardadas');
  },

  /* ===================== CONFIGURACIÓN Y COPIAS ===================== */
  async exportar() {
    const data = { app: 'control-alquileres', version: 1, exportado: new Date().toISOString(), dispositivo: navigator.userAgent, config: DB.cfg, datos: DB.dump() };
    const json = JSON.stringify(data);
    const name = 'control-alquileres-copia-' + U.today() + '.json';
    DB.cfg.ultimaCopia = new Date().toISOString();
    await DB.saveCfg();
    U.download(name, json, 'application/json');
    UI.toast('Copia exportada: ' + name + ' (' + U.size(json.length) + ')');
    App.render();
  },
  async compartir() {
    const data = { app: 'control-alquileres', version: 1, exportado: new Date().toISOString(), dispositivo: navigator.userAgent, config: DB.cfg, datos: DB.dump() };
    const name = 'control-alquileres-copia-' + U.today() + '.json';
    const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Copia de seguridad', text: 'Copia de Control de Alquileres ' + U.fdate(U.today()) });
        DB.cfg.ultimaCopia = new Date().toISOString(); await DB.saveCfg(); App.render();
      } catch (e) { if (e.name !== 'AbortError') UI.toast('No se pudo compartir: ' + e.message, 'err'); }
    } else {
      UI.toast('Este navegador no permite compartir archivos. Se descargará la copia.', 'warn');
      F.exportar();
    }
  },
  importar() {
    UI.form({
      title: 'Importar copia de seguridad', submit: 'Importar', silent: true,
      intro: 'Seleccione un archivo <b>.json</b> exportado desde esta aplicación (en Android, Windows u otro dispositivo).',
      fields: [
        { k: 'archivo', l: 'Archivo de copia (.json)', t: 'file', accept: '.json,application/json', req: true, full: true },
        { k: 'modo', l: 'Modo de importación', t: 'select', full: true, o: [['reemplazar', 'Reemplazar: borra los datos actuales y carga la copia'], ['fusionar', 'Fusionar: añade la copia y actualiza registros con el mismo identificador']] }
      ],
      onSubmit: async x => {
        let data;
        try { data = JSON.parse(await U.readFile(x.archivo, 'text')); } catch (e) { UI.toast('El archivo no es un JSON válido.', 'err'); return false; }
        if (!data || data.app !== 'control-alquileres' || !data.datos) { UI.toast('El archivo no es una copia de Control de Alquileres.', 'err'); return false; }
        const n = STORES.reduce((a, s) => a + (Array.isArray(data.datos[s]) ? data.datos[s].length : 0), 0);
        const nv = (data.datos.viviendas || []).length;
        if (x.modo === 'reemplazar') {
          if (!await UI.confirm('Se <b>sustituirán todos los datos actuales</b> por la copia del ' + U.fdate((data.exportado || '').slice(0, 10)) + ' (' + nv + ' viviendas, ' + n + ' registros). ¿Continuar?', { ok: 'Reemplazar' })) return false;
          await DB.replaceAll(data.datos, Object.assign({}, data.config, { inicio: true }));
        } else {
          await DB.merge(data.datos, data.config);
        }
        await C.syncMensualidades();
        UI.toast('Copia importada: ' + nv + ' viviendas, ' + n + ' registros');
      }
    });
  },
  async borrarTodo() {
    if (!await UI.confirm('Se borrarán <b>TODOS</b> los datos de este dispositivo. Exporte antes una copia si quiere conservarlos.', { ok: 'Continuar' })) return;
    if (!await UI.confirm('Confirme de nuevo: ¿borrar definitivamente todos los datos?', { ok: 'Borrar todo' })) return;
    await DB.replaceAll({}, Object.assign({}, DB.cfg, { inicio: true }));
    UI.toast('Datos borrados'); location.hash = '#/resumen'; App.render();
  },
  async cfgGuardar() {
    const g = id => document.getElementById(id);
    const plazos = g('cfg-plazos').value.split(/[;,\s]+/).map(Number).filter(x => x > 0).sort((a, b) => b - a);
    if (!plazos.length) { UI.toast('Indique al menos un plazo de aviso.', 'err'); return; }
    Object.assign(DB.cfg, {
      plazos, gracia: Math.max(0, +g('cfg-gracia').value || 0), seguroDias: +g('cfg-seguro').value || 30,
      revisionDias: +g('cfg-revision').value || 30, avisoCopiaDias: +g('cfg-copia').value || 30, prorrateo: g('cfg-prorrateo').checked
    });
    await DB.saveCfg(); UI.toast('Configuración guardada'); App.render();
  },
  async addCat() {
    const el = document.getElementById('cfg-newcat');
    const v = (el.value || '').trim();
    if (!v) return;
    if (C.cats().some(c => U.norm(c) === U.norm(v))) { UI.toast('Esa categoría ya existe.', 'err'); return; }
    DB.cfg.catPers = (DB.cfg.catPers || []).concat([v]);
    await DB.saveCfg(); UI.toast('Categoría añadida'); App.render();
  },
  async delCat(d) {
    const n = DB.S.gastos.filter(g => g.categoria === d.cat).length;
    if (!await UI.confirm('¿Eliminar la categoría «' + U.esc(d.cat) + '»?' + (n ? ' Los ' + n + ' gastos que la usan la conservarán.' : ''))) return;
    DB.cfg.catPers = (DB.cfg.catPers || []).filter(c => c !== d.cat);
    await DB.saveCfg(); App.render();
  },
  async cargarDemo() {
    if (DB.S.viviendas.some(v => v.demo)) { UI.toast('Los datos de ejemplo ya están cargados.', 'warn'); return; }
    await Demo.cargar();
    DB.cfg.inicio = true; await DB.saveCfg();
    UI.closeAll(); UI.toast('Datos de EJEMPLO cargados'); location.hash = '#/resumen'; App.render();
  },
  async borrarDemo() {
    if (!await UI.confirm('¿Eliminar todos los datos marcados como EJEMPLO? Sus propios datos no se tocan.', { ok: 'Eliminar ejemplo' })) return;
    const demoIds = new Set(DB.S.viviendas.filter(v => v.demo).map(v => v.id));
    for (const s of STORES) await DB.delMany(s, DB.S[s].filter(x => x.demo || demoIds.has(x.viviendaId)).map(x => x.id));
    UI.toast('Datos de ejemplo eliminados'); App.render();
  },
  async empezar() { DB.cfg.inicio = true; await DB.saveCfg(); UI.closeAll(); location.hash = '#/inmuebles'; App.render(); },
  async instalar() {
    if (App.installEvt) { App.installEvt.prompt(); const r = await App.installEvt.userChoice; if (r.outcome === 'accepted') UI.toast('Aplicación instalada'); App.installEvt = null; App.render(); }
    else UI.toast('Use el menú del navegador: «Instalar aplicación» o «Añadir a pantalla de inicio».', 'warn');
  },

  /* ===================== NAVEGACIÓN / VARIOS ===================== */
  closeModal() { UI.close(); },
  formDelete(d) { const def = UI.defs[d.fid]; if (def && def.onDelete) def.onDelete(); },
  sort(d) {
    const s = UI.sort[d.tid];
    UI.sort[d.tid] = { k: d.k, dir: s && s.k === d.k && s.dir === 'asc' ? 'desc' : 'asc' };
    App.render();
  },
  go(d) { location.hash = d.to; },
  tab(d) { App.st.tabs[d.g] = d.t; App.render(); },
  print() { window.print(); },
  calMove(d) { App.st.calYm = d.ym ? d.ym : U.ymAdd(App.st.calYm, +d.n); App.render(); },
  resMove(d) { App.st.resMes = U.ymAdd(App.st.resMes, +d.n); App.render(); },
  mas() { document.body.classList.toggle('more-open'); },
  menu() { document.body.classList.toggle('side-open'); },
  quick() {
    UI.modal('<div class="quick-grid">' + V.quickButtons() + '</div>', { title: 'Acción rápida' });
  },
  q(d) { UI.closeAll(); const a = d.a; const args = Object.assign({}, d); delete args.a; F[a](args); },
  csvMovs() {
    const rows = V.histFiltrados();
    U.download('movimientos-' + U.today() + '.csv', U.csv([['Fecha', 'Vivienda', 'Tipo', 'Categoría', 'Concepto', 'Importe', 'Intereses', 'Capital'], ...rows.map(m => [U.fdate(m.fecha), C.nomViv(m.vid), V.TIPO_MOV[m.tipo], m.cat, m.concepto, U.r2(m.tipo === 'ingreso' ? m.importe : -m.importe), m.intereses || '', m.capital || ''])]), 'text/csv');
  },
  csvPanel() {
    const rows = V.panelRows();
    U.download('panel-global-' + U.today() + '.csv', U.csv([['Vivienda', 'Estado', 'Inquilino', 'Fecha contrato', 'Vencimiento', 'Estado contrato', 'Días restantes', 'Alquiler', 'Cobrado mes', 'Pendiente', 'Gastos periodo', 'Flujo periodo', 'Rentabilidad neta 12m %', 'Hipoteca pendiente', 'Valor actual', 'Patrimonio neto'],
      ...rows.map(r => [r.v.nombre, C.ESTADO_TXT[r.estado], r.inq, r.c ? U.fdate(r.c.fechaInicio) : '', r.c ? U.fdate(r.c.fechaVencimiento) : '', r.c ? C.estadoContrato(r.c) : '', r.dias, r.alquiler, r.cobrado, r.pendiente, r.gastos, r.flujo, r.neta === null ? '' : U.r2(r.neta), r.deuda, r.valor, r.patrimonio])]), 'text/csv');
  }
};
