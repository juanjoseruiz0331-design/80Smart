'use strict';
/* Dashboard, Productos e Inventario. */
(function () {
  const S = window.S80;
  const esc = S.esc;
  const A = S.an;
  const short = (k) => S.parseDay(k).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });

  // ---------- Editor de líneas de productos (compras, transferencias, órdenes internas) ----------
  S.itemsEditor = (el, { cost = false, branch = () => null, initial = [], stockLabel = 'Existencia' } = {}) => {
    const items = initial.map((x) => ({ ...x }));
    el.innerHTML = `<div class="search">${S.icon('scan')}<input class="input" data-pick placeholder="Escanee o busque un producto (nombre, SKU o código)…" aria-label="Agregar producto"></div><div data-lines style="margin-top:10px"></div>`;
    const lines = el.querySelector('[data-lines]');
    const P = () => S.mapBy(S.db.products);
    const draw = () => {
      const p = P(), bid = branch();
      lines.innerHTML = items.length
        ? `<div class="table-wrap"><table class="table"><thead><tr><th>Producto</th>${bid ? `<th class="num">${esc(stockLabel)}</th>` : ''}<th class="num">Cantidad</th>${cost ? '<th class="num">Costo unit. sin IVA</th><th class="num">Subtotal</th>' : ''}<th></th></tr></thead><tbody>
          ${items.map((it, i) => `<tr><td><b>${esc(p[it.pid].name)}</b><div class="small muted">${esc(p[it.pid].sku)} · ${esc(p[it.pid].unit)}</div></td>
            ${bid ? `<td class="num">${S.qty(p[it.pid], S.getStock(it.pid, bid))}</td>` : ''}
            <td class="num"><input class="input sm right" style="width:96px" type="number" min="0" step="${p[it.pid].unit === 'und' ? 1 : 0.001}" data-q="${i}" value="${it.qty}" aria-label="Cantidad"></td>
            ${cost ? `<td class="num"><input class="input sm right" style="width:120px" type="number" min="0" step="1" data-c="${i}" value="${it.cost}" aria-label="Costo"></td><td class="num">${S.money(it.qty * it.cost)}</td>` : ''}
            <td class="right"><button type="button" class="btn ghost icon sm" data-rm="${i}" aria-label="Quitar">${S.icon('trash')}</button></td></tr>`).join('')}
          </tbody>${cost ? `<tfoot><tr><td colspan="${bid ? 4 : 3}">Total</td><td class="num">${S.money(S.sum(items, (x) => x.qty * x.cost))}</td><td></td></tr></tfoot>` : ''}</table></div>`
        : `<div class="empty small">Aún no hay productos.</div>`;
    };
    lines.addEventListener('change', (e) => {
      const q = e.target.dataset.q, c = e.target.dataset.c;
      if (q !== undefined) items[+q].qty = +e.target.value;
      if (c !== undefined) items[+c].cost = +e.target.value;
      draw();
    });
    lines.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rm]');
      if (b) (items.splice(+b.dataset.rm, 1), draw());
    });
    const add = (p, qty = 1, c) => {
      const ex = items.find((x) => x.pid === p.id);
      if (ex) ex.qty = S.r3(ex.qty + qty);
      else items.push({ pid: p.id, qty, cost: c ?? Math.round(p.lastCost || p.avgCost) });
      draw();
    };
    S.productPicker(el.querySelector('[data-pick]'), { onPick: (p) => add(p), extra: (p) => (branch() ? 'Exist.: ' + S.qty(p, S.getStock(p.id, branch())) : S.money(p.price)) });
    draw();
    return { items: () => items.filter((x) => x.qty > 0), add, redraw: draw };
  };

  // =====================================================================
  // DASHBOARD
  // =====================================================================
  S.route('dashboard', {
    title: 'Dashboard', icon: 'dashboard', perm: 'dashboard.view',
    render(el, params) {
      const bids = S.scopeBranches();
      const rc = S.rangeControl(params, (p) => S.setParams(p));
      const { from, to } = rc;
      const prev = A.previous(from, to);
      const cur = A.summary(A.sales(from, to, bids));
      const before = A.summary(A.sales(prev.from, prev.to, bids));
      const t = S.today();
      const today = A.summary(A.sales(t, t, bids));
      // Hoy está en curso: se compara con el mismo día de la semana pasada hasta la misma hora.
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      const lastWeek = A.summary(A.sales(S.addDayKey(t, -7), S.addDayKey(t, -7), bids).filter((s) => { const d = new Date(s.ts); return d.getHours() * 60 + d.getMinutes() <= nowMin; }));
      const month = A.summary(A.sales(t.slice(0, 8) + '01', t, bids));
      const delta = (a, b) => (b ? (a - b) / b : null);
      const dHtml = (d, label) => (d == null ? `<span class="sub">Sin datos de ${label}</span>` : `<span class="sub"><span class="delta ${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '▲' : '▼'} ${S.pct(Math.abs(d))}</span> vs ${label}</span>`);
      const inv = A.inventory(bids);
      const invValue = S.sum(inv, (r) => r.value);
      const available = new Set(inv.filter((r) => r.qty > 0 && r.p.active).map((r) => r.p.id)).size;
      const critical = inv.filter((r) => r.p.active && r.qty <= r.p.minStock).length;
      const soon = S.db.lots.filter((l) => l.qty > 0 && bids.includes(l.bid) && l.exp >= t && l.exp <= S.addDayKey(t, 7)).length;
      const pendPO = S.db.purchases.filter((p) => bids.includes(p.bid) && ['REQUESTED', 'APPROVED', 'SENT', 'PARTIAL'].includes(p.status)).length;
      const pendIO = S.db.internal.filter((o) => bids.includes(o.fromBid) && ['PENDING', 'APPROVED', 'PREPARING'].includes(o.status)).length;
      const activeTotal = Math.max(1, S.db.products.filter((p) => p.active).length);
      const availPct = Math.round((available / activeTotal) * 100);
      const marginPct = Math.round((cur.margin || 0) * 100);
      const kpi = (label, icon, value, sub, href, tone = '') => `<${href ? `a href="${href}"` : 'div'} class="card kpi ${tone}"><span class="label">${S.icon(icon)}${label}</span><span class="value">${value}</span>${sub}</${href ? 'a' : 'div'}>`;

      const calHtml = S.calendarCardHtml([
        { title: `Ventas hoy: ${S.money(today.total)}`, detail: `${S.num(today.count)} transacciones registradas`, tag: 'Hoy', tone: 'coral' },
        { title: `Disponibilidad de catálogo`, detail: `${S.num(available)} de ${S.num(activeTotal)} productos con stock`, tag: `${availPct}%`, tone: 'ok' },
        { title: `Alertas de inventario`, detail: `${S.num(critical)} críticos · ${S.num(soon)} lotes por vencer`, tag: 'FEFO', tone: critical || soon ? 'warn' : 'ok' },
        { title: `Operaciones en curso`, detail: `${S.num(pendPO)} compras · ${S.num(pendIO)} órdenes internas`, tag: 'Activas', tone: 'ok' },
      ]);

      el.innerHTML = `${S.pageHead(`Hola, ${(S.user.name || '').split(' ')[0]} · Centro de operaciones`, `${bids.length > 1 ? 'Todas sus sucursales' : esc(S.branchName(bids[0]))} · ${S.fdate(from)} – ${S.fdate(to)}`, rc.html)}
        <div class="exec-hero-grid">
          <div class="card emerald stack" style="justify-content:space-between;padding:22px">
            <div class="row between wrap" style="gap:18px;align-items:center">
              <div style="flex:1;min-width:240px">
                <span class="badge" style="background:rgba(255,255,255,0.16);border-color:rgba(255,255,255,0.28);color:#fff">Resumen ejecutivo · 80 SMART</span>
                <h2 style="font-size:28px;font-weight:800;margin-top:10px">${S.money(cur.total)} en el periodo</h2>
                <p style="margin-top:4px;opacity:0.9">Ganancia bruta estimada ${S.money(cur.profit)} con ${S.num(cur.count)} transacciones completadas.</p>
                <div class="exec-mini-pills">
                  <div class="exec-mini-pill"><span>Tickets hoy</span><b>${S.num(today.count)}</b></div>
                  <div class="exec-mini-pill"><span>Ticket prom.</span><b>${S.money(cur.ticket)}</b></div>
                  <div class="exec-mini-pill"><span>Disponibles</span><b>${availPct}%</b></div>
                </div>
              </div>
              <div style="padding:14px;border-radius:18px;background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.22);text-align:center">
                ${S.gaugeHtml(marginPct, marginPct + '%', 'Margen bruto')}
              </div>
            </div>
            <div class="row wrap" style="border-top:1px solid rgba(255,255,255,0.22);padding-top:14px;margin-top:8px">
              ${S.can('sales.pos') ? `<a class="btn sm" style="background:#fff;color:#047857;border-color:#fff;font-weight:700" href="#/pos">${S.icon('cart')}Punto de venta</a>` : ''}
              <a class="btn sm" style="background:rgba(255,255,255,0.16);color:#fff;border-color:rgba(255,255,255,0.35)" href="#/incomes">${S.icon('income')}Ingresos</a>
              <a class="btn sm" style="background:rgba(255,255,255,0.16);color:#fff;border-color:rgba(255,255,255,0.35)" href="#/cash-registers">${S.icon('cashregister')}Ventas y cajas</a>
              ${S.can('inventory.view') ? `<a class="btn sm" style="background:rgba(0,0,0,0.24);color:#fff;border-color:rgba(255,255,255,0.25)" href="#/inventory">${S.icon('layers')}Inventario</a>` : ''}
            </div>
          </div>
          ${calHtml}
        </div>
        <div class="grid g4 panel-stagger" style="margin-bottom:16px">
          ${kpi('Ventas de hoy', 'dollar', S.money(today.total), dHtml(delta(today.total, lastWeek.total), 'la semana pasada a esta hora'), '#/sales')}
          ${kpi('Ventas del mes', 'calendar', S.money(month.total), `<span class="sub">${S.num(month.count)} transacciones</span>`, '#/incomes')}
          ${kpi('Ventas del periodo', 'trend', S.money(cur.total), dHtml(delta(cur.total, before.total), `los ${prev.n} días anteriores`), '#/incomes')}
          ${kpi('Ganancia bruta', 'chart', S.money(cur.profit), `<span class="sub">Margen ${S.pct(cur.margin)} · ingreso sin IVA − costo</span>`, '#/reports', 'emerald')}
        </div>
        <div class="card" style="margin-bottom:16px"><div class="card-head"><div><h2>Ventas diarias</h2><p>Ticket promedio ${S.money(cur.ticket)} · ${S.num(cur.count)} ventas</p></div>
          <div class="legend"><span><i style="border-color:var(--primary)"></i>Periodo actual</span><span><i class="dash" style="border-color:var(--chart-prev)"></i>Periodo anterior</span></div></div><div id="dchart"></div></div>
        <div class="grid g3 panel-stagger" style="margin-bottom:16px">
          ${kpi('Valor del inventario', 'layers', S.money(invValue), '<span class="sub">A costo promedio ponderado</span>', S.can('inventory.view') ? '#/inventory' : '', 'emerald')}
          ${kpi('Productos disponibles', 'package', S.num(available), `<span class="sub">de ${S.num(S.db.products.filter((p) => p.active).length)} activos</span>`, S.can('inventory.view') ? '#/inventory?status=ok' : '')}
          ${kpi('Stock crítico o agotado', 'alert', `<span class="${critical ? 'warn' : ''}">${S.num(critical)}</span>`, '<span class="sub">Existencia ≤ stock mínimo</span>', S.can('inventory.view') ? '#/inventory?status=critical' : '')}
          ${kpi('Lotes por vencer (7 días)', 'clock', `<span class="${soon ? 'warn' : ''}">${S.num(soon)}</span>`, '<span class="sub">Con existencias</span>', S.can('inventory.view') ? '#/inventory?tab=lots&status=soon' : '')}
          ${kpi('Compras pendientes', 'truck', S.num(pendPO), '<span class="sub">Solicitudes, aprobadas, enviadas o parciales</span>', S.can('purchases.view') ? '#/purchases?status=open' : '')}
          ${kpi('Órdenes internas abiertas', 'clipboard', S.num(pendIO), '<span class="sub">Pendientes, aprobadas o en preparación</span>', S.can('internal.view') ? '#/internal?status=open' : '')}
        </div>
        <div class="grid g3">
          <div class="card"><div class="card-head"><h2>Ventas por categoría</h2></div><div id="dcat"></div></div>
          <div class="card flush"><div class="card-head" style="padding:16px 16px 0"><h2>Productos más vendidos</h2></div><div id="dtop"></div></div>
          <div class="card"><div class="card-head"><h2>Actividad reciente</h2></div><div class="list small" id="dact"></div></div>
        </div>`;
      rc.bind(el);
      const days = A.days(from, to);
      const dc = A.daily(from, to, bids), dp = A.daily(prev.from, prev.to, bids);
      const prevDays = A.days(prev.from, prev.to);
      const firstSale = S.db.sales.length ? S.dayKey(S.db.sales[0].ts) : t;
      S.lineChart(el.querySelector('#dchart'), {
        labels: days.map(short),
        tipLabels: days.map((k, i) => short(k) + (k === t ? ' (en curso)' : '') + ` · anterior: ${short(prevDays[i])}`),
        series: [{ name: 'Periodo actual', values: days.map((k) => dc[k].total), color: '--primary' }, { name: 'Periodo anterior', values: prevDays.map((k) => (k < firstSale ? null : dp[k].total)), color: '--chart-prev', dashed: true }],
      });
      const sales = A.sales(from, to, bids);
      S.barList(el.querySelector('#dcat'), A.byCategory(sales).sort((a, b) => b.total - a.total).slice(0, 8).map((c) => ({ label: c.label, value: c.total, sub: 'margen ' + S.pct(c.margin, 0) })));
      S.table(el.querySelector('#dtop'), [
        { key: 'label', label: 'Producto' },
        { key: 'qty', label: 'Cant.', num: true, render: (r) => S.num(r.qty, 1) },
        { key: 'total', label: 'Ventas', num: true, render: (r) => S.money(r.total) },
      ], { rows: A.byProduct(sales).sort((a, b) => b.total - a.total).slice(0, 8), pageSize: 8, empty: 'Sin ventas en el periodo.' });
      const act = S.db.audit.filter((a) => a.userId).slice(-8).reverse();
      el.querySelector('#dact').innerHTML = act.length ? act.map((a) => `<div><b>${esc(S.userName(a.userId))}</b> · ${esc(S.auditLabel(a.action))}<div class="muted">${S.fdt(a.ts)}</div></div>`).join('') : '<div class="empty">Sin actividad.</div>';
    },
  });

  S.AUDIT_LABELS = {
    'auth.login': 'Inició sesión', 'auth.logout': 'Cerró sesión', 'auth.failed': 'Intento de acceso fallido', 'auth.locked': 'Cuenta bloqueada por intentos fallidos',
    'sale.create': 'Registró una venta', 'sale.void': 'Anuló una venta', 'product.create': 'Creó un producto', 'product.update': 'Editó un producto', 'product.import': 'Importó productos',
    'inventory.entry': 'Registró una entrada', 'inventory.exit': 'Registró una salida', 'inventory.adjust': 'Ajustó existencias', 'inventory.transfer': 'Transfirió mercancía',
    'count.open': 'Abrió un conteo físico', 'count.apply': 'Aplicó un conteo físico', 'count.cancel': 'Canceló un conteo físico',
    'purchase.create': 'Creó una orden de compra', 'purchase.approved': 'Aprobó una orden de compra', 'purchase.sent': 'Marcó una orden como enviada', 'purchase.receive': 'Recibió mercancía',
    'purchase.closed_short': 'Cerró una orden con faltante', 'purchase.cancelled': 'Canceló una orden de compra',
    'internal.create': 'Creó una orden interna', 'internal.approved': 'Aprobó una orden interna', 'internal.rejected': 'Rechazó una orden interna', 'internal.preparing': 'Inició la preparación de una orden interna',
    'internal.delivered': 'Entregó una orden interna', 'internal.cancelled': 'Canceló una orden interna', 'supplier.create': 'Creó un proveedor', 'supplier.update': 'Editó un proveedor',
    'customer.create': 'Registró un cliente', 'customer.update': 'Editó un cliente', 'category.create': 'Creó una categoría', 'user.create': 'Creó un usuario', 'user.update': 'Editó un usuario',
    'user.password': 'Cambió una contraseña', 'user.unlock': 'Desbloqueó un usuario', 'role.create': 'Creó un rol', 'role.update': 'Cambió permisos de un rol', 'branch.create': 'Creó una sucursal',
    'branch.update': 'Editó una sucursal', 'company.update': 'Editó los datos de la empresa', 'company.register': 'Registró la empresa', 'company.seed': 'Generó la empresa de demostración',
    'data.export': 'Exportó un respaldo', 'customer.export': 'Exportó la base de clientes', 'data.import': 'Restauró un respaldo', 'account.password': 'Cambió su contraseña', 'account.sessions': 'Cerró sus otras sesiones',
  };
  S.auditLabel = (a) => S.AUDIT_LABELS[a] || a;

  // =====================================================================
  // PRODUCTOS
  // =====================================================================
  S.route('products', {
    title: 'Productos', icon: 'package', perm: 'products.view',
    render(el, params) {
      const manage = S.can('products.manage');
      const bids = S.scopeBranches();
      const cats = S.db.categories.slice().sort(S.by('name'));
      const viewMode = params.view === 'cards' ? 'cards' : 'table';
      el.innerHTML = `${S.pageHead('Productos', 'Catálogo con precios, IVA, costos, lotes FEFO y márgenes.', `${manage ? `<button class="btn" id="imp">${S.icon('upload')}Importar</button>` : ''}<button class="btn" id="exp">${S.icon('download')}Exportar CSV</button>${manage ? `<button class="btn primary" id="new">${S.icon('plus')}Nuevo producto</button>` : ''}`)}
        <div class="toolbar"><div class="search">${S.icon('search')}<input class="input" id="q" placeholder="Nombre, SKU, código o marca" value="${esc(params.q || '')}" aria-label="Buscar"></div>
          <select class="select" id="cat" aria-label="Categoría">${S.options(cats.map((c) => [c.id, c.name]), params.cat, { empty: 'Todas las categorías' })}</select>
          <select class="select" id="st" aria-label="Estado">${S.options([['active', 'Activos'], ['inactive', 'Inactivos'], ['all', 'Todos']], params.st || 'active')}</select>
          <div class="grow"></div>
          <div class="seg" role="group" aria-label="Modo de vista">
            <button type="button" class="${viewMode === 'table' ? 'active' : ''}" data-view="table" title="Vista de tabla">${S.icon('list')} Tabla</button>
            <button type="button" class="${viewMode === 'cards' ? 'active' : ''}" data-view="cards" title="Vista de tarjetas">${S.icon('grid')} Tarjetas</button>
          </div>
        </div>
        <div class="card flush ${viewMode === 'cards' ? 'hidden' : ''}" id="tbl"></div>
        <div class="grid g3 ${viewMode === 'table' ? 'hidden' : ''}" id="p-cards"></div>`;
      const cmap = S.mapBy(S.db.categories);
      const filter = () => {
        const q = (params.q || '').toLowerCase(), st = params.st || 'active';
        return S.db.products.filter((p) => (st === 'all' || (st === 'active') === p.active) && (!params.cat || p.categoryId === params.cat)
          && (!q || (p.name + ' ' + p.sku + ' ' + (p.barcode || '') + ' ' + (p.brand || '')).toLowerCase().includes(q)));
      };
      const margin = (p) => { const b = p.price / (1 + p.tax / 100); return b ? (b - p.avgCost) / b : 0; };
      const nextLotExp = (pid) => {
        const lots = S.db.lots.filter((l) => l.pid === pid && bids.includes(l.bid) && l.qty > 0).sort(S.by('exp'));
        return lots[0] ? lots[0] : null;
      };
      const renderCards = (items) => {
        const box = el.querySelector('#p-cards');
        if (!box) return;
        if (!items.length) {
          box.innerHTML = `<div class="card span3 empty">No hay productos con esos filtros.</div>`;
          return;
        }
        box.innerHTML = items.map((p) => {
          const q = S.totalStock(p.id, bids);
          const [l, k] = S.stockState(p, q);
          const lot = p.tracksLots ? nextLotExp(p.id) : null;
          const catName = (cmap[p.categoryId] || {}).name || 'General';
          return `<article class="card stack tarjeta-producto" style="justify-content:space-between">
            <div class="stack" style="gap:10px">
              <div class="row between">
                <span class="badge primary">${esc(catName)}</span>
                <div class="row" style="gap:6px">${S.badge(l, k)}${p.active ? S.badge('Activo', 'ok') : S.badge('Inactivo')}</div>
              </div>
              <div class="row" style="gap:12px;align-items:center">
                <div style="width:48px;height:48px;border-radius:14px;background:rgba(16,185,129,0.14);border:1px solid rgba(16,185,129,0.32);display:grid;place-items:center;color:#6ee7b7;flex-shrink:0">
                  ${S.icon('package')}
                </div>
                <div style="min-width:0">
                  <h3 style="font-size:15.5px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(p.name)}</h3>
                  <div class="small muted mono">${esc(p.sku)}${p.barcode ? ' · ' + esc(p.barcode) : ''}</div>
                </div>
              </div>
              <div class="grid g2" style="gap:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08)">
                <div><div class="small muted">Precio (IVA ${p.tax}%)</div><div style="font-size:17px;font-weight:800;color:#fff">${S.money(p.price)}</div></div>
                <div><div class="small muted">Existencia</div><div style="font-size:15px;font-weight:700">${S.qty(p, q)}</div></div>
                <div><div class="small muted">Costo prom.</div><div class="small">${S.money(p.avgCost)} · Mg ${S.pct(margin(p))}</div></div>
                <div><div class="small muted">Vencimiento / Lote</div><div class="small">${lot ? `Lote ${esc(lot.code)} (${S.fdate(lot.exp)})` : (p.tracksLots ? 'Control FEFO' : 'No aplica')}</div></div>
              </div>
            </div>
            ${manage ? `<div class="row" style="justify-content:flex-end;padding-top:8px"><button class="btn sm" data-edit="${p.id}">${S.icon('edit')}Editar producto</button></div>` : ''}
          </article>`;
        }).join('');
      };
      const initialRows = filter();
      const table = S.table(el.querySelector('#tbl'), [
        { key: 'name', label: 'Producto', sort: true, render: (p) => `<b>${esc(p.name)}</b><div class="small muted">${esc(p.sku)}${p.barcode ? ' · ' + esc(p.barcode) : ''}${p.tracksLots ? ' · lotes' : ''}</div>` },
        { key: 'cat', label: 'Categoría', sort: (p) => (cmap[p.categoryId] || {}).name, render: (p) => esc((cmap[p.categoryId] || {}).name || '—') },
        { key: 'price', label: 'Precio (con IVA)', num: true, sort: true, render: (p) => S.money(p.price) + `<div class="small muted">IVA ${p.tax} %</div>` },
        { key: 'avgCost', label: 'Costo prom.', num: true, sort: true, render: (p) => S.money(p.avgCost) },
        { key: 'margin', label: 'Margen', num: true, sort: margin, render: (p) => `<span class="${margin(p) < 0 ? 'danger' : margin(p) < 0.1 ? 'warn' : ''}">${S.pct(margin(p))}</span>` },
        { key: 'stock', label: 'Existencia', num: true, sort: (p) => S.totalStock(p.id, bids), render: (p) => { const q = S.totalStock(p.id, bids); const [l, k] = S.stockState(p, q); return S.qty(p, q) + `<div>${S.badge(l, k)}</div>`; } },
        { key: 'active', label: 'Estado', render: (p) => (p.active ? S.badge('Activo', 'ok') : S.badge('Inactivo')) },
        ...(manage ? [{ key: 'a', label: '', render: (p) => `<button class="btn sm" data-edit="${p.id}">${S.icon('edit')}Editar</button>` }] : []),
      ], { rows: initialRows, sort: { key: 'name', dir: 1 }, onRow: manage ? (p) => productModal(p) : null, empty: 'No hay productos con esos filtros.' });
      renderCards(initialRows);
      let tmr;
      el.querySelector('#q').addEventListener('input', (e) => {
        clearTimeout(tmr);
        tmr = setTimeout(() => {
          S.setParams({ q: e.target.value }, { render: false });
          params.q = e.target.value;
          const next = filter();
          table.update(next);
          renderCards(next);
        }, 200);
      });
      el.querySelector('#cat').addEventListener('change', (e) => S.setParams({ cat: e.target.value }));
      el.querySelector('#st').addEventListener('change', (e) => S.setParams({ st: e.target.value }));
      el.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => S.setParams({ view: b.dataset.view })));
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-edit]');
        if (b) productModal(S.db.products.find((p) => p.id === b.dataset.edit));
      });
      el.querySelector('#exp').addEventListener('click', () => {
        S.download(`productos-${S.stamp()}.csv`, S.toCSV(table.rows(), [['sku', 'SKU'], ['name', 'Nombre'], ['barcode', 'Código de barras'], [(p) => (cmap[p.categoryId] || {}).name, 'Categoría'], ['brand', 'Marca'], ['unit', 'Unidad'],
          [(p) => p.avgCost, 'Costo promedio sin IVA'], ['price', 'Precio con IVA'], ['tax', 'IVA %'], ['minStock', 'Stock mín.'], ['maxStock', 'Stock máx.'], [(p) => S.totalStock(p.id, bids), 'Existencia'], [(p) => (p.active ? 'Activo' : 'Inactivo'), 'Estado']]));
      });
      if (manage) {
        el.querySelector('#new').addEventListener('click', () => productModal());
        el.querySelector('#imp').addEventListener('click', importModal);
        if (params.new) (S.setParams({ new: '' }, { render: false }), productModal());
      }
    },
  });

  function productModal(p) {
    const cats = S.db.categories.slice().sort(S.by('name'));
    const sups = S.db.suppliers.filter((s) => s.active || (p && s.id === p.supplierId));
    const v = p || { tax: 19, unit: 'und', active: true, minStock: 5, maxStock: 50 };
    const hasStock = p && S.totalStock(p.id) > 0;
    S.modal({
      title: p ? 'Editar producto' : 'Nuevo producto', size: 'lg',
      body: `<form class="stack" id="pf" novalidate>
        <div class="grid g2"><label class="field span2"><span>Nombre *</span><input class="input" name="name" value="${esc(v.name || '')}" maxlength="120" required></label>
        <label class="field"><span>SKU *</span><input class="input" name="sku" value="${esc(v.sku || '')}" maxlength="30" required></label>
        <label class="field"><span>Código de barras</span><input class="input" name="barcode" value="${esc(v.barcode || '')}" inputmode="numeric" placeholder="Escanee o digite"></label>
        <label class="field"><span>Categoría *</span><div class="row"><select class="select" name="categoryId">${S.options(cats.map((c) => [c.id, c.name]), v.categoryId, { empty: 'Seleccione…' })}</select><button type="button" class="btn icon" id="newcat" aria-label="Nueva categoría" title="Nueva categoría">${S.icon('plus')}</button></div></label>
        <label class="field"><span>Marca</span><input class="input" name="brand" value="${esc(v.brand || '')}" maxlength="60"></label>
        <label class="field"><span>Unidad</span><select class="select" name="unit">${S.options([['und', 'Unidad'], ['kg', 'Kilogramo (por peso)'], ['l', 'Litro']], v.unit)}</select></label>
        <label class="field"><span>Proveedor preferido</span><select class="select" name="supplierId">${S.options(sups.map((s) => [s.id, s.name]), v.supplierId, { empty: 'Ninguno' })}</select></label>
        <label class="field"><span>Costo sin IVA *</span><input class="input" name="cost" type="number" min="0" step="1" value="${p ? Math.round(p.avgCost) : ''}" ${hasStock ? 'readonly title="Con existencias, el costo se calcula como promedio ponderado de las compras"' : ''}>${hasStock ? '<small>Costo promedio ponderado (se actualiza al recibir compras).</small>' : ''}</label>
        <label class="field"><span>Precio de venta con IVA *</span><input class="input" name="price" type="number" min="0" step="50" value="${v.price || ''}"></label>
        <label class="field"><span>IVA</span><select class="select" name="tax">${S.options([[0, '0 % (excluido)'], [5, '5 %'], [19, '19 %']], v.tax)}</select></label>
        <div class="field"><span>Margen calculado</span><div class="input" id="mg" style="display:flex;align-items:center" aria-live="polite">—</div></div>
        <label class="field"><span>Stock mínimo</span><input class="input" name="minStock" type="number" min="0" step="any" value="${v.minStock ?? 0}"></label>
        <label class="field"><span>Stock máximo</span><input class="input" name="maxStock" type="number" min="0" step="any" value="${v.maxStock ?? 0}"></label></div>
        <label class="check"><input type="checkbox" name="tracksLots" ${v.tracksLots ? 'checked' : ''} ${hasStock ? 'disabled' : ''}><span><b>Controla lotes y vencimiento</b><div class="small muted">Para perecederos: exige lote y fecha en cada entrada y vende primero lo que vence antes (FEFO).${hasStock ? ' No se puede cambiar con existencias.' : ''}</div></span></label>
        ${p ? `<label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''}><span><b>Activo</b><div class="small muted">Un producto inactivo no se vende ni se compra; su historial se conserva.</div></span></label>` : ''}
        <div class="form-error hidden" id="perr" role="alert"></div></form>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="psave">Guardar</button>`,
      onMount(m, close) {
        const f = m.querySelector('#pf');
        const calc = () => {
          const c = +f.cost.value, pr = +f.price.value, t = +f.tax.value;
          const base = pr / (1 + t / 100);
          m.querySelector('#mg').innerHTML = pr && c >= 0 ? `<span class="${base - c < 0 ? 'danger' : ''}">${S.pct((base - c) / base)} · ${S.money(base - c)} por unidad</span>` : '—';
        };
        ['cost', 'price', 'tax'].forEach((n) => f[n].addEventListener('input', calc));
        calc();
        f.barcode.addEventListener('keydown', (e) => e.key === 'Enter' && e.preventDefault());
        m.querySelector('#newcat').addEventListener('click', async () => {
          const name = prompt('Nombre de la nueva categoría');
          if (!name) return;
          try {
            const c = S.act('products.manage', 'saveCategory', { name });
            f.categoryId.insertAdjacentHTML('beforeend', `<option value="${c.id}">${esc(c.name)}</option>`);
            f.categoryId.value = c.id;
          } catch (e) {
            S.fail(e);
          }
        });
        m.querySelector('#psave').addEventListener('click', () => {
          const data = S.formData(f);
          if (p) {
            data.id = p.id;
            if (hasStock) data.tracksLots = p.tracksLots;
          }
          try {
            S.act('products.manage', 'saveProduct', data);
            close();
            S.toast(p ? 'Producto actualizado.' : 'Producto creado.');
            S.refresh();
          } catch (e) {
            S.showErr(m.querySelector('#perr'), e);
          }
        });
      },
    });
  }

  const TEMPLATE_COLS = ['sku', 'nombre', 'codigo_barras', 'categoria', 'marca', 'unidad', 'costo_sin_iva', 'precio_con_iva', 'iva', 'stock_minimo', 'stock_maximo', 'controla_lotes'];
  function importModal() {
    S.modal({
      title: 'Importar productos', size: 'lg',
      body: `<div class="stack"><p class="muted">1) Descargue la plantilla y complétela en Excel (guárdela como <b>CSV UTF-8</b>). 2) Selecciónela y pulse <b>Validar</b>. 3) Si no hay errores, pulse <b>Importar</b>. Si alguna fila tiene error, no se importa nada. Los productos existentes se actualizan por SKU; las categorías nuevas se crean.</p>
        <div class="row wrap"><button class="btn" id="tpl">${S.icon('download')}Descargar plantilla</button><input type="file" id="file" accept=".csv,text/csv" class="input" style="max-width:340px;padding-top:6px"></div>
        <div id="res"></div></div>`,
      foot: `<button class="btn" data-close>Cerrar</button><button class="btn" id="val" disabled>Validar</button><button class="btn primary" id="go" disabled>Importar</button>`,
      onMount(m, close) {
        let rows = null;
        m.querySelector('#tpl').addEventListener('click', () => S.download('plantilla-productos.csv', '﻿' + TEMPLATE_COLS.join(';') + '\r\nP9001;Producto de ejemplo 500 g;7700000000017;Abarrotes;Marca X;und;2500;3550;19;5;40;no\r\n'));
        m.querySelector('#file').addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const text = await file.text();
          const parsed = S.parseCSV(text);
          const head = (parsed[0] || []).map((h) => h.trim().toLowerCase());
          const missing = TEMPLATE_COLS.filter((c) => !head.includes(c));
          if (missing.length) {
            m.querySelector('#res').innerHTML = `<div class="form-error">Faltan columnas: ${esc(missing.join(', '))}. Use la plantilla.</div>`;
            return;
          }
          rows = parsed.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || '').trim()])));
          m.querySelector('#res').innerHTML = `<div class="banner info">${S.icon('info')}<span>${S.num(rows.length)} filas leídas de <b>${esc(file.name)}</b>. Pulse Validar.</span></div>`;
          m.querySelector('#val').disabled = !rows.length;
          m.querySelector('#go').disabled = true;
        });
        const run = (d) => {
          const errors = [];
          let created = 0, updated = 0, newCats = 0;
          const seen = new Set();
          rows.forEach((r, i) => {
            try {
              const sku = r.sku.toUpperCase();
              if (seen.has(sku)) throw S.err(`SKU ${sku} repetido en el archivo.`);
              seen.add(sku);
              let cat = d.categories.find((c) => c.name.toLowerCase() === r.categoria.toLowerCase());
              if (!cat && r.categoria) {
                cat = { id: S.uid(), name: r.categoria };
                d.categories.push(cat);
                newCats++;
              }
              const ex = d.products.find((p) => p.sku === sku);
              const num = (x) => +String(x).replace(/\./g, '').replace(',', '.');
              S.ops.saveProduct(d, { id: ex ? ex.id : undefined, sku, name: r.nombre, barcode: r.codigo_barras, categoryId: cat ? cat.id : '', brand: r.marca, unit: r.unidad || 'und',
                cost: num(r.costo_sin_iva), price: num(r.precio_con_iva), tax: num(r.iva), minStock: num(r.stock_minimo || 0), maxStock: num(r.stock_maximo || 0),
                tracksLots: /^(si|sí|s|1|true|x)$/i.test(r.controla_lotes), supplierId: ex ? ex.supplierId : null, active: true }, { userId: S.user.id, silent: true });
              ex ? updated++ : created++;
            } catch (e) {
              errors.push([i + 2, e.isUser ? e.message : String(e)]);
            }
          });
          return { errors, created, updated, newCats };
        };
        m.querySelector('#val').addEventListener('click', () => {
          const r = run(JSON.parse(S._saved));
          m.querySelector('#res').innerHTML = r.errors.length
            ? `<div class="form-error">${r.errors.length} fila(s) con errores. Corrija el archivo y vuelva a cargarlo.</div><div class="table-wrap" style="max-height:260px;margin-top:8px"><table class="table"><thead><tr><th>Fila</th><th>Error</th></tr></thead><tbody>${r.errors.map(([n, e]) => `<tr><td>${n}</td><td>${esc(e)}</td></tr>`).join('')}</tbody></table></div>`
            : `<div class="banner info">${S.icon('check')}<span>Archivo válido: ${r.created} producto(s) nuevos, ${r.updated} actualizados${r.newCats ? `, ${r.newCats} categoría(s) nuevas` : ''}.</span></div>`;
          m.querySelector('#go').disabled = !!r.errors.length;
        });
        m.querySelector('#go').addEventListener('click', () => {
          try {
            S.require('products.manage');
            const r = S.tx((d) => {
              const x = run(d);
              if (x.errors.length) throw S.err('El archivo tiene errores; no se importó nada.');
              const prev = S.db;
              S.db = d;
              S.audit('product.import', 'Producto', null, null, { created: x.created, updated: x.updated });
              S.db = prev;
              return x;
            });
            close();
            S.toast(`Importación completa: ${r.created} nuevos, ${r.updated} actualizados.`);
            S.refresh();
          } catch (e) {
            S.fail(e);
          }
        });
      },
    });
  }

  // =====================================================================
  // INVENTARIO
  // =====================================================================
  const TABS = [['stock', 'Existencias'], ['moves', 'Movimientos'], ['lots', 'Lotes y vencimientos'], ['transfers', 'Transferencias'], ['counts', 'Conteos físicos']];
  S.route('inventory', {
    title: 'Inventario', icon: 'layers', perm: 'inventory.view',
    render(el, params) {
      const tab = TABS.some((t) => t[0] === params.tab) ? params.tab : 'stock';
      const mv = S.can('inventory.move'), ct = S.can('inventory.count');
      el.innerHTML = `${S.pageHead('Inventario', 'Existencias por sucursal, trazabilidad de movimientos y control de lotes.',
        `${mv ? `<button class="btn" data-a="entry">${S.icon('download')}Entrada</button><button class="btn" data-a="exit">${S.icon('upload')}Salida</button><button class="btn" data-a="transfer">${S.icon('swap')}Transferir</button>` : ''}${ct ? `<button class="btn primary" data-a="count">${S.icon('clipboard')}Conteo físico</button>` : ''}`)}
        <div class="tabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" aria-selected="${k === tab}" class="${k === tab ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="tab"></div>`;
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => S.setParams({ tab: b.dataset.tab, status: '', q: '', reason: '' })));
      el.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', () => ({ entry: entryModal, exit: exitModal, transfer: transferModal, count: openCountModal })[b.dataset.a]()));
      const t = el.querySelector('#tab');
      ({ stock: stockTab, moves: movesTab, lots: lotsTab, transfers: transfersTab, counts: countsTab })[tab](t, params);
      if (params.action === 'entry' && mv) (S.setParams({ action: '' }, { render: false }), entryModal());
    },
  });

  function stockTab(el, params) {
    const bids = S.scopeBranches();
    const cats = S.db.categories.slice().sort(S.by('name'));
    const cmap = S.mapBy(S.db.categories);
    el.innerHTML = `<div class="toolbar"><div class="search">${S.icon('search')}<input class="input" id="q" placeholder="Producto o SKU" value="${esc(params.q || '')}" aria-label="Buscar"></div>
      <select class="select" id="cat" aria-label="Categoría">${S.options(cats.map((c) => [c.id, c.name]), params.cat, { empty: 'Todas las categorías' })}</select>
      <select class="select" id="st" aria-label="Estado">${S.options([['ok', 'Disponible'], ['critical', 'Stock crítico o agotado'], ['out', 'Agotado'], ['over', 'Sobre stock']], params.status, { empty: 'Todos los estados' })}</select>
      <div class="grow"></div><span class="muted small" id="tot"></span><button class="btn sm" id="exp">${S.icon('download')}CSV</button></div><div class="card flush" id="tbl"></div>`;
    const rows = () => {
      const q = (params.q || '').toLowerCase();
      return A.inventory(bids).filter((r) => r.p.active && (!params.cat || r.p.categoryId === params.cat) && (!q || (r.p.name + ' ' + r.p.sku).toLowerCase().includes(q)) && (() => {
        switch (params.status) {
          case 'ok': return r.state[0] === 'Disponible';
          case 'critical': return r.qty <= r.p.minStock;
          case 'out': return r.qty <= 0;
          case 'over': return r.state[0] === 'Sobre stock';
          default: return true;
        }
      })());
    };
    const data = rows();
    el.querySelector('#tot').textContent = `${S.num(data.length)} filas · valor ${S.money(S.sum(data, (r) => r.value))}`;
    const mv = S.can('inventory.move');
    const tb = S.table(el.querySelector('#tbl'), [
      { key: 'name', label: 'Producto', sort: (r) => r.p.name, render: (r) => `<b>${esc(r.p.name)}</b><div class="small muted">${esc(r.p.sku)} · ${esc((cmap[r.p.categoryId] || {}).name || '')}</div>` },
      { key: 'branch', label: 'Sucursal', sort: (r) => S.branchName(r.bid), render: (r) => esc(S.branchName(r.bid)) },
      { key: 'qty', label: 'Existencia', num: true, sort: true, render: (r) => `<b>${S.qty(r.p, r.qty)}</b>` },
      { key: 'minmax', label: 'Mín / Máx', num: true, render: (r) => `${S.num(r.p.minStock)} / ${S.num(r.p.maxStock)}` },
      { key: 'value', label: 'Valor a costo', num: true, sort: true, render: (r) => S.money(r.value) },
      { key: 'state', label: 'Estado', sort: (r) => r.state[0], render: (r) => S.badge(r.state[0], r.state[1]) },
      ...(mv ? [{ key: 'a', label: '', render: (r) => `<button class="btn sm" data-adj="${r.p.id}|${r.bid}">Ajustar</button>` }] : []),
    ], { rows: data, sort: { key: 'name', dir: 1 }, empty: 'No hay existencias con esos filtros.' });
    let tmr;
    el.querySelector('#q').addEventListener('input', (e) => {
      clearTimeout(tmr);
      tmr = setTimeout(() => {
        params.q = e.target.value;
        S.setParams({ q: params.q }, { render: false });
        const d = rows();
        tb.update(d);
        el.querySelector('#tot').textContent = `${S.num(d.length)} filas · valor ${S.money(S.sum(d, (r) => r.value))}`;
      }, 200);
    });
    el.querySelector('#cat').addEventListener('change', (e) => S.setParams({ cat: e.target.value }));
    el.querySelector('#st').addEventListener('change', (e) => S.setParams({ status: e.target.value }));
    el.querySelector('#tbl').addEventListener('click', (e) => {
      const b = e.target.closest('[data-adj]');
      if (b) adjustModal(...b.dataset.adj.split('|'));
    });
    el.querySelector('#exp').addEventListener('click', () => S.download(`existencias-${S.stamp()}.csv`, S.toCSV(tb.rows(), [[(r) => r.p.sku, 'SKU'], [(r) => r.p.name, 'Producto'], [(r) => S.branchName(r.bid), 'Sucursal'],
      ['qty', 'Existencia'], [(r) => r.p.unit, 'Unidad'], [(r) => r.p.minStock, 'Mínimo'], [(r) => r.p.maxStock, 'Máximo'], [(r) => Math.round(r.value), 'Valor a costo'], [(r) => r.state[0], 'Estado']])));
  }

  function movesTab(el, params) {
    const bids = S.scopeBranches();
    const rc = S.rangeControl(params, (p) => S.setParams(p));
    const pmap = S.mapBy(S.db.products), lmap = S.mapBy(S.db.lots);
    el.innerHTML = `<div class="toolbar">${rc.html}<div class="search">${S.icon('search')}<input class="input" id="q" placeholder="Producto, SKU o documento" value="${esc(params.q || '')}" aria-label="Buscar"></div>
      <select class="select" id="reason" aria-label="Motivo">${S.options(Object.entries(S.MOVE_REASONS), params.reason, { empty: 'Todos los motivos' })}</select><div class="grow"></div><button class="btn sm" id="exp">${S.icon('download')}CSV</button></div><div class="card flush" id="tbl"></div>`;
    rc.bind(el);
    const rows = () => {
      const q = (params.q || '').toLowerCase();
      return S.db.movements.filter((m) => bids.includes(m.bid) && S.dayKey(m.ts) >= rc.from && S.dayKey(m.ts) <= rc.to && (!params.reason || m.reason === params.reason)
        && (!q || ((pmap[m.pid] || {}).name + ' ' + (pmap[m.pid] || {}).sku + ' ' + (m.ref || '')).toLowerCase().includes(q))).reverse();
    };
    const tb = S.table(el.querySelector('#tbl'), [
      { key: 'ts', label: 'Fecha', sort: true, render: (m) => `<span class="nowrap">${S.fdt(m.ts)}</span>` },
      { key: 'p', label: 'Producto', sort: (m) => (pmap[m.pid] || {}).name, render: (m) => `<b>${esc((pmap[m.pid] || {}).name)}</b>${m.lotId && lmap[m.lotId] ? `<div class="small muted">Lote ${esc(lmap[m.lotId].code)} · vence ${S.fdate(lmap[m.lotId].exp)}</div>` : ''}` },
      { key: 'b', label: 'Sucursal', render: (m) => esc(S.branchName(m.bid)) },
      { key: 'reason', label: 'Motivo', sort: true, render: (m) => esc(S.MOVE_REASONS[m.reason] || m.reason) + (m.note ? `<div class="small muted">${esc(m.note)}</div>` : '') },
      { key: 'qty', label: 'Cantidad', num: true, sort: true, render: (m) => `<b class="${m.qty < 0 ? 'danger' : 'ok'}">${m.qty > 0 ? '+' : ''}${S.num(m.qty, 3)}</b>` },
      { key: 'bal', label: 'Saldo', num: true, render: (m) => S.num(m.bal, 3) },
      { key: 'cost', label: 'Costo unit.', num: true, render: (m) => S.money(m.cost) },
      { key: 'u', label: 'Usuario', render: (m) => esc(S.userName(m.userId)) },
      { key: 'ref', label: 'Documento', render: (m) => esc(m.ref || '—') },
    ], { rows: rows(), pageSize: 50, empty: 'Sin movimientos en el periodo.' });
    let tmr;
    el.querySelector('#q').addEventListener('input', (e) => {
      clearTimeout(tmr);
      tmr = setTimeout(() => ((params.q = e.target.value), S.setParams({ q: params.q }, { render: false }), tb.update(rows())), 250);
    });
    el.querySelector('#reason').addEventListener('change', (e) => S.setParams({ reason: e.target.value }));
    el.querySelector('#exp').addEventListener('click', () => S.download(`movimientos-${rc.from}-a-${rc.to}.csv`, S.toCSV(tb.rows(), [[(m) => S.fdt(m.ts), 'Fecha'], [(m) => (pmap[m.pid] || {}).sku, 'SKU'], [(m) => (pmap[m.pid] || {}).name, 'Producto'],
      [(m) => S.branchName(m.bid), 'Sucursal'], [(m) => S.MOVE_REASONS[m.reason], 'Motivo'], ['qty', 'Cantidad'], ['bal', 'Saldo'], ['cost', 'Costo unitario'], [(m) => S.userName(m.userId), 'Usuario'], ['ref', 'Documento'], [(m) => (lmap[m.lotId] || {}).code, 'Lote'], ['note', 'Nota']])));
  }

  function lotsTab(el, params) {
    const bids = S.scopeBranches();
    const pmap = S.mapBy(S.db.products);
    const t = S.today();
    const status = params.status || 'active';
    el.innerHTML = `<div class="toolbar"><select class="select" id="st" aria-label="Estado">${S.options([['active', 'Con existencias'], ['soon', 'Vencen en 7 días'], ['30', 'Vencen en 30 días'], ['expired', 'Vencidos con existencias']], status)}</select>
      <div class="grow"></div><span class="small muted">Las ventas consumen primero el lote que vence antes (FEFO). Los lotes vencidos no se venden.</span></div><div class="card flush" id="tbl"></div>`;
    const rows = S.db.lots.filter((l) => l.qty > 0 && bids.includes(l.bid) && (status === 'active' || (status === 'expired' ? l.exp < t : status === 'soon' ? l.exp >= t && l.exp <= S.addDayKey(t, 7) : l.exp >= t && l.exp <= S.addDayKey(t, 30))));
    const mv = S.can('inventory.move');
    S.table(el.querySelector('#tbl'), [
      { key: 'p', label: 'Producto', sort: (l) => pmap[l.pid].name, render: (l) => `<b>${esc(pmap[l.pid].name)}</b><div class="small muted">${esc(pmap[l.pid].sku)}</div>` },
      { key: 'code', label: 'Lote', sort: true },
      { key: 'b', label: 'Sucursal', render: (l) => esc(S.branchName(l.bid)) },
      { key: 'exp', label: 'Vencimiento', sort: true, render: (l) => `${S.fdate(l.exp)} ${S.expBadge(l.exp)}` },
      { key: 'qty', label: 'Cantidad', num: true, sort: true, render: (l) => S.qty(pmap[l.pid], l.qty) },
      { key: 'v', label: 'Valor a costo', num: true, sort: (l) => l.qty * pmap[l.pid].avgCost, render: (l) => S.money(l.qty * pmap[l.pid].avgCost) },
      ...(mv ? [{ key: 'a', label: '', render: (l) => (l.exp < t ? `<button class="btn sm danger" data-wo="${l.id}">Dar de baja</button>` : '') }] : []),
    ], { rows, sort: { key: 'exp', dir: 1 }, empty: 'No hay lotes con ese criterio.' });
    el.querySelector('#st').addEventListener('change', (e) => S.setParams({ status: e.target.value }));
    el.querySelector('#tbl').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-wo]');
      if (!b) return;
      const l = S.db.lots.find((x) => x.id === b.dataset.wo);
      const p = pmap[l.pid];
      const note = await S.confirm({ title: 'Dar de baja lote vencido', message: `Se registrará una salida por <b>vencimiento</b> de ${S.qty(p, l.qty)} de <b>${esc(p.name)}</b> (lote ${esc(l.code)}) en ${esc(S.branchName(l.bid))}.`, confirmLabel: 'Dar de baja', danger: true, reason: true, reasonLabel: 'Justificación' });
      if (!note) return;
      try {
        S.act('inventory.move', 'exit', { bid: l.bid, pid: l.pid, qty: l.qty, reason: 'EXPIRED', lotId: l.id, note });
        S.toast('Lote dado de baja.');
        S.refresh();
      } catch (ex) {
        S.fail(ex);
      }
    });
  }

  function transfersTab(el) {
    const bids = S.scopeBranches();
    const pmap = S.mapBy(S.db.products);
    el.innerHTML = `<div class="card flush" id="tbl"></div>`;
    S.table(el.querySelector('#tbl'), [
      { key: 'number', label: 'Número', sort: true, render: (t) => `<b>${esc(t.number)}</b>` },
      { key: 'ts', label: 'Fecha', sort: true, render: (t) => S.fdt(t.ts) },
      { key: 'r', label: 'Ruta', render: (t) => `${esc(S.branchName(t.from))} → ${esc(S.branchName(t.to))}` },
      { key: 'i', label: 'Productos', render: (t) => esc(t.items.map((i) => `${pmap[i.pid].name} (${S.num(i.qty, 3)})`).join(', ')) },
      { key: 'u', label: 'Usuario', render: (t) => esc(S.userName(t.userId)) },
      { key: 'note', label: 'Nota', render: (t) => esc(t.note || '—') },
    ], { rows: S.db.transfers.filter((t) => bids.includes(t.from) || bids.includes(t.to)).slice().reverse(), empty: 'Aún no hay transferencias.' });
  }

  function countsTab(el) {
    const bids = S.scopeBranches();
    el.innerHTML = `<div class="card flush" id="tbl"></div>`;
    const cmap = S.mapBy(S.db.categories);
    S.table(el.querySelector('#tbl'), [
      { key: 'number', label: 'Número', sort: true, render: (c) => `<b>${esc(c.number)}</b>` },
      { key: 'b', label: 'Sucursal', render: (c) => esc(S.branchName(c.bid)) },
      { key: 'scope', label: 'Alcance', render: (c) => esc(c.categoryId ? (cmap[c.categoryId] || {}).name : 'Toda la sucursal') },
      { key: 'openedAt', label: 'Apertura', sort: true, render: (c) => S.fdt(c.openedAt) },
      { key: 'prog', label: 'Avance', render: (c) => `${c.lines.filter((l) => l.counted != null).length} / ${c.lines.length}` },
      { key: 'status', label: 'Estado', render: (c) => S.badge({ OPEN: 'Abierto', APPLIED: 'Aplicado', CANCELLED: 'Cancelado' }[c.status], { OPEN: 'info', APPLIED: 'ok', CANCELLED: '' }[c.status]) },
    ], { rows: S.db.counts.filter((c) => bids.includes(c.bid)).slice().reverse(), onRow: (c) => countEditor(c.id), empty: 'Aún no hay conteos físicos.' });
  }

  // ---------- Modales de inventario ----------
  function productField(id, label = 'Producto *') {
    return `<div class="field"><span>${label}</span><input class="input" id="${id}" placeholder="Escanee o busque…" autocomplete="off"><div class="small" id="${id}-sel"></div></div>`;
  }
  function bindProduct(m, id, onPick, bidFn) {
    let chosen = null;
    S.productPicker(m.querySelector('#' + id), {
      onPick: (p) => {
        chosen = p;
        m.querySelector('#' + id + '-sel').innerHTML = `Seleccionado: <b>${esc(p.name)}</b> (${esc(p.sku)})${bidFn && bidFn() ? ` · existencia ${S.qty(p, S.getStock(p.id, bidFn()))}` : ''}`;
        onPick && onPick(p);
      },
      extra: (p) => (bidFn && bidFn() ? 'Exist.: ' + S.qty(p, S.getStock(p.id, bidFn())) : S.money(p.price)),
    });
    return () => chosen;
  }

  function entryModal() {
    S.modal({
      title: 'Entrada de inventario', size: 'lg',
      body: `<form class="stack" id="f" novalidate><div class="grid g2">
        <label class="field"><span>Sucursal *</span><select class="select" name="bid">${S.branchOptions(S.branch !== 'ALL' ? S.branch : '')}</select></label>
        <label class="field"><span>Motivo *</span><select class="select" name="reason">${S.options([['INITIAL', 'Inventario inicial'], ['RETURN_IN', 'Devolución de cliente'], ['ADJUST', 'Ajuste (sobrante)']], 'INITIAL')}</select></label>
        <div class="span2">${productField('pp')}</div>
        <label class="field"><span>Cantidad *</span><input class="input" name="qty" type="number" min="0" step="any"></label>
        <label class="field"><span>Costo unitario sin IVA</span><input class="input" name="cost" type="number" min="0" step="1" placeholder="Por defecto, costo promedio"></label>
        <label class="field lotf hidden"><span>Lote *</span><input class="input" name="lot" maxlength="30"></label>
        <label class="field lotf hidden"><span>Vencimiento *</span><input class="input" name="exp" type="date"></label>
        <label class="field span2"><span>Nota</span><input class="input" name="note" maxlength="200"></label></div>
        <div class="form-error hidden" id="err" role="alert"></div></form>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Registrar entrada</button>`,
      onMount(m, close) {
        const f = m.querySelector('#f');
        const get = bindProduct(m, 'pp', (p) => m.querySelectorAll('.lotf').forEach((x) => x.classList.toggle('hidden', !p.tracksLots)), () => f.bid.value);
        m.querySelector('#ok').addEventListener('click', () => {
          const d = S.formData(f);
          try {
            if (!get()) throw S.err('Seleccione un producto.');
            S.assertBranch(d.bid);
            S.act('inventory.move', 'entry', { ...d, pid: get().id, qty: +d.qty, cost: d.cost ? +d.cost : null });
            close();
            S.toast('Entrada registrada.');
            S.refresh();
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }
  function exitModal() {
    S.modal({
      title: 'Salida de inventario', size: 'lg',
      body: `<form class="stack" id="f" novalidate><div class="grid g2">
        <label class="field"><span>Sucursal *</span><select class="select" name="bid">${S.branchOptions(S.branch !== 'ALL' ? S.branch : '')}</select></label>
        <label class="field"><span>Motivo *</span><select class="select" name="reason">${S.options([['DAMAGE', 'Avería'], ['EXPIRED', 'Vencimiento'], ['THEFT', 'Hurto'], ['INTERNAL_USE', 'Consumo interno'], ['SUPPLIER_RETURN', 'Devolución a proveedor']], '', { empty: 'Seleccione…' })}</select></label>
        <div class="span2">${productField('pp')}</div>
        <label class="field"><span>Cantidad *</span><input class="input" name="qty" type="number" min="0" step="any"></label>
        <label class="field lotf hidden"><span>Lote</span><select class="select" name="lotId"></select></label>
        <label class="field span2"><span>Justificación *</span><textarea class="input" name="note" maxlength="300" placeholder="Mínimo 5 caracteres"></textarea></label></div>
        <div class="form-error hidden" id="err" role="alert"></div></form>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn danger" id="ok">Registrar salida</button>`,
      onMount(m, close) {
        const f = m.querySelector('#f');
        const fillLots = (p) => {
          const lots = S.db.lots.filter((l) => l.pid === p.id && l.bid === f.bid.value && l.qty > 0).sort(S.by('exp'));
          f.lotId.innerHTML = `<option value="">Automático (primero en vencer)</option>` + lots.map((l) => `<option value="${l.id}">${esc(l.code)} · vence ${S.fdate(l.exp)} · ${S.num(l.qty, 3)}</option>`).join('');
          m.querySelectorAll('.lotf').forEach((x) => x.classList.toggle('hidden', !p.tracksLots));
        };
        const get = bindProduct(m, 'pp', fillLots, () => f.bid.value);
        f.bid.addEventListener('change', () => get() && fillLots(get()));
        m.querySelector('#ok').addEventListener('click', () => {
          const d = S.formData(f);
          try {
            if (!get()) throw S.err('Seleccione un producto.');
            S.assertBranch(d.bid);
            S.act('inventory.move', 'exit', { ...d, pid: get().id, qty: +d.qty });
            close();
            S.toast('Salida registrada.');
            S.refresh();
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }
  function adjustModal(pid, bid) {
    const p = S.db.products.find((x) => x.id === pid);
    const cur = S.getStock(pid, bid);
    S.modal({
      title: 'Ajustar existencia',
      body: `<form class="stack" id="f" novalidate><p><b>${esc(p.name)}</b> en ${esc(S.branchName(bid))}. Existencia en sistema: <b>${S.qty(p, cur)}</b>.</p>
        <label class="field"><span>Cantidad física real *</span><input class="input" name="counted" type="number" min="0" step="any" value="${cur}"></label>
        ${p.tracksLots ? `<div class="grid g2"><label class="field"><span>Lote del sobrante</span><input class="input" name="lot" placeholder="Por defecto, el más reciente"></label><label class="field"><span>Vencimiento</span><input class="input" name="exp" type="date"></label></div><small class="muted">Si falta mercancía, se descuenta de los lotes que vencen primero.</small>` : ''}
        <label class="field"><span>Justificación *</span><textarea class="input" name="note" maxlength="300" placeholder="Mínimo 5 caracteres"></textarea></label>
        <div class="form-error hidden" id="err" role="alert"></div></form>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Ajustar</button>`,
      onMount(m, close) {
        m.querySelector('#ok').addEventListener('click', () => {
          const d = S.formData(m.querySelector('#f'));
          try {
            S.assertBranch(bid);
            S.act('inventory.move', 'adjust', { bid, pid, counted: +d.counted, note: d.note, lot: d.lot, exp: d.exp });
            close();
            S.toast('Existencia ajustada.');
            S.refresh();
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }
  function transferModal() {
    const mine = S.myBranches();
    S.modal({
      title: 'Transferencia entre sucursales', size: 'lg',
      body: `<div class="stack"><div class="grid g2"><label class="field"><span>Origen *</span><select class="select" id="from">${S.branchOptions(S.branch !== 'ALL' ? S.branch : '', 'Seleccione…')}</select></label>
        <label class="field"><span>Destino *</span><select class="select" id="to">${S.options(S.db.branches.filter((b) => b.active).map((b) => [b.id, b.name]), '', { empty: 'Seleccione…' })}</select></label></div>
        <div id="items"></div><label class="field"><span>Nota</span><input class="input" id="note" maxlength="200"></label><p class="small muted">Los lotes y sus fechas de vencimiento viajan con la mercancía.</p><div class="form-error hidden" id="err" role="alert"></div></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Transferir</button>`,
      onMount(m, close) {
        const from = m.querySelector('#from');
        const ed = S.itemsEditor(m.querySelector('#items'), { branch: () => from.value, stockLabel: 'Exist. origen' });
        from.addEventListener('change', ed.redraw);
        m.querySelector('#ok').addEventListener('click', () => {
          try {
            S.assertBranch(from.value);
            if (!mine.length) throw S.err('Sin sucursales.');
            S.act('inventory.move', 'transfer', { from: from.value, to: m.querySelector('#to').value, items: ed.items(), note: m.querySelector('#note').value });
            close();
            S.toast('Transferencia registrada.');
            S.go('inventory', { tab: 'transfers' });
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }
  function openCountModal() {
    const open = S.db.counts.find((c) => c.status === 'OPEN' && S.scopeBranches().includes(c.bid));
    if (open) return countEditor(open.id);
    S.modal({
      title: 'Abrir conteo físico',
      body: `<form class="stack" id="f"><label class="field"><span>Sucursal *</span><select class="select" name="bid">${S.branchOptions(S.branch !== 'ALL' ? S.branch : '')}</select></label>
        <label class="field"><span>Alcance</span><select class="select" name="categoryId">${S.options(S.db.categories.slice().sort(S.by('name')).map((c) => [c.id, c.name]), '', { empty: 'Toda la sucursal' })}</select></label>
        <p class="small muted">Se guarda la existencia del sistema al abrir. Puede seguir vendiendo: al aplicar, el ajuste considera los movimientos ocurridos durante el conteo.</p><div class="form-error hidden" id="err"></div></form>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Abrir conteo</button>`,
      onMount(m, close) {
        m.querySelector('#ok').addEventListener('click', () => {
          const d = S.formData(m.querySelector('#f'));
          try {
            S.assertBranch(d.bid);
            const c = S.act('inventory.count', 'openCount', d);
            close();
            countEditor(c.id);
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }
  function countEditor(id) {
    const c = S.db.counts.find((x) => x.id === id);
    const pmap = S.mapBy(S.db.products);
    const editable = c.status === 'OPEN' && S.can('inventory.count');
    const values = Object.fromEntries(c.lines.map((l) => [l.pid, l.counted ?? '']));
    S.modal({
      title: `Conteo ${c.number} · ${S.branchName(c.bid)}`, size: 'xl',
      body: `<div class="stack"><div class="row wrap between"><div class="search" style="width:340px;max-width:100%">${S.icon('scan')}<input class="input" id="flt" placeholder="Escanee o escriba para filtrar"></div>
        <span class="small muted">Abierto ${S.fdt(c.openedAt)} por ${esc(S.userName(c.openedBy))}</span></div><div id="lines"></div></div>`,
      foot: editable ? `<button class="btn danger" id="cancel">Cancelar conteo</button><div class="grow"></div><button class="btn" id="save">Guardar avance</button><button class="btn primary" id="apply">Aplicar ajustes</button>` : `<button class="btn" data-close>Cerrar</button>`,
      onMount(m, close) {
        const draw = (q = '') => {
          q = q.toLowerCase();
          const ls = c.lines.filter((l) => !q || (pmap[l.pid].name + ' ' + pmap[l.pid].sku + ' ' + (pmap[l.pid].barcode || '')).toLowerCase().includes(q));
          m.querySelector('#lines').innerHTML = `<div class="table-wrap" style="max-height:52vh"><table class="table"><thead><tr><th>Producto</th><th class="num">Sistema al abrir</th><th class="num">Contado</th>${c.status === 'APPLIED' ? '<th class="num">Mov. durante</th><th class="num">Ajuste</th>' : '<th class="num">Diferencia</th>'}</tr></thead><tbody>
            ${ls.map((l) => {
              const v = values[l.pid];
              const diff = v === '' || v == null ? null : S.r3(+v - l.system);
              return `<tr><td><b>${esc(pmap[l.pid].name)}</b><div class="small muted">${esc(pmap[l.pid].sku)}</div></td><td class="num">${S.num(l.system, 3)}</td>
              <td class="num">${editable ? `<input class="input sm right" style="width:100px" type="number" min="0" step="any" data-pid="${l.pid}" value="${v}" aria-label="Contado">` : v === '' ? '—' : S.num(v, 3)}</td>
              ${c.status === 'APPLIED' ? `<td class="num">${S.num(l.since || 0, 3)}</td><td class="num">${l.diff == null ? '—' : `<b class="${l.diff < 0 ? 'danger' : l.diff > 0 ? 'ok' : ''}">${S.num(l.diff, 3)}</b>`}</td>` : `<td class="num">${diff == null ? '—' : `<b class="${diff < 0 ? 'danger' : diff > 0 ? 'ok' : ''}">${diff > 0 ? '+' : ''}${S.num(diff, 3)}</b>`}</td>`}</tr>`;
            }).join('') || `<tr><td colspan="5"><div class="empty">Sin coincidencias.</div></td></tr>`}</tbody></table></div>`;
        };
        draw();
        const flt = m.querySelector('#flt');
        flt.addEventListener('input', () => draw(flt.value));
        flt.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const inp = m.querySelector('#lines input[data-pid]');
          if (inp) (inp.focus(), inp.select());
        });
        m.querySelector('#lines').addEventListener('input', (e) => {
          if (e.target.dataset.pid) values[e.target.dataset.pid] = e.target.value;
        });
        m.querySelector('#lines').addEventListener('change', () => draw(flt.value));
        if (!editable) return;
        m.querySelector('#save').addEventListener('click', () => {
          try {
            S.act('inventory.count', 'saveCount', { id, values });
            S.toast('Avance guardado.');
          } catch (e) {
            S.fail(e);
          }
        });
        m.querySelector('#apply').addEventListener('click', async () => {
          const n = Object.values(values).filter((v) => v !== '' && v != null).length;
          if (!(await S.confirm({ title: 'Aplicar conteo', message: `Se ajustarán las existencias de los ${n} producto(s) contados. Solo se ajustan las diferencias reales; las ventas hechas durante el conteo se conservan.`, confirmLabel: 'Aplicar' }))) return;
          try {
            const r = S.tx((d) => {
              S.require('inventory.count');
              S.ops.saveCount(d, { id, values }, { userId: S.user.id });
              return S.ops.applyCount(d, { id }, { userId: S.user.id });
            });
            close();
            S.toast(`Conteo aplicado: ${r.adjusted} ajuste(s).`);
            S.go('inventory', { tab: 'counts' });
          } catch (e) {
            S.fail(e);
          }
        });
        m.querySelector('#cancel').addEventListener('click', async () => {
          if (!(await S.confirm({ title: 'Cancelar conteo', message: 'El conteo se cerrará sin ajustar existencias.', confirmLabel: 'Cancelar conteo', danger: true }))) return;
          try {
            S.act('inventory.count', 'cancelCount', { id });
            close();
            S.refresh();
          } catch (e) {
            S.fail(e);
          }
        });
      },
    });
  }
})();
