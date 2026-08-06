'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { changePassword } from "../actions/auth"
import { toast } from "sonner"
import { useState } from "react"

export default function ChangePasswordPage() {
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const result = await changePassword(formData)
    if (result?.error) {
      toast.error(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Set New Password</CardTitle>
          <CardDescription>
            You must change your default password before continuing.
          </CardDescription>
        </CardHeader>
        <form method="POST" action={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input 
                id="password" 
                name="password" 
                type="password" 
                required 
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 8 characters, with 1 uppercase, 1 number, and 1 special character.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input 
                id="confirmPassword" 
                name="confirmPassword" 
                type="password" 
                required 
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" loading={loading} loadingText="Updating Password...">
              Update Password
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
