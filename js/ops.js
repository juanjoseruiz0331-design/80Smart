'use strict';
/* Operaciones de negocio. Cada función recibe la empresa (d), los datos y un contexto {userId, ts}.
 * La interfaz las ejecuta dentro de S.tx(): o se guarda todo o no se guarda nada. */
(function () {
  const S = window.S80;
  const O = (S.ops = {});
  const now = (ctx) => (ctx && ctx.ts) || new Date().toISOString();
  const uidOf = (ctx) => (ctx && ctx.userId !== undefined ? ctx.userId : S.user ? S.user.id : null);
  const prod = (d, id) => {
    const p = d.products.find((x) => x.id === id);
    if (!p) throw S.err('Producto no encontrado.');
    return p;
  };
  const qtyOk = (p, q, label = 'La cantidad') => {
    q = S.r3(q);
    if (!(q > 0)) throw S.err(`${label} de ${p.name} debe ser mayor que cero.`);
    if (p.unit === 'und' && !Number.isInteger(q)) throw S.err(`${p.name} se vende por unidades: use cantidades enteras.`);
    return q;
  };
  const audit = (d, ctx, ...a) => {
    const prev = S.db;
    S.db = d;
    S.audit(...a, { ts: now(ctx), userId: uidOf(ctx) });
    S.db = prev;
  };

  // ---------- Ventas ----------
  O.sale = (d, { bid, items, customerId, payment, received }, ctx) => {
    if (!items || !items.length) throw S.err('Agregue al menos un producto.');
    if (!['CASH', 'CARD', 'TRANSFER', 'NEQUI'].includes(payment)) throw S.err('Seleccione un medio de pago.');
    const ts = now(ctx);
    const number = S.next(d, 'sale', 'V');
    const lines = items.map((it) => {
      const p = prod(d, it.pid);
      if (!p.active) throw S.err(`${p.name} está inactivo y no se puede vender.`);
      const qty = qtyOk(p, it.qty);
      const gross = p.price * qty;
      const discount = Math.min(Math.max(+it.discount || 0, 0), gross);
      const total = S.r2(gross - discount);
      const base = S.r2(total / (1 + p.tax / 100));
      const consumed = S.applyStock(d, { pid: p.id, bid, qty: -qty, reason: 'SALE', ref: number, refType: 'SALE', ts, userId: uidOf(ctx) });
      const line = { pid: p.id, qty, price: p.price, tax: p.tax, total, base, iva: S.r2(total - base), unitCost: S.r2(p.avgCost), cost: S.r2(p.avgCost * qty) };
      if (discount) line.discount = S.r2(discount);
      if (p.tracksLots) line.lots = consumed.map((c) => ({ lotId: c.lotId, qty: -c.qty }));
      return line;
    });
    const total = S.r2(S.sum(lines, (l) => l.total));
    let change = 0;
    if (payment === 'CASH') {
      const r = +received || 0;
      if (r < total) throw S.err(`El efectivo recibido (${S.money(r)}) no cubre el total (${S.money(total)}).`);
      change = S.r2(r - total);
    }
    const sale = { id: S.uid(), number, ts, bid, userId: uidOf(ctx), customerId: customerId || null, payment, items: lines,
      subtotal: S.r2(S.sum(lines, (l) => l.base)), iva: S.r2(S.sum(lines, (l) => l.iva)), discount: S.r2(S.sum(lines, (l) => l.discount || 0)),
      total, cost: S.r2(S.sum(lines, (l) => l.cost)), received: payment === 'CASH' ? +received : total, change, status: 'COMPLETED' };
    d.sales.push(sale);
    if (!ctx || !ctx.silent) audit(d, ctx, 'sale.create', 'Venta', sale.id, null, { number, total, payment, items: lines.length });
    return sale;
  };

  O.voidSale = (d, { id, reason }, ctx) => {
    const s = d.sales.find((x) => x.id === id);
    if (!s) throw S.err('Venta no encontrada.');
    if (s.status !== 'COMPLETED') throw S.err('La venta ya fue anulada.');
    if (!reason || reason.trim().length < 5) throw S.err('Indique el motivo de la anulación (mínimo 5 caracteres).');
    const ts = now(ctx);
    for (const it of s.items) {
      if (it.lots && it.lots.length)
        for (const l of it.lots) S.applyStock(d, { pid: it.pid, bid: s.bid, qty: l.qty, lotId: l.lotId, reason: 'SALE_VOID', ref: s.number, refType: 'SALE', cost: it.unitCost, ts, userId: uidOf(ctx) });
      else S.applyStock(d, { pid: it.pid, bid: s.bid, qty: it.qty, reason: 'SALE_VOID', ref: s.number, refType: 'SALE', cost: it.unitCost, ts, userId: uidOf(ctx) });
    }
    s.status = 'VOID';
    s.voidReason = reason.trim();
    s.voidedBy = uidOf(ctx);
    s.voidedAt = ts;
    audit(d, ctx, 'sale.void', 'Venta', s.id, { status: 'COMPLETED' }, { status: 'VOID', reason: s.voidReason });
    return s;
  };

  // ---------- Compras ----------
  const po = (d, id) => {
    const p = d.purchases.find((x) => x.id === id);
    if (!p) throw S.err('Orden de compra no encontrada.');
    return p;
  };
  O.createPurchase = (d, { supplierId, bid, items, notes, expectedAt }, ctx) => {
    const sup = d.suppliers.find((s) => s.id === supplierId && s.active);
    if (!sup) throw S.err('Seleccione un proveedor activo.');
    if (!bid) throw S.err('Seleccione la sucursal de destino.');
    if (!items || !items.length) throw S.err('Agregue al menos un producto.');
    const seen = new Set();
    const lines = items.map((it) => {
      const p = prod(d, it.pid);
      if (seen.has(p.id)) throw S.err(`${p.name} está repetido en la orden.`);
      seen.add(p.id);
      const qty = qtyOk(p, it.qty);
      const cost = S.r2(it.cost);
      if (!(cost > 0)) throw S.err(`Indique el costo de ${p.name}.`);
      return { pid: p.id, qty, cost, received: 0 };
    });
    const ts = now(ctx);
    const o = { id: S.uid(), number: S.next(d, 'po', 'OC'), supplierId, bid, items: lines, notes: notes || '', status: 'REQUESTED',
      createdAt: ts, createdBy: uidOf(ctx), expectedAt: expectedAt || S.dayKey(S.addDays(ts, sup.leadDays || 3)), receipts: [], history: [{ ts, userId: uidOf(ctx), status: 'REQUESTED' }],
      total: S.r2(S.sum(lines, (l) => l.qty * l.cost)) };
    d.purchases.push(o);
    if (!ctx || !ctx.silent) audit(d, ctx, 'purchase.create', 'Compra', o.id, null, { number: o.number, total: o.total });
    return o;
  };
  const poStatus = (d, id, from, to, ctx, extra = {}) => {
    const o = po(d, id);
    if (!from.includes(o.status)) throw S.err(`La orden está en estado ${S.PO_STATUS[o.status]} y no admite esta acción.`);
    const before = o.status;
    o.status = to;
    Object.assign(o, extra);
    o.history.push({ ts: now(ctx), userId: uidOf(ctx), status: to, note: extra.closeReason || extra.cancelReason || null });
    if (!ctx || !ctx.silent) audit(d, ctx, 'purchase.' + to.toLowerCase(), 'Compra', o.id, { status: before }, { status: to, ...extra });
    return o;
  };
  O.approvePurchase = (d, { id }, ctx) => poStatus(d, id, ['REQUESTED'], 'APPROVED', ctx, { approvedBy: uidOf(ctx), approvedAt: now(ctx) });
  O.sendPurchase = (d, { id }, ctx) => poStatus(d, id, ['APPROVED'], 'SENT', ctx, { sentAt: now(ctx) });
  O.cancelPurchase = (d, { id, reason }, ctx) => {
    if (!reason || reason.trim().length < 5) throw S.err('Indique el motivo (mínimo 5 caracteres).');
    return poStatus(d, id, ['REQUESTED', 'APPROVED'], 'CANCELLED', ctx, { cancelReason: reason.trim() });
  };
  O.closePurchase = (d, { id, reason }, ctx) => {
    if (!reason || reason.trim().length < 5) throw S.err('Indique el motivo (mínimo 5 caracteres).');
    return poStatus(d, id, ['APPROVED', 'SENT', 'PARTIAL'], 'CLOSED_SHORT', ctx, { closeReason: reason.trim() });
  };
  O.receivePurchase = (d, { id, lines, note }, ctx) => {
    const o = po(d, id);
    if (!['APPROVED', 'SENT', 'PARTIAL'].includes(o.status)) throw S.err('Solo se reciben órdenes aprobadas, enviadas o parciales.');
    const ts = now(ctx);
    const rec = { id: S.uid(), number: S.next(d, 'rcv', 'RM'), ts, userId: uidOf(ctx), note: note || '', lines: [] };
    let any = false;
    for (const ln of lines) {
      const item = o.items.find((i) => i.pid === ln.pid);
      if (!item) throw S.err('Producto no pertenece a la orden.');
      const p = prod(d, ln.pid);
      const q = S.r3(ln.qty);
      if (q < 0) throw S.err(`Cantidad inválida para ${p.name}.`);
      if (!q) continue;
      if (p.unit === 'und' && !Number.isInteger(q)) throw S.err(`${p.name} se recibe por unidades enteras.`);
      const cost = S.r2(ln.cost ?? item.cost);
      if (!(cost > 0)) throw S.err(`Indique el costo real de ${p.name}.`);
      any = true;
      const totalBefore = S.sum(d.branches, (b) => d.stock[p.id + '|' + b.id] || 0);
      S.applyStock(d, { pid: p.id, bid: o.bid, qty: q, reason: 'PURCHASE', ref: o.number, refType: 'PURCHASE', cost, lot: ln.lot ? { code: ln.lot, exp: ln.exp } : null, ts, userId: uidOf(ctx) });
      p.avgCost = S.r2(totalBefore > 0 ? (totalBefore * p.avgCost + q * cost) / (totalBefore + q) : cost);
      p.lastCost = cost;
      const pending = Math.max(item.qty - item.received, 0);
      item.received = S.r3(item.received + q);
      rec.lines.push({ pid: p.id, ordered: item.qty, pending, qty: q, cost, diff: S.r3(q - pending), lot: ln.lot || null, exp: ln.exp || null });
    }
    if (!any) throw S.err('Indique al menos una cantidad recibida.');
    o.receipts.push(rec);
    const before = o.status;
    o.status = o.items.every((i) => i.received >= i.qty - 1e-9) ? 'RECEIVED' : 'PARTIAL';
    o.history.push({ ts, userId: uidOf(ctx), status: o.status, note: rec.number });
    if (!ctx || !ctx.silent) audit(d, ctx, 'purchase.receive', 'Compra', o.id, { status: before }, { status: o.status, receipt: rec.number, lines: rec.lines.length });
    return rec;
  };

  // ---------- Inventario ----------
  O.entry = (d, { bid, pid, qty, reason, lot, exp, cost, note }, ctx) => {
    const p = prod(d, pid);
    const q = qtyOk(p, qty);
    if (!['INITIAL', 'RETURN_IN', 'ADJUST'].includes(reason)) throw S.err('Seleccione el motivo de la entrada.');
    const ts = now(ctx);
    const ref = S.next(d, 'mov', 'MI');
    const c = cost ? S.r2(cost) : p.avgCost;
    const totalBefore = S.sum(d.branches, (b) => d.stock[p.id + '|' + b.id] || 0);
    S.applyStock(d, { pid, bid, qty: q, reason, ref, refType: 'MANUAL', cost: c, lot: lot ? { code: lot, exp } : null, note, ts, userId: uidOf(ctx) });
    if (reason === 'INITIAL' && cost) p.avgCost = S.r2(totalBefore > 0 ? (totalBefore * p.avgCost + q * c) / (totalBefore + q) : c);
    if (!ctx || !ctx.silent) audit(d, ctx, 'inventory.entry', 'Inventario', p.id, null, { ref, product: p.name, branch: bid, qty: q, reason, note });
    return ref;
  };
  O.exit = (d, { bid, pid, qty, reason, lotId, note }, ctx) => {
    const p = prod(d, pid);
    const q = qtyOk(p, qty);
    if (!['DAMAGE', 'EXPIRED', 'THEFT', 'INTERNAL_USE', 'SUPPLIER_RETURN'].includes(reason)) throw S.err('Seleccione el motivo de la salida.');
    if (!note || note.trim().length < 5) throw S.err('La salida requiere una justificación (mínimo 5 caracteres).');
    const ts = now(ctx);
    const ref = S.next(d, 'mov', 'MS');
    S.applyStock(d, { pid, bid, qty: -q, reason, ref, refType: 'MANUAL', lotId: lotId || null, allowExpired: true, note: note.trim(), ts, userId: uidOf(ctx) });
    if (!ctx || !ctx.silent) audit(d, ctx, 'inventory.exit', 'Inventario', p.id, null, { ref, product: p.name, branch: bid, qty: q, reason, note });
    return ref;
  };
  O.adjust = (d, { bid, pid, counted, note, lot, exp }, ctx) => {
    const p = prod(d, pid);
    const c = S.r3(counted);
    if (!(c >= 0)) throw S.err('La cantidad física no puede ser negativa.');
    if (!note || note.trim().length < 5) throw S.err('El ajuste requiere una justificación (mínimo 5 caracteres).');
    const cur = d.stock[pid + '|' + bid] || 0;
    const diff = S.r3(c - cur);
    if (!diff) throw S.err('La cantidad física es igual a la del sistema: no hay nada que ajustar.');
    const ts = now(ctx);
    const ref = S.next(d, 'mov', 'AJ');
    let lotArg = null;
    if (diff > 0 && p.tracksLots) {
      if (lot) lotArg = { code: lot, exp };
      else {
        const latest = d.lots.filter((l) => l.pid === pid && l.bid === bid).sort(S.by('exp', -1))[0];
        if (!latest) throw S.err(`${p.name} controla lotes: indique lote y vencimiento del sobrante.`);
        lotArg = { code: latest.code, exp: latest.exp };
      }
    }
    S.applyStock(d, { pid, bid, qty: diff, reason: 'ADJUST', ref, refType: 'MANUAL', lot: lotArg, allowExpired: true, note: note.trim(), ts, userId: uidOf(ctx) });
    audit(d, ctx, 'inventory.adjust', 'Inventario', p.id, { stock: cur }, { stock: c, ref, note: note.trim(), branch: bid });
    return ref;
  };

  O.transfer = (d, { from, to, items, note }, ctx) => {
    if (!from || !to) throw S.err('Seleccione sucursal de origen y destino.');
    if (from === to) throw S.err('El origen y el destino deben ser distintos.');
    if (!items || !items.length) throw S.err('Agregue al menos un producto.');
    const ts = now(ctx);
    const number = S.next(d, 'tr', 'TR');
    const lines = [];
    for (const it of items) {
      const p = prod(d, it.pid);
      const q = qtyOk(p, it.qty);
      const out = S.applyStock(d, { pid: p.id, bid: from, qty: -q, reason: 'TRANSFER_OUT', ref: number, refType: 'TRANSFER', ts, userId: uidOf(ctx) });
      for (const c of out) {
        const lot = c.lotId ? d.lots.find((l) => l.id === c.lotId) : null;
        S.applyStock(d, { pid: p.id, bid: to, qty: -c.qty, reason: 'TRANSFER_IN', ref: number, refType: 'TRANSFER', lot: lot ? { code: lot.code, exp: lot.exp } : null, ts, userId: uidOf(ctx) });
      }
      lines.push({ pid: p.id, qty: q, lots: out.filter((c) => c.lotId).map((c) => { const l = d.lots.find((x) => x.id === c.lotId); return { code: l.code, exp: l.exp, qty: -c.qty }; }) });
    }
    const t = { id: S.uid(), number, ts, from, to, items: lines, note: note || '', userId: uidOf(ctx), status: 'COMPLETED' };
    d.transfers.push(t);
    if (!ctx || !ctx.silent) audit(d, ctx, 'inventory.transfer', 'Transferencia', t.id, null, { number, from, to, items: lines.length });
    return t;
  };

  // ---------- Conteos físicos ----------
  O.openCount = (d, { bid, categoryId }, ctx) => {
    if (!bid) throw S.err('Seleccione la sucursal.');
    if (d.counts.some((c) => c.bid === bid && c.status === 'OPEN')) throw S.err('Ya hay un conteo abierto en esa sucursal. Aplíquelo o cancélelo primero.');
    const ts = now(ctx);
    const prods = d.products.filter((p) => p.active && (!categoryId || p.categoryId === categoryId));
    if (!prods.length) throw S.err('No hay productos activos para contar.');
    const c = { id: S.uid(), number: S.next(d, 'cnt', 'CF'), bid, categoryId: categoryId || null, status: 'OPEN', openedAt: ts, openedBy: uidOf(ctx),
      lines: prods.map((p) => ({ pid: p.id, system: d.stock[p.id + '|' + bid] || 0, counted: null })) };
    d.counts.push(c);
    audit(d, ctx, 'count.open', 'Conteo', c.id, null, { number: c.number, branch: bid, lines: c.lines.length });
    return c;
  };
  O.saveCount = (d, { id, values }, ctx) => {
    const c = d.counts.find((x) => x.id === id);
    if (!c || c.status !== 'OPEN') throw S.err('El conteo no está abierto.');
    for (const ln of c.lines) {
      if (!(ln.pid in values)) continue;
      const v = values[ln.pid];
      if (v === '' || v == null) ln.counted = null;
      else {
        const n = S.r3(v);
        if (!(n >= 0)) throw S.err('Las cantidades contadas no pueden ser negativas.');
        ln.counted = n;
      }
    }
    c.savedAt = now(ctx);
    return c;
  };
  O.applyCount = (d, { id }, ctx) => {
    const c = d.counts.find((x) => x.id === id);
    if (!c || c.status !== 'OPEN') throw S.err('El conteo no está abierto.');
    const counted = c.lines.filter((l) => l.counted != null);
    if (!counted.length) throw S.err('No hay cantidades registradas.');
    const ts = now(ctx);
    let adjusted = 0;
    for (const ln of counted) {
      // Ajuste = contado + movimientos ocurridos desde la apertura − existencia actual (no deshace ventas hechas durante el conteo).
      const since = S.sum(d.movements.filter((m) => m.pid === ln.pid && m.bid === c.bid && m.ts > c.openedAt && m.refType !== 'COUNT'), (m) => m.qty);
      const cur = d.stock[ln.pid + '|' + c.bid] || 0;
      const target = Math.max(S.r3(ln.counted + since), 0);
      const diff = S.r3(target - cur);
      ln.since = S.r3(since);
      ln.diff = diff;
      if (!diff) continue;
      const p = prod(d, ln.pid);
      let lot = null;
      if (diff > 0 && p.tracksLots) {
        const latest = d.lots.filter((l) => l.pid === p.id && l.bid === c.bid).sort(S.by('exp', -1))[0];
        if (!latest) throw S.err(`${p.name} tiene sobrante pero no tiene lotes en la sucursal: regístrelo como entrada con lote y vencimiento.`);
        lot = { code: latest.code, exp: latest.exp };
      }
      S.applyStock(d, { pid: p.id, bid: c.bid, qty: diff, reason: 'COUNT', ref: c.number, refType: 'COUNT', lot, allowExpired: true, ts, userId: uidOf(ctx) });
      adjusted++;
    }
    c.status = 'APPLIED';
    c.appliedAt = ts;
    c.appliedBy = uidOf(ctx);
    audit(d, ctx, 'count.apply', 'Conteo', c.id, { status: 'OPEN' }, { status: 'APPLIED', adjusted });
    return { adjusted };
  };
  O.cancelCount = (d, { id }, ctx) => {
    const c = d.counts.find((x) => x.id === id);
    if (!c || c.status !== 'OPEN') throw S.err('El conteo no está abierto.');
    c.status = 'CANCELLED';
    audit(d, ctx, 'count.cancel', 'Conteo', c.id, { status: 'OPEN' }, { status: 'CANCELLED' });
  };

  // ---------- Órdenes internas ----------
  const io = (d, id) => {
    const o = d.internal.find((x) => x.id === id);
    if (!o) throw S.err('Orden interna no encontrada.');
    return o;
  };
  const ioEvent = (d, o, to, ctx, note) => {
    const from = o.status;
    o.status = to;
    o.events.push({ ts: now(ctx), userId: uidOf(ctx), from, to, note: note || null });
    if (!ctx || !ctx.silent) audit(d, ctx, 'internal.' + to.toLowerCase(), 'Orden interna', o.id, { status: from }, { status: to, note: note || undefined });
  };
  O.createInternal = (d, { kind, fromBid, toBid, department, items, priority, responsible, notes }, ctx) => {
    if (!fromBid) throw S.err('Seleccione la sucursal que despacha.');
    if (kind === 'BRANCH' && (!toBid || toBid === fromBid)) throw S.err('Seleccione una sucursal de destino distinta al origen.');
    if (kind === 'DEPARTMENT' && !department) throw S.err('Seleccione el departamento.');
    if (!items || !items.length) throw S.err('Agregue al menos un producto.');
    const lines = items.map((it) => ({ pid: prod(d, it.pid).id, qty: qtyOk(prod(d, it.pid), it.qty) }));
    const ts = now(ctx);
    const o = { id: S.uid(), number: S.next(d, 'io', 'OI'), kind, fromBid, toBid: kind === 'BRANCH' ? toBid : null, department: kind === 'DEPARTMENT' ? department : null,
      items: lines, priority: priority || 'NORMAL', responsible: responsible || '', notes: notes || '', status: 'PENDING', createdAt: ts, createdBy: uidOf(ctx),
      events: [{ ts, userId: uidOf(ctx), from: null, to: 'PENDING' }] };
    d.internal.push(o);
    if (!ctx || !ctx.silent) audit(d, ctx, 'internal.create', 'Orden interna', o.id, null, { number: o.number });
    return o;
  };
  O.approveInternal = (d, { id }, ctx) => {
    const o = io(d, id);
    if (o.status !== 'PENDING') throw S.err('Solo se aprueban órdenes pendientes.');
    if (o.createdBy === uidOf(ctx)) throw S.err('Quien creó la solicitud no puede aprobarla (segregación de funciones).', 'FORBIDDEN');
    o.approvedBy = uidOf(ctx);
    ioEvent(d, o, 'APPROVED', ctx);
  };
  O.rejectInternal = (d, { id, reason }, ctx) => {
    const o = io(d, id);
    if (o.status !== 'PENDING') throw S.err('Solo se rechazan órdenes pendientes.');
    if (o.createdBy === uidOf(ctx)) throw S.err('Quien creó la solicitud no puede rechazarla.', 'FORBIDDEN');
    if (!reason || reason.trim().length < 5) throw S.err('Indique el motivo del rechazo (mínimo 5 caracteres).');
    ioEvent(d, o, 'REJECTED', ctx, reason.trim());
  };
  O.startInternal = (d, { id }, ctx) => {
    const o = io(d, id);
    if (o.status !== 'APPROVED') throw S.err('Solo se preparan órdenes aprobadas.');
    ioEvent(d, o, 'PREPARING', ctx);
  };
  O.deliverInternal = (d, { id }, ctx) => {
    const o = io(d, id);
    if (o.status !== 'PREPARING') throw S.err('Inicie la preparación antes de entregar.');
    const ts = now(ctx);
    for (const it of o.items) {
      const out = S.applyStock(d, { pid: it.pid, bid: o.fromBid, qty: -it.qty, reason: 'INTERNAL_OUT', ref: o.number, refType: 'INTERNAL', ts, userId: uidOf(ctx),
        note: o.department ? 'Departamento: ' + S.DEPARTMENTS[o.department] : null });
      if (o.kind === 'BRANCH')
        for (const c of out) {
          const lot = c.lotId ? d.lots.find((l) => l.id === c.lotId) : null;
          S.applyStock(d, { pid: it.pid, bid: o.toBid, qty: -c.qty, reason: 'INTERNAL_IN', ref: o.number, refType: 'INTERNAL', lot: lot ? { code: lot.code, exp: lot.exp } : null, ts, userId: uidOf(ctx) });
        }
    }
    o.deliveredAt = ts;
    ioEvent(d, o, 'DELIVERED', ctx);
  };
  O.cancelInternal = (d, { id, reason }, ctx) => {
    const o = io(d, id);
    if (!['PENDING', 'APPROVED'].includes(o.status)) throw S.err('Solo se cancelan órdenes pendientes o aprobadas.');
    if (!reason || reason.trim().length < 5) throw S.err('Indique el motivo (mínimo 5 caracteres).');
    ioEvent(d, o, 'CANCELLED', ctx, reason.trim());
  };

  // ---------- Catálogo ----------
  const normalize = (s) => String(s || '').trim();
  O.saveProduct = (d, data, ctx) => {
    const name = normalize(data.name);
    const sku = normalize(data.sku).toUpperCase();
    const barcode = normalize(data.barcode) || null;
    if (name.length < 2) throw S.err('El nombre es obligatorio.');
    if (!/^[A-Z0-9._-]{2,30}$/.test(sku)) throw S.err('SKU inválido: use 2 a 30 letras, números, punto, guion o guion bajo.');
    if (barcode && !/^\d{6,14}$/.test(barcode)) throw S.err('El código de barras debe tener entre 6 y 14 dígitos.');
    const price = Math.round(+data.price);
    const cost = S.r2(+data.cost);
    const tax = +data.tax;
    if (!(price > 0)) throw S.err('El precio de venta debe ser mayor que cero.');
    if (!(cost >= 0)) throw S.err('El costo no puede ser negativo.');
    if (![0, 5, 19].includes(tax)) throw S.err('El IVA debe ser 0, 5 o 19 %.');
    const min = S.r3(+data.minStock || 0);
    const max = S.r3(+data.maxStock || 0);
    if (max && max < min) throw S.err('El stock máximo no puede ser menor que el mínimo.');
    if (!d.categories.some((c) => c.id === data.categoryId)) throw S.err('Seleccione una categoría.');
    const other = d.products.filter((p) => p.id !== data.id);
    if (other.some((p) => p.sku === sku)) throw S.err(`Ya existe un producto con el SKU ${sku}.`, 'DUPLICATE');
    if (barcode && other.some((p) => p.barcode === barcode)) throw S.err(`Ya existe un producto con el código de barras ${barcode}.`, 'DUPLICATE');
    const fields = { name, sku, barcode, categoryId: data.categoryId, brand: normalize(data.brand), unit: data.unit === 'kg' ? 'kg' : data.unit === 'l' ? 'l' : 'und',
      price, tax, minStock: min, maxStock: max, tracksLots: !!data.tracksLots, supplierId: data.supplierId || null, active: data.active !== false };
    if (data.id) {
      const p = d.products.find((x) => x.id === data.id);
      if (!p) throw S.err('Producto no encontrado.');
      if (p.tracksLots !== fields.tracksLots && S.sum(d.branches, (b) => d.stock[p.id + '|' + b.id] || 0) > 0)
        throw S.err('No puede cambiar el control de lotes de un producto con existencias.');
      const before = { ...p };
      Object.assign(p, fields);
      if (!S.sum(d.branches, (b) => d.stock[p.id + '|' + b.id] || 0)) p.avgCost = cost;
      if (!ctx || !ctx.silent) audit(d, ctx, 'product.update', 'Producto', p.id, before, { ...p });
      return p;
    }
    const prev = S.db;
    S.db = d;
    try {
      S.assertPlan('products');
    } finally {
      S.db = prev;
    }
    const p = { id: S.uid(), ...fields, avgCost: cost, lastCost: cost, createdAt: now(ctx) };
    d.products.push(p);
    if (!ctx || !ctx.silent) audit(d, ctx, 'product.create', 'Producto', p.id, null, { ...p });
    return p;
  };
  O.saveCategory = (d, { name }, ctx) => {
    const n = normalize(name);
    if (n.length < 2) throw S.err('Nombre de categoría inválido.');
    if (d.categories.some((c) => c.name.toLowerCase() === n.toLowerCase())) throw S.err('La categoría ya existe.', 'DUPLICATE');
    const c = { id: S.uid(), name: n };
    d.categories.push(c);
    audit(d, ctx, 'category.create', 'Categoría', c.id, null, c);
    return c;
  };

  O.saveSupplier = (d, data, ctx) => {
    const name = normalize(data.name);
    const taxId = normalize(data.taxId);
    if (name.length < 2) throw S.err('El nombre es obligatorio.');
    if (!/^[0-9]{6,12}(-[0-9])?$/.test(taxId)) throw S.err('NIT inválido (ej.: 900123456-7).');
    if (d.suppliers.some((s) => s.taxId === taxId && s.id !== data.id)) throw S.err('Ya existe un proveedor con ese NIT.', 'DUPLICATE');
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw S.err('Correo inválido.');
    const fields = { name, taxId, contact: normalize(data.contact), phone: normalize(data.phone), email: normalize(data.email).toLowerCase(),
      paymentDays: Math.max(0, Math.round(+data.paymentDays || 0)), leadDays: Math.max(1, Math.round(+data.leadDays || 1)), active: data.active !== false };
    if (data.id) {
      const s = d.suppliers.find((x) => x.id === data.id);
      const before = { ...s };
      Object.assign(s, fields);
      audit(d, ctx, 'supplier.update', 'Proveedor', s.id, before, { ...s });
      return s;
    }
    const s = { id: S.uid(), ...fields, createdAt: now(ctx) };
    d.suppliers.push(s);
    if (!ctx || !ctx.silent) audit(d, ctx, 'supplier.create', 'Proveedor', s.id, null, s);
    return s;
  };

  O.saveCustomer = (d, data, ctx) => {
    const name = normalize(data.name);
    const doc = normalize(data.docNumber);
    if (name.length < 3) throw S.err('El nombre es obligatorio.');
    if (!['CC', 'CE', 'NIT', 'PAS', 'TI'].includes(data.docType)) throw S.err('Seleccione el tipo de documento.');
    if (!/^[0-9A-Za-z-]{4,15}$/.test(doc)) throw S.err('Número de documento inválido.');
    if (d.customers.some((c) => c.docType === data.docType && c.docNumber === doc && c.id !== data.id)) throw S.err('Ya existe un cliente con ese documento.', 'DUPLICATE');
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw S.err('Correo inválido.');
    if (!data.consent && (data.email || data.phone)) throw S.err('Para guardar correo o teléfono se requiere la autorización de tratamiento de datos (Ley 1581 de 2012).');
    const fields = { name, docType: data.docType, docNumber: doc, email: normalize(data.email).toLowerCase(), phone: normalize(data.phone), address: normalize(data.address) };
    if (data.id) {
      const c = d.customers.find((x) => x.id === data.id);
      const before = { ...c };
      Object.assign(c, fields);
      if (data.consent && !c.consentAt) c.consentAt = now(ctx);
      if (!data.consent) c.consentAt = null;
      audit(d, ctx, 'customer.update', 'Cliente', c.id, before, { ...c });
      return c;
    }
    const c = { id: S.uid(), ...fields, consentAt: data.consent ? now(ctx) : null, createdAt: now(ctx), createdBy: uidOf(ctx) };
    d.customers.push(c);
    if (!ctx || !ctx.silent) audit(d, ctx, 'customer.create', 'Cliente', c.id, null, c);
    return c;
  };

  // ---------- Sucursales ----------
  O.saveBranch = (d, data, ctx) => {
    const name = normalize(data.name);
    const code = normalize(data.code).toUpperCase();
    if (name.length < 2) throw S.err('El nombre es obligatorio.');
    if (!/^[A-Z0-9-]{2,12}$/.test(code)) throw S.err('Código inválido (2 a 12 letras o números).');
    if (d.branches.some((b) => b.code === code && b.id !== data.id)) throw S.err('Ya existe una sucursal con ese código.', 'DUPLICATE');
    const fields = { name, code, city: normalize(data.city), address: normalize(data.address), phone: normalize(data.phone) };
    if (data.id) {
      const b = d.branches.find((x) => x.id === data.id);
      const before = { ...b };
      Object.assign(b, fields);
      if (data.active === false && b.active) {
        if (d.branches.filter((x) => x.active).length === 1) throw S.err('Debe quedar al menos una sucursal activa.');
        b.active = false;
      } else if (data.active === true && !b.active) {
        const prev = S.db;
        S.db = d;
        try {
          S.assertPlan('branches');
        } finally {
          S.db = prev;
        }
        b.active = true;
      }
      audit(d, ctx, 'branch.update', 'Sucursal', b.id, before, { ...b });
      return b;
    }
    const prev = S.db;
    S.db = d;
    try {
      S.assertPlan('branches');
    } finally {
      S.db = prev;
    }
    const b = { id: S.uid(), ...fields, active: true };
    d.branches.push(b);
    if (!ctx || !ctx.silent) audit(d, ctx, 'branch.create', 'Sucursal', b.id, null, b);
    return b;
  };

  // ---------- Etiquetas ----------
  S.PO_STATUS = { REQUESTED: 'Solicitud', APPROVED: 'Aprobada', SENT: 'Enviada', PARTIAL: 'Recibida parcial', RECEIVED: 'Recibida', CLOSED_SHORT: 'Cerrada con faltante', CANCELLED: 'Cancelada' };
  S.IO_STATUS = { PENDING: 'Pendiente', APPROVED: 'Aprobada', REJECTED: 'Rechazada', PREPARING: 'En preparación', DELIVERED: 'Entregada', CANCELLED: 'Cancelada' };
  S.PAYMENTS = { CASH: 'Efectivo', CARD: 'Tarjeta (datáfono)', TRANSFER: 'Transferencia', NEQUI: 'Nequi / Daviplata' };
  S.DEPARTMENTS = { CAFETERIA: 'Cafetería', CLEANING: 'Aseo', MAINTENANCE: 'Mantenimiento', ADMIN: 'Administración', BAKERY: 'Panadería' };
  S.PRIORITY = { LOW: 'Baja', NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' };
})();
