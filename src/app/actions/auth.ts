'use server'

import { createClient } from '@/lib/supabase/server'
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from '@/lib/env'
import { redirect } from 'next/navigation'

const PASSWORD_REGEX =
  /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/

const PASSWORD_POLICY_ERROR =
  'Password must be at least 8 characters, include an uppercase letter, a number, and a special character.'

export async function login(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Please enter both email and password.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Redirect will be routed by middleware / home page based on role and password flag
  redirect('/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function changePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirmPassword = String(formData.get('confirmPassword') ?? '')
  const supabase = await createClient()

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  if (!PASSWORD_REGEX.test(password)) {
    return { error: PASSWORD_POLICY_ERROR }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated. Please sign in again.' }
  }

  // 1. Update auth.users password
  const { error: updateError } = await supabase.auth.updateUser({
    password,
  })

  if (updateError) {
    return { error: updateError.message }
  }

  // 2. Clear must_change_password flag and verify the DB update succeeded
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id)

  if (profileError) {
    return {
      error: `Password updated, but failed to update account status: ${profileError.message}`,
    }
  }

  redirect('/')
}

export async function changePasswordInline(
  password: string,
  confirmPassword: string
) {
  const supabase = await createClient()

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match.' }
  }

  if (!PASSWORD_REGEX.test(password)) {
    return { error: PASSWORD_POLICY_ERROR }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated. Please sign in again.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password,
  })

  if (updateError) {
    return { error: updateError.message }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id)

  if (profileError) {
    return { error: profileError.message }
  }

  return { success: true }
}

export async function adminResetUserPassword(
  userId: string,
  newPassword: string
) {
  const supabase = await createClient()

  // 1. Verify caller is admin
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()
  if (!currentUser) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', currentUser.id)
    .single()
  if (profile?.role !== 'admin') {
    return { error: 'Unauthorized. Only admins can reset passwords.' }
  }

  if (!userId || !userId.trim()) {
    return { error: 'Invalid target user ID.' }
  }

  if (!PASSWORD_REGEX.test(newPassword)) {
    return { error: PASSWORD_POLICY_ERROR }
  }

  // 2. Initialize admin client with validated env vars
  const { url } = getSupabasePublicEnv()
  const serviceRoleKey = getSupabaseServiceRoleKey()
  const { createClient: createAdminClient } = await import(
    '@supabase/supabase-js'
  )
  const adminClient = createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 3. Update the user's password via the admin auth API
  const { error: authError } = await adminClient.auth.admin.updateUserById(
    userId,
    {
      password: newPassword,
    }
  )

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
