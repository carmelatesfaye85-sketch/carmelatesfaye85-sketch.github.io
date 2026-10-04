// Paste your Supabase details here (Supabase dashboard > Project Settings > API).
// While these still say YOUR-..., the site runs in preview mode:
// accounts and visits are saved only in that browser.
window.OWNIT_CONFIG = {
  supabaseUrl: "https://fnnybpepkhroferzltah.supabase.co",
  supabaseAnonKey: "sb_publishable_6TCjT0qbkURoaV_u8WQJHA_bdH6hx3A",

  // Set to true after turning on Google sign-in in Supabase (Authentication > Providers > Google).
  googleEnabled: true,

  // Public key for "time's up" notifications. Safe to share.
  // Its private partner is in supabase/KEEP-SECRET.txt and must never go in this folder.
  vapidPublicKey: "BMET7TTvmbqin-gTHpyDWN3kuqPqEyoxL2LE7l068ngneSdQ4D6jMvqreQ5p-AJcv30B4A9eNHuAlF4teBGuatw",
};
