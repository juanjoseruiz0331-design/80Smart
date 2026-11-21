// Prueba de extremo a extremo de la versión HTML: node html/tests/e2e.mjs (requiere npm install y npx playwright install chromium).
import { chromium } from 'playwright';
const url = new URL('../index.html', import.meta.url).href;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
p.on('console', (m) => m.type() === 'error' && errs.push('CONSOLE ' + m.text()));
p.on('dialog', (d) => d.accept('Categoría E2E'));
let fails = 0;
const ok = (c, msg) => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + msg); };
const go = async (h) => { await p.evaluate((x) => (location.hash = x), h); await p.waitForTimeout(250); };
const login = async (email, pw = 'Smart80demo') => {
  await p.evaluate(() => { sessionStorage.clear(); location.hash = '#/login'; location.reload(); });
  await p.waitForSelector('#login');
  await p.fill('#login [name=email]', email);
  await p.fill('#login [name=password]', pw);
  await p.click('#login button.primary');
};
await p.goto(url);
await p.waitForSelector('#login', { timeout: 30000 });

// 1) Cajero: venta en POS
await login('cajero@80smart.demo');
await p.waitForSelector('#scan');
ok(p.url().includes('#/pos'), 'cajero entra directo al POS');
const navTxt = await p.locator('#nav').innerText();
ok(!/Dashboard|Auditoría|Usuarios/.test(navTxt), 'cajero no ve Dashboard/Auditoría/Usuarios en el menú');
await go('#/audit');
ok(!p.url().includes('audit'), 'cajero redirigido al intentar #/audit');
await go('#/pos');
const bc = await p.evaluate(() => S80.db.products.find((x) => !x.tracksLots && x.unit === 'und' && S80.getStock(x.id, S80.myBranches()[0].id) > 5).barcode);
const stockOf = (code) => p.evaluate((c) => { const x = S80.db.products.find((y) => y.barcode === c); return S80.getStock(x.id, S80.db.branches[0].id); }, code);
const stock0 = await stockOf(bc);
for (let i = 0; i < 2; i++) { await p.fill('#scan', bc); await p.press('#scan', 'Enter'); await p.waitForTimeout(150); }
const qty = await p.locator('[data-qty="0"]').inputValue();
ok(qty === '2', 'escanear dos veces suma 2 unidades (=' + qty + ')');
await p.click('[data-bill="exact"]');
await p.waitForTimeout(100);
await p.keyboard.press('F9');
await p.waitForSelector('.modal');
const saleNum = await p.evaluate(() => S80.db.sales[S80.db.sales.length - 1].number);
const stock1 = await stockOf(bc);
ok(stock1 === stock0 - 2, `stock descontado ${stock0} → ${stock1}`);
ok((await p.locator('.modal').innerText()).includes('NO es factura electrónica'), 'comprobante aclara que no es factura electrónica');
await p.keyboard.press('Escape');

// 2) Supervisor: anular la venta
await login('supervisor@80smart.demo');
await p.waitForSelector('#nav a');
const sid = await p.evaluate((n) => S80.db.sales.find((s) => s.number === n).id, saleNum);
await go('#/sales?id=' + sid);
await p.waitForSelector('#void');
await p.click('#void');
await p.fill('[data-reason]', 'Cliente desistió de la compra');
await p.click('[data-ok]');
await p.waitForTimeout(300);
const st = await p.evaluate((n) => S80.db.sales.find((s) => s.number === n).status, saleNum);
const stock2 = await stockOf(bc);
ok(st === 'VOID' && stock2 === stock0, `venta anulada y stock reintegrado (${stock2})`);

// 3) Orden interna: el creador no puede aprobar
await go('#/internal?new=1');
await p.waitForSelector('.modal #from');
await p.click('.modal [data-k="DEPARTMENT"]');
await p.selectOption('.modal #from', { index: 1 });
await p.selectOption('.modal #dep', 'CAFETERIA');
await p.fill('.modal [data-pick]', 'Arroz');
await p.press('.modal [data-pick]', 'Enter');
await p.waitForTimeout(100);
await p.click('.modal #ok');
await p.waitForTimeout(300);
const io = await p.evaluate(() => S80.db.internal[S80.db.internal.length - 1]);
ok(io && io.status === 'PENDING', 'orden interna creada ' + (io && io.number));
await go('#/internal?id=' + io.id);
await p.waitForSelector('.modal');
ok((await p.locator('.modal [data-act="approve"]').count()) === 0, 'creador no ve botón Aprobar (segregación)');
await p.keyboard.press('Escape');

