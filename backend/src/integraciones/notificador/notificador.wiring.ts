import { envs } from "../../config/envs";
import { INotificador } from "./notificador.interface";
import { NotificadorMock } from "./notificador.mock";
import { NotificadorSmtp } from "./notificador.smtp";

/**
 * Punto único donde se elige cómo salen los mails.
 * Con SMTP_HOST configurado se envían por SMTP (en desarrollo, a Mailpit); si no, se escriben en la consola.
 * Los tests corren sin SMTP_HOST (vitest.config.ts), así que siguen usando el simulado.
 */
let notificador: INotificador | null = null;

export const obtenerNotificador = (): INotificador =>
  (notificador ??= envs.SMTP_HOST
    ? new NotificadorSmtp({
        host: envs.SMTP_HOST,
        port: envs.SMTP_PORT,
        user: envs.SMTP_USER,
        password: envs.SMTP_PASSWORD,
        from: envs.SMTP_FROM,
      })
    : new NotificadorMock());
