import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClienteService } from "./cliente.service";

const { repo } = vi.hoisted(() => ({ repo: { findByUsuario: vi.fn(), buscarPorEmail: vi.fn(), checkEmailExists: vi.fn(), createWithUser: vi.fn() } }));
vi.mock("./cliente.repository", () => ({ ClienteRepository: class { constructor() { return repo; } } }));

describe("ClienteService.consultarMiPerfil (BE-02)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devuelve el cliente del usuario autenticado", async () => {
    const cliente = { idcliente: 4, idusuario: 9, nroCliente: "CLI-1", estado: "ACTIVO", usuario: { nombre: "Ana", apellido: "Paz", email: "a@t.com" } };
    repo.findByUsuario.mockResolvedValue(cliente);

    await expect(new ClienteService().consultarMiPerfil(9)).resolves.toEqual(cliente);
    expect(repo.findByUsuario).toHaveBeenCalledWith(9);
  });

  it("responde 404 si el usuario no tiene cliente", async () => {
    repo.findByUsuario.mockResolvedValue(null);

    await expect(new ClienteService().consultarMiPerfil(9)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("ClienteService.crearCliente (CU-27)", () => {
  beforeEach(() => vi.clearAllMocks());
  const alta = { email: "admin@incatour.com", contrasenia: "secreta123", nombre: "Ana", apellido: "Paz" } as never;

  it("CTA-19: el email de una cuenta dada de baja no se reactiva por registro (409)", async () => {
    repo.buscarPorEmail.mockResolvedValue({ estado: "INACTIVO" });
    await expect(new ClienteService().crearCliente(alta)).rejects.toMatchObject({ statusCode: 409 });
    expect(repo.createWithUser).not.toHaveBeenCalled();
  });

  it("un email de admin o guía (no cliente) responde el mismo 409 claro", async () => {
    repo.buscarPorEmail.mockResolvedValue(null);
    repo.checkEmailExists.mockResolvedValue({ idusuario: 1 });
    await expect(new ClienteService().crearCliente(alta)).rejects.toThrow("Ya existe un usuario registrado");
    expect(repo.createWithUser).not.toHaveBeenCalled();
  });
});
