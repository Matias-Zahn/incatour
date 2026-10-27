import { hoyUTC } from "../../../shared/fechas";
import { armarDefinicionPaquete, DefinicionPaquete, definicionEfectiva, textoGarantia } from "../../../shared/definicionPaquete";
import { CatalogoRepository, FiltrosCatalogo } from "./catalogo.repository";
import { obtenerImagenesDePaquete } from "../../../shared/upload/uploadPaquete.middleware";

// CAT-29 / CAT-30: lo que se vende en una salida es su foto (CAT-05): garantía, noches, condiciones y franquicia de equipaje
function definicionDeSalida(d: DefinicionPaquete) {
  const transporte = d.servicios.find((sv) => sv.transporte)?.transporte ?? null;
  return {
    garantia: textoGarantia(d),
    nochesPrevias: d.nochesPrevias,
    nochesPosteriores: d.nochesPosteriores,
    condiciones: d.condiciones,
    equipajeTransporte: transporte,
  };
}

export class CatalogoService {
  private repository = new CatalogoRepository();

  async consultarCatalogo(filtros?: FiltrosCatalogo) {
    // 1. Obtener los paquetes activos desde la base de datos aplicando filtros (CU-26, CAT-13)
    const paquetesDB = await this.repository.buscarPaquetesActivos(filtros);
    const hoy = hoyUTC();

    // 2. Formatear y limpiar los datos para el frontend (escaparate comercial y compra CU-30)
    const catalogo = paquetesDB.map((paquete) => {
      // Filtramos para mostrar solo las tarifas de temporadas que estén vigentes
      const tarifasVigentes = paquete.tarifas
        .filter((t) => t.temporada.estado === "ACTIVO")
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
      const serviciosIncluidos = serviciosActivos.map((s) => s.servicio.nombreServicio);

      // Extraemos la franquicia de equipaje si el paquete incluye un servicio de transporte activo
      const transporteIncluido = serviciosActivos
        .map((s) => s.servicio.transporte)
        .find((t) => t !== null && t !== undefined);

      const equipajeTransporte = transporteIncluido
        ? {
            pesoEquipajeIncluido: transporteIncluido.pesoEquipajeIncluido,
            costoPorKgExcedente: transporteIncluido.costoPorKgExcedente,
          }
        : null;

      // CAT-29: la garantía del paquete (rige para las salidas nuevas); cada salida informa la suya, congelada (CAT-05)
      const garantía = textoGarantia(armarDefinicionPaquete(paquete));

      // 3. Salidas programadas vigentes (PUBLICADA y con fecha posterior a ahora)
      // CAT-07: Si ninguna tarifa cubre la fecha de la salida, se marca sin precio (null)
      const salidasDisponibles = (paquete.salidas ?? [])
        .filter((s) => s.estado === "PUBLICADA" && new Date(s.fechaInicio) > hoy)
        .map((s) => {
          const fechaSalida = new Date(s.fechaInicio);
          const tarifaSalida = paquete.tarifas.find(
            (t) =>
              t.temporada.estado === "ACTIVO" &&
              new Date(t.temporada.fechaInicio) <= fechaSalida &&
              fechaSalida <= new Date(t.temporada.fechaFin)
          );

          return {
            idsalida: s.idsalida,
            nroSalida: s.nroSalida,
            fechaInicio: s.fechaInicio instanceof Date ? s.fechaInicio.toISOString() : new Date(s.fechaInicio).toISOString(),
            fechaFin: s.fechaFin instanceof Date ? s.fechaFin.toISOString() : new Date(s.fechaFin).toISOString(),
            stockLocal: s.stockLocal,
            cupoDisponible: s.stockLocal,
            tamanoMaximo: s.tamanoMaximo,
            precioPersona: tarifaSalida ? tarifaSalida.monto : null,
            moneda: tarifaSalida ? tarifaSalida.moneda : null,
            temporadaNombre: tarifaSalida ? tarifaSalida.temporada.nombre : null,
            ...definicionDeSalida(definicionEfectiva({ definicionPaquete: s.definicionPaquete, paquete })),
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
        logistica: {
          nochesPrevias: paquete.nochesPrevias,
          nochesPosteriores: paquete.nochesPosteriores,
        },
        serviciosAdicionales: serviciosIncluidos,
        serviciosIncluidos,
        equipajeTransporte,
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
