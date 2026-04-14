import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qgljbpetaytpistmrnff.supabase.co'
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_nyA_YXrs_2sR0EJxbDb4Zg_zy4SO9En'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
