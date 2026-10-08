import { CatalogoRepository } from "./catalogo.repository";

export class CatalogoService {
  private repository = new CatalogoRepository();

  async consultarCatalogo() {
    // 1. Obtener los paquetes activos desde la base de datos
    const paquetesDB = await this.repository.buscarPaquetesActivos();

    // 2. Formatear y limpiar los datos para el frontend (escaparate comercial)
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

      // Determinamos el texto de la garantía
      let garantía = "Sin garantía especificada";
      if (paquete.tipoGarantia === "POR_CATEGORIA") {
        garantía = `${paquete.categoriaGarantizada} en ${paquete.localidadGarantizada}`;
      } else if (paquete.tipoGarantia === "POR_ESTABLECIMIENTO" && paquete.servicioGarantizado) {
        garantía = `${paquete.servicioGarantizado.nombreServicio} (${paquete.servicioGarantizado.localidad})`;
      }

      // Retornamos un objeto "limpio" y seguro para el cliente final
      return {
        id: paquete.idpaquete,
        codigo: paquete.nroPaquete,
        nombre: paquete.nombrePaquete,
        circuito: {
          nombre: paquete.circuito.nombreCircuito,
          dias: paquete.circuito.duracionDias,
          dificultad: paquete.circuito.dificultad,
          recorrido: paquete.circuito.etapas.map(e => e.puntoInicio).join(" -> ") + 
                     (paquete.circuito.etapas.length > 0 ? ` -> ${paquete.circuito.etapas[paquete.circuito.etapas.length - 1]?.puntoFin}` : "")
        },
        nochesAlojamiento: {
          previas: paquete.nochesPrevias,
          posteriores: paquete.nochesPosteriores,
          garantia: garantía
        },
        serviciosAdicionales: serviciosIncluidos,
        condiciones: paquete.condiciones,
        diasDisponibles: paquete.diasDisponibles,
        precios: tarifasVigentes
      };
    });

    // Filtramos paquetes que no tengan precios vigentes (no se pueden vender)
    return catalogo.filter(p => p.precios.length > 0);
  }
}
