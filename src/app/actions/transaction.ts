'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { sendTransactionEmail, sendBulkTransactionEmails, testEmailConnection } from '@/lib/email'

export async function createTransaction(userId: string, type: 'deposit' | 'deduction', amount: number, note: string) {
  const supabase = await createClient()

  if (amount <= 0) {
    return { error: 'Amount must be greater than 0' }
  }

  // The database trigger 'process_xerox_transaction' handles validation,
  // balance calculation, and atomic updates. We just need to insert.
  const { data: txRecord, error } = await supabase
    .from('transactions')
    .insert({
      user_id: userId,
      type,
      amount,
      note,
      // admin_id and balance_after are handled by the DB trigger
    })
    .select('id, user_id, type, amount, balance_after, note, created_at')
    .single()

  if (error) {
    console.error('Transaction Error:', error)
    return { error: error.message || 'Failed to process transaction' }
  }

  // Fetch target student profile to get email and latest balance
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, current_balance')
    .eq('id', userId)
    .single()

  if (profile && profile.email) {
    const balanceAfter = txRecord?.balance_after !== undefined 
      ? parseFloat(txRecord.balance_after) 
      : parseFloat(profile.current_balance)

    console.log(`[Email Dispatching] Triggering receipt email to ${profile.email} (${profile.full_name})...`)

    // Await transactional email to guarantee delivery in server actions
    try {
      const emailRes = await sendTransactionEmail({
        studentName: profile.full_name,
        studentEmail: profile.email,
        type,
        amount,
        balanceAfter,
        note,
        transactionId: txRecord?.id ? `TXN-${txRecord.id.substring(0, 8).toUpperCase()}` : undefined,
        date: txRecord?.created_at ? new Date(txRecord.created_at) : new Date(),
      })
      if (!emailRes.success) {
        console.warn(`[Email Warning] Email not sent to ${profile.email}:`, emailRes.error)
      }
    } catch (err: any) {
      console.error('[Background Email Error]:', err?.message || err)
    }
  } else {
    console.warn(`[Email Warning] No email found for profile ID: ${userId}`)
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function createBulkTransactions(userIds: string[], type: 'deposit' | 'deduction', amount: number, note: string) {
  const supabase = await createClient()

  if (amount <= 0) {
    return { error: 'Amount must be greater than 0' }
  }

  if (!userIds || userIds.length === 0) {
    return { error: 'No users selected' }
  }

  // Create an array of transaction records to insert
  const transactions = userIds.map(userId => ({
    user_id: userId,
    type,
    amount,
    note,
  }))

  const { data: insertedList, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select('id, user_id, type, amount, balance_after, note, created_at')

  if (error) {
    console.error('Bulk Transaction Error:', error)
    return { error: error.message || 'Failed to process bulk transactions' }
  }

  // Fetch profiles for these users to send personalized receipts
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, email, current_balance')
    .in('id', userIds)

  if (profiles && profiles.length > 0) {
    const txMap = new Map((insertedList || []).map(tx => [tx.user_id, tx]))
    const emailPayloads = profiles
      .filter(p => p.email && p.email.includes('@'))
      .map(p => {
        const tx = txMap.get(p.id)
        const balanceAfter = tx?.balance_after !== undefined 
          ? parseFloat(tx.balance_after) 
          : parseFloat(p.current_balance)

        return {
          studentName: p.full_name,
          studentEmail: p.email,
          type,
          amount,
          balanceAfter,
          note,
          transactionId: tx?.id ? `TXN-${tx.id.substring(0, 8).toUpperCase()}` : undefined,
          date: tx?.created_at ? new Date(tx.created_at) : new Date(),
        }
      })

    // Await bulk email dispatching
    try {
      await sendBulkTransactionEmails(emailPayloads)
    } catch (err: any) {
      console.error('[Bulk Email Error]:', err?.message || err)
    }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function getUserTransactions(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching user transactions:', error)
    return { transactions: [], error: error.message }
  }

  return { transactions: data || [], error: null }
}

export async function sendTestEmailAction(testEmail: string) {
  return await testEmailConnection(testEmail)
}
