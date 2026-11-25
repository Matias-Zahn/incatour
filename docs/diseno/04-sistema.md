# Etapa 4: sistema de diseño

Es la referencia para construir el front. Sale de lo que ya está aprobado: la identidad Tejido ([02-identidad.md](02-identidad.md)) y los wireframes ([03-wireframes/](03-wireframes/)). No agrega estilos nuevos: ordena, les pone nombre y cierra los huecos. Los tokens y los componentes se ven funcionando en [sistema.html](sistema.html).

**Stack del front:** React 19, Tailwind 4 (los tokens van en CSS, con `@theme`), Radix para los componentes interactivos y react-day-picker para el calendario.

---

## 1. Lo que encontró el inventario

Recorrí `_base.css`, los diez wireframes y la portada aprobada.

| Qué | Encontrado | Queda |
|---|---|---|
| Colores | 7 de la paleta y unos 30 valores sueltos (grises índigo, tintes claros, transparencias) | 20 tokens de referencia y 20 de uso |
| Tamaños de letra | 19 distintos, de 12 a 44 px | Una escala de 8, más la de la portada |
| Radios | 9 distintos (2, 3, 6, 8, 9, 10, 12, 28 y 999 px) | 4 |
| Sombras | 5 | 2 |
| Movimiento | 4 duraciones sueltas | 3 |
| Puntos de corte | 480, 560, 700, 860 y 900 px | 3 |

**Problemas que corrige el sistema:**
1. **El borde de los campos no llegaba a 3:1.** `#9EA2BC` sobre blanco da 2,5:1. Pasa a `#7B809F` (3,9:1).
2. **El texto base estaba en 17 px en los wireframes y en 18 px en la identidad.** Queda en 17 px: es lo que se probó en todas las pantallas. La identidad se corrige.
3. **La lista de etapas del guía y la del cliente eran dos componentes.** Ahora son uno con dos superficies.
4. **El estado "espera" y el chip** usaban colores parecidos con significado distinto. El chip queda neutro (índigo) y nunca indica estado.

---

## 2. Tokens

Tres capas, como pide Tailwind 4:
- **Referencia:** la paleta cruda. No se usa directo en los componentes.
- **Uso:** lo que significa cada color (fondo, texto, acción, estado). Es lo que usan los componentes.
- **Superficie índigo:** los mismos tokens de uso redefinidos para fondo oscuro (la app del guía, la tarjeta de reseñas, la barra y el lateral del admin). Un componente funciona igual sobre algodón y sobre índigo sin variantes nuevas.

### 2.1 Color de referencia

| Token | Hex | Origen |
|---|---|---|
| `algodon` | `#FFFFFF` | Paleta |
| `indigo-950` | `#1C2044` | Pie |
| `indigo-900` | `#232850` | Índigo |
| `indigo-700` | `#4B5170` | Índigo suave |
| `indigo-500` | `#7B809F` | Borde de campos (nuevo) |
| `indigo-300` | `#C9CBD8` | Fondo deshabilitado |
| `indigo-200` | `#D5D8EE` | Texto secundario sobre índigo |
| `indigo-150` | `#E1E2EC` | Líneas |
| `indigo-100` | `#ECEDF5` | Fondo de sección, chip |
| `indigo-50` | `#F7F7FB` | Fondo de tabla y hover |
| `cochinilla-800` | `#7A0E2B` | Texto de error sobre tinte |
| `cochinilla-700` | `#870E30` | Hover de la acción |
| `cochinilla-600` | `#A3123A` | Cochinilla |
| `cochinilla-50` | `#FBEAEE` | Fondo de error |
| `qolle-500` | `#E8A817` | Q'olle |
| `chilca-700` | `#2F6B2C` | Chilca |
| `chilca-300` | `#9BD49A` | Listo sobre índigo |
| `piedra-200` | `#E9E6DF` | Piedra |
| `piedra-500` | `#8E8676` | Borde de los andenes (decorativo) |
| `tierra-700` / `tierra-800` | `#9C4A00` / `#8A5F00` | Riesgo y espera |

### 2.2 Color de uso

