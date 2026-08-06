import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AdminClient from "./AdminClient"
import { ShieldCheck } from "lucide-react"
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog"
import { SignOutButton } from "@/components/SignOutButton"

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Double check role for security
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    redirect('/dashboard')
  }

  // Fetch all students
  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'student')
    .order('full_name', { ascending: true })

  // Fetch all transactions to calculate global metrics
  const { data: transactions } = await supabase
    .from('transactions')
    .select('type, amount, note')

  let totalDeposits = 0
  let totalSpent = 0

  if (transactions) {
    transactions.forEach(tx => {
      const amt = parseFloat(tx.amount)
      const note = tx.note || ''
      const isCorrection = note.startsWith('Correction by Admin:') || note.toLowerCase().includes('correction')

      if (isCorrection) {
        // If the error was on a deposit
        if (note.includes('entered as a deposit in error') || (!note.includes('entered as a deduction in error') && tx.type === 'deduction')) {
          if (tx.type === 'deduction') {
            // Over-deposited initially -> deducting the excess, so reduce totalDeposits (NOT counted as spent)
            totalDeposits -= amt
          } else {
            // Under-deposited initially -> depositing the missing portion
            totalDeposits += amt
          }
        } 
        // If the error was on a deduction (actual printing spent)
        else if (note.includes('entered as a deduction in error')) {
          if (tx.type === 'deposit') {
            // Over-deducted initially -> refunding the excess, so reduce totalSpent
            totalSpent -= amt
          } else {
            // Under-deducted initially -> deducting the missing portion
            totalSpent += amt
          }
        }
      } else {
        // Regular transactions
        if (tx.type === 'deposit') {
          totalDeposits += amt
        } else if (tx.type === 'deduction') {
          totalSpent += amt
        }
      }
    })
  }

  totalDeposits = Math.max(0, totalDeposits)
  totalSpent = Math.max(0, totalSpent)

  let netBalance = 0
  let lowBalanceCount = 0

  if (users) {
    users.forEach(u => {
      const bal = parseFloat(u.current_balance)
      netBalance += bal
      if (bal < 50) lowBalanceCount++
    })
  }

  const metrics = {
    totalDeposits,
    totalSpent,
    netBalance,
    lowBalanceCount
  }

  const initials = profile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-slate-900">
      
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg border border-indigo-100 bg-white overflow-hidden shadow-md flex items-center justify-center">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-lg tracking-tight">Photocopy Ledger <span className="text-indigo-600 ml-1 text-sm bg-indigo-100 px-2 py-0.5 rounded-full">Admin</span></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium hidden sm:inline-block">
              {profile.full_name}
            </span>
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center text-xs">
              {initials}
            </div>
            <div className="flex items-center">
              <ChangePasswordDialog />
              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8 pt-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-indigo-600" />
            Admin Overview
          </h1>
        </div>

        <AdminClient users={users || []} metrics={metrics} />
      </main>
    </div>
  )
}
