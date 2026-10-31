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
  corto: { nombre: "Camino Inca Corto", dias: 2, dificultad: "Moderada", etapas: [["Km 104", "Wiñay Wayna"], ["Wiñay Wayna", "Machu Picchu"]] },
  salkantay: { nombre: "Salkantay", dias: 5, dificultad: "Alta", etapas: [["Mollepata", "Soraypampa"], ["Soraypampa", "Chaullay"], ["Chaullay", "La Playa"], ["La Playa", "Aguas Calientes"], ["Aguas Calientes", "Machu Picchu"]] },
  lares: { nombre: "Valle de Lares", dias: 3, dificultad: "Moderada", etapas: [["Lares", "Huacahuasi"], ["Huacahuasi", "Patacancha"], ["Patacancha", "Ollantaytambo"]] },
} as const;

type Zona = { localidad: string; categoria: string; modalidad: "BLOQUEO_PLAZAS" | "A_SOLICITUD"; hoteles: [string, number][] };
// El número es la probabilidad de que el hotel rechace una solicitud
const ZONAS: Record<string, Zona> = {
  cusco3: { localidad: "Cusco", categoria: "3 Estrellas", modalidad: "BLOQUEO_PLAZAS", hoteles: [["Hotel Plaza de Armas", 0], ["Hostal San Blas", 0]] },
  cusco4: { localidad: "Cusco", categoria: "4 Estrellas", modalidad: "A_SOLICITUD", hoteles: [["Hotel Imperial Cusco", 0.45], ["Casa Andina Koricancha", 0.2], ["Hotel Sacsayhuamán", 0.3]] },
  aguas: { localidad: "Aguas Calientes", categoria: "3 Estrellas", modalidad: "A_SOLICITUD", hoteles: [["Hostal Río Vilcanota", 0.5], ["Hotel Machu Picchu Inn", 0.25], ["Hostal Inti Wasi", 0.15]] },
  ollanta: { localidad: "Ollantaytambo", categoria: "3 Estrellas", modalidad: "BLOQUEO_PLAZAS", hoteles: [["Hotel Pakaritampu", 0]] },
};

const PAQUETES = [
  { nombre: "Camino Inca Clásico 4 días", circuito: "clasico", zona: "cusco3", tarifa: 780, previas: 1, posteriores: 1, cupo: 16, peso: 4 },
  { nombre: "Camino Inca Premium", circuito: "clasico", zona: "cusco4", tarifa: 1150, previas: 2, posteriores: 1, cupo: 10, peso: 2 },
  { nombre: "Camino Inca Express", circuito: "corto", zona: "aguas", tarifa: 490, previas: 0, posteriores: 1, cupo: 12, peso: 3 },
  { nombre: "Salkantay Aventura", circuito: "salkantay", zona: "aguas", tarifa: 690, previas: 1, posteriores: 0, cupo: 14, peso: 2 },
  { nombre: "Lares Cultural", circuito: "lares", zona: "ollanta", tarifa: 540, previas: 1, posteriores: 0, cupo: 10, peso: 1 },
] as const;

