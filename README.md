# Equinoccio Café Libro: equinoccio.online

Página web y carta digital. Cada cambio que se sube a `main` se publica solo en https://equinoccio.online (GitHub Actions → DreamHost por SSH/rsync).

- `index.html`: página principal. La carta se abre en `/#carta`.
- `carta/`: redirige `equinoccio.online/carta` a la carta (es la dirección del QR de las mesas).
- `assets/`: logo y favicon.

## Configuración (una sola vez)
En GitHub → Settings → Secrets and variables → Actions, crea:

| Secreto | Valor |
|---|---|
| `DH_HOST` | Servidor SSH de DreamHost (p. ej. `iad1-shared-b8-12.dreamhost.com`) |
| `DH_USER` | Usuario SFTP/SSH del dominio |
| `DH_PATH` | Carpeta del sitio, normalmente `/home/USUARIO/equinoccio.online` |
| `DH_SSH_KEY` | Llave privada SSH cuya llave pública está en `~/.ssh/authorized_keys` del usuario |
