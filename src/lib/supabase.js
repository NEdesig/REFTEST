

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://beyqolfunftzykstgoam.supabase.co';

const supabaseKey =
  'sb_publishable_YiNqFlV53_au4YGawVJyoQ__Jewd_LZ';

export const supabaseReady = Boolean(
  supabaseUrl && supabaseKey
);

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
