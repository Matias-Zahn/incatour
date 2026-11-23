import { Suspense, useEffect, type ReactNode } from "react";
import EstadoListado from "./EstadoListado";
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
        <div className="flex min-h-screen flex-col bg-fondo">
            <BarraSuperior seccion={seccion} />
            <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
                <LimiteDeError>
                    <Suspense fallback={<EstadoListado estado="cargando" />}>
                        {children}
                    </Suspense>
                </LimiteDeError>
            </main>
        </div>
    );
}

export default LayoutGestion;
