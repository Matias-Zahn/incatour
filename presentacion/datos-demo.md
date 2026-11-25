# Datos para la demo en vivo

## Preparar la base (el mismo día de la presentación)

Las fechas de la demo se arman a partir del día en que se corre el script: la salida de Carlos
empieza ese día. Si se arma el día anterior, la salida queda "de ayer".

Con Docker levantado, desde `backend`:

```bash
npm run demo
```

Tarda unos minutos y al final imprime lo que se usa en vivo. Generada para el viernes 27/11:

```
Para la presentación (2026-11-27):
  Carlos inicia en vivo: SAL-2026-041 (CERRADA)
  En curso al día: SAL-2026-040 · atrasada (Desfasada): SAL-2026-039
  Vendida completa y con la venta terminada, para confirmar en vivo (CU-40): SAL-2026-042
  Venta terminada con la mitad vendida, al confirmar sobran porteadores: SAL-2026-043 (1 alojamientos pendientes)
  Vendida a la mitad, hoy es su último día de venta: SAL-2026-045
  Equipo justo (una compra más y faltan carpas): SAL-2026-045 · ya le falta oxígeno: SAL-2026-047
  Venta terminada y le falta una radio satelital, no deja confirmar: SAL-2026-044
  Juan: ... en SAL-2026-038 (FINALIZADA, CONFIRMADA)   ← la puede reseñar
  Juan: ... en SAL-2026-049 (PUBLICADA, CONFIRMADA)    ← la puede cancelar con 100% de reintegro
```

El script usa una semilla fija, así que corrido el mismo día los números se repiten; igual, anotar los que imprima.

| Salida | Qué tiene | Para qué |
| --- | --- | --- |
| SAL-2026-039 | En curso, solo informó la etapa 1 ("Desfasada") | Control sobre el guía |
| SAL-2026-040 | En curso, al día | Control sobre el guía |
| SAL-2026-041 | Confirmada, empieza hoy, guía Carlos | Carlos la inicia en vivo |
| SAL-2026-042 | Clásico, 16 de 16 vendidos, venta terminada | Confirmar una salida completa |
| SAL-2026-043 | Express (hotel a solicitud), 6 de 12, venta terminada, 1 solicitud pendiente | Resolver la solicitud (si se rechaza, aparecen los otros 2 hoteles) y confirmar liberando 3 porteadores |
| SAL-2026-044 | Premium, 8 de 10, venta terminada, le falta 1 radio satelital | "Confirmar salida" la frena; se sube el stock de la radio en Proveedores (Andes Outdoor Rental) de 1 a 2 y se confirma |
| SAL-2026-045 | Salkantay, 7 de 14, hoy es su último día de venta, carpas justas | Una compra de Juan hace aparecer "Faltan … de Carpa doble" |
| SAL-2026-047 | A la venta | Ya muestra "Faltan 1 de Equipo de oxígeno portátil" |

Para el alta en vivo: Clásico, 16 pasajeros, a más de un mes. En el paso 2, Cusco 3★ doble tiene 4 hoteles
(Inti Wasi USD 40, Wayra 48, Tikari 62 y Plaza Regocijo 78 por noche): con el Plaza Regocijo la revisión
avisa +USD 76 por pasajero y "Sumar al precio" lo aplica.

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
| Armar la oferta | Zahn | Crea un circuito y un paquete: el costo por pasajero sale del hotel más económico de la categoría (precio "desde") y se carga el equipaje del porteador |
| Proveedores y personal | Alexis | Crea un proveedor, un empleado y su cuenta de guía |
| La salida | Martín | Alta en vivo (ver arriba), alertas de equipo de la 045 y la 047, confirmar la 042, la 043 y la 044 (antes resuelve su solicitud pendiente) |
| Alojamiento y alertas | Daniel | Otra de las solicitudes pendientes: rechazarla (aparecen los otros hoteles de la zona) y aceptar otro; alertas y contadores de Salidas |
| El cliente compra | Sepúlveda | Juan compra en la 045 (aparece la falta de carpas), ve el equipaje en el catálogo y cancela su reserva de la 049 (100% de reintegro) |
| La salida en el campo | Daniel | Carlos inicia la 041, registra un avance, prueba sin señal y notifica un incidente crítico |
| Resultados | Alexis | Reportes con dos años de historia. Juan reseña la 038 |

## Simular que el guía se queda sin señal

Primero iniciar la salida con conexión: iniciar necesita señal. Después, en la ventana del guía, F12 → Console:

Cortar la señal:

```js
Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false }); dispatchEvent(new Event("offline"))
```

Ya se puede cerrar F12. El avance o incidente que se registre queda guardado en el dispositivo, como pendiente.
Mostrar en la ventana del administrador que todavía no llegó. Para volver a tener señal (se manda la cola sola):

```js
delete navigator.onLine; dispatchEvent(new Event("online"))
```

No recargar la página en el medio: al recargar se pierde la simulación y la cola se manda.
Alternativa sin consola: F12 → Network → "Offline", dejando las DevTools abiertas (si se cierran, vuelve la conexión).

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

## Todos los usuarios

Los crea `npm run demo` con una semilla fija: son siempre los mismos.
Contraseñas: administradora `AdminIncaTour123`, guías `guia12345`, clientes `cliente123`.

