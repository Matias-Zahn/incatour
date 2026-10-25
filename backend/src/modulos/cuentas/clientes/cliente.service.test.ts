import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClienteService } from "./cliente.service";

const { repo } = vi.hoisted(() => ({ repo: { findByUsuario: vi.fn() } }));
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
