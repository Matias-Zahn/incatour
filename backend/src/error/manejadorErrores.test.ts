import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import multer from "multer";
import { manejadorErrores, rutaNoEncontrada } from "./manejadorErrores";
import { CustomError } from "./CustomError";

// Respuesta falsa que guarda el código y el cuerpo
const responder = (err: unknown) => {
  const r = { estado: 0, cuerpo: {} as { error?: string } };
  const res = {
    status: (c: number) => ((r.estado = c), res),
    json: (b: { error?: string }) => ((r.cuerpo = b), res),
  };
  manejadorErrores(err, {} as Request, res as unknown as Response, (() => {}) as NextFunction);
  return r;
};
const prisma = (code: string) => new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "5" });

describe("manejadorErrores", () => {
  it("respeta el código de un CustomError", () => {
    const r = responder(CustomError.notFound("No está"));
    expect([r.estado, r.cuerpo.error]).toEqual([404, "No está"]);
  });

  it("un JSON mal formado es 400, no 500", () => {
    const err = Object.assign(new SyntaxError("Unexpected token"), { body: "{mal" });
    expect(responder(err).estado).toBe(400);
  });

  it("traduce los errores conocidos de Prisma", () => {
    expect(responder(prisma("P2002")).estado).toBe(409);
    expect(responder(prisma("P2025")).estado).toBe(404);
    expect(responder(prisma("P2003")).estado).toBe(400);
  });

  it("INF-02: validación de Prisma y CHECK de la base son 400; un conflicto de transacción es 409", () => {
    expect(responder(new Prisma.PrismaClientValidationError("Argument idsalida", { clientVersion: "5" })).estado).toBe(400);
    const check = new Prisma.PrismaClientUnknownRequestError('code: "23514", violates check constraint', { clientVersion: "5" });
    expect(responder(check).estado).toBe(400);
    expect(responder(prisma("P2034")).estado).toBe(409);
  });

  it("un archivo demasiado grande es 400", () => {
    const r = responder(new multer.MulterError("LIMIT_FILE_SIZE"));
    expect([r.estado, r.cuerpo.error]).toEqual([400, "El archivo supera el tamaño máximo permitido"]);
  });

  it("cualquier otro error es 500 sin mostrar detalles", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const r = responder(new Error("detalle interno de la base"));
    expect([r.estado, r.cuerpo.error]).toEqual([500, "Error interno del servidor"]);
  });

  it("un body que supera el límite de express.json es 413", () => {
    const r = responder(Object.assign(new Error("request entity too large"), { type: "entity.too.large" }));
    expect([r.estado, r.cuerpo.error]).toEqual([413, "El cuerpo de la petición es demasiado grande"]);
  });

  it("una ruta inexistente responde 404 en JSON", () => {
    const r = { estado: 0, cuerpo: {} as { error?: string } };
    const res = {
      status: (c: number) => ((r.estado = c), res),
      json: (b: { error?: string }) => ((r.cuerpo = b), res),
    };
    rutaNoEncontrada({} as Request, res as unknown as Response);
    expect([r.estado, r.cuerpo.error]).toEqual([404, "Ruta no encontrada"]);
  });
});
