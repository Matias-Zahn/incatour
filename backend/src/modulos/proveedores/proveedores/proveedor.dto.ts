import { ESTADO, TIPOS_PROVEEDOR } from "../../../shared/constantes";

const ESTADOS_VALIDOS: string[] = [ESTADO.ACTIVO, ESTADO.INACTIVO];

/** Valida un texto obligatorio. Devuelve [error, valorLimpio]. */
const textoRequerido = (valor: any, nombre: string, max: number): [string?, string?] => {
  if (typeof valor !== "string" || valor.trim().length === 0) return [`${nombre} es requerido.`];
  const limpio = valor.trim();
  if (limpio.length > max) return [`${nombre} no puede superar los ${max} caracteres.`];
  return [undefined, limpio];
};

// CU-15: Alta proveedor
export class CrearProveedorDto {
  private constructor(
    public tipoProveedor: string,
    public razonSocial: string,
    public localidad: string,
    public datosContacto: string,
    public canalComunicacion: string,
    public estado: string
  ) {}

  public static create(obj: { [key: string]: any }): [string?, CrearProveedorDto?] {
    const { tipoProveedor, estado } = obj;

    if (!tipoProveedor || !TIPOS_PROVEEDOR.includes(tipoProveedor)) {
      return [`tipoProveedor debe ser uno de: ${TIPOS_PROVEEDOR.join(", ")}.`];
    }
    const [e1, razonSocial] = textoRequerido(obj.razonSocial, "razonSocial", 120);
    if (e1) return [e1];
    const [e2, localidad] = textoRequerido(obj.localidad, "localidad", 80);
    if (e2) return [e2];
    const [e3, datosContacto] = textoRequerido(obj.datosContacto, "datosContacto", 200);
    if (e3) return [e3];
    const [e4, canalComunicacion] = textoRequerido(obj.canalComunicacion, "canalComunicacion", 60);
    if (e4) return [e4];

    if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
      return [`estado debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}.`];
    }

    return [
      undefined,
      new CrearProveedorDto(tipoProveedor, razonSocial!, localidad!, datosContacto!, canalComunicacion!, estado ?? ESTADO.ACTIVO),
    ];
  }
}

// CU-16: Modificar proveedor (todos los campos opcionales, al menos uno)
export class ModificarProveedorDto {
  private constructor(
    public tipoProveedor?: string,
    public razonSocial?: string,
    public localidad?: string,
    public datosContacto?: string,
    public canalComunicacion?: string,
    public estado?: string
  ) {}

  public static create(obj: { [key: string]: any }): [string?, ModificarProveedorDto?] {
    const { tipoProveedor, estado } = obj;
    const campos = ["tipoProveedor", "razonSocial", "localidad", "datosContacto", "canalComunicacion", "estado"];
    if (!campos.some((c) => obj[c] !== undefined)) {
      return ["Debe enviar al menos un campo para modificar."];
    }

    if (tipoProveedor !== undefined && !TIPOS_PROVEEDOR.includes(tipoProveedor)) {
      return [`tipoProveedor debe ser uno de: ${TIPOS_PROVEEDOR.join(", ")}.`];
    }
    if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
      return [`estado debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}.`];
    }

    const limpios: { [k: string]: string | undefined } = {};
    const limites: [string, number][] = [["razonSocial", 120], ["localidad", 80], ["datosContacto", 200], ["canalComunicacion", 60]];
    for (const [campo, max] of limites) {
      if (obj[campo] === undefined) continue;
      const [err, valor] = textoRequerido(obj[campo], campo, max);
      if (err) return [err];
      limpios[campo] = valor;
    }

    return [
      undefined,
      new ModificarProveedorDto(
        tipoProveedor, limpios.razonSocial, limpios.localidad, limpios.datosContacto, limpios.canalComunicacion, estado
      ),
    ];
  }
}

// CU-14: filtros del listado (querystring)
export class FiltrosProveedorDto {
  private constructor(
    public tipoProveedor?: string,
    public localidad?: string,
    public estado?: string
  ) {}

  public static create(query: { [key: string]: any }): [string?, FiltrosProveedorDto?] {
    const { tipoProveedor, localidad, estado } = query;
    if (tipoProveedor !== undefined && !TIPOS_PROVEEDOR.includes(tipoProveedor)) {
      return [`tipoProveedor debe ser uno de: ${TIPOS_PROVEEDOR.join(", ")}.`];
    }
    if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
      return [`estado debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}.`];
    }
    const loc = typeof localidad === "string" && localidad.trim() ? localidad.trim() : undefined;
    return [undefined, new FiltrosProveedorDto(tipoProveedor, loc, estado)];
  }
}