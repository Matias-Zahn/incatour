import { z } from "zod";

export const TARJETA_VACIA = { numero: "", titular: "", vencimiento: "", cvv: "" };

/** Reglas de la compra (CU-30): dependen de la salida elegida, por eso el esquema se arma con su fin y su cupo */
export function crearEsquemaCompra(fechaFin: string, cupo: number, fechaFinTexto: string) {
    const pasajero = z.object({
        nombreCompleto: z.string().trim().min(1, "Completá el nombre y apellido."),
        nroPasaporte: z.string().trim().min(1, "Completá el número de pasaporte."),
        nacionalidad: z.string().trim().min(1, "Completá la nacionalidad."),
        fechaVencimientoPasaporte: z
            .string()
            .min(1, "Indicá el vencimiento del pasaporte.")
            .refine((f) => new Date(f) > new Date(fechaFin), `Tiene que vencer después del ${fechaFinTexto}.`),
    });

    return z.object({
        pasajeros: z
            .array(pasajero)
            .max(cupo, `Esta salida tiene ${cupo} ${cupo === 1 ? "lugar disponible" : "lugares disponibles"}.`)
            .superRefine((lista, ctx) => {
                const vistos = new Set<string>();
                lista.forEach((p, i) => {
                    const pasaporte = p.nroPasaporte.toUpperCase();
                    if (pasaporte && vistos.has(pasaporte)) {
                        ctx.addIssue({ code: "custom", path: [i, "nroPasaporte"], message: "Este pasaporte está repetido en la nómina." });
                    }
                    vistos.add(pasaporte);
                });
            }),
        tarjeta: z.object({
            numero: z
                .string()
                .transform((v) => v.replace(/\s+/g, ""))
                .refine((v) => v.length >= 12, "Ingresá un número de tarjeta válido."),
            titular: z.string().trim().min(1, "Ingresá el nombre del titular.").toUpperCase(),
            vencimiento: z.string().trim().regex(/^\d{2}\/\d{2}$/, "Usá el formato MM/AA (ej. 11/29)."),
            cvv: z.string().trim().min(3, "Ingresá el código de seguridad."),
        }),
    });
}

export type FormularioCompra = z.input<ReturnType<typeof crearEsquemaCompra>>;
export type DatosCompra = z.output<ReturnType<typeof crearEsquemaCompra>>;
