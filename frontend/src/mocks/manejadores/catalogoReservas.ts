import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import { cuentasMock, exigirRol } from "../autorizacion";
import type {
    CrearReservaPayload,
    PaqueteCatalogoPublico,
    ResultadoReservaConfirmada,
    SalidaDisponibleCatalogo,
} from "../../services/catalogoCompraService";
import type {
    ComprobanteReserva,
    PerfilClienteDetalle,
    RegistrarClientePayload,
    ReservaClienteDetalle,
    ReservaClienteResumen,
    ResultadoCancelacionReserva,
    ResumenCancelacionReserva,
} from "../../services/clientePortalService";

const salidasPorPaqueteMock: Record<number, SalidaDisponibleCatalogo[]> = {
    1: [
        {
            idsalida: 1,
            nroSalida: "SAL-2026-001",
            fechaInicio: "2026-11-15T00:00:00.000Z",
            fechaFin: "2026-11-18T00:00:00.000Z",
            stockLocal: 16,
            tamanoMaximo: 16,
            precioPersona: 650,
            moneda: "USD",
            temporadaNombre: "Alta 2026",
        },
        {
            idsalida: 2,
            nroSalida: "SAL-2026-002",
            fechaInicio: "2026-12-05T00:00:00.000Z",
            fechaFin: "2026-12-08T00:00:00.000Z",
            stockLocal: 8,
            tamanoMaximo: 12,
            precioPersona: 650,
            moneda: "USD",
            temporadaNombre: "Alta 2026",
        },
    ],
    2: [
        {
            idsalida: 3,
            nroSalida: "SAL-2026-003",
            fechaInicio: "2026-11-22T00:00:00.000Z",
            fechaFin: "2026-11-25T00:00:00.000Z",
            stockLocal: 10,
            tamanoMaximo: 10,
            precioPersona: 980,
            moneda: "USD",
            temporadaNombre: "Alta 2026",
        },
    ],
};

