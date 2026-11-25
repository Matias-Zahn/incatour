/**
 * Base de demo creada con la aplicación, sin seed: dos años de operación para que los reportes tengan sentido.
 * Uso, desde backend, con Docker levantado: npm run demo   (resetea DEMO_DB, por defecto incatour_demo)
 * Después levantar el back contra esa base (DATABASE_URL apuntando a incatour_demo).
 *
 * Todo pasa por la API real: catálogo, proveedores, personal, salidas con su personal y transporte, compras (que ocupan
 * el equipo del paquete), solicitudes, cancelaciones, confirmación, avances, incidentes, reseñas y evaluaciones.
 * Solo toca la base directo en lo que la API no puede hacer:
 *  - crear el administrador (no hay alta de administradores);
 *  - que pase el corte de venta de una salida operada en el futuro, para confirmarla (CU-40 solo confirma después del corte);
 *  - viajar en el tiempo: la API no opera sobre el pasado, así que cada salida histórica se opera a fecha + 3 años
 *    (misma temporada y misma tarifa) y al final se la lleva a su fecha real junto con todas sus marcas de tiempo.
 * Al terminar corre verificar(): si un dato queda inconsistente, el script falla.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { crearEntorno, idDe, resumen } from "./lib-prueba";
import { fecha, hace } from "./integral/contexto";

const DEMO_DB = process.env.DEMO_DB ?? "incatour_demo";
const PUERTO = 3997;
const H = 3600 * 1000;
const ANIOS_DE_VIAJE = 3;
const CLAVE_CLIENTE = "cliente123";
const CLAVE_GUIA = "guia12345";

// Generador con semilla: dos corridas arman la misma historia
let semilla = 20261031;
function azar() {
  semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a: number, b: number) => a + Math.floor(azar() * (b - a + 1));
const elegir = <T>(lista: readonly T[]) => lista[entre(0, lista.length - 1)]!;
const mezclar = <T>(lista: readonly T[]) => [...lista].map((x) => [azar(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

const sumarDias = (iso: string, dias: number) => new Date(new Date(iso).getTime() + dias * 24 * H).toISOString().slice(0, 10);
const masAnios = (iso: string, anios: number) => `${Number(iso.slice(0, 4)) + anios}${iso.slice(4)}`;
const antesDe = (iso: string, tope: string) => (iso < tope ? iso : tope);
const instante = (iso: string, hora: number) => new Date(`${iso}T${String(hora).padStart(2, "0")}:00:00.000Z`);

const TEMPORADAS = [
  { nombre: "Baja", desde: "01-01", hasta: "03-31", factor: 0.85, demanda: 0.5 },
  { nombre: "Media", desde: "04-01", hasta: "05-31", factor: 1, demanda: 0.7 },
  { nombre: "Alta", desde: "06-01", hasta: "09-30", factor: 1.25, demanda: 0.92 },
  { nombre: "Fin de año", desde: "10-01", hasta: "12-31", factor: 1, demanda: 0.65 },
];
const temporadaDe = (iso: string) => TEMPORADAS.find((t) => iso.slice(5) >= t.desde && iso.slice(5) <= t.hasta)!;

const CIRCUITOS = {
  clasico: { nombre: "Camino Inca Clásico", dias: 4, dificultad: "Alta", etapas: [["Km 82 (Piscacucho)", "Wayllabamba"], ["Wayllabamba", "Pacaymayo"], ["Pacaymayo", "Wiñay Wayna"], ["Wiñay Wayna", "Machu Picchu"]] },
  corto: { nombre: "Camino Inca Corto", dias: 2, dificultad: "Media", etapas: [["Km 104", "Wiñay Wayna"], ["Wiñay Wayna", "Machu Picchu"]] },
  salkantay: { nombre: "Salkantay", dias: 5, dificultad: "Alta", etapas: [["Mollepata", "Soraypampa"], ["Soraypampa", "Chaullay"], ["Chaullay", "La Playa"], ["La Playa", "Aguas Calientes"], ["Aguas Calientes", "Machu Picchu"]] },
  lares: { nombre: "Valle de Lares", dias: 3, dificultad: "Media", etapas: [["Lares", "Huacahuasi"], ["Huacahuasi", "Patacancha"], ["Patacancha", "Ollantaytambo"]] },
} as const;

// [nombre, probabilidad de rechazar una solicitud, costo por noche en USD, plazas libres hoy]
type Hotel = [string, number, number, number];
type Zona = { localidad: string; categoria: string; modalidad: "BLOQUEO_PLAZAS" | "A_SOLICITUD"; hoteles: Hotel[] };
const ZONAS: Record<string, Zona> = {
  cusco3: { localidad: "Cusco", categoria: "3 Estrellas", modalidad: "BLOQUEO_PLAZAS", hoteles: [["Hostal Wayra San Blas", 0, 48, 12], ["Hotel Tikari Cusco", 0, 62, 22]] },
  cusco4: { localidad: "Cusco", categoria: "4 Estrellas", modalidad: "A_SOLICITUD", hoteles: [["Hotel Killa Imperial", 0.45, 118, 14], ["Ayllu Boutique Cusco", 0.2, 132, 8], ["Hotel Antawasi Plaza", 0.3, 104, 18]] },
  aguas: { localidad: "Aguas Calientes", categoria: "3 Estrellas", modalidad: "A_SOLICITUD", hoteles: [["Hostal Rumi Wasi", 0.5, 58, 10], ["Hotel Vilcanota Lodge", 0.25, 74, 16], ["Hostal Inti Pakarina", 0.15, 52, 6]] },
  ollanta: { localidad: "Ollantaytambo", categoria: "3 Estrellas", modalidad: "BLOQUEO_PLAZAS", hoteles: [["Hotel Tambo Ollanta", 0, 55, 20]] },
};
// B10: el hostal chico no cubre una salida solo, así las de Cusco reparten el grupo entre los dos hoteles
const PLAZAS_PARA_OPERAR: Record<string, number> = { "Hostal Wayra San Blas": 8 };

// [empresa, vehículo, asientos, costo del traslado, canal] (el equipaje se cobra en persona)
// [empresa, vehículo, asientos, costo, canal, kg de equipaje incluidos, USD por kg excedente (solo informativo)]
const TRANSPORTES: [string, string, number, number, string, number, number][] = [
  ["Trans Andes", "Sprinter 19 asientos", 19, 95, "WhatsApp", 15, 6],
  ["Vilcanota Tours", "Coaster 25 asientos", 25, 130, "Email", 20, 5],
  ["Inka Express Bus", "Bus 33 asientos", 33, 180, "Email", 23, 4],
  ["Valle Sagrado Traslados", "Sprinter 19 asientos", 19, 90, "WhatsApp", 15, 7],
  ["Cusco Van", "Hiace 20 asientos", 20, 100, "Teléfono", 15, 6.5],
  ["Qosqo Móvil", "Coaster 25 asientos", 25, 125, "WhatsApp", 20, 5.5],
  // Flota de reemplazo: la demo elige transportes que no encarezcan el paquete (uno más caro se permite, con aviso)
  ["Andes Sur Turismo", "Coaster 25 asientos", 25, 110, "WhatsApp", 20, 4.5],
  ["Ruta Imperial", "Coaster 25 asientos", 25, 115, "Email", 20, 5],
  ["Ollanta Express", "Sprinter 19 asientos", 19, 85, "Teléfono", 12, 8],
];
// Equipamiento de campamento: [artículo, tipo, inventario, costo por unidad]
const EQUIPOS: [string, string, number, number][] = [
  ["Carpa doble 4 estaciones", "Carpa", 60, 12],
  ["Bolsa de dormir -10 °C", "Bolsa de dormir", 120, 6],
  ["Colchoneta autoinflable", "Colchoneta", 120, 3],
  ["Carpa comedor con mesa y bancos", "Carpa comedor", 10, 25],
];
// Catálogo de base que ningún paquete usa (otras habitaciones, otro tren, más artículos): el sistema se ve poblado
// [nombre, localidad, categoría, tipo de habitación, costo por noche, modalidad, plazas (solo bloqueo), canal]
const HOTELES_EXTRA: [string, string, string, string, number, "BLOQUEO_PLAZAS" | "A_SOLICITUD", number | null, string][] = [
  // Cusco 3★ doble con costos distintos: el más económico es la referencia del precio "desde"; elegir uno más caro
  // en la salida hace que la revisión avise la diferencia por pasajero
  ["Hostal Inti Wasi Cusco", "Cusco", "3 Estrellas", "Doble", 40, "BLOQUEO_PLAZAS", 20, "WhatsApp"],
  ["Hotel Plaza Regocijo", "Cusco", "3 Estrellas", "Doble", 78, "BLOQUEO_PLAZAS", 24, "Email"],
  ["Palacio Inka Cusco", "Cusco", "5 Estrellas", "Suite", 260, "A_SOLICITUD", null, "Email"],
  ["Casa Andina Cusco Plaza", "Cusco", "4 Estrellas", "Matrimonial", 140, "BLOQUEO_PLAZAS", 20, "Email"],
  ["Hostal Qorikancha", "Cusco", "3 Estrellas", "Triple", 45, "BLOQUEO_PLAZAS", 15, "WhatsApp"],
  ["Sumaq Machu Picchu", "Aguas Calientes", "5 Estrellas", "Suite", 320, "A_SOLICITUD", null, "Email"],
  ["Ecolodge Urubamba Valley", "Urubamba", "4 Estrellas", "Matrimonial", 110, "A_SOLICITUD", null, "Teléfono"],
  ["Hostal Pisac Inn", "Pisac", "3 Estrellas", "Simple", 40, "BLOQUEO_PLAZAS", 10, "WhatsApp"],
];
const EQUIPOS_EXTRA: [string, string, number, number][] = [
  ["Bastones de trekking (par)", "Bastones", 80, 2],
  ["Botiquín de primeros auxilios", "Botiquín", 15, 8],
  ["Cocina a gas con garrafa", "Cocina", 12, 15],
];
const EQUIPOS_REEMPLAZO: [string, string, number, number][] = [
  ["Carpa Andes 3 estaciones", "Carpa", 30, 10],
  ["Bolsa de dormir -5 °C", "Bolsa de dormir", 60, 5],
  ["Colchoneta de espuma", "Colchoneta", 60, 2],
  ["Carpa comedor plegable", "Carpa comedor", 4, 22],
];

const PAQUETES = [
  // tren: servicio de tren de vuelta desde Aguas Calientes (null: no toma tren); transporte: índice en TRANSPORTES
  { nombre: "Camino Inca Clásico 4 días", circuito: "clasico", zona: "cusco3", tarifa: 780, previas: 1, posteriores: 1, cupo: 16, peso: 4, tren: 0, transporte: 1 },
  { nombre: "Camino Inca Premium", circuito: "clasico", zona: "cusco4", tarifa: 1150, previas: 2, posteriores: 1, cupo: 10, peso: 2, tren: 1, transporte: 0 },
  { nombre: "Camino Inca Express", circuito: "corto", zona: "aguas", tarifa: 490, previas: 0, posteriores: 1, cupo: 12, peso: 3, tren: 0, transporte: 4 },
  { nombre: "Salkantay Aventura", circuito: "salkantay", zona: "cusco3", tarifa: 690, previas: 1, posteriores: 1, cupo: 14, peso: 2, tren: 0, transporte: 5 },
  // establecimiento: garantiza el hotel de su zona por nombre (RF-06); los demás garantizan solo la categoría
  { nombre: "Lares Cultural", circuito: "lares", zona: "ollanta", tarifa: 540, previas: 1, posteriores: 0, cupo: 10, peso: 1, tren: null, transporte: 3, establecimiento: true },
] as const;

// Nombres, pasaportes y correos según el país: una nómina creíble
const PAISES = [
  { nacionalidad: "Argentina", peso: 5, pasaporte: () => `AA${letra()}${digitos(6)}`, nombres: ["Lucía", "Martín", "Sofía", "Tomás", "Valentina", "Nicolás", "Julieta", "Facundo", "Agustina", "Gonzalo", "Florencia", "Joaquín"], apellidos: ["Fernández", "González", "Rodríguez", "López", "Martínez", "Sosa", "Romero", "Álvarez", "Benítez", "Acosta", "Medina", "Herrera"], dominios: ["gmail.com", "hotmail.com", "yahoo.com.ar"] },
  { nacionalidad: "Chilena", peso: 2, pasaporte: () => `F${digitos(8)}`, nombres: ["Camila", "Benjamín", "Antonia", "Vicente", "Catalina", "Matías", "Javiera", "Cristóbal"], apellidos: ["Muñoz", "Rojas", "Díaz", "Soto", "Contreras", "Silva", "Morales", "Fuentes"], dominios: ["gmail.com", "hotmail.com"] },
  { nacionalidad: "Uruguaya", peso: 1, pasaporte: () => `C${digitos(6)}`, nombres: ["Florencia", "Santiago", "Lucía", "Federico", "Paula", "Diego"], apellidos: ["Pereira", "Rodríguez", "Méndez", "Techera", "Olivera", "Cabrera"], dominios: ["gmail.com", "adinet.com.uy"] },
  { nacionalidad: "Brasileña", peso: 2, pasaporte: () => `F${letra()}${digitos(6)}`, nombres: ["Thiago", "Ana", "Pedro", "Beatriz", "Lucas", "Mariana", "Gabriel", "Larissa"], apellidos: ["Silva", "Santos", "Oliveira", "Souza", "Costa", "Pereira", "Almeida", "Ribeiro"], dominios: ["gmail.com", "uol.com.br", "hotmail.com"] },
  { nacionalidad: "Colombiana", peso: 1, pasaporte: () => `A${letra()}${digitos(6)}`, nombres: ["Andrés", "Valeria", "Felipe", "Daniela", "Sebastián", "Laura"], apellidos: ["Restrepo", "Gómez", "Cárdenas", "Ospina", "Vargas", "Mejía"], dominios: ["gmail.com", "hotmail.com"] },
  { nacionalidad: "Mexicana", peso: 1, pasaporte: () => `G${digitos(8)}`, nombres: ["Diego", "Ximena", "Emiliano", "Regina", "Rodrigo", "Fernanda"], apellidos: ["Hernández", "García", "Ramírez", "Flores", "Torres", "Navarro"], dominios: ["gmail.com", "outlook.com"] },
  { nacionalidad: "Española", peso: 2, pasaporte: () => `PA${letra()}${digitos(6)}`, nombres: ["Pablo", "Lucía", "Alejandro", "Marta", "Javier", "Carmen", "Hugo", "Elena"], apellidos: ["García", "Martín", "Ruiz", "Jiménez", "Moreno", "Navarro", "Serrano", "Molina"], dominios: ["gmail.com", "hotmail.es"] },
  { nacionalidad: "Peruana", peso: 1, pasaporte: () => digitos(9), nombres: ["José", "María", "Luis", "Rosa", "Jorge", "Milagros"], apellidos: ["Quispe", "Flores", "Huamán", "Chávez", "Mendoza", "Vargas"], dominios: ["gmail.com", "hotmail.com"] },
] as const;
type Pais = (typeof PAISES)[number];
const LETRAS = "ABCDEFGHJKLMNPRSTUVWXYZ";
const letra = () => LETRAS[entre(0, LETRAS.length - 1)]!;
const digitos = (n: number) => Array.from({ length: n }, (_, i) => entre(i === 0 ? 1 : 0, 9)).join("");
// Vencimientos repartidos, siempre después de las salidas que se operan en el futuro (hasta tres años adelante)
const vencimiento = () => `${entre(2030, 2036)}-${String(entre(1, 12)).padStart(2, "0")}-${String(entre(1, 28)).padStart(2, "0")}`;
const GUIAS = ["Carlos Mendoza", "Rosa Huamán", "Marcos Quispe", "Elena Condori", "Raúl Mamani", "Sofía Ccori", "Hernán Apaza", "Pilar Yupanqui"];
const PORTEADORES = ["Julián Quispe", "Wilber Huamán", "Rubén Condori", "Efraín Mamani", "Percy Choque", "Edwin Puma", "Fredy Ccahuana", "Nilo Sallo", "Abel Turpo", "Ciro Hancco", "Dante Illa", "Elmer Pacco", "Fidel Roque", "Germán Sutta", "Hilario Tito", "Isaías Umasi", "Jaime Vilca", "Lino Waman", "Mario Yucra", "Néstor Zúñiga", "Óscar Arqque", "Pablo Bellota", "Raúl Cusi", "Saúl Dueñas", "Teodoro Ayma", "Ulises Ccori", "Valerio Huillca", "Wenceslao Ccama", "Yuri Chura", "Zenón Paucar", "Alcides Quispe", "Benito Huarca", "Cirilo Mayta", "Domingo Sonco", "Eusebio Taco", "Felipe Ninan", "Gregorio Apaza", "Hugo Callo"];
const MOTIVOS_RECHAZO = ["Sin disponibilidad en las fechas solicitadas", "Cupo tomado por un grupo", "Cierre por refacciones", "Tarifa no vigente para la temporada"];
const MOTIVOS_CANCELACION = ["Cambio de planes", "Problemas de salud", "Motivos laborales", "Encontró otra fecha", "Problema con el vuelo"];
const COMENTARIOS: Record<number, string[]> = {
  5: [
    "Una experiencia inolvidable, el guía fue excelente.", "Todo perfecto, de principio a fin.", "Superó lo que esperábamos.",
    "Llegar a la Puerta del Sol al amanecer no tiene precio. Gracias al equipo.", "Los porteadores son unos genios, siempre con una sonrisa.",
    "La comida en los campamentos fue increíble, no lo esperábamos en la montaña.", "Nuestro guía sabía muchísimo de historia inca, se hizo corto.",
    "Organización impecable: nos buscaron puntuales en el hotel y nunca faltó nada.", "Lo volvería a hacer mañana. Recomendadísimo.",
    "El paso de Warmiwañusca fue duro, pero el grupo y el guía nos acompañaron todo el tiempo.", "Viajé sola y me sentí cuidada en todo momento.",
    "Excelente relación entre precio y calidad. Las carpas, en muy buen estado.",
  ],
  4: [
    "Muy linda experiencia, con algún detalle en la logística.", "Muy bueno, los campamentos cómodos.",
    "El recorrido es espectacular; el hotel de la noche previa, correcto sin más.", "Todo bien, aunque el bus de vuelta salió con demora.",
    "Buen guía y buen grupo. Hubiera venido bien más información antes de viajar.", "Muy recomendable. La bolsa de dormir se quedó corta con el frío de la segunda noche.",
    "Hermoso. El último día fue un poco apurado para recorrer Machu Picchu.", "Gran experiencia, la comida un poco repetitiva.",
  ],
  3: [
    "Correcto, esperaba un poco más del alojamiento.", "Bien, aunque hubo demoras.", "El paisaje lo vale, la organización fue regular.",
    "Nos cambiaron el hotel a último momento y no nos avisaron bien.", "El guía cambió a mitad de camino y se notó.",
  ],
  2: [
    "La organización dejó que desear.", "Demoras y poca información.", "El tren de vuelta no estaba reservado y esperamos dos horas.",
    "La carpa tenía una rotura y entró agua la primera noche.",
  ],
};
const INCIDENTES = [
  ["SALUD", "Pasajero con malestar por la altura", "BAJO"], ["SALUD", "Esguince de tobillo en el descenso", "MEDIO"], ["CLIMA", "Lluvia intensa demoró el tramo", "BAJO"],
  ["RETRASO", "Demora del transporte al punto de inicio", "BAJO"], ["EQUIPAMIENTO", "Carpa dañada por el viento", "MEDIO"], ["ACCIDENTE", "Caída en un tramo con piedras sueltas", "CRITICO"], ["OTRO", "Pasajero extravió su documentación", "MEDIO"],
] as const;

type Persona = { nombre: string; apellido: string; pais: Pais; pasaporte: string; vence: string };
type Cliente = Persona & { idcliente: number; idusuario: number; token: string; primeraCompra?: string };
type Etapa = "historica" | "encurso" | "cerrada" | "publicada" | "pendiente";
type Plan = { virtual: string; paquete: (typeof PAQUETES)[number]; etapa: Etapa; vender?: number; dejarSolicitudes?: boolean; carlos?: boolean; cancelada?: boolean; deHoy?: boolean; juan?: boolean };

/** Calendario de salidas: desde hace dos años hasta cinco meses adelante. En febrero el Camino Inca cierra */
function armarCalendario(hoy: string) {
  const planes: Plan[] = [];
  const bolsa = PAQUETES.flatMap((p) => Array.from({ length: p.peso }, () => p));
  for (let meses = -23; meses <= 5; meses++) {
    const base = new Date(`${hoy.slice(0, 7)}-01`);
    base.setUTCMonth(base.getUTCMonth() + meses);
    const mes = base.toISOString().slice(0, 7);
    if (mes.endsWith("-02")) continue;
    const dias = mezclar([3, 6, 9, 12, 15, 18, 21, 24, 27]);
    const cantidad = temporadaDe(`${mes}-15`).nombre === "Alta" ? 5 : 3;
    for (let i = 0; i < cantidad; i++) {
      const paquete = elegir(bolsa);
      const virtual = `${mes}-${String(dias[i]).padStart(2, "0")}`;
      const fin = sumarDias(virtual, CIRCUITOS[paquete.circuito].dias - 1);
      // Las salidas alrededor de hoy se arman a mano abajo. Hasta hoy + 5 no se pueden crear: la venta nacería
      // cerrada con el corte a solicitud (DIAS_CIERRE_SOLICITUD, 12.6)
      if (fin >= sumarDias(hoy, -1) && virtual <= sumarDias(hoy, 5)) continue;
      const etapa = fin < hoy ? "historica" : virtual <= sumarDias(hoy, 25) ? "cerrada" : "publicada";
      planes.push({ virtual, paquete, etapa });
    }
  }
  const clasico = PAQUETES[0];
  // Para la presentación: dos en curso con otros guías (una al día y una atrasada, que empezó hace dos días y solo
  // informó la etapa 1) y la de Carlos que empieza hoy, lista para iniciarla en vivo
  planes.push({ virtual: sumarDias(hoy, -2), paquete: clasico, etapa: "encurso" });
  planes.push({ virtual: sumarDias(hoy, -1), paquete: clasico, etapa: "encurso" });
  planes.push({ virtual: hoy, paquete: clasico, etapa: "cerrada", carlos: true, deHoy: true });
  planes.push({ virtual: sumarDias(hoy, 12), paquete: clasico, etapa: "cerrada", carlos: true });
  // B4: terminó la venta y falta confirmarla, para hacerlo en vivo (se opera en el futuro y se trae a su fecha)
  planes.push({ virtual: sumarDias(hoy, 2), paquete: clasico, etapa: "pendiente", vender: 1 });
  // Venta terminada con la mitad vendida y hotel a solicitud: antes de confirmar hay que resolver los alojamientos
  // pendientes, y al confirmar sobran porteadores y el admin elige cuáles libera
  planes.push({ virtual: sumarDias(hoy, 2), paquete: PAQUETES[2], etapa: "pendiente", vender: 0.5, dejarSolicitudes: true });
  // Vendida a la mitad y hoy es su último día de venta: la fecha mínima (hoy + corte + 1)
  planes.push({ virtual: sumarDias(hoy, 3), paquete: PAQUETES[3], etapa: "publicada", vender: 0.5 });
  const historicas = planes.filter((p) => p.etapa === "historica");
  for (const i of [7, 25, 44]) historicas[i]!.cancelada = true;
  planes.sort((a, b) => a.virtual.localeCompare(b.virtual));
  // Juan tiene una salida terminada sin reseñar y una reserva a la venta que puede cancelar con reintegro
  planes.filter((p) => p.etapa === "historica" && !p.cancelada).at(-1)!.juan = true;
  planes.find((p) => p.etapa === "publicada" && !p.vender)!.juan = true;
  return planes;
}