| Token | Sobre algodón | Sobre índigo | Contraste medido |
|---|---|---|---|
| `fondo` | algodón | indigo-900 | — |
| `fondo-suave` | indigo-50 | blanco al 8 % | — |
| `fondo-seccion` | indigo-100 | — | — |
| `texto` | indigo-900 | blanco | 14,1:1 / 14,1:1 |
| `texto-suave` | indigo-700 | indigo-200 | 7,7:1 / 10:1 |
| `borde` | indigo-150 | blanco al 15 % | decorativo |
| `borde-campo` | indigo-500 | blanco al 40 % | 3,9:1 / 3,5:1 |
| `accion` | cochinilla-600 | qolle-500 | 7,8:1 (blanco encima) / 6,7:1 (índigo encima) |
| `accion-hover` | cochinilla-700 | `#F0B83A` | 9,8:1 / 7,8:1 |
| `texto-accion` | blanco | indigo-900 | — |
| `foco` | cochinilla-600 | qolle-500 | 7,8:1 / 6,7:1 |
| `listo` | chilca-700 | chilca-300 | 6,4:1 / 8,2:1 |
| `espera` | tierra-800 | qolle-500 | 5,6:1 / 6,7:1 |
| `riesgo` | tierra-700 | qolle-500 | 6,2:1 / 6,7:1 |
| `critico` | cochinilla-600 | blanco sobre cochinilla | 7,8:1 |
| `destacado` | qolle-500 (solo relleno, nunca texto) | qolle-500 | — |
| `deshabilitado` | texto indigo-700 sobre indigo-300 | — | 4,8:1 |

**Reglas de color:**
- El q'olle nunca es texto sobre fondo claro (2,1:1).
- Sobre índigo, espera y riesgo comparten el q'olle: ahí los distingue solo el texto, que siempre está. Sobre algodón solo se usa como relleno con texto índigo encima, como en el bloque de garantía o en las marcas de las notas.
- La cochinilla es acción o es crítico, nunca decoración. En una pantalla, un solo botón cochinilla.
- **Los estados siempre llevan texto.** El color nunca es la única señal.

### 2.3 Tipografía

| Token | Tamaño / interlineado | Familia y peso | Uso |
|---|---|---|---|
| `text-xs` | 14 / 1,4 | Sans 700 | Encabezados de tabla, errores de campo, letra chica. **Mínimo absoluto** |
| `text-sm` | 15 / 1,45 | Sans 400–700 | Estados, detalles, ayudas |
| `text-base` | 17 / 1,55 | Sans 400 | Texto. **Base** |
| `text-lg` | 19 / 1,5 | Sans 400–800 | Base de la app del guía |
| `text-xl` | 22 / 1,3 | Sans 700 o Serif 500 | Nombre en listas, citas de reseñas |
| `text-2xl` | 26 / 1,2 | Serif 700 | Títulos de sección |
| `text-3xl` | 30 / 1,15 | Serif 800 | Cifras grandes, fechas |
| `text-4xl` | 38 / 1,1 | Serif 700 | Título de página (h1) |
| `text-portada` | `clamp(40px, 4.4vw, 58px)` | Serif 800 | Solo la portada |

- **Familias:** `font-titulo` es Alegreya (700 y 800) y `font-texto` es Alegreya Sans (400, 500, 700 y 800). Se cargan solo esos pesos.
- **Números:** la clase `cifra` aplica `lining-nums tabular-nums`. Es obligatoria en precios, alturas, fechas en tabla, contadores y todo lo que se compara en columna.
- **El nombre gigante detrás de la montaña no usa la escala:** se dibuja dentro del SVG y su tamaño se ajusta por foto (ver 02).
- Los 13 px que había en los wireframes suben a 14, incluidos los rótulos en mayúsculas y los números de los pasos.

### 2.4 Espaciado

Base de 4 px (la de Tailwind). Pasos permitidos: **4, 8, 12, 16, 20, 24, 32, 40, 48 y 64**. Otros valores solo con un motivo escrito.

| Uso | Valor |
|---|---|
| Entre etiqueta y campo | 6 (la única excepción a la base de 4, se mantiene por legibilidad) |
| Entre campos | 16 |
| Relleno de tarjeta | 24 en compu, 20 en celular |
| Entre secciones | 40 a 64 |
| Margen lateral de página (`.ancho`) | 32, y 20 por debajo de 700 px |
| Ancho máximo de página | 1200 px; formularios y lectura, 760 px |

