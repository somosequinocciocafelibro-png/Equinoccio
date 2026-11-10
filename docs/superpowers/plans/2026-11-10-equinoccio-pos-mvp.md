# Equinoccio Ventas y Cierre de Caja (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir en `app/` la aplicación web con login, roles, cuentas por mesa, pagos divididos, servicio voluntario, cierre del día y reportes, que reemplaza al prototipo y al Excel.

**Architecture:** Next.js (App Router) con Server Actions. Las reglas de dinero viven una sola vez en `src/domain` (funciones puras). La capa `src/server` ejecuta esas reglas dentro de transacciones Postgres (`postgres` driver) con `SELECT … FOR UPDATE` sobre la cuenta; la base solo agrega restricciones (únicos, checks). Supabase Auth maneja el login; los roles están en la tabla `profiles`. Los tests de la capa de datos corren sobre PGlite con las mismas migraciones.

**Tech Stack:** Next.js, React, TypeScript (strict), Postgres en Supabase, `@supabase/ssr`, `postgres`, Vitest, `@electric-sql/pglite`, `xlsx`, Playwright (solo humo). Fijar versiones exactas en `package.json` al crear el proyecto.

**Spec:** `docs/superpowers/specs/2026-11-07-equinoccio-pos-mvp-design.md`. Referencia visual y de comportamiento: `docs/superpowers/reference/caja-equinoccio-prototype.html` (prototipo aprobado; copiar sus flujos, no su código).

## Global Constraints

- Código y tablas en inglés; textos de interfaz en español. Valores exactos: medios `efectivo`, `transferencia`, `bre_b`, `bold` (más `sin_medio` solo para importados); estados `abierto`, `cerrado`, `anulado`.
- Montos en pesos colombianos enteros, sin decimales. Zona horaria `America/Bogota`.
- Día de venta = fecha local de `cerrado_en` (`America/Bogota`).
- Servicio voluntario: 10% por defecto (configurable), sobre el subtotal (productos con extras), redondeado a $100; se congela con el primer pago; no es venta; sí entra en pagos y en el esperado del cierre.
- Nada se borra, solo se anula con motivo y usuario. Un producto se desactiva, no se borra.
- Una mesa tiene como máximo una cuenta abierta; "Para llevar" permite varias.
- Un pago no puede aplicarse por más del saldo; cobrar es idempotente.
- No se puede cerrar el día con cuentas abiertas; el día cerrado queda bloqueado; reabrir es solo admin con motivo.
- Roles: `caja` vende, cobra y cierra el día; `admin` además catálogo, reportes, anular y reabrir.
- Sin internet no se vende: la interfaz avisa y deshabilita las acciones.
- La app vive en `app/`. No se modifica `.github/workflows` (la lista de archivos que publica GitHub Pages no cambia). Nada de `app/` ni `docs/` se publica en equinoccio.online.
- Secretos solo como variables de entorno en Vercel; `app/.gitignore` los excluye. El Excel real y datos de ventas nunca se suben al repositorio.
- Todo el trabajo va en ramas con pull request; un push a `main` vuelve a publicar el sitio web.

## Review Focus

1. Doble clic o reintento de "Registrar pago" no duplica el pago ni cambia el saldo → Tareas 7 y 10.
2. Dos personas agregando productos a la misma cuenta a la vez no pierden líneas (el prototipo sí las perdía) → Tarea 7.
3. Una venta cerrada a las 23:30 en Bogotá (04:30 UTC del día siguiente) cae en el día correcto → Tarea 3.
4. Cambiar el precio o desactivar un producto no altera cuentas ya hechas → Tareas 4 y 7.
5. Una cuenta anulada con pagos parciales no suma en el esperado del cierre ni en ventas → Tareas 3 y 7.

---

## File Structure

```
app/
  package.json, tsconfig.json, next.config.ts, vitest.config.ts, .gitignore, .env.example, README.md
  db/migrations/001_init.sql          esquema y restricciones
  db/seed/catalog.ts                  salones, mesas, extras, productos, ajustes iniciales
  src/domain/{types,money,day,cierre,reports}.ts   reglas puras
  src/server/{db,auth,closings,tickets,catalog}.ts  transacciones y permisos
  src/app/…                           pantallas (mesas, ticket, cierre, reportes, catalogo, login)
  scripts/{import-excel,export-csv}.ts
  tests/…                             un archivo de test por módulo
```

