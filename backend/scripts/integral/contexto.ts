/**
 * Contexto y datos de prueba compartidos por los módulos de test:integral.
 * Cada escenario arma sus propios datos con fixtures (sufijo único, localidad propia): no depende del seed
 * salvo el admin y las temporadas, así los escenarios no se pisan entre sí.
 */
import { PrismaClient } from "@prisma/client";
import { Back, idDe, resumen } from "../lib-prueba";

export type Ctx = ReturnType<typeof crearContexto>;

const DIA = 24 * 3600 * 1000;
/** Fecha YYYY-MM-DD a `dias` de hoy (día local, igual que hoyUTC del back) */
export const fecha = (dias: number) => {
  const d = new Date(Date.now() + dias * DIA);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** Instante ISO de hace `ms` milisegundos (para avances e incidentes) */
export const hace = (ms: number) => new Date(Date.now() - ms).toISOString();

export function crearContexto(p: {
  back: Back;
  backCaido: Back;
  db: PrismaClient;
  admin: string;
  conocidas: Record<string, string>;
}) {
  const { back, backCaido, db, admin, conocidas } = p;
  const fallas: string[] = [];
  const pendientes: string[] = [];
  const arreglados: string[] = [];
  let seccionActual = "";
  let n = 0;
  const unico = () => `${Date.now().toString(36).toUpperCase()}${(n++).toString(36).toUpperCase()}`;
  // Para nombres y apellidos, que el back exige solo con letras
  const letras = (u: string) => u.replace(/\d/g, (d) => "ABCDEFGHIJ"[Number(d)]!);

  function registrar(nombre: string, ok: boolean, detalle: string) {
    const conocida = conocidas[nombre];
    if (ok) {
      console.log(`  ✓ ${nombre}`);
      if (conocida) arreglados.push(`${nombre} (${conocida})`);
      return;
    }
    if (conocida) {
      console.log(`  ~ ${nombre}  [pendiente ${conocida}]`);
      pendientes.push(`${conocida} · ${seccionActual} · ${nombre}: ${detalle}`);
    } else {
      console.log(`  ✗ ${nombre}\n      ${detalle}`);
      fallas.push(`${seccionActual} · ${nombre}: ${detalle}`);
    }
  }

  const ctx = {
    back, backCaido, db, admin, idDe, fallas, pendientes, arreglados, unico,

    seccion(titulo: string) {
      seccionActual = titulo;
      console.log(`\n${titulo}`);
    },

    /**
     * Llama a la API y exige un status exacto (o uno de una lista). Devuelve data (o el body) para encadenar;
     * con un status no esperado devuelve undefined. Usar el nombre del escenario como aparece en CONOCIDAS.
     */
    async esperar(nombre: string, metodo: string, ruta: string, body: unknown, tok: string, esperado: number | number[], via: Back = back) {
      const r = await via.llamar(metodo, ruta, body, tok);
      const lista = Array.isArray(esperado) ? esperado : [esperado];
      const ok = lista.includes(r.status);
      registrar(nombre, ok, `${metodo} ${ruta} → ${r.status} (esperado ${lista.join("/")}) ${resumen(r.body)}${r.error}`);
      return ok ? (r.body?.data ?? r.body) : undefined;
    },

    /** Para controlar el estado leído de la base o de una respuesta */
    controlar(nombre: string, ok: boolean, detalle = "") {
      registrar(nombre, ok, detalle);
    },

    /** Llamada de preparación: tiene que dar 2xx o corta el escenario con una falla */
    async preparar(nombre: string, metodo: string, ruta: string, body?: unknown, tok = admin): Promise<any> {
      const r = await back.llamar(metodo, ruta, body, tok);
      if (r.status < 200 || r.status >= 300) {
        throw new Error(`Preparación "${nombre}": ${metodo} ${ruta} → ${r.status} ${resumen(r.body)}${r.error}`);
      }
      return r.body?.data ?? r.body;
    },

    /** Corre un escenario aislado: si su preparación falla, lo registra y sigue con el próximo */
    async escenario(nombre: string, fn: () => Promise<void>) {
      try {
        await fn();
      } catch (e) {
        registrar(nombre, false, `corte del escenario: ${e instanceof Error ? e.message : e}`);
      }
    },
  };

  type OpcionesCompra = { n?: number; pasajeros?: any[]; tarjeta?: string; equipajeKg?: number };

  // ==================== Fixtures ====================
  const f = {
    /** Cliente nuevo con su token */
    async cliente(): Promise<{ idcliente: number; email: string; token: string }> {
      const u = unico().toLowerCase();
      const email = `cli.${u}@integral.com`;
      const c = await ctx.preparar("Registrar cliente", "POST", "/clientes", { email, contrasenia: "clienteInt123", nombre: "Cliente", apellido: letras(u) }, "");
      return { idcliente: idDe(c, "idcliente")!, email, token: await back.login(email, "clienteInt123") };
    },

    /** Circuito con `etapas` etapas consecutivas */
    async circuito(o: { etapas?: number; minimoGuias?: number; duracionDias?: number } = {}) {
      const etapas = o.etapas ?? 2;
      const c = await ctx.preparar("Crear circuito", "POST", "/circuitos", {
        nombreCircuito: `Int ${unico()}`, duracionDias: o.duracionDias ?? 3, dificultad: "Moderada",
        minimoGuias: o.minimoGuias ?? 1, parametrosPorteadores: "1 por cada 2 pasajeros",
      });
      const idcircuito = idDe(c, "idcircuito")!;
      if (etapas > 0) {
        await ctx.preparar("Definir etapas", "PUT", `/circuitos/${idcircuito}/etapas`, {
          etapas: Array.from({ length: etapas }, (_, i) => ({ numeroOrden: i + 1, puntoInicio: `P${i}`, puntoFin: `P${i + 1}`, campamentoPrevisto: `Camp ${i + 1}` })),
        });
      }
      return idcircuito;
    },

    /** Proveedor con un servicio. tipo ALOJAMIENTO, TRANSPORTE o EQUIPAMIENTO; `campos` según servicio.dto.ts */
    async servicio(tipo: "ALOJAMIENTO" | "TRANSPORTE" | "EQUIPAMIENTO", localidad: string, campos: Record<string, unknown>) {
      const prov = await ctx.preparar("Alta proveedor", "POST", "/proveedores", {
        tipoProveedor: tipo, razonSocial: `Int ${tipo} ${unico()}`, localidad, datosContacto: "int@test.com", canalComunicacion: "Email",
      });
      const idproveedor = idDe(prov, "idproveedor")!;
      const s = await ctx.preparar("Registrar servicio", "POST", `/proveedores/${idproveedor}/servicios`, {
        tipo, nombreServicio: `Int ${tipo} ${unico()}`, localidad, costoBase: 10, ...campos,
      });
      return { idproveedor, idservicio: idDe(s, "idservicio")! };
    },

    /** Hotel de la localidad (3 Estrellas, Doble). modalidad BLOQUEO_PLAZAS (stock propio) o A_SOLICITUD */
    hotel(localidad: string, capacidad = 50, modalidad: "BLOQUEO_PLAZAS" | "A_SOLICITUD" = "BLOQUEO_PLAZAS") {
      return f.servicio("ALOJAMIENTO", localidad, { categoria: "3 Estrellas", tipoHabitacion: "Doble", capacidadDisponible: capacidad, modalidadConfirmacion: modalidad });
    },

    transporte(localidad: string, capacidad = 30) {
      return f.servicio("TRANSPORTE", localidad, { capacidadVehiculo: capacidad, pesoEquipajeIncluido: 15, costoPorKgExcedente: 2 });
    },

    equipamiento(localidad: string, cantidad = 10) {
      return f.servicio("EQUIPAMIENTO", localidad, { tipoEquipamiento: "Carpa", cantidadDisponible: cantidad });
    },

    /**
     * Paquete por categoría en una localidad propia (así solo ve los hoteles que arma el escenario).
     * Tarifa 500 USD en todas las temporadas activas (la del seed cubre hasta fin de 2026; setup agrega 2027-2028).
     */
    async paquete(o: { idcircuito?: number; localidad?: string; diasMinimosReintegro?: number | null; serviciosIncluidos?: number[]; monto?: number } = {}) {
      const localidad = o.localidad ?? `Loc ${unico()}`;
      const idcircuito = o.idcircuito ?? (await f.circuito());
      const temporadas = await db.temporada.findMany({ where: { estado: "ACTIVO" } });
      const pq = await ctx.preparar("Crear paquete", "POST", "/paquetes", {
        idcircuito, nombrePaquete: `Int ${unico()}`, condiciones: "Integral", tipoGarantia: "POR_CATEGORIA",
        localidadGarantizada: localidad, categoriaGarantizada: "3 Estrellas", tipoHabitacionGarantizada: "Doble",
        nochesPrevias: 0, nochesPosteriores: 0,
        matrizPrecios: temporadas.map((t) => ({ idtemporada: t.idtemporada, monto: o.monto ?? 500, moneda: "USD" })),
        ...(o.diasMinimosReintegro !== undefined && { diasMinimosReintegro: o.diasMinimosReintegro }),
        ...(o.serviciosIncluidos && { serviciosIncluidos: o.serviciosIncluidos }),
      });
      return { idpaquete: idDe(pq, "idpaquete")!, idcircuito, localidad };
    },

    /** Salida PUBLICADA. Si hay un hotel con bloqueo que alcanza, lo usa (idalojamiento) */
    async salida(idpaquete: number, fechaInicio: string, tamanoMaximo: number, idalojamiento?: number) {
      const s = await ctx.preparar("Crear salida", "POST", "/salidas", { idpaquete, fechaInicio, tamanoMaximo, ...(idalojamiento && { idalojamiento }) });
      return idDe(s, "idsalida")!;
    },

    /** Body de compra: `n` pasajeros nuevos (o los que se pasen) */
    compra(idsalida: number, o: OpcionesCompra = {}) {
      const pasajeros = o.pasajeros ?? Array.from({ length: o.n ?? 1 }, () => f.pasajero());
      return {
        idsalida, medioPago: "TARJETA", pasajeros,
        equipaje: pasajeros.map(() => ({ pesoDeclarado: o.equipajeKg ?? 8 })),
        tarjeta: { numero: o.tarjeta ?? "4242424242424242", titular: "Int Prueba", vencimiento: "12/30", cvv: "123" },
      };
    },

    pasajero(o: { vence?: string; nombre?: string; pasaporte?: string } = {}) {
      const u = unico();
      return { nombreCompleto: o.nombre ?? `Pasajero ${letras(u)}`, nroPasaporte: o.pasaporte ?? `PI${u}`, nacionalidad: "Argentina", fechaVencimientoPasaporte: o.vence ?? "2035-01-01" };
    },

    /** Compra que tiene que salir bien; devuelve la reserva */
    async comprar(tokCliente: string, idsalida: number, o: OpcionesCompra = {}) {
      const r = await ctx.preparar("Comprar", "POST", "/reservas", f.compra(idsalida, o), tokCliente);
      return { idreserva: idDe(r, "idreserva")!, data: r };
    },

    async guia(o: { habilitacionVence?: string; pasaporteVence?: string } = {}) {
      const u = unico();
      const email = `guia.${u.toLowerCase()}@integral.com`;
      const g = await ctx.preparar("Registrar guía", "POST", "/personal", {
        nombre: "Guia", apellido: letras(u), nroPasaporte: `GI${u}`, nacionalidad: "Peruana", fechaVencimientoPasaporte: o.pasaporteVence ?? "2035-01-01",
        rolOperativo: "Guía", email, contrasenia: "guiaInt123", nroHabilitacion: `HAB-${u}`, fechaHabilitacion: o.habilitacionVence ?? "2034-12-31",
      });
      return { idpersonal: idDe(g, "idpersonal")!, idusuario: idDe(g, "idusuario"), email, token: await back.login(email, "guiaInt123") };
    },

    async porteador(o: { pasaporteVence?: string } = {}) {
      const u = unico();
      const p = await ctx.preparar("Registrar porteador", "POST", "/personal", {
        nombre: "Porteador", apellido: letras(u), nroPasaporte: `PO${u}`, nacionalidad: "Peruana", fechaVencimientoPasaporte: o.pasaporteVence ?? "2035-01-01", rolOperativo: "Porteador",
      });
      return idDe(p, "idpersonal")!;
    },

    /** Corre las fechas de una salida (por ejemplo, "empezó ayer" = fecha(-1), fecha(+1)) */
    async moverFechas(idsalida: number, inicio: string, fin: string) {
      await db.salida.update({ where: { idsalida }, data: { fechaInicio: new Date(inicio), fechaFin: new Date(fin) } });
    },
  };

  return { ...ctx, f };
}

export const DIA_MS = DIA;