### 2.5 Radios, sombras y movimiento

| Token | Valor | Uso |
|---|---|---|
| `radius-anden` | 2 px | Andenes |
| `radius-control` | 6 px | Botones, campos y enlaces de navegación |
| `radius-bloque` | 10 px | Tarjetas, avisos, diálogos, botones del guía y fotos de lista |
| `radius-full` | 999 px | Chips, contadores y segmentos |
| `shadow-flota` | `0 16px 48px rgb(35 40 80 / .22)` | Lo que flota: diálogos y la tarjeta de reseñas |
| `shadow-sutil` | `0 2px 8px rgb(35 40 80 / .12)` | Menús desplegables |
| `duracion-rapida` | 150 ms | Hover y cambio de pestaña |
| `duracion-media` | 450 ms | Entrada de diálogos y avisos |
| `duracion-lenta` | 700 ms | Cambio de diapositiva en la portada (fundido) |

Las tarjetas comunes no llevan sombra, solo borde. **Con `prefers-reduced-motion`, toda animación se reemplaza por un cambio instantáneo.**

### 2.6 Puntos de corte

| Token | Ancho | Qué cambia |
|---|---|---|
| `sm` | 480 px | La barra superior se compacta |
| `md` | 768 px | Las grillas de dos columnas pasan a una; la ficha del viaje apila foto y datos |
| `lg` | 1024 px | El lateral del admin se vuelve barra superior por debajo de este ancho |

Los cortes sueltos (560, 700, 860 y 900 px) se mueven al más cercano de estos tres.

### 2.7 Los tokens en CSS (Tailwind 4)

```css
@import "tailwindcss";

@theme {
  /* Referencia */
  --color-algodon: #FFFFFF;
  --color-indigo-950: #1C2044; --color-indigo-900: #232850; --color-indigo-700: #4B5170;
  --color-indigo-500: #7B809F; --color-indigo-300: #C9CBD8;
  --color-indigo-200: #D5D8EE; --color-indigo-150: #E1E2EC; --color-indigo-100: #ECEDF5; --color-indigo-50: #F7F7FB;
  --color-cochinilla-800: #7A0E2B; --color-cochinilla-700: #870E30; --color-cochinilla-600: #A3123A; --color-cochinilla-50: #FBEAEE;
  --color-qolle-500: #E8A817;
  --color-chilca-700: #2F6B2C; --color-chilca-300: #9BD49A;
  --color-piedra-200: #E9E6DF; --color-piedra-500: #8E8676;
  --color-tierra-700: #9C4A00; --color-tierra-800: #8A5F00;

  /* Uso: los componentes usan solo estos */
  --color-fondo: var(--color-algodon);
  --color-fondo-suave: var(--color-indigo-50);
  --color-fondo-seccion: var(--color-indigo-100);
  --color-texto: var(--color-indigo-900);
  --color-texto-suave: var(--color-indigo-700);
  --color-borde: var(--color-indigo-150);
  --color-borde-campo: var(--color-indigo-500);
  --color-accion: var(--color-cochinilla-600);
  --color-accion-hover: var(--color-cochinilla-700);
  --color-texto-accion: var(--color-algodon);
  --color-foco: var(--color-cochinilla-600);
  --color-listo: var(--color-chilca-700);
  --color-espera: var(--color-tierra-800);
  --color-riesgo: var(--color-tierra-700);
  --color-critico: var(--color-cochinilla-600);
  --color-destacado: var(--color-qolle-500);

  --font-titulo: "Alegreya", serif;
  --font-texto: "Alegreya Sans", sans-serif;
  --text-xs: 14px;   --text-xs--line-height: 1.4;
  --text-sm: 15px;   --text-sm--line-height: 1.45;
  --text-base: 17px; --text-base--line-height: 1.55;
  --text-lg: 19px;   --text-lg--line-height: 1.5;
  --text-xl: 22px;   --text-xl--line-height: 1.3;
  --text-2xl: 26px;  --text-2xl--line-height: 1.2;
  --text-3xl: 30px;  --text-3xl--line-height: 1.15;
  --text-4xl: 38px;  --text-4xl--line-height: 1.1;
  --text-portada: clamp(40px, 4.4vw, 58px);

  --radius-anden: 2px; --radius-control: 6px; --radius-bloque: 10px;
  --shadow-flota: 0 16px 48px rgb(35 40 80 / .22);
  --shadow-sutil: 0 2px 8px rgb(35 40 80 / .12);
  --breakpoint-sm: 480px; --breakpoint-md: 768px; --breakpoint-lg: 1024px;
}

/* Superficie índigo: guía, reseñas, barra y lateral del admin */
.superficie-indigo {
  --color-fondo: var(--color-indigo-900);
  --color-fondo-suave: rgb(255 255 255 / .08);
  --color-texto: var(--color-algodon);
  --color-texto-suave: var(--color-indigo-200);
  --color-borde: rgb(255 255 255 / .15);
  --color-borde-campo: rgb(255 255 255 / .4);
  --color-accion: var(--color-qolle-500);
  --color-accion-hover: #F0B83A;
  --color-texto-accion: var(--color-indigo-900);
  --color-foco: var(--color-qolle-500);
  --color-listo: var(--color-chilca-300);
  --color-espera: var(--color-qolle-500);
  --color-riesgo: var(--color-qolle-500);
  background: var(--color-fondo);
  color: var(--color-texto);
}

body { font: 400 var(--text-base)/1.55 var(--font-texto); color: var(--color-texto); background: var(--color-fondo); }
h1, h2, h3 { font-family: var(--font-titulo); }
:focus-visible { outline: 3px solid var(--color-foco); outline-offset: 3px; }
.cifra { font-variant-numeric: lining-nums tabular-nums; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
```

