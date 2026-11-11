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

### Pruebas contra Postgres real (opcional)

`npm test` usa una base en memoria. Hay además pruebas contra un Postgres de verdad (guardado de `jsonb` y
concurrencia entre conexiones), que se saltan si no defines una base de pruebas. Su nombre debe incluir `test`,
porque se vacía al empezar:

```bash
TEST_DATABASE_URL='postgres://usuario@127.0.0.1:5432/caja_test' npm test
```

## Puesta en marcha (una sola vez)

Necesitas una cuenta de **Supabase**, una de **Vercel** y acceso al DNS de **DreamHost**. Haz todo en una rama y revisa
con una vista previa antes de tocar `main` (un push a `main` vuelve a publicar equinoccio.online).

1. **Supabase.** Crea un proyecto. En *Project Settings → Database → Connection string* copia la cadena del
   *Transaction pooler* y úsala como `DATABASE_URL`. En *Project Settings → API* copia la URL y la clave `anon`.
2. **Preparar la base (sin terminal).** En Supabase abre *SQL Editor → New query*, pega todo el contenido de
   `app/db/setup.sql` y pulsa *Run*. Crea las tablas y carga salones, mesas, extras y los 43 productos. Es una sola
   transacción: si algo falla, no queda nada a medias. Solo se ejecuta una vez en una base vacía.
   (Alternativa con terminal: `DATABASE_URL='postgres://...' npm run db:setup`, que se puede repetir sin riesgo.
   Si cambia una migración o el catálogo inicial, `npm run db:sql` vuelve a generar `db/setup.sql`.)
3. **Usuarios.** Cada persona entra escribiendo su nombre y su contraseña. Por detrás, el nombre se convierte en un
   correo de la cuenta del negocio con la forma `somosequinocciocafelibro+nombre@gmail.com` (todos llegan a la misma
   bandeja; se puede cambiar con la variable `LOGIN_EMAIL_TEMPLATE`, que lleva `{usuario}`). En Supabase,
   *Authentication → Users → Add user → Create new user*, con "Auto Confirm User" activado, crea tres usuarios con estos
   correos: `somosequinocciocafelibro+richard@gmail.com`, `somosequinocciocafelibro+carolina@gmail.com` y
   `somosequinocciocafelibro+marian@gmail.com`, cada uno con su propia contraseña. Luego, en el editor SQL, dales nombre
   y rol:
   ```sql
   insert into profiles (user_id, role, name, username)
   select id::text, v.role, v.name, v.username
   from auth.users u
   join (values
     ('somosequinocciocafelibro+richard@gmail.com',   'admin', 'Richard Moreno',  'richard'),
     ('somosequinocciocafelibro+carolina@gmail.com',  'caja',  'Carolina Yepes',  'carolina'),
     ('somosequinocciocafelibro+marian@gmail.com',    'caja',  'Marian Yepes',    'marian')
   ) as v(email, role, name, username) on u.email = v.email;
   ```
   Quien no tenga fila en `profiles` entra pero no puede hacer nada. Tres personas pueden trabajar a la vez, cada una
   con su sesión. Después, en *Authentication → Sign In / Providers* (sección Email), desactiva "Allow new users to
   sign up" para que nadie más pueda crearse una cuenta.
4. **Vercel.** Importa el repositorio, con **Root Directory = `app`**. Agrega las variables `DATABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (se escriben en Vercel, no en el chat ni en el
   repositorio). En *Settings → Git → Production Branch* pon `app/mvp`: la rama `main` es el sitio web y no tiene
   carpeta `app`. Despliega y abre el enlace que te dé Vercel.
5. **Prueba de humo** contra esa vista previa (deja una venta de prueba, úsala solo en un entorno de pruebas):
   ```bash
   E2E_BASE_URL='https://<vista-previa>.vercel.app' E2E_USER='<nombre-de-caja>' E2E_PASSWORD='...' npm run e2e
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
