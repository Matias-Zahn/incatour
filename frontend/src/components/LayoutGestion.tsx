import type { ReactNode } from "react";
import BarraLateral from "./BarraLateral";
import BarraSuperior from "./BarraSuperior";

type LayoutGestionProps = {
    seccion: string;
    children: ReactNode;
};

function LayoutGestion({ seccion, children }: LayoutGestionProps) {
    return (
        <div className="flex min-h-screen bg-fondo">
            <BarraLateral seccionActiva={seccion} />
            <div className="min-w-0 flex-1">
                <BarraSuperior seccion={seccion} />
                <main className="p-8">{children}</main>
            </div>
        </div>
    );
}

export default LayoutGestion;