---

## 3. Componentes

Cada componente tiene un nombre por lo que es, no por dónde aparece. Todos cumplen lo mismo, y no se repite en cada ficha:
- **Foco** visible con el token `foco`.
- **Uso completo con teclado.**
- **Objetivo táctil de 44 px** como mínimo (56 a 64 px en el guía).
- **Funcionan sobre las dos superficies.**

### 3.1 Básicos

**Botón.** Una acción.

| Variante | Cuándo | Aspecto |
|---|---|---|
| Principal | La acción de la pantalla. **Una sola por pantalla** | Relleno `accion`, texto `texto-accion`, 800 |
| Secundario | Acciones que acompañan a la principal | Borde de 2 px en `texto`, sin relleno, 700 |
| Texto | Acciones de poco peso: ver detalle, volver | Subrayado, sin caja, 700 |
| Peligro | Cancelar, dar de baja, finalizar | Como Texto, en `critico`. **Su confirmación** es un botón Principal con relleno `critico` |

- **Tamaños:** normal de 48 px, compacto de 44 px (secundario y texto) y grande de 64 px con `text-lg` (guía).
- **Estados:**
  - **Hover:** `accion-hover`.
  - **Deshabilitado:** fondo indigo-300 y texto indigo-700. Se usa poco: es mejor dejar el botón activo y explicar qué falta.
  - **Cargando:** texto "Pagando…" con el ancho fijo y `aria-busy`, más un aviso oculto con `role="status"` ("Procesando el pago."), porque el cambio de texto de un botón no siempre se anuncia.
- **Texto:** un verbo que dice lo que pasa, como "Pagar USD 1.500" o "Cerrar salida". Nunca "Aceptar" ni "Enviar".
- **Implementación:** `<button>`, o `<a>` si navega. Nunca un ícono solo sin nombre accesible.

**Estado.** Dice en qué situación está algo. Es un punto de 9 px más el texto, en `listo`, `espera`, `riesgo` o `critico`. Sobre índigo, el crítico pasa a texto blanco sobre una píldora cochinilla, porque la cochinilla sola no contrasta con el índigo. El texto describe la situación para quien la lee: "Salida confirmada", "Tramitando los permisos", "No vino". **Nunca es un código** (CONFIRMADA, PENDIENTE). No es un botón.

**Chip.** Etiqueta neutra o contador: "3 en curso", "Día 2". Fondo `fondo-seccion` y texto `texto`, siempre índigo. **No indica estado:** para eso está Estado.

**Enlace.** Siempre subrayado dentro de un texto. En la navegación, sin subrayado y con el actual marcado (`aria-current="page"`) con una línea q'olle.

### 3.2 Formularios

