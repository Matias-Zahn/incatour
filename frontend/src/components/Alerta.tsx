import type { ReactNode } from "react";

type AlertaTipo = "informacion" | "exito" | "advertencia" | "error";

type AlertaProps = {
    tipo?: AlertaTipo;
    titulo?: string;
    children: ReactNode;
};

const estilosPorTipo: Record<AlertaTipo, string> = {
    informacion: "border-marca/30 bg-marca-suave text-texto",
    exito: "border-exito/30 bg-exito/15 text-texto",
    advertencia: "border-advertencia/30 bg-advertencia/15 text-texto",
    error: "border-peligro/30 bg-peligro/10 text-texto",
};

function Alerta({
    tipo = "informacion",
    titulo,
    children,
}: AlertaProps) {
    return (
        <div
            role={tipo === "error" ? "alert" : "status"}
            className={`rounded-control border p-4 text-sm ${estilosPorTipo[tipo]}`}
        >
            {titulo ? <p className="mb-1 font-semibold">{titulo}</p> : null}
            <div>{children}</div>
        </div>
    );
}

export default Alerta;