async function main() {
  const hoy = fecha(0);
  const entorno = crearEntorno(DEMO_DB);
  entorno.resetear({ seed: false });
  const db = new PrismaClient({ datasources: { db: { url: entorno.DB_URL } } });
  await db.usuario.create({
    data: { nombre: "Carolina", apellido: "Vargas", email: "admin@incatour.com", contrasenia: await bcrypt.hash("AdminIncaTour123", 10), rol: "ADMIN", estado: "ACTIVO" },
  });

  const back = await entorno.levantarBack(PUERTO);
  try {
    const admin = await back.login("admin@incatour.com", "AdminIncaTour123");

    async function api(metodo: string, ruta: string, body?: unknown, token = admin): Promise<any> {
      const r = await back.llamar(metodo, ruta, body, token);
      if (r.status < 200 || r.status >= 300) throw new Error(`${metodo} ${ruta} → ${r.status} ${resumen(r.body)}${r.error}`);
      return r.body?.data ?? r.body;
    }

    // ==================== Catálogo ====================
    console.log("Catálogo, proveedores y personal...");
    const tarifasPorFactor: { idtemporada: number; factor: number }[] = [];
    for (let anio = 2024; anio <= 2029; anio++) {
      for (const t of TEMPORADAS) {
        const creada = await api("POST", "/temporadas", { nombre: `${t.nombre} ${anio}`, fechaInicio: `${anio}-${t.desde}`, fechaFin: `${anio}-${t.hasta}` });
        tarifasPorFactor.push({ idtemporada: idDe(creada, "idtemporada")!, factor: t.factor });
      }
    }

    const circuitos: Record<string, number> = {};
    for (const [clave, c] of Object.entries(CIRCUITOS)) {
      const creado = await api("POST", "/circuitos", { nombreCircuito: c.nombre, duracionDias: c.dias, dificultad: c.dificultad, minimoGuias: 1, parametrosPorteadores: "1 por cada 2 pasajeros" });
      const idcircuito = idDe(creado, "idcircuito")!;
      circuitos[clave] = idcircuito;
      await api("PUT", `/circuitos/${idcircuito}/etapas`, {
        etapas: c.etapas.map(([puntoInicio, puntoFin], i) => ({ numeroOrden: i + 1, puntoInicio, puntoFin, campamentoPrevisto: i + 1 === c.etapas.length ? "Sin campamento" : `Campamento ${puntoFin}` })),
      });
    }

    const correo = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-zA-Z]+/g, ".").toLowerCase();
    const hoteles: Record<string, { idservicio: number; idproveedor: number; rechazo: number; plazasHoy: number }[]> = {};
    for (const [clave, z] of Object.entries(ZONAS)) {
      hoteles[clave] = [];
      for (const [nombre, rechazo, costo, plazasHoy] of z.hoteles) {
        const dominio = `${correo(nombre).replace(/\./g, "")}.com.pe`;
        const prov = await api("POST", "/proveedores", { tipoProveedor: "ALOJAMIENTO", razonSocial: `${nombre} S.A.C.`, localidad: z.localidad, datosContacto: `reservas@${dominio}`, canalComunicacion: "Email" });
        const idproveedor = idDe(prov, "idproveedor")!;
        // La historia se opera con capacidad de sobra (varias salidas pueden compartir noches) y al final
        // se deja lo que el hotel tiene libre hoy
        const s = await api("POST", `/proveedores/${idproveedor}/servicios`, {
          tipo: "ALOJAMIENTO", nombreServicio: nombre, localidad: z.localidad, costoBase: costo, categoria: z.categoria, tipoHabitacion: "Doble", capacidadDisponible: PLAZAS_PARA_OPERAR[nombre] ?? 900, modalidadConfirmacion: z.modalidad,
        });
        hoteles[clave]!.push({ idservicio: idDe(s, "idservicio")!, idproveedor, rechazo, plazasHoy });
      }
    }

    const transportes: { idservicio: number; idproveedor: number; asientos: number; costo: number; ocupado: [string, string][] }[] = [];
    for (const [empresa, vehiculo, asientos, costo, canal, kg, excedente] of TRANSPORTES) {
      const contacto = canal === "Email" ? `operaciones@${correo(empresa).replace(/\./g, "")}.com.pe` : `+51 984 ${digitos(3)} ${digitos(3)}`;
      const prov = await api("POST", "/proveedores", { tipoProveedor: "TRANSPORTE", razonSocial: `${empresa} E.I.R.L.`, localidad: "Cusco", datosContacto: contacto, canalComunicacion: canal });
      const idproveedor = idDe(prov, "idproveedor")!;
      const s = await api("POST", `/proveedores/${idproveedor}/servicios`, { tipo: "TRANSPORTE", nombreServicio: `${empresa} · ${vehiculo}`, localidad: "Cusco", costoBase: costo, capacidadVehiculo: asientos, pesoEquipajeIncluido: kg, costoPorKgExcedente: excedente });
      transportes.push({ idservicio: idDe(s, "idservicio")!, idproveedor, asientos, costo, ocupado: [] });
    }

    // Tren de vuelta desde Aguas Calientes
    const ferrocarril = idDe(await api("POST", "/proveedores", { tipoProveedor: "TREN", razonSocial: "Ferrocarril del Vilcanota S.A.", localidad: "Aguas Calientes", datosContacto: "grupos@ferrovilcanota.com.pe", canalComunicacion: "Email" }), "idproveedor")!;
    const trenes: number[] = [];
    for (const [nombre, costo, sale, llega] of [["Tren Expedition Aguas Calientes - Ollantaytambo", 70, "14:55", "16:45"], ["Tren Vistadome Aguas Calientes - Ollantaytambo", 95, "16:22", "17:58"]] as const) {
      const s = await api("POST", `/proveedores/${ferrocarril}/servicios`, { tipo: "TREN", nombreServicio: nombre, localidad: "Aguas Calientes", costoBase: costo, horarioSalida: sale, horarioLlegada: llega, diasOperacion: "L-M-X-J-V-S-D" });
      trenes.push(idDe(s, "idservicio")!);
    }

    // Equipamiento de campamento: se presta en cada salida y vuelve al terminar
    const alquiler = idDe(await api("POST", "/proveedores", { tipoProveedor: "EQUIPAMIENTO", razonSocial: "Andes Outdoor Rental E.I.R.L.", localidad: "Cusco", datosContacto: "+51 974 318 552", canalComunicacion: "WhatsApp" }), "idproveedor")!;
    const equipos: Record<string, number> = {};
    for (const [nombre, tipoEquipamiento, inventario, costo] of EQUIPOS) {
      const s = await api("POST", `/proveedores/${alquiler}/servicios`, { tipo: "EQUIPAMIENTO", nombreServicio: nombre, localidad: "Cusco", costoBase: costo, tipoEquipamiento, cantidadDisponible: inventario });
      equipos[tipoEquipamiento] = idDe(s, "idservicio")!;
    }
    for (const [nombre, tipoEquipamiento, inventario, costo] of EQUIPOS_EXTRA) {
      await api("POST", `/proveedores/${alquiler}/servicios`, { tipo: "EQUIPAMIENTO", nombreServicio: nombre, localidad: "Cusco", costoBase: costo, tipoEquipamiento, cantidadDisponible: inventario });
    }
    for (const [nombre, localidad, categoria, tipoHabitacion, costo, modalidad, plazas, canal] of HOTELES_EXTRA) {
      const contacto = canal === "Email" ? `reservas@${correo(nombre).replace(/\./g, "")}.com.pe` : `+51 984 ${digitos(3)} ${digitos(3)}`;
      const prov = idDe(await api("POST", "/proveedores", { tipoProveedor: "ALOJAMIENTO", razonSocial: `${nombre} S.A.C.`, localidad, datosContacto: contacto, canalComunicacion: canal }), "idproveedor")!;
      await api("POST", `/proveedores/${prov}/servicios`, {
        tipo: "ALOJAMIENTO", nombreServicio: nombre, localidad, costoBase: costo, categoria, tipoHabitacion, modalidadConfirmacion: modalidad, ...(plazas !== null && { capacidadDisponible: plazas }),
      });
    }
    const incaRail = idDe(await api("POST", "/proveedores", { tipoProveedor: "TREN", razonSocial: "Inca Rail Andino S.A.", localidad: "Aguas Calientes", datosContacto: "ventas@incarailandino.com.pe", canalComunicacion: "Email" }), "idproveedor")!;
    await api("POST", `/proveedores/${incaRail}/servicios`, { tipo: "TREN", nombreServicio: "Tren The Voyager Aguas Calientes - Ollantaytambo", localidad: "Aguas Calientes", costoBase: 85, horarioSalida: "15:20", horarioLlegada: "17:10", diasOperacion: "L-X-V-D" });

    // CU-39: un segundo proveedor con un artículo de cada tipo, para reemplazar el equipo de una salida si el primero falla
    const reemplazo = idDe(await api("POST", "/proveedores", { tipoProveedor: "EQUIPAMIENTO", razonSocial: "Perú Trek Gear S.A.C.", localidad: "Cusco", datosContacto: "alquiler@perutrekgear.com.pe", canalComunicacion: "Email" }), "idproveedor")!;
    for (const [nombre, tipoEquipamiento, inventario, costo] of EQUIPOS_REEMPLAZO) {
      await api("POST", `/proveedores/${reemplazo}/servicios`, { tipo: "EQUIPAMIENTO", nombreServicio: nombre, localidad: "Cusco", costoBase: costo, tipoEquipamiento, cantidadDisponible: inventario });
    }

    const paquetes = new Map<string, number>();
    for (const p of PAQUETES) {
      const z = ZONAS[p.zona]!;
      const pq = await api("POST", "/paquetes", {
        idcircuito: circuitos[p.circuito], nombrePaquete: p.nombre, condiciones: "Incluye permisos de ingreso, guía y porteadores. Reintegro total hasta 15 días antes de la salida.",
        localidadGarantizada: z.localidad, // "Sale desde": obligatoria con las dos garantías
        ...("establecimiento" in p
          ? { tipoGarantia: "POR_ESTABLECIMIENTO", idservicioGarantizado: hoteles[p.zona]![0]!.idservicio }
          : { tipoGarantia: "POR_CATEGORIA", categoriaGarantizada: z.categoria, tipoHabitacionGarantizada: "Doble" }),
        nochesPrevias: p.previas, nochesPosteriores: p.posteriores, diasMinimosReintegro: 15,
        // Solo informativo: el Camino Inca regula el peso que carga cada porteador; el excedente se paga en el lugar
        kgPorteador: p.circuito === "clasico" || p.circuito === "corto" ? 7 : 8, costoKgExcedentePorteador: p.circuito === "clasico" ? 12 : 10,
        matrizPrecios: tarifasPorFactor.map((t) => ({ idtemporada: t.idtemporada, monto: Math.round(p.tarifa * t.factor), moneda: "USD" })),
        idtransporte: transportes[p.transporte]!.idservicio, ...(p.tren !== null && { idtren: trenes[p.tren]! }), // B2
        // B2: el equipo con su regla; la compra lo ocupa sobre el total vendido. El Camino corto no acampa
        ...(p.circuito !== "corto" && {
          equipo: [["Carpa", 1, 2], ["Bolsa de dormir", 1, 1], ["Colchoneta", 1, 1], ["Carpa comedor", 1, null]].map(([tipo, cantidad, cadaPasajeros]) => ({ idservicio: equipos[tipo as string]!, cantidad, cadaPasajeros })),
        }),
      });
      paquetes.set(p.nombre, idDe(pq, "idpaquete")!);
    }

    const usados = new Set<string>();
    const unico = (generar: () => string) => { for (;;) { const v = generar(); if (!usados.has(v)) { usados.add(v); return v; } } };
    const paisesPorPeso = PAISES.flatMap((p) => Array.from({ length: p.peso }, () => p));
    const personaNueva = (pais: Pais = elegir(paisesPorPeso), apellido?: string): Persona => ({
      nombre: elegir(pais.nombres), apellido: apellido ?? elegir(pais.apellidos), pais, pasaporte: unico(pais.pasaporte), vence: vencimiento(),
    });
    const peru = PAISES.find((p) => p.nacionalidad === "Peruana")!;

    type Empleado = { idpersonal: number; ocupado: [string, string][]; token?: string };
    const separar = (completo: string) => { const [nombre, ...resto] = completo.split(" "); return { nombre: nombre!, apellido: resto.join(" ") }; };
    const guias: Empleado[] = [];
    for (const [i, completo] of GUIAS.entries()) {
      const email = `${correo(separar(completo).nombre)}.guia@incatour.com`;
      const g = await api("POST", "/personal", {
        ...separar(completo), nroPasaporte: unico(peru.pasaporte), nacionalidad: "Peruana", fechaVencimientoPasaporte: vencimiento(), rolOperativo: "Guía",
        email, contrasenia: CLAVE_GUIA, nroHabilitacion: `GO-${digitos(5)}`, fechaHabilitacion: vencimiento(),
      });
      guias.push({ idpersonal: idDe(g, "idpersonal")!, ocupado: [], token: await back.login(email, CLAVE_GUIA) });
    }
    const porteadores: Empleado[] = [];
    for (const [i, completo] of PORTEADORES.entries()) {
      const p = await api("POST", "/personal", { ...separar(completo), nroPasaporte: unico(peru.pasaporte), nacionalidad: "Peruana", fechaVencimientoPasaporte: vencimiento(), rolOperativo: "Porteador" });
      porteadores.push({ idpersonal: idDe(p, "idpersonal")!, ocupado: [] });
    }

    const clientes: Cliente[] = [];
    const registrarCliente = async (persona: Persona, email: string) => {
      const c = await api("POST", "/clientes", { email, contrasenia: CLAVE_CLIENTE, nombre: persona.nombre, apellido: persona.apellido }, "");
      clientes.push({ ...persona, idcliente: idDe(c, "idcliente")!, idusuario: idDe(c, "idusuario")!, token: await back.login(email, CLAVE_CLIENTE) });
    };
    const argentina = PAISES.find((p) => p.nacionalidad === "Argentina")!;
    await registrarCliente({ nombre: "Juan", apellido: "Pérez", pais: argentina, pasaporte: unico(argentina.pasaporte), vence: vencimiento() }, "juan@test.com");
    for (let i = 0; i < 59; i++) {
      const persona = personaNueva();
      const [n, a] = [correo(persona.nombre), correo(persona.apellido)];
      const usuario = unico(() => elegir([`${n}.${a}`, `${n}${a}${entre(70, 99)}`, `${n[0]}${a}`, `${n}.${a}${entre(1, 9)}`]));
      await registrarCliente(persona, `${usuario}@${elegir(persona.pais.dominios)}`);
    }

    // ==================== Operación ====================
    // Lo que la API sella con la hora de hoy; se corrige al final con la fecha de la historia
    const marcas = {
      salidas: [] as { idsalida: number; virtual: string; real: string; fin: string; idbloqueo: string | null; cancelada: boolean }[],
      reservas: [] as { idreserva: number; viajo: boolean; compra: string; cancelacion?: string }[],
      gestiones: [] as { idsolicitud: number; idservicio: number; fecha: string }[],
      resenias: [] as { idcliente: number; idsalida: number; fecha: string }[],
    };
    const comoPasajero = (p: Persona) => ({ nombreCompleto: `${p.nombre} ${p.apellido}`, nroPasaporte: p.pasaporte, nacionalidad: p.pais.nacionalidad, fechaVencimientoPasaporte: p.vence });
    // Casi siempre viaja el titular; los acompañantes son del mismo país y a veces de la misma familia
    const nomina = (titular: Cliente, cantidad: number) => [
      ...(azar() < 0.85 ? [titular] : [personaNueva(titular.pais)]),
      ...Array.from({ length: cantidad - 1 }, () => personaNueva(titular.pais, azar() < 0.4 ? titular.apellido : undefined)),
    ].map(comoPasajero);
    const libres = <T extends { ocupado: [string, string][] }>(lista: T[], desde: string, hasta: string, n: number) => {
      const elegidos = mezclar(lista).filter((x) => !x.ocupado.some(([a, b]) => a <= hasta && desde <= b)).slice(0, n);
      if (elegidos.length < n) throw new Error(`No hay ${n} recursos libres el ${desde}`);
      return elegidos;
    };

    const calendario = armarCalendario(hoy);
    console.log(`Operando ${calendario.length} salidas (tarda unos minutos)...`);
    for (const [n, plan] of calendario.entries()) {
      const { paquete, virtual, etapa } = plan;
      const dias = CIRCUITOS[paquete.circuito].dias;
      const viaja = etapa === "historica" || etapa === "encurso";
      // La de hoy y la que espera confirmación también se operan en el futuro: la API no crea salidas que empiezan tan pronto
      const adelantada = viaja || !!plan.deHoy || etapa === "pendiente";
      const real = adelantada ? masAnios(virtual, ANIOS_DE_VIAJE) : virtual;
      const fin = sumarDias(virtual, dias - 1);
      const realFin = sumarDias(real, dias - 1);
      const mover = (inicio: string, hasta: string) => db.salida.update({ where: { idsalida }, data: { fechaInicio: new Date(inicio), fechaFin: new Date(hasta) } });
      if (n % 10 === 0) console.log(`  ${n}/${calendario.length} (${virtual})`);

      // CU-36 (B3): guía, porteadores y transporte se eligen al crear, con la dotación del máximo (1 porteador cada 2)
      const zona = ZONAS[paquete.zona]!;
      // B10: con bloqueo, los hoteles de la zona en orden (el primero que no alcanza le pasa el resto al siguiente); a solicitud, uno (corte de 5 días)
      const alojamientos = zona.modalidad === "BLOQUEO_PLAZAS" ? hoteles[paquete.zona]!.map((h) => h.idservicio) : [elegir(hoteles[paquete.zona]!).idservicio];
      const equipoGuias = plan.carlos ? [guias[0]!] : libres(guias.slice(1), real, realFin, 1);
      const equipoPorteadores = libres(porteadores, real, realFin, Math.ceil(paquete.cupo / 2));
      // 12.4: el vehículo lleva a los pasajeros y al personal
      const lugares = paquete.cupo + equipoGuias.length + equipoPorteadores.length;
      const tope = TRANSPORTES[paquete.transporte]![3];
      const transporte = libres(transportes.filter((t) => t.asientos >= lugares && t.costo <= tope), real, realFin, 1)[0]!;
      const creada = await api("POST", "/salidas", {
        idpaquete: paquetes.get(paquete.nombre), fechaInicio: real, tamanoMaximo: paquete.cupo, alojamientos,
        idtransporte: transporte.idservicio, personalIds: [...equipoGuias, ...equipoPorteadores].map((p) => p.idpersonal),
      });
      const idsalida = idDe(creada, "idsalida")!;
      for (const r of [...equipoGuias, ...equipoPorteadores, transporte]) r.ocupado.push([real, realFin]);

      // CU-30: compras de clientes distintos hasta llenar lo que pide la temporada
      const avance = etapa === "publicada" ? 0.45 : 1;
      let porVender = plan.vender ? Math.round(paquete.cupo * plan.vender) : Math.min(paquete.cupo, Math.round(paquete.cupo * temporadaDe(virtual).demanda * avance * (0.8 + azar() * 0.35)));
      const juan = clientes[0]!;
      const compradores = plan.juan ? [juan, ...mezclar(clientes.slice(1))] : mezclar(clientes);
      const compras: { cliente: Cliente; pasajeros: ReturnType<typeof comoPasajero>[]; anticipacion: number }[] = [];
      while (porVender > 0) {
        const cantidad = Math.min(porVender, elegir([1, 2, 2, 2, 3, 4]));
        const maxima = viaja ? 120 : Math.max(2, Math.min(120, 120 + Math.floor((new Date(virtual).getTime() - new Date(hoy).getTime()) / (24 * H))));
        const cliente = compradores[compras.length]!;
        compras.push({ cliente, pasajeros: nomina(cliente, cantidad), anticipacion: entre(viaja ? 30 : 1, maxima) });
        porVender -= cantidad;
      }
      const vendidas = (await Promise.all(compras.map(async (c) => {
        // 12.2: un grupo no se parte entre hoteles; si ya no entra entero en ninguno, ese cliente no compra
        const r = await api("POST", "/reservas", {
          idsalida, medioPago: "TARJETA", pasajeros: c.pasajeros,
          tarjeta: { numero: "4242424242424242", titular: `${c.cliente.nombre} ${c.cliente.apellido}`.toUpperCase(), vencimiento: "12/30", cvv: "123" },
        }, c.cliente.token).catch((e) => { if (/no en un mismo hotel/.test(String(e))) return null; throw e; });
        if (!r) return null;
        const idreserva = idDe(r, "idreserva")!;
        const base = viaja || etapa === "cerrada" || etapa === "pendiente" ? virtual : hoy;
        const compra = sumarDias(base, -c.anticipacion);
        const marca: (typeof marcas.reservas)[number] = { idreserva, viajo: adelantada, compra: compra > hoy ? sumarDias(hoy, -1) : compra };
        marcas.reservas.push(marca);
        if (!c.cliente.primeraCompra || marca.compra < c.cliente.primeraCompra) c.cliente.primeraCompra = marca.compra;
        return { ...c, idreserva, marca };
      }))).filter((v) => v !== null);

      // CU-33/34: en las salidas a la venta quedan solicitudes sin resolver
      const pendientes = (await api("GET", "/solicitudes")).filter((s: any) => s.reserva.idsalida === idsalida);
      for (const pendiente of pendientes) {
        // Quedan sin resolver para mostrarlas en vivo
        if (etapa === "publicada" || (plan.dejarSolicitudes && pendiente === pendientes[0])) continue; // una sola, para resolverla en vivo
        const venta = vendidas.find((v) => v.idreserva === pendiente.idreserva)!;
        let idsolicitud: number = pendiente.idsolicitud;
        let rechazos = 0;
        let dia = sumarDias(venta.marca.compra, 1);
        for (;;) {
          const { opcionesContacto } = await api("GET", `/solicitudes/${idsolicitud}/opciones`);
          const op = elegir<any>(opcionesContacto);
          const rechazo = hoteles[paquete.zona]!.find((h) => h.idservicio === op.servicioId)!.rechazo;
          // 12.2: la primera va al hotel de la reserva; si la rechaza, la -R ofrece los otros de la zona. Siempre queda uno
          const rechaza = rechazos < hoteles[paquete.zona]!.length - 1 && azar() < rechazo;
          if (rechaza) rechazos++;
          const respuesta = await api("POST", `/solicitudes/${idsolicitud}/resolver`, { servicioId: op.servicioId, resolucion: rechaza ? "RECHAZADA" : "ACEPTADA", ...(rechaza && { motivo: elegir(MOTIVOS_RECHAZO) }) });
          marcas.gestiones.push({ idsolicitud, idservicio: op.servicioId, fecha: dia > hoy ? hoy : dia });
          if (!rechaza) break;
          idsolicitud = respuesta.nuevaSolicitudId;
          dia = sumarDias(dia, entre(1, 2));
        }
      }

      if (plan.cancelada) {
        // CU-37: la empresa cancela la salida y devuelve todo
        await api("POST", `/salidas/${idsalida}/cancelar`, { motivo: elegir(["Derrumbe en el sendero", "Paro regional en Cusco", "Cierre del sendero dispuesto por la autoridad"]) });
        for (const v of vendidas) v.marca.cancelacion = sumarDias(virtual, -10);
        marcas.salidas.push({ idsalida, virtual, real, fin, idbloqueo: null, cancelada: true });
        continue;
      }

      // CU-32: la fecha de la salida se acerca a hoy para que cuente la anticipación que dice la historia
      const vigentes = [...vendidas];
      for (const v of mezclar(vendidas)) {
        if (plan.vender || azar() > 0.12 || vigentes.length === 1 || (plan.juan && v.cliente === juan)) continue;
        const delAdmin = azar() < 0.25;
        const tarde = !delAdmin && azar() < 0.4;
        if (viaja) {
          const anticipacion = tarde ? entre(3, 14) : entre(15, v.anticipacion - 12);
          await mover(fecha(anticipacion), fecha(anticipacion + dias - 1));
          v.marca.cancelacion = sumarDias(virtual, -anticipacion);
        }
        await api("POST", `/reservas/${v.idreserva}/cancelar`, { motivo: elegir(MOTIVOS_CANCELACION) }, delAdmin ? admin : v.cliente.token);
        if (viaja) await mover(real, realFin);
        vigentes.splice(vigentes.indexOf(v), 1);
      }

      // CU-40: solo después del corte. Las que se operan en el futuro (salvo la que espera confirmación) se confirman
      // llevando el corte a hoy y devolviéndolo después; las de fechas reales siguen a la venta (PUBLICADA)
      if (!adelantada || etapa === "pendiente") {
        marcas.salidas.push({ idsalida, virtual, real, fin, idbloqueo: null, cancelada: false });
        continue;
      }
      const { diasCierreVenta } = await db.salida.findUniqueOrThrow({ where: { idsalida } });
      await db.salida.update({ where: { idsalida }, data: { diasCierreVenta: Math.ceil((new Date(real).getTime() - new Date(hoy).getTime()) / (24 * H)) } });
      await api("POST", `/salidas/${idsalida}/asignacion`, {});
      await db.salida.update({ where: { idsalida }, data: { diasCierreVenta } });

      if (viaja) {
        // CU-49/50: la salida "empezó ayer" para el guía
        const guia = equipoGuias[0]!;
        const url = `/guia/salidas/${idsalida}`;
        const etapas = etapa === "encurso" ? 1 : CIRCUITOS[paquete.circuito].etapas.length;
        await mover(fecha(-1), fecha(dias - 2));
        await api("POST", `${url}/iniciar`, undefined, guia.token);
        // La partida va antes del primer avance; su hora real se pone al llevar la salida a su fecha
        await db.salida.update({ where: { idsalida }, data: { fechaHoraInicioReal: new Date(fecha(-1)) } });
        for (let i = 1; i <= etapas; i++) {
          await api("POST", `${url}/avances`, { numeroOrden: i, estadoTramo: "COMPLETADO", fechaHoraLlegada: hace((etapas - i + 2) * H) }, guia.token);
          if (i === 1 && etapa === "historica" && azar() < 0.3) {
            const [tipoIncidente, descripcion, nivelGravedad] = elegir(INCIDENTES);
            await api("POST", `${url}/incidentes`, { tipoIncidente, descripcion, nivelGravedad, fechaHoraOcurrencia: hace(H) }, guia.token);
          }
        }
      }

      const asignado: { idservicio: number; cantidadAsignada: number }[] = etapa === "historica" ? (await api("GET", `/salidas/${idsalida}/equipamiento-asignado`)).equipamientos : [];
      if (asignado.length) {
        // CU-41: el equipo que ocuparon las compras vuelve al depósito; de vez en cuando algo vuelve roto
        const roto = azar() < 0.15 ? elegir([equipos["Bolsa de dormir"], equipos["Colchoneta"], equipos["Carpa"]]) : undefined;
        await api("POST", `/salidas/${idsalida}/devolucion-equipamiento`, {
          items: asignado.map((i) => ({ idservicio: i.idservicio, cantidadBuenEstado: i.cantidadAsignada - (i.idservicio === roto ? 1 : 0), cantidadDaniada: i.idservicio === roto ? 1 : 0 })),
        });
      }

      if (etapa === "historica") {
        // CU-47: la nota acompaña a la temporada alta, donde los grupos van llenos
        for (const v of vigentes) {
          if (azar() > 0.6 || (plan.juan && v.cliente === juan)) continue;
          const valoracion = elegir([5, 5, 5, 4, 4, 4, 3, 2]);
          await api("POST", "/resenias", { idsalida, valoracion, comentario: elegir(COMENTARIOS[valoracion]!) }, v.cliente.token);
          marcas.resenias.push({ idcliente: v.cliente.idcliente, idsalida, fecha: antesDe(sumarDias(fin, entre(1, 12)), sumarDias(hoy, -1)) });
        }
        // CU-42
        if (azar() < 0.7) {
          // Los porteadores que sobraron se liberaron al confirmar: se evalúa solo a quien viajó
          for (const p of await db.asignacionPersonal.findMany({ where: { idsalida } })) {
            await api("POST", `/salidas/${idsalida}/evaluaciones`, { tipo: "PERSONAL", id: p.idpersonal, puntaje: elegir([5, 5, 4, 4, 3]) });
          }
          const servicios = await db.ocupacion.findMany({ where: { idsalida, tipo: { not: "EQUIPAMIENTO" } }, include: { servicio: true } });
          for (const idproveedor of new Set(servicios.map((s) => s.servicio.idproveedor))) {
            await api("POST", `/salidas/${idsalida}/evaluaciones`, { tipo: "PROVEEDOR", id: idproveedor, puntaje: elegir([5, 4, 4, 3, 2]) });
          }
        }
      }
      marcas.salidas.push({ idsalida, virtual, real, fin, idbloqueo: null, cancelada: false });
    }

    await llevarALaFechaReal(db, marcas, clientes, hoy);
    // A1: el total del hotel queda en lo que tiene libre hoy más lo ocupado hoy, sin bajar del día más comprometido
    for (const h of Object.values(hoteles).flat()) {
      const { dias } = await api("GET", `/servicios/${h.idservicio}/ocupacion?desde=${hoy}&hasta=${sumarDias(hoy, 365)}`);
      const total = Math.max(h.plazasHoy + dias[0].ocupado, ...dias.map((d: { ocupado: number }) => d.ocupado));
      await api("PUT", `/servicios/${h.idservicio}`, { capacidadDisponible: total });
    }
    await verificar(db, hoy);
    await stockParaMostrar(db, hoy, api, alquiler);
    await mostrarPresentacion(db, hoy);
    console.log("\nUsuarios: admin@incatour.com / AdminIncaTour123 · juan@test.com / cliente123 · carlos.guia@incatour.com / guia12345");
  } finally {
    back.apagar();
    await db.$disconnect();
  }
}