**Campo.** Una etiqueta arriba, el control, una ayuda opcional y un error.
- **Control:** 48 px de alto, borde de 2 px en `borde-campo`, radio `control`.
- **Etiqueta:** siempre visible, en `text-sm` 700. Nunca se reemplaza por el texto de ejemplo.
- **Error:** borde `critico` y el mensaje debajo en `text-xs` 700, que dice qué pasó y cómo seguir. El campo lleva `aria-invalid` y el mensaje se vincula con `aria-describedby`. Se valida al salir del campo y al enviar, no mientras se escribe. **Sobre índigo** la cochinilla no contrasta (1,8:1): el error va en blanco, con un ⚠ q'olle y el borde discontinuo.
- **Autocompletado:** los campos de datos personales llevan `autocomplete` (`given-name`, `email`, `tel`).
- **Variantes:** texto, número, fecha y hora nativos, área de texto y selección. La selección usa el `<select>` nativo hasta 7 opciones; con más, Lista con búsqueda.

**Casilla.** Marcar o desmarcar: presentes, pasajeros afectados, servicios. Es el `<input type="checkbox">` nativo, de 24 px, dentro de una fila clickeable de 52 px.

**Opción de un toque.** Elegir una entre pocas (de 2 a 6) con una sola mano: el tipo de incidente, la gravedad, el motivo. Botones en grilla con `aria-pressed`, dentro de un `fieldset` con su `legend`; al elegir, se rellenan con el color del texto (índigo sobre algodón, blanco sobre índigo). Los de un grupo se recorren con Tab. Si el formulario lo necesita, se usa Radix `ToggleGroup` con `type="single"`.

**Lista con búsqueda.** Elegir uno o varios entre muchos: hoteles, transportes, equipo, guías.
- Un campo de búsqueda arriba y la lista con casillas, con un alto máximo de 264 px y desplazamiento propio.
- Arriba quedan los elegidos y un contador ("2 elegidos").
- La búsqueda filtra mientras se escribe y, si no hay resultados, lo dice: "No hay hoteles con «Andes»".
- Una sola región viva (`aria-live="polite"`) anuncia los resultados y los elegidos juntos: "4 resultados · 1 elegido".

**Calendario de fechas.** Elegir una fecha de salida. Usa `react-day-picker`.
- Solo se pueden elegir las fechas con salida a la venta. Las demás quedan atenuadas y deshabilitadas.
- La salida confirmada lleva un punto `listo` y lo dice en su nombre accesible.
- **No se marca ninguna fecha como "en riesgo".**

### 3.3 Navegación y organización

**Barra superior.** La marca y de 2 a 4 enlaces, sobre la superficie índigo, de 72 px de alto. Por debajo de `sm` se compacta, sin pasar a menú hamburguesa mientras entre.

**Lateral del admin.** La navegación fija del admin, de 232 px, sobre la superficie índigo.
- Arriba van las secciones de uso diario, con contadores. Abajo, separadas, las de configuración, en `text-sm`.
- **Contador:** píldora q'olle con el número en índigo, `text-xs` 700 y `cifra` (6,7:1). Antes era q'olle sobre un tinte de q'olle y sobre el enlace activo daba 3,6:1.
- Por debajo de `lg` pasa a barra superior.

**Pestañas.** Ver partes de una misma cosa sin cambiar de pantalla: las pestañas de la ficha de la salida, o Próximas / Anteriores.
- Usa Radix `Tabs`: flechas entre pestañas y Tab para entrar al panel.
- **Variantes:**
  - **Subrayada:** admin, con muchas pestañas.
  - **Segmentos:** dos o tres opciones a todo el ancho, de 48 px, en el guía y en el celular. Contenedor con radio `bloque` y botones con radio `control`.

**Asistente.** Crear algo largo de a un paso por vez: circuito, paquete, salida.
- Arriba van los pasos con nombre, el actual marcado (`aria-current="step"`) y los hechos tildados.
- Abajo quedan siempre "Volver" (texto) y "Seguir" (principal). En el último paso, el botón dice qué se crea: "Crear paquete".
- Se puede volver a cualquier paso hecho. Lo cargado se guarda al pasar de paso.

### 3.4 Contenido

