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
            servicio: {
              include: {
                transporte: true
              }
            }
          }
        },
        salidas: {
          where: {
            estado: "PUBLICADA"
          },
          orderBy: {
            fechaInicio: "asc"
          }
        },
        garantiasEstablecimiento: {
          include: {
            servicio: {
              include: {
                alojamiento: true
              }
            }
          }
        }
      },
      orderBy: { idpaquete: "asc" },
    });
  }
}
