'use strict';
/* Empresa de demostración reproducible. Todos los nombres, documentos y correos son FICTICIOS. */
(function () {
  const S = window.S80;
  const O = S.ops;

  function rng(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const CATS = ['Lácteos y huevos', 'Carnes y pollo', 'Frutas y verduras', 'Panadería', 'Granos y abarrotes', 'Bebidas', 'Aseo del hogar', 'Cuidado personal', 'Snacks y dulces'];
  const PRODUCTS = [
    ['Leche entera 1 L', 0, 'Granja Andina', 'und', 3300, 0, true, 12, 10], ['Leche deslactosada 1 L', 0, 'Granja Andina', 'und', 3700, 0, true, 12, 7],
    ['Huevos AA x 30', 0, 'Gallina Feliz', 'und', 14500, 0, true, 21, 8], ['Queso campesino 500 g', 0, 'Valle Verde', 'und', 9800, 0, true, 14, 5],
    ['Yogur fresa 1 L', 0, 'Granja Andina', 'und', 6100, 19, true, 18, 4], ['Mantequilla 250 g', 0, 'Valle Verde', 'und', 6900, 19, true, 40, 3],
    ['Pechuga de pollo', 1, 'Don Arriero', 'kg', 14800, 0, true, 6, 6], ['Carne molida de res', 1, 'Don Arriero', 'kg', 19500, 0, true, 5, 5],
    ['Costilla de cerdo', 1, 'Don Arriero', 'kg', 15800, 0, true, 6, 3], ['Salchicha tradicional x 10', 1, 'Don Arriero', 'und', 7400, 19, true, 30, 4],
    ['Banano', 2, 'Del Campo', 'kg', 2300, 0, false, 0, 7], ['Tomate chonto', 2, 'Del Campo', 'kg', 3100, 0, false, 0, 7],
    ['Papa pastusa', 2, 'Del Campo', 'kg', 2100, 0, false, 0, 8], ['Cebolla cabezona', 2, 'Del Campo', 'kg', 2600, 0, false, 0, 6],
    ['Aguacate hass', 2, 'Del Campo', 'kg', 7200, 0, false, 0, 4], ['Limón tahití', 2, 'Del Campo', 'kg', 2900, 0, false, 0, 4],
    ['Pan tajado blanco', 3, 'Horno Real', 'und', 4600, 0, true, 8, 7], ['Arepa de maíz x 10', 3, 'Horno Real', 'und', 3900, 0, true, 10, 6],
    ['Pan integral', 3, 'Horno Real', 'und', 5300, 0, true, 8, 3], ['Tostadas x 20', 3, 'Horno Real', 'und', 4200, 19, false, 0, 2],
    ['Arroz blanco 1 kg', 4, 'Granero Mayor', 'und', 3600, 0, false, 0, 10], ['Frijol cargamanto 500 g', 4, 'Granero Mayor', 'und', 5200, 0, false, 0, 4],
    ['Lenteja 500 g', 4, 'Granero Mayor', 'und', 3000, 0, false, 0, 4], ['Aceite vegetal 1 L', 4, 'Dorado', 'und', 7900, 19, false, 0, 6],
    ['Azúcar 1 kg', 4, 'Granero Mayor', 'und', 3900, 5, false, 0, 6], ['Sal refinada 1 kg', 4, 'Granero Mayor', 'und', 1500, 0, false, 0, 3],
    ['Café molido 500 g', 4, 'Montaña Alta', 'und', 13800, 5, false, 0, 5], ['Chocolate de mesa 500 g', 4, 'Montaña Alta', 'und', 8200, 5, false, 0, 3],
    ['Pasta spaghetti 500 g', 4, 'Dorado', 'und', 2700, 5, false, 0, 5], ['Atún en lata 160 g', 4, 'Mar Azul', 'und', 4300, 19, false, 0, 4],
    ['Agua sin gas 600 ml', 5, 'Cristalina', 'und', 900, 19, false, 0, 6], ['Gaseosa cola 1,5 L', 5, 'Burbuja', 'und', 3600, 19, false, 0, 7],
    ['Jugo de naranja 1 L', 5, 'Valle Verde', 'und', 4400, 19, true, 25, 4], ['Cerveza lata 330 ml', 5, 'Cebada Dorada', 'und', 2300, 19, false, 0, 6],
    ['Bebida energizante 473 ml', 5, 'Voltio', 'und', 3500, 19, false, 0, 2],
    ['Detergente en polvo 1 kg', 6, 'Hogar Limpio', 'und', 9300, 19, false, 0, 4], ['Lavaloza líquido 500 ml', 6, 'Hogar Limpio', 'und', 4700, 19, false, 0, 4],
    ['Papel higiénico x 4', 6, 'Suave', 'und', 5600, 19, false, 0, 6], ['Blanqueador 1 L', 6, 'Hogar Limpio', 'und', 2900, 19, false, 0, 3],
    ['Bolsas de basura x 10', 6, 'Hogar Limpio', 'und', 3100, 19, false, 0, 2],
    ['Crema dental 100 ml', 7, 'Sonrisa', 'und', 4200, 19, false, 0, 4], ['Jabón de baño x 3', 7, 'Suave', 'und', 6300, 19, false, 0, 4],
    ['Champú 400 ml', 7, 'Suave', 'und', 11200, 19, false, 0, 2], ['Desodorante barra', 7, 'Sonrisa', 'und', 9400, 19, false, 0, 2],
    ['Papas fritas 110 g', 8, 'Crocante', 'und', 3200, 19, false, 0, 5], ['Galletas de chocolate', 8, 'Crocante', 'und', 2900, 19, false, 0, 4],
    ['Chocolatina 30 g', 8, 'Cacao Real', 'und', 1300, 19, false, 0, 4], ['Maní salado 150 g', 8, 'Crocante', 'und', 3500, 19, false, 0, 2],
  ];
  const SUPPLIERS = [
    ['Lácteos Granja Andina S.A.S.', '900410221-3', [0], 2], ['Distribuidora Don Arriero S.A.S.', '900522118-1', [1], 2],
    ['Agrocentral Del Campo Ltda.', '830144556-9', [2], 1], ['Panificadora Horno Real S.A.S.', '901233987-4', [3], 1],
    ['Comercializadora Granero Mayor S.A.', '860077123-5', [4], 4], ['Bebidas y Refrescos del Valle S.A.S.', '900987654-2', [5], 3],
    ['Hogar y Cuidado Mayorista S.A.S.', '901556340-8', [6, 7, 8], 5],
  ];
  const FIRST = ['Ana', 'Carlos', 'Luisa', 'Andrés', 'María', 'Jorge', 'Paula', 'Felipe', 'Diana', 'Santiago', 'Valentina', 'Camilo', 'Laura', 'Mateo', 'Sara', 'Julián', 'Natalia', 'David', 'Catalina', 'Esteban'];
  const LAST = ['Restrepo', 'Gómez', 'Zapata', 'Arango', 'Vélez', 'Cardona', 'Ospina', 'Montoya', 'Giraldo', 'Correa', 'Henao', 'Mejía', 'Londoño', 'Betancur', 'Quintero'];

  S.buildDemo = async function buildDemo() {
    const r = rng(80);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const d = S.emptyCompany({ name: 'Supermercado Demo La 80', legalName: 'Supermercado Demo La 80 S.A.S. (ficticia)', taxId: '900000080-0', plan: 'BUSINESS', isDemo: true, status: 'ACTIVE' });
    d.company.subscription.periodEnd = S.dayKey(S.addDays(new Date(), 22));
    const branches = [['Sede La 80', 'LA80', 'Medellín', 'Cra. 80 # 00-00 (ficticia)'], ['Sede Laureles', 'LAUR', 'Medellín', 'Cl. 33 # 00-00 (ficticia)'], ['Sede Envigado', 'ENV', 'Envigado', 'Cra. 43A # 00-00 (ficticia)']];
    branches.forEach(([name, code, city, address]) => d.branches.push({ id: S.uid(), name, code, city, address, phone: '', active: true }));
    const B = d.branches.map((b) => b.id);
    const role = (k) => d.roles.find((x) => x.key === k).id;
    const pw = await S.hashPassword('Smart80demo');
    const mkUser = (name, email, rk, branchIds, all = false) => {
      const u = { id: S.uid(), name, email, roleId: role(rk), branchIds, allBranches: all, active: true, pw: { ...pw }, failed: 0, lockedUntil: null, createdAt: new Date().toISOString() };
      d.users.push(u);
      return u;
    };
    const admin = mkUser('Administrador Demo', 'admin@80smart.demo', 'ADMIN', [], true);
    const ownerPw = await S.hashPassword('Juanjo1020');
    d.users.push({
      id: S.uid(),
      name: 'Juan Jose Ruiz Bustamante',
      documentType: 'CC',
      documentNumber: '1020397170',
      email: 'juanjoseruiz.0331@gmail.com',
      roleId: role('ADMIN'),
      branchIds: [],
      allBranches: true,
      active: true,
      pw: ownerPw,
      failed: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString(),
    });
    const gerente = mkUser('Gerente Demo', 'gerente@80smart.demo', 'GERENTE', [], true);
    const sup = mkUser('Supervisor Demo', 'supervisor@80smart.demo', 'SUPERVISOR', [B[0], B[1]]);
    const alm = mkUser('Almacén Demo', 'almacen@80smart.demo', 'ALMACEN', [...B]);
    const caj = mkUser('Cajero Demo', 'cajero@80smart.demo', 'CAJERO', [B[0]]);
    const caj2 = mkUser('Cajero Laureles (demo)', 'cajero2@80smart.demo', 'CAJERO', [B[1]]);
    const caj3 = mkUser('Cajero Envigado (demo)', 'cajero3@80smart.demo', 'CAJERO', [B[2]]);
    const cashier = [caj.id, caj2.id, caj3.id];

    CATS.forEach((name) => d.categories.push({ id: S.uid(), name }));
    SUPPLIERS.forEach(([name, taxId, cats, lead], i) =>
      d.suppliers.push({
        id: S.uid(), name, taxId, contact: pick(FIRST) + ' ' + pick(LAST), phone: '300 000 00' + String(10 + i),
        email: `compras${i + 1}@proveedor-ficticio.test`, paymentDays: [0, 15, 30][i % 3], leadDays: lead, active: true, cats, createdAt: new Date().toISOString(),
      }));
    const supFor = (ci) => d.suppliers.find((s) => s.cats.includes(ci));

    const round50 = (n) => Math.round(n / 50) * 50;
    PRODUCTS.forEach(([name, ci, brand, unit, cost, tax, lots, life, pop], i) => {
      const margin = 0.18 + r() * 0.17;
      const price = round50(cost * (1 + margin) * (1 + tax / 100));
      const max = Math.round((unit === 'kg' ? 60 : 50) + pop * 12);
      const min = Math.max(6, Math.round(max * 0.22));
      d.products.push({
        id: S.uid(), name, sku: 'P' + String(1001 + i), barcode: '770' + String(1000000000 + i * 7919).slice(0, 10),
        categoryId: d.categories[ci].id, brand, unit, cost, lastCost: cost, price, tax, tracksLots: lots, minStock: min, maxStock: max,
        supplierId: supFor(ci).id, active: true, _life: life, _pop: pop, createdAt: new Date().toISOString(),
      });
    });

    for (let i = 0; i < 25; i++) {
      d.customers.push({
        id: S.uid(), docType: 'CC', docNumber: String(1000000000 + Math.floor(r() * 90000000)),
        name: `${pick(FIRST)} ${pick(LAST)} ${pick(LAST)}`, email: `cliente${i + 1}@ficticio.test`,
        phone: '310 000 ' + String(1000 + i), consent: true, createdAt: new Date().toISOString(),
      });
    }

    const DAYS = 42;
    const nowD = new Date();
    const startD = S.addDays(nowD, -DAYS);
    const at = (day, h, m = 0) => {
      const x = S.addDays(startD, day);
      x.setHours(h, m, 0, 0);
      return x.toISOString();
    };
    const ctx = (userId, ts) => ({ userId, ts, silent: true });

    // Stock inicial
    B.forEach((bid, bi) => {
      d.products.forEach((p, pi) => {
        const qty = Math.round(p.maxStock * (bi === 0 ? 0.78 : bi === 1 ? 0.62 : 0.52));
        const exp = p.tracksLots ? S.dayKey(S.addDays(startD, Math.max(8, p._life + (pi % 7)))) : undefined;
        try {
          O.adjust(d, { bid, pid: p.id, counted: qty, note: 'Carga inicial de demostración', lot: p.tracksLots ? `L0-${bi + 1}-${pi + 1}` : undefined, exp }, ctx(admin.id, at(0, 6)));
        } catch {}
      });
    });

    // Simulación de ventas, reposiciones y transferencias
    const payments = ['CASH', 'CASH', 'CARD', 'CARD', 'TRANSFER', 'NEQUI'];
    const weighted = [];
    d.products.forEach((p) => { for (let k = 0; k < Math.max(1, p._pop); k++) weighted.push(p); });

    for (let day = 1; day <= DAYS; day++) {
      // Reposición periódica
      if (day % 6 === 0) {
        B.forEach((bid) => {
          const low = d.products.filter((p) => (d.stock[p.id + '|' + bid] || 0) <= p.minStock * 1.25).slice(0, 10);
          const bySup = new Map();
          low.forEach((p) => {
            if (!bySup.has(p.supplierId)) bySup.set(p.supplierId, []);
            bySup.get(p.supplierId).push(p);
          });
          bySup.forEach((list, supplierId) => {
            try {
              const items = list.map((p) => ({ pid: p.id, qty: Math.max(10, Math.round(p.maxStock * 0.65)), cost: p.lastCost }));
              const po = O.createPurchase(d, { supplierId, bid, items }, ctx(alm.id, at(day, 7)));
              O.approvePurchase(d, { id: po.id }, ctx(gerente.id, at(day, 8)));
              O.sendPurchase(d, { id: po.id }, ctx(gerente.id, at(day, 8, 15)));
              O.receivePurchase(d, {
                id: po.id,
                items: po.items.map((it) => {
                  const p = d.products.find((x) => x.id === it.pid);
                  return {
                    pid: it.pid,
                    qty: it.qty,
                    cost: it.cost,
                    lot: p.tracksLots ? `L${day}-${it.pid.slice(0, 4)}` : undefined,
                    exp: p.tracksLots ? S.dayKey(S.addDays(startD, day + Math.max(5, p._life))) : undefined,
                  };
                }),
              }, ctx(alm.id, at(day, 9)));
            } catch {}
          });
        });
      }

      // Ventas diarias por sede
      B.forEach((bid, bi) => {
        const count = day === DAYS ? Math.min(8, Math.max(2, Math.floor(nowD.getHours() / 2))) : Math.round((bi === 0 ? 11 : bi === 1 ? 8 : 6) * (0.8 + r() * 0.45));
        for (let k = 0; k < count; k++) {
          const hour = day === DAYS ? Math.min(Math.max(8, nowD.getHours()), 8 + k) : 8 + Math.floor(r() * 12);
          const ts = at(day, hour, Math.floor(r() * 59));
          const lines = new Map();
          const nItems = 1 + Math.floor(r() * 4);
          for (let j = 0; j < nItems; j++) {
            const p = pick(weighted);
            const avail = d.stock[p.id + '|' + bid] || 0;
            if (avail < 1) continue;
            const q = p.unit === 'kg' ? Math.min(avail, Number((0.5 + r() * 1.5).toFixed(2))) : Math.min(avail, 1 + Math.floor(r() * 3));
            lines.set(p.id, { pid: p.id, qty: q, discount: 0 });
          }
          if (!lines.size) continue;
          const payment = pick(payments);
          try {
            const items = [...lines.values()];
            const est = S.sum(items, (it) => d.products.find((p) => p.id === it.pid).price * it.qty);
            const received = payment === 'CASH' ? Math.ceil(est / 10000) * 10000 : undefined;
            const s = O.sale(d, { bid, items, customerId: r() < 0.22 ? pick(d.customers).id : null, payment, received }, ctx(cashier[bi], ts));
            if (r() < 0.004) O.voidSale(d, { id: s.id, reason: 'Error de digitación en la cantidad' }, ctx(sup.id, ts));
          } catch {}
        }
      });

      if (day === 20 || day === 34) {
        const items = d.products.filter((p) => !p.tracksLots && p._pop >= 5).slice(0, 4).map((p) => ({ pid: p.id, qty: 6 }));
        try {
          O.transfer(d, { from: B[0], to: B[2], items, note: 'Refuerzo de surtido para fin de semana' }, ctx(alm.id, at(day, 10)));
        } catch {}
      }
    }

    // Documentos en curso
    const t = (h) => at(DAYS, Math.min(h, Math.max(7, nowD.getHours())));
    const prodsOf = (s) => d.products.filter((p) => p.supplierId === s.id && p._pop > 0).slice(0, 3).map((p) => ({ pid: p.id, qty: p.unit === 'und' ? 24 : 15, cost: p.lastCost }));
    const g = d.suppliers;
    try {
      O.createPurchase(d, { supplierId: g[4].id, bid: B[0], items: prodsOf(g[4]), notes: 'Pedido quincenal de abarrotes' }, ctx(alm.id, t(8)));
      O.createPurchase(d, { supplierId: g[6].id, bid: B[1], items: prodsOf(g[6]) }, ctx(alm.id, t(9)));
      const ap = O.createPurchase(d, { supplierId: g[5].id, bid: B[2], items: prodsOf(g[5]) }, ctx(alm.id, at(DAYS - 2, 9)));
      O.approvePurchase(d, { id: ap.id }, ctx(gerente.id, at(DAYS - 1, 10)));
      const late = O.createPurchase(d, { supplierId: g[4].id, bid: B[1], items: prodsOf(g[4]), expectedAt: S.dayKey(S.addDays(nowD, -2)) }, ctx(alm.id, at(DAYS - 6, 9)));
      O.approvePurchase(d, { id: late.id }, ctx(gerente.id, at(DAYS - 6, 11)));
      O.sendPurchase(d, { id: late.id }, ctx(gerente.id, at(DAYS - 6, 12)));
    } catch {}

    d.products.forEach((p) => { delete p._life; delete p._pop; });
    return d;
  };
})();
