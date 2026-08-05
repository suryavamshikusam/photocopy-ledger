'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createTransaction(userId: string, type: 'deposit' | 'deduction', amount: number, note: string) {
  const supabase = await createClient()

  if (amount <= 0) {
    return { error: 'Amount must be greater than 0' }
  }

  // The database trigger 'process_xerox_transaction' handles validation,
  // balance calculation, and atomic updates. We just need to insert.
  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    type,
    amount,
    note,
    // admin_id and balance_after are handled by the DB trigger
  })

  if (error) {
    console.error('Transaction Error:', error)
    return { error: error.message || 'Failed to process transaction' }
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

  const { error } = await supabase.from('transactions').insert(transactions)

  if (error) {
    console.error('Bulk Transaction Error:', error)
    return { error: error.message || 'Failed to process bulk transactions' }
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
