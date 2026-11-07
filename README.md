# Equinoccio Café Libro: equinoccio.online

Página web y carta digital. Cada cambio que se sube a `main` se publica solo en https://equinoccio.online (GitHub Actions → GitHub Pages).

- `index.html`: página principal. La carta se abre en `/#carta`.
- `carta/`: redirige `equinoccio.online/carta` a la carta (es la dirección del QR de las mesas).
- `assets/`: logo y favicon.

## Configur## Configuración (una sola vez)
1. GitHub → Settings → Pages → Source: **GitHub Actions**. Custom domain: `equinoccio.online`, y activar **Enforce HTTPS** cuando aparezca.
2. DreamHost → Websites → Manage Websites: dejar `equinoccio.online` como **DNS only**.
3. DreamHost → DNS de `equinoccio.online`, agregar:

| Nombre | Tipo | Valor |
|---|---|---|
| (vacío) | A | 185.199.108.153 |
| (vacío) | A | 185.199.109.153 |
| (vacío) | A | 185.199.110.153 |
| (vacío) | A | 185.199.111.153 |
| www | CNAME | somosequinocciocafelibro-png.github.io. |
