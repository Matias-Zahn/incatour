import express from "express";
import cors from "cors";
import { envs } from "./config/envs";
import { ClienteRoutes } from "./modulos/cuentas/clientes/cliente.routes";
import { manejadorErrores } from "./error/manejadorErrores";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/", (req, res) => {
  res.json({ message: "HOLA" });
});

//RUTAS
// Para clientes - Registro - Reservas - ETC
app.use("/api/clientes", ClienteRoutes.getRoutes);

// Módulo Catálogo - Circuitos
import { CircuitoRoutes } from "./modulos/catalogo/circuitos/circuito.routes";
app.use("/api/circuitos", CircuitoRoutes.getRoutes);

// Módulo Catálogo - Temporadas
import { TemporadaRoutes } from "./modulos/catalogo/temporadas/temporada.routes";
app.use("/api/temporadas", TemporadaRoutes.getRoutes);

// Módulo Catálogo - Etapas
import { EtapaRoutes } from "./modulos/catalogo/etapas/etapa.routes";
app.use("/api/circuitos/:idcircuito/etapas", EtapaRoutes.getRoutes);

// Módulo Catálogo - Paquetes
import { PaqueteRoutes } from "./modulos/catalogo/paquetes/paquete.routes";
app.use("/api/paquetes", PaqueteRoutes.getRoutes);

// Módulo Catálogo - Público (Escaparate)
import { CatalogoRoutes } from "./modulos/catalogo/catalogo-publico/catalogo.routes";
app.use("/api/catalogo", CatalogoRoutes.getRoutes);

// Módulo Reservas - Solicitudes de Alojamiento
import { SolicitudRoutes } from "./modulos/reservas/solicitudes/solicitud.routes";
app.use("/api/solicitudes", SolicitudRoutes.getRoutes);

//ACA IRIAN las demas

app.use(manejadorErrores);

app.listen(envs.PORT, () => {
  console.log(`SERVIDOR corriendo en el puerto ${envs.PORT}`);
});