const catalogoMockInicial: PaqueteCatalogoPublico[] = [
    {
        id: 1,
        codigo: "PAQ-INC-01",
        nombre: "Inca Clásico Standard",
        imagenPrincipal: "/imagenes/catalogo/machu-picchu.jpg",
        imagenes: [
            "/imagenes/catalogo/machu-picchu.jpg",
            "/imagenes/catalogo/valle-sagrado.jpg",
        ],
        tieneImagenesPropias: false,
        circuito: {
            nombre: "Camino del Inca Clásico",
            dias: 4,
            dificultad: "Alta",
            recorrido: "Km 82 -> Wayllabamba -> Pacaymayo",
            etapas: [
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
        nochesAlojamiento: {
            previas: 1,
            posteriores: 1,
            garantia: "3 Estrellas en Cusco · Hab. Doble",
            tipoGarantia: "POR_CATEGORIA",
        },
        serviciosAdicionales: ["Hotel Montaña", "Minibus Sprinter"],
        equipajeTransporte: {
            pesoEquipajeIncluido: 15,
            costoPorKgExcedente: 2.5,
        },
        condiciones: "Incluye traslados desde Cusco y pensión completa en ruta.",
        diasDisponibles: "L-M-X-J-V-S-D",
        precios: [
            {
                idtemporada: 1,
                temporada: "Alta 2026",
                fechaInicio: "2026-10-01",
                fechaFin: "2026-12-31",
                precio: 650,
                moneda: "USD",
            },
        ],
        salidasDisponibles: salidasPorPaqueteMock[1],
    },
    {
        id: 2,
        codigo: "PAQ-INC-02",
        nombre: "Inca VIP Hotel Montaña",
        imagenPrincipal: "/imagenes/catalogo/valle-sagrado.jpg",
        imagenes: ["/imagenes/catalogo/valle-sagrado.jpg"],
        tieneImagenesPropias: false,
        circuito: {
            nombre: "Camino del Inca Clásico",
            dias: 4,
            dificultad: "Alta",
            recorrido: "Km 82 -> Wayllabamba -> Pacaymayo",
            etapas: [
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
        nochesAlojamiento: {
            previas: 2,
            posteriores: 1,
            garantia: "Hotel Montaña (Cusco)",
            tipoGarantia: "POR_ESTABLECIMIENTO",
        },
        serviciosAdicionales: ["Hotel Montaña", "IncaRail Voyager"],
        equipajeTransporte: null,
        condiciones: "Garantía directa en Hotel Montaña con tren panorámico.",
        diasDisponibles: "L-M-X-J-V-S-D",
        precios: [
            {
                idtemporada: 1,
                temporada: "Alta 2026",
                fechaInicio: "2026-10-01",
                fechaFin: "2026-12-31",
                precio: 980,
                moneda: "USD",
            },
        ],
        salidasDisponibles: salidasPorPaqueteMock[2],
    },
];

// Perfiles de clientes en memoria alineados con backend/prisma/seed.ts
const clientesMock: PerfilClienteDetalle[] = [
    {
        idcliente: 1,
        idusuario: 2,
        nroCliente: "CLI-001",
        estado: "ACTIVO",
        usuario: {
            nombre: "Juan",
            apellido: "Pérez",
            email: "juan@test.com",
        },
    },
];

// Reservas semilla en memoria alineadas con backend/prisma/seed.ts
export const reservasClienteMock: ReservaClienteDetalle[] = [
    {
        idreserva: 1,
        nroReserva: "RES-0001",
        estado: "CONFIRMADA",
        estadoAlojamiento: "PENDIENTE",
        fechaRealizacion: "2026-10-02T12:00:00.000Z",
        cantidadPasajeros: 1,
        precioCongelado: 1500,
        condicionesComerciales:
            "Incluye traslados desde Cusco y pensión completa en ruta.",
        pagado: 1500,
        titular: {
            nombre: "Juan",
            apellido: "Pérez",
            email: "juan@test.com",
        },
        salida: {
            idsalida: 1,
            nroSalida: "SAL-2026-001",
            estado: "PUBLICADA",
            fechaInicio: "2026-11-15T00:00:00.000Z",
            fechaFin: "2026-11-18T00:00:00.000Z",
        },
        paquete: {
            idpaquete: 1,
            nombrePaquete: "Inca Clásico Standard",
        },
        itinerario: {
            nombreCircuito: "Camino del Inca Clásico",
            duracionDias: 4,
            etapas: [
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
        pasajeros: [
            {
                idpasajero: 1,
                nombreCompleto: "Lucía Fernández",
                nroPasaporte: "PAS-ARG-987654",
                nacionalidad: "Argentina",
            },
        ],
        pagos: [
            {
                idpago: 1,
                nrotransaccion: "TXN-SEED-0001",
                monto: 1500,
                medioPago: "Tarjeta de Crédito",
                fechahora: "2026-10-02T12:00:00.000Z",
            },
        ],
        reembolsos: [],
        solicitudesAlojamiento: [
            {
                nroSolicitud: "SOL-0001",
                estado: "PENDIENTE",
                cantidadPlazas: 1,
            },
        ],
        permisos: [
            {
                idpasajero: 1,
                nroPermiso: "PERM-PAS-001",
                estadoTramite: "Emitido",
                fechaEmision: "2026-10-02T12:00:00.000Z",
            },
        ],
    },
    {
        idreserva: 2,
        nroReserva: "RES-0002-CANC",
        estado: "CANCELADA",
        estadoAlojamiento: "PENDIENTE",
        fechaRealizacion: "2026-10-01T15:30:00.000Z",
        cantidadPasajeros: 1,
        precioCongelado: 1500,
        condicionesComerciales:
            "Incluye traslados desde Cusco y pensión completa en ruta.",
        pagado: 1500,
        titular: {
            nombre: "Juan",
            apellido: "Pérez",
            email: "juan@test.com",
        },
        salida: {
            idsalida: 1,
            nroSalida: "SAL-2026-001",
            estado: "PUBLICADA",
            fechaInicio: "2026-11-15T00:00:00.000Z",
            fechaFin: "2026-11-18T00:00:00.000Z",
        },
        paquete: {
            idpaquete: 1,
            nombrePaquete: "Inca Clásico Standard",
        },
        itinerario: {
            nombreCircuito: "Camino del Inca Clásico",
            duracionDias: 4,
            etapas: [
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
        pasajeros: [
            {
                idpasajero: 1,
                nombreCompleto: "Lucía Fernández",
                nroPasaporte: "PAS-ARG-987654",
                nacionalidad: "Argentina",
            },
        ],
        pagos: [
            {
                idpago: 2,
                nrotransaccion: "TXN-SEED-0002",
                monto: 1500,
                medioPago: "Tarjeta de Crédito",
                fechahora: "2026-10-01T15:30:00.000Z",
            },
        ],
        reembolsos: [
            {
                idreembolso: 1,
                montoReembolsado: 1500,
                motivo: "Cancelación temprana sin permisos emitidos",
                fechaReembolso: "2026-10-03T09:00:00.000Z",
            },
        ],
        solicitudesAlojamiento: [],
        permisos: [],
    },
];

let proximoIdReserva = 100;
let proximoIdReembolso = 10;
let proximoIdUsuario = 50;
let proximoIdCliente = 50;

function resumirReservaMock(r: ReservaClienteDetalle): ReservaClienteResumen {
    const reintegro =
        r.reembolsos.length > 0
            ? r.reembolsos.reduce((acc, x) => acc + x.montoReembolsado, 0)
            : null;
    return {
        idreserva: r.idreserva,
        nroReserva: r.nroReserva,
        estado: r.estado,
        estadoAlojamiento: r.estadoAlojamiento,
        fechaRealizacion: r.fechaRealizacion,
        cantidadPasajeros: r.cantidadPasajeros,
        precioCongelado: r.precioCongelado,
        pagado: r.pagado,
        reintegro,
        salida: r.salida,
        paquete: r.paquete,
    };
}

export const manejadoresCatalogoReservas = [
    // CU-27: POST /api/clientes (registro público de cliente)
    http.post(construirUrl("/clientes"), async ({ request }) => {
        await delay(200);
        const body = (await request.json()) as Partial<RegistrarClientePayload>;
        const nombre = body.nombre?.trim() ?? "";
        const apellido = body.apellido?.trim() ?? "";
        const email = body.email?.trim().toLowerCase() ?? "";
        const contrasenia = body.contrasenia ?? "";

        const letrasRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email || !emailRegex.test(email)) {
            return HttpResponse.json(
                { error: "El formato del correo electrónico no es válido" },
                { status: 400 },
            );
        }
        if (!contrasenia || contrasenia.length < 8) {
            return HttpResponse.json(
                { error: "La contraseña debe tener como mínimo 8 caracteres" },
                { status: 400 },
            );
        }
        if (!nombre || nombre.length > 64 || !letrasRegex.test(nombre)) {
            return HttpResponse.json(
                { error: "El nombre solo puede contener letras y espacios" },
                { status: 400 },
            );
        }
        if (!apellido || apellido.length > 64 || !letrasRegex.test(apellido)) {
            return HttpResponse.json(
                { error: "El apellido solo puede contener letras y espacios" },
                { status: 400 },
            );
        }

        const existe = cuentasMock.some(
            (c) => c.usuario.email.toLowerCase() === email,
        );
        if (existe) {
            return HttpResponse.json(
                {
                    error: "Ya existe un usuario registrado con ese correo electrónico.",
                },
                { status: 400 },
            );
        }

        const idusuario = proximoIdUsuario++;
        const idcliente = proximoIdCliente++;
        const nroCliente = `CLI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        cuentasMock.push({
            contrasenia,
            usuario: {
                idusuario,
                email,
                nombre,
                apellido,
                rol: "CLIENTE",
            },
        });

        clientesMock.push({
            idcliente,
            idusuario,
            nroCliente,
            estado: "ACTIVO",
            usuario: {
                nombre,
                apellido,
                email,
            },
        });

        return HttpResponse.json(
            {
                mensaje: "Cliente creado con éxito",
                data: {
                    cliente: {
                        idcliente,
                        idusuario,
                        nroCliente,
                        estado: "ACTIVO",
                    },
                    idusuario,
                    nombre,
                    apellido,
                    email,
                },
            },
            { status: 201 },
        );
    }),

    // CU-28: GET /api/clientes/:id (consultar perfil del cliente)
    http.get(construirUrl("/clientes/:id"), async ({ request, params }) => {
        const denegado = exigirRol(request, "CLIENTE");
        if (denegado) return denegado;
        await delay(120);

        const id = Number(params.id);
        const cliente =
            clientesMock.find(
                (c) => c.idcliente === id || c.idusuario === id,
            ) ?? clientesMock[0];

        if (!cliente) {
            return HttpResponse.json(
                { error: "Cliente no encontrado." },
                { status: 404 },
            );
        }

        return HttpResponse.json({ data: cliente });
    }),

    // CU-28: PUT /api/clientes/:id (modificar cuenta de cliente)
    http.put(construirUrl("/clientes/:id"), async ({ request, params }) => {
        const denegado = exigirRol(request, "CLIENTE");
        if (denegado) return denegado;
        await delay(200);

        const id = Number(params.id);
        const cliente =
            clientesMock.find(
                (c) => c.idcliente === id || c.idusuario === id,
            ) ?? clientesMock[0];

        if (!cliente) {
            return HttpResponse.json(
                { error: "Cliente no encontrado." },
                { status: 404 },
            );
        }

        if (cliente.estado === "INACTIVO") {
            return HttpResponse.json(
                { error: "No se puede modificar una cuenta inactiva." },
                { status: 400 },
            );
        }

        const body = (await request.json()) as {
            nombre?: string;
            apellido?: string;
            email?: string;
        };

        const nombre = body.nombre?.trim();
        const apellido = body.apellido?.trim();
        const email = body.email?.trim().toLowerCase();

        if (!nombre && !apellido && !email) {
            return HttpResponse.json(
                {
                    error: "Debe proporcionar al menos un campo para modificar (nombre, apellido o email)",
                },
                { status: 400 },
            );
        }

        const letrasRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (nombre !== undefined) {
            if (nombre.length === 0 || nombre.length > 64) {
                return HttpResponse.json(
                    { error: "El nombre debe tener entre 1 y 64 caracteres" },
                    { status: 400 },
                );
            }
            if (!letrasRegex.test(nombre)) {
                return HttpResponse.json(
                    { error: "El nombre solo puede contener letras y espacios" },
                    { status: 400 },
                );
            }
        }

        if (apellido !== undefined) {
            if (apellido.length === 0 || apellido.length > 64) {
                return HttpResponse.json(
                    { error: "El apellido debe tener entre 1 y 64 caracteres" },
                    { status: 400 },
                );
            }
            if (!letrasRegex.test(apellido)) {
                return HttpResponse.json(
                    {
                        error: "El apellido solo puede contener letras y espacios",
                    },
                    { status: 400 },
                );
            }
        }

        if (email !== undefined) {
            if (!emailRegex.test(email)) {
                return HttpResponse.json(
                    { error: "El formato del correo electrónico no es válido" },
                    { status: 400 },
                );
            }
            const duplicado = cuentasMock.find(
                (c) =>
                    c.usuario.email.toLowerCase() === email &&
                    c.usuario.idusuario !== cliente.idusuario,
            );
            if (duplicado) {
                return HttpResponse.json(
                    {
                        error: "El correo electrónico ya está en uso por otra cuenta.",
                    },
                    { status: 400 },
                );
            }
        }

        if (nombre) cliente.usuario.nombre = nombre;
        if (apellido) cliente.usuario.apellido = apellido;
        if (email) cliente.usuario.email = email;

        const cuenta = cuentasMock.find(
            (c) => c.usuario.idusuario === cliente.idusuario,
        );
        if (cuenta) {
            cuenta.usuario.nombre = cliente.usuario.nombre;
            cuenta.usuario.apellido = cliente.usuario.apellido;
            cuenta.usuario.email = cliente.usuario.email;
        }

        reservasClienteMock.forEach((r) => {
            r.titular = { ...cliente.usuario };
        });

        return HttpResponse.json({
            mensaje: "Cliente modificado",
            data: cliente,
        });
    }),

    // CU-29: PATCH /api/clientes/:id/baja (dar de baja lógica la cuenta de cliente)
    http.patch(
        construirUrl("/clientes/:id/baja"),
        async ({ request, params }) => {
            const denegado = exigirRol(request, "CLIENTE");
            if (denegado) return denegado;
            await delay(200);

            const id = Number(params.id);
            const cliente =
                clientesMock.find(
                    (c) => c.idcliente === id || c.idusuario === id,
                ) ?? clientesMock[0];

            if (!cliente) {
                return HttpResponse.json(
                    { error: "Cliente no encontrado." },
                    { status: 404 },
                );
            }

            if (cliente.estado === "INACTIVO") {
                return HttpResponse.json(
                    { error: "El cliente ya se encuentra inactivo." },
                    { status: 400 },
                );
            }

            const tieneReservasConfirmadas = reservasClienteMock.some(
                (r) =>
                    r.estado.toUpperCase() === "CONFIRMADA",
            );
            if (tieneReservasConfirmadas) {
                return HttpResponse.json(
                    {
                        error: "No se puede dar de baja porque tiene reservas activas.",
                    },
                    { status: 400 },
                );
            }

            cliente.estado = "INACTIVO";
            const idxCuenta = cuentasMock.findIndex(
                (c) => c.usuario.idusuario === cliente.idusuario,
            );
            if (idxCuenta !== -1) {
                cuentasMock.splice(idxCuenta, 1);
            }

            return HttpResponse.json({
                mensaje: "Cliente dado de baja",
                data: {
                    idcliente: cliente.idcliente,
                    idusuario: cliente.idusuario,
                    nroCliente: cliente.nroCliente,
                    estado: "INACTIVO",
                },
            });
        },
    ),

    // CU-26: GET /api/catalogo
    http.get(construirUrl("/catalogo"), async () => {
        await delay(150);
        const data = catalogoMockInicial.map((p) => ({
            ...p,
            salidasDisponibles: salidasPorPaqueteMock[p.id] ?? [],
        }));
        return HttpResponse.json({
            mensaje: "Catálogo público consultado exitosamente",
            cantidad: data.length,
            data,
        });
    }),

    // CU-31: GET /api/reservas/mis-reservas
    http.get(construirUrl("/reservas/mis-reservas"), async ({ request }) => {
        const denegado = exigirRol(request, "CLIENTE");
        if (denegado) return denegado;
        await delay(150);

        const url = new URL(request.url);
        const estadoFiltro = url.searchParams.get("estado");

        const filtradas = reservasClienteMock
            .filter((r) => !estadoFiltro || r.estado === estadoFiltro)
            .map(resumirReservaMock);

        return HttpResponse.json({ data: filtradas });
    }),

    // CU-31: GET /api/reservas/:idreserva/comprobante
    http.get(
        construirUrl("/reservas/:idreserva/comprobante"),
        async ({ request, params }) => {
            const denegado = exigirRol(request, "CLIENTE");
            if (denegado) return denegado;
            await delay(150);

            const idreserva = Number(params.idreserva);
            const reserva = reservasClienteMock.find(
                (r) => r.idreserva === idreserva,
            );
            if (!reserva) {
                return HttpResponse.json(
                    { error: `No se encontró la reserva con ID ${idreserva}.` },
                    { status: 404 },
                );
            }

            const reintegro =
                reserva.reembolsos.length > 0
                    ? reserva.reembolsos.reduce(
                          (acc, x) => acc + x.montoReembolsado,
                          0,
                      )
                    : null;

            const comprobante: ComprobanteReserva = {
                nroReserva: reserva.nroReserva,
                fechaRealizacion: reserva.fechaRealizacion,
                estado: reserva.estado,
                titular: reserva.titular,
                paquete: reserva.paquete.nombrePaquete,
                salida: {
                    nroSalida: reserva.salida.nroSalida,
                    fechaInicio: reserva.salida.fechaInicio,
                    fechaFin: reserva.salida.fechaFin,
                },
                pasajeros: reserva.pasajeros.map((p) => p.nombreCompleto),
                precioCongelado: reserva.precioCongelado,
                condicionesComerciales: reserva.condicionesComerciales,
                pagos: reserva.pagos.map((p) => ({
                    nroTransaccion: p.nrotransaccion,
                    monto: p.monto,
                    medioPago: p.medioPago,
                    fechahora: p.fechahora,
                })),
                totalPagado: reserva.pagado,
                reintegro,
            };

            return HttpResponse.json({ data: comprobante });
        },
    ),

    // CU-32 (paso 1): GET /api/reservas/:idreserva/cancelacion
    http.get(
        construirUrl("/reservas/:idreserva/cancelacion"),
        async ({ request, params }) => {
            const denegado = exigirRol(request, "CLIENTE");
            if (denegado) return denegado;
            await delay(150);

            const idreserva = Number(params.idreserva);
            const reserva = reservasClienteMock.find(
                (r) => r.idreserva === idreserva,
            );
            if (!reserva) {
                return HttpResponse.json(
                    { error: `No se encontró la reserva con ID ${idreserva}.` },
                    { status: 404 },
                );
            }

            if (reserva.estado !== "CONFIRMADA") {
                return HttpResponse.json(
                    {
                        error: "Solo se pueden cancelar reservas en estado Confirmada.",
                    },
                    { status: 400 },
                );
            }

            const salidaIniciada =
                new Date(reserva.salida.fechaInicio) <= new Date() ||
                ["EN_CURSO", "FINALIZADA", "CANCELADA"].includes(
                    reserva.salida.estado,
                );
            if (salidaIniciada) {
                return HttpResponse.json(
                    {
                        error: "Las salidas en curso o finalizadas no admiten cancelaciones.",
                    },
                    { status: 400 },
                );
            }

            const permisosEmitidos = reserva.permisos.some(
                (p) => p.estadoTramite === "Emitido",
            );
            const importeAbonado = reserva.pagado;
            const montoAReintegrar = permisosEmitidos ? 0 : importeAbonado;

            const resumen: ResumenCancelacionReserva = {
                idreserva,
                nroReserva: reserva.nroReserva,
                importeAbonado,
                montoAReintegrar,
                permisosEmitidos,
                lugaresVuelvenALaVenta: !permisosEmitidos,
                advertencia: permisosEmitidos
                    ? "Los permisos ya fueron emitidos ante la autoridad (son nominales e intransferibles). El reintegro es de $0 y los lugares no vuelven a la venta."
                    : null,
            };

            return HttpResponse.json({ data: resumen });
        },
    ),

    // CU-32 (paso 2): POST /api/reservas/:idreserva/cancelar
    http.post(
        construirUrl("/reservas/:idreserva/cancelar"),
        async ({ request, params }) => {
            const denegado = exigirRol(request, "CLIENTE");
            if (denegado) return denegado;
            await delay(200);

            const idreserva = Number(params.idreserva);
            const reserva = reservasClienteMock.find(
                (r) => r.idreserva === idreserva,
            );
            if (!reserva) {
                return HttpResponse.json(
                    { error: `No se encontró la reserva con ID ${idreserva}.` },
                    { status: 404 },
                );
            }

            if (reserva.estado !== "CONFIRMADA") {
                return HttpResponse.json(
                    {
                        error: "Solo se pueden cancelar reservas en estado Confirmada.",
                    },
                    { status: 400 },
                );
            }

            const salidaIniciada =
                new Date(reserva.salida.fechaInicio) <= new Date() ||
                ["EN_CURSO", "FINALIZADA", "CANCELADA"].includes(
                    reserva.salida.estado,
                );
            if (salidaIniciada) {
                return HttpResponse.json(
                    {
                        error: "Las salidas en curso o finalizadas no admiten cancelaciones.",
                    },
                    { status: 400 },
                );
            }

            const body = (await request.json().catch(() => ({}))) as {
                motivo?: string;
            };
            const motivo = body.motivo?.trim() || "Sin motivo informado";
            if (motivo.length > 300) {
                return HttpResponse.json(
                    { error: "motivo debe ser un texto de hasta 300 caracteres." },
                    { status: 400 },
                );
            }

            const permisosEmitidos = reserva.permisos.some(
                (p) => p.estadoTramite === "Emitido",
            );
            const montoReembolsado = permisosEmitidos ? 0 : reserva.pagado;

            reserva.estado = "CANCELADA";
            if (permisosEmitidos) {
                reserva.permisos.forEach((p) => {
                    if (p.estadoTramite === "Emitido") {
                        p.estadoTramite = "Perdido";
                    }
                });
            } else {
                const todasSalidas = Object.values(salidasPorPaqueteMock).flat();
                const salidaCatalogo = todasSalidas.find(
                    (s) => s.idsalida === reserva.salida.idsalida,
                );
                if (salidaCatalogo) {
                    salidaCatalogo.stockLocal += reserva.cantidadPasajeros;
                }
            }

            reserva.solicitudesAlojamiento.forEach((s) => {
                if (s.estado === "PENDIENTE" || s.estado === "CONFIRMADA") {
                    s.estado = "CANCELADA";
                }
            });

            const nuevoReembolso = {
                idreembolso: proximoIdReembolso++,
                montoReembolsado,
                motivo,
                fechaReembolso: new Date().toISOString(),
            };
            reserva.reembolsos.push(nuevoReembolso);

            const resultado: ResultadoCancelacionReserva = {
                idreserva,
                nroReserva: reserva.nroReserva,
                estado: "CANCELADA",
                lugaresVuelvenALaVenta: !permisosEmitidos,
                reembolso: {
                    ...nuevoReembolso,
                    nota: "La acreditación del dinero se ejecuta por fuera del sistema.",
                },
            };

            return HttpResponse.json({
                mensaje: "Reserva cancelada exitosamente",
                data: resultado,
            });
        },
    ),

    // CU-31: GET /api/reservas/:idreserva (detalle)
    http.get(
        construirUrl("/reservas/:idreserva"),
        async ({ request, params }) => {
            const denegado = exigirRol(request, "CLIENTE");
            if (denegado) return denegado;
            await delay(150);

            const idreserva = Number(params.idreserva);
            const reserva = reservasClienteMock.find(
                (r) => r.idreserva === idreserva,
            );
            if (!reserva) {
                return HttpResponse.json(
                    { error: `No se encontró la reserva con ID ${idreserva}.` },
                    { status: 404 },
                );
            }

            return HttpResponse.json({ data: reserva });
        },
    ),

    // CU-30: POST /api/reservas
    http.post(construirUrl("/reservas"), async ({ request }) => {
        const denegado = exigirRol(request, "CLIENTE");
        if (denegado) return denegado;
        await delay(300);
        const body = (await request.json()) as CrearReservaPayload;

        const todasSalidas = Object.entries(salidasPorPaqueteMock).flatMap(
            ([idPaq, lista]) =>
                lista.map((s) => ({ idPaquete: Number(idPaq), salida: s })),
        );
        const encontrada = todasSalidas.find(
            (item) => item.salida.idsalida === body.idsalida,
        );
        if (!encontrada) {
            return HttpResponse.json(
                { error: "La salida no existe." },
                { status: 404 },
            );
        }

        const { idPaquete, salida } = encontrada;
        const paquete = catalogoMockInicial.find((p) => p.id === idPaquete);

        if (!body.pasajeros || body.pasajeros.length === 0) {
            return HttpResponse.json(
                {
                    error: "Debe registrar al menos un pasajero para la reserva.",
                },
                { status: 400 },
            );
        }

        if (body.pasajeros.length > salida.stockLocal) {
            return HttpResponse.json(
                {
                    error: `Solo quedan ${salida.stockLocal} lugares en esta salida.`,
                },
                { status: 400 },
            );
        }

        const pasaportes = new Set(
            body.pasajeros.map((p) => p.nroPasaporte.trim().toUpperCase()),
        );
        if (pasaportes.size !== body.pasajeros.length) {
            return HttpResponse.json(
                { error: "Hay pasajeros con el mismo número de pasaporte." },
                { status: 400 },
            );
        }

        for (const p of body.pasajeros) {
            if (
                new Date(p.fechaVencimientoPasaporte) <=
                new Date(salida.fechaFin)
            ) {
                return HttpResponse.json(
                    {
                        error: `El pasaporte de ${p.nombreCompleto} vence antes de finalizar el recorrido.`,
                    },
                    { status: 400 },
                );
            }
        }

        // Reglas de la pasarela simulada del contrato (CONTRATO_API.md)
        const numTarjeta = (body.tarjeta?.numero ?? "").replace(/\s+/g, "");
        const cvv = (body.tarjeta?.cvv ?? "").trim();

        if (numTarjeta.endsWith("0000")) {
            return HttpResponse.json(
                {
                    error: "Pago rechazado: Fondos insuficientes en la tarjeta.",
                },
                { status: 400 },
            );
        }
        if (numTarjeta.endsWith("1111")) {
            return HttpResponse.json(
                {
                    error: "Pago rechazado: Tarjeta denunciada como robada o bloqueada.",
                },
                { status: 400 },
            );
        }
        if (cvv === "999") {
            return HttpResponse.json(
                {
                    error: "Pago rechazado: Falla de validación de seguridad (CVV inválido).",
                },
                { status: 400 },
            );
        }

        // Calcular precio base + excedente de equipaje
        let extraEquipaje = 0;
        const eqTrans = paquete?.equipajeTransporte;
        if (eqTrans && body.equipaje) {
            for (const eq of body.equipaje) {
                const exceso =
                    (eq.pesoDeclarado || 0) - eqTrans.pesoEquipajeIncluido;
                if (exceso > 0) {
                    extraEquipaje += exceso * eqTrans.costoPorKgExcedente;
                }
            }
        }

        const precioCongelado =
            Math.round(
                (salida.precioPersona * body.pasajeros.length + extraEquipaje) *
                    100,
            ) / 100;

        // Descontar stockLocal
        salida.stockLocal -= body.pasajeros.length;

        const idreserva = proximoIdReserva++;
        const sufijo = Math.random().toString(16).slice(2, 8).toUpperCase();
        const nroReserva = `RES-${Date.now()}-${sufijo}`;
        const esEstablecimiento = (
            paquete?.nochesAlojamiento.tipoGarantia ?? ""
        )
            .toUpperCase()
            .includes("ESTABLECIMIENTO");

        const estadoAlojamiento = esEstablecimiento
            ? "CONFIRMADO"
            : "PENDIENTE";
        const nroTransaccion = `TXN-${sufijo}`;
        const ahoraIso = new Date().toISOString();

        // Guardar también en reservasClienteMock para que aparezca en CU-31 y CU-32
        reservasClienteMock.unshift({
            idreserva,
            nroReserva,
            estado: "CONFIRMADA",
            estadoAlojamiento,
            fechaRealizacion: ahoraIso,
            cantidadPasajeros: body.pasajeros.length,
            precioCongelado,
            condicionesComerciales: paquete?.condiciones ?? null,
            pagado: precioCongelado,
            titular: {
                nombre: clientesMock[0]?.usuario.nombre ?? "Juan",
                apellido: clientesMock[0]?.usuario.apellido ?? "Pérez",
                email: clientesMock[0]?.usuario.email ?? "juan@test.com",
            },
            salida: {
                idsalida: salida.idsalida,
                nroSalida: salida.nroSalida,
                estado: "PUBLICADA",
                fechaInicio: salida.fechaInicio,
                fechaFin: salida.fechaFin,
            },
            paquete: {
                idpaquete: paquete?.id ?? idPaquete,
                nombrePaquete: paquete?.nombre ?? "Paquete IncaTour",
            },
            itinerario: {
                nombreCircuito:
                    paquete?.circuito.nombre ?? "Camino del Inca Clásico",
                duracionDias: paquete?.circuito.dias ?? 4,
                etapas: (paquete?.circuito.etapas ?? []).map((e) => ({
                    numeroOrden: e.numeroOrden,
                    puntoInicio: e.puntoInicio,
                    puntoFin: e.puntoFin,
                    campamentoPrevisto: e.campamentoPrevisto ?? null,
                })),
            },
            pasajeros: body.pasajeros.map((p, idx) => ({
                idpasajero: idreserva * 10 + idx + 1,
                nombreCompleto: p.nombreCompleto,
                nroPasaporte: p.nroPasaporte,
                nacionalidad: p.nacionalidad,
            })),
            pagos: [
                {
                    idpago: idreserva,
                    nrotransaccion: nroTransaccion,
                    monto: precioCongelado,
                    medioPago: body.medioPago,
                    fechahora: ahoraIso,
                },
            ],
            reembolsos: [],
            solicitudesAlojamiento:
                estadoAlojamiento === "PENDIENTE"
                    ? [
                          {
                              nroSolicitud: `SOL-${nroReserva}`,
                              estado: "PENDIENTE",
                              cantidadPlazas: body.pasajeros.length,
                          },
                      ]
                    : [],
            permisos: [],
        });

        const data: ResultadoReservaConfirmada = {
            idreserva,
            nroReserva,
            estado: "CONFIRMADA",
            estadoAlojamiento,
            cantidadPasajeros: body.pasajeros.length,
            precioCongelado,
            moneda: salida.moneda,
            transaccionPasarela: nroTransaccion,
        };

        return HttpResponse.json(
            {
                mensaje: "Reserva confirmada",
                data,
            },
            { status: 201 },
        );
    }),
];
