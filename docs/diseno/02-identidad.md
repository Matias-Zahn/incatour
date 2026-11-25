# Identidad visual

Etapa 2. Dirección elegida: **Tejido**, en su segunda versión, atada al Camino Inca. La muestra está en [identidad.html](identidad.html).

## Qué cambió desde la primera ronda

- **La primera ronda se veía como montañismo genérico.** Los picos nevados y el perfil de altura eran ciertos, pero no decían nada del Camino Inca ni de la cultura andina. Se descartaron Altitud y Sendero.
- **Las franjas de colores de Tejido no se entendían.** Cada circuito tenía su secuencia de colores, pero era un código arbitrario: nadie lo podía leer sin una leyenda. Se sacó. Ahora ningún color significa algo que no esté dicho también con texto.
- **La cultura entra por tres lados:** el color sale de los tintes de los tejidos; la forma, de la arquitectura inca; y los lugares, del camino mismo.

## Punto de partida

- **Idioma:** solo español por ahora. Alegreya cubre inglés sin cambios.
- **Dónde se gasta la audacia:** en la vidriera del cliente. La compra es sobria, el admin es calmo y denso, y el guía es simple antes que lindo.
- **Qué evitamos:**
  - Lo genérico de IA: el fondo crema con acento terracota, el kit de tarjetas iguales con sombra gris, las etiquetas en mayúsculas sobre cada título.
  - El cliché andino: la chakana de adorno, la llama, el sol inca y la tipografía "de piedra tallada". Sin texturas de fondo.

## Paleta: los tintes del tejido

Son los colores de los tintes naturales con que se tiñe la lana en Chinchero y Pisac. Son la paleta de la interfaz, no un estampado.

| Nombre | Hex | Uso |
|---|---|---|
| Algodón | `#FFFFFF` | Fondo |
| Índigo | `#232850` | Texto y superficies oscuras (guía, vidriera) |
| Cochinilla | `#A3123A` | Acción principal y estado crítico |
| Q'olle | `#E8A817` | Lo destacado, solo sobre índigo |
| Chilca | `#2F6B2C` | Listo, confirmado |
| Piedra | `#E9E6DF` | Andenes y fondos de datos |
| Índigo suave | `#4B5170` | Texto secundario |

**Estados** (siempre con texto):

| Significado | Color | Ejemplos |
|---|---|---|
| Listo | Chilca `#2F6B2C` | Salida confirmada, hotel confirmado, todo enviado |
| En espera | `#8A5F00` | Tramitando permisos, estamos confirmando tu hotel |
| Riesgo | `#9C4A00` | Bajo el mínimo, riesgo de stock |
| Crítico | Cochinilla `#A3123A` | Incidente crítico, falta recurso |

**Contraste.** Todos los textos pasan AA sobre su fondo: índigo sobre algodón da 14:1, cochinilla sobre algodón 7,8:1, chilca 6,4:1 y q'olle sobre índigo 6,7:1. El q'olle no se usa como texto sobre fondo claro. El foco es un contorno de 3 px en cochinilla, separado 3 px del borde.

## Tipografía

**Alegreya** para títulos y **Alegreya Sans** para la interfaz y el texto. Las hizo Huerta Tipográfica, de Argentina. Tienen calidez caligráfica sin caer en lo "étnico".

| Uso | Familia | Peso | Tamaño |
|---|---|---|---|
| Nombre del circuito en la vidriera | Alegreya | 800 | 40 a 60 px |
| Títulos de pantalla | Alegreya | 700 | 26 a 32 px |
| Texto | Alegreya Sans | 400 | 17 px, interlineado 1,55 (19 px en la app del guía; ver 04) |
| Datos, precios y alturas | Alegreya Sans | 700 a 800 | Números alineados y tabulares |

Alegreya Sans trae por defecto números de texto (de altura variable). Quedan bien en párrafos, pero en precios, alturas, tablas y la bandeja del admin se usan números alineados (`lining-nums tabular-nums`).

## Tres motivos, cada uno en su lugar

| Motivo | Qué es | Dónde va | Qué comunica |
|---|---|---|---|
| **La faja tejida** | Una franja de pallay: rombos de cochinilla y q'olle sobre índigo, con bordes de chilca | Cierra la portada de la vidriera, como el borde de un aguayo, y encabeza el comprobante. En ningún otro lado | La marca. No codifica datos |
| **El nombre detrás de la montaña** | El nombre del circuito, enorme, con la cumbre de la foto por delante | La portada de la vidriera | Qué circuito es y dónde queda, en un solo gesto |
| **La trama de piedra encajada** | Las juntas de un muro de mampostería poligonal, en línea fina blanca al 10 %. Módulo con cada piedra distinta, para que no se note la repetición | Solo el fondo de las reseñas, desvaneciéndose de abajo hacia la mitad del bloque | La piedra del camino, detrás de lo que cuentan quienes lo hicieron |
| **Los andenes** | El recorrido por día como terrazas de piedra: cada anden es un día y su altura es la máxima de ese día | Ficha del viaje (cliente) y barra de avance (guía) | Un dato: cuánto se sube cada día |