---

### Task 1: Esqueleto de `app/`

**Files:**
- Create: `app/package.json`, `app/tsconfig.json`, `app/next.config.ts`, `app/vitest.config.ts`, `app/.gitignore`, `app/.env.example`, `app/README.md`, `app/src/app/layout.tsx`, `app/src/app/page.tsx`
- Test: `app/tests/smoke.test.ts`

**Interfaces:**
- Produces: scripts `npm run dev | build | test | lint`; variables en `.env.example`: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 1:** Crear el proyecto Next.js con TypeScript estricto, Vitest y ESLint. `app/.gitignore` excluye `node_modules`, `.next`, `.env*` (menos `.env.example`).
- [ ] **Step 2:** Test `smoke.test.ts`: `expect(1 + 1).toBe(2)`. Ejecutar `cd app && npm test`. Esperado: PASS.
- [ ] **Step 3:** Ejecutar `cd app && npm run build`. Esperado: build sin errores.
- [ ] **Step 4:** Verificar que el workflow del sitio no cambió: `git diff origin/main -- .github` no imprime nada.
- [ ] **Step 5:** Commit `chore: esqueleto de app/`.

### Task 2: Reglas de dinero

**Files:** Create `app/src/domain/types.ts`, `app/src/domain/money.ts`. Test `app/tests/domain/money.test.ts`.

**Interfaces:**
- Produces (`types.ts`): `Medio = 'efectivo'|'transferencia'|'bre_b'|'bold'`, `PaymentMedio = Medio|'sin_medio'`, `TicketStatus`, `Extra {id,name,delta}`, `Line {id,productId,name,unitPrice,qty,extras:Extra[]}`, `Payment {id,medio:PaymentMedio,received,applied,createdAt}`, `Service {enabled:boolean,custom:number|null,frozenAmount:number|null}`, `Ticket {id,tableId,salon:string|null,tableName,status,openedAt,closedAt:string|null,lines,payments,service,voidReason:string|null}` (fechas ISO).
- Produces (`money.ts`): `lineTotal(l: Line): number`; `subtotal(t: Ticket): number`; `serviceAmount(t: Ticket, pct: number): number`; `total(t: Ticket, pct: number): number`; `balance(t: Ticket, pct: number): number`; `planPayment(t: Ticket, pct: number, i: {medio: Medio; amount: number|null; received: number|null}): {ok:true; applied:number; received:number; change:number} | {ok:false; error:'AMOUNT_ZERO'|'EXCEEDS_BALANCE'|'CASH_SHORT'|'EMPTY_TICKET'}`.

- [ ] **Step 1: Tests que fallan** (nombres y valores):
  - `subtotal suma qty × (unitPrice + extras)`: líneas `{qty:2,unit:8000}` y `{qty:1,unit:9000,extra +500}` → 25500.
  - `serviceAmount es 10% redondeado a 100`: 25500 y pct 10 → 2600. Con subtotal 0 → 0.
  - `serviceAmount es 0 si enabled=false`; `serviceAmount usa custom`: 3000 → total 28500.
  - `serviceAmount congelado tras el primer pago`: `frozenAmount 2600` y pct 0 → 2600.
  - `ticket cerrado sin frozenAmount tiene servicio 0`.
  - `total = subtotal + servicio` → 28100; `balance` descuenta `applied`.
  - `planPayment` sin monto usa el saldo; `EXCEEDS_BALANCE` si amount 30000 con saldo 28100; `AMOUNT_ZERO`; `CASH_SHORT` si efectivo recibido < monto; medios no efectivo ignoran `received`; efectivo 50000 por 28100 → `change` 21900; `EMPTY_TICKET` si no hay líneas.