/** Lleva cada salida a su fecha real con sus marcas de tiempo: la historia queda como si hubiera pasado en su momento */
async function llevarALaFechaReal(
  db: PrismaClient,
  marcas: {
    salidas: { idsalida: number; virtual: string; real: string; fin: string; cancelada: boolean }[];
    reservas: { idreserva: number; viajo: boolean; compra: string; cancelacion?: string }[];
    gestiones: { idsolicitud: number; idservicio: number; fecha: string }[];
    resenias: { idcliente: number; idsalida: number; fecha: string }[];
  },
  clientes: Cliente[],
  hoy: string,
) {
  console.log("Llevando la historia a sus fechas reales...");
  for (const m of marcas.reservas) {
    const reserva = await db.reserva.findUniqueOrThrow({ where: { idreserva: m.idreserva } });
    const momento = instante(m.compra, 14);
    await db.reserva.update({
      where: { idreserva: m.idreserva },
      data: { fechaRealizacion: momento, temporadaAplicada: reserva.temporadaAplicada?.replace(/\d{4}$/, (anio) => String(Number(anio) - (m.viajo ? ANIOS_DE_VIAJE : 0))) ?? null },
    });
    await db.pago.updateMany({ where: { idreserva: m.idreserva }, data: { fechahora: momento } });
    if (m.cancelacion) await db.reembolso.updateMany({ where: { idreserva: m.idreserva }, data: { fechaReembolso: instante(m.cancelacion, 15) } });
  }
  for (const g of marcas.gestiones) {
    await db.gestionSolicitud.update({ where: { idsolicitud_idservicio: { idsolicitud: g.idsolicitud, idservicio: g.idservicio } }, data: { fechaRespuesta: instante(g.fecha, 12) } });
  }
  for (const r of marcas.resenias) {
    await db.resenia.update({ where: { idcliente_idsalida: { idcliente: r.idcliente, idsalida: r.idsalida } }, data: { fechaEnvio: instante(r.fecha, 18) } });
  }
  for (const c of clientes) {
    if (c.primeraCompra) await db.usuario.update({ where: { idusuario: c.idusuario }, data: { creadoEn: instante(sumarDias(c.primeraCompra, -3), 10) } });
  }

  // Las temporadas lejanas solo sirvieron para operar la historia en el futuro: ninguna salida real las usa
  const temporadasDeSimulacion = { fechaInicio: { gte: new Date(`${Number(hoy.slice(0, 4)) + 2}-01-01`) } };
  await db.tarifaPaquete.deleteMany({ where: { temporada: temporadasDeSimulacion } });
  await db.temporada.deleteMany({ where: temporadasDeSimulacion });

  // Números correlativos por año de la fecha real: primero a un nombre temporal para no chocar con el @unique
  const porAnio = new Map<string, number>();
  for (const s of marcas.salidas) await db.salida.update({ where: { idsalida: s.idsalida }, data: { nroSalida: `TMP-${s.idsalida}` } });
  for (const s of [...marcas.salidas].sort((a, b) => a.virtual.localeCompare(b.virtual))) {
    const anio = s.virtual.slice(0, 4);
    const numero = (porAnio.get(anio) ?? 0) + 1;
    porAnio.set(anio, numero);
    const salida = await db.salida.update({
      where: { idsalida: s.idsalida },
      data: { nroSalida: `SAL-${anio}-${String(numero).padStart(3, "0")}`, fechaInicio: new Date(s.virtual), fechaFin: new Date(s.fin) },
    });
    // A1: la ocupación de hotel, transporte y equipo se creó con la fecha en que se operó: viaja con la salida
    const corrimiento = Math.round((new Date(s.virtual).getTime() - new Date(s.real).getTime()) / (24 * H));
    if (corrimiento) {
      await db.$executeRaw`UPDATE public."Ocupacion" SET desde = desde + ${corrimiento}::int, hasta = hasta + ${corrimiento}::int WHERE idsalida = ${s.idsalida}`;
    }

    const emision = instante(antesDe(sumarDias(s.virtual, -2), sumarDias(hoy, -1)), 11);
    await db.permisoPasajero.updateMany({ where: { reserva: { idsalida: s.idsalida } }, data: { fechaEmision: emision } });
    await db.permisoPersonal.updateMany({ where: { idsalida: s.idsalida }, data: { fechaEmision: emision } });

    const avances = await db.avance.findMany({ where: { idsalida: s.idsalida }, orderBy: { numeroOrden: "asc" } });
    for (const [i, a] of avances.entries()) {
      const llegada = instante(sumarDias(s.virtual, i), 16);
      await db.avance.update({ where: { idavance: a.idavance }, data: { fechaHoraLlegada: llegada, fechaHoraReporte: new Date(llegada.getTime() + H / 4) } });
    }
    // Partió a las 7 del primer día y, si terminó, terminó con la llegada de la última etapa
    if (salida.fechaHoraInicioReal) {
      const ultima = avances.length ? instante(sumarDias(s.virtual, avances.length - 1), 16) : null;
      await db.salida.update({
        where: { idsalida: s.idsalida },
        data: { fechaHoraInicioReal: instante(s.virtual, 7), ...(salida.fechaHoraFinReal && ultima && { fechaHoraFinReal: ultima }) },
      });
    }
    const ocurrencia = instante(s.virtual, 15);
    await db.incidente.updateMany({ where: { idsalida: s.idsalida }, data: { fechaHoraOcurrencia: ocurrencia, fechaHoraReporte: new Date(ocurrencia.getTime() + H / 2) } });
    const evaluacion = instante(sumarDias(s.fin, 3), 10);
    await db.evaluacionPersonal.updateMany({ where: { idsalida: s.idsalida }, data: { fechaEvaluacion: evaluacion } });
    await db.evaluacionProveedor.updateMany({ where: { idsalida: s.idsalida }, data: { fechaEvaluacion: evaluacion } });

    // La autoridad es otro sistema, pero su cupo diario tiene que coincidir con la fecha de la salida
    if (salida.idbloqueo) await db.autoridadBloqueo.update({ where: { idBloqueo: salida.idbloqueo }, data: { fecha: s.virtual } });
  }
  await db.autoridadCupoDiario.deleteMany();
  const cupos = await db.autoridadBloqueo.groupBy({ by: ["fecha"], _sum: { lugares: true } });
  await db.autoridadCupoDiario.createMany({ data: cupos.map((c) => ({ fecha: c.fecha, ocupados: c._sum.lugares ?? 0 })) });
}

