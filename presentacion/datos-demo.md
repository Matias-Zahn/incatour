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
| Cliente | Vicente Morales | vicente.morales1@gmail.com |
| Cliente | Valentina Benítez | valentina.benitez@yahoo.com.ar |
| Cliente | Pablo Jiménez | pablojimenez91@gmail.com |
| Cliente | Beatriz Souza | beatriz.souza@hotmail.com |
| Cliente | José Vargas | jvargas@gmail.com |
| Cliente | Joaquín Sosa | joaquin.sosa@gmail.com |
| Cliente | Lucía Martínez | lucia.martinez3@gmail.com |
| Cliente | Regina Navarro | regina.navarro2@gmail.com |
| Cliente | Martín Medina | martin.medina@gmail.com |
| Cliente | Martín Fernández | mfernandez@yahoo.com.ar |
| Cliente | Beatriz Oliveira | beatriz.oliveira6@uol.com.br |
| Cliente | Thiago Silva | thiago.silva@gmail.com |
| Cliente | Lucía Benítez | lucia.benitez4@gmail.com |
| Cliente | Thiago Pereira | tpereira@hotmail.com |
| Cliente | Nicolás Fernández | nicolas.fernandez@gmail.com |
| Cliente | Beatriz Ribeiro | beatriz.ribeiro@uol.com.br |
| Cliente | Agustina Benítez | agustina.benitez2@hotmail.com |
| Cliente | Rosa Mendoza | rosa.mendoza@hotmail.com |
| Cliente | Gonzalo Herrera | gherrera@hotmail.com |
| Cliente | Florencia Sosa | florencia.sosa@gmail.com |
| Cliente | Lucía Techera | ltechera@adinet.com.uy |
| Cliente | Agustina Herrera | aherrera@hotmail.com |
| Cliente | Ana Silva | anasilva89@gmail.com |
| Cliente | Julieta Herrera | jherrera@gmail.com |
| Cliente | Milagros Mendoza | milagros.mendoza@hotmail.com |
| Cliente | Beatriz Oliveira | beatriz.oliveira1@uol.com.br |
| Cliente | Emiliano Navarro | emiliano.navarro1@gmail.com |
| Cliente | Cristóbal Fuentes | cristobal.fuentes7@gmail.com |
| Cliente | Vicente Morales | vicentemorales84@gmail.com |
| Cliente | Javier Serrano | javier.serrano@gmail.com |
| Cliente | Julieta Romero | julietaromero70@gmail.com |
| Cliente | Catalina Fuentes | cfuentes@hotmail.com |
| Cliente | Lucía Navarro | lnavarro@gmail.com |
| Cliente | Carmen Martín | carmen.martin@hotmail.es |
| Cliente | Andrés Vargas | avargas@gmail.com |
| Cliente | Vicente Díaz | vicente.diaz4@hotmail.com |
| Cliente | Ana Ribeiro | ana.ribeiro@hotmail.com |
| Cliente | Camila Díaz | camila.diaz3@hotmail.com |
| Cliente | Matías Contreras | matias.contreras@hotmail.com |
| Cliente | Florencia Romero | fromero@hotmail.com |
| Cliente | Milagros Huamán | milagros.huaman@gmail.com |
| Cliente | Pablo Ruiz | pruiz@hotmail.es |
| Cliente | Lucía Navarro | lucia.navarro7@hotmail.es |
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
