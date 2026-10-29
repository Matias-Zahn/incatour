import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import Boton from "./Boton";

type Props = { children: ReactNode };

// Un error de render en una página muestra este aviso en lugar de dejar la pantalla en blanco
class Limite extends Component<Props, { conError: boolean }> {
    state = { conError: false };

    static getDerivedStateFromError() {
        return { conError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error(error, info.componentStack);
    }

    render() {
        if (!this.state.conError) return this.props.children;
        return (
            <div role="alert" className="mx-auto max-w-md rounded-tarjeta border border-borde bg-white p-6 text-center">
                <h2 className="text-lg font-bold text-texto">Algo salió mal</h2>
                <p className="mt-2 text-sm text-texto-suave">
                    No pudimos mostrar esta pantalla. Probá de nuevo o volvé al inicio.
                </p>
                <div className="mt-5 flex justify-center gap-3">
                    <Boton onClick={() => this.setState({ conError: false })}>Reintentar</Boton>
                    <Link to="/" className="rounded-control border border-borde px-4 py-2 text-sm font-semibold text-texto hover:bg-fondo">
                        Volver al inicio
                    </Link>
                </div>
            </div>
        );
    }
}

// Al cambiar de ruta el error se descarta: la página nueva arranca limpia
function LimiteDeError({ children }: Props) {
    const { pathname } = useLocation();
    return <Limite key={pathname}>{children}</Limite>;
}

export default LimiteDeError;
