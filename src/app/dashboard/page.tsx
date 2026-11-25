import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ShieldCheck } from "lucide-react"
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog"
import { SignOutButton } from "@/components/SignOutButton"
import { getInitials } from "@/lib/format"
import { DashboardLiveClient, type DashboardTransactionRow } from "./DashboardLiveClient"

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch profile and transaction history in parallel for faster page loads
  const [
    { data: profile },
    { data: transactionsData, error: transactionsError },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('transactions')
      .select('id, type, amount, balance_after, note, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Profile Unavailable</CardTitle>
            <CardDescription>
              We couldn&apos;t load your student profile. Please contact the administrator or sign out and try again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <SignOutButton />
          </CardContent>
        </Card>
      </div>
    )
  }

  const transactions: DashboardTransactionRow[] =
    (transactionsData as DashboardTransactionRow[] | null) ?? []
  const balance = parseFloat(String(profile.current_balance)) || 0
  const initials = getInitials(profile.full_name)
  const firstName = (profile.full_name || 'Student').trim().split(/\s+/)[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-950 dark:to-slate-900">
      {/* Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/60 dark:bg-zinc-950/60 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg border border-indigo-100 bg-white overflow-hidden shadow-md flex items-center justify-center">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-lg tracking-tight">Photocopy Ledger</span>
          </div>
          <div className="flex items-center gap-4">
            {profile.role === 'admin' && (
              <Link
                href="/admin"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 px-3 py-1.5 rounded-full transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Admin Panel
              </Link>
            )}
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

      <DashboardLiveClient
        userId={user.id}
        firstName={firstName}
        initialBalance={balance}
        initialTransactions={transactions}
        initialTransactionsError={transactionsError?.message ?? null}
      />
    </div>
  )
}
