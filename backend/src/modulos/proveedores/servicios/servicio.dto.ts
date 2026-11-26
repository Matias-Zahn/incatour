import { ESTADO, MODALIDAD_BLOQUEO_PLAZAS, TIPO_SERVICIO, TIPOS_EQUIPAMIENTO, TipoServicio, TOPES } from "../../../shared/constantes";
import { sumarDias } from "../../../shared/ocupacion";

export const MODALIDADES_CONFIRMACION = [MODALIDAD_BLOQUEO_PLAZAS, "A_SOLICITUD"];
const DIAS_VALIDOS = ["L", "M", "X", "J", "V", "S", "D"];
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------- Validadores atómicos: devuelven [error, valorLimpio] ----------
type Validador = (valor: any, campo: string) => [string | undefined, any?];

const vTexto = (max: number): Validador => (v, c) =>
  typeof v === "string" && v.trim().length > 0 && v.trim().length <= max
    ? [undefined, v.trim()]
    : [`${c} es requerido y no puede superar los ${max} caracteres.`];

const vEntero = (min: number, max?: number): Validador => (v, c) => {
  if (!Number.isInteger(v) || v < min) return [`${c} debe ser un número entero mayor o igual a ${min}.`];
  if (max !== undefined && v > max) return [`${c} no puede superar el máximo de ${max}.`];
  return [undefined, v];
};

const vNumero = (min: number, max?: number): Validador => (v, c) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min) {
    return [`${c} debe ser un número mayor o igual a ${min}.`];
  }
  if (max !== undefined && v > max) {
    return [`${c} no puede superar el máximo de ${max}.`];
  }
  return [undefined, v];
};

/** Campo opcional: null lo borra, y al crear puede faltar. */
const vOpcional = (validar: Validador): Validador =>
  Object.assign((v: any, c: string) => (v === null ? [undefined, null] : validar(v, c)) as [string | undefined, any?], { opcional: true });

const vHora: Validador = (v, c) =>
  typeof v === "string" && REGEX_HORA.test(v) ? [undefined, v] : [`${c} debe tener el formato HH:MM.`];

const vDias: Validador = (v, c) => {
  if (typeof v !== "string") return [`${c} es requerido (ej: L-M-X-J-V-S-D).`];
  const dias = v.trim().toUpperCase().split("-");
  const ok = dias.length > 0 && dias.every((d) => DIAS_VALIDOS.includes(d)) && new Set(dias).size === dias.length;
  return ok ? [undefined, dias.join("-")] : [`${c} debe ser una lista de días sin repetir, separados por guion (L M X J V S D).`];
};

const vModalidad: Validador = (v, c) =>
  MODALIDADES_CONFIRMACION.includes(v) ? [undefined, v] : [`${c} debe ser uno de: ${MODALIDADES_CONFIRMACION.join(", ")}.`];

const vTipoEquipamiento: Validador = (v, c) =>
  TIPOS_EQUIPAMIENTO.includes(v) ? [undefined, v] : [`${c} debe ser uno de: ${TIPOS_EQUIPAMIENTO.join(", ")}.`];

// ---------- Campos comunes (ServicioBase) ----------
const CAMPOS_BASE: { [campo: string]: Validador } = {
  nombreServicio: vTexto(120),
  costoBase: vNumero(0, 10_000_000),
  localidad: vTexto(80),
};

// ---------- Campos propios de cada rubro (CU-19) ----------
export const CAMPOS_CREAR: { [tipo in TipoServicio]: { [campo: string]: Validador } } = {
  ALOJAMIENTO: {
    categoria: vTexto(40),
    tipoHabitacion: vTexto(40),
    capacidadDisponible: vEntero(0, TOPES.plazasAlojamiento),
    modalidadConfirmacion: vModalidad,
  },
  TRANSPORTE: {
    capacidadVehiculo: vEntero(1, TOPES.capacidadVehiculo),
    // B6: el equipaje se pesa y cobra en persona; estos dos solo se informan al cliente
    pesoEquipajeIncluido: vOpcional(vNumero(0, TOPES.pesoEquipaje)),
    costoPorKgExcedente: vOpcional(vNumero(0, TOPES.costoPorKgExcedente)),
  },
  TREN: {
    horarioSalida: vHora,
    horarioLlegada: vHora,
    diasOperacion: vDias,
  },
  EQUIPAMIENTO: {
    tipoEquipamiento: vTipoEquipamiento,
    cantidadDisponible: vEntero(0, TOPES.unidadesEquipamiento),
  },
};