- [ ] **Step 2:** Ejecutar `cd app && npx vitest run tests/domain/money.test.ts`. Esperado: FAIL, módulo no existe.
- [ ] **Step 3:** Implementar las funciones con las firmas de arriba; redondeo `Math.round(subtotal * pct / 10000) * 100`.
- [ ] **Step 4:** Ejecutar el mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(domain): reglas de dinero y servicio`.

### Task 3: Día de venta y cierre de caja

**Files:** Create `app/src/domain/day.ts`, `app/src/domain/cierre.ts`. Test `app/tests/domain/cierre.test.ts`.

**Interfaces:**
- Consumes: `Ticket`, `Medio`, `subtotal`, `serviceAmount` (se llama con `pct = 0`: las cuentas cerradas usan su servicio congelado).
- Produces: `businessDay(iso: string): string` (`YYYY-MM-DD`); `expectedByMedio(tickets: Ticket[], day: string, base: number): Record<Medio, number>`; `computeClosing(i: {day:string; tickets:Ticket[]; base:number; real:Partial<Record<Medio, number|null>>; note:string; openTicketsCount:number}): {rows:{medio:Medio;expected:number;real:number|null;diff:number|null}[]; hasDiff:boolean; canClose:boolean; reason:'OPEN_TICKETS'|'CASH_REQUIRED'|'NOTE_REQUIRED'|null; sales:number; service:number; ticketCount:number}`.

- [ ] **Step 1: Tests que fallan:**
  - `businessDay('2026-11-09T04:30:00Z')` → `'2026-11-08'` (foco 3); `businessDay('2026-11-09T05:00:00Z')` → `'2026-11-09'`.
  - `expectedByMedio` cuenta solo tickets `cerrado` cuyo `businessDay(closedAt)` es el día; el efectivo incluye la base; el servicio ya va en los pagos.
  - Un ticket `anulado` con pago parcial no suma en ningún medio (foco 5); un `abierto` tampoco.
  - `computeClosing`: `reason 'OPEN_TICKETS'` si `openTicketsCount > 0`; `'CASH_REQUIRED'` si `real.efectivo` es null; `'NOTE_REQUIRED'` si hay diferencia y la nota está vacía; `canClose` true si todo cuadra; medios opcionales sin valor dan `diff null`.
  - Día sin ventas: efectivo esperado = base; `sales 0`, `ticketCount 0`; `sales` suma subtotales y `service` suma servicios.
- [ ] **Step 2:** `npx vitest run tests/domain/cierre.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar. `businessDay` con `Intl.DateTimeFormat('en-CA', {timeZone: 'America/Bogota'})`.
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(domain): día de venta y cierre de caja`.

### Task 4: Reportes

**Files:** Create `app/src/domain/reports.ts`. Test `app/tests/domain/reports.test.ts`.

**Interfaces:**
- Consumes: `Ticket`, `subtotal`, `serviceAmount` (con `pct = 0`, por la misma razón), `businessDay`.
- Produces: `reportSales(tickets: Ticket[], range: {from: string; to: string}): {sales:number; service:number; count:number; avg:number; byMedio:Record<PaymentMedio,number>; byDay:{day:string;sales:number}[]; byProduct:{productId:string;name:string;qty:number;sales:number}[]; bySalon:{salon:string;sales:number}[]; byTable:{table:string;sales:number}[]}`.

- [ ] **Step 1: Tests que fallan:**
  - Solo cuentan tickets `cerrado` dentro del rango (inclusive); `abierto` y `anulado` quedan fuera.
  - `sales` usa el subtotal; el servicio va aparte en `service`; `byMedio` incluye el servicio y el bucket `sin_medio`.
  - `byDay` en orden ascendente; `byProduct` agrupa por `productId` y usa `unitPrice` de la línea (una cuenta antigua con precio viejo no cambia, foco 4); `bySalon` usa `'Sin salón'` si es null.
  - `avg` = `sales / count` redondeado, 0 si no hay cuentas.
- [ ] **Step 2:** `npx vitest run tests/domain/reports.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar con una sola pasada por los tickets.
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(domain): reportes de ventas`.

### Task 5: Esquema de base de datos y semilla

**Files:** Create `app/db/migrations/001_init.sql`, `app/db/seed/catalog.ts`, `app/src/server/db.ts`, `app/tests/helpers/testDb.ts`. Test `app/tests/server/schema.test.ts`.

**Interfaces:**
- Produces (`db.ts`): `interface Db { query<T>(sql: string, params?: unknown[]): Promise<T[]>; tx<R>(fn: (t: Db) => Promise<R>): Promise<R> }` y `createDb(url: string): Db` (driver `postgres`).
- Produces (`testDb.ts`): `makeTestDb(): Promise<Db>` (PGlite con la migración y la semilla aplicadas) y `seedTicket(db: Db, spec: {tableId: string; status: TicketStatus; closedAt?: string; lines?: {productId: string; qty: number; unitPrice?: number}[]; payments?: {medio: PaymentMedio; applied: number}[]}): Promise<string>`.
- Tablas: `profiles(user_id, role)`, `settings(service_pct)`, `dining_tables(id, name, salon, capacity, active, is_takeout, sort)`, `products(id, name unique, category, price, active, sort)`, `extras(id, name, delta, active)`, `tickets(id, table_id, table_name, salon, is_takeout, status, opened_at, closed_at, service_enabled, service_custom, service_frozen, void_reason, voided_by, voided_at)`, `ticket_lines(id, ticket_id, product_id, name, unit_price, qty, extras jsonb)`, `payments(id, ticket_id, medio, received, applied, idempotency_key unique, created_by, created_at)`, `day_closings(day pk, base, expected jsonb, real jsonb, diff jsonb, sales, service, ticket_count, note, closed_by, closed_at, locked, reopened jsonb)`.

- [ ] **Step 1: Tests que fallan:**
  - La migración aplica sobre base vacía.
  - Índice único parcial: dos tickets `abierto` en la misma mesa no takeout fallan; en una mesa takeout se permiten.
  - `payments.idempotency_key` repetido falla; `applied <= 0` y `qty <= 0` fallan por check; `medio` fuera de la lista (más `sin_medio`) falla.
  - Semilla: 13 mesas (Luna: Mesa 1, 2, 3, Barra; Equinoccio: Mesa 1 a 4; Sol: Mesa 1, 2, 3, Barra; Para llevar), 2 extras (Vainilla +500, Caramelo +0), 43 productos, `service_pct = 10`. Los productos y precios salen de la colección `products` del prototipo (exportar con la herramienta de datos del artifact).
- [ ] **Step 2:** `npx vitest run tests/server/schema.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Escribir migración, semilla, `createDb` y los helpers. RLS activado y sin políticas para `anon` (el acceso es solo por el servidor).
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(db): esquema, restricciones y semilla`.

### Task 6: Cierres de día en el servidor

**Files:** Create `app/src/server/closings.ts`. Test `app/tests/server/closings.test.ts`.

**Interfaces:**
- Consumes: `Db`, `seedTicket`, `computeClosing`, `Ticket`.
- Produces: `loadTickets(db: Db, f: {ids?: string[]; status?: TicketStatus; closedDay?: string; from?: string; to?: string}): Promise<Ticket[]>`; `isDayClosed(db: Db, day: string): Promise<boolean>`; `closeDay(db: Db, a: {day: string; base: number; real: Partial<Record<Medio, number|null>>; note: string; userId: string}): Promise<void>`; `reopenDay(db: Db, a: {day: string; reason: string; userId: string}): Promise<void>`. Errores como `Error` con `.code`: `OPEN_TICKETS`, `CASH_REQUIRED`, `NOTE_REQUIRED`, `ALREADY_CLOSED`, `REASON_REQUIRED`, `NOT_CLOSED`.

- [ ] **Step 1: Tests que fallan:** `closeDay` rechaza con `OPEN_TICKETS` si hay cuentas abiertas; guarda esperado, real, diferencia, ventas y servicio; rechaza un segundo cierre del mismo día con `ALREADY_CLOSED`; `isDayClosed` es true tras cerrar y false tras `reopenDay`; `reopenDay` sin motivo da `REASON_REQUIRED` y con motivo deja una entrada en `reopened`; una cuenta anulada con pagos parciales no entra en el esperado (foco 5); `loadTickets` con `closedDay` usa `businessDay` en Bogotá.
- [ ] **Step 2:** `npx vitest run tests/server/closings.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `loadTickets` (mapea filas a `Ticket`) y las tres operaciones dentro de `db.tx`, usando `computeClosing`.
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(server): cierre y reapertura de día`.

### Task 7: Cuentas y pagos en el servidor

**Files:** Create `app/src/server/tickets.ts`. Test `app/tests/server/tickets.test.ts`.

**Interfaces:**
- Consumes: `Db`, `loadTickets`, `isDayClosed`, `planPayment`, `serviceAmount`.
- Produces: `openTicket(db, a: {tableId: string; userId: string}): Promise<string>` (devuelve la cuenta abierta existente de una mesa no takeout); `addLine(db, a: {ticketId: string; productId: string; qty: number}): Promise<void>`; `setLineQty(db, a: {lineId: string; qty: number}): Promise<void>` (qty 0 borra la línea); `toggleExtra(db, a: {lineId: string; extraId: string}): Promise<void>`; `setService(db, a: {ticketId: string; enabled: boolean; custom: number|null}): Promise<void>`; `addPayment(db, a: {ticketId: string; medio: Medio; amount: number|null; received: number|null; idempotencyKey: string; userId: string}): Promise<{paymentId: string; change: number; closed: boolean}>`; `removePayment(db, a: {paymentId: string}): Promise<void>`; `voidTicket(db, a: {ticketId: string; reason: string; userId: string}): Promise<void>`. Errores `.code`: `SERVICE_LOCKED`, `DAY_CLOSED`, `TICKET_NOT_OPEN`, `REASON_REQUIRED`, más los de `planPayment`.

- [ ] **Step 1: Tests que fallan:**
  - `openTicket` devuelve el mismo id para la misma mesa y crea uno nuevo en cada llamada para takeout.
  - `addLine` suma qty en la misma línea sin extras y guarda `unit_price` del momento; cambiar el precio del producto después no altera la línea (foco 4).
  - Dos sesiones que agregan productos distintos a la misma cuenta dejan ambas líneas guardadas (foco 2; las operaciones son por fila, no reescriben la cuenta entera).
  - `toggleExtra` agrega y quita con su delta; `setLineQty` en 0 elimina la línea.
  - `setService` después del primer pago lanza `SERVICE_LOCKED`.
  - `addPayment` con la misma `idempotencyKey` dos veces devuelve el mismo `paymentId` y deja el saldo igual (foco 1); congela el servicio en el primer pago; cierra la cuenta cuando el saldo llega a 0 (fija `closed_at`); devuelve `change` en efectivo; rechaza `EMPTY_TICKET`, `EXCEEDS_BALANCE` y, si el día está cerrado, `DAY_CLOSED`.
  - `removePayment` solo en cuenta `abierto`; `voidTicket` exige motivo, guarda usuario y fecha, y deja los pagos sin contar en `loadTickets({status:'cerrado'})` (foco 5).
- [ ] **Step 2:** `npx vitest run tests/server/tickets.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar cada función en `db.tx`, con `SELECT … FOR UPDATE` sobre la fila de la cuenta en `addPayment`, `setService` y `voidTicket`; reutilizar `planPayment`, sin duplicar reglas en SQL.
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(server): cuentas, líneas, pagos y anulaciones`.

### Task 8: Login y roles

**Files:** Create `app/src/server/auth.ts`, `app/src/app/login/page.tsx`, `app/src/middleware.ts`. Test `app/tests/server/auth.test.ts`.

**Interfaces:**
- Produces: `type Role = 'caja'|'admin'`; `type Action = 'sell'|'charge'|'closeDay'|'viewReports'|'editCatalog'|'void'|'reopenDay'`; `canAccess(role: Role|null, action: Action): boolean`; `requireRole(action: Action): Promise<{userId: string; role: Role}>` (redirige a `/login` o responde 403).

- [ ] **Step 1: Tests que fallan:** matriz de `canAccess`: `caja` puede `sell`, `charge`, `closeDay`; `caja` no puede `viewReports`, `editCatalog`, `void`, `reopenDay`; `admin` puede todo; `null` no puede nada.
- [ ] **Step 2:** `npx vitest run tests/server/auth.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `canAccess`; `requireRole` lee la sesión de Supabase con `@supabase/ssr` y el rol de `profiles`; `middleware.ts` redirige a `/login` cuando no hay sesión; la página de login es correo y contraseña.
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(auth): login y roles caja/admin`.

### Task 9: Pantallas de mesas y cuenta

**Files:** Create `app/src/app/mesas/page.tsx`, `app/src/app/mesas/[tableId]/page.tsx`, `app/src/app/mesas/actions.ts`, `app/src/lib/parseSearch.ts`, `app/src/lib/useOnline.ts`. Test `app/tests/ui/parseSearch.test.ts`, `app/tests/ui/useOnline.test.tsx`.

**Interfaces:**
- Consumes: `requireRole`, `openTicket`, `addLine`, `setLineQty`, `toggleExtra`, `loadTickets`.
- Produces: `parseSearch(q: string): {qty: number; text: string}`; `useOnline(): boolean`; Server Actions `addLineAction(formData)`, `setQtyAction(formData)`, `toggleExtraAction(formData)`, todas con `requireRole('sell')`.

- [ ] **Step 1: Tests que fallan:** `parseSearch('3 latte')`, `'3*latte'` y `'3x latte'` → `{qty:3,text:'latte'}`; `'latte'` → `{qty:1,text:'latte'}`; `'100 latte'` → `{qty:1,text:'100 latte'}` (máximo dos dígitos). `useOnline` pasa a false con el evento `offline` y los botones de venta quedan deshabilitados.
- [ ] **Step 2:** `npx vitest run tests/ui`. Esperado: FAIL.
- [ ] **Step 3:** Implementar los helpers. La página de mesas agrupa por salón (Luna, Equinoccio, Sol, Para llevar) y muestra el resumen de hoy; la página de cuenta tiene buscador con Enter, chips de categoría, líneas con cantidad y extras; mismo comportamiento que el prototipo. Aviso fijo cuando `useOnline()` es false.
- [ ] **Step 4:** Mismo comando. Esperado: PASS. Revisar las pantallas con `npm run dev` y confirmar que el flujo coincide con el prototipo.
- [ ] **Step 5:** Commit `feat(ui): mesas por salón y pantalla de cuenta`.

### Task 10: Cobro con servicio y pagos divididos

**Files:** Create `app/src/app/mesas/[tableId]/cobro.tsx`, `app/src/app/mesas/actions.ts` (agregar acciones). Test `app/tests/ui/cobro.test.tsx`.

**Interfaces:**
- Consumes: `planPayment`, `serviceAmount`, `total`, `setService`, `addPayment`.
- Produces: componente `PaymentPanel({ticket, pct}: {ticket: Ticket; pct: number})`; acciones `setServiceAction`, `addPaymentAction` (genera `idempotencyKey` por intento en el cliente), ambas con `requireRole('charge')`.

- [ ] **Step 1: Tests que fallan:** el servicio aparece activado con el valor sugerido; desactivarlo o escribir otro valor recalcula el total; con efectivo recibido mayor al monto muestra el cambio; "Registrar pago" llamado dos veces seguidas envía una sola acción con la misma `idempotencyKey` (foco 1); el servicio queda de solo lectura una vez existe un pago.
- [ ] **Step 2:** `npx vitest run tests/ui/cobro.test.tsx`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `PaymentPanel` con las reglas de `src/domain` solo para mostrar; la decisión final la toma el servidor. Al cerrar la cuenta, mostrar el cambio a devolver.
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(ui): cobro con servicio y pagos divididos`.

