# Prueba de caja negra: pantalla de compra (CU-30)

**Por qué esta pantalla:** es la que más datos pide. Por cada pasajero: nombre, pasaporte, nacionalidad, vencimiento y equipaje. Por el pago: número, titular, vencimiento y CVV.

**Técnicas:** partición de equivalencia (PE) y análisis de valores límite (VL). Los casos se diseñaron a partir de las reglas del caso de uso, sin mirar la implementación, y se ejecutan en Chrome sobre la app real, como lo haría un cliente.

## Cómo se ejecuta

1. Crear la base de demo, desde `backend`:

```bash
npm run demo
```

2. Levantar el back contra esa base, en PowerShell:

```bash
$env:PORT="3998"; $env:DB_NAME="incatour_demo"; $env:DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/incatour_demo"; npx tsx src/app.ts
```

3. Levantar el front, desde `frontend`:

```bash
$env:VITE_USE_MOCKS="false"; $env:VITE_API_URL="http://localhost:3998/api"; npx vite --port 5191 --strictPort
```

4. Correr la prueba, desde `frontend`. Con `-- --headed` se ve el navegador trabajando:

```bash
npm run test:caja-negra
```

Los casos válidos compran de verdad y consumen lugares de la salida con más cupo. Se necesita Google Chrome instalado.

## Clases de equivalencia

| Campo | Clases válidas | Clases inválidas | Límites |
|---|---|---|---|
| Nombre | Texto | Vacío, solo espacios | |
| Pasaporte | Texto único en la nómina | Vacío, repetido | |
| Nacionalidad | Texto | Vacía | |
| Vencimiento del pasaporte | Posterior al fin de la salida | Vacío, ya vencido, anterior o igual al fin | Fin − 1, fin, fin + 1 |
| Equipaje (kg) | De 0 a 20 | Vacío, negativo, mayor a 20 | −0,5 / 0 / 20 / 20,5 |
| Número de tarjeta | 15 o 16 dígitos, con o sin espacios | Vacío, con letras, otra longitud | 11, 14, 15, 16, 17 dígitos |
| Titular | Texto | Vacío | |
| Vencimiento de la tarjeta | MM/AA vigente | Sin barra, mes inexistente, vencida | Mes 13 |
| CVV | 3 o 4 dígitos | Con letras, menos de 3 | 2, 3, 4, 5 dígitos |
| Pago | Aprobado | Sin fondos, tarjeta robada, rechazo por CVV | |

## Casos

La columna "Dato probado" indica lo único que cambia: el resto de los campos lleva datos válidos.

| Caso | Técnica | Dato probado | Resultado esperado | Obtenido |
|---|---|---|---|---|
| CN-01 | PE | Nombre vacío | Completá el nombre y apellido | OK |
| CN-02 | VL | Nombre de solo espacios | Completá el nombre y apellido | OK |
| CN-03 | PE | Pasaporte vacío | Completá el número de pasaporte | OK |
| CN-04 | PE | Nacionalidad vacía | Completá la nacionalidad | OK |
| CN-05 | PE | Vencimiento vacío | Indicá el vencimiento | OK |
| CN-06 | PE | Pasaporte vencido (2020) | Tiene que vencer después del fin | OK |
| CN-07 | VL | Vence el día anterior al fin | Tiene que vencer después del fin | OK |
| CN-08 | VL | Vence el último día | Tiene que vencer después del fin | OK |
| CN-09 | PE | Equipaje vacío | Indicá el peso del equipaje | OK |
| CN-10 | VL | Equipaje −0,5 kg | No puede ser negativo | OK |
| CN-11 | VL | Equipaje 20,5 kg | El máximo es 20 kg | OK |
| CN-12 | PE | Tarjeta vacía | Número de tarjeta válido | OK |
| CN-13 | VL | Tarjeta de 11 dígitos | Número de tarjeta válido | OK |
| CN-14 | VL | Tarjeta de 14 dígitos | Pago rechazado: número inválido | OK |
| CN-15 | VL | Tarjeta de 17 dígitos | Pago rechazado: número inválido | OK |
| CN-16 | PE | Tarjeta con letras | Pago rechazado: número inválido | OK |
| CN-17 | PE | Titular vacío | Ingresá el nombre del titular | OK |
| CN-18 | PE | Vencimiento `1230` | Usá el formato MM/AA | OK |
| CN-19 | VL | Vencimiento `13/30` | Pago rechazado: vencimiento inválido | OK |
| CN-20 | PE | Vencimiento `01/20` | Pago rechazado: tarjeta vencida | OK |
| CN-21 | VL | CVV de 2 dígitos | Ingresá el código de seguridad | OK |
| CN-22 | VL | CVV de 5 dígitos | El campo no admite el quinto | OK |
| CN-23 | PE | CVV con letras | Pago rechazado: CVV inválido | OK |
| CN-24 | PE | Tarjeta terminada en 0000 | Pago rechazado: fondos insuficientes | OK |
| CN-25 | PE | Tarjeta terminada en 1111 | Pago rechazado | OK |
| CN-26 | PE | CVV 999 | Pago rechazado | OK |
| CN-27 | PE | Todos los datos válidos | Reserva confirmada | OK |
| CN-28 | VL | Vence el día siguiente al fin | Reserva confirmada | OK |
| CN-29 | VL | Equipaje 0 kg | Reserva confirmada | OK |
| CN-30 | VL | Equipaje 20 kg | Reserva confirmada | OK |
| CN-31 | VL | Tarjeta de 15 dígitos | Reserva confirmada | OK |
| CN-32 | VL | CVV de 4 dígitos | Reserva confirmada | OK |
| CN-33 | PE | Tarjeta con espacios | Reserva confirmada | OK |
| CN-34 | PE | Pasaporte repetido (otras mayúsculas) | Este pasaporte está repetido | OK |

## Resultado

**34 de 34 casos correctos.**

## Observaciones

- **Validación tardía:** con 12 a 14 o 17 dígitos, con letras, o con mes 13, la pantalla deja avanzar y el error recién llega desde la pasarela. Los datos no entran, pero el cliente espera el procesamiento para enterarse. Se podría validar antes en el formulario.
- **Pasaporte que vence el último día (CN-08):** la pantalla lo rechaza y el back lo acepta. Es una decisión del grupo: se dejó la regla más segura.
- **CN-22:** en el primer diseño se esperaba un mensaje de error. El campo limita la entrada a 4 caracteres, así que se corrigió lo esperado.
