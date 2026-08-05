import nodemailer from 'nodemailer'
import { generateTransactionEmail, TransactionEmailProps } from './email-templates/transaction-notification'

let transporter: nodemailer.Transporter | null = null

export function getEmailTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter

  // Check if Resend API key is provided
  if (process.env.RESEND_API_KEY) {
    transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    })
    return transporter
  }

  // Standard SMTP credentials (Gmail, Brevo, SendGrid, Amazon SES, Custom SMTP)
  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '465', 10)
  const secure = process.env.SMTP_SECURE === 'false' ? false : port === 465
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    console.warn('[Email Warning] SMTP_USER or SMTP_PASS not set in environment variables. Email notifications will be skipped.')
    return null
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    // Pool connections to improve performance and throughput
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  })

  return transporter
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
  skipped?: boolean
}

/**
 * Sends an official transaction receipt email to a student
 */
export async function sendTransactionEmail(props: TransactionEmailProps): Promise<SendEmailResult> {
  try {
    if (!props.studentEmail || !props.studentEmail.includes('@')) {
      return { success: false, error: 'Invalid recipient email address.' }
    }

    const { subject, html, text } = generateTransactionEmail(props)

    const fromAddress = process.env.SMTP_FROM || (
      process.env.RESEND_API_KEY
        ? '"Photocopy Ledger" <onboarding@resend.dev>'
        : (process.env.SMTP_USER 
            ? `"Photocopy Ledger" <${process.env.SMTP_USER}>`
            : '"Photocopy Ledger" <noreply@campusledger.local>')
    )

    // Option 1: Direct Resend API (Ultra-fast, zero-port blocking)
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [props.studentEmail],
          subject: subject,
          html: html,
          text: text,
          headers: {
            'X-Entity-Ref-ID': props.transactionId || `TX-${Date.now()}`,
          },
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || data.error?.message || `Resend Error: ${response.statusText}`)
      }

      console.log(`[Resend Success] Sent receipt to ${props.studentEmail} (Message ID: ${data.id})`)
      return { success: true, messageId: data.id }
    }

    // Option 2: Standard SMTP fallback
    const mailTransporter = getEmailTransporter()
    if (!mailTransporter) {
      return { success: false, skipped: true, error: 'Email service not configured (missing RESEND_API_KEY or SMTP credentials).' }
    }

    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: `"${props.studentName}" <${props.studentEmail}>`,
      subject,
      text,
      html,
      headers: {
        'X-Entity-Ref-ID': props.transactionId || `TX-${Date.now()}`,
        'X-Mailer': 'Photocopy Ledger Notification Engine',
      },
    })

    console.log(`[SMTP Success] Sent transaction notification to ${props.studentEmail} (Message ID: ${info.messageId})`)
    return { success: true, messageId: info.messageId }
  } catch (err: any) {
    console.error(`[Email Error] Failed to send email to ${props.studentEmail}:`, err?.message || err)
    return { success: false, error: err?.message || 'Failed to send email' }
  }
}

/**
 * Sends bulk transaction emails concurrently with batching to respect rate limits
 */
export async function sendBulkTransactionEmails(
  items: TransactionEmailProps[]
): Promise<{ total: number; sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  // Process in chunks of 5
  const chunkSize = 5
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const promises = chunk.map(async (item) => {
      const res = await sendTransactionEmail(item)
      if (res.success) {
        sent++
      } else {
        failed++
      }
    })
    await Promise.all(promises)
  }

  return { total: items.length, sent, failed }
}

/**
 * Verifies email configuration and sends a test email to the specified address
 */
export async function testEmailConnection(targetEmail: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!process.env.RESEND_API_KEY && !process.env.SMTP_USER) {
      return {
        success: false,
        message: 'Email credentials missing. Please set RESEND_API_KEY in .env.local',
      }
    }

    // Send a sample transaction receipt
    const testProps: TransactionEmailProps = {
      studentName: 'Admin Verification Test',
      studentEmail: targetEmail,
      type: 'deposit',
      amount: 100.0,
      balanceAfter: 250.0,
      note: 'Verification Test: Xerox & Photocopy Print Balance Top-Up',
      transactionId: 'TEST-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      date: new Date(),
    }

    const sendRes = await sendTransactionEmail(testProps)
    if (!sendRes.success) {
      return {
        success: false,
        message: `Email sending failed: ${sendRes.error}`,
      }
    }

    return {
      success: true,
      message: `Test email successfully dispatched to ${targetEmail}! Check your inbox.`,
    }
  } catch (err: any) {
    console.error('[Email Test Error]:', err)
    return {
      success: false,
      message: `Email dispatch failed: ${err?.message || 'Check your email credentials and network connection.'}`,
    }
  }
}
