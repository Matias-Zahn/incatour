import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Alerta from "../../components/Alerta";
import Boton from "../../components/Boton";
import DialogoConfirmacion from "../../components/DialogoConfirmacion";
import EstadoListado from "../../components/EstadoListado";
import FormularioServicio from "../../components/FormularioServicio";
import Tabla from "../../components/Tabla";
import { useProveedores } from "../../services/proveedorService";
import {
    useDarDeBajaServicio,
    useModificarServicio,
    useRegistrarServicio,
    useServicios,
    type DatosServicio,
    type Servicio,
} from "../../services/servicioService";

function ServiciosPage() {
    const idProveedor = Number(useParams().idProveedor);
    const proveedor = useProveedores().data?.find((item) => item.idproveedor === idProveedor);
    const { data: servicios = [], isPending, isError, error } = useServicios(idProveedor);
    const registrar = useRegistrarServicio(idProveedor);
    const modificar = useModificarServicio(idProveedor);
    const darDeBaja = useDarDeBajaServicio(idProveedor);
    const [formularioAbierto, setFormularioAbierto] = useState(false);
    const [servicioEnEdicion, setServicioEnEdicion] = useState<Servicio | null>(null);
    const [seleccionado, setSeleccionado] = useState<Servicio | null>(null);
    const tipoProveedor = proveedor?.tipoProveedor ?? "ALOJAMIENTO";

    function guardar(datos: DatosServicio) {
        const opciones = { onSuccess: () => { setFormularioAbierto(false); setServicioEnEdicion(null); } };
        if (servicioEnEdicion) modificar.mutate({ id: servicioEnEdicion.idservicio, datos }, opciones);
        else registrar.mutate(datos, opciones);
    }

    const estado = isPending ? "cargando" : isError ? "error" : "exito";
    return (
        <section className="mx-auto max-w-7xl space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <Link to="/gestion/proveedores" className="text-sm font-semibold text-marca hover:underline">← Volver a proveedores</Link>
                    <p className="mb-1 mt-3 text-sm font-semibold uppercase tracking-wide text-texto-suave">Gestión de servicios</p>
                    <h1 className="text-3xl font-bold text-navegacion">{proveedor?.razonSocial ?? "Servicios"}</h1>
                    <p className="mt-2 text-sm text-texto-suave">Rubro: {tipoProveedor}</p>
                </div>
                <Boton onClick={() => { setServicioEnEdicion(null); setFormularioAbierto(true); }}>Nuevo servicio</Boton>
            </header>
            {formularioAbierto ? <FormularioServicio tipoProveedor={tipoProveedor} servicioEnEdicion={servicioEnEdicion} alGuardar={guardar} alCancelar={() => setFormularioAbierto(false)} guardando={registrar.isPending || modificar.isPending} errorServidor={(registrar.error ?? modificar.error)?.message} /> : null}
            {darDeBaja.isError ? (
                <Alerta tipo="error" titulo="No se pudo dar de baja el servicio">
                    {darDeBaja.error.message}
                </Alerta>
            ) : null}
            {estado !== "exito" ? <EstadoListado estado={estado} mensaje={estado === "error" ? error?.message : undefined} /> : servicios.length === 0 ? <EstadoListado estado="vacio" mensaje="Todavía no hay servicios registrados para este proveedor." /> : (
                <div className="overflow-x-auto">
                    <Tabla filas={servicios.map((servicio) => ({ ...servicio, id: servicio.idservicio }))} columnas={[
                        { clave: "nombreServicio", titulo: "Servicio" },
                        { clave: "localidad", titulo: "Localidad" },
                        { clave: "costoBase", titulo: "Costo base" },
                        { clave: "estado", titulo: "Estado" },
                        { clave: "id", titulo: "Acciones", renderizar: (servicio) => <div className="flex gap-2"><Boton variante="fantasma" className="px-3 py-1.5 text-xs" onClick={() => { setServicioEnEdicion(servicio); setFormularioAbierto(true); }}>Editar</Boton><Boton variante="peligro" className="px-3 py-1.5 text-xs" onClick={() => setSeleccionado(servicio)} disabled={servicio.estado === "INACTIVO"}>Dar de baja</Boton></div> },
                    ]} />
                </div>
            )}
            <DialogoConfirmacion abierto={seleccionado !== null} titulo="Confirmar baja de servicio" descripcion={seleccionado ? `¿Querés dar de baja a ${seleccionado.nombreServicio}?` : ""} textoConfirmar={darDeBaja.isPending ? "Procesando..." : "Dar de baja"} cargando={darDeBaja.isPending} onCancelar={() => setSeleccionado(null)} onConfirmar={() => { if (seleccionado) darDeBaja.mutate(seleccionado.idservicio, { onSuccess: () => setSeleccionado(null) }); }} />
        </section>
    );
}

export default ServiciosPage;
