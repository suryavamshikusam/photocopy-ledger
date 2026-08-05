export interface TransactionNotificationEmailProps {
  studentName: string
  studentEmail: string
  type: 'deposit' | 'deduction'
  amount: number
  balanceAfter: number
  note: string
  transactionId?: string
  date?: Date
  appUrl?: string
}

export function generateTransactionNotificationEmail(props: TransactionNotificationEmailProps): {
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
    transactionId = `TX-${Date.now()}`,
    date = new Date(),
    appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://photocopy-ledger.vercel.app',
  } = props

  const isDeposit = type === 'deposit'
  const isCorrection = note.toLowerCase().includes('correction') || note.toLowerCase().includes('mistake')
  const formattedAmount = `₹${amount.toFixed(2)}`
  const formattedBalance = `₹${balanceAfter.toFixed(2)}`
  const formattedDate = date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  // Email subject line
  let subject = ''
  if (isCorrection) {
    subject = `[Balance Adjusted] ${formattedAmount} Photocopy Account Correction`
  } else if (isDeposit) {
    subject = `[Receipt] ${formattedAmount} Added to your Photocopy Account`
  } else {
    subject = `[Receipt] ${formattedAmount} Deducted from your Photocopy Account`
  }

  // Theme accents based on transaction type
  let badgeBg = '#ecfdf5'
  let badgeColor = '#065f46'
  let badgeBorder = '#a7f3d0'
  let badgeText = 'BALANCE CREDITED'
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
    badgeText = 'ACCOUNT DEDUCTION'
    amountPrefix = '-'
    amountColor = '#dc2626'
  }

  // 1. Clean, structured Plain-text version (crucial for spam filter pass-through)
  const text = `
PHOTOCOPY LEDGER
Official Transaction Receipt
========================================

Hello ${studentName},

This is an official notification regarding a recent transaction on your campus photocopy account.

TRANSACTION DETAILS:
----------------------------------------
• Type: ${badgeText}
• Amount: ${amountPrefix}${formattedAmount}
• Note / Purpose: ${note}
• Reference ID: ${transactionId}
• Date & Time: ${formattedDate}

UPDATED ACCOUNT BALANCE:
----------------------------------------
Current Available Balance: ${formattedBalance}

View your live ledger passbook anytime:
${appUrl}/dashboard

----------------------------------------
Photocopy Ledger • Campus Printing & Account Management
Automated notification. Please do not reply directly to this email.
`.trim()

  // 2. High-deliverability HTML template (Responsive, Bulletproof Inline CSS)
  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="format-detection" content="telephone=no" />
  <title>${subject}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <center style="width: 100%; table-layout: fixed; background-color: #f1f5f9; padding: 32px 16px;">
    <div style="max-width: 560px; margin: 0 auto;">
      
      <!-- MAIN CONTAINER -->
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); text-align: left;">
        
        <!-- HEADER -->
        <tr>
          <td style="padding: 24px 32px; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="width: 40px; height: 40px; background-color: rgba(255, 255, 255, 0.15); border-radius: 10px; text-align: center; vertical-align: middle;">
                        <span style="font-size: 20px; line-height: 40px; display: inline-block;">🖨️</span>
                      </td>
                      <td style="padding-left: 12px;">
                        <div style="color: #ffffff; font-size: 18px; font-weight: 700; letter-spacing: -0.3px; margin: 0;">Photocopy Ledger</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="text-align: right;">
                  <span style="display: inline-block; padding: 4px 10px; background-color: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 20px; font-size: 11px; font-weight: 600; color: #ffffff; letter-spacing: 0.5px;">OFFICIAL RECEIPT</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- HERO / AMOUNT HIGHLIGHT -->
        <tr>
          <td style="padding: 32px 32px 20px 32px; text-align: center; border-bottom: 1px solid #f1f5f9;">
            <div style="display: inline-block; padding: 6px 14px; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; border-radius: 24px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px;">
              ${badgeText}
            </div>
            <div style="font-size: 38px; font-weight: 800; color: ${amountColor}; letter-spacing: -1px; margin: 4px 0 6px 0;">
              ${amountPrefix}${formattedAmount}
            </div>
            <div style="font-size: 14px; color: #64748b; margin: 0;">
              Processed for <strong style="color: #1e293b;">${studentName}</strong>
            </div>
          </td>
        </tr>

        <!-- TRANSACTION BREAKDOWN TABLE -->
        <tr>
          <td style="padding: 24px 32px;">
            <div style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">Transaction Details</div>
            
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; border-spacing: 0; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
              <tr>
                <td style="padding: 12px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Reference ID</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #334155; text-align: right; border-bottom: 1px solid #e2e8f0; font-family: monospace;">${transactionId}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Date & Time</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 500; color: #334155; text-align: right; border-bottom: 1px solid #e2e8f0;">${formattedDate}</td>
              </tr>
              <tr>
                <td style="padding: 12px 16px; font-size: 13px; color: #64748b; border-bottom: 1px solid #e2e8f0;">Purpose / Note</td>
                <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right; border-bottom: 1px solid #e2e8f0;">${note}</td>
              </tr>
              <tr style="background-color: #ffffff;">
                <td style="padding: 14px 16px; font-size: 14px; font-weight: 700; color: #0f172a;">Updated Balance</td>
                <td style="padding: 14px 16px; font-size: 17px; font-weight: 800; color: #1e1b4b; text-align: right;">${formattedBalance}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ACTION BUTTON -->
        <tr>
          <td style="padding: 0 32px 28px 32px; text-align: center;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center">
                  <a href="${appUrl}/dashboard" target="_blank" style="display: inline-block; padding: 13px 28px; background: linear-gradient(135deg, #4338ca 0%, #3730a3 100%); color: #ffffff; text-decoration: none; border-radius: 10px; font-size: 14px; font-weight: 600; letter-spacing: 0.2px; box-shadow: 0 2px 6px rgba(67, 56, 202, 0.35);">
                    View Ledger & Statement &rarr;
                  </a>
                </td>
              </tr>
            </table>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 12px;">
              Access your full history, breakdown, and statement live on the student portal.
            </div>
          </td>
        </tr>

        <!-- SECURITY FOOTER -->
        <tr>
          <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 16px 16px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-size: 11px; line-height: 16px; color: #94a3b8; text-align: center;">
                  🛡️ This is an automated system notification for your photocopy ledger account.<br />
                  If you have any questions about this charge, please visit the campus counter.<br />
                  <span style="color: #cbd5e1;">• • •</span><br />
                  &copy; ${date.getFullYear()} Photocopy Ledger. All rights reserved.
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

    </div>
  </center>
</body>
</html>
`.trim()

  return { subject, html, text }
}
