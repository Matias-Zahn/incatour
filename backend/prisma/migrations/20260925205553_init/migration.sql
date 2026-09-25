-- CreateTable
CREATE TABLE "Usuario" (
    "idusuario" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "contrasenia" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ACTIVO',
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("idusuario")
);

-- CreateTable
CREATE TABLE "Cliente" (
    "idcliente" SERIAL NOT NULL,
    "idusuario" INTEGER NOT NULL,
    "nroCliente" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("idcliente")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "idreserva" SERIAL NOT NULL,
    "idcliente" INTEGER NOT NULL,
    "idsalida" INTEGER NOT NULL,
    "nroReserva" TEXT NOT NULL,
    "fechaRealizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cantidadPasajeros" INTEGER NOT NULL,
    "precioCongelado" DOUBLE PRECISION NOT NULL,
    "condicionesComerciales" TEXT,
    "estado" TEXT NOT NULL,
    "estadoAlojamiento" TEXT,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("idreserva")
);

-- CreateTable
CREATE TABLE "Personal" (
    "idpersonal" SERIAL NOT NULL,
    "idusuario" INTEGER,
    "nombreCompleto" TEXT NOT NULL,
    "nroPasaporte" TEXT NOT NULL,
    "nacionalidad" TEXT NOT NULL,
    "fechaVencimientoPasaporte" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL,
    "nroHabilitacion" TEXT,
    "fechaHabilitacion" TIMESTAMP(3),
    "rol" TEXT NOT NULL,

    CONSTRAINT "Personal_pkey" PRIMARY KEY ("idpersonal")
);

-- CreateTable
CREATE TABLE "Pasajero" (
    "idpasajero" SERIAL NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "nroPasaporte" TEXT NOT NULL,
    "nacionalidad" TEXT NOT NULL,
    "fechaVencimientoPasaporte" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pasajero_pkey" PRIMARY KEY ("idpasajero")
);

-- CreateTable
CREATE TABLE "ReservaPasajero" (
    "idreserva" INTEGER NOT NULL,
    "idpasajero" INTEGER NOT NULL,

    CONSTRAINT "ReservaPasajero_pkey" PRIMARY KEY ("idreserva","idpasajero")
);

-- CreateTable
CREATE TABLE "Transaccion" (
    "nrotransaccion" SERIAL NOT NULL,
    "idreserva" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "medioPago" TEXT NOT NULL,
    "estadoTransaccion" TEXT NOT NULL,
    "fechahora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("nrotransaccion")
);

-- CreateTable
CREATE TABLE "Solicitud" (
    "idsolicitud" SERIAL NOT NULL,
    "idreserva" INTEGER NOT NULL,
    "idservicio" INTEGER NOT NULL,
    "nroSolicitud" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "cantidadPlazas" INTEGER NOT NULL,
    "criterios" TEXT,
    "motivoRechazo" TEXT,

    CONSTRAINT "Solicitud_pkey" PRIMARY KEY ("idsolicitud")
);

-- CreateTable
CREATE TABLE "Valoracion" (
    "idvaloracion" SERIAL NOT NULL,
    "idreserva" INTEGER NOT NULL,
    "valoracion" INTEGER NOT NULL,
    "comentario" TEXT,
    "fechaEnvio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Valoracion_pkey" PRIMARY KEY ("idvaloracion")
);

-- CreateTable
CREATE TABLE "Paquete" (
    "idpaquete" SERIAL NOT NULL,
    "idcircuito" INTEGER NOT NULL,
    "nroPaquete" TEXT NOT NULL,
    "nombrePaquete" TEXT NOT NULL,
    "condiciones" TEXT,
    "estado" TEXT NOT NULL,
    "tipoGarantia" TEXT NOT NULL,
    "idservicioGarantizado" INTEGER,
    "localidadGarantizada" TEXT,
    "categoriaGarantizada" TEXT,
    "tipoHabitacionGarantizada" TEXT,
    "nochesPrevias" INTEGER NOT NULL DEFAULT 0,
    "nochesPosteriores" INTEGER NOT NULL DEFAULT 0,
    "diasDisponibles" TEXT,

    CONSTRAINT "Paquete_pkey" PRIMARY KEY ("idpaquete")
);

