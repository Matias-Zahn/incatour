import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

export type TonoAccionMenu = "normal" | "marca" | "advertencia" | "peligro" | "exito";

export type AccionMenuSalida =
    | {
          tipo: "boton";
          id: string;
          etiqueta: string;
          tono?: TonoAccionMenu;
          deshabilitado?: boolean;
          onClick: () => void;
      }
    | {
          tipo: "enlace";
          id: string;
          etiqueta: string;
          to: string;
      };

type MenuAccionesSalidaProps = {
    nroSalida: string;
    acciones: AccionMenuSalida[];
    etiqueta?: string;
    deshabilitado?: boolean;
    destacar?: boolean;
};

type PosicionMenu = {
    top?: number;
    bottom?: number;
    left: number;
};

function MenuAccionesSalida({
    nroSalida,
    acciones,
    etiqueta = "Editar",
    deshabilitado = false,
    destacar = false,
}: MenuAccionesSalidaProps) {
    const [abierto, setAbierto] = useState(false);
    const [posicion, setPosicion] = useState<PosicionMenu | null>(null);
    const botonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    function calcularPosicion(): PosicionMenu | null {
        const rect = botonRef.current?.getBoundingClientRect();
        if (!rect) return null;
        const anchoMenu = 232;
        const altoEstimado = Math.min(360, acciones.length * 40 + 48);
        const espacioAbajo = window.innerHeight - rect.bottom;
        const haciaArriba =
            espacioAbajo < altoEstimado && rect.top > altoEstimado;

        const left = Math.max(
            12,
            Math.min(rect.right - anchoMenu, window.innerWidth - anchoMenu - 12),
        );

        if (haciaArriba) {
            return {
                bottom: window.innerHeight - rect.top + 6,
                left,
            };
        }

        return {
            top: rect.bottom + 6,
            left,
        };
    }

    function alternarMenu() {
        if (abierto) {
            setAbierto(false);
            return;
        }
        setPosicion(calcularPosicion());
        setAbierto(true);
    }

    useEffect(() => {
        if (!abierto) return;

        function manejarClickAfuera(evento: MouseEvent) {
            const target = evento.target as Node;
            if (
                botonRef.current?.contains(target) ||
                menuRef.current?.contains(target)
            ) {
                return;
            }
            setAbierto(false);
        }
        function manejarTecla(evento: KeyboardEvent) {
            if (evento.key === "Escape") setAbierto(false);
        }
        function manejarScroll() {
            setAbierto(false);
        }

        document.addEventListener("mousedown", manejarClickAfuera);
        document.addEventListener("keydown", manejarTecla);
        window.addEventListener("scroll", manejarScroll, true);
        window.addEventListener("resize", manejarScroll);
        return () => {
            document.removeEventListener("mousedown", manejarClickAfuera);
            document.removeEventListener("keydown", manejarTecla);
            window.removeEventListener("scroll", manejarScroll, true);
            window.removeEventListener("resize", manejarScroll);
        };
    }, [abierto]);

    if (acciones.length === 0) return null;

    const normales = acciones.filter(
        (a) => a.tipo !== "boton" || a.tono !== "peligro",
    );
    const peligrosas = acciones.filter(
        (a) => a.tipo === "boton" && a.tono === "peligro",
    );

    const claseTono = (tono?: TonoAccionMenu) => {
        if (tono === "marca") return "bg-marca/10 text-marca-oscura hover:bg-marca/20";
        if (tono === "peligro") return "text-peligro hover:bg-rose-50";
        if (tono === "advertencia") return "text-amber-800 hover:bg-amber-50";
        if (tono === "exito") return "text-emerald-800 hover:bg-emerald-50";
        return "text-navegacion hover:bg-fondo";
    };

    return (
        <>
            <button
                ref={botonRef}
                type="button"
                disabled={deshabilitado}
                aria-expanded={abierto}
                aria-haspopup="menu"
                aria-label={`${etiqueta} salida ${nroSalida}`}
                onClick={alternarMenu}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    abierto
                        ? "border-marca bg-marca-suave text-navegacion"
                        : destacar
                          ? "border-marca/60 bg-marca/10 text-marca-oscura hover:bg-marca/20"
                          : "border-borde bg-white text-navegacion hover:border-navegacion/30 hover:bg-fondo"
                }`}
            >
                {destacar ? (
                    <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-marca"
                    />
                ) : null}
                <span>{etiqueta}</span>
                <svg
                    width={13}
                    height={13}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className={`transition-transform ${abierto ? "rotate-180" : ""}`}
                >
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </button>

            {abierto && posicion
                ? createPortal(
                      <div
                          ref={menuRef}
                          role="menu"
                          aria-label={`Acciones de ${nroSalida}`}
                          style={{
                              position: "fixed",
                              top: posicion.top,
                              bottom: posicion.bottom,
                              left: posicion.left,
                          }}
                          className="z-50 w-58 rounded-tarjeta border border-borde bg-white p-1.5 shadow-[0_20px_44px_-12px_rgba(18,61,112,0.22),0_4px_12px_-2px_rgba(18,61,112,0.08)]"
                      >
                          <p className="px-2.5 pb-1 pt-1 text-[10.5px] font-bold uppercase tracking-wider text-texto-suave">
                              {nroSalida}
                          </p>
                          <div className="space-y-0.5">
                              {normales.map((accion) =>
                                  accion.tipo === "enlace" ? (
                                      <Link
                                          key={accion.id}
                                          to={accion.to}
                                          role="menuitem"
                                          onClick={() => setAbierto(false)}
                                          className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold text-navegacion transition hover:bg-fondo"
                                      >
                                          <span>{accion.etiqueta}</span>
                                          <span
                                              aria-hidden="true"
                                              className="text-texto-suave"
                                          >
                                              ↗
                                          </span>
                                      </Link>
                                  ) : (
                                      <button
                                          key={accion.id}
                                          type="button"
                                          role="menuitem"
                                          disabled={accion.deshabilitado}
                                          onClick={() => {
                                              setAbierto(false);
                                              accion.onClick();
                                          }}
                                          className={`flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${claseTono(accion.tono)}`}
                                      >
                                          <span>{accion.etiqueta}</span>
                                      </button>
                                  ),
                              )}
                          </div>

                          {peligrosas.length > 0 ? (
                              <div className="mt-1.5 space-y-0.5 border-t border-borde/70 pt-1.5">
                                  {peligrosas.map((accion) =>
                                      accion.tipo === "boton" ? (
                                          <button
                                              key={accion.id}
                                              type="button"
                                              role="menuitem"
                                              disabled={accion.deshabilitado}
                                              onClick={() => {
                                                  setAbierto(false);
                                                  accion.onClick();
                                              }}
                                              className="flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-peligro transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                                          >
                                              <span>{accion.etiqueta}</span>
                                          </button>
                                      ) : null,
                                  )}
                              </div>
                          ) : null}
                      </div>,
                      document.body,
                  )
                : null}
        </>
    );
}

export default MenuAccionesSalida;