**Tarjeta.** Agrupa lo que va junto.
- Fondo `fondo`, borde de 1 px en `borde`, radio `bloque`, sin sombra.
- **Variante flotante** (reseñas, diálogos): sin borde y con `shadow-flota`.

**Tarjeta de tarea.** Una decisión pendiente, en Hoy.
- Tiene el tipo, con el punto de Estado delante y en el color de su urgencia (`riesgo` si vence pronto, `espera` si espera una acción, sin punto si puede esperar; `critico` solo en lo que pasa en la montaña), el plazo en lenguaje llano ("Decidís en 6 días"), la salida, qué pasa y **una sola acción**.
- **Sin barra al costado:** se probó la barra de 4 px y se eligió el punto, que reusa Estado y deja todas las tarjetas iguales. El plazo va en `texto-suave`.
- Se agrupa en tres grupos fijos por tipo de trabajo (ventas y cierre, hoteles y equipo, después del viaje), con el título y un chip con la cantidad. **Los grupos no llevan fondo ni color propio:** el color en Hoy dice solo la urgencia. Una regla de color, no dos.

**Aviso.** Un mensaje que no es un campo ni un estado.

| Variante | Fondo | Cuándo |
|---|---|---|
| Info | `fondo-seccion` | Lo que conviene saber: "El costo es parcial" |
| Error | cochinilla-50, texto cochinilla-800 y borde izquierdo `critico` | Algo falló y hay que hacer algo |
| Crítico | Fondo algodón con borde izquierdo `critico` (también sobre índigo, para que resalte) | Algo que no se deshace: "2 etapas quedan sin informar" |

Los errores que aparecen después de una acción van con `role="alert"`. Los avisos fijos no llevan rol.

**Tabla.** Comparar filas en el admin.
- Encabezados en `text-xs` `texto-suave` con `scope="col"`, filas con línea `borde` y la clase `cifra` en toda la tabla.
- Cada acción por fila lleva el nombre de la fila en su texto accesible ("Comprobante de Lucía Fernández").
- En celular, la tabla se desplaza dentro de su caja. No se convierte en tarjetas.

**Cifra.** Un dato que se lee de un vistazo: pasajeros, cobrado, ganancia. Un rótulo en `text-sm` `texto-suave` y el valor en `text-3xl`, con la clase `cifra`. Si compara contra algo, lo dice en palabras: "de 12".

**Diálogo.** Confirmar algo que no se deshace o que tiene consecuencias de plata.
- **Implementación:** Radix `AlertDialog`. Al abrir, el foco va a "Volver"; se cierra con Esc y el foco vuelve al botón que lo abrió.
- **Contenido:**
  - El título es una pregunta: "¿Cancelar tu viaje al Camino Inca?".
  - El cuerpo dice qué pasa y cuánta plata.
  - Lleva dos botones: "Volver" (secundario) y la acción con su consecuencia ("Cancelar y recibir USD 1.200").
  - El botón por defecto es "Volver".

**Indicador de envío.** Si lo informado ya llegó a la agencia.
- Muestra "Todo enviado" con un punto `listo`, o "2 por enviar" con un punto `espera`.
- Siempre visible en la barra del guía, con `aria-live="polite"`.

### 3.5 Motivos (solo del cliente)

| Componente | Dónde | Reglas |
|---|---|---|
| **Portada con el nombre detrás de la montaña** | Inicio | Ver 02. Hasta 3 destacados, elegidos por el sistema (ver 01). Los nombres van arriba del texto, en serif 800 a 26 px (22 px en celular), con las flechas al lado. En celular el encabezado va sobre el tinte, la foto queda arriba con alto fijo (360 px) y el nombre detrás de la cresta, y debajo van los nombres y el texto sobre el tinte del circuito; no hay flechas, se pasa con los nombres o deslizando. El título de cada diapositiva usa `text-4xl` (30 px en celular) y reserva tres líneas, para que nada salte entre diapositivas. El nombre gigante aparece recién cuando cargó su foto. Nunca avanza sola: se probó el avance automático y se descartó el 18/11 porque interrumpe la lectura del precio y exige un botón de pausa. Con 1 destacado queda fija, sin nombres ni flechas. Fundido de 700 ms |
| **Faja** | Cierre de la portada y encabezado del comprobante | Decorativa (`aria-hidden`). En ningún otro lado |
| **Trama de piedra encajada** | Solo el fondo de la tarjeta de reseñas | Línea blanca al 10 %, desvanecida hacia arriba |
| **Andenes** | Ficha del viaje y barra de avance del guía | Cada andén es un día; su altura, la máxima del día. Siempre con texto o `aria-label` con los datos |
| **Lista de etapas** | Mi viaje y "En curso" del guía | Día, llegada, altura, distancia y campamento. Etapa actual con `aria-current="step"`. Funciona sin señal y el mapa, si hay, va arriba |
| **Pie** | Todas las páginas del cliente | Franja compacta en indigo-950 |

