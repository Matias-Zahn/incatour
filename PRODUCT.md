# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Cliente.** Compra un trekking en Cusco, casi siempre desde el celular y muchas veces desde otro país, a veces para varias personas. Compra una vez y después sigue el viaje durante semanas. Decide por fecha, precio, qué incluye y si la salida va a salir.
- **Administrador.** Prepara y controla las salidas desde la computadora, todos los días. Conoce el negocio y el vocabulario interno: no necesita que le expliquen, necesita que le ordenen. Decide qué cerrar, qué cancelar, qué recursos faltan y cómo resolver imprevistos.
- **Guía.** Lleva el grupo en la montaña, con el celular en una mano, con guantes, al sol o de noche, y días sin señal. No quiere usar el sistema: quiere informar llegadas e incidentes y seguir caminando.

Las frecuencias y dolores de cada perfil son hipótesis: no hubo entrevistas (ver `docs/diseno/01-tareas-y-flujos.md`, "Preguntas para validar").

## Product Purpose

Plataforma de una agencia de trekking del Camino del Inca: vende salidas, las prepara (personal, hotel, transporte, equipo, permisos) y las acompaña hasta que terminan. Éxito: el cliente compra sin sorpresas y sabe en todo momento cómo está su viaje; el admin no pierde una salida en riesgo; el guía informa sin frenar la caminata.

Es un proyecto académico (cátedra, Grupo 5) con una agencia ficticia, diseñado como si fuera a salir a producción.

## Positioning

Dos cosas que una agencia vecina no puede copiar sin cambiar cómo opera:

1. **El seguimiento del viaje.** Después de pagar, "Mi viaje" le dice al cliente qué está listo (hotel, permisos, salida confirmada), qué le falta hacer y hasta cuándo puede cancelar sin costo.
2. **La operación ordenada.** El admin trabaja desde una bandeja de lo que necesita atención hoy y lo que viene, con propuestas precargadas para revisar en vez de armar; el guía informa desde la montaña y eso llega al admin y al cliente.

## Operating Context

- Ciclo de una salida: se publica, se vende, se cierra (con mínimo de pasajeros), se ejecuta en la montaña y se finaliza con devolución de equipo y evaluaciones.
- Recursos con ocupación por fechas (hotel, transporte, personal, equipamiento); ver `docs/plan-rediseno.md`.
- Documentación de diseño en `docs/diseno/`: 01 tareas y flujos, 02 identidad, 03 wireframes, 04 sistema. Los pedidos al back se registran en 01.

## Capabilities and Constraints

- Front: React 19, TypeScript, Vite, Tailwind v4, React Router. Back: Express 5, Prisma, PostgreSQL. Todo corre en local.
- Equipo de 5 integrantes; los roles de diseño no escriben en `frontend/src` ni en `backend/`.
- Solo español por ahora.
- Al cliente nunca se le muestran códigos internos (de salida, paquete o temporada), el tamaño máximo ni el mínimo de pasajeros. Solo lo positivo: "Salida confirmada".
- El total que se paga es el total: el equipaje extra se abona en persona y se dice en una línea.
- La cuenta se pide recién al comprar.
- El admin crea circuitos, paquetes, salidas y equipamiento con asistentes paso a paso.

## Brand Commitments

- Nombre: IncaTour.
- Voz: voseo rioplatense, directo y concreto ("Elegí la fecha", "Salida confirmada").
- Estados siempre con texto, nunca solo color.
- La identidad visual vive en `docs/diseno/02-identidad.md` y `04-sistema.md`.

## Evidence on Hand

- No hay fotos propias de los circuitos: los wireframes usan ilustraciones o fotos de referencia en `docs/diseno/fotos`. Hay que conseguir fotos reales antes de implementar.
- No hay reseñas, clientes, cifras de venta ni testimonios reales. Todo dato en pantallas es de muestra y no debe presentarse como verdadero fuera del contexto académico.
- Con menos de 3 reseñas no se muestra promedio.

## Product Principles

1. **Lo que el cliente necesita saber, antes de que lo pregunte.** Total, reintegro y estado del viaje se dicen antes, no cuando hay un problema.
2. **Ordenar, no explicar.** El admin ve primero lo urgente, con la acción a un clic; el detalle queda detrás.
3. **Revisar en vez de cargar.** Lo que el sistema ya sabe viene precargado.
4. **El guía informa en un gesto.** Una mano, sin señal, sin pasos de más.
5. **Mostrar menos.** Ningún dato interno ni ruido que no ayude a decidir.

## Accessibility & Inclusion

WCAG 2.1 AA como piso: contraste, objetivos táctiles de 44 px, foco visible, estados con texto. La app del guía tiene que funcionar con guantes, a pleno sol y de noche.
