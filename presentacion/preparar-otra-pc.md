# Levantar la demo en otra PC

Todo queda armado con un script. La guía es para Windows.

## 1. Instalar (una sola vez)

| Programa | De dónde | Ojo |
| --- | --- | --- |
| Git | https://git-scm.com/download/win | Opciones por defecto |
| Node.js LTS | https://nodejs.org | Trae npm |
| Docker Desktop | https://www.docker.com/products/docker-desktop | Pide reiniciar. Abrirlo y esperar a que diga "Engine running" |

Después de instalar, cerrar y volver a abrir la terminal para que encuentre los programas.

## 2. Bajar el proyecto (una sola vez)

En PowerShell, en la carpeta donde lo quieras:

```powershell
git clone https://github.com/Matias-Zahn/incatour.git
```

```powershell
cd incatour
```

Si ya estaba clonado, actualizarlo con `git switch main` y después `git pull`.

## 3. Armar y levantar la demo (el día de la presentación)

Con Docker Desktop abierto, desde la carpeta `incatour`:

```powershell
powershell -ExecutionPolicy Bypass -File presentacion\preparar-demo.ps1
```

El script:

1. Revisa que estén Git, Node y Docker.
2. Levanta Postgres y Mailpit.
3. Crea los `.env` si faltan.
4. Instala las dependencias.
5. Arma la base `incatour_demo`, que tarda unos minutos.
6. Abre dos ventanas, una para el back y otra para el front.

Al final abre la app en http://localhost:5173. **Anotá los números de salida que imprime en el paso 5.**

La base hay que armarla **el mismo día**, porque la salida de Carlos empieza el día en que se corre el script.

Si ya la armaste hoy y solo hay que volver a levantar (por ejemplo, después de reiniciar la PC):

```powershell
powershell -ExecutionPolicy Bypass -File presentacion\preparar-demo.ps1 -SinReconstruir
```

Para apagar, cerrar las ventanas "IncaTour back" e "IncaTour front".

## 4. Antes de empezar

- Usuarios, pasajeros para pegar y tarjetas de prueba: `presentacion\datos-demo.md`.
- Una ventana de navegador por perfil. Por ejemplo, el administrador en Chrome, el cliente en Chrome incógnito y el guía en Edge. En pestañas de la misma ventana la sesión se pisa.
- Los mails se ven en http://localhost:8025.

## Si algo falla

| Mensaje | Qué hacer |
| --- | --- |
| "Docker no está corriendo" | Abrir Docker Desktop, esperar a "Engine running" y volver a correr el script |
| "el puerto 3000 o 5173 ya está en uso" | Cerrar las ventanas del back o del front que hayan quedado abiertas |
| "falta git, node o docker" | Instalarlo (paso 1) y abrir una terminal nueva |
| El puerto 5432 está ocupado al levantar Postgres | Hay otro Postgres instalado en la PC: detener su servicio desde "Servicios" de Windows |
| La app carga pero no muestra datos | `frontend\.env.local` tiene que decir `VITE_USE_MOCKS=false` |

## Con Claude Code en la otra PC

Abrir Claude Code en la carpeta `incatour` y pedirle:

> Seguí `presentacion/preparar-otra-pc.md` para levantar la demo de IncaTour en esta PC. Corré `presentacion/preparar-demo.ps1` y, si falla, diagnosticá el error. No toques la base `incatour_db` ni commitees `backend/.env`.
