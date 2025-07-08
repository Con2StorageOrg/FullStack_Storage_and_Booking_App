import { Injectable } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { render } from "@react-email/render";
import { ReactElement } from "react";
import {
  BookingMailType,
  BookingMailParams,
} from "./interfaces/mail.interface";
import * as dayjs from "dayjs"; // Keep this as a named import to avoid issues.
import type { BookingEmailPayload } from "./booking-email-assembler";
import { BookingEmailAssembler } from "./booking-email-assembler";
import BookingCreationEmail from "./../../emails/BookingCreationEmail";
import BookingConfirmationEmail from "./../../emails/BookingConfirmationEmail";
import BookingCancelledEmail from "./../../emails/BookingCancelledEmail";
import BookingUpdateEmail from "./../../emails/BookingUpdateEmail";
import BookingRejectionEmail from "./../../emails/BookingRejectionEmail";
import BookingDeleteMail from "./../../emails/BookingDeleteMail";
import ItemsReturnedMail from "./../../emails/ItemsReturned";
import ItemsPickedUpMail from "./../../emails/ItemsPickedUp";

/**
 * Options accepted by {@link MailService.sendMail}.
 *
 * @property to      - Primary recipient e‑mail address.
 * @property subject - E‑mail subject line.
 * @property template - React e‑mail component (preferred).
 * @property html    - Fallback raw HTML string (if no React template).
 * @property bcc     - Optional blind‑copy recipient(s) such as admins.
 *
 * @example
 * ```ts
 * await mailService.sendMail({
 *   to: "user@example.com",
 *   bcc: "admin@example.com",
 *   subject: "Welcome!",
 *   template: <WelcomeEmail name="Ada" />,
 * });
 * ```
 */
interface SendMailOptions {
  to: string;
  subject: string;
  template?: ReactElement; // React component
  html?: string; // fallback for plain HTML
  bcc?: string | string[]; // optional blind‑copy (e.g. admins)
}

/**
 * Central e‑mail helper.
 *
 * * Wraps <https://nodemailer.com> with a React‑template renderer.
 * * Provides convenience helpers for booking‑related notifications.
 *
 * **Environment variables**
 * - `EMAIL_FROM_2` ‑ Gmail address used as sender (App‑Password auth).
 * - `GMAIL_APP_PASSWORD` ‑ App password for the sender account.
 * - `BOOKING_ADMIN_EMAIL` ‑ Admin copy for booking mails.
 *
 * @example Basic HTML send
 * ```ts
 * await mailService.sendMail({
 *   to: "someone@example.fi",
 *   subject: "Plain HTML",
 *   html: "<h1>Hello</h1>",
 * });
 * ```
 */
@Injectable()
export class MailService {
  constructor(private readonly assembler: BookingEmailAssembler) {}

  /**
   * Turn either a React e‑mail component or raw HTML string into the final
   * markup passed to Nodemailer.
   *
   * @throws if neither `template` nor `html` was provided.
   */
  private generateHtml(template?: ReactElement, html?: string) {
    if (template) {
      return render(template);
    }

    if (html) {
      return html;
    }

    throw new Error("No email template or HTML content provided.");
  }

