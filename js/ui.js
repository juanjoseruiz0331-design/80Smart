'use strict';
/* Componentes de interfaz reutilizables: iconos, toasts, modales, tablas, gráficos, selector de productos, CSV e impresión. */
(function () {
  const S = window.S80;
  const esc = S.esc;

  // ---------- Iconos (trazos estilo Lucide, licencia ISC) ----------
  const I = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    package: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    printer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    edit: '<path d="M21.17 6.81a1 1 0 0 0-3.99-3.99L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    swap: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
    dollar: '<path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    sparkle: '<path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="m5.6 5.6 2.1 2.1"/><path d="m16.3 16.3 2.1 2.1"/><path d="m5.6 18.4 2.1-2.1"/><path d="m16.3 7.7 2.1-2.1"/>',
    income: '<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>',
    cashregister: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/><path d="M6 15h.01"/><path d="M10 15h.01"/><path d="M14 15h4"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    list: '<line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/>',
  };
  S.icon = (name, cls = '') =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || ''}</svg>`;

  // ---------- Toast ----------
  S.toast = (msg, type = 'ok') => {
    let box = document.querySelector('.toasts');
    if (!box) {
      box = document.createElement('div');
      box.className = 'toasts';
      box.setAttribute('role', 'status');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    box.appendChild(t);
    setTimeout(() => t.remove(), type === 'error' ? 6500 : 3500);
  };
  S.fail = (e) => {
    if (!e || !e.isUser) console.error(e);
    S.toast(e && e.isUser ? e.message : 'Ocurrió un error inesperado. Revise la consola del navegador.', 'error');
  };

  // ---------- Modal ----------
  S.modal = ({ title, body, size = '', foot, onMount, onClose }) => {
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head"><h2>${esc(title)}</h2><button class="btn ghost icon sm" data-close aria-label="Cerrar">${S.icon('x')}</button></div>
      <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
    const prevFocus = document.activeElement;
    const close = () => {
      back.remove();
      document.removeEventListener('keydown', onKey, true);
      if (onClose) onClose();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && document.body.lastElementChild === back) {
        e.stopPropagation();
        close();
      }
      if (e.key === 'Tab') {
        const f = [...back.querySelectorAll('button,input,select,textarea,a[href]')].filter((x) => !x.disabled && x.offsetParent);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) (f[f.length - 1].focus(), e.preventDefault());
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) (f[0].focus(), e.preventDefault());
      }
    };
    document.addEventListener('keydown', onKey, true);
    back.addEventListener('mousedown', (e) => {
      if (e.target === back) close();
    });
    back.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
    document.body.appendChild(back);
    const el = back.querySelector('.modal');
    if (onMount) onMount(el, close);
    if (!el.contains(document.activeElement)) {
      const first = el.querySelector('.modal-body input:not([type=checkbox]):not([disabled]), .modal-body select, .modal-body textarea');
      (first || el.querySelector('[data-close]')).focus();
    }
    return { el, close };
  };

  /** Confirmación; con reason:true exige un motivo (mínimo 5 caracteres) y resuelve con el texto. */
  S.confirm = ({ title, message, confirmLabel = 'Confirmar', danger = false, reason = false, reasonLabel = 'Motivo' }) =>
    new Promise((resolve) => {
      let done = false;
      S.modal({
        title,
        body: `<div class="stack"><p>${message}</p>${reason ? `<label class="field"><span>${esc(reasonLabel)} *</span><textarea class="input" data-reason maxlength="300" placeholder="Mínimo 5 caracteres"></textarea></label><div class="form-error hidden" data-err></div>` : ''}</div>`,
        foot: `<button class="btn" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirmLabel)}</button>`,
        onMount(el, close) {
          el.querySelector('[data-ok]').addEventListener('click', () => {
            if (reason) {
              const v = el.querySelector('[data-reason]').value.trim();
              if (v.length < 5) {
                const er = el.querySelector('[data-err]');
                er.textContent = 'Indique un motivo de al menos 5 caracteres.';
                er.classList.remove('hidden');
                return;
              }
              done = true;
              close();
              resolve(v);
            } else {
              done = true;
              close();
              resolve(true);
            }
          });
        },
        onClose: () => !done && resolve(false),
      });
    });

  /** Lee un formulario como objeto (checkbox → boolean). */
  S.formData = (form) => {
    const o = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') {
        if (el.checked) o[el.name] = el.value;
      } else o[el.name] = el.value;
    }
    return o;
  };
  S.showErr = (el, e) => {
    if (!el) return S.fail(e);
    if (!e || !e.isUser) console.error(e);
    el.textContent = e && e.isUser ? e.message : 'Ocurrió un error inesperado.';
    el.classList.remove('hidden');
  };

  /** Ejecuta una operación de negocio con verificación de permiso, transacción y auditoría. */
  S.act = (perm, op, args) => {
    if (perm) S.require(perm);
    return S.tx((d) => S.ops[op](d, args, { userId: S.user.id }));
  };

  // ---------- Selectores ----------
  S.options = (items, sel, { empty } = {}) =>
    (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
    items.map((x) => `<option value="${esc(x[0])}" ${String(x[0]) === String(sel ?? '') ? 'selected' : ''}>${esc(x[1])}</option>`).join('');
  S.branchOptions = (sel, empty) => S.options(S.myBranches().map((b) => [b.id, b.name]), sel, empty !== undefined ? { empty } : {});

  // ---------- Tabla ----------
  /**
   * columns: [{ key, label, render(row) → html, sort: (row) → valor | true, num, cls }]
   * opts: { rows, pageSize, onRow(row), empty, foot(rows) → html, sort: {key, dir} }
   */
  S.table = (container, columns, opts = {}) => {
    const st = { rows: opts.rows || [], page: 0, sort: opts.sort || null, size: opts.pageSize || 25 };
    const sortVal = (c, r) => (typeof c.sort === 'function' ? c.sort(r) : r[c.key]);
    function draw() {
      let rows = st.rows;
      if (st.sort) {
        const c = columns.find((x) => x.key === st.sort.key);
        if (c) rows = [...rows].sort((a, b) => {
          const x = sortVal(c, a), y = sortVal(c, b);
          return (x == null ? -1 : y == null ? 1 : x > y ? 1 : x < y ? -1 : 0) * st.sort.dir;
        });
      }
      const pages = Math.max(1, Math.ceil(rows.length / st.size));
      st.page = Math.min(st.page, pages - 1);
      const slice = rows.slice(st.page * st.size, (st.page + 1) * st.size);
      const head = columns.map((c) => {
        const sorted = st.sort && st.sort.key === c.key;
        const aria = sorted ? (st.sort.dir > 0 ? 'ascending' : 'descending') : 'none';
        return `<th class="${c.sort ? 'sortable' : ''} ${c.num ? 'num' : ''}" ${c.sort ? `data-sort="${c.key}" aria-sort="${aria}" tabindex="0"` : ''}>${esc(c.label)}${sorted ? (st.sort.dir > 0 ? ' ↑' : ' ↓') : ''}</th>`;
      }).join('');
      const body = slice.length
        ? slice.map((r, i) => `<tr data-i="${st.page * st.size + i}" class="${opts.onRow ? 'click' : ''}">${columns.map((c) => `<td class="${c.num ? 'num' : ''} ${c.cls || ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${columns.length}"><div class="empty">${S.icon('search')}<div>${esc(opts.empty || 'No hay registros para mostrar.')}</div></div></td></tr>`;
      container.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${opts.foot && rows.length ? `<tfoot>${opts.foot(rows)}</tfoot>` : ''}</table></div>
        ${rows.length > st.size ? `<div class="pager"><span>${S.num(st.page * st.size + 1)}–${S.num(Math.min((st.page + 1) * st.size, rows.length))} de ${S.num(rows.length)}</span>
        <div class="row"><button class="btn sm" data-pg="-1" ${st.page === 0 ? 'disabled' : ''}>Anterior</button><span>Página ${st.page + 1} de ${pages}</span><button class="btn sm" data-pg="1" ${st.page >= pages - 1 ? 'disabled' : ''}>Siguiente</button></div></div>` : rows.length ? `<div class="pager"><span>${S.num(rows.length)} registro${rows.length === 1 ? '' : 's'}</span></div>` : ''}`;
      container._rows = rows;
    }
    container.addEventListener('click', (e) => {
      const th = e.target.closest('th[data-sort]');
      if (th) {
        const k = th.dataset.sort;
        st.sort = st.sort && st.sort.key === k ? { key: k, dir: -st.sort.dir } : { key: k, dir: columns.find((c) => c.key === k).num ? -1 : 1 };
        return draw();
      }
      const pg = e.target.closest('[data-pg]');
      if (pg) {
        st.page += +pg.dataset.pg;
        return draw();
      }
      if (e.target.closest('button,a,input,select,label')) return;
      const tr = e.target.closest('tr[data-i]');
      if (tr && opts.onRow) opts.onRow(container._rows[+tr.dataset.i]);
    });
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.matches('th[data-sort]')) e.target.click();
    });
    draw();
    return {
      update(rows) {
        st.rows = rows;
        st.page = 0;
        draw();
      },
      rows: () => container._rows || [],
    };
  };

  // ---------- Gráficos (SVG propio, sin dependencias) ----------
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const niceMax = (v) => {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  };
  const shortMoney = (v) => (v >= 1e9 ? S.num(v / 1e9, 1) + ' mil M' : v >= 1e6 ? S.num(v / 1e6, 1) + ' M' : v >= 1e3 ? S.num(v / 1e3, 0) + ' mil' : S.num(v));
  S.shortMoney = shortMoney;
  /** series: [{ name, values[], color (var css), dashed }], labels: [texto], fmt: valor → texto */
  S.lineChart = (el, { labels, series, fmt = S.money, height = 240, tipLabels }) => {
    const W = Math.max(el.clientWidth || 600, 280), H = height, L = 52, R = 12, T = 12, B = 26;
    const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values.filter((v) => v != null))));
    const n = labels.length;
    const x = (i) => L + (n <= 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
    const every = Math.max(1, Math.ceil(n / Math.floor((W - L) / 64)));
    const path = (vals) => vals.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).map((p, i) => (i ? 'L' : 'M') + p).join('');
    el.classList.add('chart');
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(series.map((s) => s.name).join(' vs '))}">
      ${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="${css('--grid')}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="${css('--muted')}">${shortMoney(t)}</text>`).join('')}
      ${labels.map((lb, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every * 0.6) ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="${css('--muted')}">${esc(lb)}</text>` : '').join('')}
      ${series.map((s) => `<path d="${path(s.values)}" fill="none" stroke="${css(s.color || '--primary')}" stroke-width="2" ${s.dashed ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
      <line class="xh" y1="${T}" y2="${H - B}" stroke="${css('--border-strong')}" visibility="hidden"/>
      ${series.map((s, k) => `<circle class="pt${k}" r="4" fill="${css(s.color || '--primary')}" stroke="${css('--surface')}" stroke-width="2" visibility="hidden"/>`).join('')}
      <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent" class="hit"/>
    </svg><div class="tip hidden"></div>`;
    const svg = el.querySelector('svg'), tip = el.querySelector('.tip'), xh = el.querySelector('.xh');
    const move = (ev) => {
      const r = svg.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))));
      xh.setAttribute('x1', x(i));
      xh.setAttribute('x2', x(i));
      xh.setAttribute('visibility', 'visible');
      series.forEach((s, k) => {
        const c = el.querySelector('.pt' + k);
        if (s.values[i] == null) return c.setAttribute('visibility', 'hidden');
        c.setAttribute('cx', x(i));
        c.setAttribute('cy', y(s.values[i]));
        c.setAttribute('visibility', 'visible');
      });
      tip.innerHTML = `<b>${esc((tipLabels || labels)[i])}</b>` + series.map((s) => `<div class="row between" style="gap:14px"><span class="muted">${esc(s.name)}</span><b class="tnum">${s.values[i] == null ? '—' : esc(fmt(s.values[i]))}</b></div>`).join('');
      tip.classList.remove('hidden');
      const minY = Math.min(...series.map((s) => (s.values[i] == null ? H : y(s.values[i]))));
      tip.style.left = Math.max(80, Math.min(r.width - 80, (x(i) / W) * r.width)) + 'px';
      tip.style.top = (minY / H) * r.height + 'px';
    };
    const hit = el.querySelector('.hit');
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', () => {
      tip.classList.add('hidden');
      xh.setAttribute('visibility', 'hidden');
      series.forEach((s, k) => el.querySelector('.pt' + k).setAttribute('visibility', 'hidden'));
    });
  };
  /** Barras horizontales: items [{label, value, sub}] */
  S.barList = (el, items, { fmt = S.money, max, coral = false } = {}) => {
    const m = max || Math.max(1, ...items.map((i) => Math.abs(i.value)));
    el.classList.add('bars');
    el.innerHTML = items.length
      ? items.map((i) => `<div class="bar-row" title="${esc(i.label)}: ${esc(fmt(i.value))}${i.sub ? ' · ' + esc(i.sub) : ''}"><span class="lbl">${esc(i.label)}</span><div class="track"><div class="fill ${coral ? 'coral-fill' : ''}" style="width:${Math.max(1, (Math.abs(i.value) / m) * 100).toFixed(1)}%;${i.value < 0 ? 'background:var(--danger)' : ''}"></div></div><span class="tnum small">${esc(fmt(i.value))}${i.sub ? ` <span class="muted">· ${esc(i.sub)}</span>` : ''}</span></div>`).join('')
      : `<div class="empty">Sin datos en el periodo.</div>`;
  };

  /** Indicador circular de progreso (SVG) */
  S.gaugeHtml = (pct0to100, label, sublabel = '', { size = 116, stroke = 10, color = '#ffffff', track = 'rgba(255,255,255,0.22)' } = {}) => {
    const p = Math.max(0, Math.min(100, Number(pct0to100) || 0));
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const off = c * (1 - p / 100);
    return `<div style="position:relative;width:${size}px;height:${size}px;display:inline-grid;place-items:center;flex:none">
      <svg width="${size}" height="${size}" style="transform:rotate(-90deg);filter:drop-shadow(0 0 10px rgba(255,255,255,0.22))">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
      </svg>
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
        <b class="tnum" style="font-size:${size >= 100 ? '20px' : '15px'};line-height:1.1">${esc(label)}</b>
        ${sublabel ? `<span style="font-size:10px;opacity:0.82;margin-top:2px">${esc(sublabel)}</span>` : ''}
      </div>
    </div>`;
  };

  /** Widget Calendario Operativo */
  S.calendarCardHtml = (items = []) => {
    const now = new Date();
    const dayNum = String(now.getDate()).padStart(2, '0');
    const weekday = now.toLocaleDateString('es-CO', { weekday: 'long' });
    const monthYear = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const dow = (now.getDay() + 6) % 7;
    const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const weekHtml = labels.map((l, idx) => {
      const d = new Date(now);
      d.setDate(now.getDate() - dow + idx);
      return `<div class="exec-week-day ${idx === dow ? 'today' : ''}"><span>${l}</span><b class="tnum">${d.getDate()}</b></div>`;
    }).join('');
    const dots = { coral: '#10b981', ok: '#34d399', warn: '#fbbf24', danger: '#f87171' };
    return `<div class="card stack" style="justify-content:space-between">
      <div>
        <div class="row between">
          <div class="row" style="gap:12px">
            <b class="tnum" style="font-size:30px;line-height:1">${dayNum}</b>
            <div><b style="text-transform:capitalize">${esc(weekday)}</b><div class="small muted" style="text-transform:capitalize">${esc(monthYear)}</div></div>
          </div>
          <span class="badge">${S.icon('calendar')}Agenda operativa</span>
        </div>
        <div class="exec-week-strip">${weekHtml}</div>
        <div class="stack" style="gap:8px">
          ${items.map((it) => `<div class="row between" style="padding:8px 10px;border-radius:11px;border:1px solid var(--border);background:var(--surface-2)">
            <div class="row" style="gap:9px;min-width:0"><i style="width:8px;height:8px;border-radius:50%;background:${dots[it.tone] || dots.ok};box-shadow:0 0 8px ${dots[it.tone] || dots.ok};flex:none"></i>
              <div style="min-width:0"><b class="small" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.title)}</b><span class="small muted" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.detail)}</span></div>
            </div>
            <span class="badge">${esc(it.tag || '')}</span>
          </div>`).join('')}
        </div>
      </div>
    </div>`;
  };

  /** Gráfico de anillo (distribución por métodos de pago) */
  S.donutHtml = (items, centerLabel, centerValue) => {
    const total = Math.max(1, items.reduce((a, b) => a + b.value, 0));
    const colors = ['#10b981', '#34d399', '#38bdf8', '#fbbf24', '#a78bfa'];
    const size = 186, stroke = 20, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    let acc = 0;
    const arcs = items.map((it, i) => {
      const frac = it.value / total;
      const len = frac * c;
      const off = -acc * c;
      acc += frac;
      return `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="${stroke}" stroke-dasharray="${Math.max(0, len - 3).toFixed(1)} ${(c - Math.max(0, len - 3)).toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>`;
    }).join('');
    return `<div class="stack" style="align-items:center;gap:14px">
      <div style="position:relative;width:${size}px;height:${size}px;display:grid;place-items:center">
        <svg width="${size}" height="${size}" style="transform:rotate(-90deg)">
          <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}"/>
          ${arcs}
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center">
          <span class="small muted">${esc(centerLabel)}</span>
          <b class="tnum" style="font-size:17px;margin-top:2px">${esc(centerValue)}</b>
        </div>
      </div>
      <div class="stack" style="width:100%;gap:8px">
        ${items.map((it, i) => {
          const share = ((it.value / total) * 100).toFixed(1);
          return `<div class="row between small"><span class="row" style="gap:7px"><i style="width:9px;height:9px;border-radius:50%;background:${colors[i % colors.length]}"></i><b>${esc(it.label)}</b></span><span class="tnum">${esc(S.money(it.value))} <span class="muted">(${share}%)</span></span></div>`;
        }).join('')}
      </div>
    </div>`;
  };

  // ---------- Selector de productos (escáner en modo teclado + búsqueda) ----------
  S.findProducts = (q, { onlyActive = true, limit = 12 } = {}) => {
    q = String(q || '').trim().toLowerCase();
    const list = S.db.products.filter((p) => !onlyActive || p.active);
    if (!q) return list.slice(0, limit);
    const exact = list.filter((p) => p.barcode === q || p.sku.toLowerCase() === q);
    if (exact.length) return exact;
    const parts = q.split(/\s+/);
    return list.filter((p) => parts.every((w) => (p.name + ' ' + p.sku + ' ' + (p.barcode || '') + ' ' + (p.brand || '')).toLowerCase().includes(w))).slice(0, limit);
  };
  S.productPicker = (input, { onPick, extra, onlyActive = true }) => {
    const box = document.createElement('div');
    box.className = 'picker-results hidden';
    input.after(box);
    let res = [], hl = 0;
    const draw = () => {
      box.innerHTML = res.length
        ? res.map((p, i) => `<button type="button" data-i="${i}" class="${i === hl ? 'hl' : ''}"><span><b>${esc(p.name)}</b> <span class="muted small">${esc(p.sku)}${p.barcode ? ' · ' + esc(p.barcode) : ''}</span></span><span class="muted small nowrap">${extra ? extra(p) : S.money(p.price)}</span></button>`).join('')
        : `<div class="empty small">Sin coincidencias</div>`;
      box.classList.remove('hidden');
    };
    const search = () => {
      res = S.findProducts(input.value, { onlyActive });
      hl = 0;
      if (input.value.trim()) draw();
      else box.classList.add('hidden');
    };
    const pick = (p) => {
      input.value = '';
      box.classList.add('hidden');
      onPick(p);
      input.focus();
    };
    input.addEventListener('input', search);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') (hl = Math.min(hl + 1, res.length - 1), draw(), e.preventDefault());
      else if (e.key === 'ArrowUp') (hl = Math.max(hl - 1, 0), draw(), e.preventDefault());
      else if (e.key === 'Enter') {
        e.preventDefault();
        res = S.findProducts(input.value, { onlyActive });
        if (res.length && input.value.trim()) pick(res[Math.min(hl, res.length - 1)]);
        else if (input.value.trim()) S.toast(`No se encontró "${input.value.trim()}"`, 'warn');
      } else if (e.key === 'Escape' && !box.classList.contains('hidden')) {
        e.stopPropagation();
        box.classList.add('hidden');
      }
    });
    box.addEventListener('mousedown', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) (e.preventDefault(), pick(res[+b.dataset.i]));
    });
    input.addEventListener('blur', () => setTimeout(() => box.classList.add('hidden'), 150));
  };

  // ---------- CSV ----------
  const cell = (v) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutraliza inyección de fórmulas
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  S.toCSV = (rows, cols) => '﻿' + [cols.map((c) => cell(c[1])).join(';'), ...rows.map((r) => cols.map((c) => cell(typeof c[0] === 'function' ? c[0](r) : r[c[0]])).join(';'))].join('\r\n');
  S.download = (name, text, type = 'text/csv;charset=utf-8') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  S.parseCSV = (text) => {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/)[0] || '';
    const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') (f += '"', i++);
        else if (c === '"') q = false;
        else f += c;
      } else if (c === '"') q = true;
      else if (c === sep) (row.push(f), (f = ''));
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(f);
        rows.push(row);
        row = [];
        f = '';
      } else f += c;
    }
    if (f || row.length) (row.push(f), rows.push(row));
    return rows.filter((r) => r.some((x) => x.trim() !== ''));
  };
  S.stamp = () => S.today();

  // ---------- Impresión (comprobantes, órdenes y reportes → "Guardar como PDF" del navegador) ----------
  S.print = (html, { receipt = false } = {}) => {
    const area = document.getElementById('print-area');
    area.className = receipt ? 'receipt' : '';
    area.innerHTML = html;
    setTimeout(() => window.print(), 50);
  };

  // ---------- Etiquetas de estado ----------
  S.stockState = (p, qty) => {
    if (qty <= 0) return ['Agotado', 'danger'];
    if (qty <= p.minStock) return ['Stock crítico', 'warn'];
    if (p.maxStock && qty > p.maxStock) return ['Sobre stock', 'info'];
    return ['Disponible', 'ok'];
  };
  S.badge = (text, kind = '') => `<span class="badge ${kind}">${esc(text)}</span>`;
  const PO_KIND = { REQUESTED: 'info', APPROVED: 'primary', SENT: 'primary', PARTIAL: 'warn', RECEIVED: 'ok', CLOSED_SHORT: 'warn', CANCELLED: '' };
  const IO_KIND = { PENDING: 'info', APPROVED: 'primary', REJECTED: 'danger', PREPARING: 'warn', DELIVERED: 'ok', CANCELLED: '' };
  S.poBadge = (s) => S.badge(S.PO_STATUS[s], PO_KIND[s]);
  S.ioBadge = (s) => S.badge(S.IO_STATUS[s], IO_KIND[s]);
  S.expBadge = (exp) => {
    const n = S.daysBetween(new Date(), S.parseDay(exp));
    if (n < 0) return S.badge(`Vencido hace ${-n} d`, 'danger');
    if (n === 0) return S.badge('Vence hoy', 'danger');
    if (n <= 7) return S.badge(`Vence en ${n} d`, 'warn');
    return S.badge(`${n} días`, '');
  };
  S.qty = (p, q) => (p && p.unit !== 'und' ? S.num(q, 3) + ' ' + p.unit : S.num(q));

  // ---------- Rango de fechas ----------
  S.RANGES = [['today', 'Hoy'], ['7d', '7 días'], ['30d', '30 días'], ['month', 'Este mes'], ['90d', '90 días'], ['custom', 'Personalizado']];
  S.resolveRange = (key, from, to) => {
    const t = S.today();
    if (key === 'today') return { from: t, to: t };
    if (key === '7d') return { from: S.addDayKey(t, -6), to: t };
    if (key === '90d') return { from: S.addDayKey(t, -89), to: t };
    if (key === 'month') return { from: t.slice(0, 8) + '01', to: t };
    if (key === 'custom' && from && to && from <= to) return { from, to };
    return { from: S.addDayKey(t, -29), to: t };
  };
  S.rangeControl = (params, onChange) => {
    const key = params.range || '30d';
    const r = S.resolveRange(key, params.from, params.to);
    const html = `<div class="row wrap"><div class="seg" role="group" aria-label="Rango de fechas">${S.RANGES.map(([k, l]) => `<button type="button" data-range="${k}" class="${k === key ? 'active' : ''}">${l}</button>`).join('')}</div>
      <span class="row ${key === 'custom' ? '' : 'hidden'}" data-custom><input type="date" class="input sm" data-from value="${r.from}" aria-label="Desde"><span class="muted">a</span><input type="date" class="input sm" data-to value="${r.to}" max="${S.today()}" aria-label="Hasta"></span></div>`;
    const bind = (root) => {
      root.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => {
        if (b.dataset.range === 'custom') {
          root.querySelector('[data-custom]').classList.remove('hidden');
          root.querySelectorAll('[data-range]').forEach((x) => x.classList.toggle('active', x === b));
          return;
        }
        onChange({ range: b.dataset.range, from: '', to: '' });
      }));
      const f = root.querySelector('[data-from]'), t = root.querySelector('[data-to]');
      const ch = () => f.value && t.value && f.value <= t.value && onChange({ range: 'custom', from: f.value, to: t.value });
      f.addEventListener('change', ch);
      t.addEventListener('change', ch);
    };
    return { html, bind, ...r };
  };
})();
