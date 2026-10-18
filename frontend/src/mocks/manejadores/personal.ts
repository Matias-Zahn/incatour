import { delay, http, HttpResponse } from "msw";
import { construirUrl } from "../../services/clienteApi";
import type { CuentaGuia, SituacionHabilitacion } from "../../services/cuentaGuiaService";
import {
    esquemaCrearPersonal,
    esquemaModificarPersonal,
    type DatosCrearPersonal,
    type DatosModificarPersonal,
    type Personal,
} from "../../services/personalService";
import { cuentasGuiaSemilla, personalSemilla } from "../datos/personal";

let listaPersonal: Personal[] = [...personalSemilla];
let cuentasGuia: CuentaGuia[] = [...cuentasGuiaSemilla];

function calcularSituacionHabilitacion(fecha: string | null | undefined): SituacionHabilitacion {
    if (!fecha) return "SIN_DATOS";
    const fechaHab = new Date(fecha);
    if (Number.isNaN(fechaHab.getTime())) return "SIN_DATOS";
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return fechaHab >= hoy ? "VIGENTE" : "VENCIDA";
}

function serializarPersonal(item: Personal) {
    return {
        idpersonal: item.idpersonal,
        nombreCompleto: item.nombreCompleto,
        nroPasaporte: item.nroPasaporte,
        nacionalidad: item.nacionalidad,
        fechaVencimientoPasaporte: item.fechaVencimientoPasaporte,
        estado: item.estado,
        rol: item.rol,
        guia:
            item.rol === "Guía" && item.guia
                ? {
                      nroHabilitacion: item.guia.nroHabilitacion,
                      fechaHabilitacion: item.guia.fechaHabilitacion,
                  }
                : null,
    };
}

