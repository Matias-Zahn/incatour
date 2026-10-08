import { db } from "../../../config/postgresDatabase";

export class CatalogoRepository {
  async buscarPaquetesActivos() {
    return db.paquete.findMany({
      where: { 
        estado: "ACTIVO",
        circuito: {
          estado: "ACTIVO"
        }
      },
      include: {
        circuito: {
          include: {
            etapas: {
              orderBy: { numeroOrden: "asc" }
            }
          }
        },
        tarifas: {
          include: {
            temporada: true
          }
        },
        servicios: {
          include: {
            servicio: true
          }
        },
        servicioGarantizado: {
          include: {
            alojamiento: true
          }
        }
      },
      orderBy: { idpaquete: "asc" },
    });
  }
}
