/**
 * Base de demo creada con la aplicación, sin seed: dos años de operación para que los reportes tengan sentido.
 * Uso, desde backend, con Docker levantado: npm run demo   (resetea DEMO_DB, por defecto incatour_demo)
 * Después levantar el back contra esa base (DATABASE_URL apuntando a incatour_demo).
 *
 * Todo pasa por la API real: catálogo, proveedores, personal, compras, solicitudes, cancelaciones, asignación,
 * avances, incidentes, reseñas y evaluaciones. Solo toca la base directo en lo que la API no puede hacer:
 *  - crear el administrador (no hay alta de administradores);
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
  cusco3: { localidad: "Cusco", categoria: "3 Estrellas", modalidad: "BLOQUEO_PLAZAS", hoteles: [["Hotel Tikari Cusco", 0, 62, 22], ["Hostal Wayra San Blas", 0, 48, 12]] },
  cusco4: { localidad: "Cusco", categoria: "4 Estrellas", modalidad: "A_SOLICITUD", hoteles: [["Hotel Killa Imperial", 0.45, 118, 14], ["Ayllu Boutique Cusco", 0.2, 132, 8], ["Hotel Antawasi Plaza", 0.3, 104, 18]] },
  aguas: { localidad: "Aguas Calientes", categoria: "3 Estrellas", modalidad: "A_SOLICITUD", hoteles: [["Hostal Rumi Wasi", 0.5, 58, 10], ["Hotel Vilcanota Lodge", 0.25, 74, 16], ["Hostal Inti Pakarina", 0.15, 52, 6]] },
  ollanta: { localidad: "Ollantaytambo", categoria: "3 Estrellas", modalidad: "BLOQUEO_PLAZAS", hoteles: [["Hotel Tambo Ollanta", 0, 55, 20]] },
};

// [empresa, vehículo, asientos, costo del traslado, kg de equipaje incluidos, canal]
const TRANSPORTES: [string, string, number, number, number, string][] = [
  ["Trans Andes", "Sprinter 19 asientos", 19, 95, 15, "WhatsApp"],
  ["Vilcanota Tours", "Coaster 25 asientos", 25, 130, 20, "Email"],
  ["Inka Express Bus", "Bus 33 asientos", 33, 180, 20, "Email"],
  ["Valle Sagrado Traslados", "Sprinter 19 asientos", 19, 90, 15, "WhatsApp"],
  ["Cusco Van", "Hiace 20 asientos", 20, 100, 15, "Teléfono"],
  ["Qosqo Móvil", "Coaster 25 asientos", 25, 125, 20, "WhatsApp"],
];
// Equipamiento de campamento: [artículo, tipo, inventario, costo por unidad]
const EQUIPOS: [string, string, number, number][] = [
  ["Carpa doble 4 estaciones", "Carpa", 60, 12],
  ["Bolsa de dormir -10 °C", "Bolsa de dormir", 120, 6],
  ["Colchoneta autoinflable", "Colchoneta", 120, 3],
  ["Carpa comedor con mesa y bancos", "Carpa comedor", 10, 25],
];

const PAQUETES = [
  // tren: servicio de tren de vuelta desde Aguas Calientes (null: no toma tren); transporte: índice en TRANSPORTES
  { nombre: "Camino Inca Clásico 4 días", circuito: "clasico", zona: "cusco3", tarifa: 780, previas: 1, posteriores: 1, cupo: 16, peso: 4, tren: 0, transporte: 1 },
  { nombre: "Camino Inca Premium", circuito: "clasico", zona: "cusco4", tarifa: 1150, previas: 2, posteriores: 1, cupo: 10, peso: 2, tren: 1, transporte: 0 },
  { nombre: "Camino Inca Express", circuito: "corto", zona: "aguas", tarifa: 490, previas: 0, posteriores: 1, cupo: 12, peso: 3, tren: 0, transporte: 4 },
  { nombre: "Salkantay Aventura", circuito: "salkantay", zona: "cusco3", tarifa: 690, previas: 1, posteriores: 1, cupo: 14, peso: 2, tren: 0, transporte: 5 },
  { nombre: "Lares Cultural", circuito: "lares", zona: "ollanta", tarifa: 540, previas: 1, posteriores: 0, cupo: 10, peso: 1, tren: null, transporte: 3 },
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
const PORTEADORES = ["Julián Quispe", "Wilber Huamán", "Rubén Condori", "Efraín Mamani", "Percy Choque", "Edwin Puma", "Fredy Ccahuana", "Nilo Sallo", "Abel Turpo", "Ciro Hancco", "Dante Illa", "Elmer Pacco", "Fidel Roque", "Germán Sutta", "Hilario Tito", "Isaías Umasi", "Jaime Vilca", "Lino Waman", "Mario Yucra", "Néstor Zúñiga", "Óscar Arqque", "Pablo Bellota", "Raúl Cusi", "Saúl Dueñas"];
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
type Etapa = "historica" | "encurso" | "cerrada" | "publicada";
type Plan = { virtual: string; paquete: (typeof PAQUETES)[number]; etapa: Etapa; carlos?: boolean; cancelada?: boolean; deHoy?: boolean; juan?: boolean };

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
      // Las salidas alrededor de hoy se arman a mano abajo
      if (fin >= sumarDias(hoy, -1) && virtual <= sumarDias(hoy, 3)) continue;
      const etapa = fin < hoy ? "historica" : virtual <= sumarDias(hoy, 25) ? "cerrada" : "publicada";
      planes.push({ virtual, paquete, etapa });
    }
  }
  const clasico = PAQUETES[0];
  // Para la presentación: una en curso (con otro guía) y la de Carlos que empieza hoy, lista para iniciarla en vivo
  planes.push({ virtual: sumarDias(hoy, -1), paquete: clasico, etapa: "encurso" });
  planes.push({ virtual: hoy, paquete: clasico, etapa: "cerrada", carlos: true, deHoy: true });
  planes.push({ virtual: sumarDias(hoy, 12), paquete: clasico, etapa: "cerrada", carlos: true });
  const historicas = planes.filter((p) => p.etapa === "historica");
  for (const i of [7, 25, 44]) historicas[i]!.cancelada = true;
  planes.sort((a, b) => a.virtual.localeCompare(b.virtual));
  // Juan tiene una salida terminada sin reseñar y una reserva a la venta que puede cancelar con reintegro
  planes.filter((p) => p.etapa === "historica" && !p.cancelada).at(-1)!.juan = true;
  planes.find((p) => p.etapa === "publicada")!.juan = true;
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
        // ponytail: la API descuenta del hotel las plazas de cada bloqueo y no las devuelve cuando la salida termina,
        // así que la historia se opera con capacidad de sobra y al final se deja lo que el hotel tiene libre hoy
        const s = await api("POST", `/proveedores/${idproveedor}/servicios`, {
          tipo: "ALOJAMIENTO", nombreServicio: nombre, localidad: z.localidad, costoBase: costo, categoria: z.categoria, tipoHabitacion: "Doble", capacidadDisponible: 900, modalidadConfirmacion: z.modalidad,
        });
        hoteles[clave]!.push({ idservicio: idDe(s, "idservicio")!, idproveedor, rechazo, plazasHoy });
      }
    }

    const transportes: { idservicio: number; idproveedor: number; ocupado: [string, string][] }[] = [];
    for (const [empresa, vehiculo, asientos, costo, kg, canal] of TRANSPORTES) {
      const contacto = canal === "Email" ? `operaciones@${correo(empresa).replace(/\./g, "")}.com.pe` : `+51 984 ${digitos(3)} ${digitos(3)}`;
      const prov = await api("POST", "/proveedores", { tipoProveedor: "TRANSPORTE", razonSocial: `${empresa} E.I.R.L.`, localidad: "Cusco", datosContacto: contacto, canalComunicacion: canal });
      const idproveedor = idDe(prov, "idproveedor")!;
      const s = await api("POST", `/proveedores/${idproveedor}/servicios`, { tipo: "TRANSPORTE", nombreServicio: `${empresa} · ${vehiculo}`, localidad: "Cusco", costoBase: costo, capacidadVehiculo: asientos, pesoEquipajeIncluido: kg, costoPorKgExcedente: 2.5 });
      transportes.push({ idservicio: idDe(s, "idservicio")!, idproveedor, ocupado: [] });
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

    const paquetes = new Map<string, number>();
    for (const p of PAQUETES) {
      const z = ZONAS[p.zona]!;
      const pq = await api("POST", "/paquetes", {
        idcircuito: circuitos[p.circuito], nombrePaquete: p.nombre, condiciones: "Incluye permisos de ingreso, guía y porteadores. Reintegro total hasta 15 días antes de la salida.",
        tipoGarantia: "POR_CATEGORIA", localidadGarantizada: z.localidad, categoriaGarantizada: z.categoria, tipoHabitacionGarantizada: "Doble",
        nochesPrevias: p.previas, nochesPosteriores: p.posteriores, diasMinimosReintegro: 15,
        matrizPrecios: tarifasPorFactor.map((t) => ({ idtemporada: t.idtemporada, monto: Math.round(p.tarifa * t.factor), moneda: "USD" })),
        serviciosIncluidos: [transportes[p.transporte]!.idservicio, ...(p.tren === null ? [] : [trenes[p.tren]!])],
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
      salidas: [] as { idsalida: number; virtual: string; fin: string; idbloqueo: string | null; cancelada: boolean }[],
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
      // La de hoy también se opera en el futuro: la API no crea salidas que empiezan hoy
      const adelantada = viaja || !!plan.deHoy;
      const real = adelantada ? masAnios(virtual, ANIOS_DE_VIAJE) : virtual;
      const fin = sumarDias(virtual, dias - 1);
      const realFin = sumarDias(real, dias - 1);
      const mover = (inicio: string, hasta: string) => db.salida.update({ where: { idsalida }, data: { fechaInicio: new Date(inicio), fechaFin: new Date(hasta) } });
      if (n % 10 === 0) console.log(`  ${n}/${calendario.length} (${virtual})`);

      // CU-36
      const zona = ZONAS[paquete.zona]!;
      const hotel = zona.modalidad === "BLOQUEO_PLAZAS" ? elegir(hoteles[paquete.zona]!) : undefined;
      const creada = await api("POST", "/salidas", { idpaquete: paquetes.get(paquete.nombre), fechaInicio: real, tamanoMaximo: paquete.cupo, ...(hotel && { idalojamiento: hotel.idservicio }) });
      const idsalida = idDe(creada, "idsalida")!;

      // CU-30: compras de clientes distintos hasta llenar lo que pide la temporada
      const avance = etapa === "publicada" ? 0.45 : 1;
      let porVender = Math.min(paquete.cupo, Math.round(paquete.cupo * temporadaDe(virtual).demanda * avance * (0.8 + azar() * 0.35)));
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
      const vendidas = await Promise.all(compras.map(async (c) => {
        const r = await api("POST", "/reservas", {
          idsalida, medioPago: "TARJETA", pasajeros: c.pasajeros, equipaje: c.pasajeros.map(() => ({ pesoDeclarado: entre(6, 14) })),
          tarjeta: { numero: "4242424242424242", titular: `${c.cliente.nombre} ${c.cliente.apellido}`.toUpperCase(), vencimiento: "12/30", cvv: "123" },
        }, c.cliente.token);
        const idreserva = idDe(r, "idreserva")!;
        const base = viaja || etapa === "cerrada" ? virtual : hoy;
        const compra = sumarDias(base, -c.anticipacion);
        const marca: (typeof marcas.reservas)[number] = { idreserva, viajo: adelantada, compra: compra > hoy ? sumarDias(hoy, -1) : compra };
        marcas.reservas.push(marca);
        if (!c.cliente.primeraCompra || marca.compra < c.cliente.primeraCompra) c.cliente.primeraCompra = marca.compra;
        return { ...c, idreserva, marca };
      }));

      // CU-33/34: en las salidas a la venta quedan solicitudes sin resolver
      const pendientes = (await api("GET", "/solicitudes")).filter((s: any) => s.reserva.idsalida === idsalida);
      for (const pendiente of pendientes) {
        // Quedan sin resolver para mostrarlas en vivo
        if (etapa === "publicada") continue;
        const venta = vendidas.find((v) => v.idreserva === pendiente.idreserva)!;
        let idsolicitud: number = pendiente.idsolicitud;
        let dia = sumarDias(venta.marca.compra, 1);
        for (;;) {
          const { opcionesContacto } = await api("GET", `/solicitudes/${idsolicitud}/opciones`);
          const op = elegir<any>(opcionesContacto);
          const rechazo = hoteles[paquete.zona]!.find((h) => h.idservicio === op.servicioId)!.rechazo;
          const rechaza = opcionesContacto.length > 1 && azar() < rechazo;
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
        marcas.salidas.push({ idsalida, virtual, fin, idbloqueo: null, cancelada: true });
        continue;
      }

      // CU-32: la fecha de la salida se acerca a hoy para que cuente la anticipación que dice la historia
      const vigentes = [...vendidas];
      for (const v of mezclar(vendidas)) {
        if (azar() > 0.12 || vigentes.length === 1 || (plan.juan && v.cliente === juan)) continue;
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

      // CU-40
      if (etapa === "publicada") {
        marcas.salidas.push({ idsalida, virtual, fin, idbloqueo: null, cancelada: false });
        continue;
      }
      const panel = await api("GET", `/salidas/${idsalida}/asignacion`);
      const equipoGuias = plan.carlos ? [guias[0]!, ...libres(guias.slice(1), real, realFin, panel.dotacionRequerida.guias - 1)] : libres(guias.slice(1), real, realFin, panel.dotacionRequerida.guias);
      const equipoPorteadores = libres(porteadores, real, realFin, panel.dotacionRequerida.porteadores);
      const transporte = libres(transportes, real, realFin, 1)[0]!;
      // Los circuitos que acampan llevan carpas, bolsas y colchonetas para los pasajeros, y una carpa comedor
      const pasajerosSalida = vigentes.reduce((a, v) => a + v.pasajeros.length, 0);
      const acampa = paquete.circuito !== "corto";
      const itemsCamping = acampa
        ? [["Carpa", Math.ceil(pasajerosSalida / 2)], ["Bolsa de dormir", pasajerosSalida], ["Colchoneta", pasajerosSalida], ["Carpa comedor", 1]].map(([tipo, cantidad]) => ({ idservicio: equipos[tipo as string]!, cantidad: cantidad as number }))
        : [];
      await api("POST", `/salidas/${idsalida}/asignacion`, { personalIds: [...equipoGuias, ...equipoPorteadores].map((p) => p.idpersonal), idtransporte: transporte.idservicio, itemsCamping });
      for (const r of [...equipoGuias, ...equipoPorteadores, transporte]) r.ocupado.push([real, realFin]);

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

      if (etapa === "historica" && itemsCamping.length) {
        // CU-41: el equipo vuelve al depósito; de vez en cuando algo vuelve roto
        const roto = azar() < 0.15 ? elegir([equipos["Bolsa de dormir"], equipos["Colchoneta"], equipos["Carpa"]]) : undefined;
        await api("POST", `/salidas/${idsalida}/devolucion-equipamiento`, {
          items: itemsCamping.map((i) => ({ idservicio: i.idservicio, cantidadBuenEstado: i.cantidad - (i.idservicio === roto ? 1 : 0), cantidadDaniada: i.idservicio === roto ? 1 : 0 })),
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
          for (const p of [...equipoGuias, ...equipoPorteadores]) {
            await api("POST", `/salidas/${idsalida}/evaluaciones`, { tipo: "PERSONAL", id: p.idpersonal, puntaje: elegir([5, 5, 4, 4, 3]) });
          }
          const servicios = await db.salidaServicio.findMany({ where: { idsalida }, include: { servicio: true } });
          for (const idproveedor of new Set(servicios.map((s) => s.servicio.idproveedor))) {
            await api("POST", `/salidas/${idsalida}/evaluaciones`, { tipo: "PROVEEDOR", id: idproveedor, puntaje: elegir([5, 4, 4, 3, 2]) });
          }
        }
      }
      marcas.salidas.push({ idsalida, virtual, fin, idbloqueo: null, cancelada: false });
    }

    for (const h of Object.values(hoteles).flat()) await api("PUT", `/servicios/${h.idservicio}`, { capacidadDisponible: h.plazasHoy });
    await llevarALaFechaReal(db, marcas, clientes, hoy);
    await verificar(db, hoy);
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
    salidas: { idsalida: number; virtual: string; fin: string; cancelada: boolean }[];
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
      reservas: { include: { pagos: true, reembolsos: true, pasajeros: true, solicitudes: true, permisos: true } },
    },
  });
  for (const s of salidas) {
    const confirmadas = s.reservas.filter((r) => r.estado === "CONFIRMADA");
    const vendidos = confirmadas.reduce((a, r) => a + r.cantidadPasajeros, 0);
    exigir(vendidos <= s.tamanoMaximo, `${s.nroSalida}: vendió ${vendidos} de ${s.tamanoMaximo}`);
    exigir(s.fechaFin.getTime() - s.fechaInicio.getTime() === (s.paquete.circuito.duracionDias - 1) * 24 * H, `${s.nroSalida}: la duración no coincide con el circuito`);
    if (s.estado === "PUBLICADA") {
      exigir(s.fechaInicio > hoyFin, `${s.nroSalida}: sigue a la venta y ya empezó`);
      exigir(s.stockLocal === s.tamanoMaximo - vendidos, `${s.nroSalida}: stock ${s.stockLocal}, vendidos ${vendidos}`);
    }
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

  if (problemas.length) throw new Error(`Base inconsistente (${problemas.length}):\n${problemas.slice(0, 30).join("\n")}`);

  const contar = async (nombre: string, n: Promise<number>) => console.log(`  ${nombre}: ${await n}`);
  console.log(`\nBase consistente. ${salidas.length} salidas:`);
  for (const estado of ["FINALIZADA", "EN_CURSO", "CERRADA", "PUBLICADA", "CANCELADA"]) console.log(`  ${estado}: ${salidas.filter((s) => s.estado === estado).length}`);
  await contar("Reservas", db.reserva.count());
  await contar("Canceladas", db.reserva.count({ where: { estado: "CANCELADA" } }));
  await contar("Pasajeros", db.pasajero.count());
  await contar("Solicitudes", db.solicitud.count());
  await contar("Respuestas de hoteles", db.gestionSolicitud.count());
  await contar("Incidentes", db.incidente.count());
  await contar("Reseñas", db.resenia.count());
}

/** Lo que se usa en vivo el día de la presentación (ver presentacion/datos-demo.md) */
async function mostrarPresentacion(db: PrismaClient, hoy: string) {
  const deHoy = await db.salida.findFirstOrThrow({ where: { fechaInicio: new Date(hoy), estado: "CERRADA" } });
  const enCurso = await db.salida.findFirstOrThrow({ where: { estado: "EN_CURSO" } });
  const juan = await db.reserva.findMany({ where: { cliente: { usuario: { email: "juan@test.com" } } }, include: { salida: true }, orderBy: { salida: { fechaInicio: "asc" } } });
  const pendientes = await db.solicitud.count({ where: { estado: "PENDIENTE" } });
  console.log(`
Para la presentación (${hoy}):`);
  console.log(`  Carlos inicia en vivo: ${deHoy.nroSalida} (${deHoy.estado})`);
  console.log(`  En curso con otro guía: ${enCurso.nroSalida}`);
  console.log(`  Solicitudes de alojamiento pendientes: ${pendientes}`);
  for (const r of juan) console.log(`  Juan: ${r.nroReserva} en ${r.salida.nroSalida} (${r.salida.estado}, ${r.estado})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
