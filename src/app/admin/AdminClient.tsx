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
import { createTransaction, createBulkTransactions } from '../actions/transaction'
import { Search } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'

type Profile = {
  id: string;
  full_name: string;
  email: string;
  current_balance: number;
}

export default function AdminClient({ users, metrics }: { users: Profile[], metrics: any }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Selection state
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [users, searchTerm])

  const handleOpenDialog = (user: Profile) => {
    setSelectedUser(user)
    setIsDialogOpen(true)
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

  const handleTransaction = async (formData: FormData) => {
    if (!selectedUser) return
    setLoading(true)

    const type = formData.get('type') as 'deposit' | 'deduction'
    const amount = parseFloat(formData.get('amount') as string)
    const note = formData.get('note') as string

    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      setLoading(false)
      return
    }
    if (!note) {
      toast.error('Note/Reason is mandatory')
      setLoading(false)
      return
    }

    const res = await createTransaction(selectedUser.id, type, amount, note)
    
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Successfully processed ${type} of ₹${amount.toFixed(2)} for ${selectedUser.full_name}`)
      setIsDialogOpen(false)
    }
    setLoading(false)
  }

  const handleBulkTransaction = async (formData: FormData) => {
    if (selectedUserIds.size === 0) return
    setLoading(true)

    const type = formData.get('type') as 'deposit' | 'deduction'
    const amount = parseFloat(formData.get('amount') as string)
    const note = formData.get('note') as string

    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount')
      setLoading(false)
      return
    }
    if (!note) {
      toast.error('Note/Reason is mandatory')
      setLoading(false)
      return
    }

    const res = await createBulkTransactions(Array.from(selectedUserIds), type, amount, note)
    
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success(`Successfully processed ${type} of ₹${amount.toFixed(2)} for ${selectedUserIds.size} students`)
      setIsBulkDialogOpen(false)
      setSelectedUserIds(new Set()) // Clear selection on success
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

        <Card className="border-0 shadow-md bg-gradient-to-br from-orange-500/10 to-orange-600/5 dark:from-orange-500/20 dark:to-orange-900/10 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <svg className="w-16 h-16 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 relative z-10">
            <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-300">Low Balance (&lt; ₹50)</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-extrabold text-orange-600 dark:text-orange-400">{metrics.lowBalanceCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg shadow-zinc-200/50 dark:shadow-none dark:border dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
          <div>
            <CardTitle className="text-xl">Students Directory</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-indigo-500" />
              <Input
                type="search"
                placeholder="Search by name or email..."
                className="pl-9 h-9 text-sm bg-white/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700 rounded-full shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {selectedUserIds.size > 0 && (
              <Button size="sm" className="h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 px-4" onClick={() => setIsBulkDialogOpen(true)}>
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
                <TableHead className="text-right h-12 text-xs font-semibold tracking-wide uppercase text-slate-500">Balance</TableHead>
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
                      <p className="text-slate-500 font-medium">No students found.</p>
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
          <form action={handleTransaction}>
            <DialogHeader>
              <DialogTitle>Process Transaction</DialogTitle>
              <DialogDescription>
                Update balance for {selectedUser?.full_name}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="type">Transaction Type</Label>
                <Select name="type" defaultValue="deposit" required>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit (+)</SelectItem>
                    <SelectItem value="deduction">Deduction (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount (₹)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="note">Note / Reason</Label>
                <Input
                  id="note"
                  name="note"
                  type="text"
                  placeholder="e.g. 15 pages DSA Lab Manual"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Processing..." : "Confirm Transaction"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Transaction Modal */}
      <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form action={handleBulkTransaction}>
            <DialogHeader>
              <DialogTitle>Bulk Transaction</DialogTitle>
              <DialogDescription>
                Apply this transaction to {selectedUserIds.size} selected students.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="bulk-type">Transaction Type</Label>
                <Select name="type" defaultValue="deposit" required>
                  <SelectTrigger id="bulk-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit (+)</SelectItem>
                    <SelectItem value="deduction">Deduction (-)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-amount">Amount per Student (₹)</Label>
                <Input
                  id="bulk-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bulk-note">Note / Reason</Label>
                <Input
                  id="bulk-note"
                  name="note"
                  type="text"
                  placeholder="e.g. Workshop fee deduction"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBulkDialogOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Processing..." : `Confirm for ${selectedUserIds.size} Students`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
