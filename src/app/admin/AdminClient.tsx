'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { createTransaction, createBulkTransactions, getUserTransactions } from '../actions/transaction'
import { Search, Users, ReceiptText, Loader2, Filter, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { AppleSpinner, AppleLoadingCard } from '@/components/ui/apple-spinner'
import Fuse from 'fuse.js'

type Profile = {
  id: string;
  full_name: string;
  email: string;
  current_balance: number;
}

export default function AdminClient({ users, metrics }: { users: Profile[], metrics: any }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [balanceFilter, setBalanceFilter] = useState<string>('all')
  const [balanceSortOrder, setBalanceSortOrder] = useState<'none' | 'asc' | 'desc'>('none')
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [isBulkMatchDialogOpen, setIsBulkMatchDialogOpen] = useState(false)
  const [bulkMatchText, setBulkMatchText] = useState('')
  const [matchingLoading, setMatchingLoading] = useState(false)
  const [fuzzyMatches, setFuzzyMatches] = useState<Array<{
    original: string;
    matchedProfile: Profile | null;
    selected: boolean;
  }>>([])
  const [loading, setLoading] = useState(false)
  
  const [txType, setTxType] = useState<string>('deposit')
  const [bulkTxType, setBulkTxType] = useState<string>('deposit')
  
  // History modal state
  const [historyUser, setHistoryUser] = useState<Profile | null>(null)
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [userTransactions, setUserTransactions] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Selection state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())

  const filteredUsers = useMemo(() => {
    let result = users.filter(u => {
      const matchesSearch = 
        u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
      
      if (!matchesSearch) return false

      const bal = parseFloat(u.current_balance as unknown as string) || 0
      if (balanceFilter === 'low') {
        return bal < 50
      } else if (balanceFilter === 'critical') {
        return bal <= 0
      } else if (balanceFilter === 'healthy') {
        return bal >= 50
      }
      return true
    })

    if (balanceSortOrder === 'asc') {
      result = [...result].sort((a, b) => (parseFloat(a.current_balance as unknown as string) || 0) - (parseFloat(b.current_balance as unknown as string) || 0))
    } else if (balanceSortOrder === 'desc') {
      result = [...result].sort((a, b) => (parseFloat(b.current_balance as unknown as string) || 0) - (parseFloat(a.current_balance as unknown as string) || 0))
    }

    return result
  }, [users, searchTerm, balanceFilter, balanceSortOrder])

  const handleOpenDialog = (user: Profile) => {
    setSelectedUser(user)
    setIsDialogOpen(true)
  }

  const handleOpenHistory = async (user: Profile) => {
    setHistoryUser(user)
    setIsHistoryDialogOpen(true)
    setHistoryLoading(true)
    const res = await getUserTransactions(user.id)
    if (res.error) {
      toast.error('Failed to load transaction history')
    } else {
      setUserTransactions(res.transactions)
    }
    setHistoryLoading(false)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredUsers.map(u => u.id))
      setSelectedUserIds(allIds)
    } else {
      setSelectedUserIds(new Set())
    }
  }

  const handleSelectUser = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedUserIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedUserIds(newSelected)
  }

  const handleBulkMatch = async () => {
    const names = bulkMatchText.split('\n').map(n => n.trim()).filter(n => n)
    if (names.length === 0) return

    setMatchingLoading(true)
    await new Promise(r => setTimeout(r, 150))

    const fuse = new Fuse(users, {
      keys: ['full_name', 'email'],
      threshold: 0.4,
    })

    const matches = names.map(name => {
      const result = fuse.search(name)
      return {
        original: name,
        matchedProfile: result.length > 0 ? result[0].item : null,
        selected: result.length > 0
      }
    })

    setFuzzyMatches(matches)
    setMatchingLoading(false)
  }

  const confirmBulkMatch = () => {
    const newSelected = new Set(selectedUserIds)
    fuzzyMatches.forEach(m => {
      if (m.selected && m.matchedProfile) {
        newSelected.add(m.matchedProfile.id)
      }
    })
    setSelectedUserIds(newSelected)
    setIsBulkMatchDialogOpen(false)
    setBulkMatchText('')
    setFuzzyMatches([])
    toast.success('Students added to selection')
  }

  const handleTransaction = async (formData: FormData) => {
    if (!selectedUser) return
    setLoading(true)

    const type = formData.get('type') as 'deposit' | 'deduction' | 'correction'
    let finalType: 'deposit' | 'deduction'
    let finalAmount: number
    let finalNote: string

    if (type === 'correction') {
      const mistakeType = formData.get('mistakeType') as 'deposit' | 'deduction'
      const originalAmount = parseFloat(formData.get('originalAmount') as string)
      const correctAmount = parseFloat(formData.get('correctAmount') as string)

      if (!originalAmount || originalAmount <= 0 || !correctAmount || correctAmount <= 0) {
        toast.error('Please enter valid amounts for correction')
        setLoading(false)
        return
      }
      if (originalAmount === correctAmount) {
        toast.error('Original and correct amount are the same')
        setLoading(false)
        return
      }

      const diff = correctAmount - originalAmount
      if (mistakeType === 'deposit') {
        finalType = diff > 0 ? 'deposit' : 'deduction'
      } else {
        finalType = diff > 0 ? 'deduction' : 'deposit'
      }
      finalAmount = Math.abs(diff)
      finalNote = `Correction by Admin: Initially ₹${originalAmount} was entered as a ${mistakeType} in error. Corrected to ₹${correctAmount}.`
    } else {
      finalType = type
      finalAmount = parseFloat(formData.get('amount') as string)
      finalNote = formData.get('note') as string

      if (!finalAmount || finalAmount <= 0) {
        toast.error('Please enter a valid amount')
        setLoading(false)
        return
      }
      if (!finalNote) {
        toast.error('Note/Reason is mandatory')
        setLoading(false)
        return
      }
    }

    const res = await createTransaction(selectedUser.id, finalType, finalAmount, finalNote)
    
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Successfully processed ${finalType} of ₹${finalAmount.toFixed(2)} for ${selectedUser.full_name}`)
      setIsDialogOpen(false)
    }
    setLoading(false)
  }

  const handleBulkTransaction = async (formData: FormData) => {
    if (selectedUserIds.size === 0) return
    setLoading(true)

    const type = formData.get('type') as 'deposit' | 'deduction' | 'correction'
    let finalType: 'deposit' | 'deduction'
    let finalAmount: number
    let finalNote: string

    if (type === 'correction') {
      const mistakeType = formData.get('mistakeType') as 'deposit' | 'deduction'
      const originalAmount = parseFloat(formData.get('originalAmount') as string)
      const correctAmount = parseFloat(formData.get('correctAmount') as string)

      if (!originalAmount || originalAmount <= 0 || !correctAmount || correctAmount <= 0) {
        toast.error('Please enter valid amounts for correction')
        setLoading(false)
        return
      }
      if (originalAmount === correctAmount) {
        toast.error('Original and correct amount are the same')
        setLoading(false)
        return
      }

      const diff = correctAmount - originalAmount
      if (mistakeType === 'deposit') {
        finalType = diff > 0 ? 'deposit' : 'deduction'
      } else {
        finalType = diff > 0 ? 'deduction' : 'deposit'
      }
      finalAmount = Math.abs(diff)
      finalNote = `Correction by Admin: Initially ₹${originalAmount} was entered as a ${mistakeType} in error. Corrected to ₹${correctAmount}.`
    } else {
      finalType = type
      finalAmount = parseFloat(formData.get('amount') as string)
      finalNote = formData.get('note') as string

      if (!finalAmount || finalAmount <= 0) {
        toast.error('Please enter a valid amount')
        setLoading(false)
        return
      }
      if (!finalNote) {
        toast.error('Note/Reason is mandatory')
        setLoading(false)
        return
      }
    }

    const res = await createBulkTransactions(Array.from(selectedUserIds), finalType, finalAmount, finalNote)
    
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Successfully processed ${finalType} of ₹${finalAmount.toFixed(2)} for ${selectedUserIds.size} students`)
      setIsBulkDialogOpen(false)
      setSelectedUserIds(new Set())
    }
    setLoading(false)
  }

  const isAllSelected = filteredUsers.length > 0 && selectedUserIds.size === filteredUsers.length
  const isIndeterminate = selectedUserIds.size > 0 && selectedUserIds.size < filteredUsers.length

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-green-500/10 to-green-600/5 dark:from-green-500/20 dark:to-green-900/10 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative z-10">
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">Total Deposits</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-extrabold text-green-600 dark:text-green-400">₹{metrics.totalDeposits.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-md bg-gradient-to-br from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-900/10 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative z-10">
            <CardTitle className="text-sm font-medium text-red-800 dark:text-red-300">Total Spent</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-extrabold text-red-600 dark:text-red-400">₹{metrics.totalSpent.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-indigo-500/10 to-blue-600/5 dark:from-indigo-500/20 dark:to-blue-900/10 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative z-10">
            <CardTitle className="text-sm font-medium text-indigo-800 dark:text-indigo-300">Net System Balance</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">₹{metrics.netBalance.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => setBalanceFilter(prev => prev === 'low' ? 'all' : 'low')}
          className={`border-0 shadow-md bg-gradient-to-br from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-900/10 backdrop-blur-sm relative overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
            balanceFilter === 'low' ? 'ring-2 ring-orange-500 shadow-orange-500/20 bg-orange-500/15' : ''
          }`}
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative z-10">
            <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-300 flex items-center gap-1.5">
              <span>Low Balance (&lt; ₹50)</span>
              {balanceFilter === 'low' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 font-semibold">
                  Filtered
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10 flex items-baseline justify-between">
            <div className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">{metrics.lowBalanceCount}</div>
            <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">
              {balanceFilter === 'low' ? '✕ Reset' : 'Click to filter'}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg shadow-zinc-200/50 dark:shadow-none dark:border dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Students Directory</CardTitle>
              <Badge variant="secondary" className="text-xs font-semibold">
                {filteredUsers.length} {filteredUsers.length === 1 ? 'student' : 'students'}
              </Badge>
            </div>
            {balanceFilter !== 'all' && (
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs text-slate-500">Filtered by:</span>
                <Badge 
                  variant="outline" 
                  className="text-xs font-medium bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-1 cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={() => setBalanceFilter('all')}
                >
                  {balanceFilter === 'low' && 'Low Balance (< ₹50)'}
                  {balanceFilter === 'critical' && 'Zero/Negative (≤ ₹0)'}
                  {balanceFilter === 'healthy' && 'Healthy (≥ ₹50)'}
                  <X className="w-3 h-3 ml-0.5" />
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <Select value={balanceFilter} onValueChange={(val) => setBalanceFilter(val || 'all')}>
              <SelectTrigger className="w-[170px] h-9 text-xs font-medium rounded-full bg-white/70 dark:bg-zinc-800/70 border-zinc-200 dark:border-zinc-700 shadow-sm">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                <SelectValue placeholder="Filter balance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Balances</SelectItem>
                <SelectItem value="low" className="text-xs text-orange-600 dark:text-orange-400 font-medium">⚠️ Low Balance (&lt; ₹50)</SelectItem>
                <SelectItem value="critical" className="text-xs text-rose-600 dark:text-rose-400 font-medium">🚫 Critical (&le; ₹0)</SelectItem>
                <SelectItem value="healthy" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✅ Healthy (&ge; ₹50)</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-9 rounded-full px-3.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30 text-xs" onClick={() => setIsBulkMatchDialogOpen(true)}>
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Bulk Select
            </Button>
            <div className="relative w-56 sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
              <Input
                type="search"
                placeholder="Search name or email..."
                className="pl-9 h-9 text-xs bg-white/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 rounded-full shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {selectedUserIds.size > 0 && (
              <Button size="sm" className="h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 px-4 text-xs font-semibold" onClick={() => setIsBulkDialogOpen(true)}>
                Bulk Action ({selectedUserIds.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-zinc-100 dark:border-zinc-800/50">
                <TableHead className="w-12 pl-6 h-12">
                  <Checkbox 
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                    className="border-indigo-300 data-[state=checked]:bg-indigo-600"
                  />
                </TableHead>
                <TableHead className="h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Name</TableHead>
                <TableHead className="h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Email</TableHead>
                <TableHead 
                  className="text-right h-12 text-xs font-semibold tracking-wide uppercase text-slate-500 cursor-pointer select-none hover:text-indigo-600 transition-colors"
                  onClick={() => {
                    setBalanceSortOrder(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')
                  }}
                  title="Click to sort by balance"
                >
                  <div className="inline-flex items-center gap-1 justify-end">
                    <span>Balance</span>
                    {balanceSortOrder === 'none' && <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                    {balanceSortOrder === 'asc' && <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400 font-bold" />}
                    {balanceSortOrder === 'desc' && <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400 font-bold" />}
                  </div>
                </TableHead>
                <TableHead className="text-right pr-6 h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-3">
                        <Search className="w-6 h-6 text-muted-foreground opacity-50" />
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 font-medium">No students match the current filter.</p>
                      {(balanceFilter !== 'all' || searchTerm) && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="mt-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 text-xs"
                          onClick={() => {
                            setBalanceFilter('all')
                            setSearchTerm('')
                          }}
                        >
                          Reset Filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedUserIds.has(u.id);
                  return (
                    <TableRow 
                      key={u.id} 
                      className={`cursor-pointer transition-colors border-zinc-100 dark:border-zinc-800/50 ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-50/50 dark:hover:bg-zinc-800/50'}`}
                      onClick={() => handleSelectUser(u.id, !isSelected)}
                    >
                      <TableCell className="pl-6 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectUser(u.id, !!checked)}
                          aria-label={`Select ${u.full_name}`}
                          className="border-slate-300 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                      </TableCell>
                      <TableCell className="py-3 font-semibold text-slate-800 dark:text-slate-200">{u.full_name}</TableCell>
                      <TableCell className="py-3 text-slate-500 dark:text-slate-400 text-sm">{u.email}</TableCell>
                      <TableCell className="py-3 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.current_balance > 50 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : u.current_balance > 0 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
                          ₹{parseFloat(u.current_balance as unknown as string).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="pr-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-zinc-800 px-2.5 rounded-full border border-slate-200 dark:border-zinc-700 flex items-center gap-1.5" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenHistory(u);
                            }}
                            title="View Transaction History"
                          >
                            <ReceiptText className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                            History
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950 px-3 rounded-full border border-indigo-200 dark:border-indigo-800/50" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDialog(u);
                            }}
                          >
                            Transact
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Single Transaction Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form method="POST" action={handleTransaction}>
            <DialogHeader>
              <DialogTitle>Process Transaction</DialogTitle>
              <DialogDescription>
                Update balance for {selectedUser?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Transaction Type</Label>
                <Select name="type" value={txType} onValueChange={(v) => v && setTxType(v)} required>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit (+)</SelectItem>
                    <SelectItem value="deduction">Deduction (-)</SelectItem>
                    <SelectItem value="correction">Error Correction (±)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {txType === 'correction' ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="mistakeType">Mistake was a...</Label>
                    <Select name="mistakeType" defaultValue="deposit" required>
                      <SelectTrigger id="mistakeType">
                        <SelectValue placeholder="Select mistake type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="deduction">Deduction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="originalAmount">Original (Incorrect) ₹</Label>
                      <Input id="originalAmount" name="originalAmount" type="number" step="0.01" min="0.01" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="correctAmount">True Correct Amount ₹</Label>
                      <Input id="correctAmount" name="correctAmount" type="number" step="0.01" min="0.01" required />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-md">
                    System will auto-calculate the difference and post a correction transaction with a detailed note for the student.
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="amount">Amount (₹)</Label>
                    <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="note">Note / Reason</Label>
                    <Input id="note" name="note" type="text" placeholder="e.g. 15 pages DSA Lab Manual" required />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} loadingText="Confirming Transaction...">
                Confirm Transaction
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Transaction Modal */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form method="POST" action={handleBulkTransaction}>
            <DialogHeader>
              <DialogTitle>Bulk Transaction</DialogTitle>
              <DialogDescription>
                Apply this transaction to {selectedUserIds.size} selected students.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="bulk-type">Transaction Type</Label>
                <Select name="type" value={bulkTxType} onValueChange={(v) => v && setBulkTxType(v)} required>
                  <SelectTrigger id="bulk-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit (+)</SelectItem>
                    <SelectItem value="deduction">Deduction (-)</SelectItem>
                    <SelectItem value="correction">Error Correction (±)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bulkTxType === 'correction' ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="bulk-mistakeType">Mistake was a...</Label>
                    <Select name="mistakeType" defaultValue="deposit" required>
                      <SelectTrigger id="bulk-mistakeType">
                        <SelectValue placeholder="Select mistake type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="deduction">Deduction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="bulk-originalAmount">Original (Incorrect) ₹</Label>
                      <Input id="bulk-originalAmount" name="originalAmount" type="number" step="0.01" min="0.01" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="bulk-correctAmount">True Correct Amount ₹</Label>
                      <Input id="bulk-correctAmount" name="correctAmount" type="number" step="0.01" min="0.01" required />
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-md">
                    System will auto-calculate the difference and post a correction transaction with a detailed note for the students.
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="bulk-amount">Amount per Student (₹)</Label>
                    <Input id="bulk-amount" name="amount" type="number" step="0.01" min="0.01" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bulk-note">Note / Reason</Label>
                    <Input id="bulk-note" name="note" type="text" placeholder="e.g. Workshop fee deduction" required />
                  </div>
                </>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBulkDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} loadingText={`Processing ${selectedUserIds.size} student${selectedUserIds.size === 1 ? '' : 's'}...`}>
                Confirm for {selectedUserIds.size} Students
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Bulk Match Dialog */}
      <Dialog open={isBulkMatchDialogOpen} onOpenChange={(open) => {
        setIsBulkMatchDialogOpen(open)
        if (!open) {
          setBulkMatchText('')
          setFuzzyMatches([])
        }
      }}>
        <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Fuzzy Select</DialogTitle>
            <DialogDescription>
              Paste a list of names or emails (one per line). The system will find the closest match.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {fuzzyMatches.length === 0 ? (
              <div className="space-y-2">
                <Textarea 
                  placeholder="John Doe&#10;Jane Smith&#10;..." 
                  className="min-h-[200px]"
                  value={bulkMatchText}
                  onChange={(e) => setBulkMatchText(e.target.value)}
                />
                <Button onClick={handleBulkMatch} className="w-full" loading={matchingLoading} loadingText="Matching Names...">
                  Find Matches
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-md divide-y max-h-[400px] overflow-y-auto">
                  {fuzzyMatches.map((match, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">Pasted: <span className="text-slate-500">{match.original}</span></div>
                        <div className="text-sm">
                          Match: {match.matchedProfile ? (
                            <span className="font-semibold text-green-600 dark:text-green-400">{match.matchedProfile.full_name}</span>
                          ) : (
                            <span className="text-red-500">No match found</span>
                          )}
                        </div>
                      </div>
                      {match.matchedProfile && (
                        <Checkbox 
                          checked={match.selected}
                          onCheckedChange={(c) => {
                            const newMatches = [...fuzzyMatches]
                            newMatches[idx].selected = !!c
                            setFuzzyMatches(newMatches)
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setFuzzyMatches([])}>Back</Button>
                  <Button onClick={confirmBulkMatch}>Add to Selection</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Student Transaction History Modal */}
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-4xl max-w-4xl w-[95vw] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-slate-200 dark:border-zinc-800">
          <DialogHeader className="p-6 pb-5 border-b border-slate-200/80 dark:border-zinc-800 bg-gradient-to-r from-slate-50 via-indigo-50/20 to-white dark:from-zinc-900 dark:via-zinc-900/50 dark:to-zinc-950">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-6">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-indigo-200 dark:shadow-none">
                  {historyUser?.full_name?.charAt(0).toUpperCase() || 'S'}
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {historyUser?.full_name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                    {historyUser?.email}
                  </DialogDescription>
                </div>
              </div>

              {historyUser && (
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm text-right">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Balance</span>
                    <span className={`text-sm font-extrabold ${
                      historyUser.current_balance > 50 
                        ? 'text-emerald-600 dark:text-emerald-400' 
                        : historyUser.current_balance > 0 
                          ? 'text-amber-600 dark:text-amber-400' 
                          : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      ₹{parseFloat(historyUser.current_balance as unknown as string).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/40 dark:bg-zinc-950/40">
            {historyLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <AppleLoadingCard 
                  message="Loading ledger records..." 
                  subtext="Retrieving verified transaction history" 
                />
              </div>
            ) : userTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl flex items-center justify-center mb-3">
                  <ReceiptText className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">No transaction records found</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">No deposits or printing deductions have been made for this student yet.</p>
              </div>
            ) : (
              <div className="border border-slate-200/80 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                <div className="overflow-x-auto">
                  <Table className="w-full border-collapse">
                    <TableHeader>
                      <TableRow className="bg-slate-100/75 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-800">
                        <TableHead className="w-[170px] min-w-[170px] text-[11px] font-bold uppercase text-slate-500 tracking-wider py-3.5 pl-4">Date & Time</TableHead>
                        <TableHead className="w-[120px] min-w-[120px] text-[11px] font-bold uppercase text-slate-500 tracking-wider py-3.5 px-3">Type</TableHead>
                        <TableHead className="min-w-[260px] text-[11px] font-bold uppercase text-slate-500 tracking-wider py-3.5 px-4">Note / Reason</TableHead>
                        <TableHead className="w-[120px] min-w-[120px] text-[11px] font-bold uppercase text-slate-500 tracking-wider py-3.5 px-4 text-right">Amount</TableHead>
                        <TableHead className="w-[130px] min-w-[130px] text-[11px] font-bold uppercase text-slate-500 tracking-wider py-3.5 pr-5 pl-2 text-right">Balance After</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                      {userTransactions.map((tx) => {
                        const isCorrection = tx.note?.startsWith('Correction by Admin:') || tx.note?.toLowerCase().includes('correction')
                        return (
                          <TableRow key={tx.id} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/50 transition-colors">
                            <TableCell className="pl-4 py-3.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap align-top">
                              {format(new Date(tx.created_at), 'MMM d, yyyy • h:mm a')}
                            </TableCell>
                            <TableCell className="px-3 py-3.5 align-top whitespace-nowrap">
                              {isCorrection ? (
                                <Badge 
                                  variant="outline" 
                                  className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-md"
                                >
                                  Correction
                                </Badge>
                              ) : (
                                <Badge 
                                  variant="outline" 
                                  className={tx.type === 'deposit' 
                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-md' 
                                    : 'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300 font-semibold text-[11px] px-2.5 py-0.5 rounded-md'
                                  }
                                >
                                  {tx.type === 'deposit' ? '+ Deposit' : '- Deduction'}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words align-top">
                              {tx.note}
                            </TableCell>
                            <TableCell className={`px-4 py-3.5 text-right text-xs font-mono font-bold whitespace-nowrap align-top ${
                              isCorrection
                                ? (tx.type === 'deposit' ? 'text-amber-600 dark:text-amber-400' : 'text-amber-700 dark:text-amber-500')
                                : (tx.type === 'deposit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white')
                            }`}>
                              {tx.type === 'deposit' ? '+' : '-'}₹{parseFloat(tx.amount as unknown as string).toFixed(2)}
                            </TableCell>
                            <TableCell className="pr-5 pl-2 py-3.5 text-right text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap align-top">
                              ₹{parseFloat(tx.balance_after as unknown as string).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 px-6 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/80 flex items-center justify-between sm:justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing {userTransactions.length} recorded transaction{userTransactions.length === 1 ? '' : 's'}
            </span>
            <Button variant="outline" size="sm" onClick={() => setIsHistoryDialogOpen(false)} className="rounded-lg px-4">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
