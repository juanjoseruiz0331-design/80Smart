'use strict';
/* Arranque, sesión, enrutador y estructura de la aplicación. */
(function () {
  const S = window.S80;
  const esc = S.esc;
  const SESSION = 's80h.session';
  const IDLE_MIN = 30;
  S.routes = {};
  S.NAV = [];
  S.route = (name, def) => {
    S.routes[name] = def;
    if (def.nav !== false) S.NAV.push(name);
  };

  // ---------- Tema ----------
  const THEME = 's80h.theme';
  S.applyTheme = (t) => {
    document.documentElement.setAttribute('data-theme', t);
    S.lsSetRaw(THEME, t);
  };
  S.applyTheme(S.lsRaw(THEME) || 'dark');

  // ---------- Hash y parámetros (los filtros quedan en la dirección) ----------
  S.parseHash = () => {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, qs] = h.split('?');
    return { name: name || '', params: Object.fromEntries(new URLSearchParams(qs || '')) };
  };
  S.params = () => S.parseHash().params;
  const buildHash = (name, params) => {
    const clean = Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== '' && v != null && v !== false));
    const qs = new URLSearchParams(clean).toString();
    return '#/' + name + (qs ? '?' + qs : '');
  };
  S.go = (name, params) => {
    const h = buildHash(name, params);
    if (location.hash === h) S.renderPage();
    else location.hash = h;
  };
  S.setParams = (patch, { render = true } = {}) => {
    const { name, params } = S.parseHash();
    history.replaceState(null, '', buildHash(name, { ...params, ...patch }));
    if (render) S.renderPage();
  };

  // ---------- Sesión ----------
  S.session = () => S.ss.get(SESSION);
  const loadPerms = () => {
    const r = S.role(S.user.roleId);
    S.perms = new Set(r && r.key === 'ADMIN' ? S.ALL_PERMS : r ? r.perms : []);
  };
  S.enter = (cid, uid) => {
    const raw = S.lsRaw(S.companyKey(cid));
    if (!raw) return false;
    S.db = JSON.parse(raw);
    S._saved = raw;
    const u = S.db.users.find((x) => x.id === uid);
    if (!u || !u.active) return false;
    S.user = u;
    loadPerms();
    const sess = S.session() || {};
    S.branch = sess.branch && S.myBranches().some((b) => b.id === sess.branch) ? sess.branch : 'ALL';
    S.ss.set(SESSION, { cid, uid, v: sess.uid === uid && sess.v !== undefined ? sess.v : u.sessionVersion || 0, last: Date.now(), branch: S.branch });
    return true;
  };
  S.logout = (msg) => {
    S.ss.del(SESSION);
    S.user = null;
    S.db = null;
    S.perms = null;
    history.replaceState(null, '', '#/login');
    renderLogin(msg);
  };
  /** Revalida al usuario en cada navegación: desactivación o cambio de contraseña cierran la sesión. */
  const revalidate = () => {
    const sess = S.session();
    if (!sess || !S.db) return false;
    const latest = S.lsRaw(S.companyKey(sess.cid));
    if (latest && latest !== S._saved) {
      S.db = JSON.parse(latest);
      S._saved = latest;
    }
    const u = S.db.users.find((x) => x.id === sess.uid);
    if (!u || !u.active || (u.sessionVersion || 0) !== sess.v) {
      S.logout('Su sesión fue cerrada: el usuario cambió o fue desactivado.');
      return false;
    }
    if (Date.now() - sess.last > IDLE_MIN * 60000) {
      S.logout(`Su sesión se cerró tras ${IDLE_MIN} minutos de inactividad.`);
      return false;
    }
    S.user = u;
    loadPerms();
    return true;
  };
  let lastTouch = 0;
  const touch = () => {
    if (Date.now() - lastTouch < 15000) return;
    lastTouch = Date.now();
    const s = S.session();
    if (s) S.ss.set(SESSION, { ...s, last: Date.now() });
  };
  ['click', 'keydown'].forEach((ev) => document.addEventListener(ev, touch, true));
  setInterval(() => {
    const s = S.session();
    if (s && S.user && Date.now() - s.last > IDLE_MIN * 60000) S.logout(`Su sesión se cerró tras ${IDLE_MIN} minutos de inactividad.`);
  }, 30000);
  window.addEventListener('storage', (e) => {
    if (!S.db || e.key !== S.companyKey(S.db.company.id) || !e.newValue) return;
    S.db = JSON.parse(e.newValue);
    S._saved = e.newValue;
    if (!document.querySelector('.modal-back')) {
      S.renderPage();
      S.toast('Datos actualizados desde otra pestaña.', 'ok');
    }
  });

  // ---------- Inicio de sesión ----------
  const MAX_ATTEMPTS = 5, LOCK_MIN = 15;
  const findUser = (email) => {
    email = email.trim().toLowerCase();
    for (const c of S.index().companies) {
      const d = S.loadCompany(c.id);
      const u = d && d.users.find((x) => x.email === email);
      if (u) return { d, u };
    }
    return null;
  };
  const saveCompanyRaw = (d) => S.writeCompany(d);
  S.login = async (email, password) => {
    const generic = S.err('Correo o contraseña incorrectos.', 'AUTH');
    const hit = findUser(email);
    if (!hit) {
      await S.hashPassword(password || 'x'); // tiempo similar exista o no el usuario
      throw generic;
    }
    const { d, u } = hit;
    const auditTo = (action, after) => {
      const prev = S.db;
      S.db = d;
      S.audit(action, 'Sesión', u.id, null, after, { userId: u.id });
      S.db = prev;
    };
    if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(u.lockedUntil) - new Date()) / 60000);
      throw S.err(`Cuenta bloqueada temporalmente por intentos fallidos. Intente en ${mins} min o pida a un administrador que la desbloquee.`, 'LOCKED');
    }
    const ok = await S.verifyPassword(password, u.pw);
    if (!ok || !u.active) {
      u.failed = (u.failed || 0) + 1;
      if (u.failed >= MAX_ATTEMPTS) {
        u.lockedUntil = new Date(Date.now() + LOCK_MIN * 60000).toISOString();
        u.failed = 0;
        auditTo('auth.locked', { email: u.email, minutes: LOCK_MIN });
      } else auditTo('auth.failed', { email: u.email, attempt: u.failed });
      saveCompanyRaw(d);
      throw generic;
    }
    u.failed = 0;
    u.lockedUntil = null;
    u.lastLoginAt = new Date().toISOString();
    auditTo('auth.login', { email: u.email });
    saveCompanyRaw(d);
    S.enter(d.company.id, u.id);
  };

  function authShell(inner) {
    const heroPane = `<section class="auth-hero">
      <div class="row between">
        <div class="brand" style="padding:0"><div class="logo"><img src="img/logo-la80.png" alt="80 SMART"></div><div><b>80 SMART</b><span>Uso interno · Multi-Sede</span></div></div>
        <span class="badge primary">Multi-Sede</span>
      </div>
      <div class="stack" style="gap:16px;text-align:center;margin:auto 0;align-items:center">
        <h1>¡HOLA, BIENVENIDO!</h1>
        <p style="max-width:340px;color:rgba(255,255,255,0.82)">Plataforma operativa exclusiva de 80 SMART para inventario FEFO, punto de venta, compras, cajas y auditoría en nuestras 5 sedes.</p>
        <span class="small muted">El alta de usuarios se gestiona internamente por el administrador.</span>
      </div>
      <div class="row between small" style="color:rgba(255,255,255,0.65);border-top:1px solid rgba(255,255,255,0.14);padding-top:12px">
        <span>Uso exclusivo 80 SMART</span>
        <a href="index.html" style="color:#6ee7b7">Centro de operaciones →</a>
      </div>
    </section>`;

    const formPane = `<section class="auth-form"><div class="box panel-stagger">${inner}</div></section>`;

    document.getElementById('app').innerHTML = `<div class="auth">
      <div style="width:100%;max-width:980px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <a class="btn sm" href="index.html">← Centro de operaciones</a>
        <span class="small muted">80 SMART · Acceso Interno</span>
      </div>
      <div class="auth-card" id="authCard">
        ${formPane + heroPane}
      </div>
    </div>`;
  }

  function renderLogin(msg) {
    authShell(`<div class="stack" style="gap:18px">
      <div><span class="badge primary" style="margin-bottom:8px">Acceso exclusivo 80 SMART</span><h1>Iniciar sesión</h1><p class="muted" style="margin-top:4px">Ingrese con su usuario y contraseña asignados.</p></div>
      ${msg ? `<div class="banner info">${S.icon('info')}<span>${esc(msg)}</span></div>` : ''}
      ${!S.storageOk ? `<div class="banner warn">${S.icon('alert')}<span>Este navegador bloquea el almacenamiento local: los datos se perderán al cerrar la pestaña.</span></div>` : ''}
      <form class="stack" id="login" novalidate style="gap:16px">
        <label class="auth-field"><span>Correo electrónico</span><div class="auth-input-wrap">${S.icon('users')}<input class="auth-input" name="email" type="email" autocomplete="username" placeholder="usuario@80smart.com" required></div></label>
        <label class="auth-field"><span>Contraseña</span><div class="auth-input-wrap">${S.icon('lock')}<input class="auth-input" name="password" type="password" autocomplete="current-password" placeholder="••••••••••" required></div></label>
        <div class="form-error hidden" id="lerr" role="alert"></div>
        <button class="btn primary auth-submit-btn">Ingresar</button>
        <div class="center small"><a href="#/forgot">¿Olvidó la contraseña?</a></div>
      </form>
    </div>`);
    const form = document.getElementById('login');
    const err = document.getElementById('lerr');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.classList.add('hidden');
      const { email, password } = S.formData(form);
      if (!email || !password) return S.showErr(err, S.err('Ingrese correo y contraseña.'));
      const btn = form.querySelector('button.primary');
      btn.disabled = true;
      btn.textContent = 'Verificando…';
      try {
        await S.login(email, password);
        const first = S.can('dashboard.view') ? 'dashboard' : S.can('sales.pos') ? 'pos' : S.NAV.find((n) => canSee(n)) || 'settings';
        location.hash = '#/' + first;
        renderShell();
      } catch (ex) {
        S.showErr(err, ex);
        btn.disabled = false;
        btn.textContent = 'Ingresar';
      }
    });
    form.email.focus();
  }

  function renderForgot() {
    authShell(`<div class="stack" style="gap:18px"><h1>Recuperar contraseña</h1>
      <div class="banner info">${S.icon('info')}<span>La versión HTML no tiene servidor de correo, así que no puede enviar enlaces de recuperación. Pida a un administrador de su empresa que le asigne una contraseña nueva en <b>Usuarios y permisos</b>.</span></div>
      <a class="btn" href="#/login">Volver a iniciar sesión</a></div>`);
  }

  function renderRegister() {
    authShell(`<div class="stack" style="gap:18px">
      <div><h1>Crear su empresa</h1><p class="muted" style="margin-top:4px">Plan Starter con 14 días de prueba: 1 sucursal, 5 usuarios y 1.500 productos. Usted queda como Administrador.</p></div>
      <form class="stack" id="reg" novalidate>
        <h3>Su negocio</h3>
        <label class="field"><span>Nombre del negocio *</span><input class="input" name="company" required maxlength="80"></label>
        <div class="grid g2"><label class="field"><span>NIT *</span><input class="input" name="taxId" placeholder="900123456-7" required></label>
        <label class="field"><span>Ciudad</span><input class="input" name="city" maxlength="60"></label></div>
        <label class="field"><span>Sucursal principal *</span><input class="input" name="branch" value="Sede principal" required maxlength="60"></label>
        <h3 style="margin-top:6px">Usuario administrador</h3>
        <label class="field"><span>Nombre completo *</span><input class="input" name="name" required maxlength="80" autocomplete="name"></label>
        <label class="field"><span>Correo *</span><input class="input" name="email" type="email" required autocomplete="email"></label>
        <div class="grid g2"><label class="field"><span>Contraseña *</span><input class="input" name="password" type="password" required autocomplete="new-password"><small>8+ caracteres con mayúsculas, minúsculas y números</small></label>
        <label class="field"><span>Confirmar *</span><input class="input" name="confirm" type="password" required autocomplete="new-password"></label></div>
        <label class="check small"><input type="checkbox" name="terms"><span>Acepto los términos del servicio y autorizo el tratamiento de mis datos personales conforme a la Ley 1581 de 2012.</span></label>
        <div class="form-error hidden" id="rerr" role="alert"></div>
        <button class="btn primary" style="height:40px">Crear empresa</button>
      </form>
      <p class="center muted">¿Ya tiene cuenta? <a href="#/login" data-auth-swap="#/login"><b>Inicie sesión</b></a></p></div>`, 'register');
    const form = document.getElementById('reg');
    const err = document.getElementById('rerr');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.classList.add('hidden');
      const f = S.formData(form);
      try {
        if ((f.company || '').trim().length < 2) throw S.err('Indique el nombre del negocio.');
        if (!/^[0-9]{6,12}(-[0-9])?$/.test((f.taxId || '').trim())) throw S.err('NIT inválido (ej.: 900123456-7).');
        if ((f.branch || '').trim().length < 2) throw S.err('Indique el nombre de la sucursal principal.');
        if ((f.name || '').trim().length < 3) throw S.err('Indique su nombre completo.');
        const email = (f.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw S.err('Correo inválido.');
        const pIssue = S.passwordIssue(f.password);
        if (pIssue) throw S.err(pIssue);
        if (f.password !== f.confirm) throw S.err('Las contraseñas no coinciden.');
        if (!f.terms) throw S.err('Debe aceptar los términos y la autorización de datos.');
        if (findUser(email)) throw S.err('Ya existe una cuenta con ese correo en este navegador.', 'DUPLICATE');
        for (const c of S.index().companies) {
          const d0 = S.loadCompany(c.id);
          if (d0 && !d0.company.isDemo && d0.company.taxId === f.taxId.trim()) throw S.err('Ya existe una empresa registrada con ese NIT.', 'DUPLICATE');
        }
        const d = S.emptyCompany({ name: f.company.trim(), taxId: f.taxId.trim() });
        d.branches.push({ id: S.uid(), name: f.branch.trim(), code: 'PRINCIPAL', city: (f.city || '').trim(), address: '', phone: '', active: true });
        ['Abarrotes', 'Bebidas', 'Lácteos', 'Aseo', 'Frutas y verduras'].forEach((name) => d.categories.push({ id: S.uid(), name }));
        const pw = await S.hashPassword(f.password);
        const admin = { id: S.uid(), name: f.name.trim(), email, roleId: d.roles.find((r) => r.key === 'ADMIN').id, branchIds: [], allBranches: true, active: true, pw, failed: 0, lockedUntil: null, createdAt: new Date().toISOString() };
        d.users.push(admin);
        const prev = S.db;
        S.db = d;
        S.audit('company.register', 'Empresa', d.company.id, null, { name: d.company.name, taxId: d.company.taxId, plan: 'STARTER', admin: email }, { userId: admin.id });
        S.db = prev;
        S.writeCompany(d);
        S.enter(d.company.id, admin.id);
        location.hash = '#/dashboard';
        renderShell();
        S.toast('Empresa creada. Ahora agregue productos y a su equipo.');
      } catch (ex) {
        S.showErr(err, ex);
      }
    });
  }

  // ---------- Estructura ----------
  const canSee = (name) => {
    const r = S.routes[name];
    if (!r) return false;
    const p = r.perm;
    return !p || (Array.isArray(p) ? p.some(S.can) : S.can(p));
  };
  S.canSee = canSee;

  function renderShell() {
    const app = document.getElementById('app');
    app.innerHTML = `<div class="app">
      <aside class="sidebar" id="sidebar" aria-label="Menú principal">
        <div class="brand"><div class="logo"><img src="img/logo-la80.png" alt="Supermercados La 80"></div><div><b>80 SMART</b><span>Supermercados La 80</span></div></div>
        <nav class="nav" id="nav"></nav>
        <div class="side-foot" id="sidefoot"></div>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="btn ghost icon menu-btn" id="menuBtn" aria-label="Abrir menú">${S.icon('menu')}</button>
          <button class="btn grow hide-sm" id="searchBtn" style="justify-content:flex-start;max-width:340px;color:var(--muted);overflow:hidden">${S.icon('search')}<span style="overflow:hidden;text-overflow:ellipsis">Buscar…</span><kbd style="margin-left:auto">Ctrl K</kbd></button>
          <button class="btn icon" id="searchBtnSm" aria-label="Buscar" style="display:none">${S.icon('search')}</button>
          <div class="grow"></div>
          <div class="rel" id="createWrap"><button class="btn primary" id="createBtn" aria-haspopup="true">${S.icon('plus')}<span class="hide-sm">Crear</span></button></div>
          <select class="select sm" id="branchSel" aria-label="Sucursal" style="width:auto;max-width:200px"></select>
          <span class="sync hide-sm" id="sync" title="Los datos se guardan en este navegador"><i></i><span></span></span>
          <div class="rel"><button class="btn ghost icon" id="bellBtn" aria-label="Alertas">${S.icon('bell')}</button></div>
          <button class="btn ghost icon" id="themeBtn" aria-label="Cambiar tema"></button>
          <div class="rel"><button class="btn ghost" id="userBtn" aria-haspopup="true" style="padding:0 6px"><span class="avatar" id="avatar"></span></button></div>
        </header>
        <main class="content" id="content" tabindex="-1"></main>
      </div></div>`;
    const sb = document.getElementById('sidebar');
    document.getElementById('menuBtn').addEventListener('click', () => {
      sb.classList.add('open');
      const scrim = document.createElement('div');
      scrim.className = 'scrim';
      scrim.addEventListener('click', () => (sb.classList.remove('open'), scrim.remove()));
      document.body.appendChild(scrim);
    });
    document.getElementById('nav').addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        sb.classList.remove('open');
        document.querySelector('.scrim') && document.querySelector('.scrim').remove();
      }
    });
    document.getElementById('searchBtn').addEventListener('click', openSearch);
    document.getElementById('searchBtnSm').addEventListener('click', openSearch);
    if (matchMedia('(max-width: 960px)').matches) document.getElementById('searchBtnSm').style.display = '';
    document.getElementById('themeBtn').addEventListener('click', () => {
      S.applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
      paintTheme();
      S.renderPage();
    });
    document.getElementById('branchSel').addEventListener('change', (e) => {
      S.branch = e.target.value;
      const s = S.session();
      S.ss.set(SESSION, { ...s, branch: S.branch });
      S.renderPage();
    });
    document.getElementById('bellBtn').addEventListener('click', (e) => popover(e.currentTarget, alertsHtml()));
    document.getElementById('createBtn').addEventListener('click', (e) => popover(e.currentTarget, createHtml()));
    document.getElementById('userBtn').addEventListener('click', (e) =>
      popover(e.currentTarget, `<div style="padding:8px 10px"><b>${esc(S.user.name)}</b><div class="small muted">${esc(S.user.email)}</div><div class="small muted">${esc((S.role(S.user.roleId) || {}).name || '')}</div></div>
        <a href="#/settings?tab=account">${S.icon('lock')}Mi cuenta y seguridad</a><button class="item" data-logout>${S.icon('logout')}Cerrar sesión</button>`));
    S.renderPage();
  }
  function paintTheme() {
    const b = document.getElementById('themeBtn');
    if (b) b.innerHTML = S.icon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon');
  }
  function popover(anchor, html) {
    document.querySelectorAll('.popover').forEach((p) => p.remove());
    const p = document.createElement('div');
    p.className = 'popover';
    p.innerHTML = html;
    anchor.parentElement.appendChild(p);
    const lo = p.querySelector('[data-logout]');
    if (lo)
      lo.addEventListener('click', () => {
        const prev = S.db;
        S.audit('auth.logout', 'Sesión', S.user.id, null, null);
        S.writeCompany(prev);
        S._saved = S.lsRaw(S.companyKey(prev.company.id));
        S.logout('Sesión cerrada.');
      });
    const off = (e) => {
      if (!p.contains(e.target) && !anchor.contains(e.target)) (p.remove(), document.removeEventListener('mousedown', off));
    };
    setTimeout(() => document.addEventListener('mousedown', off), 0);
    p.addEventListener('click', (e) => e.target.closest('a') && p.remove());
  }

  function paintChrome(active) {
    const ORDER = ['dashboard', 'pos', 'products', 'inventory', 'purchases', 'suppliers', 'sales', 'cash-registers', 'incomes', 'customers', 'internal', 'reports', 'users', 'audit', 'settings'];
    const CORAL_NAV = new Set(['sales', 'cash-registers', 'incomes', 'pos']);
    const navList = S.NAV.slice().sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).filter((n) => canSee(n) && (!S.routes[n].navIf || S.routes[n].navIf()));
    document.getElementById('nav').innerHTML = navList
      .map((n) => `${n === 'reports' || n === 'users' ? '<div class="sep"></div>' : ''}<a href="#/${n}" class="${n === active ? 'active' : ''} ${CORAL_NAV.has(n) ? 'coral-nav' : ''}" ${n === active ? 'aria-current="page"' : ''}>${S.icon(S.routes[n].icon)}<span>${esc(S.routes[n].label || S.routes[n].title)}</span></a>`)
      .join('');
    const plan = S.PLANS[S.db.company.plan] || S.PLANS.STARTER;
    const sub = S.db.company.subscription;
    document.getElementById('sidefoot').innerHTML = `<div style="color:var(--text);font-weight:600">${esc(S.db.company.name)}</div>
      <div>Plan ${esc(plan.name)}${sub.status === 'TRIAL' ? ` · prueba hasta ${S.fdate(sub.periodEnd)}` : ''}</div>
      ${S.can('sales.pos') ? `<a class="btn sm coral" href="#/pos" style="margin-top:10px;width:100%">${S.icon('cart')}Abrir punto de venta</a>` : ''}
      <a class="btn sm" href="index.html" style="margin-top:6px;width:100%">${S.icon('store')}Portal Supermercados La 80</a>`;
    const mine = S.myBranches();
    const sel = document.getElementById('branchSel');
    sel.innerHTML = (mine.length > 1 ? `<option value="ALL">Todas mis sucursales</option>` : '') + mine.map((b) => `<option value="${b.id}">${esc(b.name)}</option>`).join('');
    if (mine.length === 1) S.branch = mine[0].id;
    sel.value = S.branch;
    document.getElementById('avatar').textContent = S.user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
    const last = S.db.audit.length ? S.db.audit[S.db.audit.length - 1].ts : null;
    document.querySelector('#sync span').textContent = 'Guardado local' + (last ? ' · ' + new Date(last).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '');
    const n = alerts().reduce((s, a) => s + a.count, 0);
    const bell = document.getElementById('bellBtn');
    bell.querySelector('.dot') && bell.querySelector('.dot').remove();
    if (n) bell.insertAdjacentHTML('beforeend', `<span class="dot">${n > 99 ? '99+' : n}</span>`);
    bell.setAttribute('aria-label', `Alertas (${n})`);
    paintTheme();
  }

  // ---------- Alertas ----------
  function alerts() {
    const bids = S.scopeBranches();
    const t = S.today();
    const out = [];
    if (S.can('inventory.view')) {
      const lots = S.db.lots.filter((l) => l.qty > 0 && bids.includes(l.bid));
      const expired = lots.filter((l) => l.exp < t).length;
      const soon = lots.filter((l) => l.exp >= t && l.exp <= S.addDayKey(t, 7)).length;
      if (expired) out.push({ count: expired, icon: 'alert', kind: 'danger', text: `${expired} lote(s) vencido(s) con existencias`, href: '#/inventory?tab=lots&status=expired' });
      if (soon) out.push({ count: soon, icon: 'clock', kind: 'warn', text: `${soon} lote(s) vencen en 7 días`, href: '#/inventory?tab=lots&status=soon' });
      let crit = 0;
      for (const p of S.db.products.filter((x) => x.active)) for (const b of bids) if (S.getStock(p.id, b) <= p.minStock) crit++;
      if (crit) out.push({ count: crit, icon: 'package', kind: 'warn', text: `${crit} producto(s) en stock crítico o agotados`, href: '#/inventory?status=critical' });
    }
    if (S.can('purchases.view')) {
      const late = S.db.purchases.filter((p) => ['APPROVED', 'SENT', 'PARTIAL'].includes(p.status) && p.expectedAt < t && bids.includes(p.bid)).length;
      if (late) out.push({ count: late, icon: 'truck', kind: 'danger', text: `${late} compra(s) atrasada(s)`, href: '#/purchases?status=late' });
    }
    if (S.can('purchases.approve')) {
      const pend = S.db.purchases.filter((p) => p.status === 'REQUESTED' && bids.includes(p.bid)).length;
      if (pend) out.push({ count: pend, icon: 'clipboard', kind: 'info', text: `${pend} solicitud(es) de compra por aprobar`, href: '#/purchases?status=REQUESTED' });
    }
    if (S.can('internal.approve')) {
      const pend = S.db.internal.filter((o) => o.status === 'PENDING' && o.createdBy !== S.user.id && bids.includes(o.fromBid)).length;
      if (pend) out.push({ count: pend, icon: 'clipboard', kind: 'info', text: `${pend} orden(es) interna(s) por aprobar`, href: '#/internal?status=PENDING' });
    }
    return out;
  }
  S.alerts = alerts;
  const alertsHtml = () => {
    const a = alerts();
    return `<div style="padding:8px 10px"><b>Alertas operativas</b></div>` + (a.length ? a.map((x) => `<a href="${x.href}"><span class="${x.kind}">${S.icon(x.icon)}</span><span>${esc(x.text)}</span></a>`).join('') : `<div class="empty small">Sin alertas por ahora.</div>`);
  };
  const createHtml = () =>
    [
      ['sales.pos', '#/pos', 'cart', 'Nueva venta'],
      ['products.manage', '#/products?new=1', 'package', 'Nuevo producto'],
      ['inventory.move', '#/inventory?action=entry', 'layers', 'Movimiento de inventario'],
      ['purchases.create', '#/purchases?new=1', 'truck', 'Orden de compra'],
      ['internal.create', '#/internal?new=1', 'clipboard', 'Orden interna'],
    ].filter(([p]) => S.can(p)).map(([, h, i, t]) => `<a href="${h}">${S.icon(i)}<span>${t}</span></a>`).join('') || `<div class="empty small">Su rol no puede crear documentos.</div>`;

  // ---------- Búsqueda global (Ctrl+K) ----------
  function openSearch() {
    if (!S.user || document.querySelector('.cmdk')) return;
    const w = document.createElement('div');
    w.className = 'cmdk';
    w.innerHTML = `<div class="box" role="dialog" aria-label="Búsqueda global"><input class="input" placeholder="Buscar productos, clientes, proveedores, ventas, compras, órdenes…" aria-label="Buscar"><div class="res"></div></div>`;
    document.body.appendChild(w);
    const inp = w.querySelector('input'), res = w.querySelector('.res');
    let links = [], hl = 0;
    const close = () => w.remove();
    const run = () => {
      const q = inp.value.trim().toLowerCase();
      const groups = [];
      if (q.length >= 2) {
        const m = (s) => String(s || '').toLowerCase().includes(q);
        if (S.can('products.view')) groups.push(['Productos', S.db.products.filter((p) => m(p.name) || m(p.sku) || m(p.barcode)).slice(0, 6).map((p) => [`#/products?q=${encodeURIComponent(p.sku)}`, p.name, p.sku])]);
        if (S.can('customers.view')) groups.push(['Clientes', S.db.customers.filter((c) => m(c.name) || m(c.docNumber)).slice(0, 5).map((c) => [`#/customers?id=${c.id}`, c.name, c.docType + ' ' + (S.can('customers.manage') ? c.docNumber : S.mask(c.docNumber))])]);
        if (S.can('suppliers.view')) groups.push(['Proveedores', S.db.suppliers.filter((s) => m(s.name) || m(s.taxId)).slice(0, 5).map((s) => [`#/suppliers?q=${encodeURIComponent(s.taxId)}`, s.name, 'NIT ' + s.taxId])]);
        if (S.can('sales.view') || S.can('sales.pos')) groups.push(['Ventas', S.db.sales.filter((s) => m(s.number) && (S.can('sales.view') || s.userId === S.user.id)).slice(-5).reverse().map((s) => [`#/sales?id=${s.id}`, s.number, S.money(s.total) + ' · ' + S.fdt(s.ts)])]);
        if (S.can('purchases.view')) groups.push(['Compras', S.db.purchases.filter((p) => m(p.number)).slice(-5).reverse().map((p) => [`#/purchases?id=${p.id}`, p.number, S.PO_STATUS[p.status]])]);
        if (S.can('internal.view')) groups.push(['Órdenes internas', S.db.internal.filter((o) => m(o.number)).slice(-5).reverse().map((o) => [`#/internal?id=${o.id}`, o.number, S.IO_STATUS[o.status]])]);
      }
      const g = groups.filter((x) => x[1].length);
      links = g.flatMap((x) => x[1]);
      hl = 0;
      let k = 0;
      res.innerHTML = q.length < 2 ? `<div class="empty small">Escriba al menos 2 caracteres.</div>` : g.length
        ? g.map(([t, items]) => `<div class="grp">${t}</div>` + items.map(([h, a, b]) => `<a href="${h}" data-k="${k++}"><span>${esc(a)}</span><span class="muted small">${esc(b)}</span></a>`).join('')).join('')
        : `<div class="empty small">Sin resultados para "${esc(q)}".</div>`;
      paint();
    };
    const paint = () => res.querySelectorAll('a').forEach((a) => a.classList.toggle('hl', +a.dataset.k === hl));
    inp.addEventListener('input', run);
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowDown') (hl = Math.min(hl + 1, links.length - 1), paint(), e.preventDefault());
      if (e.key === 'ArrowUp') (hl = Math.max(hl - 1, 0), paint(), e.preventDefault());
      if (e.key === 'Enter' && links[hl]) (location.hash = links[hl][0], close());
    });
    w.addEventListener('mousedown', (e) => e.target === w && close());
    res.addEventListener('click', (e) => e.target.closest('a') && close());
    run();
    inp.focus();
  }
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearch();
    }
  });

  // ---------- Render de página ----------
  S.renderPage = () => {
    const { name, params } = S.parseHash();
    if (!S.session() || !S.user) {
      if (name === 'register') return renderRegister();
      if (name === 'forgot') return renderForgot();
      return renderLogin();
    }
    if (!document.getElementById('content')) return renderShell();
    if (!revalidate()) return;
    const target = S.routes[name] && canSee(name) ? name : null;
    if (!target) {
      const first = S.can('dashboard.view') ? 'dashboard' : S.can('sales.pos') ? 'pos' : S.NAV.find(canSee);
      if (S.routes[name] && !canSee(name)) S.toast('No tiene permiso para ese módulo.', 'warn');
      history.replaceState(null, '', '#/' + (first || 'settings'));
      return S.renderPage();
    }
    paintChrome(target);
    const el = document.getElementById('content');
    const r = S.routes[target];
    document.title = r.title + ' · 80 SMART';
    try {
      const demo = S.db.company.isDemo ? `<div class="banner info">${S.icon('info')}<span><b>Empresa de demostración:</b> todos los datos son ficticios y se guardan solo en este navegador.</span></div>` : '';
      el.innerHTML = demo + '<div id="page"></div>';
      r.render(el.querySelector('#page'), params);
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="card"><h2>No se pudo mostrar esta página</h2><p class="muted" style="margin-top:6px">${esc(e.message)}</p></div>`;
    }
  };
  S.refresh = () => {
    const y = window.scrollY;
    S.renderPage();
    window.scrollTo(0, y);
  };
  S.pageHead = (title, sub, actions = '') => `<div class="page-head"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div><div class="row wrap">${actions}</div></div>`;

  window.addEventListener('hashchange', () => {
    const name = S.parseHash().name;
    if (S.user && (name === 'login' || name === 'register')) return history.replaceState(null, '', '#/dashboard'), S.renderPage();
    S.renderPage();
    const c = document.getElementById('content');
    if (c) window.scrollTo(0, 0);
  });

  // ---------- Arranque ----------
  S.boot = async () => {
    const app = document.getElementById('app');
    if (!S.cryptoOk) {
      app.innerHTML = `<div class="content"><div class="card"><h2>Navegador no compatible</h2><p class="muted">80 SMART necesita Web Crypto para proteger las contraseñas. Abra el archivo con Chrome, Edge o Firefox actualizados.</p></div></div>`;
      return;
    }
    // Limpiar entradas huérfanas o la instancia temporal "80 SMART" para restaurar la información completa.
    for (const c of [...S.index().companies]) {
      const d0 = S.loadCompany(c.id);
      if (!d0 || (!d0.company.isDemo && d0.company.name === '80 SMART')) {
        S.removeCompany(c.id);
        S.ss.del(SESSION);
      }
    }

    if (!S.index().companies.length) {
      app.innerHTML = `<div class="auth-form" style="min-height:100vh"><div class="box center stack"><div class="logo" style="margin:0 auto">80</div><h2>Preparando la empresa de demostración…</h2><p class="muted">Solo ocurre la primera vez.</p></div></div>`;
      try {
        const d = await S.buildDemo();
        S.writeCompany(d);
      } catch (e) {
        console.error(e);
        app.innerHTML = `<div class="content"><div class="card"><h2>No se pudo crear la demostración</h2><p class="muted">${esc(e.message)}</p></div></div>`;
        return;
      }
    }
    // Garantizar el administrador principal y desbloquear cuentas bloqueadas por intentos fallidos.
    for (const c of S.index().companies) {
      const d0 = S.loadCompany(c.id);
      if (!d0) continue;
      let dirty = false;
      for (const u of d0.users) {
        if (u.lockedUntil || u.failed > 0) {
          u.failed = 0;
          u.lockedUntil = null;
          dirty = true;
        }
      }
      const email = 'juanjoseruiz.0331@gmail.com';
      const exists = d0.users.find((u) => (u.email || '').toLowerCase() === email);
      const adminRole = d0.roles.find((r) => r.key === 'ADMIN');
      if (!exists && adminRole) {
        const ownerPw = await S.hashPassword('Juanjo1020');
        d0.users.push({
          id: S.uid(),
          name: 'Juan Jose Ruiz Bustamante',
          documentType: 'CC',
          documentNumber: '1020397170',
          email,
          roleId: adminRole.id,
          branchIds: [],
          allBranches: true,
          active: true,
          pw: ownerPw,
          failed: 0,
          lockedUntil: null,
          createdAt: new Date().toISOString(),
        });
        dirty = true;
      }
      if (dirty) S.writeCompany(d0);
    }
    const s = S.session();
    if (s && Date.now() - s.last <= IDLE_MIN * 60000 && S.enter(s.cid, s.uid) && (S.user.sessionVersion || 0) === s.v) renderShell();
    else {
      S.ss.del(SESSION);
      const n = S.parseHash().name;
      if (n === 'forgot') renderForgot();
      else renderLogin();
    }
  };
})();
