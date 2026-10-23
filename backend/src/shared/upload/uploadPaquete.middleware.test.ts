import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import {
  validarPaqueteParaSubida,
  subirCarruselPaquete,
  subirImagenPaquete,
  modificarFotoEspecifica,
} from "./uploadPaquete.middleware";
import { db } from "../../config/postgresDatabase";
import { CustomError } from "../../error/CustomError";

vi.mock("../../config/postgresDatabase", () => ({
  db: {
    paquete: {
      findUnique: vi.fn(),
    },
  },
}));

describe("CAT-12: uploadPaquete middleware seguridad y validación previa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validarPaqueteParaSubida", () => {
    it("rechaza IDs no numéricos o con intentos de path traversal (.. / %2e%2e)", async () => {
      const idsInvalidos = ["..", "%2e%2e", "abc", "-1", "1/2", "", "1.."];
      for (const id of idsInvalidos) {
        const req = { params: { id } } as unknown as Request;
        await expect(validarPaqueteParaSubida(req)).rejects.toMatchObject({
          statusCode: 400,
          message: "El ID proporcionado no es válido.",
        });
      }
      expect(db.paquete.findUnique).not.toHaveBeenCalled();
    });

    it("responde 404 si el paquete no existe en base de datos", async () => {
      vi.mocked(db.paquete.findUnique).mockResolvedValue(null as any);
      const req = { params: { id: "999" } } as unknown as Request;

      await expect(validarPaqueteParaSubida(req)).rejects.toMatchObject({
        statusCode: 404,
        message: "Paquete no encontrado o inactivo.",
      });
      expect(db.paquete.findUnique).toHaveBeenCalledWith({
        where: { idpaquete: 999 },
        select: { idpaquete: true, estado: true },
      });
    });

    it("responde 404 si el paquete está INACTIVO", async () => {
      vi.mocked(db.paquete.findUnique).mockResolvedValue({ idpaquete: 5, estado: "INACTIVO" } as any);
      const req = { params: { id: "5" } } as unknown as Request;

      await expect(validarPaqueteParaSubida(req)).rejects.toMatchObject({
        statusCode: 404,
        message: "Paquete no encontrado o inactivo.",
      });
    });

    it("permite la subida si el paquete existe y está ACTIVO", async () => {
      vi.mocked(db.paquete.findUnique).mockResolvedValue({ idpaquete: 1, estado: "ACTIVO" } as any);
      const req = { params: { id: "1" } } as unknown as Request;

      const resId = await validarPaqueteParaSubida(req);
      expect(resId).toBe(1);
    });

    it("valida nombreFoto en modificarFotoEspecifica contra whitelist", async () => {
      vi.mocked(db.paquete.findUnique).mockResolvedValue({ idpaquete: 1, estado: "ACTIVO" } as any);
      const reqInvalido = { params: { id: "1", nombreFoto: "otra_cosa" } } as unknown as Request;

      await expect(validarPaqueteParaSubida(reqInvalido, true)).rejects.toMatchObject({
        statusCode: 400,
      });

      const reqValido = { params: { id: "1", nombreFoto: "foto_2" } } as unknown as Request;
      const resId = await validarPaqueteParaSubida(reqValido, true);
      expect(resId).toBe(1);
    });
  });

  describe("Middlewares de subida (subirCarruselPaquete, subirImagenPaquete, modificarFotoEspecifica)", () => {
    it("POST /api/paquetes/999/carrusel no crea carpetas para paquetes inexistentes", async () => {
      vi.mocked(db.paquete.findUnique).mockResolvedValue(null as any);

      const targetDir = path.resolve(process.cwd(), "public/imagenes/paquetes/999");
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }

      const req = { params: { id: "999" } } as unknown as Request;
      const res = {} as Response;
      let errorRecibido: any = null;
      const next: NextFunction = (err?: any) => {
        errorRecibido = err;
      };

      const middleware = subirCarruselPaquete.array("imagenes", 5);
      await middleware(req, res, next);

      expect(errorRecibido).toBeInstanceOf(CustomError);
      expect(errorRecibido.statusCode).toBe(404);
      expect(fs.existsSync(targetDir)).toBe(false);
    });

    it("rechaza intento de path traversal antes de tocar el sistema de archivos", async () => {
      const req = { params: { id: ".." } } as unknown as Request;
      const res = {} as Response;
      let errorRecibido: any = null;
      const next: NextFunction = (err?: any) => {
        errorRecibido = err;
      };

      const middleware = subirCarruselPaquete.array("imagenes", 5);
      await middleware(req, res, next);

      expect(errorRecibido).toBeInstanceOf(CustomError);
      expect(errorRecibido.statusCode).toBe(400);
      expect(db.paquete.findUnique).not.toHaveBeenCalled();
    });

    it("modificarFotoEspecifica rechaza paquetes inactivos antes de tocar archivos", async () => {
      vi.mocked(db.paquete.findUnique).mockResolvedValue({ idpaquete: 7, estado: "INACTIVO" } as any);

      const req = { params: { id: "7", nombreFoto: "foto_1" } } as unknown as Request;
      const res = {} as Response;
      let errorRecibido: any = null;
      const next: NextFunction = (err?: any) => {
        errorRecibido = err;
      };

      const middleware = modificarFotoEspecifica.single("imagen");
      await middleware(req, res, next);

      expect(errorRecibido).toBeInstanceOf(CustomError);
      expect(errorRecibido.statusCode).toBe(404);
    });
  });
});
