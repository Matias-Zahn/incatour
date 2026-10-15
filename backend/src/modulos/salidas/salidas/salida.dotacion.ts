/**
 * CU-36 paso 4: dotación de personal que exige el circuito para un tamaño de grupo.
 * Guías: el mínimo del circuito. Porteadores: según parametrosPorteadores, con el formato
 * "<k> por cada <n> pasajeros" (ej. "1 por cada 2 pasajeros" → 1 porteador cada 2, redondeando hacia arriba).
 * Devuelve null si los parámetros no se pueden interpretar (precondición 4 del CU).
 */
export const calcularDotacion = (
  minimoGuias: number,
  parametrosPorteadores: string | null,
  tamanoMaximo: number,
): { guias: number; porteadores: number } | null => {
  const regla = parametrosPorteadores?.match(/(\d+)\s*por\s*cada\s*(\d+)/i);
  if (!regla || minimoGuias < 1) return null;

  const porteadoresPorGrupo = Number(regla[1]);
  const pasajerosPorGrupo = Number(regla[2]);
  if (pasajerosPorGrupo === 0) return null;

  return {
    guias: minimoGuias,
    porteadores: Math.ceil(tamanoMaximo / pasajerosPorGrupo) * porteadoresPorGrupo,
  };
};
