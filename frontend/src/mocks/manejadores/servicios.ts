import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import {
    esquemaServicio,
    type DatosServicio,
    type EdicionServicio,
    type Servicio,
    type ServicioModificar,
    type TipoServicio,
} from "../../services/servicioService";
import { exigirRol } from "../autorizacion";
import { proveedoresSemilla } from "../datos/proveedores";
import {
    serviciosConSolicitudesPendientes,
    serviciosEnSalidasActivas,
    serviciosGarantizadosPorPaquetesActivos,
    serviciosSemilla,
} from "../datos/servicios";

let servicios: Servicio[] = [...serviciosSemilla];

const CAMPOS_BASE_EDITABLES = ["nombreServicio", "descripcion", "costoBase", "localidad"];

const CAMPOS_MODIFICAR_POR_TIPO: Record<TipoServicio, string[]> = {
    ALOJAMIENTO: ["categoria", "tipoHabitacion", "capacidadDisponible", "modalidadConfirmacion"],
    TRANSPORTE: ["capacidadVehiculo", "pesoEquipajeIncluido", "costoPorKgExcedente"],
    TREN: ["horarioSalida", "horarioLlegada", "diasOperacion"],
    EQUIPAMIENTO: ["tipoEquipamiento", "inventarioTotal"],
};

const leerId = (valor: unknown): number | null => {
    const id = Number(valor);
    return Number.isInteger(id) && id > 0 ? id : null;
};

const respuestaInvalida = (error: string) =>
    HttpResponse.json({ error }, { status: 400 });

function construirBloqueEdicion(servicio: Servicio): EdicionServicio {
    const enUso = serviciosEnSalidasActivas.has(servicio.idservicio);
    const garantiza = serviciosGarantizadosPorPaquetesActivos.has(servicio.idservicio);
    return {
        camposEditables: [
            ...CAMPOS_BASE_EDITABLES,
            ...CAMPOS_MODIFICAR_POR_TIPO[servicio.tipo],
        ],
        enUsoEnSalidasActivas: enUso,
        garantizaPaquetesActivos: garantiza,
        aplicaSoloAFuturasSalidas:
            enUso && (servicio.tipo === "ALOJAMIENTO" || servicio.tipo === "TRANSPORTE"),
    };
}

function respuestaServicio(servicio: Servicio, incluirEdicion = false) {
    const {
        tipo,
        nombreServicio,
        descripcion,
        costoBase,
        localidad,
        estado,
        idservicio,
        idproveedor,
    } = servicio;

    const campos = {
        categoria: servicio.categoria,
        tipoHabitacion: servicio.tipoHabitacion,
        capacidadDisponible: servicio.capacidadDisponible,
        modalidadConfirmacion: servicio.modalidadConfirmacion,
        capacidadVehiculo: servicio.capacidadVehiculo,
        pesoEquipajeIncluido: servicio.pesoEquipajeIncluido,
        costoPorKgExcedente: servicio.costoPorKgExcedente,
        horarioSalida: servicio.horarioSalida,
        horarioLlegada: servicio.horarioLlegada,
        diasOperacion: servicio.diasOperacion,
        tipoEquipamiento: servicio.tipoEquipamiento,
        cantidadDisponible: servicio.cantidadDisponible,
    };

    const datos = Object.fromEntries(
        Object.entries(campos).filter(([, valor]) => valor !== undefined),
    );

    const comprometida = servicio.cantidadComprometida ?? 0;
    const disponible = servicio.cantidadDisponible ?? 0;
    const disponibilidad =
        tipo === "EQUIPAMIENTO"
            ? {
                  cantidadDisponible: disponible,
                  cantidadComprometida: comprometida,
                  inventarioTotal: servicio.inventarioTotal ?? disponible + comprometida,
              }
            : tipo === "ALOJAMIENTO"
              ? {
                    capacidadDisponible: servicio.capacidadDisponible ?? 0,
                    modalidadConfirmacion: servicio.modalidadConfirmacion ?? "",
                }
              : tipo === "TRANSPORTE"
                ? { capacidadVehiculo: servicio.capacidadVehiculo ?? 0 }
                : { diasOperacion: servicio.diasOperacion ?? "" };

    const proveedor = proveedoresSemilla.find((item) => item.idproveedor === idproveedor);

    return {
        idservicio,
        idproveedor,
        tipo,
        nombreServicio,
        descripcion: descripcion || null,
        costoBase,
        localidad,
        estado,
        proveedor: {
            idproveedor,
            razonSocial: proveedor?.razonSocial ?? `Proveedor ${idproveedor}`,
            tipoProveedor: proveedor?.tipoProveedor ?? tipo,
        },
        datos,
        disponibilidad,
        ...(incluirEdicion ? { edicion: construirBloqueEdicion(servicio) } : {}),
    };
}

