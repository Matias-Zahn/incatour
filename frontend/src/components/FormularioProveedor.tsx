import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Boton from "./Boton";
import {
    esquemaProveedor,
    type DatosProveedor,
    type Proveedor,
} from "../services/proveedorService";

type FormularioProveedorProps = {
    proveedorEnEdicion?: Proveedor | null;
    alGuardar: (datos: DatosProveedor) => void;
    alCancelar: () => void;
    guardando?: boolean;
    errorServidor?: string;
};

function FormularioProveedor({
    proveedorEnEdicion,
    alGuardar,
    alCancelar,
    guardando = false,
    errorServidor,
}: FormularioProveedorProps) {
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<DatosProveedor>({
        resolver: zodResolver(esquemaProveedor),
        defaultValues: {
            nombre: proveedorEnEdicion?.nombre ?? "",
            contacto: proveedorEnEdicion?.contacto ?? "",
        },
    });

    useEffect(() => {
        reset({
            nombre: proveedorEnEdicion?.nombre ?? "",
            contacto: proveedorEnEdicion?.contacto ?? "",
        });
    }, [proveedorEnEdicion, reset]);

    return (
        <form
            className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta"
            onSubmit={handleSubmit(alGuardar)}
        >
            <div className="mb-5">
                <h2 className="font-bold text-navegacion">
                    {proveedorEnEdicion
                        ? "Editar proveedor"
                        : "Registrar proveedor"}
                </h2>
                <p className="mt-1 text-sm text-texto-suave">
                    Ingresá los datos principales del proveedor.
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Nombre
                    <input
                        {...register("nombre")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.nombre
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                        placeholder="Ej. Andes Travel"
                        autoFocus
                    />
                    {errors.nombre ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.nombre.message}
                        </span>
                    ) : null}
                </label>

                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Correo de contacto
                    <input
                        {...register("contacto")}
                        className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${
                            errors.contacto
                                ? "border-peligro focus:border-peligro focus:ring-peligro/20"
                                : "border-borde focus:border-marca focus:ring-marca/20"
                        }`}
                        placeholder="contacto@proveedor.com"
                    />
                    {errors.contacto ? (
                        <span
                            className="text-xs font-normal text-peligro"
                            role="alert"
                        >
                            {errors.contacto.message}
                        </span>
                    ) : null}
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
                <Boton type="submit" disabled={guardando}>
                    {guardando
                        ? "Guardando..."
                        : proveedorEnEdicion
                          ? "Guardar cambios"
                          : "Registrar proveedor"}
                </Boton>
            </div>
        </form>
    );
}

export default FormularioProveedor;
