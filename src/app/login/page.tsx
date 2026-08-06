'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { login } from "../actions/auth"
import { toast } from "sonner"
import { useState } from "react"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  async function handleLogin(formData: FormData) {
    setLoading(true)
    const result = await login(formData)
    if (result?.error) {
      toast.error(result.error)
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      
      {/* Left Side: Image / Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-200">
        {/* Replace the src with your uploaded image in the public folder, e.g., '/sai-baba.jpg' */}
        <div className="absolute inset-0 bg-slate-900">
          <img 
            src="/hero-image.jpg" 
            alt="Hero Background" 
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        
        {/* Overlay Text on Image */}
        <div className="relative z-10 flex flex-col justify-end p-12 w-full text-white bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <p className="text-xl font-medium mb-1 text-slate-300">Sairam</p>
          <h2 className="text-4xl font-bold mb-4">Welcome to Photocopy Ledger</h2>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex flex-col justify-center items-center w-full lg:w-1/2 p-4 relative overflow-hidden">
        
        {/* Subtle Background Effects for the right side */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30rem] h-[30rem] bg-sky-400/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

        <div className="z-10 w-full max-w-md">
          {/* Logo / Branding Area */}
          <div className="flex flex-col items-center justify-center mb-8 space-y-3">
            <div className="w-16 h-16 rounded-2xl shadow-xl flex items-center justify-center border border-indigo-100 bg-white overflow-hidden">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 drop-shadow-sm">Photocopy Ledger</h1>
          </div>

          <Card className="w-full border border-white/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] bg-white/70 backdrop-blur-xl">
            <CardHeader className="space-y-1 pb-6 pt-8">
              <CardTitle className="text-xl font-semibold tracking-tight text-center text-slate-800">Sign In</CardTitle>
            </CardHeader>
            <form action={handleLogin}>
              <CardContent className="space-y-5 px-8">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium">Email Address</Label>
                  <Input 
                    id="email" 
                    name="email" 
                    type="email" 
                    placeholder="m@example.com" 
                    required 
                    className="bg-white/50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500 h-11 shadow-inner"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-700 font-medium">Password</Label>
                    <span className="text-xs text-indigo-600 hover:text-indigo-500 cursor-pointer transition-colors font-medium">Forgot password?</span>
                  </div>
                  <Input 
                    id="password" 
                    name="password" 
                    type="password" 
                    required 
                    className="bg-white/50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-indigo-500 h-11 shadow-inner"
                  />
                </div>
              </CardContent>
              <CardFooter className="px-8 pb-8 pt-4">
                <Button 
                  className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98]" 
                  type="submit" 
                  loading={loading}
                  loadingText="Signing in..."
                >
                  Sign in
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