| Perfil | Nombre | Email |
| --- | --- | --- |
| Administradora | Carolina Vargas | admin@incatour.com |
| Guía | Carlos Mendoza | carlos.guia@incatour.com |
| Guía | Rosa Huamán | rosa.guia@incatour.com |
| Guía | Marcos Quispe | marcos.guia@incatour.com |
| Guía | Elena Condori | elena.guia@incatour.com |
| Guía | Raúl Mamani | raul.guia@incatour.com |
| Guía | Sofía Ccori | sofia.guia@incatour.com |
| Guía | Hernán Apaza | hernan.guia@incatour.com |
| Guía | Pilar Yupanqui | pilar.guia@incatour.com |
| Cliente | Juan Pérez | juan@test.com |
| Cliente | Lucía Navarro | lucia.navarro@hotmail.es |
| Cliente | Javiera Soto | jsoto@gmail.com |
| Cliente | Julieta Martínez | jmartinez@gmail.com |
| Cliente | Fernanda Navarro | fernandanavarro71@gmail.com |
| Cliente | Mariana Costa | mariana.costa@gmail.com |
| Cliente | Tomás Benítez | tomas.benitez@yahoo.com.ar |
| Cliente | Beatriz Santos | beatrizsantos87@uol.com.br |
| Cliente | Facundo Sosa | facundo.sosa@hotmail.com |
| Cliente | Milagros Chávez | milagros.chavez@gmail.com |
| Cliente | Benjamín Rojas | benjaminrojas93@hotmail.com |
| Cliente | Lucía Acosta | lucia.acosta@gmail.com |
| Cliente | Agustina Álvarez | aalvarez@gmail.com |
| Cliente | Gabriel Almeida | gabrielalmeida94@gmail.com |
| Cliente | Florencia Herrera | florencia.herrera5@gmail.com |
| Cliente | Fernanda Navarro | fernandanavarro82@gmail.com |
| Cliente | Lucía Herrera | lucia.herrera@gmail.com |
| Cliente | Beatriz Ribeiro | beatrizribeiro76@uol.com.br |
| Cliente | Valeria Mejía | valeria.mejia5@hotmail.com |
| Cliente | Lucía Martínez | lmartinez@gmail.com |
| Cliente | Milagros Flores | milagros.flores1@gmail.com |
| Cliente | Carmen Molina | cmolina@gmail.com |
| Cliente | Fernanda Navarro | fnavarro@gmail.com |
| Cliente | Julieta Martínez | julieta.martinez@gmail.com |
| Cliente | Sofía Romero | sofia.romero@yahoo.com.ar |
| Cliente | Hugo García | hugo.garcia@gmail.com |
| Cliente | Florencia Herrera | florencia.herrera@hotmail.com |
| Cliente | Beatriz Costa | beatrizcosta93@gmail.com |
| Cliente | Facundo González | facundo.gonzalez3@gmail.com |
| Cliente | Andrés Mejía | amejia@hotmail.com |
| Cliente | Sofía González | sofiagonzalez95@hotmail.com |
| Cliente | Elena García | egarcia@hotmail.es |
| Cliente | José Quispe | jose.quispe7@hotmail.com |
| Cliente | Sebastián Restrepo | sebastianrestrepo78@hotmail.com |
| Cliente | Julieta Medina | julieta.medina4@gmail.com |
| Cliente | Tomás Herrera | therrera@yahoo.com.ar |
| Cliente | Fernanda Hernández | fhernandez@gmail.com |
| Cliente | Jorge Flores | jflores@gmail.com |
| Cliente | Matías Rojas | matias.rojas8@gmail.com |
| Cliente | Gonzalo Álvarez | gonzaloalvarez70@gmail.com |
| Cliente | Catalina Díaz | catalina.diaz@gmail.com |
| Cliente | Vicente Díaz | vdiaz@gmail.com |
| Cliente | Florencia Martínez | florenciamartinez88@hotmail.com |
| Cliente | Elena Ruiz | elena.ruiz@hotmail.es |
| Cliente | Vicente Rojas | vrojas@gmail.com |
| Cliente | Martín Benítez | martinbenitez96@yahoo.com.ar |
| Cliente | Diego Torres | diegotorres89@gmail.com |
| Cliente | Thiago Pereira | thiago.pereira@hotmail.com |
| Cliente | Pedro Silva | pedro.silva@uol.com.br |
| Cliente | Julieta Álvarez | julieta.alvarez5@yahoo.com.ar |
| Cliente | Florencia Méndez | fmendez@adinet.com.uy |
| Cliente | Fernanda Torres | fernandatorres82@outlook.com |
| Cliente | Paula Méndez | paulamendez94@adinet.com.uy |
| Cliente | Fernanda Navarro | fernanda.navarro@gmail.com |
| Cliente | Alejandro Ruiz | alejandro.ruiz9@hotmail.es |
| Cliente | Pablo Ruiz | pabloruiz74@gmail.com |
| Cliente | Javiera Díaz | jdiaz@gmail.com |
| Cliente | Catalina Díaz | cdiaz@gmail.com |
| Cliente | Mariana Santos | mariana.santos8@gmail.com |
| Cliente | Facundo González | facundo.gonzalez@hotmail.com |