// 4) Gerente: aprueba orden interna + compra completa
await login('gerente@80smart.demo');
await p.waitForSelector('#nav a');
await go('#/internal?id=' + io.id);
await p.waitForSelector('.modal [data-act="approve"]');
await p.click('.modal [data-act="approve"]');
await p.waitForTimeout(300);
ok((await p.evaluate((id) => S80.db.internal.find((o) => o.id === id).status, io.id)) === 'APPROVED', 'gerente aprobó la orden interna');
await go('#/purchases?new=1');
await p.waitForSelector('.modal #sup');
const supId = await p.evaluate(() => S80.db.suppliers[0].id);
await p.selectOption('.modal #sup', supId);
await p.selectOption('.modal #bid', { index: 1 });
const lotSku = await p.evaluate((s) => S80.db.products.find((x) => x.supplierId === s && x.tracksLots).sku, supId);
await p.fill('.modal [data-pick]', lotSku);
await p.press('.modal [data-pick]', 'Enter');
await p.waitForTimeout(100);
await p.fill('.modal [data-q="0"]', '10');
await p.press('.modal [data-q="0"]', 'Tab');
await p.click('.modal #ok');
await p.waitForTimeout(300);
const po = await p.evaluate(() => S80.db.purchases[S80.db.purchases.length - 1]);
ok(po.status === 'REQUESTED' && po.items[0].qty === 10, 'orden de compra creada ' + po.number);
await go('#/purchases?id=' + po.id);
await p.click('.modal [data-act="approve"]');
await p.waitForTimeout(250);
await go('#/purchases?id=' + po.id);
await p.click('.modal [data-act="send"]');
await p.click('[data-ok]');
await p.waitForTimeout(250);
await go('#/purchases?id=' + po.id);
await p.click('.modal [data-act="receive"]');
await p.waitForSelector('.modal [data-f="qty"]');
const poStock = () => p.evaluate((id) => { const o = S80.db.purchases.find((x) => x.id === id); return S80.getStock(o.items[0].pid, o.bid); }, po.id);
const before = await poStock();
await p.fill('.modal [data-f="qty"]', '8');
await p.click('.modal #ok');
await p.waitForTimeout(200);
ok((await p.locator('.modal .form-error').innerText().catch(() => '')).includes('lote'), 'exige lote y vencimiento para perecederos');
await p.fill('.modal [data-f="lot"]', 'E2E-01');
await p.fill('.modal [data-f="exp"]', '2027-01-15');
await p.click('.modal #ok');
await p.waitForTimeout(300);
const after = await p.evaluate((id) => { const o = S80.db.purchases.find((x) => x.id === id); return [o.status, o.receipts[0].lines[0].diff]; }, po.id);
const afterStock = await poStock();
ok(after[0] === 'PARTIAL' && afterStock === before + 8 && after[1] === -2, `recepción parcial: estado ${after[0]}, stock ${before}→${afterStock}, diferencia ${after[1]}`);

