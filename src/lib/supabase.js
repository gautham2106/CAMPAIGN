import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

export const ENV_MISSING = !supabaseUrl || !supabaseAnonKey ||
  supabaseUrl === 'https://your-project-ref.supabase.co'

// Avoid crashing the module when env is not yet configured
export const supabase = ENV_MISSING
  ? null
  : createClient(supabaseUrl, supabaseAnonKey)

// Admin client for privileged operations (creating monitor accounts).
// Uses service_role key — only for internal tool use.
export const supabaseAdmin = (!ENV_MISSING && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null
