'use strict';
/* Analítica basada en reglas explícitas sobre los datos registrados (no es inteligencia artificial). */
(function () {
  const S = window.S80;
  const A = (S.an = {});
  const dk = (ts) => S.dayKey(ts);

  A.sales = (from, to, bids, { includeVoid = false } = {}) =>
    S.db.sales.filter((s) => (includeVoid || s.status === 'COMPLETED') && bids.includes(s.bid) && dk(s.ts) >= from && dk(s.ts) <= to);
  A.summary = (sales) => {
    const total = S.sum(sales, (s) => s.total), base = S.sum(sales, (s) => s.subtotal), cost = S.sum(sales, (s) => s.cost);
    return { total, base, cost, iva: S.sum(sales, (s) => s.iva), profit: base - cost, margin: base ? (base - cost) / base : 0, count: sales.length, ticket: sales.length ? total / sales.length : 0 };
  };
  A.days = (from, to) => {
    const out = [];
    for (let k = from; k <= to; k = S.addDayKey(k, 1)) out.push(k);
    return out;
  };
  A.daily = (from, to, bids) => {
    const m = Object.fromEntries(A.days(from, to).map((k) => [k, { total: 0, base: 0, cost: 0, count: 0 }]));
    for (const s of A.sales(from, to, bids)) {
      const x = m[dk(s.ts)];
      x.total += s.total;
      x.base += s.subtotal;
      x.cost += s.cost;
      x.count++;
    }
    return m;
  };
  A.previous = (from, to) => {
    const n = S.daysBetween(S.parseDay(from), S.parseDay(to)) + 1;
    return { from: S.addDayKey(from, -n), to: S.addDayKey(from, -1), n };
  };
  const group = (sales, keyOf, labelOf) => {
    const m = new Map();
    for (const s of sales)
      for (const it of s.items) {
        const k = keyOf(it, s);
        if (!m.has(k)) m.set(k, { key: k, label: labelOf(k), total: 0, base: 0, cost: 0, qty: 0, tickets: new Set() });
        const g = m.get(k);
        g.total += it.total;
        g.base += it.base;
        g.cost += it.cost;
        g.qty += it.qty;
        g.tickets.add(s.id);
      }
    return [...m.values()].map((g) => ({ ...g, profit: g.base - g.cost, margin: g.base ? (g.base - g.cost) / g.base : 0, tickets: g.tickets.size }));
  };
  const P = () => S.mapBy(S.db.products);
  const C = () => S.mapBy(S.db.categories);
  A.byProduct = (sales) => {
    const p = P();
    return group(sales, (it) => it.pid, (k) => (p[k] ? p[k].name : 'Producto eliminado'));
  };
  A.byCategory = (sales) => {
    const p = P(), c = C();
    return group(sales, (it) => (p[it.pid] ? p[it.pid].categoryId : '-'), (k) => (c[k] ? c[k].name : 'Sin categoría'));
  };
  A.byBranch = (sales) => {
    const m = new Map();
    for (const s of sales) {
      if (!m.has(s.bid)) m.set(s.bid, []);
      m.get(s.bid).push(s);
    }
    return [...m.entries()].map(([bid, ss]) => ({ key: bid, label: S.branchName(bid), ...A.summary(ss) }));
  };

  A.inventory = (bids) => {
    const out = [];
    for (const p of S.db.products)
      for (const b of bids) {
        const qty = S.getStock(p.id, b);
        if (!p.active && !qty) continue;
        out.push({ p, bid: b, qty, value: qty * p.avgCost, state: S.stockState(p, qty) });
      }
    return out;
  };

  /** Unidades vendidas por producto y sucursal en los últimos N días (sin incluir hoy). */
  A.velocity = (bids, days = 30) => {
    const to = S.addDayKey(S.today(), -1), from = S.addDayKey(S.today(), -days);
    const m = {};
    for (const s of A.sales(from, to, bids)) for (const it of s.items) m[it.pid + '|' + s.bid] = (m[it.pid + '|' + s.bid] || 0) + it.qty;
    for (const k in m) m[k] /= days;
    return m;
  };
  A.SAFETY_DAYS = 3;
  /** Regla: punto de reorden = venta diaria promedio (30 días) × (tiempo de entrega + 3 días); se descuenta lo pedido en tránsito. */
  A.reorder = (bids) => {
    const vel = A.velocity(bids, 30);
    const sup = S.mapBy(S.db.suppliers);
    const transit = {};
    for (const o of S.db.purchases.filter((x) => ['REQUESTED', 'APPROVED', 'SENT', 'PARTIAL'].includes(x.status)))
      for (const it of o.items) transit[it.pid + '|' + o.bid] = (transit[it.pid + '|' + o.bid] || 0) + Math.max(it.qty - it.received, 0);
    const out = [];
    for (const p of S.db.products.filter((x) => x.active))
      for (const b of bids) {
        const k = p.id + '|' + b;
        const daily = vel[k] || 0;
        const s = sup[p.supplierId];
        const lead = s ? s.leadDays : 3;
        const point = daily * (lead + A.SAFETY_DAYS);
        const stock = S.getStock(p.id, b);
        const tr = transit[k] || 0;
        const threshold = Math.max(point, p.minStock);
        if (stock + tr > threshold || (!daily && stock > 0)) continue;
        const target = Math.max(p.maxStock || 0, point * 2, p.minStock * 2);
        let qty = target - stock - tr;
        qty = p.unit === 'und' ? Math.ceil(qty) : S.r3(qty);
        if (qty <= 0) continue;
        out.push({ p, bid: b, daily, lead, point, stock, transit: tr, qty, supplier: s || null, cost: p.lastCost || p.avgCost, daysLeft: daily ? stock / daily : null });
      }
    return out.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  };
  /** Regla: con existencias y sin ventas en 30 días, o más de 120 días de inventario al ritmo actual. */
  A.lowRotation = (bids) => {
    const vel = A.velocity(bids, 30);
    const out = [];
    for (const p of S.db.products)
      for (const b of bids) {
        const stock = S.getStock(p.id, b);
        if (stock <= 0) continue;
        const daily = vel[p.id + '|' + b] || 0;
        const days = daily ? stock / daily : Infinity;
        if (days > 120) out.push({ p, bid: b, stock, daily, days, value: stock * p.avgCost });
      }
    return out.sort((a, b) => b.value - a.value);
  };
  /** Regla: margen = (precio sin IVA − costo promedio) / precio sin IVA. Alerta si es negativo o menor a 10 %. */
  A.marginAlerts = () =>
    S.db.products.filter((p) => p.active).map((p) => {
      const base = p.price / (1 + p.tax / 100);
      const margin = base ? (base - p.avgCost) / base : 0;
      return { p, base, margin, unitProfit: base - p.avgCost };
    }).filter((x) => x.margin < 0.1).sort((a, b) => a.margin - b.margin);
  /** Regla: cada día de la última semana contra el promedio del mismo día de la semana en las 4 semanas anteriores (±30 %). */
  A.anomalies = (bids) => {
    const t = S.today();
    const daily = A.daily(S.addDayKey(t, -35), S.addDayKey(t, -1), bids);
    const out = [];
    for (let i = 1; i <= 7; i++) {
      const k = S.addDayKey(t, -i);
      const prev = [7, 14, 21, 28].map((w) => daily[S.addDayKey(k, -w)]).filter(Boolean).map((x) => x.total);
      if (prev.length < 4) continue;
      const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
      if (!avg) continue;
      const v = daily[k].total, diff = (v - avg) / avg;
      out.push({ day: k, value: v, avg, diff, flag: Math.abs(diff) >= 0.3 });
    }
    return out;
  };
  A.losses = (from, to, bids) =>
    S.db.movements.filter((m) => bids.includes(m.bid) && dk(m.ts) >= from && dk(m.ts) <= to && m.qty < 0 && (S.LOSS_REASONS.includes(m.reason) || m.reason === 'COUNT' || m.reason === 'ADJUST'))
      .map((m) => ({ m, value: -m.qty * m.cost }));
  A.purchasesBySupplier = (from, to, bids) => {
    const m = new Map();
    for (const o of S.db.purchases)
      for (const r of o.receipts) {
        if (!bids.includes(o.bid) || dk(r.ts) < from || dk(r.ts) > to) continue;
        if (!m.has(o.supplierId)) m.set(o.supplierId, { key: o.supplierId, label: (S.db.suppliers.find((s) => s.id === o.supplierId) || {}).name || '—', total: 0, receipts: 0, orders: new Set(), short: 0 });
        const g = m.get(o.supplierId);
        g.total += S.sum(r.lines, (l) => l.qty * l.cost);
        g.receipts++;
        g.orders.add(o.id);
        g.short += r.lines.filter((l) => l.diff < 0).length;
      }
    return [...m.values()].map((g) => ({ ...g, orders: g.orders.size }));
  };
})();
