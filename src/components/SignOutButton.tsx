'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { logout } from '@/app/actions/auth'
import { LogOut } from 'lucide-react'
import { AppleSpinner } from './ui/apple-spinner'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

function isNextRedirectError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { message?: unknown; digest?: unknown }
  return (
    e.message === 'NEXT_REDIRECT' ||
    (typeof e.digest === 'string' && e.digest.startsWith('NEXT_REDIRECT'))
  )
}

export function SignOutButton({ className }: { className?: string }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleSignOut = async () => {
    if (isLoggingOut) return
    setIsLoggingOut(true)
    try {
      await logout()
    } catch (err: unknown) {
      if (isNextRedirectError(err)) {
        return
      }
      toast.error('Failed to sign out. Please try again.')
      setIsLoggingOut(false)
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleSignOut}
      disabled={isLoggingOut}
      className={cn(
        'text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all duration-200',
        className
      )}
      title="Sign out"
      aria-label="Sign out"
    >
      {isLoggingOut ? (
        <AppleSpinner size="sm" className="text-muted-foreground" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
    </Button>
  )
}
