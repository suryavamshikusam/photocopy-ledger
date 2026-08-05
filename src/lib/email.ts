import nodemailer from 'nodemailer'
import { generateTransactionNotificationEmail, TransactionNotificationEmailProps } from './email-templates/transaction-notification'

export interface TransactionEmailProps extends Omit<TransactionNotificationEmailProps, 'appUrl'> {
  // Can be extended with specific overrides if needed
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

let transporter: nodemailer.Transporter | null = null

/**
 * Creates or reuses a pooled Nodemailer SMTP transporter
 */
function getEmailTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = parseInt(process.env.SMTP_PORT || '465', 10)
  const secure = process.env.SMTP_SECURE === 'true' || port === 465
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    console.warn('[Email Warning] SMTP_USER or SMTP_PASS not configured. Emails will be skipped.')
    return null
  }

  try {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: user.trim(),
        pass: pass.trim().replace(/\s+/g, ''), // Strip spaces from Google app passwords
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })

    return transporter
  } catch (err: any) {
    console.error('[Email Init Error]:', err?.message || err)
    return null
  }
}

/**
 * Sends an official transaction receipt email to a student via SMTP
 */
export async function sendTransactionEmail(props: TransactionEmailProps): Promise<SendEmailResult> {
  try {
    if (!props.studentEmail || !props.studentEmail.includes('@')) {
      return { success: false, error: 'Invalid recipient email address' }
    }

    const mailTransporter = getEmailTransporter()
    if (!mailTransporter) {
      return { success: false, error: 'Email transporter is not configured' }
    }

    const { subject, html, text } = generateTransactionNotificationEmail(props)
    const fromAddress = process.env.SMTP_FROM || `"Photocopy Ledger" <${process.env.SMTP_USER}>`

    const info = await mailTransporter.sendMail({
      from: fromAddress,
      to: `"${props.studentName}" <${props.studentEmail}>`,
      subject,
      text,
      html,
      headers: {
        'X-Entity-Ref-ID': props.transactionId || `TX-${Date.now()}`,
      },
    })

    console.log(`[SMTP Success] Sent receipt to ${props.studentEmail} (Message ID: ${info.messageId})`)
    return { success: true, messageId: info.messageId }
  } catch (err: any) {
    console.error(`[SMTP Error] Failed to send email to ${props.studentEmail}:`, err?.message || err)
    return { success: false, error: err?.message || 'Failed to send email' }
  }
}

/**
 * Sends transaction receipt emails to multiple students in controlled concurrent batches
 */
export async function sendBulkTransactionEmails(
  transactions: TransactionEmailProps[],
  batchSize = 5
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize)
    const results = await Promise.allSettled(batch.map((tx) => sendTransactionEmail(tx)))

    results.forEach((res, index) => {
      if (res.status === 'fulfilled' && res.value.success) {
        sent++
      } else {
        failed++
        const errorMsg =
          res.status === 'fulfilled'
            ? res.value.error || 'Unknown dispatch error'
            : (res.reason as any)?.message || 'Network exception'
        errors.push(`${batch[index].studentEmail}: ${errorMsg}`)
      }
    })

    // Small delay between batches to respect rate limits
    if (i + batchSize < transactions.length) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  console.log(`[Bulk SMTP Result] Sent: ${sent}, Failed: ${failed}`)
  return { sent, failed, errors }
}

/**
 * Diagnostic function to test SMTP credentials
 */
export async function testEmailConnection(testRecipient: string): Promise<SendEmailResult> {
  const mailTransporter = getEmailTransporter()
  if (!mailTransporter) {
    return { 
      success: false, 
      error: 'SMTP credentials missing in .env (SMTP_USER or SMTP_PASS not set)' 
    }
  }

  return sendTransactionEmail({
    studentName: 'Test Student',
    studentEmail: testRecipient,
    type: 'deposit',
    amount: 100.0,
    balanceAfter: 100.0,
    note: 'System Diagnostic Test Receipt',
    transactionId: 'TX-TEST-001',
    date: new Date(),
  })
}
