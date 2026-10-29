import type { ReactNode } from "react";

type Columna<T> = {
    clave: keyof T;
    titulo: string;
    renderizar?: (fila: T) => ReactNode;
};

type TablaProps<T extends { id: string | number }> = {
    columnas: Columna<T>[];
    filas: T[];
    claseFila?: (fila: T) => string | undefined;
};

function Tabla<T extends { id: string | number }>({
    columnas,
    filas,
    claseFila,
}: TablaProps<T>) {
    return (
        <div className="overflow-x-auto rounded-tarjeta border border-borde bg-white">
            <table className="w-full text-left">
                <thead className="bg-slate-800 text-white">
                    <tr>
                        {columnas.map((columna) => (
                            <th
                                key={`${String(columna.clave)}-${columna.titulo}`}
                                className="px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                            >
                                {columna.titulo}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {filas.map((fila) => (
                        <tr
                            key={fila.id}
                            className={`border-t border-borde ${claseFila ? claseFila(fila) ?? "" : ""}`.trimEnd()}
                        >
                            {columnas.map((columna) => (
                                <td
                                    key={`${String(columna.clave)}-${columna.titulo}`}
                                    className="px-4 py-3 text-texto align-top"
                                >
                                    {columna.renderizar
                                        ? columna.renderizar(fila)
                                        : String(fila[columna.clave])}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default Tabla;
