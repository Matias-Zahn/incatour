import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Boton from "./Boton";
import {
    esquemaCrearPersonal,
    esquemaModificarPersonal,
    rolesPersonal,
    type DatosCrearPersonal,
    type DatosModificarPersonal,
    type Personal,
} from "../services/personalService";

type FormularioPersonalProps = {
    personalEnEdicion?: Personal | null;
    alCrear: (datos: DatosCrearPersonal) => void;
    alModificar: (datos: DatosModificarPersonal) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

const valoresInicialesAlta: DatosCrearPersonal = {
    rolOperativo: "Guía",
    nombre: "",
    apellido: "",
    email: "",
    contrasenia: "",
    nroPasaporte: "",
    nacionalidad: "",
    fechaVencimientoPasaporte: "",
    nroHabilitacion: "",
    fechaHabilitacion: "",
};

function FormularioAltaPersonal({
    alCrear,
    alCancelar,
    guardando = false,
    errorServidor,
}: Pick<FormularioPersonalProps, "alCrear" | "alCancelar" | "guardando" | "errorServidor">) {
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<DatosCrearPersonal>({
        resolver: zodResolver(esquemaCrearPersonal),
        defaultValues: valoresInicialesAlta,
    });

    const rolSeleccionado = useWatch({ control, name: "rolOperativo" });

    return (
        <form
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
            onSubmit={handleSubmit(alCrear)}
        >
            <div className="mb-5">
                <h2 className="font-bold text-navegacion">Registrar personal operativo</h2>
                <p className="mt-1 text-sm text-texto-suave">
                    Completá el legajo del personal y, si es guía, sus credenciales de acceso y habilitación.
                </p>
                <p className="mt-2 rounded-control border border-borde bg-fondo px-3 py-2 text-xs text-texto-suave">
                    {rolSeleccionado === "Guía"
                        ? "Para un guía la habilitación es obligatoria. Podés crear su cuenta de acceso ahora completando email y contraseña, o registrar solo el legajo y crear la cuenta más adelante."
                        : "Los porteadores no requieren cuenta de acceso al sistema: solo se registrará su legajo operativo con pasaporte vigente."}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Rol operativo
                    <select
                        {...register("rolOperativo")}
                        className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20"
                    >
                        {rolesPersonal.map((rol) => (
                            <option key={rol} value={rol}>
                                {rol}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Nacionalidad
                    <input
                        {...register("nacionalidad")}
                        placeholder="Ej. Peruana"
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.nacionalidad
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.nacionalidad ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.nacionalidad.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Nombre
                    <input
                        {...register("nombre")}
                        placeholder="Ej. Carlos"
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.nombre
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.nombre ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.nombre.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Apellido
                    <input
                        {...register("apellido")}
                        placeholder="Ej. Mamani"
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.apellido
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.apellido ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.apellido.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Número de pasaporte
                    <input
                        {...register("nroPasaporte")}
                        placeholder="Ej. PE-9876543"
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.nroPasaporte
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.nroPasaporte ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.nroPasaporte.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Vencimiento del pasaporte
                    <input
                        type="date"
                        {...register("fechaVencimientoPasaporte")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.fechaVencimientoPasaporte
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.fechaVencimientoPasaporte ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.fechaVencimientoPasaporte.message}
                        </span>
                    ) : null}
                </label>

                {rolSeleccionado === "Guía" ? (
                    <>
                        <label className="grid gap-2 text-sm font-semibold text-texto">
                            Correo electrónico (cuenta de acceso - opcional)
                            <input
                                type="email"
                                {...register("email")}
                                placeholder="guia@incatour.com (opcional)"
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
                            Contraseña inicial (opcional)
                            <input
                                type="password"
                                {...register("contrasenia")}
                                placeholder="Mínimo 8 caracteres si se crea cuenta"
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
                            Número de habilitación
                            <input
                                {...register("nroHabilitacion")}
                                placeholder="Ej. HAB-001"
                                className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                                    errors.nroHabilitacion
                                        ? "border-peligro focus:ring-peligro/20"
                                        : "border-borde focus:border-marca focus:ring-marca/20"
                                }`}
                            />
                            {errors.nroHabilitacion ? (
                                <span className="text-xs font-normal text-peligro" role="alert">
                                    {errors.nroHabilitacion.message}
                                </span>
                            ) : null}
                        </label>

                        <label className="grid gap-2 text-sm font-semibold text-texto">
                            Vencimiento de habilitación
                            <input
                                type="date"
                                {...register("fechaHabilitacion")}
                                className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                                    errors.fechaHabilitacion
                                        ? "border-peligro focus:ring-peligro/20"
                                        : "border-borde focus:border-marca focus:ring-marca/20"
                                }`}
                            />
                            {errors.fechaHabilitacion ? (
                                <span className="text-xs font-normal text-peligro" role="alert">
                                    {errors.fechaHabilitacion.message}
                                </span>
                            ) : null}
                        </label>
                    </>
                ) : null}
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
                <Boton type="submit" disabled={guardando}>
                    {guardando ? "Guardando..." : "Registrar personal"}
                </Boton>
            </div>
        </form>
    );
}