// 5) Admin: duplicado, conteo físico, consistencia, CSV
await login('admin@80smart.demo');
await p.waitForSelector('#nav a');
await go('#/products?new=1');
await p.waitForSelector('.modal #pf');
await p.fill('.modal [name=name]', 'Producto duplicado');
await p.fill('.modal [name=sku]', 'P1001');
await p.selectOption('.modal [name=categoryId]', { index: 1 });
await p.fill('.modal [name=cost]', '1000');
await p.fill('.modal [name=price]', '1500');
await p.click('.modal #psave');
await p.waitForTimeout(200);
ok((await p.locator('.modal #perr').innerText()).includes('SKU'), 'rechaza SKU duplicado');
await p.fill('.modal [name=sku]', 'E2E-NUEVO');
await p.click('.modal #psave');
await p.waitForTimeout(250);
ok(await p.evaluate(() => !!S80.db.products.find((x) => x.sku === 'E2E-NUEVO')), 'producto nuevo creado');
await go('#/inventory');
await p.click('[data-a="count"]');
await p.waitForSelector('.modal');
if (await p.locator('.modal #ok').count()) {
  await p.selectOption('.modal [name=categoryId]', { index: 5 });
  await p.click('.modal #ok');
}
await p.waitForSelector('.modal [data-pid]');
const pid = await p.locator('.modal [data-pid]').first().getAttribute('data-pid');
const cnt = await p.evaluate(() => S80.db.counts[S80.db.counts.length - 1]);
const sys = cnt.lines.find((l) => l.pid === pid).system;
await p.fill(`.modal [data-pid="${pid}"]`, String(sys + 3));
await p.press(`.modal [data-pid="${pid}"]`, 'Tab');
await p.click('.modal #apply');
await p.click('[data-ok]');
await p.waitForTimeout(400);
const c2 = await p.evaluate((id) => S80.db.counts.find((c) => c.id === id), cnt.id);
ok(c2.status === 'APPLIED' && c2.lines.find((l) => l.pid === pid).diff === 3, 'conteo aplicado con ajuste +3 (' + c2.status + ')');
const ledger = await p.evaluate(() => { const d = S80.db, s = {}; d.movements.forEach((m) => (s[m.pid + '|' + m.bid] = (s[m.pid + '|' + m.bid] || 0) + m.qty)); return Object.keys(d.stock).filter((k) => Math.abs((s[k] || 0) - d.stock[k]) > 1e-6).length; });
ok(ledger === 0, 'existencias = suma de movimientos (libro mayor consistente)');
const aud = await p.evaluate(() => S80.db.audit.filter((a) => ['sale.void', 'internal.approved', 'purchase.receive', 'count.apply', 'product.create'].includes(a.action)).length);
ok(aud >= 5, 'auditoría registró anulación, aprobación, recepción, conteo y producto (' + aud + ')');
const leak = await p.evaluate(() => JSON.stringify(S80.db.audit).match(/"(pw|hash|salt|password)"/));
ok(!leak, 'auditoría no contiene contraseñas ni hashes');
await go('#/reports?r=profit');
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#csv')]);
ok(/profit-.*\.csv/.test(dl.suggestedFilename()), 'reporte exporta CSV ' + dl.suggestedFilename());

// 6) Bloqueo tras 5 intentos
await p.evaluate(() => { sessionStorage.clear(); location.hash = '#/login'; location.reload(); });
await p.waitForSelector('#login');
for (let i = 0; i < 6; i++) {
  await p.fill('#login [name=email]', 'almacen@80smart.demo');
  await p.fill('#login [name=password]', 'Malaclave1');
  await p.click('#login button.primary');
  await p.waitForFunction(() => !document.querySelector('#login button.primary').disabled);
}
ok((await p.locator('#lerr').innerText()).includes('bloqueada'), 'cuenta bloqueada tras 5 intentos fallidos');

// 7) Registro de empresa nueva
await p.click('a[href="#/register"]');
await p.waitForSelector('#reg');
await p.fill('#reg [name=company]', 'Tienda Prueba HTML');
await p.fill('#reg [name=taxId]', '901999888-1');
await p.fill('#reg [name=name]', 'Dueña Prueba');
await p.fill('#reg [name=email]', 'duena@prueba.test');
await p.fill('#reg [name=password]', 'Prueba2026');
await p.fill('#reg [name=confirm]', 'Prueba2026');
await p.check('#reg [name=terms]');
await p.click('#reg button.primary');
await p.waitForSelector('#nav a');
const reg = await p.evaluate(() => ({ name: S80.db.company.name, plan: S80.db.company.plan, products: S80.db.products.length, demo: S80.db.company.isDemo, branches: S80.myBranches().length }));
ok(reg.name === 'Tienda Prueba HTML' && reg.plan === 'STARTER' && reg.products === 0 && !reg.demo, 'empresa nueva aislada: ' + JSON.stringify(reg));
const pwPlain = await p.evaluate(() => Object.keys(localStorage).some((k) => (localStorage.getItem(k) || '').includes('Prueba2026')));
ok(!pwPlain, 'la contraseña no se guarda en texto plano');
await go('#/dashboard');
await p.waitForTimeout(300);

console.log(`\n${fails} fallo(s)`);
console.log('ERRORS:', errs.length ? '\n' + errs.join('\n') : 'none');
await b.close();
