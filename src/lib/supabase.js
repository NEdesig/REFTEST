import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const validUrl =
  typeof supabaseUrl === 'string' &&
  /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/?$/.test(supabaseUrl);

export const supabase =
  validUrl && supabaseKey && supabaseKey !== 'YOUR_SUPABASE_PUBLISHABLE_KEY'
    ? createClient(supabaseUrl.replace(/\/$/, ''), supabaseKey)
    : null;

export const supabaseConfigError = !validUrl
  ? 'Неправильный URL Supabase. Проверь VITE_SUPABASE_URL.'
  : !supabaseKey || supabaseKey === 'YOUR_SUPABASE_PUBLISHABLE_KEY'
    ? 'Не указан ключ Supabase. Проверь VITE_SUPABASE_ANON_KEY.'
    : '';