-- CreateTable
CREATE TABLE "Circuito" (
    "idcircuito" SERIAL NOT NULL,
    "nombreCircuito" TEXT NOT NULL,
    "duracionDias" INTEGER NOT NULL,
    "dificultad" TEXT NOT NULL,
    "minimoGuias" INTEGER NOT NULL,
    "parametrosPorteadores" TEXT,

    CONSTRAINT "Circuito_pkey" PRIMARY KEY ("idcircuito")
);

-- CreateTable
CREATE TABLE "EtapaRuta" (
    "idcircuito" INTEGER NOT NULL,
    "numeroOrden" INTEGER NOT NULL,
    "puntoInicio" TEXT NOT NULL,
    "puntoFin" TEXT NOT NULL,
    "campamentoPrevisto" TEXT,

    CONSTRAINT "EtapaRuta_pkey" PRIMARY KEY ("idcircuito","numeroOrden")
);

-- CreateTable
CREATE TABLE "Temporada" (
    "idtemporada" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Temporada_pkey" PRIMARY KEY ("idtemporada")
);

-- CreateTable
CREATE TABLE "TarifaPaquete" (
    "idpaquete" INTEGER NOT NULL,
    "idtemporada" INTEGER NOT NULL,
    "monto" DOUBLE PRECISION NOT NULL,
    "moneda" TEXT NOT NULL,

    CONSTRAINT "TarifaPaquete_pkey" PRIMARY KEY ("idpaquete","idtemporada")
);

-- CreateTable
CREATE TABLE "Salida" (
    "idsalida" SERIAL NOT NULL,
    "idpaquete" INTEGER NOT NULL,
    "nroSalida" TEXT NOT NULL,
    "idbloqueo" TEXT,
    "stockLocal" INTEGER NOT NULL,
    "stockLocalAlojamiento" INTEGER,
    "tamanoMaximo" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL,
    "ultimaEtapaAlcanzada" INTEGER,
    "idservicioAlojamiento" INTEGER,
    "idservicioTransporte" INTEGER,
    "idservicioTren" INTEGER,

    CONSTRAINT "Salida_pkey" PRIMARY KEY ("idsalida")
);

-- CreateTable
CREATE TABLE "Avance" (
    "idavance" SERIAL NOT NULL,
    "idsalida" INTEGER NOT NULL,
    "idcircuito" INTEGER NOT NULL,
    "numeroOrden" INTEGER NOT NULL,
    "estadoTramo" TEXT NOT NULL,
    "fechaHoraLlegada" TIMESTAMP(3),
    "fechaHoraReporte" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Avance_pkey" PRIMARY KEY ("idavance")
);

-- CreateTable
CREATE TABLE "Incidente" (
    "idincidente" SERIAL NOT NULL,
    "idsalida" INTEGER NOT NULL,
    "tipoIncidente" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "nivelGravedad" TEXT NOT NULL,
    "fechaHoraOcurrencia" TIMESTAMP(3) NOT NULL,
    "fechaHoraReporte" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Incidente_pkey" PRIMARY KEY ("idincidente")
);

-- CreateTable
CREATE TABLE "IncidentePasajero" (
    "idincidente" INTEGER NOT NULL,
    "idpasajero" INTEGER NOT NULL,

    CONSTRAINT "IncidentePasajero_pkey" PRIMARY KEY ("idincidente","idpasajero")
);