/**
 * A1: la API conserva los nombres que usa el front (capacidadDisponible, cantidadDisponible, inventarioTotal),
 * pero lo que se guarda es el total: plazasTotales y cantidadTotal.
 */
const COLUMNA: { [campo: string]: string } = {
  capacidadDisponible: "plazasTotales",
  cantidadDisponible: "cantidadTotal",
  inventarioTotal: "cantidadTotal",
};
export const aColumnas = (especifico: { [k: string]: any }) =>
  Object.fromEntries(Object.entries(especifico).map(([campo, valor]) => [COLUMNA[campo] ?? campo, valor]));

// ---------- Campos modificables (CU-20). En equipamiento se edita el INVENTARIO TOTAL ----------
export const CAMPOS_MODIFICAR: { [tipo in TipoServicio]: { [campo: string]: Validador } } = {
  ALOJAMIENTO: { ...CAMPOS_CREAR.ALOJAMIENTO },
  TRANSPORTE: { ...CAMPOS_CREAR.TRANSPORTE },
  TREN: { ...CAMPOS_CREAR.TREN },
  EQUIPAMIENTO: { tipoEquipamiento: vTipoEquipamiento, inventarioTotal: vEntero(0, TOPES.unidadesEquipamiento) },
};

/** Valida los campos de `campos` presentes en `obj`. Si `exigirTodos`, todos son obligatorios. */
const validarCampos = (
  obj: { [k: string]: any },
  campos: { [campo: string]: Validador },
  exigirTodos: boolean
): [string | undefined, { [k: string]: any }?] => {
  const limpio: { [k: string]: any } = {};
  for (const [campo, validar] of Object.entries(campos)) {
    if (obj[campo] === undefined) {
      if (exigirTodos && !("opcional" in validar)) return [`${campo} es requerido.`];
      continue;
    }
    const [error, valor] = validar(obj[campo], campo);
    if (error) return [error];
    limpio[campo] = valor;
  }
  return [undefined, limpio];
};

const validarDescripcion = (v: any): [string | undefined, (string | null)?] => {
  if (v === undefined || v === null || v === "") return [undefined, null];
  if (typeof v !== "string" || v.trim().length > 500) return ["descripcion no puede superar los 500 caracteres."];
  return [undefined, v.trim()];
};

// CU-19: Registrar servicio de un proveedor
export class CrearServicioDto {
  private constructor(
    public tipo: TipoServicio,
    public base: { nombreServicio: string; descripcion: string | null; costoBase: number; localidad: string },
    public especifico: { [k: string]: any }
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, CrearServicioDto?] {
    const tipos = Object.values(TIPO_SERVICIO) as string[];
    if (!obj.tipo || !tipos.includes(obj.tipo)) return [`tipo debe ser uno de: ${tipos.join(", ")}.`];
    const tipo = obj.tipo as TipoServicio;

    const [errBase, base] = validarCampos(obj, CAMPOS_BASE, true);
    if (errBase) return [errBase];
    const [errDesc, descripcion] = validarDescripcion(obj.descripcion);
    if (errDesc) return [errDesc];

    // Bloque 8: las plazas son obligatorias solo con bloqueo; a solicitud pueden venir vacías
    let campos = CAMPOS_CREAR[tipo];
    const sinPlazas = obj.capacidadDisponible === undefined || obj.capacidadDisponible === null || obj.capacidadDisponible === "";
    if (tipo === TIPO_SERVICIO.ALOJAMIENTO && obj.modalidadConfirmacion !== MODALIDAD_BLOQUEO_PLAZAS && sinPlazas) {
      const { capacidadDisponible, ...resto } = campos;
      campos = resto;
    }
    const [errEsp, especifico] = validarCampos(obj, campos, true);
    if (errEsp) return [errEsp];
    if (tipo === TIPO_SERVICIO.ALOJAMIENTO) especifico!.capacidadDisponible ??= null;

    if (tipo === TIPO_SERVICIO.TREN && especifico!.horarioSalida === especifico!.horarioLlegada) {
      return ["horarioSalida y horarioLlegada no pueden ser iguales."];
    }

    return [
      undefined,
      new CrearServicioDto(
        tipo,
        { nombreServicio: base!.nombreServicio, costoBase: base!.costoBase, localidad: base!.localidad, descripcion: descripcion ?? null },
        especifico!
      ),
    ];
  }
}