/** Reglas que tiene que cumplir toda la base; corta con error si alguna falla */
async function verificar(db: PrismaClient, hoy: string) {
  const problemas: string[] = [];
  const exigir = (ok: boolean, detalle: string) => { if (!ok) problemas.push(detalle); };
  const hoyFin = new Date(`${sumarDias(hoy, 1)}T00:00:00Z`);

  const salidas = await db.salida.findMany({
    include: {
      paquete: { include: { circuito: { include: { etapas: true } } } },
      avances: true,
      ocupaciones: true,
      reservas: { include: { pagos: true, reembolsos: true, pasajeros: true, solicitudes: true, permisos: true } },
    },
  });
  const dosHoteles: string[] = [];
  const conASolicitud: string[] = [];
  for (const s of salidas) {
    // A1: la ocupación viaja con la salida y la de una cancelada se borra
    if (s.estado === "CANCELADA") exigir(s.ocupaciones.length === 0, `${s.nroSalida}: cancelada con ocupación`);
    const transporte = s.ocupaciones.find((o) => o.tipo === "TRANSPORTE");
    if (transporte) exigir(transporte.desde.getTime() === s.fechaInicio.getTime() && transporte.hasta.getTime() === s.fechaFin.getTime(), `${s.nroSalida}: transporte ocupado en otras fechas`);
    const confirmadas = s.reservas.filter((r) => r.estado === "CONFIRMADA");
    const vendidos = confirmadas.reduce((a, r) => a + r.cantidadPasajeros, 0);
    exigir(vendidos <= s.tamanoMaximo, `${s.nroSalida}: vendió ${vendidos} de ${s.tamanoMaximo}`);
    exigir(s.fechaFin.getTime() - s.fechaInicio.getTime() === (s.paquete.circuito.duracionDias - 1) * 24 * H, `${s.nroSalida}: la duración no coincide con el circuito`);
    if (s.estado === "PUBLICADA") {
      exigir(s.fechaInicio > hoyFin, `${s.nroSalida}: sigue a la venta y ya empezó`);
      exigir(s.stockLocal === s.tamanoMaximo - vendidos, `${s.nroSalida}: stock ${s.stockLocal}, vendidos ${vendidos}`);
    }
    // B10 y 12.2: cada hotel con bloqueo tiene libre lo que bloqueó menos lo que la compra le mandó (confirmada, 0)
    const conBloqueo = [...new Map(s.ocupaciones.filter((o) => o.tipo === "ALOJAMIENTO" && o.plazasLibres !== null).map((o) => [o.idservicio, o])).values()];
    for (const h of conBloqueo) {
      const enviados = confirmadas.filter((r) => r.idalojamiento === h.idservicio).reduce((a, r) => a + r.cantidadPasajeros, 0);
      exigir(h.plazasLibres === (s.estado === "PUBLICADA" ? h.cantidad - enviados : 0), `${s.nroSalida}: el hotel ${h.idservicio} tiene ${h.plazasLibres} libres de ${h.cantidad} y le mandaron ${enviados}`);
    }
    if (s.estado === "PUBLICADA") {
      exigir(s.stockLocalAlojamiento === conBloqueo.reduce((a, h) => a + h.plazasLibres!, 0), `${s.nroSalida}: stockLocalAlojamiento ${s.stockLocalAlojamiento} distinto de las plazas libres de sus hoteles`);
    }
    if (conBloqueo.length > 1) dosHoteles.push(s.nroSalida);
    if (s.ocupaciones.some((o) => o.tipo === "ALOJAMIENTO" && o.plazasLibres === null)) conASolicitud.push(s.nroSalida);
    if (s.estado === "FINALIZADA") {
      exigir(s.fechaFin < hoyFin, `${s.nroSalida}: finalizada con fecha futura`);
      exigir(s.avances.length === s.paquete.circuito.etapas.length, `${s.nroSalida}: ${s.avances.length} avances`);
    }
    if (s.estado === "EN_CURSO") exigir(s.fechaInicio < hoyFin && s.fechaFin >= new Date(hoy), `${s.nroSalida}: en curso fuera de fecha`);
    if (s.estado === "CANCELADA") exigir(confirmadas.length === 0, `${s.nroSalida}: cancelada con reservas confirmadas`);
    if (["CERRADA", "EN_CURSO", "FINALIZADA"].includes(s.estado)) {
      exigir(!s.reservas.some((r) => r.solicitudes.some((x) => x.estado === "PENDIENTE")), `${s.nroSalida}: operada con solicitudes pendientes`);
      exigir(confirmadas.every((r) => r.permisos.filter((p) => p.estadoTramite === "Emitido").length === r.cantidadPasajeros), `${s.nroSalida}: faltan permisos`);
    }
    for (const r of s.reservas) {
      const pagado = r.pagos.reduce((a, p) => a + p.monto, 0);
      exigir(Math.abs(pagado - r.precioCongelado) < 0.01, `${r.nroReserva}: pagó ${pagado} de ${r.precioCongelado}`);
      exigir(r.pasajeros.length === r.cantidadPasajeros, `${r.nroReserva}: nómina distinta de la cantidad`);
      exigir(r.fechaRealizacion < s.fechaInicio, `${r.nroReserva}: comprada después de empezar`);
      exigir(r.fechaRealizacion < hoyFin, `${r.nroReserva}: comprada en el futuro`);
      exigir(r.temporadaAplicada?.endsWith(String(s.fechaInicio.getUTCFullYear())) ?? false, `${r.nroReserva}: temporada ${r.temporadaAplicada} para ${s.nroSalida}`);
      exigir((r.estado === "CANCELADA") === (r.reembolsos.length === 1), `${r.nroReserva}: ${r.estado} con ${r.reembolsos.length} reembolsos`);
      for (const x of r.reembolsos) {
        exigir(x.montoReembolsado <= pagado, `${r.nroReserva}: reintegró más de lo pagado`);
        exigir(x.fechaReembolso >= r.fechaRealizacion && x.fechaReembolso <= new Date(Math.max(hoyFin.getTime(), s.fechaInicio.getTime())), `${r.nroReserva}: reembolso fuera de fecha`);
      }
    }
  }
  const resenias = await db.resenia.findMany({ include: { salida: { include: { reservas: true } } } });
  for (const r of resenias) {
    exigir(r.salida.estado === "FINALIZADA" && r.fechaEnvio > r.salida.fechaFin && r.fechaEnvio < hoyFin, `Reseña de ${r.salida.nroSalida}: fuera de fecha`);
    exigir(r.salida.reservas.some((x) => x.idcliente === r.idcliente && x.estado === "CONFIRMADA"), `Reseña de ${r.salida.nroSalida}: sin reserva confirmada`);
  }
  const permisosFuturos = (await db.permisoPasajero.count({ where: { fechaEmision: { gte: hoyFin } } })) + (await db.permisoPersonal.count({ where: { fechaEmision: { gte: hoyFin } } }));
  exigir(permisosFuturos === 0, `${permisosFuturos} permisos emitidos en el futuro`);
  exigir(dosHoteles.length > 0 && conASolicitud.length > 0, `Faltan salidas con dos hoteles (${dosHoteles.length}) o con un hotel a solicitud (${conASolicitud.length})`);

  if (problemas.length) throw new Error(`Base inconsistente (${problemas.length}):\n${problemas.slice(0, 30).join("\n")}`);

  const contar = async (nombre: string, n: Promise<number>) => console.log(`  ${nombre}: ${await n}`);
  console.log(`\nBase consistente. ${salidas.length} salidas:`);
  console.log(`  Con dos hoteles (B10): ${dosHoteles.length}, p. ej. ${dosHoteles.slice(-3).join(", ")} · con hotel a solicitud: ${conASolicitud.length}, p. ej. ${conASolicitud.slice(-3).join(", ")}`);
  for (const estado of ["FINALIZADA", "EN_CURSO", "CERRADA", "PUBLICADA", "CANCELADA"]) console.log(`  ${estado}: ${salidas.filter((s) => s.estado === estado).length}`);
  await contar("Reservas", db.reserva.count());
  await contar("Canceladas", db.reserva.count({ where: { estado: "CANCELADA" } }));
  await contar("Pasajeros", db.pasajero.count());
  await contar("Solicitudes", db.solicitud.count());
  await contar("Respuestas de hoteles", db.gestionSolicitud.count());
  await contar("Incidentes", db.incidente.count());
  await contar("Reseñas", db.resenia.count());
}

