'use strict';
/* Órdenes internas, Reportes, Usuarios y permisos, Auditoría y Configuración. */
(function () {
  const S = window.S80;
  const esc = S.esc;
  const A = S.an;

  // =====================================================================
  // ÓRDENES INTERNAS
  // =====================================================================
  S.route('internal', {
    title: 'Órdenes internas', icon: 'clipboard', perm: 'internal.view',
    render(el, params) {
      const bids = S.scopeBranches();
      el.innerHTML = `${S.pageHead('Órdenes internas', 'Pedidos entre sucursales o para consumo de departamentos.', S.can('internal.create') ? `<button class="btn primary" id="new">${S.icon('plus')}Nueva solicitud</button>` : '')}
        <div class="toolbar"><select class="select" id="st" aria-label="Estado">${S.options([['open', 'Abiertas'], ...Object.entries(S.IO_STATUS)], params.status, { empty: 'Todos los estados' })}</select>
          <select class="select" id="kind" aria-label="Tipo">${S.options([['BRANCH', 'Entre sucursales'], ['DEPARTMENT', 'Departamento']], params.kind, { empty: 'Todos los tipos' })}</select></div><div class="card flush" id="tbl"></div>`;
      const rows = S.db.internal.filter((o) => (bids.includes(o.fromBid) || bids.includes(o.toBid)) && (!params.kind || o.kind === params.kind)
        && (!params.status || (params.status === 'open' ? ['PENDING', 'APPROVED', 'PREPARING'].includes(o.status) : o.status === params.status))).slice().reverse();
      S.table(el.querySelector('#tbl'), [
        { key: 'number', label: 'Número', sort: true, render: (o) => `<b>${esc(o.number)}</b>` },
        { key: 'createdAt', label: 'Fecha', sort: true, render: (o) => S.fdate(o.createdAt) },
        { key: 'kind', label: 'Tipo', render: (o) => (o.kind === 'BRANCH' ? 'Entre sucursales' : 'Departamento') },
        { key: 'route', label: 'Origen → destino', render: (o) => `${esc(S.branchName(o.fromBid))} → ${esc(o.kind === 'BRANCH' ? S.branchName(o.toBid) : S.DEPARTMENTS[o.department])}` },
        { key: 'priority', label: 'Prioridad', sort: (o) => ['LOW', 'NORMAL', 'HIGH', 'URGENT'].indexOf(o.priority), render: (o) => S.badge(S.PRIORITY[o.priority], { URGENT: 'danger', HIGH: 'warn' }[o.priority] || '') },
        { key: 'responsible', label: 'Responsable', render: (o) => esc(o.responsible || '—') },
        { key: 'status', label: 'Estado', sort: true, render: (o) => S.ioBadge(o.status) },
      ], { rows, onRow: (o) => ioDetail(o.id), empty: 'No hay órdenes internas con esos filtros.' });
      el.querySelector('#st').addEventListener('change', (e) => S.setParams({ status: e.target.value }));
      el.querySelector('#kind').addEventListener('change', (e) => S.setParams({ kind: e.target.value }));
      if (S.can('internal.create')) {
        el.querySelector('#new').addEventListener('click', ioModal);
        if (params.new) (S.setParams({ new: '' }, { render: false }), ioModal());
      }
      if (params.id) (S.setParams({ id: '' }, { render: false }), ioDetail(params.id));
    },
  });
  function ioModal() {
    S.modal({
      title: 'Nueva orden interna', size: 'xl',
      body: `<div class="stack"><div class="seg" role="radiogroup" aria-label="Tipo"><button type="button" class="active" data-k="BRANCH">Entre sucursales</button><button type="button" data-k="DEPARTMENT">Departamento</button></div>
        <div class="grid g4"><label class="field"><span>Despacha *</span><select class="select" id="from">${S.branchOptions(S.branch !== 'ALL' ? S.branch : '', 'Seleccione…')}</select></label>
        <label class="field" id="tof"><span>Sucursal destino *</span><select class="select" id="to">${S.options(S.db.branches.filter((b) => b.active).map((b) => [b.id, b.name]), '', { empty: 'Seleccione…' })}</select></label>
        <label class="field hidden" id="depf"><span>Departamento *</span><select class="select" id="dep">${S.options(Object.entries(S.DEPARTMENTS), '', { empty: 'Seleccione…' })}</select></label>
        <label class="field"><span>Prioridad</span><select class="select" id="prio">${S.options(Object.entries(S.PRIORITY), 'NORMAL')}</select></label>
        <label class="field"><span>Responsable</span><input class="input" id="resp" maxlength="80"></label></div>
        <div id="items"></div><label class="field"><span>Observaciones</span><input class="input" id="notes" maxlength="300"></label>
        <p class="small muted">Quien crea la solicitud no puede aprobarla. El inventario se mueve solo al confirmar la entrega.</p><div class="form-error hidden" id="err" role="alert"></div></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Crear solicitud</button>`,
      onMount(m, close) {
        let kind = 'BRANCH';
        const from = m.querySelector('#from');
        const ed = S.itemsEditor(m.querySelector('#items'), { branch: () => from.value, stockLabel: 'Exist. origen' });
        from.addEventListener('change', ed.redraw);
        m.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => {
          kind = b.dataset.k;
          m.querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('active', x === b));
          m.querySelector('#tof').classList.toggle('hidden', kind !== 'BRANCH');
          m.querySelector('#depf').classList.toggle('hidden', kind === 'BRANCH');
        }));
        m.querySelector('#ok').addEventListener('click', () => {
          try {
            S.assertBranch(from.value);
            const o = S.act('internal.create', 'createInternal', { kind, fromBid: from.value, toBid: m.querySelector('#to').value, department: m.querySelector('#dep').value, items: ed.items(),
              priority: m.querySelector('#prio').value, responsible: m.querySelector('#resp').value, notes: m.querySelector('#notes').value });
            close();
            S.toast(`Solicitud ${o.number} creada.`);
            S.go('internal', { status: 'open' });
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }
  function ioDetail(id) {
    const o = S.db.internal.find((x) => x.id === id);
    if (!o) return S.toast('Orden no encontrada.', 'error');
    const pmap = S.mapBy(S.db.products);
    const own = o.createdBy === S.user.id;
    const acts = [];
    if (o.status === 'PENDING' && S.can('internal.approve') && !own) acts.push(['reject', 'Rechazar', 'danger'], ['approve', 'Aprobar', 'primary']);
    if (o.status === 'APPROVED' && S.can('internal.fulfill')) acts.push(['start', 'Iniciar preparación', 'primary']);
    if (o.status === 'PREPARING' && S.can('internal.fulfill')) acts.push(['deliver', 'Confirmar entrega', 'primary']);
    if (['PENDING', 'APPROVED'].includes(o.status) && (own || S.can('internal.approve'))) acts.unshift(['cancel', 'Cancelar', '']);
    S.modal({
      title: `Orden interna ${o.number}`, size: 'lg',
      body: `<div class="stack"><div class="row wrap between">${S.ioBadge(o.status)} ${S.badge('Prioridad ' + S.PRIORITY[o.priority], { URGENT: 'danger', HIGH: 'warn' }[o.priority] || '')}<span class="small muted">Creada ${S.fdt(o.createdAt)} por ${esc(S.userName(o.createdBy))}</span></div>
        ${o.status === 'PENDING' && own && S.can('internal.approve') ? `<div class="banner info">${S.icon('info')}<span>Usted creó esta solicitud: otra persona debe aprobarla (segregación de funciones).</span></div>` : ''}
        <dl class="dl"><dt>Despacha</dt><dd>${esc(S.branchName(o.fromBid))}</dd><dt>Destino</dt><dd>${esc(o.kind === 'BRANCH' ? S.branchName(o.toBid) : 'Departamento de ' + S.DEPARTMENTS[o.department])}</dd><dt>Responsable</dt><dd>${esc(o.responsible || '—')}</dd>${o.notes ? `<dt>Observaciones</dt><dd>${esc(o.notes)}</dd>` : ''}</dl>
        <div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Cantidad</th><th class="num">Existencia en origen</th></tr></thead><tbody>
        ${o.items.map((i) => `<tr><td><b>${esc(pmap[i.pid].name)}</b><div class="small muted">${esc(pmap[i.pid].sku)}</div></td><td class="num">${S.qty(pmap[i.pid], i.qty)}</td><td class="num ${S.getStock(i.pid, o.fromBid) < i.qty && o.status !== 'DELIVERED' ? 'danger' : ''}">${S.qty(pmap[i.pid], S.getStock(i.pid, o.fromBid))}</td></tr>`).join('')}</tbody></table></div>
        <h3>Historial</h3><div class="timeline">${o.events.map((e) => `<div><b>${esc(S.IO_STATUS[e.to])}</b> · ${esc(S.userName(e.userId))} <span class="muted">· ${S.fdt(e.ts)}</span>${e.note ? `<div class="muted">${esc(e.note)}</div>` : ''}</div>`).join('')}</div></div>`,
      foot: `<button class="btn" data-close>Cerrar</button><div class="grow"></div>${acts.map(([k, l, c]) => `<button class="btn ${c}" data-act="${k}">${l}</button>`).join('')}`,
      onMount(m, close) {
        m.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
          const k = b.dataset.act;
          try {
            if (k === 'approve') S.act('internal.approve', 'approveInternal', { id });
            if (k === 'reject') {
              const reason = await S.confirm({ title: 'Rechazar solicitud', message: 'Indique por qué se rechaza.', reason: true, danger: true, confirmLabel: 'Rechazar' });
              if (!reason) return;
              S.act('internal.approve', 'rejectInternal', { id, reason });
            }
            if (k === 'start') S.act('internal.fulfill', 'startInternal', { id });
            if (k === 'deliver') {
              if (!(await S.confirm({ title: 'Confirmar entrega', message: `Se descontará el inventario de ${esc(S.branchName(o.fromBid))}${o.kind === 'BRANCH' ? ` y entrará a ${esc(S.branchName(o.toBid))}` : ''}.`, confirmLabel: 'Confirmar entrega' }))) return;
              S.assertBranch(o.fromBid);
              S.act('internal.fulfill', 'deliverInternal', { id });
            }
            if (k === 'cancel') {
              const reason = await S.confirm({ title: 'Cancelar solicitud', message: 'La solicitud quedará cancelada.', reason: true, confirmLabel: 'Cancelar solicitud' });
              if (!reason) return;
              S.tx((d) => S.ops.cancelInternal(d, { id, reason }, { userId: S.user.id }));
            }
            close();
            S.toast('Orden actualizada.');
            S.refresh();
          } catch (e) {
            S.fail(e);
          }
        }));
      },
    });
  }

  // =====================================================================
  // REPORTES
  // =====================================================================
  const short = (k) => S.parseDay(k).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
  const REPORTS = {
    sales: { label: 'Ventas por periodo', build(r) {
      const daily = A.daily(r.from, r.to, r.bids);
      const rows = Object.entries(daily).map(([k, v]) => ({ day: k, ...v, profit: v.base - v.cost, margin: v.base ? (v.base - v.cost) / v.base : 0 }));
      const sm = A.summary(A.sales(r.from, r.to, r.bids));
      return { kpis: [['Ventas', S.money(sm.total)], ['Transacciones', S.num(sm.count)], ['Ticket promedio', S.money(sm.ticket)], ['Utilidad bruta', S.money(sm.profit) + ' · ' + S.pct(sm.margin)]],
        chart: (el) => S.lineChart(el, { labels: rows.map((x) => short(x.day)), series: [{ name: 'Ventas', values: rows.map((x) => x.total) }, { name: 'Utilidad bruta', values: rows.map((x) => x.profit), color: '--info' }] }),
        legend: [['Ventas', '--primary'], ['Utilidad bruta', '--info']],
        cols: [{ key: 'day', label: 'Fecha', sort: true, render: (x) => S.fdate(x.day), csv: (x) => x.day }, { key: 'count', label: 'Ventas', num: true, sort: true },
          { key: 'total', label: 'Total con IVA', num: true, sort: true, render: (x) => S.money(x.total), csv: (x) => Math.round(x.total) }, { key: 'base', label: 'Sin IVA', num: true, sort: true, render: (x) => S.money(x.base), csv: (x) => Math.round(x.base) },
          { key: 'cost', label: 'Costo', num: true, sort: true, render: (x) => S.money(x.cost), csv: (x) => Math.round(x.cost) }, { key: 'profit', label: 'Utilidad', num: true, sort: true, render: (x) => S.money(x.profit), csv: (x) => Math.round(x.profit) },
          { key: 'margin', label: 'Margen', num: true, sort: true, render: (x) => S.pct(x.margin), csv: (x) => S.r2(x.margin * 100) }], rows };
    } },
    profit: { label: 'Rentabilidad y margen por producto', build(r) {
      const rows = A.byProduct(A.sales(r.from, r.to, r.bids));
      const sm = { base: S.sum(rows, (x) => x.base), profit: S.sum(rows, (x) => x.profit) };
      return { kpis: [['Ingreso sin IVA', S.money(sm.base)], ['Utilidad bruta', S.money(sm.profit)], ['Margen', S.pct(sm.base ? sm.profit / sm.base : 0)], ['Productos vendidos', S.num(rows.length)]],
        chart: (el) => S.barList(el, rows.slice().sort((a, b) => b.profit - a.profit).slice(0, 10).map((x) => ({ label: x.label, value: x.profit, sub: S.pct(x.margin, 0) }))), chartTitle: 'Top 10 por utilidad',
        cols: groupCols('Producto'), rows: rows.sort((a, b) => b.profit - a.profit) };
    } },
    category: { label: 'Rendimiento por categoría', build(r) {
      const rows = A.byCategory(A.sales(r.from, r.to, r.bids)).sort((a, b) => b.total - a.total);
      return { kpis: [['Categorías con ventas', S.num(rows.length)], ['Ventas', S.money(S.sum(rows, (x) => x.total))], ['Utilidad', S.money(S.sum(rows, (x) => x.profit))]],
        chart: (el) => S.barList(el, rows.map((x) => ({ label: x.label, value: x.total, sub: 'margen ' + S.pct(x.margin, 0) }))), chartTitle: 'Ventas por categoría', cols: groupCols('Categoría'), rows };
    } },
    branch: { label: 'Desempeño por sucursal', build(r) {
      const rows = A.byBranch(A.sales(r.from, r.to, r.bids)).sort((a, b) => b.total - a.total);
      return { kpis: rows.slice(0, 4).map((x) => [x.label, S.money(x.total)]),
        chart: (el) => S.barList(el, rows.map((x) => ({ label: x.label, value: x.total, sub: S.num(x.count) + ' ventas' }))), chartTitle: 'Ventas por sucursal',
        cols: [{ key: 'label', label: 'Sucursal', sort: true }, { key: 'count', label: 'Ventas', num: true, sort: true }, { key: 'total', label: 'Total', num: true, sort: true, render: (x) => S.money(x.total), csv: (x) => Math.round(x.total) },
          { key: 'ticket', label: 'Ticket prom.', num: true, sort: true, render: (x) => S.money(x.ticket), csv: (x) => Math.round(x.ticket) }, { key: 'profit', label: 'Utilidad', num: true, sort: true, render: (x) => S.money(x.profit), csv: (x) => Math.round(x.profit) },
          { key: 'margin', label: 'Margen', num: true, sort: true, render: (x) => S.pct(x.margin), csv: (x) => S.r2(x.margin * 100) }], rows };
    } },
    inventory: { label: 'Inventario valorizado', noRange: true, build(r) {
      const inv = A.inventory(r.bids);
      const cmap = S.mapBy(S.db.categories);
      const byP = new Map();
      for (const x of inv) {
        const g = byP.get(x.p.id) || { p: x.p, qty: 0, value: 0 };
        g.qty += x.qty;
        g.value += x.value;
        byP.set(x.p.id, g);
      }
      const rows = [...byP.values()].filter((x) => x.qty > 0).map((x) => ({ ...x, name: x.p.name, cat: (cmap[x.p.categoryId] || {}).name, sale: x.qty * x.p.price }));
      const byC = {};
      rows.forEach((x) => (byC[x.cat] = (byC[x.cat] || 0) + x.value));
      return { kpis: [['Valor a costo', S.money(S.sum(rows, (x) => x.value))], ['Valor a precio de venta', S.money(S.sum(rows, (x) => x.sale))], ['Productos con existencia', S.num(rows.length)]],
        chart: (el) => S.barList(el, Object.entries(byC).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))), chartTitle: 'Valor por categoría',
        cols: [{ key: 'name', label: 'Producto', sort: true, csv: (x) => x.p.name }, { key: 'cat', label: 'Categoría', sort: true }, { key: 'qty', label: 'Existencia', num: true, sort: true, render: (x) => S.qty(x.p, x.qty) },
          { key: 'cost', label: 'Costo prom.', num: true, render: (x) => S.money(x.p.avgCost), csv: (x) => x.p.avgCost }, { key: 'value', label: 'Valor a costo', num: true, sort: true, render: (x) => S.money(x.value), csv: (x) => Math.round(x.value) },
          { key: 'sale', label: 'Valor a precio', num: true, sort: true, render: (x) => S.money(x.sale), csv: (x) => Math.round(x.sale) }], rows: rows.sort((a, b) => b.value - a.value) };
    } },
    rotation: { label: 'Rotación de inventario', build(r) {
      const days = S.daysBetween(S.parseDay(r.from), S.parseDay(r.to)) + 1;
      const sold = A.byProduct(A.sales(r.from, r.to, r.bids));
      const sm = S.mapBy(sold, 'key');
      const rows = S.db.products.filter((p) => p.active).map((p) => {
        const stock = S.totalStock(p.id, r.bids);
        const q = (sm[p.id] || {}).qty || 0;
        const cost = (sm[p.id] || {}).cost || 0;
        const daily = q / days;
        return { p, name: p.name, sold: q, stock, daily, doi: daily ? stock / daily : null, turns: stock * p.avgCost ? cost / (stock * p.avgCost) : null };
      });
      return { kpis: [['Días del periodo', S.num(days)], ['Productos sin ventas', S.num(rows.filter((x) => !x.sold).length)], ['Más de 120 días de inventario', S.num(rows.filter((x) => x.doi > 120 || (!x.sold && x.stock > 0)).length)]],
        chart: (el) => S.barList(el, rows.filter((x) => x.turns).sort((a, b) => b.turns - a.turns).slice(0, 10).map((x) => ({ label: x.name, value: x.turns })), { fmt: (v) => S.num(v, 2) + ' veces' }), chartTitle: 'Mayor rotación (costo vendido / valor en inventario)',
        cols: [{ key: 'name', label: 'Producto', sort: true }, { key: 'sold', label: 'Vendido', num: true, sort: true, render: (x) => S.num(x.sold, 2) }, { key: 'daily', label: 'Venta diaria', num: true, sort: true, render: (x) => S.num(x.daily, 2), csv: (x) => S.r2(x.daily) },
          { key: 'stock', label: 'Existencia', num: true, sort: true, render: (x) => S.num(x.stock, 2) }, { key: 'doi', label: 'Días de inventario', num: true, sort: (x) => x.doi ?? 1e9, render: (x) => (x.doi == null ? (x.stock ? 'Sin ventas' : '—') : S.num(x.doi, 0)), csv: (x) => (x.doi == null ? '' : Math.round(x.doi)) },
          { key: 'turns', label: 'Rotación', num: true, sort: (x) => x.turns ?? -1, render: (x) => (x.turns == null ? '—' : S.num(x.turns, 2)), csv: (x) => (x.turns == null ? '' : S.r2(x.turns)) }], rows: rows.sort((a, b) => (b.doi ?? 1e9) - (a.doi ?? 1e9)) };
    } },
    expiry: { label: 'Vencidos y por vencer', noRange: true, build(r) {
      const t = S.today();
      const pmap = S.mapBy(S.db.products);
      const rows = S.db.lots.filter((l) => l.qty > 0 && r.bids.includes(l.bid) && l.exp <= S.addDayKey(t, 30)).map((l) => ({ ...l, name: pmap[l.pid].name, branch: S.branchName(l.bid), value: l.qty * pmap[l.pid].avgCost, days: S.daysBetween(new Date(), S.parseDay(l.exp)) }));
      const exp = rows.filter((x) => x.days < 0), soon = rows.filter((x) => x.days >= 0 && x.days <= 7);
      return { kpis: [['Vencidos con existencia', `${S.num(exp.length)} · ${S.money(S.sum(exp, (x) => x.value))}`], ['Vencen en 7 días', `${S.num(soon.length)} · ${S.money(S.sum(soon, (x) => x.value))}`], ['Vencen en 30 días', `${S.num(rows.length - exp.length)} lotes`]],
        cols: [{ key: 'name', label: 'Producto', sort: true }, { key: 'code', label: 'Lote' }, { key: 'branch', label: 'Sucursal', sort: true }, { key: 'exp', label: 'Vencimiento', sort: true, render: (x) => S.fdate(x.exp) + ' ' + S.expBadge(x.exp), csv: (x) => x.exp },
          { key: 'qty', label: 'Cantidad', num: true, sort: true, render: (x) => S.num(x.qty, 3) }, { key: 'value', label: 'Valor a costo', num: true, sort: true, render: (x) => S.money(x.value), csv: (x) => Math.round(x.value) }], rows: rows.sort(S.by('exp')) };
    } },
    losses: { label: 'Pérdidas', build(r) {
      const pmap = S.mapBy(S.db.products);
      const rows = A.losses(r.from, r.to, r.bids).map(({ m, value }) => ({ ...m, value, name: (pmap[m.pid] || {}).name, branch: S.branchName(m.bid), label: m.reason === 'COUNT' ? 'Faltante de conteo' : m.reason === 'ADJUST' ? 'Ajuste negativo' : S.MOVE_REASONS[m.reason] })).reverse();
      const byR = {};
      rows.forEach((x) => (byR[x.label] = (byR[x.label] || 0) + x.value));
      return { kpis: [['Pérdida total a costo', S.money(S.sum(rows, (x) => x.value))], ...Object.entries(byR).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => [k, S.money(v)])],
        chart: (el) => S.barList(el, Object.entries(byR).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))), chartTitle: 'Pérdida por motivo',
        cols: [{ key: 'ts', label: 'Fecha', sort: true, render: (x) => S.fdt(x.ts), csv: (x) => S.fdt(x.ts) }, { key: 'name', label: 'Producto', sort: true }, { key: 'branch', label: 'Sucursal' }, { key: 'label', label: 'Motivo', sort: true },
          { key: 'qty', label: 'Cantidad', num: true, render: (x) => S.num(-x.qty, 3), csv: (x) => -x.qty }, { key: 'value', label: 'Valor a costo', num: true, sort: true, render: (x) => S.money(x.value), csv: (x) => Math.round(x.value) }, { key: 'note', label: 'Nota', render: (x) => esc(x.note || '—') }], rows };
    } },
    purchases: { label: 'Compras por proveedor', build(r) {
      const rows = A.purchasesBySupplier(r.from, r.to, r.bids).sort((a, b) => b.total - a.total);
      return { kpis: [['Total recibido', S.money(S.sum(rows, (x) => x.total))], ['Recepciones', S.num(S.sum(rows, (x) => x.receipts))], ['Líneas con faltante', S.num(S.sum(rows, (x) => x.short))]],
        chart: (el) => S.barList(el, rows.map((x) => ({ label: x.label, value: x.total }))), chartTitle: 'Compras recibidas por proveedor',
        cols: [{ key: 'label', label: 'Proveedor', sort: true }, { key: 'orders', label: 'Órdenes', num: true, sort: true }, { key: 'receipts', label: 'Recepciones', num: true, sort: true }, { key: 'short', label: 'Líneas con faltante', num: true, sort: true },
          { key: 'total', label: 'Total recibido', num: true, sort: true, render: (x) => S.money(x.total), csv: (x) => Math.round(x.total) }], rows };
    } },
  };
  function groupCols(label) {
    return [{ key: 'label', label, sort: true }, { key: 'qty', label: 'Cantidad', num: true, sort: true, render: (x) => S.num(x.qty, 2), csv: (x) => S.r3(x.qty) }, { key: 'tickets', label: 'Tickets', num: true, sort: true },
      { key: 'total', label: 'Ventas con IVA', num: true, sort: true, render: (x) => S.money(x.total), csv: (x) => Math.round(x.total) }, { key: 'base', label: 'Sin IVA', num: true, sort: true, render: (x) => S.money(x.base), csv: (x) => Math.round(x.base) },
      { key: 'cost', label: 'Costo', num: true, sort: true, render: (x) => S.money(x.cost), csv: (x) => Math.round(x.cost) }, { key: 'profit', label: 'Utilidad', num: true, sort: true, render: (x) => `<span class="${x.profit < 0 ? 'danger' : ''}">${S.money(x.profit)}</span>`, csv: (x) => Math.round(x.profit) },
      { key: 'margin', label: 'Margen', num: true, sort: true, render: (x) => S.pct(x.margin), csv: (x) => S.r2(x.margin * 100) }];
  }

  S.route('reports', {
    title: 'Reportes y analítica', icon: 'chart', perm: 'reports.view', label: 'Reportes y analítica',
    render(el, params) {
      const key = params.r === 'insights' || REPORTS[params.r] ? params.r : 'sales';
      const bids = S.scopeBranches();
      el.innerHTML = `${S.pageHead('Reportes y analítica', `${bids.length > 1 ? 'Todas sus sucursales' : esc(S.branchName(bids[0]))}. Use el selector de sucursal del encabezado para filtrar.`)}
        <div class="tabs">${Object.entries(REPORTS).map(([k, r]) => `<button data-r="${k}" class="${k === key ? 'active' : ''}">${r.label}</button>`).join('')}<button data-r="insights" class="${key === 'insights' ? 'active' : ''}">${S.icon('sparkle')} Automatización e insights</button></div><div id="rep"></div>`;
      el.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => S.setParams({ r: b.dataset.r, tab: '' })));
      const box = el.querySelector('#rep');
      if (key === 'insights') return insights(box, params, bids);
      const def = REPORTS[key];
      const rc = S.rangeControl(params, (p) => S.setParams(p));
      const out = def.build({ from: rc.from, to: rc.to, bids });
      box.innerHTML = `<div class="toolbar">${def.noRange ? `<span class="muted small">Corte al ${S.fdt(new Date())}</span>` : rc.html}<div class="grow"></div><button class="btn sm" id="csv">${S.icon('download')}CSV</button><button class="btn sm" id="pdf">${S.icon('printer')}Imprimir / PDF</button></div>
        <div class="grid g4" style="margin-bottom:16px">${out.kpis.map(([l, v]) => `<div class="card kpi"><span class="label">${esc(l)}</span><span class="value" style="font-size:19px">${v}</span></div>`).join('')}</div>
        ${out.chart ? `<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>${esc(out.chartTitle || def.label)}</h2>${out.legend ? `<div class="legend">${out.legend.map(([n, c]) => `<span><i style="border-color:var(${c})"></i>${n}</span>`).join('')}</div>` : ''}</div><div id="ch"></div></div>` : ''}
        <div class="toolbar"><div class="search">${S.icon('search')}<input class="input sm" id="flt" placeholder="Filtrar tabla" aria-label="Filtrar tabla"></div></div><div class="card flush" id="tbl"></div>`;
      if (!def.noRange) rc.bind(box);
      if (out.chart) out.chart(box.querySelector('#ch'));
      const tb = S.table(box.querySelector('#tbl'), out.cols, { rows: out.rows, pageSize: 25 });
      box.querySelector('#flt').addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        tb.update(out.rows.filter((r) => out.cols.some((c) => String(c.csv ? c.csv(r) : r[c.key] ?? '').toLowerCase().includes(q))));
      });
      const csvCols = out.cols.map((c) => [c.csv || c.key, c.label]);
      const title = `${def.label}${def.noRange ? '' : ` · ${rc.from} a ${rc.to}`}`;
      box.querySelector('#csv').addEventListener('click', () => S.download(`${key}-${def.noRange ? S.stamp() : rc.from + '-a-' + rc.to}.csv`, S.toCSV(tb.rows(), csvCols)));
      box.querySelector('#pdf').addEventListener('click', () => S.print(`<h2>${esc(S.db.company.name)}</h2><h1>${esc(title)}</h1><p>${bids.map(S.branchName).map(esc).join(', ')} · generado ${S.fdt(new Date())} por ${esc(S.user.name)}</p>
        <p>${out.kpis.map(([l, v]) => `<b>${esc(l)}:</b> ${String(v).replace(/<[^>]+>/g, '')}`).join(' · ')}</p>
        <table><thead><tr>${out.cols.map((c) => `<th class="${c.num ? 'num' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${tb.rows().map((r) => `<tr>${out.cols.map((c) => `<td class="${c.num ? 'num' : ''}">${String(c.render ? c.render(r) : esc(r[c.key] ?? '')).replace(/<(?!\/?b>)[^>]+>/g, ' ')}</td>`).join('')}</tr>`).join('')}</tbody></table>
        <p style="margin-top:12px;font-size:10px">En el cuadro de impresión elija "Guardar como PDF" para obtener el archivo.</p>`));
    },
  });

  function insights(box, params, bids) {
    const tab = params.tab || 'reorder';
    const T = [['reorder', 'Sugerencias de reposición'], ['low', 'Baja rotación'], ['margin', 'Alertas de margen'], ['anom', 'Variaciones de ventas']];
    box.innerHTML = `<div class="seg" style="margin-bottom:14px">${T.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div><div id="ins"></div>`;
    box.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => S.setParams({ tab: b.dataset.t })));
    const el = box.querySelector('#ins');
    const rule = (t) => `<div class="banner info">${S.icon('info')}<span><b>Regla:</b> ${t}</span></div>`;
    if (tab === 'reorder') {
      const rows = A.reorder(bids);
      const sel = new Set();
      el.innerHTML = `${rule(`punto de reorden = venta diaria promedio de los últimos 30 días × (tiempo de entrega del proveedor + ${A.SAFETY_DAYS} días de seguridad). Se sugiere reponer cuando la existencia más lo pedido en tránsito está por debajo del punto de reorden o del stock mínimo; la cantidad lleva al stock máximo.`)}
        <div class="toolbar"><span class="muted small">${S.num(rows.length)} sugerencia(s)</span><div class="grow"></div>${S.can('purchases.create') ? `<button class="btn primary" id="gen" disabled>${S.icon('truck')}Generar solicitudes de compra</button>` : ''}</div><div class="card flush" id="tbl"></div>`;
      S.table(el.querySelector('#tbl'), [
        ...(S.can('purchases.create') ? [{ key: 'sel', label: '', render: (r) => `<input type="checkbox" data-sel="${r.p.id}|${r.bid}" aria-label="Seleccionar" ${r.supplier ? '' : 'disabled title="Sin proveedor preferido"'}>` }] : []),
        { key: 'name', label: 'Producto', sort: (r) => r.p.name, render: (r) => `<b>${esc(r.p.name)}</b><div class="small muted">${esc(r.supplier ? r.supplier.name : 'Sin proveedor preferido')}</div>` },
        { key: 'b', label: 'Sucursal', render: (r) => esc(S.branchName(r.bid)) },
        { key: 'stock', label: 'Existencia', num: true, sort: true, render: (r) => S.qty(r.p, r.stock) },
        { key: 'transit', label: 'En tránsito', num: true, render: (r) => S.num(r.transit, 2) },
        { key: 'daily', label: 'Venta diaria', num: true, sort: true, render: (r) => S.num(r.daily, 2) },
        { key: 'point', label: 'Punto de reorden', num: true, render: (r) => S.num(r.point, 1) + `<div class="small muted">${r.lead} + ${A.SAFETY_DAYS} días</div>` },
        { key: 'daysLeft', label: 'Alcanza para', num: true, sort: (r) => r.daysLeft ?? -1, render: (r) => (r.daysLeft == null ? '—' : `<span class="${r.daysLeft < r.lead ? 'danger' : 'warn'}">${S.num(r.daysLeft, 1)} días</span>`) },
        { key: 'qty', label: 'Sugerido', num: true, sort: true, render: (r) => `<b>${S.qty(r.p, r.qty)}</b><div class="small muted">${S.money(r.qty * r.cost)}</div>` },
      ], { rows, pageSize: 30, empty: 'No hay productos por debajo del punto de reorden.' });
      el.querySelector('#tbl').addEventListener('change', (e) => {
        const k = e.target.dataset.sel;
        if (!k) return;
        e.target.checked ? sel.add(k) : sel.delete(k);
        el.querySelector('#gen').disabled = !sel.size;
      });
      const gen = el.querySelector('#gen');
      if (gen) gen.addEventListener('click', () => {
        const chosen = rows.filter((r) => sel.has(r.p.id + '|' + r.bid) && r.supplier);
        const groups = {};
        chosen.forEach((r) => (groups[r.supplier.id + '|' + r.bid] = groups[r.supplier.id + '|' + r.bid] || []).push(r));
        try {
          const made = S.tx((d) => Object.entries(groups).map(([k, rs]) => {
            S.require('purchases.create');
            const [supplierId, bid] = k.split('|');
            S.assertBranch(bid);
            return S.ops.createPurchase(d, { supplierId, bid, items: rs.map((r) => ({ pid: r.p.id, qty: r.qty, cost: Math.round(r.cost) })), notes: 'Generada desde sugerencias de reposición' }, { userId: S.user.id });
          }));
          S.toast(`${made.length} solicitud(es) de compra creada(s): ${made.map((o) => o.number).join(', ')}.`);
          S.go('purchases', { status: 'REQUESTED' });
        } catch (e) {
          S.fail(e);
        }
      });
    }
    if (tab === 'low') {
      const rows = A.lowRotation(bids);
      el.innerHTML = `${rule('productos con existencias que no se vendieron en los últimos 30 días, o con más de 120 días de inventario al ritmo de venta actual.')}<div class="card flush" id="tbl"></div>`;
      S.table(el.querySelector('#tbl'), [
        { key: 'name', label: 'Producto', sort: (r) => r.p.name, render: (r) => `<b>${esc(r.p.name)}</b>` },
        { key: 'b', label: 'Sucursal', render: (r) => esc(S.branchName(r.bid)) },
        { key: 'stock', label: 'Existencia', num: true, sort: true, render: (r) => S.qty(r.p, r.stock) },
        { key: 'daily', label: 'Venta diaria', num: true, render: (r) => S.num(r.daily, 2) },
        { key: 'days', label: 'Días de inventario', num: true, sort: (r) => (r.days === Infinity ? 1e9 : r.days), render: (r) => (r.days === Infinity ? 'Sin ventas' : S.num(r.days, 0)) },
        { key: 'value', label: 'Capital inmovilizado', num: true, sort: true, render: (r) => S.money(r.value) },
      ], { rows, empty: 'No hay productos de baja rotación.' });
    }
    if (tab === 'margin') {
      const rows = A.marginAlerts();
      el.innerHTML = `${rule('margen = (precio sin IVA − costo promedio) ÷ precio sin IVA. Se alerta si es negativo (se vende con pérdida) o menor al 10 %.')}<div class="card flush" id="tbl"></div>`;
      S.table(el.querySelector('#tbl'), [
        { key: 'name', label: 'Producto', sort: (r) => r.p.name, render: (r) => `<b>${esc(r.p.name)}</b><div class="small muted">${esc(r.p.sku)}</div>` },
        { key: 'price', label: 'Precio con IVA', num: true, render: (r) => S.money(r.p.price) },
        { key: 'base', label: 'Precio sin IVA', num: true, render: (r) => S.money(r.base) },
        { key: 'cost', label: 'Costo promedio', num: true, render: (r) => S.money(r.p.avgCost) },
        { key: 'margin', label: 'Margen', num: true, sort: true, render: (r) => `<b class="${r.margin < 0 ? 'danger' : 'warn'}">${S.pct(r.margin)}</b>` },
        { key: 'alert', label: 'Alerta', render: (r) => (r.margin < 0 ? S.badge('Margen negativo', 'danger') : S.badge('Margen bajo', 'warn')) },
      ], { rows, empty: 'Todos los productos tienen margen de 10 % o más.' });
    }
    if (tab === 'anom') {
      const rows = A.anomalies(bids);
      el.innerHTML = `${rule('las ventas de cada uno de los últimos 7 días se comparan con el promedio del mismo día de la semana en las 4 semanas anteriores. Se marca la variación de ±30 % o más.')}<div class="card flush" id="tbl"></div>`;
      S.table(el.querySelector('#tbl'), [
        { key: 'day', label: 'Día', render: (r) => S.parseDay(r.day).toLocaleDateString('es-CO', { weekday: 'long', day: '2-digit', month: 'short' }) },
        { key: 'value', label: 'Ventas', num: true, render: (r) => S.money(r.value) },
        { key: 'avg', label: 'Promedio 4 semanas', num: true, render: (r) => S.money(r.avg) },
        { key: 'diff', label: 'Variación', num: true, render: (r) => `<b class="${r.diff >= 0 ? 'ok' : 'danger'}">${r.diff >= 0 ? '+' : ''}${S.pct(r.diff)}</b>` },
        { key: 'flag', label: '', render: (r) => (r.flag ? S.badge(r.diff > 0 ? 'Alza inusual' : 'Caída inusual', r.diff > 0 ? 'info' : 'warn') : S.badge('Normal')) },
      ], { rows, empty: 'Se necesitan al menos 5 semanas de ventas para comparar.' });
    }
  }

  // =====================================================================
  // USUARIOS Y PERMISOS
  // =====================================================================
  S.route('users', {
    title: 'Usuarios y permisos', icon: 'shield', perm: 'users.view',
    render(el, params) {
      const tab = params.tab === 'roles' ? 'roles' : 'users';
      const manage = S.can('users.manage');
      el.innerHTML = `${S.pageHead('Usuarios y permisos', 'Roles con permisos por módulo y acceso por sucursal.', manage ? (tab === 'users' ? `<button class="btn primary" id="new">${S.icon('plus')}Nuevo usuario</button>` : `<button class="btn primary" id="newr">${S.icon('plus')}Nuevo rol</button>`) : '')}
        <div class="tabs"><button data-t="users" class="${tab === 'users' ? 'active' : ''}">Usuarios</button><button data-t="roles" class="${tab === 'roles' ? 'active' : ''}">Roles y permisos</button></div><div class="card flush" id="tbl"></div>`;
      el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => S.setParams({ tab: b.dataset.t })));
      if (tab === 'users') {
        const now = new Date();
        S.table(el.querySelector('#tbl'), [
          { key: 'name', label: 'Usuario', sort: true, render: (u) => `<b>${esc(u.name)}</b>${u.id === S.user.id ? ' ' + S.badge('Usted', 'primary') : ''}<div class="small muted">${esc(u.email)}</div>` },
          { key: 'role', label: 'Rol', sort: (u) => (S.role(u.roleId) || {}).name, render: (u) => esc((S.role(u.roleId) || {}).name || '—') },
          { key: 'br', label: 'Sucursales', render: (u) => (u.allBranches ? 'Todas' : esc(u.branchIds.map(S.branchName).join(', ') || '—')) },
          { key: 'lastLoginAt', label: 'Último ingreso', sort: true, render: (u) => (u.lastLoginAt ? S.fdt(u.lastLoginAt) : '—') },
          { key: 'st', label: 'Estado', render: (u) => (!u.active ? S.badge('Inactivo') : u.lockedUntil && new Date(u.lockedUntil) > now ? S.badge('Bloqueado', 'danger') : S.badge('Activo', 'ok')) },
        ], { rows: S.db.users, sort: { key: 'name', dir: 1 }, onRow: manage ? (u) => userModal(u) : null });
        if (manage) el.querySelector('#new').addEventListener('click', () => userModal());
      } else {
        S.table(el.querySelector('#tbl'), [
          { key: 'name', label: 'Rol', sort: true, render: (r) => `<b>${esc(r.name)}</b>${r.system ? ' ' + S.badge('Base') : ''}` },
          { key: 'perms', label: 'Permisos', num: true, render: (r) => (r.key === 'ADMIN' ? 'Todos' : S.num(r.perms.length)) },
          { key: 'users', label: 'Usuarios', num: true, render: (r) => S.num(S.db.users.filter((u) => u.roleId === r.id && u.active).length) },
          { key: 'mods', label: 'Módulos', render: (r) => esc(S.PERMISSIONS.filter(([, ps]) => ps.some(([k]) => r.key === 'ADMIN' || r.perms.includes(k))).map(([m]) => m).join(', ')) },
        ], { rows: S.db.roles, onRow: (r) => roleModal(r) });
        if (manage) el.querySelector('#newr').addEventListener('click', () => roleModal());
      }
    },
  });
  function userModal(u) {
    const branches = S.db.branches.filter((b) => b.active);
    const v = u || { active: true, branchIds: [], allBranches: false };
    const locked = u && u.lockedUntil && new Date(u.lockedUntil) > new Date();
    const self = u && u.id === S.user.id;
    S.modal({
      title: u ? 'Editar usuario' : 'Nuevo usuario', size: 'lg',
      body: `<form class="stack" id="f" novalidate>${locked ? `<div class="banner warn">${S.icon('lock')}<span>Cuenta bloqueada por intentos fallidos hasta ${S.fdt(u.lockedUntil)}. <button type="button" class="btn sm" id="unlock">Desbloquear</button></span></div>` : ''}
        <div class="grid g2"><label class="field"><span>Nombre *</span><input class="input" name="name" value="${esc(v.name || '')}" maxlength="80"></label>
        <label class="field"><span>Correo *</span><input class="input" name="email" type="email" value="${esc(v.email || '')}" ${u ? 'readonly' : ''}></label>
        <label class="field"><span>Rol *</span><select class="select" name="roleId" ${self ? 'disabled' : ''}>${S.options(S.db.roles.map((r) => [r.id, r.name]), v.roleId, { empty: 'Seleccione…' })}</select>${self ? '<small>No puede cambiar su propio rol.</small>' : ''}</label>
        <label class="field"><span>${u ? 'Nueva contraseña (opcional)' : 'Contraseña inicial *'}</span><input class="input" name="password" type="password" autocomplete="new-password"><small>8+ caracteres con mayúsculas, minúsculas y números. ${u ? 'Cambiarla cierra sus sesiones.' : ''}</small></label></div>
        <fieldset class="card" style="padding:10px 12px"><legend class="small" style="font-weight:600;padding:0 4px">Sucursales</legend>
          <label class="check"><input type="checkbox" name="allBranches" ${v.allBranches ? 'checked' : ''}><span>Todas las sucursales (incluidas las futuras)</span></label>
          <div class="row wrap" style="margin-top:8px" id="brs">${branches.map((b) => `<label class="check"><input type="checkbox" data-b="${b.id}" ${v.branchIds.includes(b.id) ? 'checked' : ''}><span>${esc(b.name)}</span></label>`).join('')}</div></fieldset>
        ${u ? `<label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''} ${self ? 'disabled' : ''}><span><b>Activo</b><div class="small muted">Desactivar cierra sus sesiones al instante.</div></span></label>` : ''}
        <div class="form-error hidden" id="err" role="alert"></div></form>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Guardar</button>`,
      onMount(m, close) {
        const f = m.querySelector('#f');
        const sync = () => m.querySelector('#brs').querySelectorAll('input').forEach((i) => (i.disabled = f.allBranches.checked));
        f.allBranches.addEventListener('change', sync);
        sync();
        const ul = m.querySelector('#unlock');
        if (ul) ul.addEventListener('click', () => {
          S.tx((d) => {
            S.require('users.manage');
            const x = d.users.find((y) => y.id === u.id);
            x.lockedUntil = null;
            x.failed = 0;
            S.audit('user.unlock', 'Usuario', u.id, { locked: true }, { locked: false });
          });
          close();
          S.toast('Usuario desbloqueado.');
          S.refresh();
        });
        m.querySelector('#ok').addEventListener('click', async () => {
          const d = S.formData(f);
          const branchIds = [...m.querySelectorAll('[data-b]:checked')].map((i) => i.dataset.b);
          try {
            S.require('users.manage');
            if ((d.name || '').trim().length < 3) throw S.err('Indique el nombre.');
            const email = (d.email || '').trim().toLowerCase();
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw S.err('Correo inválido.');
            const roleId = self ? u.roleId : d.roleId;
            if (!S.role(roleId)) throw S.err('Seleccione un rol.');
            if (!d.allBranches && !branchIds.length) throw S.err('Asigne al menos una sucursal.');
            if (!u || d.password) {
              const issue = S.passwordIssue(d.password);
              if (issue) throw S.err(issue);
            }
            if (!u) {
              for (const c of S.index().companies) {
                const db = c.id === S.db.company.id ? S.db : S.loadCompany(c.id);
                if (db && db.users.some((x) => x.email === email)) throw S.err('Ya existe un usuario con ese correo.', 'DUPLICATE');
              }
            }
            const pw = d.password ? await S.hashPassword(d.password) : null;
            S.tx((db) => {
              const adminRole = db.roles.find((r) => r.key === 'ADMIN').id;
              if (u) {
                const x = db.users.find((y) => y.id === u.id);
                const before = { ...x };
                const active = self ? true : !!d.active;
                if (x.roleId === adminRole && x.active && (roleId !== adminRole || !active) && db.users.filter((y) => y.active && y.roleId === adminRole).length === 1) throw S.err('Debe quedar al menos un administrador activo.');
                if (active && !x.active) {
                  const prev = S.db;
                  S.db = db;
                  try { S.assertPlan('users'); } finally { S.db = prev; }
                }
                Object.assign(x, { name: d.name.trim(), roleId, allBranches: !!d.allBranches, branchIds: d.allBranches ? [] : branchIds, active });
                if (pw || (!active && before.active)) x.sessionVersion = (x.sessionVersion || 0) + 1;
                if (pw) x.pw = pw;
                S.audit(pw ? 'user.password' : 'user.update', 'Usuario', x.id, before, { ...x });
              } else {
                const prev = S.db;
                S.db = db;
                try { S.assertPlan('users'); } finally { S.db = prev; }
                const x = { id: S.uid(), name: d.name.trim(), email, roleId, allBranches: !!d.allBranches, branchIds: d.allBranches ? [] : branchIds, active: true, pw, failed: 0, lockedUntil: null, createdAt: new Date().toISOString() };
                db.users.push(x);
                S.audit('user.create', 'Usuario', x.id, null, { ...x });
              }
            });
            close();
            S.toast('Usuario guardado.');
            S.refresh();
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }
  function roleModal(r) {
    const manage = S.can('users.manage');
    const isAdmin = r && r.key === 'ADMIN';
    const has = (k) => isAdmin || (r && r.perms.includes(k));
    const ro = !manage || isAdmin;
    S.modal({
      title: r ? `Rol: ${r.name}` : 'Nuevo rol', size: 'xl',
      body: `<form class="stack" id="f">${isAdmin ? `<div class="banner info">${S.icon('lock')}<span>El Administrador conserva siempre todos los permisos.</span></div>` : ''}
        <label class="field" style="max-width:360px"><span>Nombre *</span><input class="input" name="name" value="${esc(r ? r.name : '')}" ${ro || (r && r.system) ? 'disabled' : ''} maxlength="40"></label>
        <div class="perm-grid">${S.PERMISSIONS.map(([mod, ps]) => `<fieldset><legend>${esc(mod)}</legend>${ps.map(([k, l]) => `<label class="check small"><input type="checkbox" data-p="${k}" ${has(k) ? 'checked' : ''} ${ro ? 'disabled' : ''}><span>${esc(l)}</span></label>`).join('')}</fieldset>`).join('')}</div>
        <div class="form-error hidden" id="err"></div></form>`,
      foot: ro ? `<button class="btn" data-close>Cerrar</button>` : `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Guardar permisos</button>`,
      onMount(m, close) {
        if (ro) return;
        m.querySelector('#ok').addEventListener('click', () => {
          const perms = [...m.querySelectorAll('[data-p]:checked')].map((i) => i.dataset.p);
          const name = (m.querySelector('[name=name]').value || '').trim();
          try {
            S.tx((d) => {
              S.require('users.manage');
              if (r) {
                const x = d.roles.find((y) => y.id === r.id);
                const before = { perms: [...x.perms] };
                x.perms = perms;
                if (!x.system && name) x.name = name;
                S.audit('role.update', 'Rol', x.id, before, { name: x.name, perms });
              } else {
                if (name.length < 3) throw S.err('Indique el nombre del rol.');
                if (d.roles.some((y) => y.name.toLowerCase() === name.toLowerCase())) throw S.err('Ya existe un rol con ese nombre.', 'DUPLICATE');
                const x = { id: S.uid(), key: 'CUSTOM', name, perms, system: false };
                d.roles.push(x);
                S.audit('role.create', 'Rol', x.id, null, x);
              }
            });
            close();
            S.toast('Rol guardado. Los permisos aplican de inmediato.');
            S.refresh();
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }

  // =====================================================================
  // AUDITORÍA
  // =====================================================================
  S.route('audit', {
    title: 'Auditoría', icon: 'history', perm: 'audit.view',
    render(el, params) {
      const rc = S.rangeControl({ range: params.range || '7d', from: params.from, to: params.to }, (p) => S.setParams(p));
      const ents = [...new Set(S.db.audit.map((a) => a.entity))].sort();
      const types = [...new Set(S.db.audit.map((a) => a.action))].sort();
      el.innerHTML = `${S.pageHead('Auditoría', 'Registro de cada operación sensible con valores anteriores y nuevos.', `<button class="btn" id="exp">${S.icon('download')}Exportar CSV</button>`)}
        <div class="toolbar">${rc.html}<select class="select" id="u" aria-label="Usuario">${S.options(S.db.users.map((u) => [u.id, u.name]), params.u, { empty: 'Todos los usuarios' })}</select>
          <select class="select" id="e" aria-label="Entidad">${S.options(ents.map((x) => [x, x]), params.e, { empty: 'Todas las entidades' })}</select>
          <select class="select" id="a" aria-label="Acción">${S.options(types.map((x) => [x, S.auditLabel(x)]), params.a, { empty: 'Todas las acciones' })}</select></div><div class="card flush" id="tbl"></div>`;
      rc.bind(el);
      const rows = S.db.audit.filter((a) => S.dayKey(a.ts) >= rc.from && S.dayKey(a.ts) <= rc.to && (!params.u || a.userId === params.u) && (!params.e || a.entity === params.e) && (!params.a || a.action === params.a)).slice().reverse();
      const tb = S.table(el.querySelector('#tbl'), [
        { key: 'ts', label: 'Fecha y hora', sort: true, render: (a) => `<span class="nowrap">${S.fdt(a.ts)}</span>` },
        { key: 'u', label: 'Usuario', render: (a) => esc(S.userName(a.userId)) },
        { key: 'action', label: 'Acción', sort: true, render: (a) => `<span class="${/failed|locked|void|reject|cancel/.test(a.action) ? 'warn' : ''}">${esc(S.auditLabel(a.action))}</span>` },
        { key: 'entity', label: 'Entidad', sort: true },
        { key: 'entityId', label: 'Registro', render: (a) => `<span class="small muted">${esc(a.entityId || '—')}</span>` },
        { key: 'device', label: 'Dispositivo', render: (a) => `<span class="small muted">${esc(a.device ? a.device.replace(/^Mozilla\/5\.0 \(/, '').slice(0, 40) : '—')}</span>` },
      ], { rows, pageSize: 40, onRow: (a) => S.modal({ title: S.auditLabel(a.action), size: 'lg',
        body: `<dl class="dl" style="margin-bottom:12px"><dt>Usuario</dt><dd>${esc(S.userName(a.userId))}</dd><dt>Fecha</dt><dd>${S.fdt(a.ts)}</dd><dt>Entidad</dt><dd>${esc(a.entity)} · ${esc(a.entityId || '—')}</dd><dt>Dispositivo</dt><dd class="small">${esc(a.device || '—')}</dd><dt>IP</dt><dd class="small muted">No disponible en la versión HTML (sin servidor)</dd></dl>
          <div class="grid g2"><div><h3 style="margin-bottom:6px">Antes</h3><pre class="json">${esc(a.before ? JSON.stringify(a.before, null, 2) : '—')}</pre></div><div><h3 style="margin-bottom:6px">Después</h3><pre class="json">${esc(a.after ? JSON.stringify(a.after, null, 2) : '—')}</pre></div></div>` }), empty: 'Sin registros con esos filtros.' });
      ['u', 'e', 'a'].forEach((k) => el.querySelector('#' + k).addEventListener('change', (e) => S.setParams({ [k]: e.target.value })));
      el.querySelector('#exp').addEventListener('click', () => S.download(`auditoria-${rc.from}-a-${rc.to}.csv`, S.toCSV(tb.rows(), [[(a) => S.fdt(a.ts), 'Fecha'], [(a) => S.userName(a.userId), 'Usuario'], [(a) => S.auditLabel(a.action), 'Acción'], ['action', 'Código'], ['entity', 'Entidad'], ['entityId', 'Registro'],
        [(a) => (a.before ? JSON.stringify(a.before) : ''), 'Antes'], [(a) => (a.after ? JSON.stringify(a.after) : ''), 'Después']])));
    },
  });

  // =====================================================================
  // CONFIGURACIÓN
  // =====================================================================
  S.route('settings', {
    title: 'Configuración', icon: 'settings', navIf: () => S.can('settings.manage'),
    render(el, params) {
      const admin = S.can('settings.manage');
      const tabs = [...(admin ? [['company', 'Empresa'], ['branches', 'Sucursales'], ['plan', 'Plan y suscripción'], ['data', 'Datos y respaldo']] : []), ['account', 'Mi cuenta y seguridad']];
      const tab = tabs.some((t) => t[0] === params.tab) ? params.tab : tabs[0][0];
      el.innerHTML = `${S.pageHead('Configuración', '')}<div class="tabs">${tabs.map(([k, l]) => `<button data-t="${k}" class="${k === tab ? 'active' : ''}">${l}</button>`).join('')}</div><div id="st"></div>`;
      el.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => S.setParams({ tab: b.dataset.t })));
      ({ company: companyTab, branches: branchesTab, plan: planTab, data: dataTab, account: accountTab })[tab](el.querySelector('#st'));
    },
  });
  function companyTab(el) {
    const c = S.db.company;
    el.innerHTML = `<form class="card stack" id="f" style="max-width:640px"><div class="grid g2"><label class="field"><span>Nombre comercial *</span><input class="input" name="name" value="${esc(c.name)}" maxlength="80"></label>
      <label class="field"><span>Razón social</span><input class="input" name="legalName" value="${esc(c.legalName || '')}" maxlength="120"></label>
      <label class="field"><span>NIT</span><input class="input" value="${esc(c.taxId)}" disabled></label>
      <label class="field"><span>Zona horaria</span><select class="select" name="timezone">${S.options([['America/Bogota', 'Colombia (GMT-5)']], c.timezone)}</select><small>Define el corte diario de los reportes. Esta versión usa la hora de este equipo.</small></label></div>
      <div class="form-error hidden" id="err"></div><div><button class="btn primary" id="ok">Guardar</button></div></form>`;
    el.querySelector('#ok').addEventListener('click', (e) => {
      e.preventDefault();
      const d = S.formData(el.querySelector('#f'));
      try {
        if ((d.name || '').trim().length < 2) throw S.err('Indique el nombre.');
        S.tx((db) => {
          S.require('settings.manage');
          const before = { ...db.company };
          db.company.name = d.name.trim();
          db.company.legalName = (d.legalName || '').trim();
          db.company.timezone = d.timezone;
          S.audit('company.update', 'Empresa', db.company.id, before, { ...db.company });
        });
        S.toast('Datos de la empresa guardados.');
        S.refresh();
      } catch (ex) {
        S.showErr(el.querySelector('#err'), ex);
      }
    });
  }
  function branchesTab(el) {
    el.innerHTML = `<div class="toolbar"><div class="grow"></div><button class="btn primary" id="new">${S.icon('plus')}Nueva sucursal</button></div><div class="card flush" id="tbl"></div>`;
    S.table(el.querySelector('#tbl'), [
      { key: 'name', label: 'Sucursal', render: (b) => `<b>${esc(b.name)}</b><div class="small muted">${esc(b.code)}</div>` },
      { key: 'city', label: 'Ciudad' }, { key: 'address', label: 'Dirección' },
      { key: 'active', label: 'Estado', render: (b) => (b.active ? S.badge('Activa', 'ok') : S.badge('Inactiva')) },
    ], { rows: S.db.branches, onRow: branchModal });
    el.querySelector('#new').addEventListener('click', () => branchModal());
  }
  function branchModal(b) {
    S.modal({
      title: b ? 'Editar sucursal' : 'Nueva sucursal',
      body: `<form class="stack" id="f"><div class="grid g2"><label class="field"><span>Nombre *</span><input class="input" name="name" value="${esc(b ? b.name : '')}"></label><label class="field"><span>Código *</span><input class="input" name="code" value="${esc(b ? b.code : '')}" maxlength="12"></label>
        <label class="field"><span>Ciudad</span><input class="input" name="city" value="${esc(b ? b.city : '')}"></label><label class="field"><span>Teléfono</span><input class="input" name="phone" value="${esc(b ? b.phone : '')}"></label>
        <label class="field span2"><span>Dirección</span><input class="input" name="address" value="${esc(b ? b.address : '')}"></label></div>
        ${b ? `<label class="check"><input type="checkbox" name="active" ${b.active ? 'checked' : ''}><span>Activa</span></label>` : ''}<div class="form-error hidden" id="err"></div></form>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Guardar</button>`,
      onMount(m, close) {
        m.querySelector('#ok').addEventListener('click', () => {
          const d = S.formData(m.querySelector('#f'));
          if (b) d.id = b.id;
          try {
            S.act('settings.manage', 'saveBranch', d);
            close();
            S.toast('Sucursal guardada.');
            S.refresh();
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }
  function planTab(el) {
    const c = S.db.company;
    const plan = S.PLANS[c.plan] || S.PLANS.STARTER;
    const used = { branches: S.db.branches.filter((b) => b.active).length, users: S.db.users.filter((u) => u.active).length, products: S.db.products.length };
    const meter = (l, u, max) => `<div class="stack" style="gap:6px"><div class="row between"><span>${l}</span><span class="tnum">${S.num(u)} / ${max >= 999 ? 'ilimitado' : S.num(max)}</span></div><div class="meter"><i style="width:${Math.min(100, (u / max) * 100)}%;${u / max > 0.9 ? 'background:var(--warn)' : ''}"></i></div></div>`;
    el.innerHTML = `<div class="grid g2"><div class="card stack"><div class="row between"><h2>Plan ${esc(plan.name)}</h2>${S.badge(c.subscription.status === 'TRIAL' ? 'Periodo de prueba' : 'Activo', c.subscription.status === 'TRIAL' ? 'info' : 'ok')}</div>
      <p class="muted">Periodo: ${S.fdate(c.subscription.periodStart)} – ${S.fdate(c.subscription.periodEnd)}</p>${meter('Sucursales activas', used.branches, plan.branches)}${meter('Usuarios activos', used.users, plan.users)}${meter('Productos', used.products, plan.products)}</div>
      <div class="card stack"><h2>Planes disponibles</h2><div class="table-wrap"><table class="table"><thead><tr><th>Plan</th><th class="num">Sucursales</th><th class="num">Usuarios</th><th class="num">Productos</th></tr></thead><tbody>
      ${Object.entries(S.PLANS).map(([k, p]) => `<tr><td><b>${p.name}</b>${k === c.plan ? ' ' + S.badge('Actual', 'primary') : ''}</td><td class="num">${p.branches >= 999 ? 'Ilimitadas' : p.branches}</td><td class="num">${p.users >= 999 ? 'Ilimitados' : p.users}</td><td class="num">${p.products >= 999999 ? 'Ilimitados' : S.num(p.products)}</td></tr>`).join('')}</tbody></table></div>
      <div class="banner info">${S.icon('info')}<span>El cambio de plan se solicita al equipo comercial. <b>No hay pagos en línea integrados.</b></span></div></div></div>`;
  }
  function storageUsed() {
    let n = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k.startsWith('s80h.')) n += (k.length + (localStorage.getItem(k) || '').length) * 2;
      }
    } catch {}
    return n;
  }
  function dataTab(el) {
    const used = storageUsed();
    const cap = 10 * 1024 * 1024;
    el.innerHTML = `<div class="grid g2"><div class="card stack"><h2>Dónde están sus datos</h2>
      <div class="banner warn">${S.icon('alert')}<span>Esta versión HTML <b>no tiene servidor ni base de datos</b>: guarda la información en el almacenamiento local de <b>este navegador, en este equipo</b>. Si se borran los datos del navegador, se pierde. Otros equipos no ven estos datos. Para operar con varios equipos y usuarios a la vez use la versión con servidor (carpeta <code>apps/</code>, PostgreSQL).</span></div>
      <div class="stack" style="gap:6px"><div class="row between"><span>Espacio usado (aprox.)</span><span class="tnum">${S.num(used / 1048576, 2)} MB de ~${S.num(cap / 1048576)} MB</span></div><div class="meter"><i style="width:${Math.min(100, (used / cap) * 100)}%;${used / cap > 0.8 ? 'background:var(--warn)' : ''}"></i></div></div>
      <p class="small muted">Movimientos: ${S.num(S.db.movements.length)} · Ventas: ${S.num(S.db.sales.length)} · Registros de auditoría: ${S.num(S.db.audit.length)}</p></div>
      <div class="card stack"><h2>Respaldo</h2><p class="muted">Descargue una copia completa de la empresa en un archivo JSON. Guárdela fuera de este equipo. Las contraseñas van cifradas (PBKDF2), nunca en texto plano.</p>
        <div class="row wrap"><button class="btn primary" id="bk">${S.icon('download')}Descargar respaldo</button><label class="btn">${S.icon('upload')}Restaurar respaldo<input type="file" id="rs" accept=".json,application/json" class="hidden"></label></div>
        ${S.db.company.isDemo ? `<hr style="border:0;border-top:1px solid var(--border);width:100%"><p class="muted small">Empresa de demostración: puede regenerarla con datos nuevos.</p><div><button class="btn danger" id="reset">Regenerar datos de demostración</button></div>` : ''}</div></div>`;
    el.querySelector('#bk').addEventListener('click', () => {
      S.tx(() => S.audit('data.export', 'Empresa', S.db.company.id, null, { movements: S.db.movements.length, sales: S.db.sales.length }));
      S.download(`respaldo-80smart-${S.db.company.taxId}-${S.stamp()}.json`, JSON.stringify({ app: '80smart-html', exportedAt: new Date().toISOString(), data: S.db }), 'application/json');
    });
    el.querySelector('#rs').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const j = JSON.parse(await f.text());
        const d = j && j.data;
        const keys = ['company', 'branches', 'roles', 'users', 'products', 'stock', 'lots', 'movements', 'sales', 'purchases', 'audit'];
        if (!j || j.app !== '80smart-html' || !d || !keys.every((k) => k in d)) throw S.err('El archivo no es un respaldo válido de 80 SMART (versión HTML).');
        if (d.company.id !== S.db.company.id) throw S.err(`El respaldo pertenece a otra empresa (${d.company.name}). Solo se puede restaurar sobre la misma empresa.`);
        if (!(await S.confirm({ title: 'Restaurar respaldo', message: `Se reemplazarán TODOS los datos actuales de <b>${esc(S.db.company.name)}</b> por los del respaldo del ${S.fdt(j.exportedAt)}. Esta acción no se puede deshacer.`, confirmLabel: 'Restaurar', danger: true }))) return;
        if (!d.users.some((u) => u.id === S.user.id && u.active)) throw S.err('Su usuario no existe o está inactivo en ese respaldo; no se restauró para no dejarlo sin acceso.');
        S.require('settings.manage');
        S.db = d;
        S.audit('data.import', 'Empresa', d.company.id, null, { file: f.name, exportedAt: j.exportedAt });
        S._saved = S.writeCompany(S.db);
        S.toast('Respaldo restaurado.');
        S.refresh();
      } catch (ex) {
        S.fail(ex.isUser ? ex : S.err('No se pudo leer el archivo: ' + ex.message));
      }
      e.target.value = '';
    });
    const rs = el.querySelector('#reset');
    if (rs) rs.addEventListener('click', async () => {
      if (!(await S.confirm({ title: 'Regenerar demostración', message: 'Se borrarán los datos de la empresa de demostración en este navegador y se crearán de nuevo. Las empresas reales no se tocan.', confirmLabel: 'Regenerar', danger: true }))) return;
      S.removeCompany(S.db.company.id);
      const d = await S.buildDemo();
      S.writeCompany(d);
      S.logout('Demostración regenerada. Ingrese de nuevo.');
    });
  }
  function accountTab(el) {
    const u = S.user;
    el.innerHTML = `<div class="grid g2"><div class="card stack"><h2>Perfil</h2><dl class="dl"><dt>Nombre</dt><dd>${esc(u.name)}</dd><dt>Correo</dt><dd>${esc(u.email)}</dd><dt>Rol</dt><dd>${esc((S.role(u.roleId) || {}).name)}</dd><dt>Sucursales</dt><dd>${esc(S.myBranches().map((b) => b.name).join(', '))}</dd><dt>Último ingreso</dt><dd>${S.fdt(u.lastLoginAt)}</dd></dl>
      <div class="banner info">${S.icon('info')}<span>Cada pestaña del navegador mantiene su propia sesión, que se cierra tras 30 minutos de inactividad o al cerrar la pestaña.</span></div>
      <div><button class="btn" id="others">Cerrar mis otras sesiones</button></div></div>
      <form class="card stack" id="f"><h2>Cambiar contraseña</h2><label class="field"><span>Contraseña actual *</span><input class="input" type="password" name="current" autocomplete="current-password"></label>
      <label class="field"><span>Nueva contraseña *</span><input class="input" type="password" name="next" autocomplete="new-password"><small>8+ caracteres con mayúsculas, minúsculas y números.</small></label>
      <label class="field"><span>Confirmar *</span><input class="input" type="password" name="confirm" autocomplete="new-password"></label><div class="form-error hidden" id="err"></div><div><button class="btn primary" id="ok">Cambiar contraseña</button></div></form></div>`;
    const bump = (action) => {
      S.tx((d) => {
        const x = d.users.find((y) => y.id === u.id);
        x.sessionVersion = (x.sessionVersion || 0) + 1;
        S.audit(action, 'Usuario', x.id, null, null);
        return x.sessionVersion;
      });
      const s = S.session();
      S.ss.set('s80h.session', { ...s, v: S.db.users.find((y) => y.id === u.id).sessionVersion });
    };
    el.querySelector('#others').addEventListener('click', () => {
      bump('account.sessions');
      S.toast('Las demás sesiones se cerrarán en su próxima acción.');
    });
    el.querySelector('#ok').addEventListener('click', async (e) => {
      e.preventDefault();
      const d = S.formData(el.querySelector('#f'));
      const err = el.querySelector('#err');
      try {
        if (!(await S.verifyPassword(d.current || '', u.pw))) throw S.err('La contraseña actual no es correcta.');
        const issue = S.passwordIssue(d.next);
        if (issue) throw S.err(issue);
        if (d.next !== d.confirm) throw S.err('Las contraseñas no coinciden.');
        const pw = await S.hashPassword(d.next);
        S.tx((db) => {
          db.users.find((y) => y.id === u.id).pw = pw;
        });
        bump('account.password');
        S.toast('Contraseña actualizada. Las demás sesiones se cerraron.');
        S.refresh();
      } catch (ex) {
        S.showErr(err, ex);
      }
    });
  }
})();
