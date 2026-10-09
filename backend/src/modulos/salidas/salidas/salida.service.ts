import { ConsultarSalidasDto } from "./salida.dto";
import { SalidaRepository } from "./salida.repository";

export class SalidaService {
  private repository = new SalidaRepository();

  // CU-35: Consultar salidas
  async consultarSalidas(dto: ConsultarSalidasDto) {
    return this.repository.buscar(dto);
  }
}