const NOMBRES = ["Lucía", "Martín", "Sofía", "Diego", "Valentina", "Tomás", "Camila", "Nicolás", "Julieta", "Mateo", "Paula", "Andrés", "Florencia", "Joaquín", "Agustina", "Facundo", "Carolina", "Gonzalo", "Natalia", "Ignacio", "Renata", "Bruno", "Elena", "Hugo"];
const APELLIDOS = ["Fernández", "Gómez", "Ramírez", "Castro", "Herrera", "Molina", "Rojas", "Silva", "Vega", "Ortiz", "Navarro", "Paz", "Medina", "Suárez", "Acosta", "Benítez", "Cabrera", "Domínguez", "Ibarra", "Luna", "Peralta", "Quiroga", "Ríos", "Sosa"];
const NACIONALIDADES = ["Argentina", "Chilena", "Uruguaya", "Brasileña", "Colombiana", "Mexicana", "Española", "Peruana"];
const GUIAS = ["Carlos Mendoza", "Rosa Huamán", "Marcos Quispe", "Elena Condori", "Raúl Mamani", "Sofía Ccori", "Hernán Apaza", "Pilar Yupanqui"];
const PORTEADORES = ["Julián Quispe", "Wilber Huamán", "Rubén Condori", "Efraín Mamani", "Percy Choque", "Edwin Puma", "Fredy Ccahuana", "Nilo Sallo", "Abel Turpo", "Ciro Hancco", "Dante Illa", "Elmer Pacco", "Fidel Roque", "Germán Sutta", "Hilario Tito", "Isaías Umasi", "Jaime Vilca", "Lino Waman", "Mario Yucra", "Néstor Zúñiga", "Óscar Arqque", "Pablo Bellota", "Raúl Cusi", "Saúl Dueñas"];
const MOTIVOS_RECHAZO = ["Sin disponibilidad en las fechas solicitadas", "Cupo tomado por un grupo", "Cierre por refacciones", "Tarifa no vigente para la temporada"];
const MOTIVOS_CANCELACION = ["Cambio de planes", "Problemas de salud", "Motivos laborales", "Encontró otra fecha", "Problema con el vuelo"];
const COMENTARIOS: Record<number, string[]> = {
  5: ["Una experiencia inolvidable, el guía fue excelente.", "Todo perfecto, de principio a fin.", "Superó lo que esperábamos."],
  4: ["Muy linda experiencia, con algún detalle en la logística.", "Muy bueno, los campamentos cómodos."],
  3: ["Correcto, esperaba un poco más del alojamiento.", "Bien, aunque hubo demoras."],
  2: ["La organización dejó que desear.", "Demoras y poca información."],
};
const INCIDENTES = [
  ["SALUD", "Pasajero con malestar por la altura", "BAJO"], ["SALUD", "Esguince de tobillo en el descenso", "MEDIO"], ["CLIMA", "Lluvia intensa demoró el tramo", "BAJO"],
  ["RETRASO", "Demora del transporte al punto de inicio", "BAJO"], ["EQUIPAMIENTO", "Carpa dañada por el viento", "MEDIO"], ["ACCIDENTE", "Caída en un tramo con piedras sueltas", "CRITICO"], ["OTRO", "Pasajero extravió su documentación", "MEDIO"],
] as const;

type Cliente = { idcliente: number; idusuario: number; token: string; primeraCompra?: string };
type Etapa = "historica" | "encurso" | "cerrada" | "publicada";
type Plan = { virtual: string; paquete: (typeof PAQUETES)[number]; etapa: Etapa; carlos?: boolean; cancelada?: boolean };

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
  planes.push({ virtual: sumarDias(hoy, -1), paquete: clasico, etapa: "encurso", carlos: true });
  planes.push({ virtual: sumarDias(hoy, 12), paquete: clasico, etapa: "cerrada", carlos: true });
  const historicas = planes.filter((p) => p.etapa === "historica");
  for (const i of [7, 25, 44]) historicas[i]!.cancelada = true;
  return planes.sort((a, b) => a.virtual.localeCompare(b.virtual));
}

