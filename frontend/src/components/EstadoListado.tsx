type EstadoListadoProps = {
    estado: "cargando" | "vacio" | "error";
    mensaje?: string;
};

function EstadoListado({ estado, mensaje }: EstadoListadoProps) {
    if (estado === "cargando") {
        return (
            <div className="rounded-tarjeta border border-borde bg-white p-6 text-center text-texto-suave">
                Cargando información...
            </div>
        );
    }

    if (estado === "vacio") {
        return (
            <div className="rounded-tarjeta border border-dashed border-borde bg-fondo p-6 text-center text-texto-suave">
                {mensaje ?? "No hay resultados para mostrar."}
            </div>
        );
    }

    return (
        <div
            role="alert"
            className="rounded-tarjeta border border-peligro/30 bg-peligro/10 p-6 text-center text-peligro"
        >
            {mensaje ?? "No se pudo cargar la información."}
        </div>
    );
}

export default EstadoListado;
