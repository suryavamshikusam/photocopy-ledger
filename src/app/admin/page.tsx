import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import AdminClient, { type AdminMetrics, type Profile } from "./AdminClient"
import { ShieldCheck } from "lucide-react"
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog"
import { SignOutButton } from "@/components/SignOutButton"
import { getInitials, isAdminCorrectionNote } from "@/lib/format"

type TransactionMetricRow = {
  type: 'deposit' | 'deduction'
  amount: string | number
  note: string | null
}

async function fetchAllTransactionsPaginated(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ rows: TransactionMetricRow[]; error: string | null }> {
  const PAGE_SIZE = 1000
  const allRows: TransactionMetricRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('transactions')
      .select('type, amount, note')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      return { rows: allRows, error: error.message }
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...(data as TransactionMetricRow[]))

    if (data.length < PAGE_SIZE) {
      break
    }

    from += PAGE_SIZE
  }

  return { rows: allRows, error: null }
}

export default async function AdminPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
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
  const { data: usersData, error: usersError } = await supabase
    .from('profiles')
    .select('id, full_name, email, current_balance')
    .eq('role', 'student')
    .order('full_name', { ascending: true })

  const users: Profile[] = (usersData || []).map((u) => ({
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    current_balance: parseFloat(String(u.current_balance)) || 0,
  }))

  let metrics: AdminMetrics = {
    totalDeposits: 0,
    totalSpent: 0,
    netBalance: 0,
    lowBalanceCount: 0,
  }
  let metricsError: string | null = null

  // Prefer server-side Postgres RPC aggregation; fall back to paginated fetch if RPC is not yet migrated
  const { data: rpcMetrics, error: rpcError } = await supabase.rpc('get_admin_metrics')

  if (!rpcError && Array.isArray(rpcMetrics) && rpcMetrics.length > 0) {
    const row = rpcMetrics[0]
    metrics = {
      totalDeposits: parseFloat(String(row.total_deposits)) || 0,
      totalSpent: parseFloat(String(row.total_spent)) || 0,
      netBalance: parseFloat(String(row.net_balance)) || 0,
      lowBalanceCount: Number(row.low_balance_count) || 0,
    }
  } else {
    const { rows: transactions, error: txError } = await fetchAllTransactionsPaginated(supabase)
    if (txError) {
      metricsError = txError
    }

    let totalDeposits = 0
    let totalSpent = 0

    for (const tx of transactions) {
      const amt = parseFloat(String(tx.amount)) || 0
      const note = tx.note || ''

      if (isAdminCorrectionNote(note)) {
        if (note.includes('entered as a deposit in error')) {
          totalDeposits += tx.type === 'deduction' ? -amt : amt
        } else if (note.includes('entered as a deduction in error')) {
          totalSpent += tx.type === 'deposit' ? -amt : amt
        } else if (tx.type === 'deposit') {
          totalDeposits += amt
        } else if (tx.type === 'deduction') {
          totalSpent += amt
        }
      } else if (tx.type === 'deposit') {
        totalDeposits += amt
      } else if (tx.type === 'deduction') {
        totalSpent += amt
      }
    }

    let netBalance = 0
    let lowBalanceCount = 0

    for (const u of users) {
      netBalance += u.current_balance
      if (u.current_balance < 50) lowBalanceCount++
    }

    metrics = {
      totalDeposits: Math.max(0, totalDeposits),
      totalSpent: Math.max(0, totalSpent),
      netBalance,
      lowBalanceCount,
    }
  }

  const initials = getInitials(profile.full_name)

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-slate-900">
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg border border-indigo-100 bg-white overflow-hidden shadow-md flex items-center justify-center">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              Photocopy Ledger{' '}
              <span className="text-indigo-600 ml-1 text-sm bg-indigo-100 px-2 py-0.5 rounded-full">
                Admin
              </span>
            </span>
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

        {(usersError || metricsError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            Some dashboard data failed to load: {usersError?.message || metricsError}
          </div>
        )}

        <AdminClient users={users} metrics={metrics} />
      </main>
    </div>
  )
}