async function main() {
  const hoy = fecha(0);
  const entorno = crearEntorno(DEMO_DB);
  entorno.resetear({ seed: false });
  const db = new PrismaClient({ datasources: { db: { url: entorno.DB_URL } } });
  await db.usuario.create({
    data: { nombre: "Carolina", apellido: "Gerente", email: "admin@incatour.com", contrasenia: await bcrypt.hash("AdminIncaTour123", 10), rol: "ADMIN", estado: "ACTIVO" },
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

    const correo = (texto: string) => texto.normalize("NFD").replace(/[^a-zA-Z]+/g, ".").toLowerCase();
    const hoteles: Record<string, { idservicio: number; idproveedor: number; rechazo: number }[]> = {};
    for (const [clave, z] of Object.entries(ZONAS)) {
      hoteles[clave] = [];
      for (const [nombre, rechazo] of z.hoteles) {
        const prov = await api("POST", "/proveedores", { tipoProveedor: "ALOJAMIENTO", razonSocial: `${nombre} S.A.C.`, localidad: z.localidad, datosContacto: `reservas@${correo(nombre)}.example`, canalComunicacion: "Email" });
        const idproveedor = idDe(prov, "idproveedor")!;
        const s = await api("POST", `/proveedores/${idproveedor}/servicios`, {
          tipo: "ALOJAMIENTO", nombreServicio: nombre, localidad: z.localidad, costoBase: 45, categoria: z.categoria, tipoHabitacion: "Doble", capacidadDisponible: 900, modalidadConfirmacion: z.modalidad,
        });
        hoteles[clave]!.push({ idservicio: idDe(s, "idservicio")!, idproveedor, rechazo });
      }
    }

    const transportes: { idservicio: number; idproveedor: number; ocupado: [string, string][] }[] = [];
    for (const nombre of ["Trans Andes", "Vilcanota Tours", "Inka Express Bus", "Valle Sagrado Traslados", "Cusco Van", "Qosqo Movil"]) {
      const prov = await api("POST", "/proveedores", { tipoProveedor: "TRANSPORTE", razonSocial: `${nombre} E.I.R.L.`, localidad: "Cusco", datosContacto: `operaciones@${correo(nombre)}.example`, canalComunicacion: "WhatsApp" });
      const idproveedor = idDe(prov, "idproveedor")!;
      const s = await api("POST", `/proveedores/${idproveedor}/servicios`, { tipo: "TRANSPORTE", nombreServicio: `Traslado ${nombre}`, localidad: "Cusco", costoBase: 120, capacidadVehiculo: 30, pesoEquipajeIncluido: 15, costoPorKgExcedente: 2 });
      transportes.push({ idservicio: idDe(s, "idservicio")!, idproveedor, ocupado: [] });
    }

    const paquetes = new Map<string, number>();
    for (const p of PAQUETES) {
      const z = ZONAS[p.zona]!;
      const pq = await api("POST", "/paquetes", {
        idcircuito: circuitos[p.circuito], nombrePaquete: p.nombre, condiciones: "Incluye permisos de ingreso, guía y porteadores. Reintegro total hasta 15 días antes de la salida.",
        tipoGarantia: "POR_CATEGORIA", localidadGarantizada: z.localidad, categoriaGarantizada: z.categoria, tipoHabitacionGarantizada: "Doble",
        nochesPrevias: p.previas, nochesPosteriores: p.posteriores, diasMinimosReintegro: 15,
        matrizPrecios: tarifasPorFactor.map((t) => ({ idtemporada: t.idtemporada, monto: Math.round(p.tarifa * t.factor), moneda: "USD" })),
      });
      paquetes.set(p.nombre, idDe(pq, "idpaquete")!);
    }

    type Empleado = { idpersonal: number; ocupado: [string, string][]; token?: string };
    const separar = (completo: string) => { const [nombre, ...resto] = completo.split(" "); return { nombre: nombre!, apellido: resto.join(" ") }; };
    const guias: Empleado[] = [];
    for (const [i, completo] of GUIAS.entries()) {
      const email = `${correo(separar(completo).nombre)}.guia@incatour.com`;
      const g = await api("POST", "/personal", {
        ...separar(completo), nroPasaporte: `PEG${1000 + i}`, nacionalidad: "Peruana", fechaVencimientoPasaporte: "2036-06-30", rolOperativo: "Guía",
        email, contrasenia: CLAVE_GUIA, nroHabilitacion: `HAB-${2000 + i}`, fechaHabilitacion: "2032-12-31",
      });
      guias.push({ idpersonal: idDe(g, "idpersonal")!, ocupado: [], token: await back.login(email, CLAVE_GUIA) });
    }
    const porteadores: Empleado[] = [];
    for (const [i, completo] of PORTEADORES.entries()) {
      const p = await api("POST", "/personal", { ...separar(completo), nroPasaporte: `PEP${3000 + i}`, nacionalidad: "Peruana", fechaVencimientoPasaporte: "2036-06-30", rolOperativo: "Porteador" });
      porteadores.push({ idpersonal: idDe(p, "idpersonal")!, ocupado: [] });
    }

    const clientes: Cliente[] = [];
    const registrarCliente = async (nombre: string, apellido: string, email: string) => {
      const c = await api("POST", "/clientes", { email, contrasenia: CLAVE_CLIENTE, nombre, apellido }, "");
      clientes.push({ idcliente: idDe(c, "idcliente")!, idusuario: idDe(c, "idusuario")!, token: await back.login(email, CLAVE_CLIENTE) });
    };
    await registrarCliente("Juan", "Pérez", "juan@test.com");
    for (let i = 0; i < 59; i++) {
      const [nombre, apellido] = [NOMBRES[i % NOMBRES.length]!, APELLIDOS[(i * 7) % APELLIDOS.length]!];
      await registrarCliente(nombre, apellido, `${correo(nombre)}.${correo(apellido)}${i}@demo.example`);
    }

    // ==================== Operación ====================
    // Lo que la API sella con la hora de hoy; se corrige al final con la fecha de la historia
    const marcas = {
      salidas: [] as { idsalida: number; virtual: string; fin: string; idbloqueo: string | null; cancelada: boolean }[],
      reservas: [] as { idreserva: number; viajo: boolean; compra: string; cancelacion?: string }[],
      gestiones: [] as { idsolicitud: number; idservicio: number; fecha: string }[],
      resenias: [] as { idcliente: number; idsalida: number; fecha: string }[],
    };
    let pasaporte = 100000;
    const pasajeroNuevo = () => ({
      nombreCompleto: `${elegir(NOMBRES)} ${elegir(APELLIDOS)}`, nroPasaporte: `DM${pasaporte++}`, nacionalidad: elegir(NACIONALIDADES), fechaVencimientoPasaporte: "2036-01-01",
    });
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
      const real = viaja ? masAnios(virtual, ANIOS_DE_VIAJE) : virtual;
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
      const compradores = mezclar(clientes);
      const compras: { cliente: Cliente; pasajeros: ReturnType<typeof pasajeroNuevo>[]; anticipacion: number }[] = [];
      while (porVender > 0) {
        const cantidad = Math.min(porVender, elegir([1, 2, 2, 2, 3, 4]));
        const maxima = viaja ? 120 : Math.max(2, Math.min(120, 120 + Math.floor((new Date(virtual).getTime() - new Date(hoy).getTime()) / (24 * H))));
        compras.push({ cliente: compradores[compras.length]!, pasajeros: Array.from({ length: cantidad }, pasajeroNuevo), anticipacion: entre(viaja ? 30 : 1, maxima) });
        porVender -= cantidad;
      }
      const vendidas = await Promise.all(compras.map(async (c) => {
        const r = await api("POST", "/reservas", {
          idsalida, medioPago: "TARJETA", pasajeros: c.pasajeros, equipaje: c.pasajeros.map(() => ({ pesoDeclarado: entre(6, 14) })),
          tarjeta: { numero: "4242424242424242", titular: "DEMO INCATOUR", vencimiento: "12/30", cvv: "123" },
        }, c.cliente.token);
        const idreserva = idDe(r, "idreserva")!;
        const base = viaja || etapa === "cerrada" ? virtual : hoy;
        const compra = sumarDias(base, -c.anticipacion);
        const marca: (typeof marcas.reservas)[number] = { idreserva, viajo: viaja, compra: compra > hoy ? sumarDias(hoy, -1) : compra };
        marcas.reservas.push(marca);
        if (!c.cliente.primeraCompra || marca.compra < c.cliente.primeraCompra) c.cliente.primeraCompra = marca.compra;
        return { ...c, idreserva, marca };
      }));

      // CU-33/34: en las salidas a la venta quedan solicitudes sin resolver
      const pendientes = (await api("GET", "/solicitudes")).filter((s: any) => s.reserva.idsalida === idsalida);
      for (const pendiente of pendientes) {
        if (etapa === "publicada" && azar() < 0.5) continue;
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
        if (azar() > 0.12 || vigentes.length === 1) continue;
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
      await api("POST", `/salidas/${idsalida}/asignacion`, { personalIds: [...equipoGuias, ...equipoPorteadores].map((p) => p.idpersonal), idtransporte: transporte.idservicio, itemsCamping: [] });
      for (const r of [...equipoGuias, ...equipoPorteadores, transporte]) r.ocupado.push([real, realFin]);

      if (viaja) {
        // CU-49/50: la salida "empezó ayer" para el guía
        const guia = equipoGuias[0]!;
        const url = `/guia/salidas/${idsalida}`;
        const etapas = etapa === "encurso" ? 1 : CIRCUITOS[paquete.circuito].etapas.length;
        await mover(fecha(-1), fecha(dias - 2));
        for (let i = 1; i <= etapas; i++) {
          await api("POST", `${url}/avances`, { numeroOrden: i, estadoTramo: "COMPLETADO", fechaHoraLlegada: hace((etapas - i + 2) * H) }, guia.token);
          if (i === 1 && etapa === "historica" && azar() < 0.3) {
            const [tipoIncidente, descripcion, nivelGravedad] = elegir(INCIDENTES);
            await api("POST", `${url}/incidentes`, { tipoIncidente, descripcion, nivelGravedad, fechaHoraOcurrencia: hace(H) }, guia.token);
          }
        }
      }

      if (etapa === "historica") {
        // CU-47: la nota acompaña a la temporada alta, donde los grupos van llenos
        for (const v of vigentes) {
          if (azar() > 0.6) continue;
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

    await llevarALaFechaReal(db, marcas, clientes, hoy);
    await verificar(db, hoy);
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
