'use strict';
/* Proveedores, Compras, Punto de venta, Ventas y Clientes. */
(function () {
  const S = window.S80;
  const esc = S.esc;
  const A = S.an;

  // =====================================================================
  // PROVEEDORES
  // =====================================================================
  S.route('suppliers', {
    title: 'Proveedores', icon: 'truck', perm: 'suppliers.view',
    render(el, params) {
      const manage = S.can('suppliers.manage');
      el.innerHTML = `${S.pageHead('Proveedores', 'Datos de contacto, plazos de pago y tiempos de entrega (alimentan las sugerencias de reposición).', manage ? `<button class="btn primary" id="new">${S.icon('plus')}Nuevo proveedor</button>` : '')}
        <div class="toolbar"><div class="search">${S.icon('search')}<input class="input" id="q" placeholder="Nombre o NIT" value="${esc(params.q || '')}" aria-label="Buscar"></div></div><div class="card flush" id="tbl"></div>`;
      const rows = () => {
        const q = (params.q || '').toLowerCase();
        return S.db.suppliers.filter((s) => !q || (s.name + ' ' + s.taxId).toLowerCase().includes(q));
      };
      const t = S.table(el.querySelector('#tbl'), [
        { key: 'name', label: 'Proveedor', sort: true, render: (s) => `<b>${esc(s.name)}</b><div class="small muted">NIT ${esc(s.taxId)}</div>` },
        { key: 'contact', label: 'Contacto', render: (s) => `${esc(s.contact || '—')}<div class="small muted">${esc(s.phone || '')} ${esc(s.email || '')}</div>` },
        { key: 'paymentDays', label: 'Plazo de pago', num: true, sort: true, render: (s) => (s.paymentDays ? `${s.paymentDays} días` : 'Contado') },
        { key: 'leadDays', label: 'Tiempo de entrega', num: true, sort: true, render: (s) => `${s.leadDays} día(s)` },
        { key: 'prods', label: 'Productos', num: true, sort: (s) => S.db.products.filter((p) => p.supplierId === s.id).length, render: (s) => S.num(S.db.products.filter((p) => p.supplierId === s.id).length) },
        { key: 'active', label: 'Estado', render: (s) => (s.active ? S.badge('Activo', 'ok') : S.badge('Inactivo')) },
      ], { rows: rows(), sort: { key: 'name', dir: 1 }, onRow: (s) => supplierModal(s), empty: 'No hay proveedores.' });
      el.querySelector('#q').addEventListener('input', (e) => ((params.q = e.target.value), S.setParams({ q: params.q }, { render: false }), t.update(rows())));
      if (manage) el.querySelector('#new').addEventListener('click', () => supplierModal());
    },
  });
  function supplierModal(s) {
    const manage = S.can('suppliers.manage');
    const v = s || { leadDays: 3, paymentDays: 30, active: true };
    const ro = manage ? '' : 'disabled';
    const pos = s ? S.db.purchases.filter((p) => p.supplierId === s.id).slice(-5).reverse() : [];
    S.modal({
      title: s ? s.name : 'Nuevo proveedor', size: 'lg',
      body: `<form class="stack" id="f" novalidate><div class="grid g2">
        <label class="field span2"><span>Razón social *</span><input class="input" name="name" value="${esc(v.name || '')}" maxlength="120" ${ro}></label>
        <label class="field"><span>NIT *</span><input class="input" name="taxId" value="${esc(v.taxId || '')}" placeholder="900123456-7" ${ro}></label>
        <label class="field"><span>Contacto</span><input class="input" name="contact" value="${esc(v.contact || '')}" ${ro}></label>
        <label class="field"><span>Teléfono</span><input class="input" name="phone" value="${esc(v.phone || '')}" ${ro}></label>
        <label class="field"><span>Correo</span><input class="input" name="email" type="email" value="${esc(v.email || '')}" ${ro}></label>
        <label class="field"><span>Plazo de pago (días)</span><input class="input" name="paymentDays" type="number" min="0" value="${v.paymentDays}" ${ro}></label>
        <label class="field"><span>Tiempo de entrega (días) *</span><input class="input" name="leadDays" type="number" min="1" value="${v.leadDays}" ${ro}></label></div>
        ${s ? `<label class="check"><input type="checkbox" name="active" ${v.active ? 'checked' : ''} ${ro}><span>Activo</span></label>` : ''}
        <div class="form-error hidden" id="err" role="alert"></div></form>
        ${s ? `<h3 style="margin:16px 0 8px">Últimas órdenes</h3>${pos.length ? `<div class="list small">${pos.map((p) => `<a href="#/purchases?id=${p.id}">${esc(p.number)} · ${S.fdate(p.createdAt)} · ${S.money(p.total)} · ${esc(S.PO_STATUS[p.status])}</a>`).join('')}</div>` : '<p class="muted small">Sin órdenes.</p>'}` : ''}`,
      foot: manage ? `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Guardar</button>` : `<button class="btn" data-close>Cerrar</button>`,
      onMount(m, close) {
        if (!manage) return;
        m.querySelector('#ok').addEventListener('click', () => {
          const d = S.formData(m.querySelector('#f'));
          if (s) d.id = s.id;
          else d.active = true;
          try {
            S.act('suppliers.manage', 'saveSupplier', d);
            close();
            S.toast('Proveedor guardado.');
            S.refresh();
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }

  // =====================================================================
  // COMPRAS
  // =====================================================================
  S.route('purchases', {
    title: 'Compras', icon: 'receipt', perm: 'purchases.view',
    render(el, params) {
      const bids = S.scopeBranches();
      const t = S.today();
      const smap = S.mapBy(S.db.suppliers);
      el.innerHTML = `${S.pageHead('Compras', 'Solicitud → aprobación → envío al proveedor → recepción de mercancía.', S.can('purchases.create') ? `<button class="btn primary" id="new">${S.icon('plus')}Nueva orden</button>` : '')}
        <div class="toolbar"><div class="search">${S.icon('search')}<input class="input" id="q" placeholder="Número de orden" value="${esc(params.q || '')}" aria-label="Buscar"></div>
          <select class="select" id="st" aria-label="Estado">${S.options([['open', 'Abiertas'], ['late', 'Atrasadas'], ...Object.entries(S.PO_STATUS)], params.status, { empty: 'Todos los estados' })}</select>
          <select class="select" id="sup" aria-label="Proveedor">${S.options(S.db.suppliers.map((s) => [s.id, s.name]), params.sup, { empty: 'Todos los proveedores' })}</select></div><div class="card flush" id="tbl"></div>`;
      const isLate = (p) => ['APPROVED', 'SENT', 'PARTIAL'].includes(p.status) && p.expectedAt < t;
      const rows = () => {
        const q = (params.q || '').toLowerCase();
        return S.db.purchases.filter((p) => bids.includes(p.bid) && (!params.sup || p.supplierId === params.sup) && (!q || p.number.toLowerCase().includes(q)) && (() => {
          if (!params.status) return true;
          if (params.status === 'open') return ['REQUESTED', 'APPROVED', 'SENT', 'PARTIAL'].includes(p.status);
          if (params.status === 'late') return isLate(p);
          return p.status === params.status;
        })()).slice().reverse();
      };
      const tb = S.table(el.querySelector('#tbl'), [
        { key: 'number', label: 'Orden', sort: true, render: (p) => `<b>${esc(p.number)}</b>` },
        { key: 'createdAt', label: 'Fecha', sort: true, render: (p) => S.fdate(p.createdAt) },
        { key: 'sup', label: 'Proveedor', sort: (p) => (smap[p.supplierId] || {}).name, render: (p) => esc((smap[p.supplierId] || {}).name || '—') },
        { key: 'b', label: 'Sucursal', render: (p) => esc(S.branchName(p.bid)) },
        { key: 'total', label: 'Total', num: true, sort: true, render: (p) => S.money(p.total) },
        { key: 'expectedAt', label: 'Entrega esperada', sort: true, render: (p) => `${S.fdate(p.expectedAt)} ${isLate(p) ? S.badge('Atrasada', 'danger') : ''}` },
        { key: 'status', label: 'Estado', sort: true, render: (p) => S.poBadge(p.status) },
      ], { rows: rows(), onRow: (p) => poDetail(p.id), empty: 'No hay órdenes con esos filtros.' });
      el.querySelector('#q').addEventListener('input', (e) => ((params.q = e.target.value), S.setParams({ q: params.q }, { render: false }), tb.update(rows())));
      el.querySelector('#st').addEventListener('change', (e) => S.setParams({ status: e.target.value }));
      el.querySelector('#sup').addEventListener('change', (e) => S.setParams({ sup: e.target.value }));
      if (S.can('purchases.create')) {
        el.querySelector('#new').addEventListener('click', () => poModal());
        if (params.new) (S.setParams({ new: '' }, { render: false }), poModal());
      }
      if (params.id) (S.setParams({ id: '' }, { render: false }), poDetail(params.id));
    },
  });
  S.poModal = poModal;
  function poModal(pre) {
    S.modal({
      title: 'Nueva orden de compra', size: 'xl',
      body: `<div class="stack"><div class="grid g3"><label class="field"><span>Proveedor *</span><select class="select" id="sup">${S.options(S.db.suppliers.filter((s) => s.active).map((s) => [s.id, s.name]), pre && pre.supplierId, { empty: 'Seleccione…' })}</select></label>
        <label class="field"><span>Sucursal de destino *</span><select class="select" id="bid">${S.branchOptions((pre && pre.bid) || (S.branch !== 'ALL' ? S.branch : ''), 'Seleccione…')}</select></label>
        <label class="field"><span>Entrega esperada</span><input class="input" type="date" id="exp" min="${S.today()}"></label></div>
        <div class="row"><button class="btn sm" id="sugg">${S.icon('sparkle')}Agregar sugeridos del proveedor</button><span class="small muted">Según la regla de reposición (venta diaria × (entrega + 3 días)).</span></div>
        <div id="items"></div><label class="field"><span>Notas</span><input class="input" id="notes" maxlength="300"></label><div class="form-error hidden" id="err" role="alert"></div></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Guardar solicitud</button>`,
      onMount(m, close) {
        const bid = m.querySelector('#bid'), sup = m.querySelector('#sup');
        const ed = S.itemsEditor(m.querySelector('#items'), { cost: true, branch: () => bid.value, initial: (pre && pre.items) || [] });
        bid.addEventListener('change', ed.redraw);
        m.querySelector('#sugg').addEventListener('click', () => {
          if (!sup.value || !bid.value) return S.toast('Seleccione proveedor y sucursal.', 'warn');
          const s = A.reorder([bid.value]).filter((r) => r.p.supplierId === sup.value);
          if (!s.length) return S.toast('No hay productos de este proveedor por debajo del punto de reorden.', 'warn');
          s.forEach((r) => ed.add(r.p, r.qty, Math.round(r.cost)));
          S.toast(`${s.length} producto(s) sugerido(s) agregados.`);
        });
        m.querySelector('#ok').addEventListener('click', () => {
          try {
            S.assertBranch(bid.value);
            const o = S.act('purchases.create', 'createPurchase', { supplierId: sup.value, bid: bid.value, items: ed.items(), notes: m.querySelector('#notes').value, expectedAt: m.querySelector('#exp').value || null });
            close();
            S.toast(`Solicitud ${o.number} creada.`);
            S.go('purchases', { status: 'open' });
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }
  function poDetail(id) {
    const o = S.db.purchases.find((x) => x.id === id);
    if (!o) return S.toast('Orden no encontrada.', 'error');
    if (!S.scopeBranches().includes(o.bid) && !S.myBranches().some((b) => b.id === o.bid)) return S.toast('No tiene acceso a esa sucursal.', 'error');
    const sup = S.db.suppliers.find((s) => s.id === o.supplierId) || {};
    const pmap = S.mapBy(S.db.products);
    const acts = [];
    if (o.status === 'REQUESTED' && S.can('purchases.approve')) acts.push(['approve', 'Aprobar', 'primary']);
    if (o.status === 'APPROVED' && S.can('purchases.approve')) acts.push(['send', 'Marcar como enviada', 'primary']);
    if (['APPROVED', 'SENT', 'PARTIAL'].includes(o.status) && S.can('purchases.receive')) acts.push(['receive', 'Recibir mercancía', 'primary']);
    if (['APPROVED', 'SENT', 'PARTIAL'].includes(o.status) && S.can('purchases.approve')) acts.push(['close', 'Cerrar con faltante', '']);
    if (['REQUESTED', 'APPROVED'].includes(o.status) && (S.can('purchases.approve') || o.createdBy === S.user.id)) acts.push(['cancel', 'Cancelar', 'danger']);
    const html = () => `<div class="stack"><div class="row wrap between"><div>${S.poBadge(o.status)}</div><div class="small muted">Creada ${S.fdt(o.createdAt)} por ${esc(S.userName(o.createdBy))}</div></div>
      <dl class="dl"><dt>Proveedor</dt><dd><b>${esc(sup.name)}</b> · NIT ${esc(sup.taxId)}</dd><dt>Sucursal</dt><dd>${esc(S.branchName(o.bid))}</dd><dt>Entrega esperada</dt><dd>${S.fdate(o.expectedAt)}</dd>${o.notes ? `<dt>Notas</dt><dd>${esc(o.notes)}</dd>` : ''}${o.closeReason ? `<dt>Cierre</dt><dd>${esc(o.closeReason)}</dd>` : ''}${o.cancelReason ? `<dt>Cancelación</dt><dd>${esc(o.cancelReason)}</dd>` : ''}</dl>
      <div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Pedido</th><th class="num">Recibido</th><th class="num">Pendiente</th><th class="num">Costo unit.</th><th class="num">Subtotal</th></tr></thead><tbody>
      ${o.items.map((i) => `<tr><td><b>${esc(pmap[i.pid].name)}</b><div class="small muted">${esc(pmap[i.pid].sku)}</div></td><td class="num">${S.num(i.qty, 3)}</td><td class="num">${S.num(i.received, 3)}</td><td class="num">${S.num(Math.max(i.qty - i.received, 0), 3)}</td><td class="num">${S.money(i.cost)}</td><td class="num">${S.money(i.qty * i.cost)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="5">Total pedido</td><td class="num">${S.money(o.total)}</td></tr></tfoot></table></div>
      ${o.receipts.length ? `<h3>Recepciones</h3>${o.receipts.map((r) => `<div class="card" style="padding:10px"><div class="row between small"><b>${esc(r.number)}</b><span class="muted">${S.fdt(r.ts)} · ${esc(S.userName(r.userId))}</span></div>
        <div class="small" style="margin-top:6px">${r.lines.map((l) => `${esc(pmap[l.pid].name)}: ${S.num(l.qty, 3)} a ${S.money(l.cost)}${l.lot ? ` · lote ${esc(l.lot)} vence ${S.fdate(l.exp)}` : ''}${l.diff ? ` · <b class="${l.diff < 0 ? 'danger' : 'warn'}">${l.diff < 0 ? 'faltante' : 'sobrante'} ${S.num(Math.abs(l.diff), 3)}</b>` : ''}`).join('<br>')}</div></div>`).join('')}` : ''}
      <h3>Historial</h3><div class="timeline">${o.history.map((h) => `<div><b>${esc(S.PO_STATUS[h.status])}</b> · ${esc(S.userName(h.userId))} <span class="muted">· ${S.fdt(h.ts)}</span>${h.note ? `<div class="muted">${esc(h.note)}</div>` : ''}</div>`).join('')}</div></div>`;
    S.modal({
      title: `Orden de compra ${o.number}`, size: 'lg', body: html(),
      foot: `<button class="btn" id="print">${S.icon('printer')}Imprimir</button><div class="grow"></div>${acts.map(([k, l, c]) => `<button class="btn ${c}" data-act="${k}">${l}</button>`).join('')}`,
      onMount(m, close) {
        m.querySelector('#print').addEventListener('click', () => S.print(`<h2>${esc(S.db.company.name)}</h2><p>NIT ${esc(S.db.company.taxId)}</p><h1>Orden de compra ${esc(o.number)}</h1>
          <p>Proveedor: <b>${esc(sup.name)}</b> (NIT ${esc(sup.taxId)})<br>Entregar en: ${esc(S.branchName(o.bid))}<br>Fecha: ${S.fdate(o.createdAt)} · Entrega esperada: ${S.fdate(o.expectedAt)} · Estado: ${esc(S.PO_STATUS[o.status])}</p>
          <table><thead><tr><th>SKU</th><th>Producto</th><th class="num">Cantidad</th><th class="num">Costo unit.</th><th class="num">Subtotal</th></tr></thead><tbody>${o.items.map((i) => `<tr><td>${esc(pmap[i.pid].sku)}</td><td>${esc(pmap[i.pid].name)}</td><td class="num">${S.num(i.qty, 3)}</td><td class="num">${S.money(i.cost)}</td><td class="num">${S.money(i.qty * i.cost)}</td></tr>`).join('')}</tbody></table>
          <p class="num"><b>Total: ${S.money(o.total)}</b></p>${o.notes ? `<p>Notas: ${esc(o.notes)}</p>` : ''}<p style="margin-top:30px">Esta orden se envía al proveedor por el canal habitual; 80 SMART no la envía automáticamente.</p>`));
        m.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
          const k = b.dataset.act;
          try {
            if (k === 'approve') S.act('purchases.approve', 'approvePurchase', { id });
            if (k === 'send') {
              if (!(await S.confirm({ title: 'Marcar como enviada', message: 'Confirme que ya envió la orden al proveedor por su canal habitual (correo, teléfono, portal). 80 SMART no la envía automáticamente.', confirmLabel: 'Ya la envié' }))) return;
              S.act('purchases.approve', 'sendPurchase', { id });
            }
            if (k === 'receive') return close(), receiveModal(id);
            if (k === 'close') {
              const reason = await S.confirm({ title: 'Cerrar con faltante', message: 'La orden se cerrará y no se recibirá lo pendiente.', reason: true, confirmLabel: 'Cerrar orden' });
              if (!reason) return;
              S.act('purchases.approve', 'closePurchase', { id, reason });
            }
            if (k === 'cancel') {
              const reason = await S.confirm({ title: 'Cancelar orden', message: `Se cancelará la orden ${esc(o.number)}.`, reason: true, danger: true, confirmLabel: 'Cancelar orden' });
              if (!reason) return;
              S.tx((d) => S.ops.cancelPurchase(d, { id, reason }, { userId: S.user.id }));
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
  function receiveModal(id) {
    const o = S.db.purchases.find((x) => x.id === id);
    const pmap = S.mapBy(S.db.products);
    S.modal({
      title: `Recibir mercancía · ${o.number}`, size: 'xl',
      body: `<div class="stack"><p class="muted">Indique lo que llegó realmente. Las diferencias (faltantes o sobrantes) quedan registradas. El inventario y el costo promedio se actualizan al confirmar.</p>
        <div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Pendiente</th><th class="num">Recibido</th><th class="num">Costo real</th><th>Lote</th><th>Vencimiento</th></tr></thead><tbody>
        ${o.items.map((i, k) => { const p = pmap[i.pid]; const pend = Math.max(S.r3(i.qty - i.received), 0); return `<tr><td><b>${esc(p.name)}</b><div class="small muted">${esc(p.sku)}${p.tracksLots ? ' · controla lotes' : ''}</div></td><td class="num">${S.num(pend, 3)}</td>
          <td class="num"><input class="input sm right" style="width:96px" type="number" min="0" step="any" data-k="${k}" data-f="qty" value="${pend}" aria-label="Recibido"></td>
          <td class="num"><input class="input sm right" style="width:110px" type="number" min="0" step="1" data-k="${k}" data-f="cost" value="${i.cost}" aria-label="Costo"></td>
          <td>${p.tracksLots ? `<input class="input sm" style="width:110px" data-k="${k}" data-f="lot" aria-label="Lote">` : '<span class="muted">—</span>'}</td>
          <td>${p.tracksLots ? `<input class="input sm" type="date" data-k="${k}" data-f="exp" aria-label="Vencimiento">` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>
        <label class="field"><span>Observaciones</span><input class="input" id="note" maxlength="300" placeholder="Ej.: remisión 1234"></label><div class="form-error hidden" id="err" role="alert"></div></div>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Confirmar recepción</button>`,
      onMount(m, close) {
        m.querySelector('#ok').addEventListener('click', () => {
          const lines = o.items.map((i, k) => {
            const g = (f) => (m.querySelector(`[data-k="${k}"][data-f="${f}"]`) || {}).value;
            return { pid: i.pid, qty: +g('qty') || 0, cost: +g('cost'), lot: (g('lot') || '').trim() || null, exp: g('exp') || null };
          });
          try {
            S.assertBranch(o.bid);
            for (const l of lines) if (l.qty > 0 && pmap[l.pid].tracksLots && (!l.lot || !l.exp)) throw S.err(`Indique lote y vencimiento de ${pmap[l.pid].name}.`);
            const r = S.act('purchases.receive', 'receivePurchase', { id, lines, note: m.querySelector('#note').value });
            close();
            const diffs = r.lines.filter((l) => l.diff).length;
            S.toast(`Recepción ${r.number} registrada${diffs ? ` con ${diffs} diferencia(s)` : ''}.`);
            S.refresh();
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  }

  // =====================================================================
  // PUNTO DE VENTA
  // =====================================================================
  const pos = { cart: [], customerId: null, payment: 'CASH', received: '', bid: null };
  S.route('pos', {
    title: 'Punto de venta', icon: 'cart', perm: 'sales.pos',
    render(el) {
      const mine = S.myBranches();
      if (!pos.bid || !mine.some((b) => b.id === pos.bid)) pos.bid = S.branch !== 'ALL' ? S.branch : mine[0] && mine[0].id;
      if (!pos.bid) {
        el.innerHTML = `<div class="card"><h2>Sin sucursal asignada</h2><p class="muted">Pida a un administrador que le asigne una sucursal.</p></div>`;
        return;
      }
      const pmap = S.mapBy(S.db.products);
      pos.cart = pos.cart.filter((l) => pmap[l.pid]);
      const lines = pos.cart.map((l) => {
        const p = pmap[l.pid];
        const gross = p.price * l.qty;
        const disc = Math.min(+l.discount || 0, gross);
        return { ...l, p, gross, disc, total: gross - disc, base: (gross - disc) / (1 + p.tax / 100) };
      });
      const total = Math.round(S.sum(lines, (l) => l.total));
      const base = S.sum(lines, (l) => l.base);
      const disc = S.sum(lines, (l) => l.disc);
      const cust = pos.customerId ? S.db.customers.find((c) => c.id === pos.customerId) : null;
      const change = pos.payment === 'CASH' && pos.received !== '' ? +pos.received - total : null;
      el.innerHTML = `${S.pageHead('Punto de venta', `Cajero: ${esc(S.user.name)}`, `<select class="select" id="pbid" aria-label="Sucursal" ${mine.length < 2 ? 'disabled' : ''}>${S.options(mine.map((b) => [b.id, b.name]), pos.bid)}</select>`)}
        <div class="pos"><div class="stack">
          <div class="card"><div class="search">${S.icon('scan')}<input class="input scan" id="scan" placeholder="Escanee el código de barras o busque (F2)…" autocomplete="off" aria-label="Escanear o buscar producto"></div>
            <div class="small muted" style="margin-top:6px">El lector debe estar en modo teclado (envía el código y Enter). Escanear de nuevo suma una unidad.</div></div>
          <div class="card flush">${lines.length ? `<div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Precio</th><th class="center">Cantidad</th><th class="num">Descuento</th><th class="num">Total</th><th></th></tr></thead><tbody>
            ${lines.map((l, i) => `<tr><td><b>${esc(l.p.name)}</b><div class="small muted">${esc(l.p.sku)} · exist. ${S.qty(l.p, S.getStock(l.p.id, pos.bid))}</div></td><td class="num">${S.money(l.p.price)}${l.p.unit !== 'und' ? '/' + l.p.unit : ''}</td>
              <td class="center"><span class="qty"><button class="btn sm icon" data-dec="${i}" aria-label="Menos">−</button><input class="input sm" type="number" min="0" step="${l.p.unit === 'und' ? 1 : 0.005}" value="${l.qty}" data-qty="${i}" aria-label="Cantidad"><button class="btn sm icon" data-inc="${i}" aria-label="Más">+</button></span></td>
              <td class="num"><input class="input sm right" style="width:96px" type="number" min="0" step="100" value="${l.discount || ''}" placeholder="0" data-disc="${i}" aria-label="Descuento"></td>
              <td class="num"><b>${S.money(l.total)}</b></td><td><button class="btn ghost sm icon" data-rm="${i}" aria-label="Quitar">${S.icon('trash')}</button></td></tr>`).join('')}</tbody></table></div>`
              : `<div class="empty">${S.icon('cart')}<div>Escanee un producto para empezar.</div><div class="small" style="margin-top:6px"><kbd>F2</kbd> buscar · <kbd>F9</kbd> cobrar · <kbd>Esc</kbd> nueva venta</div></div>`}</div>
        </div>
        <div class="stack">
          <div class="card stack" style="gap:8px"><div class="row between"><h3>Cliente</h3>${cust ? `<button class="btn ghost sm" id="nocust">Quitar</button>` : ''}</div>
            ${cust ? `<div><b>${esc(cust.name)}</b><div class="small muted">${esc(cust.docType)} ${esc(S.can('customers.manage') ? cust.docNumber : S.mask(cust.docNumber))}</div></div>`
              : `<div class="row"><input class="input sm grow" id="custq" placeholder="Documento o nombre" aria-label="Buscar cliente"><button class="btn sm" id="custbtn">Buscar</button>${S.can('customers.create') ? `<button class="btn sm" id="custnew" title="Registrar cliente">${S.icon('plus')}</button>` : ''}</div><div id="custres"></div>`}</div>
          <div class="card stack" style="gap:10px">
            <dl class="dl"><dt>Subtotal sin IVA</dt><dd class="right tnum">${S.money(base)}</dd><dt>IVA</dt><dd class="right tnum">${S.money(total - base)}</dd>${disc ? `<dt>Descuentos</dt><dd class="right tnum">−${S.money(disc)}</dd>` : ''}</dl>
            <div class="row between"><span class="muted">Total</span><span class="pos-total">${S.money(total)}</span></div>
            <div class="pay-grid" role="radiogroup" aria-label="Medio de pago">${Object.entries(S.PAYMENTS).map(([k, l]) => `<button class="btn ${pos.payment === k ? 'active' : ''}" data-pay="${k}" role="radio" aria-checked="${pos.payment === k}">${l}</button>`).join('')}</div>
            ${pos.payment === 'CASH' ? `<label class="field"><span>Efectivo recibido</span><input class="input" id="recv" type="number" min="0" step="50" value="${esc(pos.received)}"></label>
              <div class="row wrap">${[['exact', 'Exacto'], [10000], [20000], [50000], [100000]].map(([v, l]) => `<button class="btn sm" data-bill="${v}">${l || S.money(v)}</button>`).join('')}</div>
              <div class="row between"><span class="muted">Cambio</span><b class="tnum ${change != null && change < 0 ? 'danger' : ''}" style="font-size:18px">${change == null ? '—' : change < 0 ? 'Faltan ' + S.money(-change) : S.money(change)}</b></div>`
              : `<p class="small muted">${pos.payment === 'CARD' ? 'Procese el pago en el datáfono; el sistema solo registra el medio de pago.' : 'Verifique la transferencia recibida antes de cobrar.'}</p>`}
            <button class="btn primary" id="charge" style="height:48px;font-size:16px" ${lines.length ? '' : 'disabled'}>Cobrar ${S.money(total)} <kbd style="background:transparent;color:inherit">F9</kbd></button>
            <button class="btn ghost sm" id="clear" ${lines.length ? '' : 'disabled'}>Nueva venta (Esc)</button>
          </div></div></div>`;
      const scan = el.querySelector('#scan');
      const addP = (p) => {
        const l = pos.cart.find((x) => x.pid === p.id);
        const inc = p.unit === 'und' ? 1 : 0.5;
        if (S.getStock(p.id, pos.bid) < (l ? l.qty : 0) + inc) {
          S.toast(`No hay existencias suficientes de ${p.name} en esta sucursal.`, 'warn');
          return;
        }
        if (l) l.qty = S.r3(l.qty + inc);
        else pos.cart.push({ pid: p.id, qty: inc, discount: 0 });
        S.refresh();
        setTimeout(() => document.getElementById('scan') && document.getElementById('scan').focus(), 0);
      };
      S.productPicker(scan, { onPick: addP, extra: (p) => S.money(p.price) + ' · exist. ' + S.qty(p, S.getStock(p.id, pos.bid)) });
      scan.focus();
      el.querySelector('#pbid').addEventListener('change', (e) => ((pos.bid = e.target.value), S.refresh()));
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const d = b.dataset;
        if (d.inc) (pos.cart[+d.inc].qty = S.r3(pos.cart[+d.inc].qty + (pmap[pos.cart[+d.inc].pid].unit === 'und' ? 1 : 0.1))), S.refresh();
        if (d.dec) {
          const l = pos.cart[+d.dec];
          l.qty = S.r3(l.qty - (pmap[l.pid].unit === 'und' ? 1 : 0.1));
          if (l.qty <= 0) pos.cart.splice(+d.dec, 1);
          S.refresh();
        }
        if (d.rm) (pos.cart.splice(+d.rm, 1), S.refresh());
        if (d.pay) ((pos.payment = d.pay), S.refresh());
        if (d.bill) ((pos.received = d.bill === 'exact' ? String(total) : d.bill), S.refresh());
      });
      el.querySelectorAll('[data-qty]').forEach((i) => i.addEventListener('change', () => {
        const v = S.r3(+i.value);
        if (v > 0) pos.cart[+i.dataset.qty].qty = v;
        else pos.cart.splice(+i.dataset.qty, 1);
        S.refresh();
      }));
      el.querySelectorAll('[data-disc]').forEach((i) => i.addEventListener('change', () => ((pos.cart[+i.dataset.disc].discount = Math.max(0, +i.value || 0)), S.refresh())));
      const recv = el.querySelector('#recv');
      if (recv) recv.addEventListener('change', () => ((pos.received = recv.value), S.refresh()));
      el.querySelector('#clear').addEventListener('click', resetPos);
      el.querySelector('#charge').addEventListener('click', charge);
      const nc = el.querySelector('#nocust');
      if (nc) nc.addEventListener('click', () => ((pos.customerId = null), S.refresh()));
      const cb = el.querySelector('#custbtn');
      if (cb) {
        const find = () => {
          const q = el.querySelector('#custq').value.trim().toLowerCase();
          const res = q.length < 3 ? [] : S.db.customers.filter((c) => c.docNumber.includes(q) || c.name.toLowerCase().includes(q)).slice(0, 5);
          el.querySelector('#custres').innerHTML = q.length < 3 ? '<div class="small muted">Escriba al menos 3 caracteres.</div>' : res.length ? `<div class="list small">${res.map((c) => `<button class="btn ghost sm" style="justify-content:flex-start" data-cust="${c.id}">${esc(c.name)} · ${esc(S.can('customers.manage') ? c.docNumber : S.mask(c.docNumber))}</button>`).join('')}</div>` : '<div class="small muted">Sin resultados.</div>';
          el.querySelectorAll('[data-cust]').forEach((b) => b.addEventListener('click', () => ((pos.customerId = b.dataset.cust), S.refresh())));
        };
        cb.addEventListener('click', find);
        el.querySelector('#custq').addEventListener('keydown', (e) => e.key === 'Enter' && (e.preventDefault(), find()));
      }
      const cn = el.querySelector('#custnew');
      if (cn) cn.addEventListener('click', () => S.customerModal(null, (c) => ((pos.customerId = c.id), S.refresh())));
    },
  });
  function resetPos() {
    pos.cart = [];
    pos.customerId = null;
    pos.payment = 'CASH';
    pos.received = '';
    S.refresh();
  }
  function charge() {
    if (!pos.cart.length) return;
    try {
      S.assertBranch(pos.bid);
      const sale = S.act('sales.pos', 'sale', { bid: pos.bid, items: pos.cart, customerId: pos.customerId, payment: pos.payment, received: pos.payment === 'CASH' ? +pos.received : null });
      pos.cart = [];
      pos.customerId = null;
      pos.received = '';
      pos.payment = 'CASH';
      S.refresh();
      showReceipt(sale, true);
    } catch (e) {
      S.fail(e);
    }
  }
  document.addEventListener('keydown', (e) => {
    if (S.parseHash().name !== 'pos' || !S.user) return;
    if (e.key === 'F2') (e.preventDefault(), document.getElementById('scan') && document.getElementById('scan').focus());
    if (e.key === 'F9' && !document.querySelector('.modal-back')) (e.preventDefault(), charge());
    if (e.key === 'Escape' && !document.querySelector('.modal-back') && !document.querySelector('.cmdk') && pos.cart.length) {
      const res = document.querySelector('.picker-results:not(.hidden)');
      if (!res) resetPos();
    }
  });

  S.receiptHtml = (s) => {
    const pmap = S.mapBy(S.db.products);
    const cust = s.customerId ? S.db.customers.find((c) => c.id === s.customerId) : null;
    const b = S.db.branches.find((x) => x.id === s.bid) || {};
    return `<div style="text-align:center"><b>${esc(S.db.company.name)}</b><br>NIT ${esc(S.db.company.taxId)}<br>${esc(b.name || '')}${b.address ? '<br>' + esc(b.address) : ''}</div><hr>
      <div>Comprobante: <b>${esc(s.number)}</b><br>Fecha: ${S.fdt(s.ts)}<br>Cajero: ${esc(S.userName(s.userId))}${cust ? `<br>Cliente: ${esc(cust.name)}` : ''}</div><hr>
      <table>${s.items.map((i) => `<tr><td colspan="2">${esc((pmap[i.pid] || {}).name || '')}</td></tr><tr><td>${S.num(i.qty, 3)} x ${S.money(i.price)}${i.discount ? ` (−${S.money(i.discount)})` : ''}</td><td class="num">${S.money(i.total)}</td></tr>`).join('')}</table><hr>
      <table><tr><td>Subtotal sin IVA</td><td class="num">${S.money(s.subtotal)}</td></tr><tr><td>IVA</td><td class="num">${S.money(s.iva)}</td></tr>${s.discount ? `<tr><td>Descuentos</td><td class="num">${S.money(s.discount)}</td></tr>` : ''}
      <tr><td><b>TOTAL</b></td><td class="num"><b>${S.money(s.total)}</b></td></tr><tr><td>${esc(S.PAYMENTS[s.payment])}</td><td class="num">${S.money(s.received)}</td></tr>${s.payment === 'CASH' ? `<tr><td>Cambio</td><td class="num">${S.money(s.change)}</td></tr>` : ''}</table><hr>
      ${s.status === 'VOID' ? '<p style="text-align:center"><b>*** VENTA ANULADA ***</b></p>' : ''}
      <p style="text-align:center">Documento interno de venta.<br>NO es factura electrónica.<br>Gracias por su compra</p>`;
  };
  function showReceipt(s, fresh) {
    S.modal({
      title: fresh ? 'Venta registrada' : `Comprobante ${s.number}`,
      body: `<div class="stack">${fresh ? `<div class="banner info">${S.icon('check')}<span>Venta <b>${esc(s.number)}</b> por <b>${S.money(s.total)}</b>${s.payment === 'CASH' ? ` · cambio <b>${S.money(s.change)}</b>` : ''}.</span></div>` : ''}<div class="card small" style="font-family:ui-monospace,monospace;max-width:340px;margin:0 auto">${S.receiptHtml(s)}</div></div>`,
      foot: `<button class="btn" data-close>${fresh ? 'Nueva venta (Esc)' : 'Cerrar'}</button><button class="btn primary" id="pr">${S.icon('printer')}Imprimir</button>`,
      onMount(m) {
        m.querySelector('#pr').addEventListener('click', () => S.print(S.receiptHtml(s), { receipt: true }));
        if (fresh) m.querySelector('#pr').focus();
      },
      onClose: () => fresh && setTimeout(() => document.getElementById('scan') && document.getElementById('scan').focus(), 0),
    });
  }

  // =====================================================================
  // VENTAS
  // =====================================================================
  S.route('sales', {
    title: 'Ventas', icon: 'dollar', perm: ['sales.view', 'sales.pos'],
    render(el, params) {
      const all = S.can('sales.view');
      const bids = S.scopeBranches();
      const rc = S.rangeControl(params, (p) => S.setParams(p));
      const cashiers = [...new Set(S.db.sales.map((s) => s.userId))].map((id) => [id, S.userName(id)]);
      el.innerHTML = `${S.pageHead('Ventas', all ? 'Historial de ventas con IVA, costo y utilidad.' : 'Sus ventas registradas.', `<button class="btn" id="exp">${S.icon('download')}Exportar CSV</button>`)}
        <div class="toolbar">${rc.html}<div class="search">${S.icon('search')}<input class="input" id="q" placeholder="Número de venta" value="${esc(params.q || '')}" aria-label="Buscar"></div>
          <select class="select" id="pay" aria-label="Medio de pago">${S.options(Object.entries(S.PAYMENTS), params.pay, { empty: 'Todos los medios' })}</select>
          <select class="select" id="st" aria-label="Estado">${S.options([['COMPLETED', 'Completadas'], ['VOID', 'Anuladas']], params.st, { empty: 'Todos los estados' })}</select>
          ${all ? `<select class="select" id="cash" aria-label="Cajero">${S.options(cashiers, params.cash, { empty: 'Todos los cajeros' })}</select>` : ''}</div>
        <div class="grid g4" id="kp" style="margin-bottom:12px"></div><div class="card flush" id="tbl"></div>`;
      rc.bind(el);
      const rows = () => {
        const q = (params.q || '').toLowerCase();
        return S.db.sales.filter((s) => bids.includes(s.bid) && (all || s.userId === S.user.id) && S.dayKey(s.ts) >= rc.from && S.dayKey(s.ts) <= rc.to
          && (!params.pay || s.payment === params.pay) && (!params.st || s.status === params.st) && (!params.cash || s.userId === params.cash) && (!q || s.number.toLowerCase().includes(q))).slice().reverse();
      };
      const kp = (r) => {
        const ok = r.filter((s) => s.status === 'COMPLETED');
        const sm = A.summary(ok);
        el.querySelector('#kp').innerHTML = [['Ventas', S.money(sm.total)], ['Transacciones', S.num(sm.count)], ['Ticket promedio', S.money(sm.ticket)], ...(all ? [['Utilidad bruta', S.money(sm.profit) + ` <span class="small muted">${S.pct(sm.margin)}</span>`]] : [['Anuladas', S.num(r.length - ok.length)]])]
          .map(([l, v]) => `<div class="card kpi"><span class="label">${l}</span><span class="value" style="font-size:20px">${v}</span></div>`).join('');
      };
      const data = rows();
      kp(data);
      const tb = S.table(el.querySelector('#tbl'), [
        { key: 'number', label: 'Venta', sort: true, render: (s) => `<b>${esc(s.number)}</b>` },
        { key: 'ts', label: 'Fecha', sort: true, render: (s) => `<span class="nowrap">${S.fdt(s.ts)}</span>` },
        { key: 'b', label: 'Sucursal', render: (s) => esc(S.branchName(s.bid)) },
        { key: 'u', label: 'Cajero', render: (s) => esc(S.userName(s.userId)) },
        { key: 'payment', label: 'Medio', render: (s) => esc(S.PAYMENTS[s.payment]) },
        { key: 'items', label: 'Ítems', num: true, render: (s) => s.items.length },
        { key: 'total', label: 'Total', num: true, sort: true, render: (s) => `<b>${S.money(s.total)}</b>` },
        ...(all ? [{ key: 'profit', label: 'Utilidad', num: true, sort: (s) => s.subtotal - s.cost, render: (s) => S.money(s.subtotal - s.cost) }] : []),
        { key: 'status', label: 'Estado', render: (s) => (s.status === 'VOID' ? S.badge('Anulada', 'danger') : S.badge('Completada', 'ok')) },
      ], { rows: data, onRow: (s) => saleDetail(s.id), pageSize: 30, empty: 'Sin ventas con esos filtros.' });
      el.querySelector('#q').addEventListener('input', (e) => ((params.q = e.target.value), S.setParams({ q: params.q }, { render: false }), tb.update(rows()), kp(rows())));
      ['pay', 'st', 'cash'].forEach((k) => el.querySelector('#' + k) && el.querySelector('#' + k).addEventListener('change', (e) => S.setParams({ [k]: e.target.value })));
      el.querySelector('#exp').addEventListener('click', () => S.download(`ventas-${rc.from}-a-${rc.to}.csv`, S.toCSV(tb.rows(), [['number', 'Venta'], [(s) => S.fdt(s.ts), 'Fecha'], [(s) => S.branchName(s.bid), 'Sucursal'], [(s) => S.userName(s.userId), 'Cajero'],
        [(s) => S.PAYMENTS[s.payment], 'Medio de pago'], ['subtotal', 'Subtotal sin IVA'], ['iva', 'IVA'], ['discount', 'Descuentos'], ['total', 'Total'], ...(all ? [['cost', 'Costo'], [(s) => S.r2(s.subtotal - s.cost), 'Utilidad']] : []), [(s) => (s.status === 'VOID' ? 'Anulada' : 'Completada'), 'Estado']])));
      if (params.id) (S.setParams({ id: '' }, { render: false }), saleDetail(params.id));
    },
  });

  // =====================================================================
  // INGRESOS (NUEVO MÓDULO — DATOS REALES DE VENTAS COMPLETADAS)
  // =====================================================================
  S.route('incomes', {
    title: 'Ingresos', label: 'Ingresos', icon: 'income', perm: ['reports.view', 'dashboard.view', 'sales.view'],
    render(el, params) {
      const bids = S.scopeBranches();
      const rc = S.rangeControl(params, (p) => S.setParams(p));
      const { from, to } = rc;
      const prev = A.previous(from, to);
      const t = S.today();

      const calc = (f, t2) => {
        const allSales = A.sales(f, t2, bids, { includeVoid: true });
        const ok = allSales.filter((s) => s.status === 'COMPLETED');
        const voided = allSales.filter((s) => s.status !== 'COMPLETED');
        const netCollected = S.sum(ok, (s) => s.total);
        const discounts = S.sum(ok, (s) => s.discount || 0);
        const gross = netCollected + discounts;
        const netBase = S.sum(ok, (s) => s.subtotal);
        const iva = S.sum(ok, (s) => s.iva);
        const cost = S.sum(ok, (s) => s.cost);
        const profit = netBase - cost;
        return {
          count: ok.length,
          gross,
          discounts,
          netCollected,
          netBase,
          iva,
          cost,
          profit,
          margin: netBase ? profit / netBase : 0,
          voidCount: voided.length,
          voidTotal: S.sum(voided, (s) => s.total),
          ok,
        };
      };

      const daily = calc(t, t);
      const weekly = calc(S.addDayKey(t, -6), t);
      const monthly = calc(t.slice(0, 8) + '01', t);
      const firstDay = S.db.sales.length ? S.dayKey(S.db.sales[0].ts) : t;
      const accumulated = calc(firstDay, t);
      const cur = calc(from, to);
      const before = calc(prev.from, prev.to);
      const diffPct = before.netCollected ? ((cur.netCollected - before.netCollected) / before.netCollected) : null;

      const byPay = Object.entries(S.PAYMENTS).map(([k, label]) => {
        const list = cur.ok.filter((s) => s.payment === k);
        return { key: k, label, count: list.length, value: S.sum(list, (s) => s.total) };
      }).filter((x) => x.value > 0);

      el.innerHTML = `${S.pageHead('Ingresos', 'Conciliación financiera sobre ventas reales completadas. Las anulaciones se excluyen de los ingresos.', `${rc.html}<button class="btn" id="expInc">${S.icon('download')}Exportar CSV</button>`)}
        <div class="grid g4 panel-stagger" style="margin-bottom:16px">
          <div class="card kpi"><span class="label">${S.icon('dollar')}Ingresos del día (hoy)</span><span class="value">${S.money(daily.netCollected)}</span><span class="sub">${S.num(daily.count)} ventas completadas</span></div>
          <div class="card kpi"><span class="label">${S.icon('calendar')}Ingresos semanales (7 d)</span><span class="value">${S.money(weekly.netCollected)}</span><span class="sub">${S.num(weekly.count)} transacciones válidas</span></div>
          <div class="card kpi coral"><span class="label">${S.icon('trend')}Ingresos mensuales</span><span class="value">${S.money(monthly.netCollected)}</span><span class="sub">${S.num(monthly.count)} ventas · mes en curso</span></div>
          <div class="card kpi emerald"><span class="label">${S.icon('layers')}Total acumulado</span><span class="value">${S.money(accumulated.netCollected)}</span><span class="sub">${S.num(accumulated.count)} ventas históricas</span></div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-head">
            <div><h2>Desglose del periodo (${S.fdate(from)} – ${S.fdate(to)})</h2><p>Diferenciación entre ventas brutas, descuentos, anulaciones excluidas e ingresos netos</p></div>
            ${diffPct != null ? `<span class="badge ${diffPct >= 0 ? 'ok' : 'danger'}">${diffPct >= 0 ? '▲' : '▼'} ${S.pct(Math.abs(diffPct))} vs periodo anterior</span>` : ''}
          </div>
          <div class="grid g4">
            <div class="card kpi" style="padding:13px"><span class="label">Ventas brutas</span><span class="value" style="font-size:19px">${S.money(cur.gross)}</span><span class="sub">Antes de descuentos</span></div>
            <div class="card kpi" style="padding:13px"><span class="label">Descuentos</span><span class="value warn" style="font-size:19px">−${S.money(cur.discounts)}</span><span class="sub">Aplicados en línea</span></div>
            <div class="card kpi" style="padding:13px"><span class="label">Anulaciones (excluidas)</span><span class="value danger" style="font-size:19px">${S.money(cur.voidTotal)}</span><span class="sub">${S.num(cur.voidCount)} ventas anuladas</span></div>
            <div class="card kpi" style="padding:13px"><span class="label">Ventas netas (sin IVA)</span><span class="value ok" style="font-size:19px">${S.money(cur.netBase)}</span><span class="sub">IVA: ${S.money(cur.iva)} · Utilidad: ${S.money(cur.profit)}</span></div>
          </div>
        </div>
        <div class="grid g3">
          <div class="card span2">
            <div class="card-head"><div><h2>Comparación de ingresos por período</h2><p>Recaudo neto diario frente al periodo anterior (${S.fdate(prev.from)} – ${S.fdate(prev.to)})</p></div>
              <div class="legend"><span><i style="border-color:var(--coral)"></i>Periodo actual</span><span><i class="dash" style="border-color:var(--primary)"></i>Periodo anterior</span></div>
            </div>
            <div id="ichart"></div>
          </div>
          <div class="card">
            <div class="card-head"><div><h2>Distribución por método de pago</h2><p>Participación sobre recaudo neto</p></div></div>
            <div id="idonut"></div>
          </div>
        </div>`;

      rc.bind(el);
      const days = A.days(from, to);
      const prevDays = A.days(prev.from, prev.to);
      const dc = A.daily(from, to, bids), dp = A.daily(prev.from, prev.to, bids);
      const short = (k) => S.parseDay(k).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
      S.lineChart(el.querySelector('#ichart'), {
        labels: days.map(short),
        series: [
          { name: 'Ingresos actuales', values: days.map((k) => dc[k].total), color: '--coral' },
          { name: 'Periodo anterior', values: prevDays.map((k) => dp[k].total), color: '--primary', dashed: true },
        ],
      });
      el.querySelector('#idonut').innerHTML = byPay.length
        ? S.donutHtml(byPay, 'Recaudo neto', S.money(cur.netCollected))
        : '<div class="empty">Sin ingresos registrados en este rango.</div>';

      el.querySelector('#expInc').addEventListener('click', () => {
        const rows = days.map((k, i) => ({
          day: k,
          count: dc[k].count,
          total: Math.round(dc[k].total),
          base: Math.round(dc[k].base),
          profit: Math.round(dc[k].base - dc[k].cost),
          prev: Math.round((dp[prevDays[i]] || {}).total || 0),
        }));
        S.download(`ingresos-${from}-a-${to}.csv`, S.toCSV(rows, [
          ['day', 'Fecha'], ['count', 'Transacciones'], ['total', 'Recaudo neto con IVA'], ['base', 'Ingreso neto sin IVA'], ['profit', 'Utilidad bruta'], ['prev', 'Periodo anterior'],
        ]));
      });
    },
  });

  // =====================================================================
  // VENTAS Y CAJAS (NUEVO MÓDULO — HISTORIAL POR CAJA, CAJERO Y TURNO)
  // =====================================================================
  S.route('cash-registers', {
    title: 'Ventas y cajas', label: 'Ventas y cajas', icon: 'cashregister', perm: ['sales.view', 'sales.pos'],
    render(el, params) {
      const all = S.can('sales.view');
      const bids = S.scopeBranches();
      const rc = S.rangeControl(params, (p) => S.setParams(p));
      const tab = params.tab || 'sales';
      const pmap = S.mapBy(S.db.products);

      // Cajas derivadas de las sucursales reales de la empresa (sin inventar ventas ni cajeros)
      const registers = S.db.branches.filter((b) => bids.includes(b.id)).map((b, idx) => ({
        id: 'REG-' + b.id,
        code: `CAJA-0${idx + 1}`,
        name: `Caja Principal · ${b.name}`,
        bid: b.id,
        branchName: b.name,
      }));
      const regByBid = Object.fromEntries(registers.map((r) => [r.bid, r]));
      const cashiers = [...new Set(S.db.sales.filter((s) => bids.includes(s.bid)).map((s) => s.userId))].map((uid) => [uid, S.userName(uid)]);

      const allSalesInRange = S.db.sales.filter((s) =>
        bids.includes(s.bid) &&
        (all || s.userId === S.user.id) &&
        S.dayKey(s.ts) >= rc.from &&
        S.dayKey(s.ts) <= rc.to &&
        (!params.reg || (regByBid[s.bid] && regByBid[s.bid].id === params.reg)) &&
        (!params.cash || s.userId === params.cash) &&
        (!params.pay || s.payment === params.pay) &&
        (!params.st || s.status === params.st) &&
        (!params.q || s.number.toLowerCase().includes(params.q.toLowerCase()))
      ).slice().reverse();

      const completedSales = allSalesInRange.filter((s) => s.status === 'COMPLETED');
      const totalCollected = S.sum(completedSales, (s) => s.total);

      el.innerHTML = `${S.pageHead('Ventas y cajas', 'Trazabilidad de cajas registradoras, cajeros responsables, turnos y transacciones.', `${rc.html}${S.can('sales.pos') ? `<a class="btn coral" href="#/pos">${S.icon('cart')}Ir al POS</a>` : ''}`)}
        <div class="grid g4 panel-stagger" style="margin-bottom:14px">
          <div class="card kpi coral"><span class="label">${S.icon('cashregister')}Total recaudado</span><span class="value">${S.money(totalCollected)}</span><span class="sub">Ventas completadas en rango</span></div>
          <div class="card kpi"><span class="label">${S.icon('receipt')}Cantidad de transacciones</span><span class="value">${S.num(completedSales.length)}</span><span class="sub">${S.num(allSalesInRange.length - completedSales.length)} anuladas</span></div>
          <div class="card kpi emerald"><span class="label">${S.icon('store')}Cajas operativas</span><span class="value">${S.num(registers.length)}</span><span class="sub">Asociadas a sucursales activas</span></div>
          <div class="card kpi"><span class="label">${S.icon('users')}Cajeros con actividad</span><span class="value">${S.num(new Set(completedSales.map((s) => s.userId)).size)}</span><span class="sub">En el periodo filtrado</span></div>
        </div>
        <div class="tabs" role="tablist">
          <button type="button" data-tab="sales" class="${tab === 'sales' ? 'active' : ''}">Historial de ventas</button>
          <button type="button" data-tab="by-register" class="${tab === 'by-register' ? 'active' : ''}">Historial por caja</button>
          <button type="button" data-tab="by-cashier" class="${tab === 'by-cashier' ? 'active' : ''}">Historial por cajero</button>
          <button type="button" data-tab="shifts" class="${tab === 'shifts' ? 'active' : ''}">Resumen por turno</button>
        </div>
        <div class="toolbar">
          <div class="search">${S.icon('search')}<input class="input" id="cq" placeholder="Nº de transacción…" value="${esc(params.q || '')}" aria-label="Buscar transacción"></div>
          <select class="select" id="creg" aria-label="Caja">${S.options(registers.map((r) => [r.id, r.code + ' · ' + r.name]), params.reg, { empty: 'Todas las cajas' })}</select>
          ${all ? `<select class="select" id="ccash" aria-label="Empleado / Cajero">${S.options(cashiers, params.cash, { empty: 'Todos los cajeros' })}</select>` : ''}
          <select class="select" id="cpay" aria-label="Método de pago">${S.options(Object.entries(S.PAYMENTS), params.pay, { empty: 'Todos los métodos' })}</select>
          <select class="select" id="cst" aria-label="Estado">${S.options([['COMPLETED', 'Completadas'], ['VOID', 'Anuladas']], params.st, { empty: 'Todos los estados' })}</select>
        </div>
        <div class="card flush" id="ctbl"></div>`;

      rc.bind(el);
      el.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => S.setParams({ tab: b.dataset.tab })));
      ['reg', 'cash', 'pay', 'st'].forEach((k) => {
        const sel = el.querySelector('#c' + k);
        if (sel) sel.addEventListener('change', (e) => S.setParams({ [k]: e.target.value }));
      });
      el.querySelector('#cq').addEventListener('input', (e) => S.setParams({ q: e.target.value }));

      const box = el.querySelector('#ctbl');
      if (tab === 'sales') {
        S.table(box, [
          { key: 'number', label: 'Nº Transacción', sort: true, render: (s) => `<b>${esc(s.number)}</b>` },
          { key: 'reg', label: 'Caja', render: (s) => { const r = regByBid[s.bid]; return r ? `<b>${esc(r.code)}</b><div class="small muted">${esc(r.branchName)}</div>` : esc(S.branchName(s.bid)); } },
          { key: 'cashier', label: 'Cajero responsable', render: (s) => esc(S.userName(s.userId)) },
          { key: 'ts', label: 'Fecha y hora', sort: true, render: (s) => `<span class="nowrap">${S.fdt(s.ts)}</span>` },
          { key: 'items', label: 'Productos vendidos', render: (s) => `<span class="small">${s.items.slice(0, 2).map((i) => `${esc((pmap[i.pid] || {}).name || 'Ítem')} (${S.num(i.qty, 2)})`).join(', ')}${s.items.length > 2 ? ` +${s.items.length - 2}` : ''}</span>` },
          { key: 'payment', label: 'Método de pago', render: (s) => esc(S.PAYMENTS[s.payment]) },
          { key: 'total', label: 'Total', num: true, sort: true, render: (s) => `<b>${S.money(s.total)}</b>` },
          { key: 'status', label: 'Estado', render: (s) => (s.status === 'VOID' ? S.badge('Anulada', 'danger') : S.badge('Completada', 'ok')) },
        ], { rows: allSalesInRange, onRow: (s) => saleDetail(s.id), pageSize: 25, empty: 'No hay transacciones para los filtros seleccionados.' });
      } else if (tab === 'by-register') {
        const regRows = registers.map((r) => {
          const ss = allSalesInRange.filter((s) => s.bid === r.bid);
          const ok = ss.filter((s) => s.status === 'COMPLETED');
          const cSet = [...new Set(ok.map((s) => S.userName(s.userId)))];
          const firstTs = ss.length ? ss[ss.length - 1].ts : null;
          const lastTs = ss.length ? ss[0].ts : null;
          return {
            ...r,
            state: ok.length ? 'Operativa' : 'Sin movimiento',
            cashiers: cSet.join(', ') || '—',
            openAt: firstTs ? S.fdt(firstTs) : '—',
            closeAt: lastTs ? S.fdt(lastTs) : '—',
            txCount: ok.length,
            total: S.sum(ok, (s) => s.total),
          };
        });
        S.table(box, [
          { key: 'code', label: 'Número de caja', render: (r) => `<b>${esc(r.code)}</b><div class="small muted">${esc(r.name)}</div>` },
          { key: 'state', label: 'Estado de caja', render: (r) => S.badge(r.state, r.txCount ? 'ok' : '') },
          { key: 'cashiers', label: 'Cajeros', render: (r) => esc(r.cashiers) },
          { key: 'openAt', label: 'Primera apertura', render: (r) => `<span class="small">${r.openAt}</span>` },
          { key: 'closeAt', label: 'Último movimiento', render: (r) => `<span class="small">${r.closeAt}</span>` },
          { key: 'txCount', label: 'Transacciones', num: true, sort: true, render: (r) => S.num(r.txCount) },
          { key: 'total', label: 'Total recaudado', num: true, sort: true, render: (r) => `<b>${S.money(r.total)}</b>` },
        ], { rows: regRows, empty: 'Sin cajas registradas.' });
      } else if (tab === 'by-cashier') {
        const map = new Map();
        for (const s of allSalesInRange) {
          if (!map.has(s.userId)) map.set(s.userId, { uid: s.userId, name: S.userName(s.userId), regs: new Set(), days: new Set(), count: 0, voided: 0, total: 0, lastTs: s.ts });
          const g = map.get(s.userId);
          if (regByBid[s.bid]) g.regs.add(regByBid[s.bid].code);
          g.days.add(S.dayKey(s.ts));
          if (s.ts > g.lastTs) g.lastTs = s.ts;
          if (s.status === 'COMPLETED') { g.count++; g.total += s.total; } else g.voided++;
        }
        const rows = [...map.values()].sort((a, b) => b.total - a.total);
        S.table(box, [
          { key: 'name', label: 'Empleado / Cajero', sort: true, render: (r) => `<b>${esc(r.name)}</b>` },
          { key: 'regs', label: 'Caja atendida', render: (r) => esc([...r.regs].join(', ') || '—') },
          { key: 'shifts', label: 'Turnos (días activos)', num: true, render: (r) => S.num(r.days.size) },
          { key: 'count', label: 'Cantidad de ventas', num: true, sort: true, render: (r) => S.num(r.count) + (r.voided ? ` <span class="small danger">(${r.voided} anul.)</span>` : '') },
          { key: 'total', label: 'Total vendido', num: true, sort: true, render: (r) => `<b>${S.money(r.total)}</b>` },
          { key: 'lastTs', label: 'Última actividad', render: (r) => S.fdt(r.lastTs) },
        ], { rows, empty: 'Sin actividad de cajeros en este periodo.' });
      } else {
        // Resumen por turno (agrupado por día + caja + cajero sobre ventas reales)
        const map = new Map();
        for (const s of allSalesInRange) {
          const day = S.dayKey(s.ts);
          const reg = regByBid[s.bid];
          const k = `${day}|${s.bid}|${s.userId}`;
          if (!map.has(k)) map.set(k, { day, regCode: reg ? reg.code : S.branchName(s.bid), branch: S.branchName(s.bid), cashier: S.userName(s.userId), openTs: s.ts, closeTs: s.ts, count: 0, total: 0 });
          const g = map.get(k);
          if (s.ts < g.openTs) g.openTs = s.ts;
          if (s.ts > g.closeTs) g.closeTs = s.ts;
          if (s.status === 'COMPLETED') { g.count++; g.total += s.total; }
        }
        const shiftRows = [...map.values()].sort((a, b) => (a.openTs < b.openTs ? 1 : -1));
        S.table(box, [
          { key: 'day', label: 'Fecha turno', render: (r) => S.fdate(r.day) },
          { key: 'regCode', label: 'Caja', render: (r) => `<b>${esc(r.regCode)}</b><div class="small muted">${esc(r.branch)}</div>` },
          { key: 'cashier', label: 'Cajero responsable', render: (r) => esc(r.cashier) },
          { key: 'openTs', label: 'Apertura', render: (r) => S.fdt(r.openTs) },
          { key: 'closeTs', label: 'Cierre', render: (r) => S.fdt(r.closeTs) },
          { key: 'count', label: 'Transacciones', num: true, render: (r) => S.num(r.count) },
          { key: 'total', label: 'Total recaudado', num: true, sort: true, render: (r) => `<b>${S.money(r.total)}</b>` },
          { key: 'st', label: 'Estado', render: (r) => S.badge(r.day === S.today() ? 'En curso' : 'Cerrado', r.day === S.today() ? 'ok' : '') },
        ], { rows: shiftRows, pageSize: 25, empty: 'Sin turnos registrados en el rango seleccionado.' });
      }
    },
  });
  function saleDetail(id) {
    const s = S.db.sales.find((x) => x.id === id);
    if (!s || !S.myBranches().some((b) => b.id === s.bid) || (!S.can('sales.view') && s.userId !== S.user.id)) return S.toast('Venta no encontrada.', 'error');
    const pmap = S.mapBy(S.db.products);
    const all = S.can('sales.view');
    const cust = s.customerId ? S.db.customers.find((c) => c.id === s.customerId) : null;
    S.modal({
      title: `Venta ${s.number}`, size: 'lg',
      body: `<div class="stack"><div class="row wrap between">${s.status === 'VOID' ? S.badge('Anulada', 'danger') : S.badge('Completada', 'ok')}<span class="small muted">${S.fdt(s.ts)} · ${esc(S.branchName(s.bid))} · ${esc(S.userName(s.userId))}</span></div>
        ${s.status === 'VOID' ? `<div class="banner warn">${S.icon('alert')}<span>Anulada por ${esc(S.userName(s.voidedBy))} el ${S.fdt(s.voidedAt)}. Motivo: ${esc(s.voidReason)}</span></div>` : ''}
        <dl class="dl"><dt>Medio de pago</dt><dd>${esc(S.PAYMENTS[s.payment])}</dd>${cust ? `<dt>Cliente</dt><dd>${esc(cust.name)}</dd>` : ''}</dl>
        <div class="table-wrap"><table class="table"><thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Desc.</th><th class="num">IVA</th><th class="num">Total</th>${all ? '<th class="num">Costo</th><th class="num">Utilidad</th>' : ''}</tr></thead><tbody>
        ${s.items.map((i) => `<tr><td>${esc((pmap[i.pid] || {}).name)}<div class="small muted">IVA ${i.tax} %</div></td><td class="num">${S.num(i.qty, 3)}</td><td class="num">${S.money(i.price)}</td><td class="num">${i.discount ? S.money(i.discount) : '—'}</td><td class="num">${S.money(i.iva)}</td><td class="num">${S.money(i.total)}</td>${all ? `<td class="num">${S.money(i.cost)}</td><td class="num">${S.money(i.base - i.cost)}</td>` : ''}</tr>`).join('')}
        </tbody><tfoot><tr><td colspan="4">Totales · base ${S.money(s.subtotal)}</td><td class="num">${S.money(s.iva)}</td><td class="num">${S.money(s.total)}</td>${all ? `<td class="num">${S.money(s.cost)}</td><td class="num">${S.money(s.subtotal - s.cost)}</td>` : ''}</tr></tfoot></table></div></div>`,
      foot: `<button class="btn" id="rp">${S.icon('printer')}Reimprimir comprobante</button><div class="grow"></div>${s.status === 'COMPLETED' && S.can('sales.void') ? `<button class="btn danger" id="void">Anular venta</button>` : ''}`,
      onMount(m, close) {
        m.querySelector('#rp').addEventListener('click', () => S.print(S.receiptHtml(s), { receipt: true }));
        const v = m.querySelector('#void');
        if (v) v.addEventListener('click', async () => {
          const reason = await S.confirm({ title: `Anular venta ${s.number}`, message: `Los productos se reintegrarán a sus lotes originales y la anulación quedará en la auditoría. Total: <b>${S.money(s.total)}</b>.`, confirmLabel: 'Anular venta', danger: true, reason: true });
          if (!reason) return;
          try {
            S.act('sales.void', 'voidSale', { id, reason });
            close();
            S.toast('Venta anulada.');
            S.refresh();
          } catch (e) {
            S.fail(e);
          }
        });
      },
    });
  }

  // =====================================================================
  // CLIENTES
  // =====================================================================
  S.route('customers', {
    title: 'Clientes', icon: 'users', perm: 'customers.view',
    render(el, params) {
      const manage = S.can('customers.manage');
      const stats = {};
      for (const s of S.db.sales) if (s.customerId && s.status === 'COMPLETED') { const x = (stats[s.customerId] = stats[s.customerId] || { n: 0, total: 0, last: null }); x.n++; x.total += s.total; x.last = s.ts; }
      el.innerHTML = `${S.pageHead('Clientes', 'Registro con autorización de tratamiento de datos (Ley 1581 de 2012).', `${manage ? `<button class="btn" id="exp">${S.icon('download')}Exportar CSV</button>` : ''}${S.can('customers.create') || manage ? `<button class="btn primary" id="new">${S.icon('plus')}Nuevo cliente</button>` : ''}`)}
        ${manage ? '' : `<div class="banner info">${S.icon('eye')}<span>Su rol ve el documento, el correo y el teléfono parcialmente ocultos.</span></div>`}
        <div class="toolbar"><div class="search">${S.icon('search')}<input class="input" id="q" placeholder="Nombre o documento" value="${esc(params.q || '')}" aria-label="Buscar"></div></div><div class="card flush" id="tbl"></div>`;
      const rows = () => {
        const q = (params.q || '').toLowerCase();
        return S.db.customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.docNumber.includes(q));
      };
      const shown = (v) => (manage ? esc(v || '—') : esc(S.mask(v)));
      const tb = S.table(el.querySelector('#tbl'), [
        { key: 'name', label: 'Cliente', sort: true, render: (c) => `<b>${esc(c.name)}</b><div class="small muted">${esc(c.docType)} ${shown(c.docNumber)}</div>` },
        { key: 'contact', label: 'Contacto', render: (c) => `${shown(c.email)}<div class="small muted">${shown(c.phone)}</div>` },
        { key: 'consent', label: 'Autorización de datos', render: (c) => (c.consentAt ? S.badge('Autorizado ' + S.fdate(c.consentAt), 'ok') : S.badge('Sin autorización', 'warn')) },
        { key: 'n', label: 'Compras', num: true, sort: (c) => (stats[c.id] || {}).n || 0, render: (c) => S.num((stats[c.id] || {}).n || 0) },
        { key: 'total', label: 'Total comprado', num: true, sort: (c) => (stats[c.id] || {}).total || 0, render: (c) => S.money((stats[c.id] || {}).total || 0) },
      ], { rows: rows(), sort: { key: 'name', dir: 1 }, onRow: (c) => customerDetail(c.id), empty: 'No hay clientes registrados.' });
      el.querySelector('#q').addEventListener('input', (e) => ((params.q = e.target.value), S.setParams({ q: params.q }, { render: false }), tb.update(rows())));
      const nb = el.querySelector('#new');
      if (nb) nb.addEventListener('click', () => S.customerModal(null, () => S.refresh()));
      const ex = el.querySelector('#exp');
      if (ex) ex.addEventListener('click', () => {
        S.download(`clientes-${S.stamp()}.csv`, S.toCSV(tb.rows(), [['name', 'Nombre'], ['docType', 'Tipo doc.'], ['docNumber', 'Documento'], ['email', 'Correo'], ['phone', 'Teléfono'], [(c) => (c.consentAt ? S.fdate(c.consentAt) : 'No'), 'Autorización de datos']]));
        S.tx(() => S.audit('customer.export', 'Cliente', null, null, { rows: tb.rows().length }));
      });
      if (params.id) (S.setParams({ id: '' }, { render: false }), customerDetail(params.id));
    },
  });
  S.customerModal = (c, onSaved) => {
    const manage = S.can('customers.manage');
    if (c && !manage) return S.toast('Su rol no puede editar clientes.', 'warn');
    const v = c || { docType: 'CC' };
    S.modal({
      title: c ? 'Editar cliente' : 'Registrar cliente',
      body: `<form class="stack" id="f" novalidate><div class="grid g2"><label class="field span2"><span>Nombre completo *</span><input class="input" name="name" value="${esc(v.name || '')}" maxlength="120"></label>
        <label class="field"><span>Tipo de documento *</span><select class="select" name="docType">${S.options([['CC', 'Cédula de ciudadanía'], ['CE', 'Cédula de extranjería'], ['NIT', 'NIT'], ['PAS', 'Pasaporte'], ['TI', 'Tarjeta de identidad']], v.docType)}</select></label>
        <label class="field"><span>Número *</span><input class="input" name="docNumber" value="${esc(v.docNumber || '')}" maxlength="15"></label>
        <label class="field"><span>Correo</span><input class="input" name="email" type="email" value="${esc(v.email || '')}"></label>
        <label class="field"><span>Teléfono</span><input class="input" name="phone" value="${esc(v.phone || '')}"></label>
        <label class="field span2"><span>Dirección</span><input class="input" name="address" value="${esc(v.address || '')}"></label></div>
        <label class="check"><input type="checkbox" name="consent" ${v.consentAt ? 'checked' : ''}><span><b>El cliente autoriza el tratamiento de sus datos personales</b><div class="small muted">Ley 1581 de 2012. Sin autorización solo se guarda nombre y documento.</div></span></label>
        <div class="form-error hidden" id="err" role="alert"></div></form>`,
      foot: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ok">Guardar</button>`,
      onMount(m, close) {
        m.querySelector('#ok').addEventListener('click', () => {
          const d = S.formData(m.querySelector('#f'));
          if (c) d.id = c.id;
          try {
            if (!S.can('customers.create') && !manage) throw S.err('No tiene permiso para registrar clientes.', 'FORBIDDEN');
            const saved = S.tx((db) => S.ops.saveCustomer(db, d, { userId: S.user.id }));
            close();
            S.toast('Cliente guardado.');
            onSaved && onSaved(saved);
          } catch (e) {
            S.showErr(m.querySelector('#err'), e);
          }
        });
      },
    });
  };
  function customerDetail(id) {
    const c = S.db.customers.find((x) => x.id === id);
    if (!c) return;
    const manage = S.can('customers.manage');
    const sales = S.db.sales.filter((s) => s.customerId === id && S.myBranches().some((b) => b.id === s.bid)).slice().reverse();
    const shown = (v) => (manage ? esc(v || '—') : esc(S.mask(v)));
    S.modal({
      title: c.name, size: 'lg',
      body: `<div class="stack"><dl class="dl"><dt>Documento</dt><dd>${esc(c.docType)} ${shown(c.docNumber)}</dd><dt>Correo</dt><dd>${shown(c.email)}</dd><dt>Teléfono</dt><dd>${shown(c.phone)}</dd>
        <dt>Autorización de datos</dt><dd>${c.consentAt ? 'Sí, desde ' + S.fdt(c.consentAt) : 'No'}</dd><dt>Registrado</dt><dd>${S.fdt(c.createdAt)}</dd></dl>
        <h3>Historial de compras (${sales.length})</h3><div id="hist"></div></div>`,
      foot: `<button class="btn" data-close>Cerrar</button>${manage ? `<button class="btn primary" id="ed">${S.icon('edit')}Editar</button>` : ''}`,
      onMount(m, close) {
        S.table(m.querySelector('#hist'), [
          { key: 'number', label: 'Venta', render: (s) => `<a href="#/sales?id=${s.id}">${esc(s.number)}</a>` },
          { key: 'ts', label: 'Fecha', render: (s) => S.fdt(s.ts) },
          { key: 'b', label: 'Sucursal', render: (s) => esc(S.branchName(s.bid)) },
          { key: 'total', label: 'Total', num: true, render: (s) => S.money(s.total) + (s.status === 'VOID' ? ' ' + S.badge('Anulada', 'danger') : '') },
        ], { rows: sales, pageSize: 8, empty: 'Sin compras registradas.' });
        m.querySelector('#hist').addEventListener('click', (e) => e.target.closest('a') && close());
        const ed = m.querySelector('#ed');
        if (ed) ed.addEventListener('click', () => (close(), S.customerModal(c, () => S.refresh())));
      },
    });
  }
})();