---

## 4. Las tres caras

Comparten tokens y componentes. Cambia cuánto se muestra y qué superficie predomina.

| | Cliente | Admin | Guía |
|---|---|---|---|
| Superficie | Algodón; índigo en la barra, las reseñas y el pie | Algodón; índigo solo en el lateral | Índigo en toda la app |
| Motivos | Sí, con las reglas de 3.5 | No | Solo los andenes y la lista de etapas |
| Texto base | 17 px | 17 px, tablas en 15 | 19 px |
| Botón principal | 48 px | 48 px | 64 px |
| Densidad | Aireada: una idea por bloque | Densa pero ordenada: lo urgente arriba | Una acción por pantalla |
| Conexión | Normal | Normal | Sin señal la mayor parte del tiempo: todo se guarda primero en el celular |

---

## 5. Patrones de estado

| Situación | Cómo se resuelve |
|---|---|
| **Vacío** | Una frase que dice qué falta y una acción para resolverlo: "Todavía no tenés viajes. Elegí tu camino." con el botón "Ver circuitos". Sin ilustraciones |
| **Cargando** | Esqueleto con la forma del contenido para listas y fichas. En botones, el texto de la acción en curso. Nada de pantallas en blanco con un círculo girando |
| **Error de carga** | Un aviso de error con "Reintentar" en el lugar del contenido, no en toda la pantalla |
| **Error de un campo** | En el campo (3.2), nunca solo arriba del formulario |
| **Conflicto (409)** | Se explica con el dato nuevo: "Mientras completabas los datos se vendieron los últimos lugares. Quedan 2." con la acción que sigue |
| **Sin señal (guía)** | Nunca bloquea: se guarda, se cuenta en el indicador de envío y se manda solo, en orden y sin duplicarse |
| **Acción que no se deshace** | Diálogo (3.4) con la consecuencia y la plata escritas |
| **Éxito** | Un mensaje corto junto a lo que cambió, con `role="status"`: "Listo, guardamos tus datos." Sin cartel flotante que se va solo |

---

## 6. Reglas de redacción

Completan el tono de 02.
- **Voseo siempre:** "Elegí", "Revisá", "Cancelá".
- **Se anuncia lo asegurado.** No se muestra al cliente el mínimo de pasajeros, si un hotel rechazó la reserva, ni el riesgo de que una salida no salga.
- **Sin códigos internos ni estados en mayúsculas** fuera del admin. En el admin, tampoco, salvo dentro del historial técnico.
- **Botones con verbo y consecuencia.** Si hay plata en juego, el monto va en el botón.
- **Errores en dos partes:** qué pasó y cómo seguir. Sin "Ups" y sin disculpas.
- **Fechas y números a la manera local:** "10 al 13 de diciembre", "4.215 m", "USD 1.500". Los plazos, relativos cuando ayudan a decidir: "Decidís en 6 días".
- **Nombres de lugares con su forma local:** Warmiwañusca, Wiñay Wayna, Intipunku.

---

## 7. Cómo se mantiene

- **Fuente única:** los tokens viven en un solo archivo CSS del front. Un color o tamaño nuevo entra primero acá y después en el código.
- **Para sumar un componente**, tiene que hacer falta en 3 lugares o más, tener un propósito que se pueda escribir en una línea, y cumplir 3.0 (foco, teclado, 44 px y las dos superficies). Si no, es un caso particular de la pantalla.
- **Máximo 5 variantes por componente.** Más que eso, son dos componentes.
- Los wireframes de [03-wireframes/](03-wireframes/) siguen usando `_base.css`; se alinearán a estos nombres cuando el front esté armado.
