import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { ReceiptText, Wallet } from "lucide-react"
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog"
import { SignOutButton } from "@/components/SignOutButton"

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch student profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return <div>Error loading profile.</div>
  }

  // Fetch transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const balance = parseFloat(profile.current_balance)
  
  // Extract initials for avatar
  const initials = profile.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()

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

      <main className="max-w-5xl mx-auto p-6 space-y-8 pt-10">
        
        {/* Welcome Section */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Welcome back, {profile.full_name.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground">
            Here's a summary of your print balance and recent activity.
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
            
            <div className={`text-6xl font-extrabold tracking-tight ${balance < 50 ? (balance <= 0 ? 'text-red-300' : 'text-orange-200') : 'text-white'}`}>
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
            {(!transactions || transactions.length === 0) ? (
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
                    <TableHead className="pl-6 h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Date & Time</TableHead>
                    <TableHead className="h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Type</TableHead>
                    <TableHead className="h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Note</TableHead>
                    <TableHead className="text-right h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Amount</TableHead>
                    <TableHead className="text-right pr-6 h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Balance After</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx: any) => (
                    <TableRow key={tx.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors border-zinc-100 dark:border-zinc-800/50">
                      <TableCell className="pl-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                        {format(new Date(tx.created_at), 'MMM d, yyyy • h:mm a')}
                      </TableCell>
                      <TableCell className="py-4">
                        {tx.note?.startsWith('Correction by Admin:') || tx.note?.toLowerCase().includes('correction') ? (
                          <Badge 
                            variant="outline" 
                            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400 font-medium"
                          >
                            Correction
                          </Badge>
                        ) : (
                          <Badge 
                            variant="outline" 
                            className={tx.type === 'deposit' 
                              ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400 font-medium' 
                              : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400 font-medium'
                            }
                          >
                            {tx.type === 'deposit' ? 'Deposit' : 'Deduction'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-sm text-slate-600 dark:text-slate-400">{tx.note}</TableCell>
                      <TableCell className={`py-4 text-right text-sm font-bold ${
                        tx.note?.startsWith('Correction by Admin:')
                          ? (tx.type === 'deposit' ? 'text-amber-600 dark:text-amber-400' : 'text-amber-700 dark:text-amber-500')
                          : (tx.type === 'deposit' ? 'text-green-600 dark:text-green-500' : 'text-slate-900 dark:text-white')
                      }`}>
                        {tx.type === 'deposit' ? '+' : '-'}₹{parseFloat(tx.amount).toFixed(2)}
                      </TableCell>
                      <TableCell className="pr-6 py-4 text-right text-sm font-semibold text-slate-500 dark:text-slate-400">
                        ₹{parseFloat(tx.balance_after).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