export const manejadoresPersonal = [
    http.get(construirUrl("/personal"), async ({ request }) => {
        await delay();
        const url = new URL(request.url, window.location.origin);
        const rol = url.searchParams.get("rol");
        const estado = url.searchParams.get("estado");
        const habilitacionVigente = url.searchParams.get("habilitacionVigente");

        const filtrados = listaPersonal
            .filter((persona) => {
                if (rol && persona.rol !== rol) return false;
                if (estado && persona.estado !== estado) return false;
                if (habilitacionVigente !== null && habilitacionVigente !== "") {
                    if (persona.rol !== "Guía" || !persona.guia) return false;
                    const vigente =
                        calcularSituacionHabilitacion(persona.guia.fechaHabilitacion) === "VIGENTE";
                    if (habilitacionVigente === "true" && !vigente) return false;
                    if (habilitacionVigente === "false" && vigente) return false;
                }
                return true;
            })
            .sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));

        return HttpResponse.json({
            data: filtrados.map(serializarPersonal),
        });
    }),

    http.post(construirUrl("/personal"), async ({ request }) => {
        await delay();
        const cuerpo = (await request.json()) as DatosCrearPersonal;
        const validacion = esquemaCrearPersonal.safeParse(cuerpo);
        if (!validacion.success) {
            return HttpResponse.json(
                { error: validacion.error.issues[0]?.message ?? "Datos inválidos." },
                { status: 400 },
            );
        }

        const datos = validacion.data;
        const pasaporteDuplicado = listaPersonal.some(
            (persona) => persona.nroPasaporte.toLowerCase() === datos.nroPasaporte.toLowerCase(),
        );
        if (pasaporteDuplicado) {
            return HttpResponse.json(
                { error: "Este número de pasaporte ya está registrado en la base de datos" },
                { status: 400 },
            );
        }

        if (datos.rolOperativo === "Guía" && datos.email) {
            const emailDuplicado = cuentasGuia.some(
                (cuenta) => cuenta.email.toLowerCase() === datos.email!.toLowerCase(),
            );
            if (emailDuplicado) {
                return HttpResponse.json(
                    { error: "El email ya está registrado en el sistema" },
                    { status: 400 },
                );
            }
        }

        const nuevoIdPersonal =
            Math.max(0, ...listaPersonal.map((persona) => persona.idpersonal)) + 1;
        const nombreCompleto = `${datos.nombre} ${datos.apellido}`.trim();

        const nuevoPersonal: Personal = {
            id: nuevoIdPersonal,
            idpersonal: nuevoIdPersonal,
            nombreCompleto,
            nroPasaporte: datos.nroPasaporte,
            nacionalidad: datos.nacionalidad,
            fechaVencimientoPasaporte: datos.fechaVencimientoPasaporte,
            estado: "ACTIVO",
            rol: datos.rolOperativo,
            guia:
                datos.rolOperativo === "Guía"
                    ? {
                          nroHabilitacion: datos.nroHabilitacion ?? "",
                          fechaHabilitacion: datos.fechaHabilitacion ?? "",
                      }
                    : null,
            nroHabilitacion: datos.rolOperativo === "Guía" ? datos.nroHabilitacion : undefined,
            fechaHabilitacion: datos.rolOperativo === "Guía" ? datos.fechaHabilitacion : undefined,
        };

        listaPersonal = [...listaPersonal, nuevoPersonal];

        let credencialesAcceso = null;
        if (datos.rolOperativo === "Guía") {
            const nuevoIdUsuario =
                Math.max(3, ...cuentasGuia.map((cuenta) => cuenta.idusuario)) + 1;
            const fechaHab = datos.fechaHabilitacion ?? null;
            const nuevaCuenta: CuentaGuia = {
                id: nuevoIdUsuario,
                idusuario: nuevoIdUsuario,
                email: datos.email!.toLowerCase(),
                nombre: datos.nombre,
                apellido: datos.apellido,
                rol: "GUIA",
                estado: "ACTIVO",
                creadoEn: new Date().toISOString(),
                guia: {
                    idpersonal: nuevoIdPersonal,
                    nombreCompleto,
                    nroPasaporte: datos.nroPasaporte,
                    estadoPersonal: "ACTIVO",
                },
                habilitacion: {
                    nroHabilitacion: datos.nroHabilitacion ?? null,
                    fechaHabilitacion: fechaHab,
                    situacion: calcularSituacionHabilitacion(fechaHab),
                },
                salidasPendientes: 0,
                puedeDarseDeBaja: true,
            };
            cuentasGuia = [...cuentasGuia, nuevaCuenta];
            credencialesAcceso = {
                idusuario: nuevoIdUsuario,
                email: nuevaCuenta.email,
                nombre: nuevaCuenta.nombre,
                apellido: nuevaCuenta.apellido,
                rol: "GUIA",
                estado: "ACTIVO" as const,
            };
        }

        return HttpResponse.json(
            {
                mensaje: "Personal registrado exitosamente",
                perfilOperativo: serializarPersonal(nuevoPersonal),
                credencialesAcceso,
            },
            { status: 201 },
        );
    }),

    http.put(construirUrl("/personal/:id"), async ({ params, request }) => {
        await delay();
        const id = Number(params.id);
        const existente = listaPersonal.find((persona) => persona.idpersonal === id);
        if (!existente) {
            return HttpResponse.json({ error: "El personal no existe" }, { status: 404 });
        }
        if (existente.estado !== "ACTIVO") {
            return HttpResponse.json(
                { error: "No se puede modificar personal dado de baja" },
                { status: 400 },
            );
        }

        const cuerpo = (await request.json()) as Partial<DatosModificarPersonal>;
        const validacion = esquemaModificarPersonal.partial().safeParse(cuerpo);
        if (!validacion.success || Object.keys(cuerpo).length === 0) {
            return HttpResponse.json(
                {
                    error: validacion.success
                        ? "No se envió ningún dato para modificar"
                        : validacion.error.issues[0]?.message ?? "Datos inválidos.",
                },
                { status: 400 },
            );
        }

        const datos = validacion.data;
        if ((datos.nroHabilitacion || datos.fechaHabilitacion) && existente.rol !== "Guía") {
            return HttpResponse.json(
                { error: "La habilitación solo corresponde a un guía" },
                { status: 400 },
            );
        }

        if (
            datos.nroPasaporte &&
            datos.nroPasaporte.toLowerCase() !== existente.nroPasaporte.toLowerCase()
        ) {
            const duplicado = listaPersonal.some(
                (persona) =>
                    persona.idpersonal !== id &&
                    persona.nroPasaporte.toLowerCase() === datos.nroPasaporte!.toLowerCase(),
            );
            if (duplicado) {
                return HttpResponse.json(
                    { error: "Este número de pasaporte ya está registrado" },
                    { status: 400 },
                );
            }
        }

        const nuevaGuia =
            existente.rol === "Guía"
                ? {
                      nroHabilitacion:
                          datos.nroHabilitacion ?? existente.guia?.nroHabilitacion ?? "",
                      fechaHabilitacion:
                          datos.fechaHabilitacion ?? existente.guia?.fechaHabilitacion ?? "",
                  }
                : null;

        const actualizado: Personal = {
            ...existente,
            nombreCompleto: datos.nombreCompleto ?? existente.nombreCompleto,
            nroPasaporte: datos.nroPasaporte ?? existente.nroPasaporte,
            nacionalidad: datos.nacionalidad ?? existente.nacionalidad,
            fechaVencimientoPasaporte:
                datos.fechaVencimientoPasaporte ?? existente.fechaVencimientoPasaporte,
            guia: nuevaGuia,
            nroHabilitacion: nuevaGuia?.nroHabilitacion,
            fechaHabilitacion: nuevaGuia?.fechaHabilitacion,
        };

        listaPersonal = listaPersonal.map((persona) =>
            persona.idpersonal === id ? actualizado : persona,
        );

        if (actualizado.rol === "Guía") {
            cuentasGuia = cuentasGuia.map((cuenta) => {
                if (cuenta.guia.idpersonal !== id) return cuenta;
                const fechaHab = actualizado.guia?.fechaHabilitacion ?? null;
                return {
                    ...cuenta,
                    guia: {
                        ...cuenta.guia,
                        nombreCompleto: actualizado.nombreCompleto,
                        nroPasaporte: actualizado.nroPasaporte,
                    },
                    habilitacion: {
                        nroHabilitacion: actualizado.guia?.nroHabilitacion ?? null,
                        fechaHabilitacion: fechaHab,
                        situacion: calcularSituacionHabilitacion(fechaHab),
                    },
                };
            });
        }

        return HttpResponse.json({
            mensaje: "Personal modificado exitosamente",
            data: serializarPersonal(actualizado),
        });
    }),

    http.patch(construirUrl("/personal/:id/baja"), async ({ params }) => {
        await delay();
        const id = Number(params.id);
        const existente = listaPersonal.find((persona) => persona.idpersonal === id);
        if (!existente) {
            return HttpResponse.json({ error: "El personal no existe" }, { status: 404 });
        }
        if (existente.estado !== "ACTIVO") {
            return HttpResponse.json(
                { error: "El personal ya está dado de baja" },
                { status: 400 },
            );
        }

        const cuentaAsociada = cuentasGuia.find((cuenta) => cuenta.guia.idpersonal === id);
        if (cuentaAsociada && cuentaAsociada.salidasPendientes > 0) {
            return HttpResponse.json(
                {
                    error: `No se puede dar de baja: está asignado a ${cuentaAsociada.salidasPendientes} salida(s) que todavía no finalizaron`,
                },
                { status: 400 },
            );
        }

        const actualizado: Personal = { ...existente, estado: "INACTIVO" };
        listaPersonal = listaPersonal.map((persona) =>
            persona.idpersonal === id ? actualizado : persona,
        );

        if (cuentaAsociada) {
            cuentasGuia = cuentasGuia.map((cuenta) =>
                cuenta.guia.idpersonal === id
                    ? {
                          ...cuenta,
                          estado: "INACTIVO",
                          puedeDarseDeBaja: false,
                          guia: { ...cuenta.guia, estadoPersonal: "INACTIVO" },
                      }
                    : cuenta,
            );
        }

        return HttpResponse.json({
            mensaje: "Personal dado de baja exitosamente",
            data: serializarPersonal(actualizado),
        });
    }),

    http.get(construirUrl("/cuentas-guia"), async ({ request }) => {
        await delay();
        const url = new URL(request.url, window.location.origin);
        const rol = url.searchParams.get("rol");
        const estado = url.searchParams.get("estado");
        const habilitacion = url.searchParams.get("habilitacion");
        const busqueda = url.searchParams.get("busqueda")?.trim().toLowerCase();

        const filtradas = cuentasGuia.filter((cuenta) => {
            if (rol && cuenta.rol !== rol) return false;
            if (estado && cuenta.estado !== estado) return false;
            if (habilitacion && cuenta.habilitacion.situacion !== habilitacion) return false;
            if (busqueda) {
                const coincide =
                    cuenta.nombre.toLowerCase().includes(busqueda) ||
                    cuenta.apellido.toLowerCase().includes(busqueda) ||
                    cuenta.email.toLowerCase().includes(busqueda) ||
                    cuenta.guia.nombreCompleto.toLowerCase().includes(busqueda);
                if (!coincide) return false;
            }
            return true;
        });

        return HttpResponse.json({ data: filtradas });
    }),

    http.patch(construirUrl("/cuentas-guia/:idusuario/baja"), async ({ params }) => {
        await delay();
        const idusuario = Number(params.idusuario);
        const cuenta = cuentasGuia.find((item) => item.idusuario === idusuario);
        if (!cuenta) {
            return HttpResponse.json(
                { error: `No se encontró una cuenta de guía con ID de usuario ${idusuario}.` },
                { status: 404 },
            );
        }
        if (cuenta.estado === "INACTIVO") {
            return HttpResponse.json(
                { error: "La cuenta ya se encuentra dada de baja." },
                { status: 400 },
            );
        }
        if (cuenta.salidasPendientes > 0) {
            return HttpResponse.json(
                {
                    error: `No se puede dar de baja la cuenta: el guía está asignado a ${cuenta.salidasPendientes} salida(s) cuyo recorrido no finalizó.`,
                },
                { status: 400 },
            );
        }

        const actualizada: CuentaGuia = {
            ...cuenta,
            estado: "INACTIVO",
            puedeDarseDeBaja: false,
        };
        cuentasGuia = cuentasGuia.map((item) =>
            item.idusuario === idusuario ? actualizada : item,
        );

        return HttpResponse.json({
            mensaje: "Cuenta de guía dada de baja exitosamente",
            data: actualizada,
        });
    }),
];
