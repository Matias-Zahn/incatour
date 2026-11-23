import { hoyUTC } from "../../../shared/fechas";
import { TIPO_SERVICIO, tipoDeServicio } from "../../../shared/constantes";
import { claveDia, maximoPorReserva, sumarDias, unaPorServicio } from "../../../shared/ocupacion";
import { datosVenta } from "../../../shared/ventaAbierta";
import { armarDefinicionPaquete, DefinicionPaquete, definicionEfectiva, tarifaDeSalida, textoGarantia } from "../../../shared/definicionPaquete";
import { CatalogoRepository, FiltrosCatalogo } from "./catalogo.repository";
import { obtenerImagenesDePaquete } from "../../../shared/upload/uploadPaquete.middleware";

// CAT-29 / CAT-30: lo que se vende en una salida es su foto (CAT-05): garantía, noches y condiciones
function definicionDeSalida(d: DefinicionPaquete) {
  return {
    garantia: textoGarantia(d),
    nochesPrevias: d.nochesPrevias,
    nochesPosteriores: d.nochesPosteriores,
    condiciones: d.condiciones,
  };
}

type ServicioIncluido = { nombreServicio: string; tren?: { horarioSalida: string; horarioLlegada: string } | null };

// B2 y B9: el "incluye" sale de los servicios por tipo (transporte, tren y equipo); el tren lleva su horario
const ORDEN_INCLUYE: string[] = [TIPO_SERVICIO.TRANSPORTE, TIPO_SERVICIO.TREN, TIPO_SERVICIO.EQUIPAMIENTO];
export function textosIncluye(servicios: (ServicioIncluido & Parameters<typeof tipoDeServicio>[0])[]) {
  return servicios
    .map((s) => ({ s, orden: ORDEN_INCLUYE.indexOf(tipoDeServicio(s) ?? "") }))
    .filter((x) => x.orden >= 0)
    .sort((a, b) => a.orden - b.orden)
    .map(({ s }) => (s.tren ? `${s.nombreServicio} (sale ${s.tren.horarioSalida}, llega ${s.tren.horarioLlegada})` : s.nombreServicio));
}

export class CatalogoService {
  private repository = new CatalogoRepository();

