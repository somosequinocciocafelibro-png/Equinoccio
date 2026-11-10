# Caja Equinoccio (app)

Aplicación web de ventas y cierre de caja del café. La spec y el plan están en `docs/superpowers/`.

## Desarrollo local

```bash
cd app
npm install
cp .env.example .env.local   # completar con los datos de Supabase
npm run dev                  # desarrollo
npm test                     # pruebas (no necesitan base de datos: usan una en memoria)
npm run lint && npm run build
```

No subas `.env*` ni datos reales de ventas al repositorio.

## Puesta en marcha (una sola vez)

Necesitas una cuenta de **Supabase**, una de **Vercel** y acceso al DNS de **DreamHost**. Haz todo en una rama y revisa
con una vista previa antes de tocar `main` (un push a `main` vuelve a publicar equinoccio.online).

1. **Supabase.** Crea un proyecto. En *Project Settings → Database → Connection string* copia la cadena del
   *Transaction pooler* y úsala como `DATABASE_URL`. En *Project Settings → API* copia la URL y la clave `anon`.
2. **Preparar la base.** Con `DATABASE_URL` en tu terminal:
   ```bash
   cd app
   DATABASE_URL='postgres://...' npm run db:setup
   ```
   Aplica la migración y carga salones, mesas, extras y los 43 productos. Se puede repetir sin riesgo: no duplica nada.
3. **Usuarios.** En Supabase, *Authentication → Users → Add user* (correo y contraseña), uno por persona. Luego, en el
   editor SQL, dale su rol (`caja` o `admin`) con el `id` que muestra Supabase:
   ```sql
   insert into profiles (user_id, role) values ('<id-del-usuario>', 'caja');
   ```
   Quien no tenga fila en `profiles` entra pero no puede hacer nada.
4. **Vercel.** Importa el repositorio, con **Root Directory = `app`**. Agrega las variables `DATABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Despliega la rama como vista previa.
5. **Prueba de humo** contra esa vista previa (deja una venta de prueba, úsala solo en un entorno de pruebas):
   ```bash
   E2E_BASE_URL='https://<vista-previa>.vercel.app' E2E_EMAIL='<usuario-caja>' E2E_PASSWORD='...' npm run e2e
   ```
6. **Dominio.** En DreamHost, crea un registro CNAME para `caja.equinoccio.online` con el valor que te indique Vercel
   al agregar el dominio al proyecto, y espera a que Vercel muestre el HTTPS activo.
7. **El sitio público no cambia.** Desde la raíz del repositorio, `git diff origin/main -- .github` debe salir vacío, y
   `https://equinoccio.online` debe verse igual.

## Importar el Excel histórico

El libro real no va en el repositorio. Descárgalo a tu computador y haz primero una **simulación**:

```bash
DATABASE_URL='postgres://...' npm run import -- ~/Descargas/Contabilidad\ Equinoccio.xlsx
```

El informe lista lo que se importaría y lo que no, con el motivo: productos sin equivalencia, fechas ambiguas, cuentas
cuyos productos no suman el total, filas descartadas y medios de pago desconocidos (como Nequi, que quedan como
`sin_medio`). Corrige y repite:

- **Productos sin equivalencia:** agrega una línea a `import/equivalences.csv` (`nombre en el Excel,id-del-producto`) o
  crea el producto en Catálogo.
- **Fecha ambigua** (el encabezado dice una fecha y "Total ventas" otra): corrígela en el Excel o usa
  `--fix 08/10/2026=08/11/2026`.
- Cuando el informe sea el esperado, repite el comando con `--apply`. Se puede repetir: no duplica cuentas.

Nada se adivina: una cuenta dudosa no se importa hasta que se corrija.

## Respaldo

- Supabase hace copias automáticas según el plan del proyecto: revisa en *Database → Backups* que estén activas.
- Además, cada semana: `DATABASE_URL='postgres://...' npm run export -- ./respaldo-AAAA-MM-DD` guarda cuentas, líneas,
  pagos y cierres como CSV. Guarda esa carpeta **fuera** del repositorio.

## Piloto de una semana

La caja usa la app mientras el Excel se sigue llenando en paralelo.

1. Cada día, la persona en caja hace el **Cierre del día** en la app.
2. Compara el total de ventas del día con el "Total ventas" del Excel. Anota cualquier diferencia con la hora y la mesa.
3. Anota qué se sintió lento o confuso, sobre todo en hora pico.

**Criterio de éxito:** los totales diarios coinciden y el cierre se hace sin cuadrar nada a mano.
