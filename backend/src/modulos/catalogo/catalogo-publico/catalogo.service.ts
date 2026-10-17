import { CatalogoRepository } from "./catalogo.repository";
import { obtenerImagenesDePaquete } from "../../../shared/upload/uploadPaquete.middleware";

export class CatalogoService {
  private repository = new CatalogoRepository();

  async consultarCatalogo() {
    // 1. Obtener los paquetes activos desde la base de datos
    const paquetesDB = await this.repository.buscarPaquetesActivos();
    const ahora = new Date();

    // 2. Formatear y limpiar los datos para el frontend (escaparate comercial y compra CU-30)
    const catalogo = paquetesDB.map(paquete => {
      
      // Filtramos para mostrar solo las tarifas de temporadas que estén vigentes
      const tarifasVigentes = paquete.tarifas
        .filter(t => t.temporada.estado === "ACTIVO")
        .map(t => ({
          idtemporada: t.temporada.idtemporada,
          temporada: t.temporada.nombre,
          fechaInicio: t.temporada.fechaInicio.toISOString().split('T')[0],
          fechaFin: t.temporada.fechaFin.toISOString().split('T')[0],
          precio: t.monto,
          moneda: t.moneda
        }));

      // Extraemos información limpia de los servicios
      const serviciosIncluidos = paquete.servicios.map(s => s.servicio.nombreServicio);

      // Extraemos la franquicia de equipaje si el paquete incluye un servicio de transporte
      const transporteIncluido = paquete.servicios
        .map(s => s.servicio.transporte)
        .find(t => t !== null && t !== undefined);

      const equipajeTransporte = transporteIncluido
        ? {
            pesoEquipajeIncluido: transporteIncluido.pesoEquipajeIncluido,
            costoPorKgExcedente: transporteIncluido.costoPorKgExcedente,
          }
        : null;

      // Determinamos el texto de la garantía (soportando mayúsculas/minúsculas o acentos)
      const tipoGarantiaNorm = paquete.tipoGarantia.toUpperCase();
      let garantía = "Sin garantía especificada";
      if (tipoGarantiaNorm.includes("CATEGORIA") || tipoGarantiaNorm.includes("CATEGORÍA")) {
        const hab = paquete.tipoHabitacionGarantizada
          ? ` · Hab. ${paquete.tipoHabitacionGarantizada}`
          : "";
        garantía = `${paquete.categoriaGarantizada ?? "Categoría estándar"} en ${paquete.localidadGarantizada ?? "Cusco"}${hab}`;
      } else if (tipoGarantiaNorm.includes("ESTABLECIMIENTO") && paquete.garantiasEstablecimiento.length > 0) {
        const servGar = paquete.garantiasEstablecimiento[0]?.servicio;
        garantía = servGar ? `${servGar.nombreServicio} (${servGar.localidad})` : "Garantía por establecimiento";
      }

      // Salidas publicadas disponibles para comprar este paquete (CU-30)
      const salidasDisponibles = (paquete.salidas ?? [])
        .filter(s => s.estado === "PUBLICADA" && s.fechaInicio > ahora)
        .map(s => {
          const tarifaSalida = paquete.tarifas.find(
            t =>
              t.temporada.estado === "ACTIVO" &&
              t.temporada.fechaInicio <= s.fechaInicio &&
              s.fechaInicio <= t.temporada.fechaFin
          );
          return {
            idsalida: s.idsalida,
            nroSalida: s.nroSalida,
            fechaInicio: s.fechaInicio.toISOString(),
            fechaFin: s.fechaFin.toISOString(),
            stockLocal: s.stockLocal,
            tamanoMaximo: s.tamanoMaximo,
            precioPersona: tarifaSalida?.monto ?? tarifasVigentes[0]?.precio ?? 0,
            moneda: tarifaSalida?.moneda ?? tarifasVigentes[0]?.moneda ?? "USD",
            temporadaNombre:
              tarifaSalida?.temporada.nombre ??
              tarifasVigentes[0]?.temporada ??
              "Temporada vigente",
          };
        });

      const infoImagenes = obtenerImagenesDePaquete(
        paquete.idpaquete,
        paquete.nombrePaquete,
        paquete.circuito.nombreCircuito
      );

      // Retornamos un objeto "limpio" y seguro para el cliente final
      return {
        id: paquete.idpaquete,
        codigo: paquete.nroPaquete,
        nombre: paquete.nombrePaquete,
        imagenPrincipal: infoImagenes.imagenPrincipal,
        imagenes: infoImagenes.imagenes,
        tieneImagenesPropias: infoImagenes.tieneImagenesPropias,
        circuito: {
          nombre: paquete.circuito.nombreCircuito,
          dias: paquete.circuito.duracionDias,
          dificultad: paquete.circuito.dificultad,
          recorrido: paquete.circuito.etapas.map(e => e.puntoInicio).join(" -> ") + 
                     (paquete.circuito.etapas.length > 0 ? ` -> ${paquete.circuito.etapas[paquete.circuito.etapas.length - 1]?.puntoFin}` : ""),
          etapas: paquete.circuito.etapas.map(e => ({
            numeroOrden: e.numeroOrden,
            puntoInicio: e.puntoInicio,
            puntoFin: e.puntoFin,
            campamentoPrevisto: e.campamentoPrevisto,
          })),
        },
        nochesAlojamiento: {
          previas: paquete.nochesPrevias,
          posteriores: paquete.nochesPosteriores,
          garantia: garantía,
          tipoGarantia: paquete.tipoGarantia,
        },
        serviciosAdicionales: serviciosIncluidos,
        equipajeTransporte,
        condiciones: paquete.condiciones,
        diasDisponibles: paquete.diasDisponibles,
        precios: tarifasVigentes,
        salidasDisponibles,
      };
    });

    // Filtramos paquetes que no tengan precios vigentes (no se pueden vender)
    return catalogo.filter(p => p.precios.length > 0);
  }
}
