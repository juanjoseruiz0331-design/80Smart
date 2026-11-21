'use strict';
/* 80 SMART — versión HTML independiente.
 * Núcleo: utilidades, almacenamiento en el navegador, contraseñas, permisos, auditoría y motor de inventario.
 * Los datos de cada empresa se guardan en localStorage de ESTE navegador (ver aviso en Configuración → Datos). */
(function () {
  const S = (window.S80 = window.S80 || {});

  // ---------- Utilidades ----------
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  S.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  let uidCounter = 0;
  S.uid = () => {
    const rnd = window.crypto && crypto.getRandomValues ? crypto.getRandomValues(new Uint32Array(2)) : [Math.random() * 4294967296, Math.random() * 4294967296];
    return (Date.now() % 1e9).toString(36) + (uidCounter++ % 1296).toString(36).padStart(2, '0') + (rnd[0] >>> 0).toString(36) + ((rnd[1] >>> 0) % 1296).toString(36);
  };
  S.r2 = (n) => Math.round((+n || 0) * 100) / 100;
  S.r3 = (n) => Math.round((+n || 0) * 1000) / 1000;
  S.money = (n) => '$ ' + Math.round(+n || 0).toLocaleString('es-CO');
  S.num = (n, d = 0) => (+n || 0).toLocaleString('es-CO', { maximumFractionDigits: d });
  S.pct = (n, d = 1) => (isFinite(n) ? (n * 100).toLocaleString('es-CO', { maximumFractionDigits: d }) : '0') + ' %';
  const pad = (n) => String(n).padStart(2, '0');
  S.dayKey = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  };
  S.parseDay = (k) => new Date(k + 'T00:00:00');
  S.today = () => S.dayKey(new Date());
  S.addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };
  S.startOf = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  S.addDayKey = (k, n) => S.dayKey(S.addDays(S.parseDay(k), n));
  S.daysBetween = (a, b) => Math.round((S.parseDay(S.dayKey(b)) - S.parseDay(S.dayKey(a))) / 864e5);
  S.fdate = (d) => {
    if (!d) return '—';
    const x = typeof d === 'string' && d.length === 10 ? S.parseDay(d) : new Date(d);
    return x.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  S.fdt = (d) =>
    d ? new Date(d).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  S.err = (message, code = 'VALIDATION') => Object.assign(new Error(message), { code, isUser: true });
  S.by = (key, dir = 1) => (a, b) => {
    const x = typeof key === 'function' ? key(a) : a[key];
    const y = typeof key === 'function' ? key(b) : b[key];
    return (x > y ? 1 : x < y ? -1 : 0) * dir;
  };
  S.sum = (arr, f) => arr.reduce((s, x) => s + (+f(x) || 0), 0);
  S.mapBy = (arr, k = 'id') => Object.fromEntries(arr.map((x) => [x[k], x]));
  S.mask = (v, keep = 3) => {
    if (!v) return '—';
    const s = String(v);
    if (s.includes('@')) {
      const [u, dom] = s.split('@');
      return u.slice(0, 2) + '•••@' + dom;
    }
    return '•••' + s.slice(-keep);
  };

  // ---------- Almacenamiento ----------
  let lsOk = true;
  const memory = {};
  try {
    localStorage.setItem('__s80', '1');
    localStorage.removeItem('__s80');
  } catch {
    lsOk = false;
  }
  S.storageOk = lsOk;
  S.lsGet = (k) => {
    try {
      const v = lsOk ? localStorage.getItem(k) : memory[k];
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  };
  S.lsRaw = (k) => {
    try {
      return lsOk ? localStorage.getItem(k) : memory[k] ?? null;
    } catch {
      return null;
    }
  };
  S.lsSetRaw = (k, s) => {
    try {
      if (lsOk) localStorage.setItem(k, s);
      else memory[k] = s;
      return true;
    } catch {
      return false;
    }
  };
  S.lsDel = (k) => {
    try {
      if (lsOk) localStorage.removeItem(k);
      else delete memory[k];
    } catch {}
  };
  S.ss = {
    get(k) {
      try {
        const v = sessionStorage.getItem(k);
        return v ? JSON.parse(v) : null;
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        sessionStorage.setItem(k, JSON.stringify(v));
      } catch {}
    },
    del(k) {
      try {
        sessionStorage.removeItem(k);
      } catch {}
    },
  };

  const IDX = 's80h.index';
  const CK = (id) => 's80h.company.' + id;
  S.index = () => S.lsGet(IDX) || { companies: [] };
  S.saveIndex = (idx) => S.lsSetRaw(IDX, JSON.stringify(idx));
  S.loadCompany = (id) => S.lsGet(CK(id));
  S.writeCompany = (db) => {
    const s = JSON.stringify(db);
    if (!S.lsSetRaw(CK(db.company.id), s)) {
      throw S.err('No se pudo guardar: el almacenamiento del navegador está lleno. Exporte un respaldo en Configuración → Datos.', 'STORAGE');
    }
    const idx = S.index();
    const entry = idx.companies.find((c) => c.id === db.company.id);
    if (!entry) idx.companies.push({ id: db.company.id, name: db.company.name, isDemo: !!db.company.isDemo });
    else entry.name = db.company.name;
    S.saveIndex(idx);
    return s;
  };
  S.companyKey = CK;
  S.removeCompany = (id) => {
    S.lsDel(CK(id));
    const idx = S.index();
    idx.companies = idx.companies.filter((c) => c.id !== id);
    S.saveIndex(idx);
  };

  /** Ejecuta una operación como transacción: si falla, la empresa vuelve al último estado guardado. */
  S.tx = (fn) => {
    // Si otra pestaña guardó cambios, se parte de la versión más reciente (evita sobrescribir su trabajo).
    const latest = S.lsRaw(CK(S.db.company.id));
    if (latest && latest !== S._saved) {
      S.db = JSON.parse(latest);
      S._saved = latest;
    }
    try {
      const r = fn(S.db);
      S._saved = S.writeCompany(S.db);
      S.emit('data');
      return r;
    } catch (e) {
      if (S._saved) S.db = JSON.parse(S._saved);
      throw e;
    }
  };

  // ---------- Eventos ----------
  const listeners = {};
  S.on = (ev, fn) => ((listeners[ev] = listeners[ev] || []).push(fn), () => (listeners[ev] = listeners[ev].filter((f) => f !== fn)));
  S.emit = (ev, data) => (listeners[ev] || []).forEach((f) => f(data));

  // ---------- Contraseñas (PBKDF2-SHA256, nunca en texto plano) ----------
  const b64e = (u8) => btoa(String.fromCharCode(...u8));
  const b64d = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  S.cryptoOk = !!(window.crypto && crypto.subtle);
  S.hashPassword = async (pw, saltB64) => {
    if (!S.cryptoOk) throw S.err('Este navegador no permite cifrado seguro (Web Crypto). Use Chrome, Edge o Firefox actualizados.');
    const salt = saltB64 ? b64d(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' }, key, 256);
    return { salt: b64e(salt), hash: b64e(new Uint8Array(bits)) };
  };
  S.verifyPassword = async (pw, rec) => {
    if (!rec) return false;
    const r = await S.hashPassword(pw, rec.salt);
    if (r.hash.length !== rec.hash.length) return false;
    let diff = 0;
    for (let i = 0; i < r.hash.length; i++) diff |= r.hash.charCodeAt(i) ^ rec.hash.charCodeAt(i);
    return diff === 0;
  };
  S.passwordIssue = (pw) => {
    if (!pw || pw.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return 'La contraseña debe combinar mayúsculas, minúsculas y números.';
    return null;
  };

  // ---------- Permisos ----------
  S.PERMISSIONS = [
    ['Dashboard', [['dashboard.view', 'Ver dashboard']]],
    ['Productos', [['products.view', 'Ver'], ['products.manage', 'Crear, editar e importar']]],
    ['Inventario', [['inventory.view', 'Ver'], ['inventory.move', 'Entradas, salidas, ajustes y transferencias'], ['inventory.count', 'Conteos físicos']]],
    ['Proveedores', [['suppliers.view', 'Ver'], ['suppliers.manage', 'Crear y editar']]],
    ['Compras', [['purchases.view', 'Ver'], ['purchases.create', 'Crear solicitudes'], ['purchases.approve', 'Aprobar y enviar'], ['purchases.receive', 'Recibir mercancía']]],
    ['Ventas', [['sales.pos', 'Punto de venta (y sus propias ventas)'], ['sales.view', 'Ver todas las ventas'], ['sales.void', 'Anular ventas']]],
    ['Clientes', [['customers.view', 'Ver'], ['customers.create', 'Registrar'], ['customers.manage', 'Editar y ver datos completos']]],
    ['Órdenes internas', [['internal.view', 'Ver'], ['internal.create', 'Crear'], ['internal.approve', 'Aprobar o rechazar'], ['internal.fulfill', 'Preparar y entregar']]],
    ['Reportes', [['reports.view', 'Ver y exportar']]],
    ['Usuarios', [['users.view', 'Ver'], ['users.manage', 'Gestionar usuarios y roles']]],
    ['Auditoría', [['audit.view', 'Ver y exportar']]],
    ['Configuración', [['settings.manage', 'Empresa, sucursales y datos']]],
  ];
  S.ALL_PERMS = S.PERMISSIONS.flatMap(([, ps]) => ps.map((p) => p[0]));
  S.SYSTEM_ROLES = [
    { key: 'ADMIN', name: 'Administrador', perms: S.ALL_PERMS },
    {
      key: 'GERENTE',
      name: 'Gerente',
      perms: ['dashboard.view', 'products.view', 'products.manage', 'inventory.view', 'inventory.move', 'inventory.count', 'suppliers.view', 'suppliers.manage',
        'purchases.view', 'purchases.create', 'purchases.approve', 'purchases.receive', 'sales.view', 'sales.void', 'customers.view',
        'internal.view', 'internal.approve', 'reports.view', 'users.view', 'audit.view'],
    },
    {
      key: 'SUPERVISOR',
      name: 'Supervisor',
      perms: ['dashboard.view', 'products.view', 'inventory.view', 'inventory.count', 'suppliers.view', 'purchases.view', 'purchases.approve',
        'sales.view', 'sales.void', 'customers.view', 'internal.view', 'internal.create', 'internal.approve', 'internal.fulfill', 'reports.view'],
    },
    {
      key: 'ALMACEN',
      name: 'Almacén',
      perms: ['products.view', 'products.manage', 'inventory.view', 'inventory.move', 'inventory.count', 'suppliers.view', 'purchases.view',
        'purchases.receive', 'internal.view', 'internal.create', 'internal.fulfill'],
    },
    { key: 'CAJERO', name: 'Cajero', perms: ['sales.pos', 'products.view', 'customers.view', 'customers.create'] },
  ];

  S.PLANS = {
    STARTER: { name: 'Starter', branches: 1, users: 5, products: 1500 },
    BUSINESS: { name: 'Business', branches: 5, users: 30, products: 15000 },
    ENTERPRISE: { name: 'Enterprise', branches: 999, users: 999, products: 999999 },
  };
  S.assertPlan = (what) => {
    const plan = S.PLANS[S.db.company.plan] || S.PLANS.STARTER;
    const used = { branches: S.db.branches.filter((b) => b.active).length, users: S.db.users.filter((u) => u.active).length, products: S.db.products.length }[what];
    if (used >= plan[what]) {
      const label = { branches: 'sucursales', users: 'usuarios activos', products: 'productos' }[what];
      throw S.err(`Su plan ${plan.name} permite hasta ${S.num(plan[what])} ${label}. Solicite un cambio de plan al equipo comercial.`, 'PLAN_LIMIT');
    }
  };

  S.can = (p) => !!(S.perms && S.perms.has(p));
  S.role = (id) => S.db.roles.find((r) => r.id === id);
  S.userName = (id) => (S.db.users.find((u) => u.id === id) || {}).name || 'Sistema';
  S.branchName = (id) => (S.db.branches.find((b) => b.id === id) || {}).name || '—';
  S.myBranches = () => {
    if (!S.user) return [];
    const act = S.db.branches.filter((b) => b.active);
    return S.user.allBranches ? act : act.filter((b) => S.user.branchIds.includes(b.id));
  };
  /** Sucursales visibles según el selector del encabezado. */
  S.scopeBranches = () => {
    const mine = S.myBranches().map((b) => b.id);
    return S.branch && S.branch !== 'ALL' && mine.includes(S.branch) ? [S.branch] : mine;
  };
  S.assertBranch = (bid) => {
    if (!bid) throw S.err('Seleccione una sucursal.');
    if (!S.myBranches().some((b) => b.id === bid)) throw S.err('No tiene acceso a esa sucursal.', 'FORBIDDEN');
  };
  S.require = (p) => {
    if (!S.can(p)) throw S.err('No tiene permiso para esta acción.', 'FORBIDDEN');
  };

  // ---------- Auditoría ----------
  const SENSITIVE = /pass|pw|hash|salt|token|secret/i;
  const clean = (v) => {
    if (v == null || typeof v !== 'object') return v ?? null;
    if (Array.isArray(v)) return v.map(clean);
    const o = {};
    for (const [k, x] of Object.entries(v)) if (!SENSITIVE.test(k)) o[k] = clean(x);
    return o;
  };
  S.audit = (action, entity, entityId, before, after, extra = {}) => {
    S.db.audit.push({
      id: S.uid(),
      ts: extra.ts || new Date().toISOString(),
      userId: extra.userId !== undefined ? extra.userId : S.user ? S.user.id : null,
      action,
      entity,
      entityId: entityId || null,
      before: clean(before),
      after: clean(after),
      device: extra.device || (extra.userId === undefined && typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : null),
    });
  };

  S.next = (d, name, prefix) => {
    d.seq[name] = (d.seq[name] || 0) + 1;
    return `${prefix}-${String(d.seq[name]).padStart(6, '0')}`;
  };

  // ---------- Motor de inventario: toda variación de existencias pasa por aquí ----------
  S.getStock = (pid, bid) => (S.db.stock[pid + '|' + bid] || 0);
  S.totalStock = (pid, bids) => S.sum(bids || S.db.branches.map((b) => b.id), (b) => S.getStock(pid, b));

  /**
   * o: { pid, bid, qty (con signo), reason, ref, refType, lot:{code,exp}, lotId, cost, userId, ts, allowExpired }
   * Devuelve [{lotId, qty}] de cada lote afectado. Lanza error si dejaría existencias negativas.
   */
  S.applyStock = (d, o) => {
    const p = d.products.find((x) => x.id === o.pid);
    if (!p) throw S.err('Producto no encontrado.');
    const key = o.pid + '|' + o.bid;
    let bal = d.stock[key] || 0;
    const qty = S.r3(o.qty);
    if (!qty) return [];
    const ts = o.ts || new Date().toISOString();
    const userId = o.userId !== undefined ? o.userId : S.user ? S.user.id : null;
    const out = [];
    const push = (q, lotId) => {
      bal = S.r3(bal + q);
      const m = { id: S.uid(), ts, pid: p.id, bid: o.bid, qty: q, bal, reason: o.reason, cost: S.r2(o.cost ?? p.avgCost), userId };
      if (lotId) m.lotId = lotId;
      if (o.ref) m.ref = o.ref;
      if (o.refType) m.refType = o.refType;
      if (o.note) m.note = o.note;
      d.movements.push(m);
      out.push({ lotId: lotId || null, qty: q });
    };
    if (qty > 0) {
      if (p.tracksLots) {
        let lot;
        if (o.lotId) lot = d.lots.find((l) => l.id === o.lotId);
        if (!lot) {
          const code = (o.lot && String(o.lot.code || '').trim()) || '';
          const exp = o.lot && o.lot.exp;
          if (!code || !exp) throw S.err(`${p.name} controla lotes: indique lote y fecha de vencimiento.`);
          lot = d.lots.find((l) => l.pid === p.id && l.bid === o.bid && l.code === code);
          if (lot && lot.exp !== exp) throw S.err(`El lote ${code} de ${p.name} ya existe con vencimiento ${S.fdate(lot.exp)}.`);
          if (!lot) {
            lot = { id: S.uid(), pid: p.id, bid: o.bid, code, exp, qty: 0, createdAt: ts };
            d.lots.push(lot);
          }
        }
        lot.qty = S.r3(lot.qty + qty);
        push(qty, lot.id);
      } else push(qty, null);
    } else {
      const need = -qty;
      if (bal < need - 1e-9) throw S.err(`Stock insuficiente de ${p.name}: disponible ${S.num(bal, 3)}, requerido ${S.num(need, 3)}.`, 'INSUFFICIENT');
      if (p.tracksLots) {
        let lots;
        if (o.lotId) {
          const l = d.lots.find((x) => x.id === o.lotId);
          if (!l || l.qty < need - 1e-9) throw S.err(`El lote seleccionado de ${p.name} no tiene esa cantidad.`, 'INSUFFICIENT');
          lots = [l];
        } else {
          const today = S.dayKey(ts);
          lots = d.lots
            .filter((l) => l.pid === p.id && l.bid === o.bid && l.qty > 0 && (o.allowExpired || l.exp >= today))
            .sort((a, b) => (a.exp < b.exp ? -1 : a.exp > b.exp ? 1 : 0)); // FEFO
          const avail = S.sum(lots, (l) => l.qty);
          if (avail < need - 1e-9)
            throw S.err(`Stock vigente insuficiente de ${p.name}: hay ${S.num(avail, 3)} sin vencer (los lotes vencidos no se venden).`, 'INSUFFICIENT');
        }
        let rem = need;
        for (const l of lots) {
          if (rem <= 1e-9) break;
          const take = S.r3(Math.min(l.qty, rem));
          l.qty = S.r3(l.qty - take);
          rem = S.r3(rem - take);
          push(-take, l.id);
        }
      } else push(qty, null);
    }
    d.stock[key] = bal;
    return out;
  };

  S.MOVE_REASONS = {
    INITIAL: 'Inventario inicial', PURCHASE: 'Compra recibida', SALE: 'Venta', SALE_VOID: 'Anulación de venta', RETURN_IN: 'Devolución de cliente',
    ADJUST: 'Ajuste', COUNT: 'Conteo físico', TRANSFER_OUT: 'Transferencia enviada', TRANSFER_IN: 'Transferencia recibida',
    DAMAGE: 'Avería', EXPIRED: 'Vencimiento', THEFT: 'Hurto', INTERNAL_USE: 'Consumo interno', SUPPLIER_RETURN: 'Devolución a proveedor',
    INTERNAL_OUT: 'Orden interna (salida)', INTERNAL_IN: 'Orden interna (entrada)',
  };
  S.LOSS_REASONS = ['DAMAGE', 'EXPIRED', 'THEFT'];

  S.emptyCompany = ({ name, legalName, taxId, plan = 'STARTER', isDemo = false, status = 'TRIAL', trialDays = 14 }) => {
    const now = new Date();
    return {
      version: 1,
      company: { id: S.uid(), name, legalName: legalName || name, taxId, plan, isDemo, timezone: 'America/Bogota', createdAt: now.toISOString(),
        subscription: { status, periodStart: S.dayKey(now), periodEnd: S.dayKey(S.addDays(now, status === 'TRIAL' ? trialDays : 30)) } },
      branches: [], roles: S.SYSTEM_ROLES.map((r) => ({ id: S.uid(), key: r.key, name: r.name, perms: [...r.perms], system: true })),
      users: [], categories: [], products: [], stock: {}, lots: [], movements: [], suppliers: [], purchases: [], sales: [], customers: [],
      transfers: [], counts: [], internal: [], audit: [], seq: {},
    };
  };
})();