## Fotografía

- **Lugares del camino, no paisaje genérico:** andenes, muros de piedra encajada, escalones, Wiñay Wayna, Runkurakay, el vano de Intipunku y la llegada a Machu Picchu al amanecer.
- **Personas chicas en el lugar, caminando.** Muestran escala y esfuerzo. Nada de selfies ni de grupos posando.
- **Gente local solo con su permiso y en su contexto** (porteadores, tejedoras de Chinchero), nunca como decorado.
- **Luz real:** sombras duras, niebla de la selva alta. Nada de atardeceres saturados.
- **Sin fotos propias todavía.** La muestra usa ilustraciones en su lugar. Hay que conseguir fotos reales de cada circuito antes de implementar.

## Iconografía

Línea de 1,75 px con esquinas apenas redondeadas, de un set abierto (Lucide). Solo íconos que suman a un texto o lo reemplazan donde no hay lugar. Ningún botón que sea solo un ícono sin nombre accesible.

## Tono de los textos

- **Voseo rioplatense, directo y concreto.** "Elegí la fecha", "Cancelá sin costo hasta 15 días antes", "Salida confirmada".
- **Se anuncia lo que está asegurado, no lo que podría fallar.** El mínimo de pasajeros no se menciona en la vidriera: solo aparece "Salida confirmada" cuando corresponde.
- **Los lugares con su nombre local y su altura:** Warmiwañusca, 4.215 m; Intipunku, la Puerta del Sol.
- **Números a la manera local:** 4.215 m, USD 750, 18/12.
- **Los botones dicen lo que pasa:** "Pagar USD 1.500", "Cerrar salida", "Llegué al abra".
- **Los errores dicen qué pasó y cómo seguir**, sin disculparse: "La tarjeta fue rechazada. Probá con otra o revisá los datos."
- **Ningún código interno ni estado en mayúsculas** para el cliente.

## Cómo se aplica en cada perfil

- **Cliente:** es la única parte con motivos. La portada elegida es la versión B: [identidad-home-b.html](identidad-home-b.html). La anterior queda como referencia en [identidad-home.html](identidad-home.html).
  - **Portada en carrusel, con el nombre detrás de la montaña.** Cada circuito ocupa la portada con una foto a sangre. El nombre, enorme y en Alegreya 800, va detrás de la cumbre: la montaña tapa como mucho un cuarto de cada letra, así la palabra se lee entera. El recorte sigue el contorno real del cerro y está dibujado dentro de la imagen (SVG), así queda alineado en cualquier tamaño.
  - **La foto manda.** Sobre la foto solo hay una sombra neutra en la franja del texto, con un toque mínimo del tinte del circuito (índigo, cochinilla o chilca). Sin textura tejida sobre la foto.
  - **Se pasa con flechas o con los nombres de los circuitos**, que van debajo del texto. No avanza solo.
  - **Cada foto necesita una cumbre nítida contra el cielo.** Es un requisito para elegir las fotos definitivas: con cielo nublado o nieve contra nubes blancas, el efecto no funciona.
  - **La faja tejida** cierra la portada.
  - **Las secciones alternan fondo**: algodón para los circuitos, índigo muy claro `#ECEDF5` para las próximas salidas y una tarjeta índigo flotante para las reseñas, con la garantía en un bloque q'olle.
  - **Las reseñas llevan la trama de piedra encajada**, que se apaga de abajo hacia arriba: el texto queda siempre sobre la parte más tenue. Es decorativa y no se anuncia a los lectores de pantalla.
  - **Las reseñas son una tarjeta índigo que flota** sobre fondo claro, con esquinas redondeadas y una sombra suave. Así se separan del pie y pesan más que él.
  - **El pie es una franja compacta** en un índigo más profundo (`#1C2044`): una fila con la marca, los enlaces y el teléfono de emergencias, y debajo la letra chica. No compite con el contenido.
  - **El recorrido** va en andenes. Las fotos chicas de la lista de circuitos llevan las esquinas apenas redondeadas.
  - **Descartado:** el recorte de la foto como vano trapezoidal, la foto fundida a un costado de un fondo de color pleno, la textura tejida sobre la foto, el muro dibujado en el pie, la franja de tocapus de color y los motivos sueltos (hornacina, andén, ventana y otros), que se leían como íconos.
- **Admin:** algodón e índigo, Alegreya Sans, la barra de color del estado al costado de cada ítem. Sin faja ni vano.
- **Guía:** fondo índigo con texto blanco, botones grandes y los andenes como barra de avance. Nada más.
