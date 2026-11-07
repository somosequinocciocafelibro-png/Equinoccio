# Equinoccio: Ventas y Cierre de Caja (Pieza 1, MVP) — Diseño

Fecha: 2026-11-07

## 1. Contexto y objetivo

Equinoccio (café-libro) lleva hoy sus ventas en un Excel ("Contabilidad Equinoccio.xlsx", una sola hoja). Cada bloque es un ticket por mesa con producto, cantidad, valor unitario, total y una columna suelta de forma de pago. Problemas observados:

- Fechas mal etiquetadas ("Total ventas 04/11" aparece dos veces con $144.000 y $146.000).
- Nombres de producto inconsistentes (Capuchino / Capuccino / Cappuccino), lo que impide reportes por producto.
- La forma de pago es una columna suelta ("Efectivo", "efectivo", vacío y "Bold", que es un medio de pago real, el datáfono). Solo cabe un medio por ticket y muchos tickets no dicen cómo se pagaron.
- Precios variables sin modelar (cappuccino + vainilla, latte + caramelo).
- Totales escritos a mano y filas vacías con $0.
- No hay gastos, compras, costos ni inventario.

**Objetivo:** una herramienta interna que reemplace el Excel para registrar ventas y cerrar la caja del día con datos limpios, y que sirva de base para gastos (pieza 2) e inventario con recetas (pieza 3).

**Éxito del MVP:** durante un piloto de una semana, los totales diarios del sistema coinciden con los del Excel llevado en paralelo, y la persona en caja puede atender y cerrar el día sin cuadrar nada a mano.

## 2. Descomposición del proyecto

| # | Pieza | Estado |
|---|---|---|
| 1 | Catálogo, ventas y cierre de caja | **Este documento** |
| 2 | Compras y gastos (utilidad real) | Fuera de alcance, diseño propio después |
| 3 | Inventario y recetas | Fuera de alcance, diseño propio después |

La pieza 1 debe dejar espacio para las otras dos sin implementarlas.

## 3. Decisiones acordadas

- **Usuario en caja:** una sola persona captura todos los pedidos, en computador o tablet fija. Se prioriza velocidad con teclado.
- **Flujo de cuentas:** mixto. Hay cuentas abiertas por mesa (se agregan productos durante la visita y se cobra al final) y venta rápida con pago al pedir.
- **Medios de pago:** efectivo, transferencia (Bancolombia), Bre-B y Bold (datáfono).
- **Pagos divididos:** frecuentes. Un ticket puede pagarse con varios medios.
- **Propinas:** fuera del sistema; se entregan aparte y la caja no las toca.
- **Conectividad:** internet confiable. Aplicación web en la nube, sin modo sin conexión.
- **Enfoque técnico:** aplicación web propia (no Google Sheets ni POS comercial).

## 4. Alcance del MVP

**Incluido:**
- Catálogo de productos (categoría, precio fijo, activo/inactivo).
- Mesas (Sol, Luna, Equinoccio) y "Para llevar / pago inmediato".
- Tickets con líneas y extras.
- Pagos múltiples por ticket.
- Cierre de caja diario.
- Reportes: ventas por día, por producto, por mesa y por medio de pago.
- Importación única del Excel histórico.
- Login con dos roles (caja y admin).

**Fuera del MVP:** gastos y compras, inventario y recetas, propinas, facturación electrónica, modo sin conexión, conciliación de abonos de Bold con su comisión, cruce contra el extracto bancario completo, múltiples usuarios simultáneos de caja.

## 5. Pantallas

1. **Mesas:** tablero con las mesas y la venta rápida. Muestra cuáles tienen cuenta abierta y su total acumulado.
2. **Ticket:** buscador rápido de productos, cantidades, extras, total y botón de cobrar. Pantalla principal de uso diario; debe operarse con teclado.
3. **Cobro:** agregar uno o varios pagos, con saldo pendiente visible y cambio a devolver cuando el pago en efectivo excede el saldo.
4. **Cierre del día:** resumen esperado por medio de pago, campos de valores reales, diferencias y notas.
5. **Reportes y catálogo (admin):** consulta de reportes y mantenimiento de productos y mesas.

## 6. Modelo de datos

| Tabla | Campos principales | Reglas |
|---|---|---|
| **Producto** | nombre (único), categoría, precio (COP entero), activo | Se desactiva, no se borra. |
| **Mesa** | nombre, activa | Se pueden agregar o quitar mesas sin cambiar código. |
| **Ticket** | mesa, estado (abierto / cerrado / anulado), abierto_en, cerrado_en, total, motivo_anulación, anulado_por | Una mesa tiene como máximo un ticket abierto. El día de venta es la fecha local (America/Bogota) de `cerrado_en`. |
| **LíneaTicket** | ticket, producto, cantidad, precio_unitario, extras (lista de {nombre, diferencia_precio}) | Guarda el precio del momento. Cambiar el catálogo no altera ventas pasadas. |
| **Pago** | ticket, medio (efectivo / transferencia / bre_b / bold), monto_recibido, monto_aplicado, creado_en | `monto_aplicado` ≤ saldo. Para efectivo, `monto_recibido` puede exceder el saldo (cambio). El ticket se cierra cuando la suma de `monto_aplicado` iguala el total. |
| **CierreDía** | fecha (única), base_caja, esperado y real por medio, diferencia por medio, notas, cerrado_por | Una vez creado, el día queda bloqueado. |

