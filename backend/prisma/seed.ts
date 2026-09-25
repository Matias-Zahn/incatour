// Importamos la conexión desde tu Singleton
import { db } from "../src/config/postgresDatabase";

async function main() {
  console.log("🌱 Insertando datos semilla de IncaTour...");

  // 1. Usuarios, Clientes y Temporadas
  const usuarioCliente = await db.usuario.create({
    data: {
      email: "juan@test.com",
      contrasenia: "hash123", // En producción esto irá hasheado
      rol: "CLIENTE",
      estado: "ACTIVO",
    },
  });

  const cliente = await db.cliente.create({
    data: {
      idusuario: usuarioCliente.idusuario, // Enlace 1:1 con el usuario
      nroCliente: "CLI-001",
      nombre: "Juan",
      apellido: "Pérez",
      estado: "ACTIVO",
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
      tipoProveedor: "Operador",
      razonSocial: "Andes Travel",
      localidad: "Cusco",
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
          modalidadConfirmacion: "Inmediata",
        },
      },
    },
  });

  const servTrans = await db.servicioBase.create({
    data: {
      idproveedor: proveedor.idproveedor,
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
      idproveedor: proveedor.idproveedor,
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
      idproveedor: proveedor.idproveedor,
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

  // 3. Personal
  const usuarioGuia = await db.usuario.create({
    data: {
      email: "carlos.guia@incatour.com",
      contrasenia: "guia123",
      rol: "GUIA",
      estado: "ACTIVO",
    },
  });

  const guia = await db.personal.create({
    data: {
      idusuario: usuarioGuia.idusuario,
      nombreCompleto: "Carlos Mamani",
      nroPasaporte: "P123456",
      nacionalidad: "Peruana",
      fechaVencimientoPasaporte: new Date("2030-01-01T00:00:00Z"),
      estado: "ACTIVO",
      rol: "Guía",
    },
  });

  const porteador = await db.personal.create({
    data: {
      nombreCompleto: "Luis Quispe",
      nroPasaporte: "P654321",
      nacionalidad: "Peruana",
      fechaVencimientoPasaporte: new Date("2029-01-01T00:00:00Z"),
      estado: "ACTIVO",
      rol: "Porteador",
    },
  });

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

  // 5. Paquete Comercial
  const paquete = await db.paquete.create({
    data: {
      idcircuito: circuito.idcircuito,
      nroPaquete: "PAQ-INC-01",
      nombrePaquete: "Inca Clásico Standard",
      estado: "ACTIVO",
      tipoGarantia: "Por Categoría",
      categoriaGarantizada: "3 Estrellas",
      servicios: {
        create: [
          { idservicio: servAloj.idservicio },
          { idservicio: servTrans.idservicio },
        ],
      },
    },
  });

  const paqueteEstablecimiento = await db.paquete.create({
    data: {
      idcircuito: circuito.idcircuito,
      nroPaquete: "PAQ-INC-02",
      nombrePaquete: "Inca VIP Hotel Montaña",
      estado: "ACTIVO",
      tipoGarantia: "Por Establecimiento",
      // Como es por establecimiento, no requiere categoría general.
      // Si tu esquema exige un string aquí, puedes poner "N/A" o dejarlo vacío según tu diseño.
      servicios: {
        create: [
          { idservicio: servAloj.idservicio }, // Garantizamos este hotel específico
          { idservicio: servTren.idservicio },
        ],
      },
    },
  });

  // 6. Salida Publicada
  const salida = await db.salida.create({
    data: {
      idpaquete: paquete.idpaquete,
      nroSalida: "SAL-2026-001",
      stockLocal: 16,
      tamanoMaximo: 16,
      fechaInicio: new Date("2026-11-15T00:00:00Z"),
      fechaFin: new Date("2026-11-18T00:00:00Z"),
      estado: "PUBLICADA",
      personalAsignado: {
        create: [
          { idpersonal: guia.idpersonal },
          { idpersonal: porteador.idpersonal },
        ],
      },
    },
  });

  // 7. Reserva y Solicitud
  const reserva = await db.reserva.create({
    data: {
      idcliente: cliente.idcliente,
      idsalida: salida.idsalida,
      nroReserva: "RES-0001",
      cantidadPasajeros: 2,
      precioCongelado: 1500.0,
      estado: "CONFIRMADA",
    },
  });

  await db.solicitud.create({
    data: {
      idreserva: reserva.idreserva,
      idservicio: servAloj.idservicio,
      nroSolicitud: "SOL-0001",
      estado: "PENDIENTE",
      cantidadPlazas: 2,
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