### Task 11: Cierre del día, anular y reabrir

**Files:** Create `app/src/app/cierre/page.tsx`, `app/src/app/cierre/actions.ts`. Test `app/tests/ui/cierre.test.tsx`.

**Interfaces:**
- Consumes: `computeClosing`, `closeDay`, `reopenDay`, `voidTicket`, `loadTickets`.
- Produces: acciones `closeDayAction` (`closeDay` permitido a caja), `reopenDayAction` y `voidTicketAction` (solo `admin`, motivo obligatorio).

- [ ] **Step 1: Tests que fallan:** el botón "Cerrar día" queda deshabilitado con el mensaje correcto para `OPEN_TICKETS`, `CASH_REQUIRED` y `NOTE_REQUIRED`; las diferencias se muestran por medio; un día cerrado muestra el resumen, el servicio recaudado y solo ofrece reabrir a admin.
- [ ] **Step 2:** `npx vitest run tests/ui/cierre.test.tsx`. Esperado: FAIL.
- [ ] **Step 3:** Implementar la pantalla replicando el prototipo: base de caja, esperado/real/diferencia, nota, lista de cuentas del día con anular.
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(ui): cierre del día, anulación y reapertura`.

### Task 12: Reportes y catálogo (admin)

**Files:** Create `app/src/server/catalog.ts`, `app/src/app/reportes/page.tsx`, `app/src/app/catalogo/page.tsx`. Test `app/tests/server/catalog.test.ts`.

**Interfaces:**
- Consumes: `reportSales`, `loadTickets`, `requireRole`.
- Produces: `upsertProduct(db, p: {id?: string; name: string; category: string; price: number; active: boolean}): Promise<string>`; `setProductActive(db, id: string, active: boolean): Promise<void>`; `upsertExtra`, `upsertTable`, `setServicePct(db, pct: number): Promise<void>`. No existe función para borrar productos.

- [ ] **Step 1: Tests que fallan:** nombre duplicado de producto lanza `NAME_TAKEN`; `setProductActive(false)` mantiene el producto y las cuentas pasadas (foco 4); editar el precio no cambia `unit_price` de líneas existentes; `setServicePct` rechaza valores fuera de 0–30.
- [ ] **Step 2:** `npx vitest run tests/server/catalog.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar `catalog.ts`; las páginas de reportes y catálogo exigen `viewReports` y `editCatalog`. Reportes con rangos Hoy, 7 días, 30 días y Todo, y las tarjetas por medio, salón, mesa y producto del prototipo.
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat: reportes y catálogo para admin`.

### Task 13: Importación del Excel

**Files:** Create `app/scripts/import-excel.ts`, `app/import/equivalences.csv`. Test `app/tests/server/importExcel.test.ts` (libro generado en el test, nunca el real).

**Interfaces:**
- Produces: `parseWorkbook(path: string): {tickets: ImportTicket[]; discarded: {row: number; reason: string}[]}` y `importTickets(db: Db, tickets: ImportTicket[], eq: Record<string, string>, opts: {dryRun: boolean}): Promise<{imported: number; unmappedProducts: string[]; sinMedio: number; ambiguousDates: string[]}>`; comando `npm run import -- <ruta.xlsx> [--apply]` (por defecto simulación).

- [ ] **Step 1: Tests que fallan:** cada bloque de mesa del libro de ejemplo se convierte en una cuenta `cerrado`; "Capuchino", "Capuccino" y "Cappuccino" se unifican por `equivalences.csv`; la forma de pago vacía queda como `sin_medio` y nunca se adivina; filas con $0, filas vacías y totales manuales sin líneas se descartan y se reportan; las fechas ambiguas se listan; un nombre sin equivalencia aparece en `unmappedProducts` y no se importa.
- [ ] **Step 2:** `npx vitest run tests/server/importExcel.test.ts`. Esperado: FAIL.
- [ ] **Step 3:** Implementar con la librería `xlsx`. La simulación imprime el informe sin escribir; `--apply` escribe. Revisar `equivalences.csv` con el dueño antes de aplicar.
- [ ] **Step 4:** Mismo comando. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(import): importación del Excel con simulación`.

