# Datos para la demo en vivo

## Preparar la base (el mismo día de la presentación)

Las fechas de la demo se arman a partir del día en que se corre el script: la salida de Carlos
empieza ese día. Si se arma el día anterior, la salida queda "de ayer".

Con Docker levantado, desde `backend`:

```bash
npm run demo
```

Tarda unos minutos y al final imprime lo que se usa en vivo, por ejemplo:

```
Para la presentación (2026-11-13):
  Carlos inicia en vivo: SAL-2026-038 (CERRADA)
  En curso con otro guía: SAL-2026-037
  Solicitudes de alojamiento pendientes: 8
  Juan: ... en SAL-2026-036 (FINALIZADA, CONFIRMADA)   ← la puede reseñar
  Juan: ... en SAL-2026-043 (PUBLICADA, CONFIRMADA)    ← la puede cancelar con 100% de reintegro
```

Los números de salida cambian según el día: anotar los que imprima.

Después, levantar el back contra esa base (`DATABASE_URL` apuntando a `incatour_demo`) y el front.

## Usuarios

Una ventana por perfil: en pestañas de la misma ventana la sesión se pisa.

| Perfil | Ventana | Email | Contraseña |
| --- | --- | --- | --- |
| Administrador | Chrome | admin@incatour.com | AdminIncaTour123 |
| Cliente | Chrome incógnito | juan@test.com | cliente123 |
| Guía | Edge | carlos.guia@incatour.com | guia12345 |

Todos los guías tienen cuenta con la misma contraseña (por ejemplo `rosa.guia@incatour.com`).
Mailpit: http://localhost:8025

## Qué usa cada parte

| Parte | Quién | Qué usar |
| --- | --- | --- |
| Armar la oferta | Zahn | Crea un circuito nuevo; el resto ya está cargado |
| Proveedores y personal | Alexis | Crea un proveedor, un empleado y su cuenta de guía |
| Crear y preparar la salida | Daniel | Nueva salida a más de un mes (hay personal libre). Solicitudes pendientes para confirmar en vivo |
| El cliente compra | Sepúlveda | Juan compra en una salida Publicada y cancela la que ya tiene en estado Publicada (100% de reintegro) |
| La salida en el campo | Martín | Carlos inicia la salida de hoy, registra un avance, prueba sin señal y notifica un incidente crítico |
| Resultados | Alexis | Reportes con dos años de historia. Juan reseña su última salida finalizada |

## Pasajeros para pegar en la compra

Válidos (el pasaporte vence mucho después del viaje):

| Nombre | Pasaporte | Nacionalidad | Vencimiento |
| --- | --- | --- | --- |
| Ana Torres | AR4410021 | Argentina | 2034-05-20 |
| Pablo Ruiz | AR4410022 | Argentina | 2033-11-02 |

Para el "qué pasa si": el pasaporte tiene que vencer **después del último día del viaje**.
Con el vencimiento igual al último día de la salida elegida, la pantalla lo rechaza;
con el día siguiente, lo acepta. Repetir el pasaporte de Ana en el segundo pasajero también lo marca.

Tarjeta aprobada: `4242 4242 4242 4242`, vencimiento `12/30`, CVV `123`.
Pago rechazado por fondos insuficientes: `4242 4242 4242 0000` (cualquier tarjeta que termine en 0000).
