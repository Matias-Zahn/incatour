import { db } from "../../../config/postgresDatabase";
import { ConsultarSalidasDto } from "./salida.dto";

export class SalidaRepository {
  async buscar(dto: ConsultarSalidasDto) {
    return db.salida.findMany({
      where: {
        ...(dto.idpaquete && { idpaquete: dto.idpaquete }),
        ...(dto.estado && { estado: dto.estado }),
        ...((dto.desde || dto.hasta) && {
          fechaInicio: {
            ...(dto.desde && { gte: dto.desde }),
            ...(dto.hasta && { lte: dto.hasta }),
          },
        }),
        ...(dto.idguia && { personalAsignado: { some: { idpersonal: dto.idguia, personal: { rol: "Guía" } } } }),
      },
      include: {
        paquete: { select: { nroPaquete: true, nombrePaquete: true } },
        personalAsignado: { include: { personal: { select: { nombreCompleto: true, rol: true } } } },
        servicios: { include: { servicio: { select: { nombreServicio: true } } } },
      },
      orderBy: { fechaInicio: "asc" },
    });
  }
}
