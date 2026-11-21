# 80 SMART — versión HTML (sin servidor)

Versión de 80 SMART hecha solo con **HTML, CSS y JavaScript**. No necesita Node.js, base de datos ni conexión a internet. Se abre con doble clic.

## Cómo abrirla

1. Abra la carpeta `html/`.
2. Haga **doble clic en `index.html`**. Se abre en su navegador (Chrome, Edge o Firefox actualizados).
3. La primera vez se crea la empresa de demostración; tarda unos segundos.
4. Ingrese con una cuenta demo (contraseña **`Smart80demo`**) o pulse **Regístrate** para crear su propia empresa.

| Correo | Rol |
|---|---|
| `admin@80smart.demo` | Administrador |
| `gerente@80smart.demo` | Gerente |
| `supervisor@80smart.demo` | Supervisor |
| `almacen@80smart.demo` | Almacén |
| `cajero@80smart.demo` | Cajero (Sede La 80) |

## Dónde se guardan los datos (importante)

Esta versión **no tiene servidor ni base de datos**. Todo se guarda en el almacenamiento local (`localStorage`) **de ese navegador, en ese equipo**:

- Otro equipo u otro navegador **no ve** los mismos datos.
- Si borra los datos de navegación, **se pierde la información**. Descargue respaldos frecuentes en *Configuración → Datos y respaldo*. El respaldo es un JSON y se puede restaurar.
- El espacio es limitado (unos 5–10 MB por navegador). La pantalla de respaldo muestra cuánto se usa.

Para una operación real con varios equipos y usuarios simultáneos, use la **versión con servidor** (carpetas `apps/api` y `apps/web`, PostgreSQL). Ver el [README principal](../README.md).

## Qué incluye

Los mismos módulos de la versión con servidor:

- **Dashboard**: ventas, utilidad bruta, comparación con el periodo anterior, inventario y alertas.
- **Productos**: alta y edición con margen calculado; importación CSV (si una fila falla no se importa nada) y exportación.
- **Inventario**:
  - Existencias por sucursal y movimientos (libro inmutable con saldo resultante).
  - Lotes con vencimiento y salidas FEFO.
  - Entradas, salidas con justificación, ajustes, transferencias entre sucursales y conteos físicos que no deshacen las ventas hechas durante el conteo.
- **Compras y proveedores**:
  - Flujo solicitud → aprobación → envío → recepción.
  - Recepción parcial con faltantes y sobrantes, lote y vencimiento.
  - Costo promedio ponderado e impresión de la orden.
- **Punto de venta**:
  - Lector de código de barras en modo teclado. `F2` busca, `F9` cobra y `Esc` inicia una venta nueva.
  - Efectivo con cálculo del cambio.
  - Comprobante imprimible de 80 mm.
- **Ventas**: anulación con motivo, que reintegra el inventario a los lotes originales.
- **Clientes**: autorización de datos (Ley 1581 de 2012) y datos enmascarados para los roles sin permiso de gestión.
- **Órdenes internas**: entre sucursales o para departamentos. Quien crea la solicitud no puede aprobarla.
- **Reportes**:
  - Nueve reportes exportables a CSV, y a PDF con *Imprimir → Guardar como PDF*.
  - Sugerencias de reposición que generan órdenes de compra, baja rotación, alertas de margen y variaciones de ventas. Son reglas explicadas en pantalla; no es IA.
- **Usuarios y roles**: permisos por módulo y por sucursal.
- **Auditoría**: valores anteriores y nuevos de cada operación.
- **Configuración**: datos de la empresa, sucursales y plan (con sus límites).

## Seguridad: qué protege y qué no

- Las contraseñas se guardan cifradas con **PBKDF2-SHA256** (120.000 iteraciones y sal aleatoria), nunca en texto plano.
- La cuenta se bloquea 15 minutos tras 5 intentos fallidos, y la sesión se cierra tras 30 minutos de inactividad.
- Los permisos se verifican en cada operación, no solo en el menú.
- Se escapa todo el texto que se muestra en pantalla. Hay una CSP estricta, sin scripts en línea ni conexiones externas.
- Las exportaciones CSV neutralizan las fórmulas (`= + - @`).

**Límite honesto:** sin servidor, quien tenga acceso a ese equipo y sepa usar las herramientas de desarrollo del navegador puede leer o modificar los datos guardados. Los roles y permisos ordenan el trabajo diario, pero no reemplazan la seguridad de un servidor. La versión con servidor sí aplica los permisos del lado del servidor.

## Qué no incluye (y no se simula)

- Envío de correos: la recuperación de contraseña la hace un administrador.
- Pasarela de pagos.
- Facturación electrónica DIAN. El comprobante dice explícitamente que no es factura electrónica.
- Integración directa con datáfonos, cajón monedero o impresoras ESC/POS. Se imprime con el diálogo del navegador.
- Registro de la IP en la auditoría (requiere servidor).

## Estructura

```
html/
├── index.html        punto de entrada (doble clic)
├── css/app.css       tema oscuro/claro
├── js/
│   ├── core.js       utilidades, almacenamiento, contraseñas, permisos, auditoría, motor de inventario
│   ├── ops.js        operaciones de negocio transaccionales
│   ├── seed.js       empresa de demostración (datos ficticios)
│   ├── ui.js         componentes: tablas, modales, gráficos SVG, CSV, impresión
│   ├── analytics.js  reglas de analítica
│   ├── app.js        sesión, enrutador, menú, búsqueda global, alertas
│   └── pages-*.js    módulos
└── tests/e2e.mjs     prueba de extremo a extremo (Playwright)
```

## Prueba automática

Desde la raíz del proyecto (requiere `npm install` y `npx playwright install chromium`):

```bash
node html/tests/e2e.mjs
```

Recorre los flujos principales:

- Venta en el POS y anulación.
- Orden interna con segregación de funciones.
- Compra con recepción parcial y lotes.
- SKU duplicado y conteo físico.
- Consistencia del libro de inventario y auditoría sin contraseñas.
- Exportación CSV, bloqueo por intentos fallidos y registro de una empresa nueva.
