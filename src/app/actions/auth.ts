'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Redirect will be handled by middleware or client based on role/password flag
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function changePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string
  const supabase = await createClient()

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  // Validate password policy: Min 8 chars, 1 uppercase, 1 number, 1 special char
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/
  if (!passwordRegex.test(password)) {
    return { error: 'Password must be at least 8 characters, include an uppercase letter, a number, and a special character.' }
  }

  // 1. Update auth.users password
  const { error: updateError } = await supabase.auth.updateUser({
    password: password
  })

  if (updateError) {
    return { error: updateError.message }
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // 2. Clear must_change_password flag
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id)
  }

  redirect('/')
}

export async function changePasswordInline(password: string, confirmPassword: string) {
  const supabase = await createClient()

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/
  if (!passwordRegex.test(password)) {
    return { error: 'Password must be at least 8 characters, include an uppercase letter, a number, and a special character.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: password
  })

  if (updateError) {
    return { error: updateError.message }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('profiles').update({ must_change_password: false }).eq('id', user.id)
  }

  return { success: true }
}

export async function adminResetUserPassword(userId: string, newPassword: string) {
  const supabase = await createClient()

  // 1. Verify caller is admin
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single()
  if (profile?.role !== 'admin') return { error: 'Unauthorized. Only admins can reset passwords.' }

  // 2. Initialize admin client with service role key
  const { createClient: createAdminClient } = await import('@supabase/supabase-js')
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 3. Update the user's password via the admin auth API
  const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
    password: newPassword
  })

  if (authError) {
    return { error: authError.message }
  }

  // 4. Set must_change_password = true so the user is forced to change it
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ must_change_password: true })
    .eq('id', userId)

  if (profileError) {
    return { error: profileError.message }
  }

  return { success: true }
}