export const manejadoresServicios = [
    http.get(
        construirUrl("/proveedores/:idproveedor/servicios"),
        async ({ params, request }) => {
            await delay();
            const sinPermiso = exigirRol(request, "ADMIN");
            if (sinPermiso) return sinPermiso;

            const idProveedor = leerId(params.idproveedor);
            if (idProveedor === null) {
                return respuestaInvalida("El ID de proveedor proporcionado no es válido.");
            }

            const estado = new URL(request.url).searchParams.get("estado");
            if (estado && estado !== "ACTIVO" && estado !== "INACTIVO") {
                return respuestaInvalida("estado debe ser ACTIVO o INACTIVO.");
            }

            return HttpResponse.json({
                data: servicios
                    .filter(
                        (servicio) =>
                            servicio.idproveedor === idProveedor &&
                            (!estado || servicio.estado === estado),
                    )
                    .map((servicio) => respuestaServicio(servicio)),
            });
        },
    ),

    http.get(construirUrl("/servicios/:id"), async ({ params, request }) => {
        await delay();
        const sinPermiso = exigirRol(request, "ADMIN");
        if (sinPermiso) return sinPermiso;

        const id = leerId(params.id);
        if (id === null) {
            return respuestaInvalida("El ID de servicio proporcionado no es válido.");
        }
        const servicio = servicios.find((item) => item.idservicio === id);
        if (!servicio) {
            return HttpResponse.json(
                { error: `No se encontró el servicio con ID ${id}.` },
                { status: 404 },
            );
        }
        return HttpResponse.json({ data: respuestaServicio(servicio, true) });
    }),

    http.post(
        construirUrl("/proveedores/:idproveedor/servicios"),
        async ({ params, request }) => {
            await delay();
            const sinPermiso = exigirRol(request, "ADMIN");
            if (sinPermiso) return sinPermiso;

            const idproveedor = leerId(params.idproveedor);
            if (idproveedor === null) {
                return respuestaInvalida("El ID de proveedor proporcionado no es válido.");
            }

            const proveedor = proveedoresSemilla.find(
                (item) => item.idproveedor === idproveedor,
            );
            if (proveedor && proveedor.estado !== "ACTIVO") {
                return respuestaInvalida(
                    "No se pueden registrar servicios para un proveedor inactivo.",
                );
            }

            const cuerpo = (await request.json()) as DatosServicio;
            const validacion = esquemaServicio.safeParse(cuerpo);
            if (!validacion.success) {
                return respuestaInvalida(
                    validacion.error.issues[0]?.message ?? "Datos inválidos.",
                );
            }
            const datos = validacion.data;

            if (proveedor && proveedor.tipoProveedor !== datos.tipo) {
                return respuestaInvalida(
                    `El proveedor es de tipo ${proveedor.tipoProveedor}: solo puede registrar servicios de ese tipo.`,
                );
            }

            const nombreDuplicado = servicios.some(
                (item) =>
                    item.idproveedor === idproveedor &&
                    item.estado === "ACTIVO" &&
                    item.nombreServicio.toLowerCase() === datos.nombreServicio.toLowerCase(),
            );
            if (nombreDuplicado) {
                return respuestaInvalida(
                    `El proveedor ya tiene un servicio activo llamado "${datos.nombreServicio}".`,
                );
            }

            const id = Math.max(0, ...servicios.map((servicio) => servicio.idservicio)) + 1;
            const nuevo: Servicio = {
                ...datos,
                id,
                idservicio: id,
                idproveedor,
                estado: "ACTIVO",
                ...(datos.tipo === "EQUIPAMIENTO"
                    ? {
                          cantidadComprometida: 0,
                          inventarioTotal: datos.cantidadDisponible ?? 0,
                      }
                    : {}),
            };
            servicios = [...servicios, nuevo];
            return HttpResponse.json(
                {
                    mensaje: "Servicio registrado exitosamente",
                    data: respuestaServicio(nuevo),
                },
                { status: 201 },
            );
        },
    ),

    http.put(construirUrl("/servicios/:id"), async ({ params, request }) => {
        await delay();
        const sinPermiso = exigirRol(request, "ADMIN");
        if (sinPermiso) return sinPermiso;

        const id = leerId(params.id);
        if (id === null) {
            return respuestaInvalida("El ID de servicio proporcionado no es válido.");
        }
        const existente = servicios.find((servicio) => servicio.idservicio === id);
        if (!existente) {
            return HttpResponse.json(
                { error: `No se encontró el servicio con ID ${id}.` },
                { status: 404 },
            );
        }
        if (existente.estado !== "ACTIVO") {
            return respuestaInvalida(
                "No se puede modificar un servicio que está dado de baja.",
            );
        }

        const datos = (await request.json()) as ServicioModificar;
        if (!datos || Object.keys(datos).length === 0) {
            return respuestaInvalida("Debe enviar al menos un campo para modificar.");
        }

        const permitidos = new Set([
            ...CAMPOS_BASE_EDITABLES,
            ...CAMPOS_MODIFICAR_POR_TIPO[existente.tipo],
        ]);
        const ajenos = Object.keys(datos).filter((campo) => !permitidos.has(campo));
        if (ajenos.length > 0) {
            return respuestaInvalida(
                `Los campos ${ajenos.join(", ")} no corresponden a un servicio de tipo ${existente.tipo}.`,
            );
        }

        if (existente.tipo === "EQUIPAMIENTO" && datos.inventarioTotal !== undefined) {
            const comprometida = existente.cantidadComprometida ?? 0;
            if (datos.inventarioTotal < comprometida) {
                return respuestaInvalida(
                    `La nueva cantidad (${datos.inventarioTotal}) es inferior a la comprometida en salidas activas (${comprometida}).`,
                );
            }
        }

        if (
            existente.tipo === "ALOJAMIENTO" &&
            serviciosGarantizadosPorPaquetesActivos.has(id)
        ) {
            const cambiaCriterio =
                (datos.localidad !== undefined && datos.localidad !== existente.localidad) ||
                (datos.categoria !== undefined && datos.categoria !== existente.categoria) ||
                (datos.tipoHabitacion !== undefined &&
                    datos.tipoHabitacion !== existente.tipoHabitacion);
            if (cambiaCriterio) {
                return respuestaInvalida(
                    "El servicio es el establecimiento garantizado por un paquete activo: no se pueden cambiar su localidad, categoría ni tipo de habitación. Modificá primero el paquete.",
                );
            }
            if (
                datos.modalidadConfirmacion !== undefined &&
                datos.modalidadConfirmacion !== "BLOQUEO_PLAZAS"
            ) {
                return respuestaInvalida(
                    "Un establecimiento garantizado por un paquete debe mantener la modalidad de bloqueo de plazas.",
                );
            }
        }

        const camposEstructurales = CAMPOS_MODIFICAR_POR_TIPO[existente.tipo];
        const cambiaEstructura =
            (existente.tipo === "ALOJAMIENTO" || existente.tipo === "TRANSPORTE") &&
            ((datos.localidad !== undefined && datos.localidad !== existente.localidad) ||
                camposEstructurales.some((campo) => {
                    const clave = campo as keyof ServicioModificar;
                    return datos[clave] !== undefined && datos[clave] !== existente[clave];
                }));

        if (cambiaEstructura && serviciosEnSalidasActivas.has(id)) {
            const nuevoId =
                Math.max(0, ...servicios.map((servicio) => servicio.idservicio)) + 1;
            const versionAnterior: Servicio = { ...existente, estado: "INACTIVO" };
            const nuevaVersion: Servicio = {
                ...existente,
                ...datos,
                id: nuevoId,
                idservicio: nuevoId,
                estado: "ACTIVO",
            };
            servicios = [
                ...servicios.map((servicio) =>
                    servicio.idservicio === id ? versionAnterior : servicio,
                ),
                nuevaVersion,
            ];
            return HttpResponse.json({
                mensaje:
                    "El servicio está en salidas publicadas o en curso: los cambios se aplicaron en una versión nueva que rige solo para salidas futuras",
                versionado: true,
                idservicioAnterior: id,
                data: respuestaServicio(nuevaVersion),
            });
        }

        const comprometida = existente.cantidadComprometida ?? 0;
        const actualizado: Servicio = {
            ...existente,
            ...datos,
            ...(existente.tipo === "EQUIPAMIENTO" && datos.inventarioTotal !== undefined
                ? {
                      inventarioTotal: datos.inventarioTotal,
                      cantidadDisponible: datos.inventarioTotal - comprometida,
                  }
                : {}),
        };
        servicios = servicios.map((servicio) =>
            servicio.idservicio === id ? actualizado : servicio,
        );
        return HttpResponse.json({
            mensaje: "Servicio modificado exitosamente",
            versionado: false,
            data: respuestaServicio(actualizado),
        });
    }),

    http.patch(construirUrl("/servicios/:id/baja"), async ({ params, request }) => {
        await delay();
        const sinPermiso = exigirRol(request, "ADMIN");
        if (sinPermiso) return sinPermiso;

        const id = leerId(params.id);
        if (id === null) {
            return respuestaInvalida("El ID de servicio proporcionado no es válido.");
        }
        const existente = servicios.find((servicio) => servicio.idservicio === id);
        if (!existente) {
            return HttpResponse.json(
                { error: `No se encontró el servicio con ID ${id}.` },
                { status: 404 },
            );
        }
        if (existente.estado === "INACTIVO") {
            return respuestaInvalida("El servicio ya se encuentra dado de baja.");
        }
        if (serviciosConSolicitudesPendientes.has(id)) {
            return respuestaInvalida("Error. El servicio tiene solicitudes pendientes");
        }
        if (serviciosEnSalidasActivas.has(id)) {
            return respuestaInvalida("Error. El servicio está asignado a salidas activas");
        }
        if (serviciosGarantizadosPorPaquetesActivos.has(id)) {
            return respuestaInvalida(
                "Error. El servicio es el establecimiento garantizado por un paquete activo",
            );
        }

        const actualizado: Servicio = { ...existente, estado: "INACTIVO" };
        servicios = servicios.map((servicio) =>
            servicio.idservicio === id ? actualizado : servicio,
        );
        return HttpResponse.json({
            mensaje: "Servicio dado de baja exitosamente",
            data: respuestaServicio(actualizado),
        });
    }),
];
