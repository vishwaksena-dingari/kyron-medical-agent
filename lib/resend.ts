import { Resend } from 'resend'
import { generateICS } from '@/lib/utils'

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendConfirmationParams {
    appointmentId: string
    patientName: string
    patientEmail: string
    doctorName: string
    specialty: string
    slotLabel: string
    slotDatetime: string
    officeAddress: string
}

export async function sendConfirmationEmail(
    params: SendConfirmationParams
): Promise<void> {
    const icsContent = generateICS({
        appointmentId: params.appointmentId,
        patientName: params.patientName,
        doctorName: params.doctorName,
        specialty: params.specialty,
        datetime: params.slotDatetime,
        durationMinutes: 30,
        address: params.officeAddress,
    })

    const firstName = params.patientName.split(' ')[0]
    const specialtyDisplay =
        params.specialty.charAt(0).toUpperCase() + params.specialty.slice(1)

    const html = buildEmailHTML({
        ...params,
        firstName,
        specialtyDisplay,
    })

    await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'Kyron Medical <noreply@kyronmedical.com>',
        to: params.patientEmail,
        subject: `Appointment Confirmed — ${params.slotLabel}`,
        html,
        attachments: [
            {
                filename: `kyron-appointment-${params.appointmentId}.ics`,
                content: Buffer.from(icsContent).toString('base64'),
            },
        ],
    })
}

// ─── Email HTML template ──────────────────────────────────────────────────────

function buildEmailHTML(p: SendConfirmationParams & {
    firstName: string
    specialtyDisplay: string
}): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>Appointment Confirmed</title>
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1D4ED8 0%,#2563EB 100%);padding:32px 36px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
        <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:white;font-size:16px;">✦</span>
        </div>
        <span style="color:rgba(255,255,255,0.9);font-size:15px;font-weight:600;letter-spacing:-0.3px;">Kyron Medical</span>
      </div>
      <h1 style="color:white;font-size:26px;font-weight:700;margin:0 0 6px;letter-spacing:-0.5px;">Appointment Confirmed</h1>
      <p style="color:rgba(255,255,255,0.75);margin:0;font-size:14px;">Confirmation #${p.appointmentId}</p>
    </div>

    <!-- Body -->
    <div style="background:white;padding:36px;">
      <p style="font-size:16px;color:#1E293B;margin:0 0 24px;">Hi ${p.firstName},</p>
      <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 28px;">
        Your appointment is confirmed! We're looking forward to seeing you. Here are your details:
      </p>

      <!-- Appointment card -->
      <div style="background:#F8FAFF;border:1px solid #DBEAFE;border-radius:12px;padding:24px;margin-bottom:28px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;width:40%;">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;">Provider</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;">
              <span style="font-size:14px;font-weight:600;color:#1E293B;">${p.doctorName}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;">Specialty</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;">
              <span style="font-size:14px;color:#2563EB;font-weight:500;">${p.specialtyDisplay}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;">Date & Time</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;">
              <span style="font-size:14px;font-weight:600;color:#1E293B;">${p.slotLabel}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;">Location</span>
            </td>
            <td style="padding:8px 0;border-bottom:1px solid #E2E8F0;">
              <span style="font-size:14px;color:#1E293B;">${p.officeAddress}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#64748B;">Duration</span>
            </td>
            <td style="padding:8px 0;">
              <span style="font-size:14px;color:#1E293B;">30 minutes</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Calendar CTA -->
      <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:16px 20px;margin-bottom:28px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:20px;">📅</span>
        <div>
          <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1E40AF;">Calendar invite attached</p>
          <p style="margin:0;font-size:13px;color:#3B82F6;">Open the attached .ics file to add this appointment to Google Calendar, Apple Calendar, or Outlook.</p>
        </div>
      </div>

      <p style="font-size:14px;color:#64748B;line-height:1.6;margin:0 0 8px;">
        <strong>Need to reschedule or cancel?</strong> Call us at <a href="tel:+14015550192" style="color:#2563EB;text-decoration:none;">(401) 555-0192</a> at least 24 hours in advance.
      </p>
      <p style="font-size:14px;color:#64748B;line-height:1.6;margin:0;">
        Please arrive 15 minutes early to complete any required paperwork.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#F8FAFC;padding:20px 36px;border-top:1px solid #E2E8F0;">
      <p style="font-size:12px;color:#94A3B8;margin:0 0 4px;">Kyron Medical · Patient Portal</p>
      <p style="font-size:12px;color:#94A3B8;margin:0;">
        593 Eddy Street, Providence, RI 02903 · <a href="tel:+14015550192" style="color:#94A3B8;">(401) 555-0192</a>
      </p>
      <p style="font-size:11px;color:#CBD5E1;margin:12px 0 0;">
        This is an automated message. Please do not reply to this email. This message is not a substitute for professional medical advice.
      </p>
    </div>

  </div>
</body>
</html>`
}
