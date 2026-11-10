import { describe, it, expect, vi } from "vitest";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

import { NotificadorSmtp } from "./notificador.smtp";

describe("NotificadorSmtp", () => {
  const notificador = new NotificadorSmtp({ host: "localhost", port: 1025, from: "IncaTour <no-responder@incatour.com>" });

  it("arma el mail con remitente, destinatario, asunto y los datos de la cancelación", async () => {
    await notificador.enviarEmailCancelacionReserva("ana@x.com", "RES-1", 450, "Cambio de planes");

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "IncaTour <no-responder@incatour.com>", to: "ana@x.com", subject: expect.stringContaining("RES-1") })
    );
    const { html } = sendMail.mock.calls.at(-1)![0];
    expect(html).toContain("$450.00");
    expect(html).toContain("Cambio de planes");
  });

  it("no interpreta como HTML lo que escribió el usuario", async () => {
    await notificador.enviarEmailRechazo("ana@x.com", "<script>alert(1)</script>");

    const { html } = sendMail.mock.calls.at(-1)![0];
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("si el servidor de correo falla, el error llega a quien llamó (que lo registra sin frenar la operación)", async () => {
    sendMail.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(notificador.enviarEmailInvitacionResenia("ana@x.com", "SAL-1", "Inca")).rejects.toThrow("ECONNREFUSED");
  });

  it("arma el mail urgente de incidente crítico para la administración", async () => {
    await notificador.enviarEmailIncidenteCritico("admin@incatour.com", "SAL-2026-010", "Camino Inca", "ACCIDENTE", "Caída en tramo rocoso");

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "admin@incatour.com",
        subject: "[URGENTE] Incidente crítico en salida SAL-2026-010",
      })
    );
    const { html } = sendMail.mock.calls.at(-1)![0];
    expect(html).toContain("SAL-2026-010");
    expect(html).toContain("Camino Inca");
    expect(html).toContain("ACCIDENTE");
    expect(html).toContain("Caída en tramo rocoso");
  });
});