-- CreateTable
CREATE TABLE "RegistroAuditoria" (
    "idcambio" SERIAL NOT NULL,
    "idsalida" INTEGER,
    "idreserva" INTEGER,
    "idpaquete" INTEGER,
    "fechaActual" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario" TEXT NOT NULL,
    "motivo" TEXT,
    "cambios" JSONB NOT NULL,

    CONSTRAINT "RegistroAuditoria_pkey" PRIMARY KEY ("idcambio")
);

-- CreateTable
CREATE TABLE "Idioma" (
    "ididioma" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Idioma_pkey" PRIMARY KEY ("ididioma")
);

-- CreateTable
CREATE TABLE "PersonalIdioma" (
    "idpersonal" INTEGER NOT NULL,
    "ididioma" INTEGER NOT NULL,
    "nivelDominio" TEXT NOT NULL,
    "esNativo" BOOLEAN NOT NULL,

    CONSTRAINT "PersonalIdioma_pkey" PRIMARY KEY ("idpersonal","ididioma")
);

-- CreateTable
CREATE TABLE "AsignacionPersonal" (
    "idsalida" INTEGER NOT NULL,
    "idpersonal" INTEGER NOT NULL,

    CONSTRAINT "AsignacionPersonal_pkey" PRIMARY KEY ("idsalida","idpersonal")
);

-- CreateTable
CREATE TABLE "Permiso" (
    "idpermiso" SERIAL NOT NULL,
    "idsalida" INTEGER NOT NULL,
    "idpasajero" INTEGER,
    "idpersonal" INTEGER,
    "nroPermiso" TEXT NOT NULL,
    "fechaEmision" TIMESTAMP(3) NOT NULL,
    "estadoTramite" TEXT NOT NULL,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("idpermiso")
);

-- CreateTable
CREATE TABLE "Proveedor" (
    "idproveedor" SERIAL NOT NULL,
    "tipoProveedor" TEXT NOT NULL,
    "razonSocial" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,
    "canalComunicacion" TEXT,
    "estado" TEXT NOT NULL,

    CONSTRAINT "Proveedor_pkey" PRIMARY KEY ("idproveedor")
);

-- CreateTable
CREATE TABLE "ServicioBase" (
    "idservicio" SERIAL NOT NULL,
    "idproveedor" INTEGER NOT NULL,
    "nombreServicio" TEXT NOT NULL,
    "descripcion" TEXT,
    "costoBase" DOUBLE PRECISION NOT NULL,
    "estado" TEXT NOT NULL,
    "localidad" TEXT NOT NULL,

    CONSTRAINT "ServicioBase_pkey" PRIMARY KEY ("idservicio")
);

-- CreateTable
CREATE TABLE "ServicioAlojamiento" (
    "idservicio" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "tipoHabitacion" TEXT NOT NULL,
    "capacidadDisponible" INTEGER NOT NULL,
    "modalidadConfirmacion" TEXT NOT NULL,

    CONSTRAINT "ServicioAlojamiento_pkey" PRIMARY KEY ("idservicio")
);

-- CreateTable
CREATE TABLE "ServicioTransporte" (
    "idservicio" INTEGER NOT NULL,
    "capacidadVehiculo" INTEGER NOT NULL,
    "pesoEquipajeIncluido" DOUBLE PRECISION NOT NULL,
    "costoPorKgExcedente" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ServicioTransporte_pkey" PRIMARY KEY ("idservicio")
);

-- CreateTable
CREATE TABLE "ServicioTren" (
    "idservicio" INTEGER NOT NULL,
    "horarioSalida" TEXT NOT NULL,
    "horarioLlegada" TEXT NOT NULL,
    "diasOperacion" TEXT NOT NULL,

    CONSTRAINT "ServicioTren_pkey" PRIMARY KEY ("idservicio")
);

-- CreateTable
CREATE TABLE "ServicioEquipamiento" (
    "idservicio" INTEGER NOT NULL,
    "tipoEquipamiento" TEXT NOT NULL,
    "cantidadDisponible" INTEGER NOT NULL,

    CONSTRAINT "ServicioEquipamiento_pkey" PRIMARY KEY ("idservicio")
);

