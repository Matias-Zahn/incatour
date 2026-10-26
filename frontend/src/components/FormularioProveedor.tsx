import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Boton from "./Boton";
import {
    esquemaProveedor,
    tiposProveedor,
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
        defaultValues: proveedorEnEdicion ?? {
            tipoProveedor: "ALOJAMIENTO",
            razonSocial: "",
            localidad: "",
            datosContacto: "",
            canalComunicacion: "",
            estado: "ACTIVO",
        },
    });

    useEffect(() => {
        reset(proveedorEnEdicion ?? {
            tipoProveedor: "ALOJAMIENTO",
            razonSocial: "",
            localidad: "",
            datosContacto: "",
            canalComunicacion: "",
            estado: "ACTIVO",
        });
    }, [proveedorEnEdicion, reset]);

    return (
        <form className="rounded-tarjeta border border-borde bg-white p-6 shadow-tarjeta" onSubmit={handleSubmit(alGuardar)}>
            <div className="mb-5">
                <h2 className="font-bold text-navegacion">
                    {proveedorEnEdicion ? "Editar proveedor" : "Registrar proveedor"}
                </h2>
                <p className="mt-1 text-sm text-texto-suave">Completá los datos del prestador.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-texto">
                    Tipo de proveedor
                    <select {...register("tipoProveedor")} className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20">
                        {tiposProveedor.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
                    </select>
                    {errors.tipoProveedor ? <span className="text-xs font-normal text-peligro" role="alert">{errors.tipoProveedor.message}</span> : null}
                </label>
                {([
                    ["razonSocial", "Razón social", "Ej. Andes Travel"],
                    ["localidad", "Localidad", "Ej. Cusco"],
                    ["datosContacto", "Datos de contacto", "correo o teléfono"],
                    ["canalComunicacion", "Canal de comunicación", "Ej. WhatsApp"],
                ] as const).map(([campo, etiqueta, placeholder]) => (
                    <label key={campo} className="grid gap-2 text-sm font-semibold text-texto">
                        {etiqueta}
                        <input {...register(campo)} placeholder={placeholder} className={`rounded-control border px-3 py-2 font-normal outline-none focus:ring-2 ${errors[campo] ? "border-peligro focus:ring-peligro/20" : "border-borde focus:border-marca focus:ring-marca/20"}`} />
                        {errors[campo] ? <span className="text-xs font-normal text-peligro" role="alert">{errors[campo]?.message}</span> : null}
                    </label>
                ))}
                {proveedorEnEdicion ? (
                    <label className="grid gap-2 text-sm font-semibold text-texto">
                        Estado
                        <select {...register("estado")} className="rounded-control border border-borde px-3 py-2 font-normal outline-none focus:border-marca focus:ring-2 focus:ring-marca/20">
                            <option value="ACTIVO">ACTIVO</option>
                            <option value="INACTIVO">INACTIVO</option>
                        </select>
                    </label>
                ) : null}
            </div>
            {errorServidor ? <p className="mt-3 text-sm text-peligro" role="alert">{errorServidor}</p> : null}
            <div className="mt-6 flex justify-end gap-3">
                <Boton type="button" variante="secundario" onClick={alCancelar} disabled={guardando}>Cancelar</Boton>
                <Boton type="submit" disabled={guardando}>{guardando ? "Guardando..." : proveedorEnEdicion ? "Guardar cambios" : "Registrar proveedor"}</Boton>
            </div>
        </form>
    );
}

export default FormularioProveedor;