### Task 14: Despliegue, respaldo y piloto

**Files:** Create `app/scripts/export-csv.ts`, `app/e2e/sale-flow.spec.ts`; Modify `app/README.md`.

**Requisitos previos (los aporta el dueño):** proyecto Supabase, proyecto Vercel con directorio raíz `app/`, y acceso al DNS de DreamHost.

- [ ] **Step 1:** En Supabase, aplicar `001_init.sql` y la semilla; crear los usuarios (correo y contraseña) y sus filas en `profiles` con rol `caja` o `admin`.
- [ ] **Step 2:** En Vercel, configurar `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; desplegar la rama como vista previa.
- [ ] **Step 3:** Escribir `e2e/sale-flow.spec.ts` (Playwright, contra la vista previa): iniciar sesión como caja, abrir una mesa, agregar dos productos, cobrar con servicio y pago dividido en dos medios, cerrar la cuenta; esperado: cuenta cerrada y saldo 0.
- [ ] **Step 4:** Ejecutar `npx playwright test --trace off`. Esperado: PASS.
- [ ] **Step 5:** Crear `scripts/export-csv.ts` (`npm run export` escribe CSV de cuentas y pagos en la carpeta indicada) y documentar en `app/README.md` el respaldo automático de Supabase y esta exportación manual semanal.
- [ ] **Step 6:** En DreamHost, crear el CNAME de `caja.equinoccio.online` con el valor que indique Vercel; agregar el dominio en Vercel y verificar HTTPS.
- [ ] **Step 7:** Verificar `git diff origin/main -- .github` vacío, y que `https://equinoccio.online` sigue igual.
- [ ] **Step 8:** Piloto de una semana: la caja usa la app y el Excel sigue en paralelo; cada día comparar los totales y registrar diferencias. Criterio de éxito: totales diarios iguales y cierre sin cuadrar a mano.
- [ ] **Step 9:** Commit `docs: despliegue, respaldo y guía del piloto`.