  /**
   * Low‑level wrapper around `nodemailer.sendMail()`.
   *
   * Prefers React templates but accepts raw HTML for legacy callers.
   * In **production** errors are swallowed and returned as `{ success:false }`
   * to avoid hard‑crashing REST requests, while in dev they bubble up.
   *
   * @param options - See {@link SendMailOptions}.
   * @returns The Nodemailer result or an error object in production.
   */
  async sendMail({ to, subject, template, html, bcc }: SendMailOptions) {
    try {
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_FROM_2, // illusia.info.ry@gmail.com
          pass: process.env.GMAIL_APP_PASSWORD, // ← App Password
        },
      });

      const finalHtml = await this.generateHtml(template, html);

      const mailOptions: Record<string, unknown> = {
        from: `BookingApp <${process.env.EMAIL_FROM_2}>`,
        to,
        subject,
        html: finalHtml,
      };
      if (bcc) mailOptions.bcc = bcc;

      const result = await transport.sendMail(mailOptions);

      return result;
    } catch (error) {
      if (process.env.NODE_ENV === "production") {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      } else {
        throw new Error(
          "Mail sending failed: " +
            (error instanceof Error ? error.message : "Unknown error"),
        );
      }
    }
  }

  /**
   * Used by the public contact form – sends an e‑mail *from* the visitor
   * **to** the site owner.  Kept separate from {@link sendMail} to allow a
   * fully‑custom "from" header.
   *
   * @deprecated Will be merged into `sendMail` once all callers are updated.
   */
  async getMail(to: string, subject: string, html: string, from: string) {
    try {
      const transport = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_FROM_2, // Gmail address used with App Password
          pass: process.env.GMAIL_APP_PASSWORD, // App Password
        },
      });

      const mailObject = {
        from,
        to,
        subject,
        html,
      };

      const result = await transport.sendMail(mailObject);
      return result;
    } catch (error) {
      console.error("Failed to send email:", error);

      // Don't throw in production environments
      if (process.env.NODE_ENV === "production") {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      } else {
        throw new Error(
          "Mail sending failed: " +
            (error instanceof Error ? error.message : "Unknown error"),
        );
      }
    }
  }

  /**
   * Map a {@link BookingMailType} enum to its corresponding React template.
   *
   * @internal Called by {@link sendBookingMail} only.
   */
  private pickTemplate(type: BookingMailType, payload) {
    switch (type) {
      case BookingMailType.Creation:
        return BookingCreationEmail(payload);
      case BookingMailType.Confirmation:
        return BookingConfirmationEmail(payload);
      case BookingMailType.Update:
        return BookingUpdateEmail(payload);
      case BookingMailType.Cancellation:
        return BookingCancelledEmail(payload);
      case BookingMailType.Rejection:
        return BookingRejectionEmail(payload);
      case BookingMailType.Deletion:
        return BookingDeleteMail(payload);
      case BookingMailType.ItemsReturned:
        return ItemsReturnedMail(payload);
      case BookingMailType.ItemsPickedUp:
        return ItemsPickedUpMail(payload);
      default:
        throw new Error(`Unknown BookingMailType: ${String(type)}`);
    }
  }

  /**
   * Finnish / English bilingual subject lines for each booking mail type.
   */
  private subjectLine(type: BookingMailType): string {
    switch (type) {
      case BookingMailType.Creation:
        return "Varaus vastaanotettu - Booking request received";
      case BookingMailType.Confirmation:
        return "Varaus vahvistettu - Booking confirmed";
      case BookingMailType.Update:
        return "Varaus päivitetty - Booking updated";
      case BookingMailType.Cancellation:
        return "Varaus peruttu - Booking cancelled";
      case BookingMailType.Rejection:
        return "Varaus hylätty - Booking rejected";
      case BookingMailType.Deletion:
        return "Varaus poistettu - Booking deleted";
      case BookingMailType.ItemsReturned:
        return "Palautetut tuotteet - Items returned";
      case BookingMailType.ItemsPickedUp:
        return "Noudetut tuotteet - Items picked up";
      default:
        return "Booking notification";
    }
  }

  /**
   * Send any booking‑related notification e‑mail in **one call**.
   *
   * `sendBookingMail` takes two arguments:
   *
   * | Name   | Type               | Description                                                    |
   * |--------|--------------------|----------------------------------------------------------------|
   * | `type` | {@link BookingMailType} | Enum value that selects which React template and subject line to use (Creation, Confirmation, Update, Cancellation, etc.). |
   * | `params` | {@link BookingMailParams} | Extra data required by the template. Currently:<br>• **bookingId** – UUID of the booking.<br>• **triggeredBy** – UID of the user (admin / owner) who performed the action. |
   *
   * @example
   * ```ts
   * await mailService.sendBookingMail(BookingMailType.Confirmation, {
   *   bookingId: "f6b1e3c1-0a2d-49d5‑b612‑dfece42d9a7c",
   *   triggeredBy: currentUserId,
   * });
   * ```
   */
  public async sendBookingMail(
    type: BookingMailType,
    params: BookingMailParams,
  ) {
    type EmailPayloadWithOptionalReturn = BookingEmailPayload & {
      returnDate?: string;
    };
    const rawPayload: EmailPayloadWithOptionalReturn =
      await this.assembler.buildPayload(params.bookingId);

    // Helper – turn ISO strings into "DD.MM.YYYY"
    const formatDate = (d: string | Date | null | undefined) =>
      d ? dayjs(d).format("DD.MM.YYYY") : "";

    const formattedPayload = {
      ...rawPayload,
      pickupDate: rawPayload.pickupDate, // already DD.MM.YYYY
      returnDate: rawPayload.returnDate, // already DD.MM.YYYY
      items: (rawPayload.items ?? []).map((item) => ({
        ...item,
        start_date: formatDate(item.start_date),
        end_date: formatDate(item.end_date),
      })),
    };

    const template = this.pickTemplate(type, formattedPayload);
    // For cancellation emails, the template expects bookingId, startDate, and recipientRole
    let finalTemplate = template;
    if (type === BookingMailType.Cancellation) {
      finalTemplate = BookingCancelledEmail({
        bookingId: params.bookingId,
        startDate: formattedPayload.pickupDate,
        items: formattedPayload.items,
        recipientRole: "user", // identical copy goes to admin via Bcc
      });
    }
    const subject = this.subjectLine(type);

    await this.sendMail({
      to: formattedPayload.recipient,
      bcc: process.env.BOOKING_ADMIN_EMAIL ?? process.env.EMAIL_FROM_2, // Send to admin as well
      subject,
      template: finalTemplate,
    });
  }
}
