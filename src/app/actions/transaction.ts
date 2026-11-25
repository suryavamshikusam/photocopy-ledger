'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type TransactionType = 'deposit' | 'deduction'

async function verifyAdminAccess(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return { error: 'Unauthorized: only admins can perform this action' }
  }

  return { error: null }
}

function normalizeAmount(amount: number): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null
  }
  const rounded = Math.round(amount * 100) / 100
  return rounded > 0 ? rounded : null
}

export async function createTransaction(
  userId: string,
  type: TransactionType,
  amount: number,
  note: string
) {
  const supabase = await createClient()

  const authCheck = await verifyAdminAccess(supabase)
  if (authCheck.error) {
    return { error: authCheck.error }
  }

  if (!userId || !userId.trim()) {
    return { error: 'Invalid student selected' }
  }

  if (type !== 'deposit' && type !== 'deduction') {
    return { error: 'Invalid transaction type' }
  }

  const cleanAmount = normalizeAmount(amount)
  if (cleanAmount === null) {
    return { error: 'Amount must be a valid number greater than 0' }
  }

  const trimmedNote = (note ?? '').trim()
  if (!trimmedNote) {
    return { error: 'Note/Reason is mandatory' }
  }

  // The database trigger 'process_xerox_transaction' handles validation,
  // balance calculation, and atomic updates.
  const { error } = await supabase.from('transactions').insert({
    user_id: userId,
    type,
    amount: cleanAmount,
    note: trimmedNote,
  })

  if (error) {
    console.error('Transaction Error:', error)
    return { error: error.message || 'Failed to process transaction' }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function createBulkTransactions(
  userIds: string[],
  type: TransactionType,
  amount: number,
  note: string
) {
  const supabase = await createClient()

  const authCheck = await verifyAdminAccess(supabase)
  if (authCheck.error) {
    return { error: authCheck.error }
  }

  if (type !== 'deposit' && type !== 'deduction') {
    return { error: 'Invalid transaction type' }
  }

  const cleanAmount = normalizeAmount(amount)
  if (cleanAmount === null) {
    return { error: 'Amount must be a valid number greater than 0' }
  }

  const trimmedNote = (note ?? '').trim()
  if (!trimmedNote) {
    return { error: 'Note/Reason is mandatory' }
  }

  const uniqueUserIds = Array.from(new Set((userIds ?? []).filter((id) => id?.trim())))
  if (uniqueUserIds.length === 0) {
    return { error: 'No users selected' }
  }

  const transactions = uniqueUserIds.map((userId) => ({
    user_id: userId,
    type,
    amount: cleanAmount,
    note: trimmedNote,
  }))

  const { error } = await supabase.from('transactions').insert(transactions)

  if (error) {
    console.error('Bulk Transaction Error:', error)
    return { error: error.message || 'Failed to process bulk transactions' }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function getUserTransactions(userId: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { transactions: [], error: 'Not authenticated' }
  }

  if (!userId || !userId.trim()) {
    return { transactions: [], error: 'Invalid user ID' }
  }

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
