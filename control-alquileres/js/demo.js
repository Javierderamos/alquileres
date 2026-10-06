'use strict';
/* Datos de demostración. TODOS son ficticios, llevan «[EJEMPLO]» en el nombre y la marca demo:true
   para poder eliminarlos de una vez sin tocar los datos reales. Las fechas se calculan respecto a hoy. */

const Demo = {
  async cargar() {
    const hoy = U.today();
    const fm = n => U.ymAdd(U.ym(hoy), n) + '-01';           // día 1 del mes desplazado n meses
    const mk = o => Object.assign({ id: U.uid(), demo: true }, o);
    const put = (s, o) => DB.put(s, o);
    const y = +U.year(hoy);

    /* ---------- Vivienda 1: alquilada, contrato próximo a vencer, con hipoteca ---------- */
    const v1 = mk({
      nombre: '[EJEMPLO] Piso Calle Mayor 12', direccion: 'Calle Mayor 12, 3º B', municipio: 'Villaejemplo', provincia: 'Provincia Ejemplo', ref: 'EJ-01', estado: '',
      notas: 'Vivienda de demostración con datos ficticios.',
      compra: { fecha: U.addDays(fm(-84), 9), precio: 145000, itp: 8700, iva: 0, impuestos: 0, notaria: 850, registro: 450, gestoria: 400, agencia: 3000, reformas: 12000, mobiliario: 3500, electrodomesticos: 2200, otros: 300 },
      valorActual: 185000, valorFecha: fm(-1), valorFuente: 'Estimación propia (ejemplo)',
      comunidad: { importe: 60, periodicidad: 'mensual', dia: 5, formaPago: 'Domiciliación', proveedor: 'CP Calle Mayor 12 (ejemplo)' }
    });
    const i1 = mk({ viviendaId: v1.id, nombre: 'Inquilina Ejemplo Uno', telefono: '600000001', email: 'inquilina1@ejemplo.test', entrada: fm(-19), ocupantes: 2, obs: 'Persona ficticia.' });
    const c1 = mk({
      viviendaId: v1.id, inquilinoId: i1.id, estado: 'activo', fechaFirma: U.addDays(fm(-19), -6), fechaInicio: fm(-19), fechaVencimiento: U.addDays(U.addMonths(fm(-19), 24), -1),
      rentaInicial: 620, rentaActual: 650, diaPago: 5, fianza: 620, garantias: 'Seguro de impago', formaPago: 'Transferencia', cuenta: 'ES00 0000 0000 0000 0000 0000 (ejemplo)',
      proximaRevision: U.addMonths(fm(-7), 12), indice: 'Índice pactado en contrato (ejemplo)', obs: ''
    });
    const r1 = mk({ viviendaId: v1.id, contratoId: c1.id, fecha: fm(-7), anterior: 620, nueva: 650, motivo: 'Actualización anual (ejemplo)' });

    /* ---------- Vivienda 2: contrato VENCIDO sin renovar, impago parcial, derrama ---------- */
    const v2 = mk({
      nombre: '[EJEMPLO] Apartamento Av. del Puerto 5', direccion: 'Avenida del Puerto 5, 1º A', municipio: 'Villaejemplo', provincia: 'Provincia Ejemplo', ref: 'EJ-02', estado: '',
      compra: { fecha: U.addDays(fm(-48), 19), precio: 210000, itp: 12600, iva: 0, impuestos: 0, notaria: 950, registro: 520, gestoria: 450, agencia: 0, reformas: 4500, mobiliario: 2800, electrodomesticos: 1900, otros: 0 },
      valorActual: 240000, valorFecha: fm(-3), valorFuente: 'Portal inmobiliario (ejemplo)',
      comunidad: { importe: 85, periodicidad: 'mensual', dia: 1, formaPago: 'Domiciliación', proveedor: 'CP Av. del Puerto 5 (ejemplo)' }
    });
    const i2 = mk({ viviendaId: v2.id, nombre: 'Inquilino Ejemplo Dos', telefono: '600000002', email: 'inquilino2@ejemplo.test', entrada: fm(-38), ocupantes: 3 });
    const c2 = mk({
      viviendaId: v2.id, inquilinoId: i2.id, estado: 'activo', fechaFirma: U.addDays(fm(-38), -10), fechaInicio: fm(-38), fechaVencimiento: U.addDays(U.addMonths(fm(-38), 36), -1),
      rentaInicial: 700, rentaActual: 720, diaPago: 1, fianza: 700, garantias: 'Aval bancario (ejemplo)', formaPago: 'Transferencia', cuenta: 'ES00 0000 0000 0000 0000 0001 (ejemplo)',
      proximaRevision: fm(-2), indice: 'Índice pactado en contrato (ejemplo)', obs: 'Pendiente de decidir renovación.'
    });
    const r2 = mk({ viviendaId: v2.id, contratoId: c2.id, fecha: fm(-14), anterior: 700, nueva: 720, motivo: 'Actualización anual (ejemplo)' });

    /* ---------- Vivienda 3: VACÍA, con hipoteca y amortización extraordinaria ---------- */
    const v3 = mk({
      nombre: '[EJEMPLO] Estudio Plaza Nueva 3', direccion: 'Plaza Nueva 3, bajo', municipio: 'Otroejemplo', provincia: 'Provincia Ejemplo', ref: 'EJ-03', estado: '',
      compra: { fecha: U.addDays(fm(-30), 14), precio: 98000, itp: 5880, iva: 0, impuestos: 0, notaria: 700, registro: 380, gestoria: 350, agencia: 2500, reformas: 6500, mobiliario: 2100, electrodomesticos: 1400, otros: 0 },
      valorActual: 110000, valorFecha: fm(-2), valorFuente: 'Estimación propia (ejemplo)', vaciaDesde: fm(-2), alquilerPrevisto: 520,
      comunidad: { importe: 45, periodicidad: 'mensual', dia: 10, formaPago: 'Domiciliación', proveedor: 'CP Plaza Nueva 3 (ejemplo)' }
    });
    const i3 = mk({ viviendaId: v3.id, nombre: 'Inquilino Anterior Ejemplo', telefono: '600000003', entrada: fm(-26), salida: U.addDays(fm(-2), -1), ocupantes: 1 });
    const c3 = mk({
      viviendaId: v3.id, inquilinoId: i3.id, estado: 'finalizado', fechaFirma: U.addDays(fm(-26), -3), fechaInicio: fm(-26), fechaVencimiento: U.addDays(U.addMonths(fm(-26), 36), -1),
      rentaInicial: 500, rentaActual: 500, rentaFinal: 500, diaPago: 3, fianza: 500, formaPago: 'Bizum', fechaFin: U.addDays(fm(-2), -1), motivoFin: 'Desistimiento del inquilino', fianzaDevuelta: 500
    });

    for (const v of [v1, v2, v3]) await put('viviendas', v);
    for (const i of [i1, i2, i3]) await put('inquilinos', i);
    for (const c of [c1, c2, c3]) await put('contratos', c);
    for (const r of [r1, r2]) await put('rentas', r);
    await C.syncMensualidades();

    /* Cobros: todo cobrado salvo un pago parcial y una mensualidad pendiente en la vivienda 2 */
    const upd = [];
    DB.S.mensualidades.filter(m => [v1.id, v2.id, v3.id].includes(m.viviendaId) && m.fechaPrevista <= hoy).forEach(m => {
      m.demo = true;
      if (m.viviendaId === v2.id && m.mes === U.ym(fm(0))) { m.pagos = []; }
      else if (m.viviendaId === v2.id && m.mes === U.ym(fm(-1))) { m.pagos = [{ id: U.uid(), fecha: U.addDays(m.fechaPrevista, 6), importe: 400, forma: 'Transferencia', nota: 'Pago parcial (ejemplo)' }]; m.obs = 'El inquilino abonará el resto más adelante (ejemplo)'; }
      else m.pagos = [{ id: U.uid(), fecha: U.addDays(m.fechaPrevista, 1), importe: m.esperado, forma: 'Transferencia' }];
      upd.push(m);
    });
    DB.S.mensualidades.filter(m => [v1.id, v2.id, v3.id].includes(m.viviendaId)).forEach(m => { m.demo = true; if (!upd.includes(m)) upd.push(m); });
    await DB.putMany('mensualidades', upd);

    /* Hipotecas */
    const h1 = mk({ viviendaId: v1.id, banco: 'Banco Ejemplo', capitalInicial: 116000, fechaFormalizacion: v1.compra.fecha, fechaPrimeraCuota: U.addMonths(v1.compra.fecha, 1), plazoMeses: 360, modalidad: 'mixto', tipoInteres: 3.1, diaCargo: +U.addMonths(v1.compra.fecha, 1).slice(8, 10), obs: 'Préstamo ficticio.' });
    h1.cuota = U.ceil2(C.anualidad(h1.capitalInicial, C.rM(h1), h1.plazoMeses));
    const h3 = mk({ viviendaId: v3.id, banco: 'Caja Ejemplo', capitalInicial: 70000, fechaFormalizacion: v3.compra.fecha, fechaPrimeraCuota: U.addMonths(v3.compra.fecha, 1), plazoMeses: 300, modalidad: 'fijo', tipoInteres: 2.9, diaCargo: +U.addMonths(v3.compra.fecha, 1).slice(8, 10) });
    h3.cuota = U.ceil2(C.anualidad(h3.capitalInicial, C.rM(h3), h3.plazoMeses));
    await put('hipotecas', h1); await put('hipotecas', h3);
    await F.cuotasTeoricas({ hid: h1.id, silent: true });
    await F.cuotasTeoricas({ hid: h3.id, silent: true, hasta: U.ym(fm(-6)) });
    const inf3 = C.infoH(h3);
    const am = mk({ hipotecaId: h3.id, viviendaId: v3.id, fecha: U.addDays(fm(-6), 19), importe: 5000, tipo: 'plazo', capitalAntes: inf3.pendiente, capitalDespues: U.r2(inf3.pendiente - 5000), cuotaAntes: inf3.cuota, cuotaDespues: inf3.cuota, mesesAntes: inf3.meses, mesesDespues: C.mesesRest(inf3.pendiente - 5000, inf3.cuota, inf3.r), obs: 'Amortización de ejemplo' });
    await put('amortizaciones', am);
    await F.cuotasTeoricas({ hid: h3.id, silent: true });
    h1.previstas = [{ id: U.uid(), ym: U.ym(U.addMonths(hoy, 5)), importe: 5000 }];
    await put('hipotecas', h1);
    const marcar = DB.S.cuotas.filter(q => [h1.id, h3.id].includes(q.hipotecaId));
    marcar.forEach(q => { q.demo = true; });
    await DB.putMany('cuotas', marcar);

    /* Gastos */
    const G = [];
    [[v1, 60, 5], [v2, 85, 1], [v3, 45, 10]].forEach(([v, imp, dia]) => {
      U.ymRange((y - 1) + '-01', y + '-12').forEach(ym => {
        const f = U.ymDay(ym, dia);
        if (v.compra.fecha > f) return;
        G.push(mk({ viviendaId: v.id, categoria: 'Comunidad ordinaria', concepto: 'Cuota comunidad ' + U.fmonth(ym), fecha: f, importe: imp, proveedor: v.comunidad.proveedor, periodicidad: 'mensual', pagado: f <= hoy, formaPago: 'Domiciliación' }));
      });
    });
    [[v1, 380, '-06-20'], [v2, 520, '-09-15'], [v3, 290, '-07-01']].forEach(([v, imp, md]) => {
      [y - 1, y].forEach(yy => {
        const f = yy + md;
        G.push(mk({ viviendaId: v.id, categoria: 'IBI', concepto: 'IBI ' + yy, fecha: f, importe: imp, proveedor: 'Ayuntamiento (ejemplo)', periodicidad: 'anual', pagado: f <= hoy, formaPago: 'Domiciliación' }));
      });
    });
    const fSeg = U.addDays(hoy, 20);
    G.push(mk({ viviendaId: v1.id, categoria: 'Seguro del inmueble', concepto: 'Seguro hogar (ejemplo)', fecha: U.addMonths(fSeg, -12), importe: 205, proveedor: 'Aseguradora Ejemplo', periodicidad: 'anual', pagado: true, formaPago: 'Domiciliación' }));
    G.push(mk({ viviendaId: v1.id, categoria: 'Seguro del inmueble', concepto: 'Seguro hogar (ejemplo)', fecha: fSeg, importe: 212, proveedor: 'Aseguradora Ejemplo', periodicidad: 'anual', pagado: false, formaPago: 'Domiciliación' }));
    G.push(mk({ viviendaId: v1.id, categoria: 'Seguro de impago', concepto: 'Seguro de impago (ejemplo)', fecha: U.addDays(fm(-4), 2), importe: 230, proveedor: 'Aseguradora Ejemplo', periodicidad: 'anual', pagado: true, formaPago: 'Tarjeta' }));
    G.push(mk({ viviendaId: v2.id, categoria: 'Seguro del inmueble', concepto: 'Seguro hogar (ejemplo)', fecha: U.addDays(fm(-3), 11), importe: 260, proveedor: 'Aseguradora Ejemplo', periodicidad: 'anual', pagado: true, formaPago: 'Domiciliación' }));
    G.push(mk({ viviendaId: v3.id, categoria: 'Seguro del inmueble', concepto: 'Seguro hogar (ejemplo)', fecha: U.addDays(fm(-8), 4), importe: 150, proveedor: 'Aseguradora Ejemplo', periodicidad: 'anual', pagado: true, formaPago: 'Domiciliación' }));
    G.push(mk({ viviendaId: v1.id, categoria: 'Mantenimiento de caldera', concepto: 'Revisión anual de caldera', fecha: U.addDays(fm(-5), 7), importe: 95, proveedor: 'Técnico Ejemplo', periodicidad: 'anual', pagado: true, formaPago: 'Bizum' }));
    G.push(mk({ viviendaId: v2.id, categoria: 'Fontanería', concepto: 'Cambio de grifo de cocina', fecha: U.addDays(fm(-9), 12), importe: 120, proveedor: 'Fontanero Ejemplo', periodicidad: 'extraordinaria', pagado: true, formaPago: 'Efectivo' }));
    G.push(mk({ viviendaId: v3.id, categoria: 'Pintura', concepto: 'Pintura tras salida del inquilino', fecha: U.addDays(fm(-1), 8), importe: 640, proveedor: 'Pintor Ejemplo', periodicidad: 'extraordinaria', pagado: true, formaPago: 'Transferencia' }));
    const gCaldera = mk({ viviendaId: v1.id, categoria: 'Reparaciones', concepto: 'Reparación: caldera sin agua caliente', fecha: U.addDays(fm(-2), 16), importe: 180, proveedor: 'Técnico Ejemplo', periodicidad: 'extraordinaria', pagado: true, formaPago: 'Transferencia' });
    G.push(gCaldera);
    await DB.putMany('gastos', G);

    /* Derrama */
    const d = mk({ viviendaId: v2.id, concepto: 'Rehabilitación de fachada (ejemplo)', fechaAprobacion: U.addDays(fm(-4), 20), total: 1800, numCuotas: 6, periodicidadMeses: 1, fechaInicial: U.addDays(fm(-3), 9), importeCuota: 300, cuotas: [] });
    d.cuotas = C.generarCuotasDerrama(d);
    d.cuotas.forEach(q => { if (q.fecha <= hoy && q.n <= 3) { q.pagada = true; q.fechaPago = q.fecha; } });
    d.fechaFinal = C.infoDerrama(d).fechaFinal;
    await put('derramas', d);

    /* Agua (trimestral) y otros suministros */
    const S = [];
    const costes = [48.3, 52.1, 61.7, 55.4, 49.9, 58.2];
    let curQ = Math.floor((+hoy.slice(5, 7) - 1) / 3);
    let qy = y;
    const quarters = [];
    for (let k = 0; k < 6; k++) { curQ--; if (curQ < 0) { curQ = 3; qy--; } quarters.unshift([qy, curQ]); }
    const validos = quarters.filter(([yy, q]) => U.addDays(U.ymLast(yy + '-' + U.z(q * 3 + 3)), 12) <= hoy);
    validos.forEach(([yy, q], k) => {
      const fin = U.ymLast(yy + '-' + U.z(q * 3 + 3));
      const ff = U.addDays(fin, 12), fp = U.addDays(ff, 15);
      [[v1, costes[k]], [v2, U.r2(costes[k] * 1.3)]].forEach(([v, c], j) => {
        if (v.compra.fecha > fin) return;
        const last = k === validos.length - 1;
        const pagos = last ? (j === 1 ? [{ id: U.uid(), fecha: U.addDays(fp, 2), importe: 30 }] : []) : [{ id: U.uid(), fecha: U.addDays(fp, 3), importe: c }];
        S.push(mk({ viviendaId: v.id, tipo: 'agua', periodo: (q + 1) + 'º trimestre ' + yy, fechaFactura: ff, coste: c, costePagado: true, repercutido: c, fechaPrevista: fp, pagos }));
      });
    });
    S.push(mk({ viviendaId: v1.id, tipo: 'caldera', periodo: U.cap(U.fmonth(U.ym(fm(-1)))), fechaFactura: U.addDays(fm(-1), 14), coste: 34.6, costePagado: true, repercutido: 34.6, fechaPrevista: U.addDays(fm(0), 4), pagos: [] }));
    S.push(mk({ viviendaId: v3.id, tipo: 'electricidad', periodo: U.cap(U.fmonth(U.ym(fm(-1)))) + ' (vivienda vacía)', fechaFactura: U.addDays(fm(-1), 20), coste: 21.4, costePagado: true, repercutido: 0, pagos: [] }));
    await DB.putMany('suministros', S);

    /* Incidencias */
    await put('incidencias', mk({ viviendaId: v3.id, fecha: U.addDays(fm(-1), 3), problema: 'Humedades en el baño', categoria: 'Humedades', urgencia: 'Alta', comunica: 'Propietario (revisión tras salida)', profesional: 'Pendiente de presupuesto', estado: 'Pendiente', obs: 'Revisar antes de volver a alquilar (ejemplo).' }));
    await put('incidencias', mk({ viviendaId: v1.id, fecha: U.addDays(fm(-2), 14), problema: 'Caldera sin agua caliente', categoria: 'Caldera', urgencia: 'Urgente', comunica: 'Inquilina', profesional: 'Técnico Ejemplo', presupuesto: 200, costeFinal: 180, fechaReparacion: U.addDays(fm(-2), 16), estado: 'Resuelto', gastoId: gCaldera.id }));
    await put('incidencias', mk({ viviendaId: v2.id, fecha: U.addDays(hoy, -4), problema: 'Cerradura del portal de la vivienda dura', categoria: 'Cerradura', urgencia: 'Media', comunica: 'Inquilino', profesional: 'Cerrajero Ejemplo', presupuesto: 90, estado: 'En curso' }));
  }
};
