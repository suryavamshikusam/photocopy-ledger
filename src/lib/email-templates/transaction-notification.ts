export interface TransactionEmailProps {
  studentName: string
  studentEmail: string
  type: 'deposit' | 'deduction'
  amount: number
  balanceAfter: number
  note: string
  transactionId?: string
  date?: string | Date
  appUrl?: string
}

export function generateTransactionEmail(props: TransactionEmailProps): {
  subject: string
  html: string
  text: string
} {
  const {
    studentName,
    type,
    amount,
    balanceAfter,
    note,
    transactionId = 'TXN-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    date = new Date(),
    appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  } = props

  const formattedDate = date instanceof Date 
    ? date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata'
      })
    : String(date)

  const isCorrection = note.startsWith('Correction by Admin:') || note.toLowerCase().includes('correction')
  const isDeposit = type === 'deposit'

  // Subject line (anti-spam compliant: specific, authentic, no hype words)
  let subject = ''
  if (isCorrection) {
    subject = `[Account Update] Photocopy Ledger Balance Adjustment: ₹${amount.toFixed(2)}`
  } else if (isDeposit) {
    subject = `[Receipt] ₹${amount.toFixed(2)} Added to your Photocopy Account`
  } else {
    subject = `[Receipt] ₹${amount.toFixed(2)} Deducted from your Photocopy Account`
  }

  // Theme colors based on transaction type
  let badgeBg = '#ecfdf5'
  let badgeColor = '#065f46'
  let badgeBorder = '#a7f3d0'
  let badgeText = 'CREDIT • FUNDS ADDED'
  let amountPrefix = '+'
  let amountColor = '#059669'

  if (isCorrection) {
    badgeBg = '#fffbeb'
    badgeColor = '#92400e'
    badgeBorder = '#fde68a'
    badgeText = 'ADMIN ADJUSTMENT'
    amountPrefix = isDeposit ? '+' : '-'
    amountColor = '#d97706'
  } else if (!isDeposit) {
    badgeBg = '#fef2f2'
    badgeColor = '#991b1b'
    badgeBorder = '#fecaca'
    badgeText = 'DEBIT • PHOTOCOPY CHARGE'
    amountPrefix = '-'
    amountColor = '#dc2626'
  }

  const isLowBalance = balanceAfter < 50
  const dashboardUrl = `${appUrl.replace(/\/$/, '')}/dashboard`

  // 1. Clean, structured Plain-text version (crucial for spam filter pass-through)
  const text = `
PHOTOCOPY LEDGER
Official Transaction Receipt
========================================

Hello ${studentName},

This is an official notification regarding a recent transaction on your Photocopy account.

TRANSACTION DETAILS:
----------------------------------------
• Type:            ${isCorrection ? 'Correction / Adjustment' : (isDeposit ? 'Deposit (Funds Added)' : 'Deduction (Photocopy Charge)')}
• Amount:          ${amountPrefix}₹${amount.toFixed(2)}
• Current Balance: ₹${balanceAfter.toFixed(2)}
• Reason / Note:   ${note}
• Date & Time:     ${formattedDate}
• Reference ID:    ${transactionId}

${isLowBalance ? '⚠️ ALERT: Your available balance is below ₹50.00. Please top up your account with the administrator.\n' : ''}
VIEW YOUR STATEMENT & PASSBOOK:
Access your full digital transaction history anytime by visiting:
${dashboardUrl}

----------------------------------------
This is an automated administrative notification. Please do not reply directly to this email.
Photocopy Ledger
`.trim()

  // 2. High-aesthetic, Anti-Spam optimized responsive HTML version
  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #1e293b;">
  
  <!-- Outer Wrapper Table -->
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; min-height: 100vh;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 28px 32px; color: #ffffff;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #ffffff; border-radius: 8px; width: 36px; height: 36px; text-align: center; vertical-align: middle;">
                          <span style="font-size: 20px; line-height: 36px;">🖨️</span>
                        </td>
                        <td style="padding-left: 12px;">
                          <div style="font-size: 17px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px; line-height: 1.2;">
                            Photocopy Ledger
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #0f172a;">
                Hello <strong>${studentName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #64748b;">
                Here is your official transaction summary for your Photocopy account.
              </p>

              <!-- Transaction Summary Card -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${badgeBg}; border: 1px solid ${badgeBorder}; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <span style="display: inline-block; background-color: #ffffff; color: ${badgeColor}; border: 1px solid ${badgeBorder}; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; padding: 4px 12px; border-radius: 20px; margin-bottom: 8px;">
                      ${badgeText}
                    </span>
                    <div style="font-size: 36px; font-weight: 800; color: ${amountColor}; letter-spacing: -1px; margin: 4px 0 8px 0; line-height: 1;">
                      ${amountPrefix}₹${amount.toFixed(2)}
                    </div>
                    <div style="font-size: 13px; color: #475569; font-weight: 500;">
                      Updated Balance: <strong style="color: #0f172a; font-size: 14px;">₹${balanceAfter.toFixed(2)}</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Details Table -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; border-spacing: 0; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; width: 35%;">
                    Description / Note
                  </td>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                    ${note}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                    Date & Time
                  </td>
                  <td style="padding: 12px 16px; font-size: 13px; color: #334155; border-bottom: 1px solid #e2e8f0;">
                    ${formattedDate}
                  </td>
                </tr>
                <tr style="background-color: #f8fafc;">
                  <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0;">
                    Transaction Type
                  </td>
                  <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: ${amountColor}; border-bottom: 1px solid #e2e8f0;">
                    ${isCorrection ? 'Adjustment' : (isDeposit ? 'Deposit' : 'Deduction')}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                    Reference ID
                  </td>
                  <td style="padding: 12px 16px; font-size: 12px; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; color: #475569; font-weight: 600;">
                    ${transactionId}
                  </td>
                </tr>
              </table>

              <!-- Low Balance Warning Banner (if applicable) -->
              ${isLowBalance ? `
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 16px; font-size: 13px; line-height: 18px; color: #92400e;">
                    <div style="font-weight: 600; margin-bottom: 2px;">⚠️ Low Balance Notice</div>
                    Your available balance is now <strong>₹${balanceAfter.toFixed(2)}</strong>. Please top up your balance with the administrator.
                  </td>
                </tr>
              </table>
              ` : ''}

              <!-- Call to Action Button -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 28px; margin-bottom: 8px;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center" style="border-radius: 8px; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);">
                          <a href="${dashboardUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.2px;">
                            View Ledger & Statement &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 16px 0 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
                Click the button above to view your full live statement history.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #475569;">
                Photocopy Ledger
              </p>
              <p style="margin: 0 0 10px 0; font-size: 11px; line-height: 16px; color: #94a3b8;">
                This is an automated transactional message generated by the Photocopy Ledger System.
              </p>
              <p style="margin: 0; font-size: 11px; color: #94a3b8;">
                🔒 Secure ledger service. Never disclose your account credentials to anyone.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Main Card Container -->

      </td>
    </tr>
  </table>
</body>
</html>
`.trim()

  return { subject, html, text }
}