/**
 * Deja el inventario de un equipo en el pico de ocupación de los días de una salida, más `margen` (negativo = ya falta).
 * Es lo que pasaría si el proveedor da de baja unidades: el sistema no deja bajar el stock por debajo de lo comprometido.
 */
async function ajustarStock(db: PrismaClient, nombreServicio: string, idsalida: number, margen: number) {
  const { idservicio } = await db.servicioBase.findFirstOrThrow({ where: { nombreServicio } });
  const filas = await db.ocupacion.findMany({ where: { idservicio } });
  const propia = filas.find((f) => f.idsalida === idsalida)!;
  let pico = 0;
  for (let d = propia.desde.getTime(); d <= propia.hasta.getTime(); d += 24 * H) {
    pico = Math.max(pico, filas.filter((f) => f.desde.getTime() <= d && d <= f.hasta.getTime()).reduce((t, f) => t + f.cantidad, 0));
  }
  await db.servicioEquipamiento.update({ where: { idservicio }, data: { cantidadTotal: pico + margen } });
}

/**
 * Equipo para la presentación: una salida a la venta justa de carpas (una compra más las hace faltar) y otra de diciembre
 * a la que ya le falta un equipo que solo usa ella (el proveedor tiene 1 y la salida lleva 2).
 */
async function stockParaMostrar(db: PrismaClient, hoy: string, api: (m: string, r: string, b?: unknown) => Promise<any>, alquiler: number) {
  const justa = await db.salida.findFirstOrThrow({ where: { fechaInicio: new Date(sumarDias(hoy, 3)), estado: "PUBLICADA", paquete: { nombrePaquete: PAQUETES[3].nombre } } });
  await ajustarStock(db, EQUIPOS[0]![0], justa.idsalida, 0);

  const conFalta = await db.salida.findFirstOrThrow({ where: { fechaInicio: { gt: new Date(sumarDias(hoy, 6)) }, estado: "PUBLICADA" }, orderBy: { fechaInicio: "asc" }, include: { ocupaciones: true } });
  const nombreServicio = "Equipo de oxígeno portátil";
  const s = await api("POST", `/proveedores/${alquiler}/servicios`, { tipo: "EQUIPAMIENTO", nombreServicio, localidad: "Cusco", costoBase: 30, tipoEquipamiento: "Oxígeno", cantidadDisponible: 1 });
  const idservicio = idDe(s, "idservicio")!;
  const equipo = conFalta.ocupaciones.find((o) => o.tipo === "EQUIPAMIENTO")!;
  const definicion = conFalta.definicionPaquete as any;
  definicion.servicios.push({ tipo: "EQUIPAMIENTO", tren: null, cantidad: 2, idservicio, cadaPasajeros: null, nombreServicio });
  await db.salida.update({ where: { idsalida: conFalta.idsalida }, data: { definicionPaquete: definicion } });
  await db.ocupacion.create({ data: { idservicio, idsalida: conFalta.idsalida, tipo: "EQUIPAMIENTO", desde: equipo.desde, hasta: equipo.hasta, cantidad: 2 } });
  console.log(`  Equipo justo (una compra más y faltan carpas): ${justa.nroSalida} · ya le falta oxígeno: ${conFalta.nroSalida}`);
}