function FormularioEdicionPersonal({
    personal,
    alModificar,
    alCancelar,
    guardando = false,
    errorServidor,
}: {
    personal: Personal;
    alModificar: (datos: DatosModificarPersonal) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
}) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<DatosModificarPersonal>({
        resolver: zodResolver(esquemaModificarPersonal),
        defaultValues: {
            nombreCompleto: personal.nombreCompleto,
            nroPasaporte: personal.nroPasaporte,
            nacionalidad: personal.nacionalidad,
            fechaVencimientoPasaporte: personal.fechaVencimientoPasaporte,
            nroHabilitacion: personal.guia?.nroHabilitacion ?? "",
            fechaHabilitacion: personal.guia?.fechaHabilitacion ?? "",
        },
    });

    useEffect(() => {
        reset({
            nombreCompleto: personal.nombreCompleto,
            nroPasaporte: personal.nroPasaporte,
            nacionalidad: personal.nacionalidad,
            fechaVencimientoPasaporte: personal.fechaVencimientoPasaporte,
            nroHabilitacion: personal.guia?.nroHabilitacion ?? "",
            fechaHabilitacion: personal.guia?.fechaHabilitacion ?? "",
        });
    }, [personal, reset]);

    return (
        <form
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
            onSubmit={handleSubmit(alModificar)}
        >
            <div className="mb-5">
                <h2 className="font-bold text-navegacion">Editar personal operativo</h2>
                <p className="mt-1 text-sm text-texto-suave">
                    Rol: <span className="font-semibold text-texto">{personal.rol}</span> · Actualizá los datos del legajo (el rol y el estado no pueden modificarse desde esta edición).
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Nombre completo
                    <input
                        {...register("nombreCompleto")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.nombreCompleto
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.nombreCompleto ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.nombreCompleto.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Nacionalidad
                    <input
                        {...register("nacionalidad")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.nacionalidad
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.nacionalidad ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.nacionalidad.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Número de pasaporte
                    <input
                        {...register("nroPasaporte")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.nroPasaporte
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.nroPasaporte ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.nroPasaporte.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Vencimiento del pasaporte
                    <input
                        type="date"
                        {...register("fechaVencimientoPasaporte")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.fechaVencimientoPasaporte
                                ? "border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                    />
                    {errors.fechaVencimientoPasaporte ? (
                        <span className="text-xs font-normal text-peligro" role="alert">
                            {errors.fechaVencimientoPasaporte.message}
                        </span>
                    ) : null}
                </label>

                {personal.rol === "Guía" ? (
                    <>
                        <label className="grid gap-2 text-sm font-semibold text-texto">
                            Número de habilitación
                            <input
                                {...register("nroHabilitacion")}
                                className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                                    errors.nroHabilitacion
                                        ? "border-peligro focus:ring-peligro/20"
                                        : "border-borde focus:border-marca focus:ring-marca/20"
                                }`}
                            />
                            {errors.nroHabilitacion ? (
                                <span className="text-xs font-normal text-peligro" role="alert">
                                    {errors.nroHabilitacion.message}
                                </span>
                            ) : null}
                        </label>

                        <label className="grid gap-2 text-sm font-semibold text-texto">
                            Vencimiento de habilitación
                            <input
                                type="date"
                                {...register("fechaHabilitacion")}
                                className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                                    errors.fechaHabilitacion
                                        ? "border-peligro focus:ring-peligro/20"
                                        : "border-borde focus:border-marca focus:ring-marca/20"
                                }`}
                            />
                            {errors.fechaHabilitacion ? (
                                <span className="text-xs font-normal text-peligro" role="alert">
                                    {errors.fechaHabilitacion.message}
                                </span>
                            ) : null}
                        </label>
                    </>
                ) : null}
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
                <Boton type="submit" disabled={guardando}>
                    {guardando ? "Guardando..." : "Guardar cambios"}
                </Boton>
            </div>
        </form>
    );
}

function FormularioPersonal({
    personalEnEdicion,
    alCrear,
    alModificar,
    alCancelar,
    guardando = false,
    errorServidor,
}: FormularioPersonalProps) {
    if (personalEnEdicion) {
        return (
            <FormularioEdicionPersonal
                personal={personalEnEdicion}
                alModificar={alModificar}
                alCancelar={alCancelar}
                guardando={guardando}
                errorServidor={errorServidor}
            />
        );
    }

    return (
        <FormularioAltaPersonal
            alCrear={alCrear}
            alCancelar={alCancelar}
            guardando={guardando}
            errorServidor={errorServidor}
        />
    );
}

export default FormularioPersonal;
