'use strict';
/* Almacenamiento local: IndexedDB (preferente) con respaldo en localStorage.
   Todos los datos se cargan en memoria al iniciar (una cartera de <10 viviendas
   es pequeña) y cada cambio se escribe inmediatamente en el almacenamiento. */

const STORES = ['viviendas', 'inquilinos', 'contratos', 'rentas', 'mensualidades', 'suministros', 'ingresos',
  'gastos', 'derramas', 'hipotecas', 'cuotas', 'amortizaciones', 'incidencias', 'documentos'];

const DB = {
  S: {},
  cfg: null,
  mode: 'idb',
  idb: null,
  persistente: false,
  DEF_CFG: {
    id: 'config',
    plazos: [180, 90, 30],      // avisos de vencimiento de contrato (días)
    gracia: 5,                  // días tras la fecha prevista para considerar un alquiler impagado
    seguroDias: 30,             // aviso de seguros / gastos próximos
    revisionDias: 45,           // aviso de revisión de renta
    avisoCopiaDias: 30,         // recordatorio de copia de seguridad
    prorrateo: true,            // prorratear la primera mensualidad del contrato
    catPers: [],                // categorías de gasto personalizadas
    ultimaCopia: null,
    inicio: false               // ya se mostró la bienvenida
  },

  async init() {
    STORES.forEach(s => { this.S[s] = []; });
    try {
      if (!window.indexedDB) throw new Error('IndexedDB no disponible');
      this.idb = await new Promise((res, rej) => {
        const rq = indexedDB.open('control-alquileres', 1);
        rq.onupgradeneeded = () => {
          const db = rq.result;
          [...STORES, 'meta'].forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
        };
        rq.onsuccess = () => res(rq.result);
        rq.onerror = () => rej(rq.error);
        rq.onblocked = () => rej(new Error('IndexedDB bloqueada'));
      });
      for (const s of STORES) this.S[s] = await this._all(s);
      const meta = await this._all('meta');
      this.cfg = Object.assign({}, this.DEF_CFG, meta.find(x => x.id === 'config') || {});
      this.mode = 'idb';
    } catch (e) {
      console.warn('Usando localStorage:', e);
      this.mode = 'ls';
      this.idb = null;
      STORES.forEach(s => {
        try { this.S[s] = JSON.parse(localStorage.getItem('ca_' + s) || '[]'); } catch (_) { this.S[s] = []; }
      });
      let c = {};
      try { c = JSON.parse(localStorage.getItem('ca_config') || '{}'); } catch (_) { /* vacío */ }
      this.cfg = Object.assign({}, this.DEF_CFG, c);
    }
    try {
      if (navigator.storage && navigator.storage.persist) this.persistente = await navigator.storage.persist();
    } catch (_) { /* sin soporte */ }
  },

  _all(s) {
    return new Promise((res, rej) => {
      const rq = this.idb.transaction(s).objectStore(s).getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror = () => rej(rq.error);
    });
  },

  _tx(s, fn) {
    return new Promise((res, rej) => {
      const tx = this.idb.transaction(s, 'readwrite');
      fn(tx.objectStore(s));
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error || new Error('Transacción cancelada'));
    });
  },

  async _persist(s, puts, dels) {
    if (this.mode === 'idb') {
      await this._tx(s, os => {
        (puts || []).forEach(o => os.put(JSON.parse(JSON.stringify(o))));
        (dels || []).forEach(id => os.delete(id));
      });
    } else {
      try { localStorage.setItem('ca_' + s, JSON.stringify(this.S[s])); } catch (e) {
        UI.toast('No hay espacio suficiente en el almacenamiento local. Exporte una copia y elimine documentos pesados.', 'err');
        throw e;
      }
    }
  },

  get(s, id) { return this.S[s].find(x => x.id === id) || null; },

  async put(s, o) {
    if (!o.id) o.id = U.uid();
    o.mod = new Date().toISOString();
    const arr = this.S[s];
    const i = arr.findIndex(x => x.id === o.id);
    if (i >= 0) arr[i] = o; else arr.push(o);
    await this._persist(s, [o]);
    return o;
  },

  async putMany(s, list) {
    if (!list.length) return;
    const now = new Date().toISOString();
    list.forEach(o => {
      if (!o.id) o.id = U.uid();
      o.mod = now;
      const i = this.S[s].findIndex(x => x.id === o.id);
      if (i >= 0) this.S[s][i] = o; else this.S[s].push(o);
    });
    await this._persist(s, list);
  },

  async del(s, id) { return this.delMany(s, [id]); },

  async delMany(s, ids) {
    if (!ids.length) return;
    const set = new Set(ids);
    this.S[s] = this.S[s].filter(x => !set.has(x.id));
    await this._persist(s, [], ids);
  },

  async saveCfg() {
    if (this.mode === 'idb') await this._tx('meta', os => os.put(JSON.parse(JSON.stringify(this.cfg))));
    else localStorage.setItem('ca_config', JSON.stringify(this.cfg));
  },

  dump() {
    const data = {};
    STORES.forEach(s => { data[s] = this.S[s]; });
    return data;
  },

  /** Sustituye toda la información (importación en modo reemplazo). */
  async replaceAll(data, cfg) {
    for (const s of STORES) {
      const list = Array.isArray(data[s]) ? data[s] : [];
      if (this.mode === 'idb') {
        await this._tx(s, os => { os.clear(); list.forEach(o => os.put(o)); });
        this.S[s] = list;
      } else {
        this.S[s] = list;
        await this._persist(s);
      }
    }
    if (cfg) { this.cfg = Object.assign({}, this.DEF_CFG, cfg, { id: 'config' }); await this.saveCfg(); }
  },

  /** Añade o actualiza registros por identificador (importación en modo fusión). */
  async merge(data, cfg) {
    for (const s of STORES) {
      const list = Array.isArray(data[s]) ? data[s] : [];
      if (!list.length) continue;
      list.forEach(o => {
        const i = this.S[s].findIndex(x => x.id === o.id);
        if (i >= 0) this.S[s][i] = o; else this.S[s].push(o);
      });
      await this._persist(s, list);
    }
    if (cfg && Array.isArray(cfg.catPers)) {
      this.cfg.catPers = Array.from(new Set([...(this.cfg.catPers || []), ...cfg.catPers]));
      await this.saveCfg();
    }
  }
};
