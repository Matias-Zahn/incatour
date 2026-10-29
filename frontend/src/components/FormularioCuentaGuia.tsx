import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Boton from "./Boton";
import {
    esquemaCrearCuentaGuia,
    type DatosCrearCuentaGuia,
} from "../services/cuentaGuiaService";
import type { Personal } from "../services/personalService";

type FormularioCuentaGuiaProps = {
    guiasDisponibles: Personal[];
    cargandoGuias?: boolean;
    alCrear: (datos: DatosCrearCuentaGuia) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

function FormularioCuentaGuia({
    guiasDisponibles,
    cargandoGuias = false,
    alCrear,
    alCancelar,
    guardando = false,
    errorServidor,
}: FormularioCuentaGuiaProps) {
    const {
        register,
        handleSubmit,
        control,
        setValue,
        formState: { errors },
    } = useForm<DatosCrearCuentaGuia>({
        resolver: zodResolver(esquemaCrearCuentaGuia),
        defaultValues: {
            idpersonal: undefined,
            email: "",
            contrasenia: "",
            nroHabilitacion: "",
            fechaHabilitacion: "",
        },
    });

    const idpersonalSeleccionado = useWatch({ control, name: "idpersonal" });
    const guiaSeleccionado = guiasDisponibles.find(
        (g) => g.idpersonal === Number(idpersonalSeleccionado),
    );

    useEffect(() => {
        if (guiaSeleccionado) {
            if (guiaSeleccionado.guia?.nroHabilitacion) {
                setValue("nroHabilitacion", guiaSeleccionado.guia.nroHabilitacion);
            }
            if (guiaSeleccionado.guia?.fechaHabilitacion) {
                setValue("fechaHabilitacion", guiaSeleccionado.guia.fechaHabilitacion);
            }
        }
    }, [guiaSeleccionado, setValue]);

    const sinGuias = !cargandoGuias && guiasDisponibles.length === 0;

    return (
        <form
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
            onSubmit={handleSubmit(alCrear)}
        >
            <div className="mb-5">
                <h2 className="font-bold text-navegacion">Alta de cuenta de acceso para guía</h2>
                <p className="mt-1 text-sm text-texto-suave">
                    Asigná credenciales de acceso al sistema para un guía registrado previamente en el personal operativo.
                </p>
                {sinGuias ? (
                    <p className="mt-2 rounded-control border border-borde bg-fondo px-3 py-2 text-xs text-texto-suave">
                        No hay guías activos pendientes de asignación de cuenta. Todos los guías registrados ya disponen de una cuenta de acceso.
                    </p>
                ) : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-texto md:col-span-2">
                    Personal guía operativo
                    <select
                        {...register("idpersonal", { valueAsNumber: true })}
                        disabled={guardando || cargandoGuias || sinGuias}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.idpersonal
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    >
                        <option value="">
                            {cargandoGuias
                                ? "Cargando guías disponibles..."
                                : sinGuias
                                  ? "No hay guías disponibles sin cuenta"
                                  : "Seleccioná un guía..."}
                        </option>
                        {guiasDisponibles.map((guia) => (
                            <option key={guia.idpersonal} value={guia.idpersonal}>
                                {guia.nombreCompleto} — Pasaporte: {guia.nroPasaporte}
                            </option>
                        ))}
                    </select>
                    {errors.idpersonal ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.idpersonal.message}
                        </span>
                    ) : null}
                </label>

                {guiaSeleccionado ? (
                    <div className="rounded-control border border-borde bg-fondo p-3 text-xs text-texto md:col-span-2">
                        <p className="font-semibold text-navegacion">Legajo seleccionado:</p>
                        <p className="mt-1 text-texto-suave">
                            {guiaSeleccionado.nombreCompleto} · Pasaporte: {guiaSeleccionado.nroPasaporte} · Nacionalidad: {guiaSeleccionado.nacionalidad} · Vence pasaporte: {guiaSeleccionado.fechaVencimientoPasaporte}
                        </p>
                    </div>
                ) : null}

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Correo electrónico (usuario de acceso)
                    <input
                        type="email"
                        {...register("email")}
                        placeholder="ejemplo.guia@incatour.com"
                        disabled={guardando || sinGuias}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.email
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.email ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.email.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Contraseña inicial
                    <input
                        type="password"
                        {...register("contrasenia")}
                        placeholder="Mínimo 8 caracteres"
                        disabled={guardando || sinGuias}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.contrasenia
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.contrasenia ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.contrasenia.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Número de habilitación (opcional)
                    <input
                        type="text"
                        {...register("nroHabilitacion")}
                        placeholder="Ej. HAB-001"
                        disabled={guardando || sinGuias}
                        className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Vencimiento de habilitación (opcional)
                    <input
                        type="date"
                        {...register("fechaHabilitacion")}
                        disabled={guardando || sinGuias}
                        className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    />
                </label>
            </div>

            {errorServidor ? (
                <p className="mt-3 text-sm text-peligro" role="alert">
                    {errorServidor}
                </p>
            ) : null}

            <div className="mt-6 flex justify-end gap-3">
                <Boton
                    type="button"
                    variante="secundario"
                    onClick={alCancelar}
                    disabled={guardando}
                >
                    Cancelar
                </Boton>
                <Boton type="submit" disabled={guardando || sinGuias}>
                    {guardando ? "Creando cuenta..." : "Crear cuenta de guía"}
                </Boton>
            </div>
        </form>
    );
}

export default FormularioCuentaGuia;