**Reglas transversales:**
- **Nada se borra, solo se anula**, con motivo y usuario registrados.
- Montos en pesos enteros, sin decimales.
- **Extras** (vainilla, caramelo, bocadillo) se guardan como lista dentro de la línea, no como productos aparte, para que "Cappuccino + vainilla" cuente como cappuccino en reportes y cobre el precio correcto.
- **Preparado para crecer:** un producto podrá tener receta (pieza 3) y las compras entrarán como tablas nuevas (pieza 2) sin modificar las anteriores.

## 6.1 Importación del Excel

- Cada bloque de mesa del Excel se convierte en un ticket cerrado.
- Los nombres de producto se unifican con una tabla de equivalencias que se revisa con el dueño antes de importar.
- Los tickets sin forma de pago clara quedan con medio "sin_medio" para corrección manual; no se adivina.
- Las filas con $0, las filas vacías y los totales manuales sin líneas se descartan o se reportan, nunca se importan como ventas.
- Las fechas ambiguas (por ejemplo el "04/11" duplicado) se listan para que el dueño las resuelva.
- La importación se ejecuta una sola vez y es repetible en un entorno de prueba.

## 7. Cierre de caja

1. El sistema calcula el **esperado por medio**: suma de `monto_aplicado` de los pagos del día.
2. La persona en caja digita lo **real**:
   - Efectivo: dinero contado en caja.
   - Transferencia y Bre-B: total visto en Bancolombia (opcional).
   - Bold: total del reporte de Bold del día (opcional).
3. El sistema muestra la **diferencia por medio**. Si alguna es distinta de cero, exige una nota para cerrar.
4. Al cerrar, el día queda **bloqueado**.

**Reglas:**
- No se puede cerrar el día con cuentas abiertas; deben cobrarse o anularse.
- **Base de caja:** campo opcional (por defecto 0). Efectivo esperado = base + pagos en efectivo del día. *Supuesto a confirmar con el dueño.*
- Reabrir un día: solo admin, con motivo registrado.

## 8. Arquitectura

- **Stack:** Next.js, Postgres en Supabase, despliegue en Vercel.
- **Zona horaria y moneda:** America/Bogota, COP.
- **Acceso:** login con correo y dos roles:
  - **Caja:** vender, cobrar y cerrar el día.
  - **Admin:** además catálogo, reportes, anular tickets y reabrir días.

## 8.1 Ubicación en el repositorio y despliegue

La app vive en una **subcarpeta `app/`** del repositorio `somosequinocciocafelibro-png/equinoccio`, que hoy es el sitio web público (equinoccio.online).

- **El sitio público no cambia.** El workflow de GitHub Pages copia solo `index.html`, `carta`, `assets`, `CNAME` y `.nojekyll`. `app/` y `docs/` nunca se publican ahí. Esa lista no se modifica.
- **La app se despliega aparte en Vercel**, con su directorio raíz en `app/`. GitHub Pages es solo hosting estático y no puede ejecutar Next.js ni hablar con la base de datos.
- **Dirección:** un subdominio propio (por ejemplo `caja.equinoccio.online`, con un registro CNAME en el DNS de DreamHost), no una ruta dentro de equinoccio.online.
- **Secretos:** las claves de Supabase van como variables de entorno en Vercel y nunca se suben al repositorio. `app/` lleva su propio `.gitignore`.
- **Flujo de trabajo:** todo el desarrollo ocurre en ramas y se integra con pull request. Cada push a `main` vuelve a publicar el sitio web, aunque el contenido público no cambie, así que `main` solo recibe cambios revisados.
- **Datos de ejemplo:** el Excel real y cualquier dato de ventas **no se suben al repositorio**, porque el repositorio es público o puede llegar a serlo. La importación se ejecuta localmente o desde la app.

## 9. Manejo de errores y casos límite

- Las cuentas abiertas viven en el servidor; recargar la página no pierde datos.
- Cobrar es idempotente: un doble clic no duplica el pago.
- Sin internet: la interfaz lo avisa y no permite vender (decisión de conectividad confiable).
- Anular exige motivo y queda auditado.
- El cierre se rechaza si hay tickets abiertos.
- Un pago no puede aplicarse por más del saldo pendiente.

## 10. Pruebas

1. **Automáticas** para las reglas de dinero: totales con extras, pagos divididos, cambio, cierre del día y bloqueo, anulaciones.
2. **Importación real:** cargar el Excel actual y comparar los totales diarios resultantes con los del archivo, documentando las diferencias.
3. **Piloto de una semana:** la caja usa el sistema mientras el Excel se sigue llenando en paralelo; los cierres se comparan cada día.

## 11. Preguntas abiertas

- ¿Se usa base de caja (sencillo inicial)? Valor por defecto: sí, opcional, en 0.
- Lista final de extras y sus precios.
- Lista oficial de mesas y categorías del catálogo.
- Tabla de equivalencias de nombres de producto para la importación.
- Subdominio definitivo para la app (propuesta: `caja.equinoccio.online`) y acceso al DNS de DreamHost para crearlo.
- Si el repositorio es público: confirmar que no hay datos sensibles y mantener el Excel fuera de él.

Estas se resuelven durante el plan de implementación o con los datos reales; ninguna cambia la arquitectura.
