'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ReceiptText, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatLedgerDate, isAdminCorrectionNote } from '@/lib/format'
import { toast } from 'sonner'

export type DashboardTransactionRow = {
  id: string
  type: 'deposit' | 'deduction'
  amount: string | number
  balance_after: string | number
  note: string | null
  created_at: string
}

type Props = {
  userId: string
  firstName: string
  initialBalance: number
  initialTransactions: DashboardTransactionRow[]
  initialTransactionsError: string | null
}

export function DashboardLiveClient({
  userId,
  firstName,
  initialBalance,
  initialTransactions,
  initialTransactionsError,
}: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [balance, setBalance] = useState<number>(initialBalance)
  const [transactions, setTransactions] = useState<DashboardTransactionRow[]>(initialTransactions)

  useEffect(() => {
    setBalance(initialBalance)
  }, [initialBalance])

  useEffect(() => {
    setTransactions(initialTransactions)
  }, [initialTransactions])

  useEffect(() => {
    const channel = supabase
      .channel(`student-ledger-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as DashboardTransactionRow
          if (!row?.id) return

          setTransactions((prev) => (prev.some((t) => t.id === row.id) ? prev : [row, ...prev]))

          const nextBalance = parseFloat(String(row.balance_after))
          if (Number.isFinite(nextBalance)) {
            setBalance(nextBalance)
          }

          const amt = (parseFloat(String(row.amount)) || 0).toFixed(2)
          if (row.type === 'deposit') {
            toast.success(`+₹${amt} credited to your balance`)
          } else {
            toast.info(`-₹${amt} deducted: ${row.note ?? 'Print charge'}`)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as { current_balance?: string | number }
          if (updated?.current_balance !== undefined) {
            const parsed = parseFloat(String(updated.current_balance))
            if (Number.isFinite(parsed)) {
              setBalance(parsed)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, userId])

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8 pt-10">
      {/* Welcome Section */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Welcome back, {firstName} 👋
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s a summary of your print balance and recent activity.
        </p>
      </div>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-800 p-8 text-white shadow-xl shadow-indigo-500/20">
        <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
          <Wallet className="w-32 h-32 transform rotate-12" />
        </div>

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-indigo-100 font-medium">
            <Wallet className="h-5 w-5" />
            Available Balance
          </div>

          <div
            className={`text-6xl font-extrabold tracking-tight transition-colors ${
              balance < 50 ? (balance <= 0 ? 'text-red-300' : 'text-orange-200') : 'text-white'
            }`}
          >
            ₹{balance.toFixed(2)}
          </div>

          {balance < 50 && (
            <div className="mt-2 text-sm font-medium text-orange-200 bg-black/20 self-start px-3 py-1.5 rounded-full backdrop-blur-sm">
              ⚠️ Your balance is running low. Please top up soon.
            </div>
          )}
        </div>
      </div>

      {/* History Table Card */}
      <Card className="border-0 shadow-lg shadow-zinc-200/50 dark:shadow-none dark:border dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md">
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800/50 pb-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <CardTitle className="text-xl">History</CardTitle>
          </div>
          <CardDescription className="pt-1">Your recent deposits and deductions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {initialTransactionsError ? (
            <div className="p-6 text-sm text-red-600 dark:text-red-400">
              Unable to load transaction history: {initialTransactionsError}
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <ReceiptText className="w-8 h-8 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No transactions yet</h3>
              <p className="text-sm text-muted-foreground mt-1">When you add funds or print, they will appear here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800/50">
                  <TableHead className="pl-6 h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">
                    Date & Time
                  </TableHead>
                  <TableHead className="h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Type</TableHead>
                  <TableHead className="h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Note</TableHead>
                  <TableHead className="text-right h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">
                    Amount
                  </TableHead>
                  <TableHead className="text-right pr-6 h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">
                    Balance After
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const isCorrection = isAdminCorrectionNote(tx.note)
                  return (
                    <TableRow
                      key={tx.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors border-zinc-100 dark:border-zinc-800/50"
                    >
                      <TableCell className="pl-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                        {formatLedgerDate(tx.created_at)}
                      </TableCell>
                      <TableCell className="py-4">
                        {isCorrection ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400 font-medium"
                          >
                            Correction
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              tx.type === 'deposit'
                                ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400 font-medium'
                                : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400 font-medium'
                            }
                          >
                            {tx.type === 'deposit' ? 'Deposit' : 'Deduction'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">{tx.note}</TableCell>
                      <TableCell
                        className={`py-4 text-right text-sm font-bold ${
                          isCorrection
                            ? tx.type === 'deposit'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-amber-700 dark:text-amber-500'
                            : tx.type === 'deposit'
                              ? 'text-green-600 dark:text-green-500'
                              : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {tx.type === 'deposit' ? '+' : '-'}₹{(parseFloat(String(tx.amount)) || 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="pr-6 py-4 text-right text-sm font-semibold text-slate-500 dark:text-slate-400">
                        ₹{(parseFloat(String(tx.balance_after)) || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

