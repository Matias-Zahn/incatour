import { useEffect, type ReactNode } from "react";
import BarraLateral from "./BarraLateral";
import BarraSuperior from "./BarraSuperior";
import LimiteDeError from "./LimiteDeError";

type LayoutGestionProps = {
    seccion: string;
    children: ReactNode;
};

function LayoutGestion({ seccion, children }: LayoutGestionProps) {
    useEffect(() => {
        document.title = `${seccion} · Gestión IncaTour`;
    }, [seccion]);

    return (
        <div className="flex min-h-screen flex-col bg-fondo md:flex-row">
            <BarraLateral seccionActiva={seccion} />
            <div className="flex min-w-0 flex-1 flex-col">
                <BarraSuperior seccion={seccion} />
                <main className="p-8"><LimiteDeError>{children}</LimiteDeError></main>
            </div>
        </div>
    );
}

export default LayoutGestion;