-- CreateTable
CREATE TABLE "PaqueteServicio" (
    "idpaquete" INTEGER NOT NULL,
    "idservicio" INTEGER NOT NULL,

    CONSTRAINT "PaqueteServicio_pkey" PRIMARY KEY ("idpaquete","idservicio")
);

-- CreateTable
CREATE TABLE "SalidaEquipamiento" (
    "idsalida" INTEGER NOT NULL,
    "idservicio" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL,

    CONSTRAINT "SalidaEquipamiento_pkey" PRIMARY KEY ("idsalida","idservicio")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_idusuario_key" ON "Cliente"("idusuario");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_nroCliente_key" ON "Cliente"("nroCliente");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_nroReserva_key" ON "Reserva"("nroReserva");

-- CreateIndex
CREATE UNIQUE INDEX "Personal_idusuario_key" ON "Personal"("idusuario");

-- CreateIndex
CREATE UNIQUE INDEX "Personal_nroPasaporte_key" ON "Personal"("nroPasaporte");

-- CreateIndex
CREATE UNIQUE INDEX "Pasajero_nroPasaporte_key" ON "Pasajero"("nroPasaporte");

-- CreateIndex
CREATE UNIQUE INDEX "Solicitud_nroSolicitud_key" ON "Solicitud"("nroSolicitud");

-- CreateIndex
CREATE UNIQUE INDEX "Paquete_nroPaquete_key" ON "Paquete"("nroPaquete");

-- CreateIndex
CREATE UNIQUE INDEX "Salida_nroSalida_key" ON "Salida"("nroSalida");

-- CreateIndex
CREATE UNIQUE INDEX "Permiso_nroPermiso_key" ON "Permiso"("nroPermiso");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_idusuario_fkey" FOREIGN KEY ("idusuario") REFERENCES "Usuario"("idusuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_idcliente_fkey" FOREIGN KEY ("idcliente") REFERENCES "Cliente"("idcliente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Personal" ADD CONSTRAINT "Personal_idusuario_fkey" FOREIGN KEY ("idusuario") REFERENCES "Usuario"("idusuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaPasajero" ADD CONSTRAINT "ReservaPasajero_idreserva_fkey" FOREIGN KEY ("idreserva") REFERENCES "Reserva"("idreserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaPasajero" ADD CONSTRAINT "ReservaPasajero_idpasajero_fkey" FOREIGN KEY ("idpasajero") REFERENCES "Pasajero"("idpasajero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_idreserva_fkey" FOREIGN KEY ("idreserva") REFERENCES "Reserva"("idreserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_idreserva_fkey" FOREIGN KEY ("idreserva") REFERENCES "Reserva"("idreserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitud" ADD CONSTRAINT "Solicitud_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valoracion" ADD CONSTRAINT "Valoracion_idreserva_fkey" FOREIGN KEY ("idreserva") REFERENCES "Reserva"("idreserva") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_idcircuito_fkey" FOREIGN KEY ("idcircuito") REFERENCES "Circuito"("idcircuito") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Paquete" ADD CONSTRAINT "Paquete_idservicioGarantizado_fkey" FOREIGN KEY ("idservicioGarantizado") REFERENCES "ServicioBase"("idservicio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtapaRuta" ADD CONSTRAINT "EtapaRuta_idcircuito_fkey" FOREIGN KEY ("idcircuito") REFERENCES "Circuito"("idcircuito") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaPaquete" ADD CONSTRAINT "TarifaPaquete_idpaquete_fkey" FOREIGN KEY ("idpaquete") REFERENCES "Paquete"("idpaquete") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TarifaPaquete" ADD CONSTRAINT "TarifaPaquete_idtemporada_fkey" FOREIGN KEY ("idtemporada") REFERENCES "Temporada"("idtemporada") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salida" ADD CONSTRAINT "Salida_idpaquete_fkey" FOREIGN KEY ("idpaquete") REFERENCES "Paquete"("idpaquete") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salida" ADD CONSTRAINT "Salida_idservicioAlojamiento_fkey" FOREIGN KEY ("idservicioAlojamiento") REFERENCES "ServicioBase"("idservicio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salida" ADD CONSTRAINT "Salida_idservicioTransporte_fkey" FOREIGN KEY ("idservicioTransporte") REFERENCES "ServicioBase"("idservicio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Salida" ADD CONSTRAINT "Salida_idservicioTren_fkey" FOREIGN KEY ("idservicioTren") REFERENCES "ServicioBase"("idservicio") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_idcircuito_fkey" FOREIGN KEY ("idcircuito") REFERENCES "Circuito"("idcircuito") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Avance" ADD CONSTRAINT "Avance_idcircuito_numeroOrden_fkey" FOREIGN KEY ("idcircuito", "numeroOrden") REFERENCES "EtapaRuta"("idcircuito", "numeroOrden") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incidente" ADD CONSTRAINT "Incidente_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentePasajero" ADD CONSTRAINT "IncidentePasajero_idincidente_fkey" FOREIGN KEY ("idincidente") REFERENCES "Incidente"("idincidente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentePasajero" ADD CONSTRAINT "IncidentePasajero_idpasajero_fkey" FOREIGN KEY ("idpasajero") REFERENCES "Pasajero"("idpasajero") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_idreserva_fkey" FOREIGN KEY ("idreserva") REFERENCES "Reserva"("idreserva") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroAuditoria" ADD CONSTRAINT "RegistroAuditoria_idpaquete_fkey" FOREIGN KEY ("idpaquete") REFERENCES "Paquete"("idpaquete") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalIdioma" ADD CONSTRAINT "PersonalIdioma_idpersonal_fkey" FOREIGN KEY ("idpersonal") REFERENCES "Personal"("idpersonal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalIdioma" ADD CONSTRAINT "PersonalIdioma_ididioma_fkey" FOREIGN KEY ("ididioma") REFERENCES "Idioma"("ididioma") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionPersonal" ADD CONSTRAINT "AsignacionPersonal_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionPersonal" ADD CONSTRAINT "AsignacionPersonal_idpersonal_fkey" FOREIGN KEY ("idpersonal") REFERENCES "Personal"("idpersonal") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permiso" ADD CONSTRAINT "Permiso_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permiso" ADD CONSTRAINT "Permiso_idpasajero_fkey" FOREIGN KEY ("idpasajero") REFERENCES "Pasajero"("idpasajero") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permiso" ADD CONSTRAINT "Permiso_idpersonal_fkey" FOREIGN KEY ("idpersonal") REFERENCES "Personal"("idpersonal") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioBase" ADD CONSTRAINT "ServicioBase_idproveedor_fkey" FOREIGN KEY ("idproveedor") REFERENCES "Proveedor"("idproveedor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioAlojamiento" ADD CONSTRAINT "ServicioAlojamiento_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioTransporte" ADD CONSTRAINT "ServicioTransporte_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioTren" ADD CONSTRAINT "ServicioTren_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicioEquipamiento" ADD CONSTRAINT "ServicioEquipamiento_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaqueteServicio" ADD CONSTRAINT "PaqueteServicio_idpaquete_fkey" FOREIGN KEY ("idpaquete") REFERENCES "Paquete"("idpaquete") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaqueteServicio" ADD CONSTRAINT "PaqueteServicio_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalidaEquipamiento" ADD CONSTRAINT "SalidaEquipamiento_idsalida_fkey" FOREIGN KEY ("idsalida") REFERENCES "Salida"("idsalida") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalidaEquipamiento" ADD CONSTRAINT "SalidaEquipamiento_idservicio_fkey" FOREIGN KEY ("idservicio") REFERENCES "ServicioBase"("idservicio") ON DELETE RESTRICT ON UPDATE CASCADE;
