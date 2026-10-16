import express from "express";
import cors from "cors";
import { envs } from "./config/envs";
import { manejadorErrores } from "./error/manejadorErrores";
import { setupSwagger } from "./config/swagger";

const app = express();

app.use(cors());
app.use(express.json());

setupSwagger(app);

app.get("/api/", (req, res) => {
  res.json({ message: "HOLA" });
});

// Autoridad
import { configurarAutoridad } from "./modulos/salidas/autoridad.wiring";
import { AutoridadMock } from "./integraciones/autoridad/autoridad.mock";
configurarAutoridad(new AutoridadMock());

//Modulo Auth
import { AuthRoutes } from "./shared/auth/auth.routes";
app.use("/api/auth", AuthRoutes.getRoutes);

// Modulo Clientes
import { ClienteRoutes } from "./modulos/cuentas/clientes/cliente.routes";
app.use("/api/clientes", ClienteRoutes.getRoutes);

// Modulo Personal (Guías,Porteadores)
import { PersonalRoutes } from "./modulos/cuentas/personal/personal.routes";
app.use("/api/personal", PersonalRoutes.getRoutes);

// Modulo Cuenta Guia
import { CuentaGuiaRoutes } from "./modulos/cuentas/cuenta-guia/cuenta-guia.routes";
app.use("/api/cuentas-guia", CuentaGuiaRoutes.getRoutes);

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

// Módulo Proveedores - Proveedores
import { ProveedorRoutes } from "./modulos/proveedores/proveedores/proveedor.routes";
app.use("/api/proveedores", ProveedorRoutes.getRoutes);

//  Módulos Proveedores - Servicios
import { ServicioRoutes } from "./modulos/proveedores/servicios/servicio.routes";
app.use("/api/proveedores/:idproveedor/servicios", ServicioRoutes.getRoutesPorProveedor);
app.use("/api/servicios", ServicioRoutes.getRoutes); 
 
// Módulo Reservas - Solicitudes de Alojamiento
import { SolicitudRoutes } from "./modulos/reservas/solicitudes/solicitud.routes";
app.use("/api/solicitudes", SolicitudRoutes.getRoutes);

// Módulo Reservas - Reservas
import { ReservaRoutes } from "./modulos/reservas/reservas/reserva.routes";
app.use("/api/reservas", ReservaRoutes.getRoutes);

// Módulo Reservas - GestionReserva
import { GestionReservaRoutes } from "./modulos/reservas/gestion-reservas/gestion-reserva.routes"; // CU-31, 32 (rol 2)
app.use("/api/reservas", GestionReservaRoutes.getRoutes);   // GET y POST /:id/* (CU-31, 32)

// Módulo Reservas - Resenia
import { ReseniaRoutes } from "./modulos/reservas/resenias/resenia.routes";   
app.use("/api/resenias", ReseniaRoutes.getRoutes);

// Módulo Salidas - Salidas
import { SalidaRoutes } from "./modulos/salidas/salidas/salida.routes";
app.use("/api/salidas", SalidaRoutes.getRoutes);

// Módulo Salidas - Cancelación-Salida
import { CancelacionSalidaRoutes } from "./modulos/salidas/cancelacion-salida/cancelacion-salida.routes";
app.use("/api/salidas", CancelacionSalidaRoutes.getRoutes);  // GET /:id/cancelacion, POST /:id/cancelar

// Módulo Salidas - Logistica
import { LogisticaRoutes } from "./modulos/salidas/logistica/logistica.routes";
app.use("/api/salidas", LogisticaRoutes.getRoutes);    

// Módulo Salidas - Devolución de Equipamiento (CU-41)
import { DevolucionEquipamientoRoutes } from "./modulos/salidas/devolucion-equipamiento/devolucion-equipamiento.routes";
app.use("/api/salidas", DevolucionEquipamientoRoutes.getRoutes);

// Módulo Salidas - Asignación de recursos (CU-40)
import { AsignacionRoutes } from "./modulos/salidas/asignacion/asignacion.routes";
app.use("/api/salidas", AsignacionRoutes.getRoutes);

// Módulo Salidas - Reemplazo de personal (CU-38)
import { ReemplazoRoutes } from "./modulos/salidas/reemplazos/reemplazo.routes";
app.use("/api/salidas", ReemplazoRoutes.getRoutes);
//ACA IRIAN las demas

app.use(manejadorErrores);

app.listen(envs.PORT, () => {
  console.log(`SERVIDOR corriendo en el puerto ${envs.PORT}`);
});
