import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import { esquemaServicio, type DatosServicio, type Servicio } from "../../services/servicioService";
import { serviciosSemilla } from "../datos/servicios";

let servicios: Servicio[] = [...serviciosSemilla];

function respuestaServicio(servicio: Servicio) {
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
    };
    const datos = Object.fromEntries(
        Object.entries(campos).filter(([, valor]) => valor !== undefined),
    );
    const disponibilidad =
        tipo === "EQUIPAMIENTO"
            ? {
                  cantidadDisponible: servicio.cantidadDisponible ?? 0,
                  cantidadComprometida: servicio.cantidadComprometida ?? 0,
                  inventarioTotal:
                      servicio.inventarioTotal ??
                      (servicio.cantidadDisponible ?? 0) +
                          (servicio.cantidadComprometida ?? 0),
              }
            : tipo === "ALOJAMIENTO"
              ? {
                    capacidadDisponible: servicio.capacidadDisponible ?? 0,
                    modalidadConfirmacion: servicio.modalidadConfirmacion ?? "",
                }
              : tipo === "TRANSPORTE"
                ? { capacidadVehiculo: servicio.capacidadVehiculo ?? 0 }
                : { diasOperacion: servicio.diasOperacion ?? "" };

    return {
        idservicio,
        idproveedor,
        tipo,
        nombreServicio,
        descripcion,
        costoBase,
        localidad,
        estado,
        proveedor: { razonSocial: `Proveedor ${idproveedor}` },
        datos,
        disponibilidad,
    };
}

export const manejadoresServicios = [
    http.get(construirUrl("/proveedores/:idproveedor/servicios"), async ({ params }) => {
        await delay();
        const idProveedor = Number(params.idproveedor);
        return HttpResponse.json({
            data: servicios
                .filter((servicio) => servicio.idproveedor === idProveedor)
                .map(respuestaServicio),
        });
    }),
    http.get(construirUrl("/servicios/:id"), async ({ params }) => {
        await delay();
        const id = Number(params.id);
        const servicio = servicios.find((item) => item.idservicio === id);
        if (!servicio) {
            return HttpResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
        }
        return HttpResponse.json({ data: respuestaServicio(servicio) });
    }),
    http.post(construirUrl("/proveedores/:idproveedor/servicios"), async ({ params, request }) => {
        await delay();
        const cuerpo = (await request.json()) as DatosServicio;
        const validacion = esquemaServicio.safeParse(cuerpo);
        if (!validacion.success) {
            return HttpResponse.json(
                { error: validacion.error.issues[0]?.message ?? "Datos inválidos." },
                { status: 400 },
            );
        }
        const datos = validacion.data;
        const id = Math.max(0, ...servicios.map((servicio) => servicio.id)) + 1;
        const idproveedor = Number(params.idproveedor);
        const nuevo: Servicio = { ...datos, id, idservicio: id, idproveedor, estado: "ACTIVO" };
        servicios = [...servicios, nuevo];
        return HttpResponse.json(
            { mensaje: "Servicio registrado exitosamente", data: respuestaServicio(nuevo) },
            { status: 201 },
        );
    }),
    http.put(construirUrl("/servicios/:id"), async ({ params, request }) => {
        await delay();
        const id = Number(params.id);
        const existente = servicios.find((servicio) => servicio.id === id);
        if (!existente) return HttpResponse.json({ mensaje: "Servicio no encontrado." }, { status: 404 });
        const datos = (await request.json()) as Partial<DatosServicio>;
        const actualizado = {
            ...existente,
            ...datos,
            ...(datos.inventarioTotal !== undefined
                ? {
                      inventarioTotal: datos.inventarioTotal,
                      cantidadDisponible: datos.inventarioTotal,
                  }
                : {}),
        };
        servicios = servicios.map((servicio) => servicio.id === id ? actualizado : servicio);
        return HttpResponse.json({
            mensaje: "Servicio modificado exitosamente",
            data: respuestaServicio(actualizado),
        });
    }),
    http.patch(construirUrl("/servicios/:id/baja"), async ({ params }) => {
        await delay();
        const id = Number(params.id);
        const existente = servicios.find((servicio) => servicio.id === id);
        if (!existente) return HttpResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
        if (existente.estado === "INACTIVO") {
            return HttpResponse.json(
                { error: "El servicio ya se encuentra dado de baja." },
                { status: 400 },
            );
        }
        const actualizado = { ...existente, estado: "INACTIVO" as const };
        servicios = servicios.map((servicio) => servicio.id === id ? actualizado : servicio);
        return HttpResponse.json({
            mensaje: "Servicio dado de baja exitosamente",
            data: respuestaServicio(actualizado),
        });
    }),
];
