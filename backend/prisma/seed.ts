// Importamos la conexión desde tu Singleton
import { db } from "../src/config/postgresDatabase";
import bcrypt from 'bcrypt';
import { armarDefinicionPaquete } from "../src/shared/definicionPaquete";

async function main() {
  // INF-05: correrlo dos veces no falla; para empezar de cero está `npx prisma migrate reset`
  if (await db.usuario.findUnique({ where: { email: "admin@incatour.com" } })) {
    console.log("🌱 La base ya tiene los datos semilla de IncaTour: no se vuelven a insertar.");
    return;
  }
  console.log("🌱 Insertando datos semilla de IncaTour...");

  // 1. Usuarios, Clientes y Temporadas
  // Hasheamos las contraseñas de prueba
  const salt = await bcrypt.genSalt(10);
  const contraseniaAdmin = await bcrypt.hash('AdminIncaTour123', salt);
  const contraseniaCliente = await bcrypt.hash('hash123', salt);
  const contraseniaGuia = await bcrypt.hash('guia123',salt);

  const usuarioAdmin = await db.usuario.create({
    data: {
      nombre: 'Carlos',
      apellido: 'Gerente',
      email: 'admin@incatour.com',
      contrasenia: contraseniaAdmin,
      rol: 'ADMIN',
      estado: 'ACTIVO'
    }
  });

  // 3. Creamos al Usuario Cliente 
  const usuarioCliente = await db.usuario.create({
    data: {
      nombre: 'Juan',
      apellido: 'Pérez',
      email: 'juan@test.com',
      contrasenia: contraseniaCliente, 
      rol: 'CLIENTE',
      estado: 'ACTIVO',
    },
  });

  
  // 4. Creamos el Perfil Cliente (Enlace 1:1, ya sin nombre ni apellido)
  const cliente = await db.cliente.create({
    data: {
      idusuario: usuarioCliente.idusuario,
      nroCliente: 'CLI-001',
      estado: 'ACTIVO',
    },
  });

  const temporada = await db.temporada.create({
    data: {
      nombre: "Alta 2026",
      fechaInicio: new Date("2026-10-01T00:00:00Z"),
      fechaFin: new Date("2026-12-31T23:59:59Z"),
    },
  });

  // 2. Proveedores y Servicios
  const proveedor = await db.proveedor.create({
    data: {
      tipoProveedor: "ALOJAMIENTO",
      razonSocial: "Andes Travel",
      localidad: "Cusco",
      datosContacto: "reservas@andestravel.com · +51 84 123456",
      canalComunicacion: "Correo electrónico",
      estado: "ACTIVO",
    },
  });

  const proveedorTransporte = await db.proveedor.create({
    data: {
      tipoProveedor: "TRANSPORTE",
      razonSocial: "Transportes Urubamba",
      localidad: "Cusco",
      datosContacto: "operaciones@transurubamba.com · +51 84 654321",
      canalComunicacion: "WhatsApp",
      estado: "ACTIVO",
    },
  });

  const proveedorTren = await db.proveedor.create({
    data: {
      tipoProveedor: "TREN",
      razonSocial: "Inca Rail",
      localidad: "Ollantaytambo",
      datosContacto: "reservas@incarail.com · +51 84 987654",
      canalComunicacion: "Correo electrónico",
      estado: "ACTIVO",
    },
  });

  const proveedorEquipamiento = await db.proveedor.create({
    data: {
      tipoProveedor: "EQUIPAMIENTO",
      razonSocial: "Andes Outdoor",
      localidad: "Cusco",
      datosContacto: "ventas@andesoutdoor.com · +51 84 321987",
      canalComunicacion: "Correo electrónico",
      estado: "ACTIVO",
    },
  });

  const proveedorComodoro = await db.proveedor.create({
    data: {
      tipoProveedor: "ALOJAMIENTO",
      razonSocial: "Patagonia Austral Servicios",
      localidad: "Comodoro Rivadavia",
      datosContacto: "reservas@patagoniacomodoro.com · +54 297 4559876",
      canalComunicacion: "Correo electrónico",
      estado: "ACTIVO",
    },
  });

  const servAloj = await db.servicioBase.create({
    data: {
      idproveedor: proveedor.idproveedor,
      nombreServicio: "Hotel Montaña",
      costoBase: 120.0,
      estado: "ACTIVO",
      localidad: "Cusco",
      alojamiento: {
        create: {
          categoria: "3 Estrellas",
          tipoHabitacion: "Doble",
          capacidadDisponible: 10,
          modalidadConfirmacion: "BLOQUEO_PLAZAS",
        },
      },
    },
  });

  const servAloj2 = await db.servicioBase.create({
    data: {
      idproveedor: proveedor.idproveedor,
      nombreServicio: "Hotel Valle Sagrado",
      costoBase: 110.0,
      estado: "ACTIVO",
      localidad: "Cusco",
      alojamiento: {
        create: {
          categoria: "3 Estrellas",
          tipoHabitacion: "Doble",
          capacidadDisponible: 5,
          modalidadConfirmacion: "A_SOLICITUD",
        },
      },
    },
  });

  const servTrans = await db.servicioBase.create({
    data: {
      idproveedor: proveedorTransporte.idproveedor,
      nombreServicio: "Minibus Sprinter",
      costoBase: 50.0,
      estado: "ACTIVO",
      localidad: "Cusco",
      transporte: {
        create: {
          capacidadVehiculo: 19,
          pesoEquipajeIncluido: 15.0,
          costoPorKgExcedente: 2.5,
        },
      },
    },
  });

  const servTren = await db.servicioBase.create({
    data: {
      idproveedor: proveedorTren.idproveedor,
      nombreServicio: "IncaRail Voyager",
      costoBase: 80.0,
      estado: "ACTIVO",
      localidad: "Ollantaytambo",
      tren: {
        create: {
          horarioSalida: "08:00",
          horarioLlegada: "09:30",
          diasOperacion: "L-M-X-J-V-S-D",
        },
      },
    },
  });

  const servEquip = await db.servicioBase.create({
    data: {
      idproveedor: proveedorEquipamiento.idproveedor,
      nombreServicio: "Carpas Alta Montaña",
      costoBase: 25.0,
      estado: "ACTIVO",
      localidad: "Cusco",
      equipamiento: {
        create: {
          tipoEquipamiento: "Carpa 4 Estaciones",
          cantidadDisponible: 50,
        },
      },
    },
  });

  const servAlojComodoro = await db.servicioBase.create({
    data: {
      idproveedor: proveedorComodoro.idproveedor,
      nombreServicio: "Hostería Histórica Diadema & Centro",
      costoBase: 90.0,
      estado: "ACTIVO",
      localidad: "Comodoro Rivadavia",
      alojamiento: {
        create: {
          categoria: "3 Estrellas",
          tipoHabitacion: "Doble",
          capacidadDisponible: 20,
          modalidadConfirmacion: "BLOQUEO_PLAZAS",
        },
      },
    },
  });

  const servTransComodoro = await db.servicioBase.create({
    data: {
      idproveedor: proveedorTransporte.idproveedor,
      nombreServicio: "Transfer Patagonia Bus",
      costoBase: 40.0,
      estado: "ACTIVO",
      localidad: "Comodoro Rivadavia",
      transporte: {
        create: {
          capacidadVehiculo: 20,
          pesoEquipajeIncluido: 15.0,
          costoPorKgExcedente: 2.0,
        },
      },
    },
  });

  // 3. Personal
  const usuarioGuia = await db.usuario.create({
    data: {
      nombre: "Carlos",       // AGREGADO PARA SOLUCIONAR ERROR
      apellido: "Mamani",     // AGREGADO PARA SOLUCIONAR ERROR
      email: "carlos.guia@incatour.com",
      contrasenia: contraseniaGuia,
      rol: "GUIA",
      estado: "ACTIVO",
    },
  });

  const personalGuia = await db.personal.create({
    data: {
      nombreCompleto: "Carlos Mamani",
      nroPasaporte: "P123456",
      nacionalidad: "Peruana",
      fechaVencimientoPasaporte: new Date("2030-01-01T00:00:00Z"),
      estado: "ACTIVO",
      rol: "Guía",
      guia: {
        create: {
          idusuario: usuarioGuia.idusuario,
          nroHabilitacion: "HAB-001",
          fechaHabilitacion: new Date("2028-12-31T00:00:00Z"),
        },
      },
    },
  });

  const usuarioGuia2 = await db.usuario.create({
    data: {
      nombre: "Rosa",
      apellido: "Huamán",
      email: "rosa.guia@incatour.com",
      contrasenia: contraseniaGuia,
      rol: "GUIA",
      estado: "ACTIVO",
    },
  });

  const personalGuia2 = await db.personal.create({
    data: {
      nombreCompleto: "Rosa Huamán",
      nroPasaporte: "P778899",
      nacionalidad: "Peruana",
      fechaVencimientoPasaporte: new Date("2030-01-01T00:00:00Z"),
      estado: "ACTIVO",
      rol: "Guía",
      guia: {
        create: {
          idusuario: usuarioGuia2.idusuario,
          nroHabilitacion: "HAB-002",
          fechaHabilitacion: new Date("2029-12-31T00:00:00Z"),
        },
      },
    },
  });

  const usuarioGuia3 = await db.usuario.create({
    data: {
      nombre: "Marcos",
      apellido: "Flores",
      email: "marcos.guia@incatour.com",
      contrasenia: contraseniaGuia,
      rol: "GUIA",
      estado: "ACTIVO",
    },
  });

  const personalGuia3 = await db.personal.create({
    data: {
      nombreCompleto: "Marcos Flores",
      nroPasaporte: "P334455",
      nacionalidad: "Peruana",
      fechaVencimientoPasaporte: new Date("2030-01-01T00:00:00Z"),
      estado: "ACTIVO",
      rol: "Guía",
      guia: {
        create: {
          idusuario: usuarioGuia3.idusuario,
          nroHabilitacion: "HAB-003",
          fechaHabilitacion: new Date("2029-12-31T00:00:00Z"),
        },
      },
    },
  });

  const usuarioGuia4 = await db.usuario.create({
    data: {
      nombre: "Elena",
      apellido: "Morales",
      email: "elena.guia@incatour.com",
      contrasenia: contraseniaGuia,
      rol: "GUIA",
      estado: "ACTIVO",
    },
  });

  const personalGuia4 = await db.personal.create({
    data: {
      nombreCompleto: "Elena Morales",
      nroPasaporte: "P881122",
      nacionalidad: "Peruana",
      fechaVencimientoPasaporte: new Date("2030-01-01T00:00:00Z"),
      estado: "ACTIVO",
      rol: "Guía",
      guia: {
        create: {
          idusuario: usuarioGuia4.idusuario,
          nroHabilitacion: "HAB-004",
          fechaHabilitacion: new Date("2029-12-31T00:00:00Z"),
        },
      },
    },
  });

  const usuarioGuia5 = await db.usuario.create({
    data: {
      nombre: "Raúl",
      apellido: "Mendoza",
      email: "raul.guia@incatour.com",
      contrasenia: contraseniaGuia,
      rol: "GUIA",
      estado: "ACTIVO",
    },
  });

  const personalGuia5 = await db.personal.create({
    data: {
      nombreCompleto: "Raúl Mendoza",
      nroPasaporte: "P882233",
      nacionalidad: "Peruana",
      fechaVencimientoPasaporte: new Date("2030-01-01T00:00:00Z"),
      estado: "ACTIVO",
      rol: "Guía",
      guia: {
        create: {
          idusuario: usuarioGuia5.idusuario,
          nroHabilitacion: "HAB-005",
          fechaHabilitacion: new Date("2029-12-31T00:00:00Z"),
        },
      },
    },
  });

  const usuarioGuia6 = await db.usuario.create({
    data: {
      nombre: "Sofía",
      apellido: "Cárdenas",
      email: "sofia.guia@incatour.com",
      contrasenia: contraseniaGuia,
      rol: "GUIA",
      estado: "ACTIVO",
    },
  });

  const personalGuia6 = await db.personal.create({
    data: {
      nombreCompleto: "Sofía Cárdenas",
      nroPasaporte: "P883344",
      nacionalidad: "Peruana",
      fechaVencimientoPasaporte: new Date("2030-01-01T00:00:00Z"),
      estado: "ACTIVO",
      rol: "Guía",
      guia: {
        create: {
          idusuario: usuarioGuia6.idusuario,
          nroHabilitacion: "HAB-006",
          fechaHabilitacion: new Date("2029-12-31T00:00:00Z"),
        },
      },
    },
  });

  const porteadoresData = [
    { nombreCompleto: "Luis Quispe", nroPasaporte: "P654321" },
    { nombreCompleto: "Pedro Condori", nroPasaporte: "P998877" },
    { nombreCompleto: "Juan Carlos Yupanqui", nroPasaporte: "P500001" },
    { nombreCompleto: "Mario Ttito", nroPasaporte: "P500002" },
    { nombreCompleto: "Walter Champi", nroPasaporte: "P500003" },
    { nombreCompleto: "Esteban Paucar", nroPasaporte: "P500004" },
    { nombreCompleto: "Jaime Huillca", nroPasaporte: "P500005" },
    { nombreCompleto: "Nilton Mayta", nroPasaporte: "P500006" },
  ];

  for (const p of porteadoresData) {
    await db.personal.create({
      data: {
        nombreCompleto: p.nombreCompleto,
        nroPasaporte: p.nroPasaporte,
        nacionalidad: "Peruana",
        fechaVencimientoPasaporte: new Date("2029-01-01T00:00:00Z"),
        estado: "ACTIVO",
        rol: "Porteador",
      },
    });
  }

  // 4. Circuito con Etapas
  const circuito = await db.circuito.create({
    data: {
      nombreCircuito: "Camino del Inca Clásico",
      duracionDias: 4,
      dificultad: "Alta",
      minimoGuias: 2,
      parametrosPorteadores: "1 por cada 2 pasajeros",
      etapas: {
        create: [
          {
            numeroOrden: 1,
            puntoInicio: "Km 82",
            puntoFin: "Wayllabamba",
            campamentoPrevisto: "Wayllabamba Camp",
          },
          {
            numeroOrden: 2,
            puntoInicio: "Wayllabamba",
            puntoFin: "Pacaymayo",
            campamentoPrevisto: "Pacaymayo Camp",
          },
        ],
      },
    },
  });

  // 4b. Circuitos de Comodoro Rivadavia (para entender circuitos y etapas locales)
  const circuitoDiadema = await db.circuito.create({
    data: {
      nombreCircuito: "Circuito Histórico Camino a Diadema",
      duracionDias: 3,
      dificultad: "Media",
      minimoGuias: 2,
      parametrosPorteadores: "1 por cada 3 pasajeros",
      etapas: {
        create: [
          {
            numeroOrden: 1,
            puntoInicio: "Km 3 (Barrio General Mosconi - Museo del Petróleo)",
            puntoFin: "Km 8 (Barrio Don Bosco)",
            campamentoPrevisto: "Campamento Base Km 8 (Don Bosco)",
          },
          {
            numeroOrden: 2,
            puntoInicio: "Km 8 (Barrio Don Bosco)",
            puntoFin: "Barrio Laprida (Plaza Catita)",
            campamentoPrevisto: "Refugio Cañadón de Laprida",
          },
          {
            numeroOrden: 3,
            puntoInicio: "Barrio Laprida",
            puntoFin: "Diadema Argentina (Glorieta Central)",
            campamentoPrevisto: "Hostería Histórica Diadema Argentina",
          },
        ],
      },
    },
  });

  const circuitoCostero = await db.circuito.create({
    data: {
      nombreCircuito: "Travesía Costera Chenque a Caleta Córdova",
      duracionDias: 2,
      dificultad: "Baja",
      minimoGuias: 2,
      parametrosPorteadores: "1 por cada 3 pasajeros",
      etapas: {
        create: [
          {
            numeroOrden: 1,
            puntoInicio: "Centro de Comodoro (Pie del Cerro Chenque)",
            puntoFin: "Barrio Presidente Ortiz (Km 5)",
            campamentoPrevisto: "Campamento Histórico Ferroviario (Km 5)",
          },
          {
            numeroOrden: 2,
            puntoInicio: "Barrio Presidente Ortiz (Km 5)",
            puntoFin: "Caleta Córdova (Muelle y Puerto)",
            campamentoPrevisto: "Refugio Marino Caleta Córdova",
          },
        ],
      },
    },
  });

  // 5. Paquete Comercial
  const paquete = await db.paquete.create({
    data: {
      idcircuito: circuito.idcircuito,
      nroPaquete: "PAQ-INC-01",
      nombrePaquete: "Inca Clásico Standard",
      estado: "ACTIVO",
      tipoGarantia: "Por Categoría",
      categoriaGarantizada: "3 Estrellas",
      localidadGarantizada: "Cusco",
      tipoHabitacionGarantizada: "Doble",
      diasMinimosReintegro: 15, // RES-06: reintegro del 100% solo con 15 días de anticipación
      tarifas: { create: [{ idtemporada: temporada.idtemporada, monto: 650, moneda: "USD" }] },
      servicios: {
        create: [
          { idservicio: servAloj.idservicio },
          { idservicio: servTrans.idservicio },
        ],
      },
    },
  });

  await db.paquete.create({
    data: {
      idcircuito: circuito.idcircuito,
      nroPaquete: "PAQ-INC-02",
      nombrePaquete: "Inca VIP Hotel Montaña",
      estado: "ACTIVO",
      tipoGarantia: "Por Establecimiento",
      tarifas: { create: [{ idtemporada: temporada.idtemporada, monto: 980, moneda: "USD" }] },
      servicios: {
        create: [
          { idservicio: servAloj.idservicio },
          { idservicio: servTren.idservicio },
        ],
      },
      garantiasEstablecimiento: {
        create: [
          { idservicio: servAloj.idservicio }
        ]
      }
    },
  });

  // Paquetes Comerciales de Comodoro Rivadavia
  const paqueteDiadema = await db.paquete.create({
    data: {
      idcircuito: circuitoDiadema.idcircuito,
      nroPaquete: "PAQ-CRD-01",
      nombrePaquete: "Camino a Diadema Clásico",
      condiciones: "Trekking patrimonial por los barrios históricos de la zona norte de Comodoro Rivadavia. Recorrido por el campamento pionero de Km 3, el Cañadón de Laprida y finalización en el histórico pueblo petrolero de estilo holandés Diadema Argentina.",
      estado: "ACTIVO",
      tipoGarantia: "Por Categoría",
      categoriaGarantizada: "3 Estrellas",
      localidadGarantizada: "Comodoro Rivadavia",
      tipoHabitacionGarantizada: "Doble",
      diasMinimosReintegro: 10,
      tarifas: { create: [{ idtemporada: temporada.idtemporada, monto: 380, moneda: "USD" }] },
      servicios: {
        create: [
          { idservicio: servAlojComodoro.idservicio },
          { idservicio: servTransComodoro.idservicio },
        ],
      },
    },
  });

  const paqueteCostero = await db.paquete.create({
    data: {
      idcircuito: circuitoCostero.idcircuito,
      nroPaquete: "PAQ-CRD-02",
      nombrePaquete: "Travesía Chenque a Caleta Córdova",
      condiciones: "Caminata costera sobre los acantilados del Golfo San Jorge con vistas panorámicas. Desde la falda del Cerro Chenque y los galpones ferroviarios de Km 5 hasta el puerto artesanal y polo gastronómico de Caleta Córdova.",
      estado: "ACTIVO",
      tipoGarantia: "Por Categoría",
      categoriaGarantizada: "3 Estrellas",
      localidadGarantizada: "Comodoro Rivadavia",
      tipoHabitacionGarantizada: "Doble",
      diasMinimosReintegro: 7,
      tarifas: { create: [{ idtemporada: temporada.idtemporada, monto: 260, moneda: "USD" }] },
      servicios: {
        create: [
          { idservicio: servAlojComodoro.idservicio },
          { idservicio: servTransComodoro.idservicio },
        ],
      },
    },
  });

  // 5b. Autoridad simulada: el bloqueo de SAL-2026-001 (16 pasajeros + 2 guías + 8 porteadores)
  await db.autoridadCupoDiario.create({ data: { fecha: "2026-11-15", ocupados: 26 } });
  await db.autoridadBloqueo.create({
    data: {
      idBloqueo: "BLQ-SEED-001",
      fecha: "2026-11-15",
      lugares: 26,
    },
  });

  // 6. Salida Publicada, con la foto de la definición del paquete (CAT-05).
  // INF-05: todavía sin personal ni permisos (eso pasa al cerrarla con CU-40) y con el lugar de la reserva ya vendido
  const paqueteCompleto = await db.paquete.findUniqueOrThrow({
    where: { idpaquete: paquete.idpaquete },
    include: {
      garantiasEstablecimiento: { include: { servicio: { include: { alojamiento: true } } } },
      servicios: { include: { servicio: { include: { transporte: true } } } },
    },
  });
  const salida = await db.salida.create({
    data: {
      definicionPaquete: armarDefinicionPaquete(paqueteCompleto),
      idpaquete: paquete.idpaquete,
      nroSalida: "SAL-2026-001",
      idbloqueo: "BLQ-SEED-001",
      stockLocal: 15,
      tamanoMaximo: 16,
      fechaInicio: new Date("2026-11-15T00:00:00Z"),
      fechaFin: new Date("2026-11-18T00:00:00Z"),
      estado: "PUBLICADA",
    },
  });

  // 6b. Salidas de Comodoro Rivadavia
  const paqueteDiademaCompleto = await db.paquete.findUniqueOrThrow({
    where: { idpaquete: paqueteDiadema.idpaquete },
    include: {
      garantiasEstablecimiento: { include: { servicio: { include: { alojamiento: true } } } },
      servicios: { include: { servicio: { include: { transporte: true } } } },
    },
  });

  const paqueteCosteroCompleto = await db.paquete.findUniqueOrThrow({
    where: { idpaquete: paqueteCostero.idpaquete },
    include: {
      garantiasEstablecimiento: { include: { servicio: { include: { alojamiento: true } } } },
      servicios: { include: { servicio: { include: { transporte: true } } } },
    },
  });

  // Salida 1: PUBLICADA para que el cliente pueda comprar Camino a Diadema en el catálogo
  await db.salida.create({
    data: {
      definicionPaquete: armarDefinicionPaquete(paqueteDiademaCompleto),
      idpaquete: paqueteDiadema.idpaquete,
      nroSalida: "SAL-CRD-001",
      stockLocal: 12,
      tamanoMaximo: 12,
      fechaInicio: new Date("2026-11-20T08:00:00Z"),
      fechaFin: new Date("2026-11-23T18:00:00Z"),
      estado: "PUBLICADA",
    },
  });

  // Salida 2: PUBLICADA para la Travesía Costera Chenque - Caleta Córdova
  await db.salida.create({
    data: {
      definicionPaquete: armarDefinicionPaquete(paqueteCosteroCompleto),
      idpaquete: paqueteCostero.idpaquete,
      nroSalida: "SAL-CRD-002",
      stockLocal: 10,
      tamanoMaximo: 10,
      fechaInicio: new Date("2026-11-26T08:00:00Z"),
      fechaFin: new Date("2026-11-28T18:00:00Z"),
      estado: "PUBLICADA",
    },
  });

  // Salida 3: CERRADA (el estado que deja la asignación de CU-40) para Camino a Diadema, asignada a Guía Carlos y Guía Rosa (visible en Portal Guía)
  const salidaDiademaActiva = await db.salida.create({
    data: {
      definicionPaquete: armarDefinicionPaquete(paqueteDiademaCompleto),
      idpaquete: paqueteDiadema.idpaquete,
      nroSalida: "SAL-CRD-003",
      stockLocal: 8,
      tamanoMaximo: 10,
      fechaInicio: new Date("2026-11-05T08:00:00Z"),
      fechaFin: new Date("2026-11-08T18:00:00Z"),
      estado: "CERRADA",
      personalAsignado: {
        create: [
          { idpersonal: personalGuia.idpersonal },
          { idpersonal: personalGuia2.idpersonal },
        ],
      },
    },
  });

  // Pasajeros y Reserva para SAL-CRD-003 (para ver nómina de turistas en el Portal del Guía)
  const pasajeroCrd1 = await db.pasajero.create({
    data: {
      nombreCompleto: "Martín Rivas",
      nroPasaporte: "PAS-ARG-112233",
      nacionalidad: "Argentina",
      fechaVencimientoPasaporte: new Date("2032-08-15T00:00:00Z"),
    },
  });

  const pasajeroCrd2 = await db.pasajero.create({
    data: {
      nombreCompleto: "Camila Gómez",
      nroPasaporte: "PAS-ARG-445566",
      nacionalidad: "Argentina",
      fechaVencimientoPasaporte: new Date("2031-11-20T00:00:00Z"),
    },
  });

  await db.reserva.create({
    data: {
      idcliente: cliente.idcliente,
      idsalida: salidaDiademaActiva.idsalida,
      nroReserva: "RES-CRD-0001",
      cantidadPasajeros: 2,
      precioCongelado: 760.0,
      temporadaAplicada: "Alta 2026",
      precioPaquetePorPersona: 380,
      adicionalesEquipaje: 0,
      moneda: "USD",
      diasMinimosReintegro: 10,
      estado: "CONFIRMADA",
      pasajeros: {
        create: [
          { idpasajero: pasajeroCrd1.idpasajero },
          { idpasajero: pasajeroCrd2.idpasajero },
        ],
      },
    },
  });

  // 7. Pasajero, Reserva y Solicitud
  const pasajero = await db.pasajero.create({
    data: {
      nombreCompleto: "Lucía Fernández",
      nroPasaporte: "PAS-ARG-987654",
      nacionalidad: "Argentina",
      fechaVencimientoPasaporte: new Date("2032-05-10T00:00:00Z"),
    },
  });

  const reserva = await db.reserva.create({
    data: {
      idcliente: cliente.idcliente,
      idsalida: salida.idsalida,
      nroReserva: "RES-0001",
      cantidadPasajeros: 1,
      precioCongelado: 650.0,
      // RES-07: desglose congelado (tarifa de Alta 2026, sin equipaje excedente)
      temporadaAplicada: "Alta 2026",
      precioPaquetePorPersona: 650,
      adicionalesEquipaje: 0,
      moneda: "USD",
      diasMinimosReintegro: 15,
      estado: "CONFIRMADA",
      pasajeros: {
        create: [{ idpasajero: pasajero.idpasajero }],
      },
    },
  });

  // Sin gestiones: se crean al resolverla (CU-34)
  await db.solicitud.create({
    data: {
      idreserva: reserva.idreserva,
      nroSolicitud: "SOL-0001",
      estado: "PENDIENTE",
      cantidadPlazas: 1,
    },
  });

  // 8. Caso de ejemplo para cancelación con Reembolso
  const reservaCancelada = await db.reserva.create({
    data: {
      idcliente: cliente.idcliente,
      idsalida: salida.idsalida,
      nroReserva: "RES-0002-CANC",
      cantidadPasajeros: 1,
      precioCongelado: 650.0,
      temporadaAplicada: "Alta 2026",
      precioPaquetePorPersona: 650,
      adicionalesEquipaje: 0,
      moneda: "USD",
      diasMinimosReintegro: 15,
      estado: "CANCELADA",
      reembolsos: {
        create: [
          {
            idusuario: usuarioAdmin.idusuario,
            montoReembolsado: 650.0,
            motivo: "Cancelación temprana sin permisos emitidos",
            condicionAplicada: "Cancelación con 20 días de anticipación (mínimo 15): 100% del importe abonado",
          },
        ],
      },
    },
  });

  console.log("✅ ¡Base de datos de IncaTour poblada exitosamente!");
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