/** Lo que se usa en vivo el día de la presentación (ver presentacion/datos-demo.md) */
async function mostrarPresentacion(db: PrismaClient, hoy: string) {
  const deHoy = await db.salida.findFirstOrThrow({ where: { fechaInicio: new Date(hoy), estado: "CERRADA" } });
  const enCurso = await db.salida.findMany({ where: { estado: "EN_CURSO" }, orderBy: { fechaInicio: "desc" } });
  const juan = await db.reserva.findMany({ where: { cliente: { usuario: { email: "juan@test.com" } } }, include: { salida: true }, orderBy: { salida: { fechaInicio: "asc" } } });
  const pendientes = await db.solicitud.count({ where: { estado: "PENDIENTE" } });
  const paraConfirmar = await db.salida.findFirst({ where: { fechaInicio: new Date(sumarDias(hoy, 2)), estado: "PUBLICADA", paquete: { nombrePaquete: PAQUETES[0].nombre } } });
  const conSobrantes = await db.salida.findFirst({ where: { fechaInicio: new Date(sumarDias(hoy, 2)), estado: "PUBLICADA", paquete: { nombrePaquete: PAQUETES[2].nombre } }, include: { reservas: { include: { solicitudes: true } } } });
  const solicitudesSobrantes = conSobrantes?.reservas.flatMap((r) => r.solicitudes).filter((x) => x.estado === "PENDIENTE").length ?? 0;
  const ultimoDia = await db.salida.findFirst({ where: { fechaInicio: new Date(sumarDias(hoy, 3)), estado: "PUBLICADA", paquete: { nombrePaquete: PAQUETES[3].nombre } } });
  console.log(`
Para la presentación (${hoy}):`);
  console.log(`  Carlos inicia en vivo: ${deHoy.nroSalida} (${deHoy.estado})`);
  console.log(`  En curso al día: ${enCurso[0]?.nroSalida} · atrasada (Desfasada): ${enCurso[1]?.nroSalida}`);
  console.log(`  Solicitudes de alojamiento pendientes: ${pendientes}`);
  console.log(`  Vendida completa y con la venta terminada, para confirmar en vivo (CU-40): ${paraConfirmar?.nroSalida}`);
  console.log(`  Venta terminada con la mitad vendida, al confirmar sobran porteadores: ${conSobrantes?.nroSalida} (${solicitudesSobrantes} alojamientos pendientes)`);
  console.log(`  Vendida a la mitad, hoy es su último día de venta: ${ultimoDia?.nroSalida}`);
  for (const r of juan) console.log(`  Juan: ${r.nroReserva} en ${r.salida.nroSalida} (${r.salida.estado}, ${r.estado})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