// CU-20: Modificar servicio (todo opcional, al menos un campo)
export class ModificarServicioDto {
  private constructor(
    public base: { nombreServicio?: string; descripcion?: string | null; costoBase?: number; localidad?: string },
    public especifico: { [k: string]: any }
  ) {}

  public static create(obj: { [key: string]: any }): [string | undefined, ModificarServicioDto?] {
    const [errBase, base] = validarCampos(obj, CAMPOS_BASE, false);
    if (errBase) return [errBase];

    const baseFinal: { [k: string]: any } = { ...base };
    if (obj.descripcion !== undefined) {
      const [errDesc, descripcion] = validarDescripcion(obj.descripcion);
      if (errDesc) return [errDesc];
      baseFinal.descripcion = descripcion;
    }

    // Unión de los campos de todos los rubros: el servicio valida luego cuáles corresponden al tipo real
    const todos: { [campo: string]: Validador } = Object.assign({}, ...Object.values(CAMPOS_MODIFICAR));
    const [errEsp, especifico] = validarCampos(obj, todos, false);
    if (errEsp) return [errEsp];

    if (Object.keys(baseFinal).length === 0 && Object.keys(especifico!).length === 0) {
      return ["Debe enviar al menos un campo para modificar."];
    }
    return [undefined, new ModificarServicioDto(baseFinal, especifico!)];
  }
}

// A1: GET /api/servicios/:id/ocupacion?desde&hasta (AAAA-MM-DD). Por defecto, de hoy a 30 días; hasta un año
export const DIAS_MAXIMOS_OCUPACION = 366;
export class RangoOcupacionDto {
  private constructor(public desde: Date, public hasta: Date) {}

  public static create(query: { [key: string]: any }, hoy: Date): [string | undefined, RangoOcupacionDto?] {
    const leer = (v: unknown, c: string): [string | undefined, Date?] => {
      if (v === undefined) return [undefined];
      const f = new Date(`${v}T00:00:00.000Z`);
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(f.getTime())
        ? [undefined, f]
        : [`${c} debe ser una fecha válida (AAAA-MM-DD).`];
    };
    const [errDesde, desde = hoy] = leer(query.desde, "desde");
    if (errDesde) return [errDesde];
    const [errHasta, hasta = sumarDias(desde, 30)] = leer(query.hasta, "hasta");
    if (errHasta) return [errHasta];
    if (hasta < desde) return ["desde no puede ser posterior a hasta."];
    if (hasta > sumarDias(desde, DIAS_MAXIMOS_OCUPACION - 1)) {
      return [`El rango no puede superar los ${DIAS_MAXIMOS_OCUPACION} días.`];
    }
    return [undefined, new RangoOcupacionDto(desde, hasta)];
  }
}

// CU-18: filtros del listado de servicios de un proveedor
export class FiltrosServicioDto {
  private constructor(public estado?: string) {}

  public static create(query: { [key: string]: any }): [string | undefined, FiltrosServicioDto?] {
    const { estado } = query;
    if (estado !== undefined && ![ESTADO.ACTIVO, ESTADO.INACTIVO].includes(estado)) {
      return [`estado debe ser ${ESTADO.ACTIVO} o ${ESTADO.INACTIVO}.`];
    }
    return [undefined, new FiltrosServicioDto(estado)];
  }
}