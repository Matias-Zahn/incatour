import nodemailer, { type Transporter } from "nodemailer";
import { AlternativaSalida, INotificador } from "./notificador.interface";

export type ConfigSmtp = {
  host: string;
  port: number;
  user?: string | undefined;
  password?: string | undefined;
  from: string;
};

// Los textos que vienen del usuario (motivos, nombres) no se interpretan como HTML
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const plata = (monto: number) => `$${monto.toFixed(2)}`;
const dia = (f: Date) => f.toISOString().slice(0, 10).split("-").reverse().join("/");

// Un solo molde para todos los mails: título, cuerpo y firma
function plantilla(titulo: string, cuerpo: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f7f8;font-family:Arial,sans-serif;color:#1f2d3d">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #dde5ea">
<div style="background:#1b9fc7;color:#fff;padding:18px 24px;font-size:20px;font-weight:bold">IncaTour</div>
<div style="padding:24px"><h1 style="margin:0 0 16px;font-size:18px;color:#075274">${titulo}</h1>${cuerpo}</div>
<div style="padding:14px 24px;background:#f4f7f8;font-size:12px;color:#6b7c8a">Este mensaje lo envía IncaTour automáticamente; no hace falta responderlo.</div>
</div></body></html>`;
}

const p = (texto: string) => `<p style="margin:0 0 12px;line-height:1.5">${texto}</p>`;

/** Envía los mails por SMTP. En desarrollo apunta a Mailpit, que los atrapa y los muestra sin enviarlos. */
export class NotificadorSmtp implements INotificador {
  private transporte: Transporter;

  constructor(private config: ConfigSmtp) {
    this.transporte = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
      // Si el servidor de correo no responde, se corta rápido: el mail nunca frena la operación
      connectionTimeout: 5000,
      greetingTimeout: 5000,
    });
  }

  private async enviar(para: string, asunto: string, titulo: string, cuerpo: string) {
    await this.transporte.sendMail({ from: this.config.from, to: para, subject: asunto, html: plantilla(titulo, cuerpo) });
    return true;
  }

  enviarEmailConfirmacion(email: string, nroReserva: string, monto: number, moneda: string) {
    return this.enviar(
      email,
      `Tu reserva ${nroReserva} está confirmada`,
      "¡Reserva confirmada!",
      p("Recibimos tu pago y tu reserva quedó confirmada.") +
        p(`<b>Reserva:</b> ${esc(nroReserva)}<br><b>Total abonado:</b> ${esc(moneda)} ${monto.toFixed(2)}`) +
        p("Podés ver el detalle y descargar el comprobante en <b>Mis reservas</b>.")
    );
  }

  enviarEmailRechazo(email: string, motivo: string) {
    return this.enviar(
      email,
      "No pudimos procesar tu pago",
      "Pago rechazado",
      p("El pago de tu compra fue rechazado y no se realizó ningún cobro.") +
        p(`<b>Motivo:</b> ${esc(motivo)}`) +
        p("Podés intentar de nuevo con otra tarjeta.")
    );
  }

  enviarEmailCancelacionReserva(email: string, nroReserva: string, montoAReintegrar: number, motivo: string | null) {
    return this.enviar(
      email,
      `Constancia de cancelación de la reserva ${nroReserva}`,
      "Cancelaste tu reserva",
      p(`La reserva <b>${esc(nroReserva)}</b> quedó cancelada.`) +
        p(`<b>Importe a reintegrar:</b> ${plata(montoAReintegrar)}`) +
        (motivo ? p(`<b>Motivo:</b> ${esc(motivo)}`) : "") +
        p("El reintegro se acredita por el mismo medio de pago.")
    );
  }

  enviarEmailCancelacionSalida(
    email: string,
    nroSalida: string,
    motivo: string,
    montoAReintegrar: number,
    alternativas: AlternativaSalida[]
  ) {
    const opciones = alternativas.length
      ? `<ul style="margin:0 0 12px;padding-left:20px">${alternativas
          .map((a) => `<li>${esc(a.nombrePaquete)} · ${dia(a.fechaInicio)} · ${a.lugaresDisponibles} lugares</li>`)
          .join("")}</ul>`
      : p("Por ahora no hay otras fechas disponibles; te avisamos cuando haya.");
    return this.enviar(
      email,
      "Cancelamos tu salida",
      "Tu salida fue cancelada",
      p("Lamentamos avisarte que cancelamos la salida de tu viaje.") +
        p(`<b>Motivo:</b> ${esc(motivo)}`) +
        p(`<b>Te reintegramos el 100%:</b> ${plata(montoAReintegrar)}`) +
        p("<b>Otras fechas para el mismo viaje:</b>") +
        opciones
    );
  }

  enviarEmailInvitacionResenia(email: string, _nroSalida: string, nombrePaquete: string) {
    return this.enviar(
      email,
      "¿Cómo fue tu viaje?",
      "¡Gracias por viajar con nosotros!",
      p(`Terminó tu viaje <b>${esc(nombrePaquete)}</b>. Nos encantaría saber cómo te fue.`) +
        p("Podés dejar tu reseña desde <b>Mis reseñas</b>.")
    );
  }

  enviarEmailAlojamientoConfirmado(email: string, nroReserva: string, establecimiento: string, localidad: string) {
    return this.enviar(
      email,
      "Tu alojamiento está confirmado",
      "Alojamiento confirmado",
      p(`Ya tenemos el alojamiento de tu reserva <b>${esc(nroReserva)}</b>.`) +
        p(`<b>Establecimiento:</b> ${esc(establecimiento)}${localidad ? ` (${esc(localidad)})` : ""}`)
    );
  }

  enviarEmailIncidenteCritico(
    email: string,
    nroSalida: string,
    nombrePaquete: string,
    tipoIncidente: string,
    descripcion: string
  ) {
    return this.enviar(
      email,
      `[URGENTE] Incidente crítico en salida ${nroSalida}`,
      "Alerta de incidente crítico en campo",
      p(`Se reportó un incidente de gravedad <b>CRÍTICA</b> durante la operación de la salida <b>${esc(nroSalida)}</b> (${esc(nombrePaquete)}).`) +
        p(`<b>Tipo de incidente:</b> ${esc(tipoIncidente)}<br><b>Descripción:</b> ${esc(descripcion)}`) +
        p("Ingresá al <b>Panel de Gestión</b> para revisar el detalle y los pasajeros afectados.")
    );
  }
}