  async consultarCatalogo(filtros?: FiltrosCatalogo) {
    // 1. Obtener los paquetes activos desde la base de datos aplicando filtros (CU-26, CAT-13)
    const paquetesDB = await this.repository.buscarPaquetesActivos(filtros);
    const hoy = hoyUTC();

    // 2. Formatear y limpiar los datos para el frontend (escaparate comercial y compra CU-30)
    const catalogo = paquetesDB.map((paquete) => {
      // Filtramos para mostrar solo las tarifas de temporadas que estén vigentes o por venir: una vencida ya no se puede comprar
      const tarifasVigentes = paquete.tarifas
        .filter((t) => t.temporada.estado === "ACTIVO" && t.temporada.fechaFin >= hoy)
        .map((t) => ({
          idtemporada: t.temporada.idtemporada,
          temporada: t.temporada.nombre,
          fechaInicio: t.temporada.fechaInicio.toISOString().split("T")[0],
          fechaFin: t.temporada.fechaFin.toISOString().split("T")[0],
          precio: t.monto,
          moneda: t.moneda,
        }));

      // Extraemos información limpia de los servicios activos (CAT-09: filtrar solo servicios activos)
      const serviciosActivos = paquete.servicios.filter((s) => s.servicio.estado === "ACTIVO");
      const serviciosIncluidos = textosIncluye(serviciosActivos.map((s) => s.servicio));

      // CAT-29: la garantía del paquete (rige para las salidas nuevas); cada salida informa la suya, congelada (CAT-05)
      const garantía = textoGarantia(armarDefinicionPaquete(paquete));

      // 3. Salidas programadas vigentes (PUBLICADA y con fecha posterior a ahora)
      // CAT-07: Si ninguna tarifa cubre la fecha de la salida, se marca sin precio (null)
      const salidasDisponibles = (paquete.salidas ?? [])
        .filter((s) => s.estado === "PUBLICADA" && new Date(s.fechaInicio) > hoy)
        .map((s) => {
          const definicion = definicionEfectiva({ definicionPaquete: s.definicionPaquete, paquete });
          const tarifaSalida = tarifaDeSalida(s, paquete.tarifas); // 12.5: la congelada en la salida

          return {
            idsalida: s.idsalida,
            nroSalida: s.nroSalida,
            fechaInicio: s.fechaInicio instanceof Date ? s.fechaInicio.toISOString() : new Date(s.fechaInicio).toISOString(),
            fechaFin: s.fechaFin instanceof Date ? s.fechaFin.toISOString() : new Date(s.fechaFin).toISOString(),
            stockLocal: s.stockLocal,
            cupoDisponible: s.stockLocal,
            maximoPorReserva: maximoPorReserva(s.stockLocal, unaPorServicio(s.ocupaciones ?? [])),
            tamanoMaximo: s.tamanoMaximo,
            precioPersona: tarifaSalida ? tarifaSalida.monto : null,
            moneda: tarifaSalida ? tarifaSalida.moneda : null,
            temporadaNombre: tarifaSalida ? tarifaSalida.temporada : null,
            ...datosVenta(s, hoy), // B4: las de venta cerrada se listan igual, para mostrar "Venta cerrada"
            // 12.7: después de esta fecha, cancelar ya no tiene reintegro (la regla de reintegro.ts)
            fechaLimiteReintegro:
              definicion.diasMinimosReintegro == null ? null : claveDia(sumarDias(s.fechaInicio, -definicion.diasMinimosReintegro)),
            ...definicionDeSalida(definicion),
          };
        });

      // Obtenemos imágenes dinámicas organizadas del paquete (o fallback sugerido)
      const infoImg = obtenerImagenesDePaquete(
        paquete.idpaquete,
        paquete.nombrePaquete,
        paquete.circuito?.nombreCircuito
      );

      const recorrido = paquete.circuito?.etapas?.map((e) => e.puntoInicio).join(" -> ") +
        (paquete.circuito?.etapas && paquete.circuito.etapas.length > 0
          ? ` -> ${paquete.circuito.etapas[paquete.circuito.etapas.length - 1]?.puntoFin}`
          : "");

      return {
        id: paquete.idpaquete,
        idpaquete: paquete.idpaquete,
        codigo: paquete.nroPaquete,
        nroPaquete: paquete.nroPaquete,
        nombre: paquete.nombrePaquete,
        nombrePaquete: paquete.nombrePaquete,
        imagenPrincipal: infoImg.imagenPrincipal,
        imagenes: infoImg.imagenes,
        tieneImagenesPropias: infoImg.tieneImagenesPropias,
        circuito: {
          idcircuito: paquete.circuito.idcircuito,
          nombre: paquete.circuito.nombreCircuito,
          nombreCircuito: paquete.circuito.nombreCircuito,
          dias: paquete.circuito.duracionDias,
          duracionDias: paquete.circuito.duracionDias,
          dificultad: paquete.circuito.dificultad,
          recorrido,
          diasValidosOperacion: paquete.diasDisponibles ?? "Todos los días",
          etapas: paquete.circuito.etapas.map((e) => ({
            orden: e.numeroOrden,
            numeroOrden: e.numeroOrden,
            inicio: e.puntoInicio,
            puntoInicio: e.puntoInicio,
            fin: e.puntoFin,
            puntoFin: e.puntoFin,
            campamento: e.campamentoPrevisto,
            campamentoPrevisto: e.campamentoPrevisto,
          })),
        },
        nochesAlojamiento: {
          previas: paquete.nochesPrevias,
          posteriores: paquete.nochesPosteriores,
          garantia: garantía,
          tipoGarantia: paquete.tipoGarantia,
        },
        garantíaAlojamiento: garantía,
        saleDesde: paquete.localidadGarantizada, // B2
        logistica: {
          nochesPrevias: paquete.nochesPrevias,
          nochesPosteriores: paquete.nochesPosteriores,
        },
        serviciosAdicionales: serviciosIncluidos,
        serviciosIncluidos,
        condiciones: paquete.condiciones,
        diasDisponibles: paquete.diasDisponibles,
        precios: tarifasVigentes,
        tarifas: tarifasVigentes,
        salidasDisponibles,
      };
    });

    return catalogo;
  }
}
