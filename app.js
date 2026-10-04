// OwnIt web app. No build step: plain JavaScript that runs in the browser.
// With a Supabase project set in config.js, accounts are real.
// Without one, it runs in preview mode and saves to this browser only.

const cfg = window.OWNIT_CONFIG || {};
const DEMO = !cfg.supabaseUrl || !cfg.supabaseAnonKey || /YOUR[-_]/i.test(cfg.supabaseUrl + cfg.supabaseAnonKey);
// "Continue with Google" shows in preview mode, or once googleEnabled is true in config.js.
const GOOGLE_ON = DEMO || cfg.googleEnabled === true;
/** Running inside the OwnIt Android app: the phone can block apps and pull you back. */
const APP = window.OwnItAndroid || null;
const ANDROID_APK = "https://github.com/carmelatesfaye85-sketch/ownit-android/releases/latest/download/OwnIt.apk";
const IS_ANDROID = /android/i.test(navigator.userAgent);
/** Show "Get the Android app" only to people who don't have it yet. */
function wantsApp() { return !APP && !S.user?.hasApp && !store.get("ownit.noApp", false); }
function appStatus() { try { return JSON.parse(APP.status()); } catch { return {}; } }
function appCall(name, ...args) { try { APP?.[name]?.(...args); } catch (e) { console.warn("OwnIt app call failed", name, e); } }
/** The apps the Guard blocks on this phone: your own choice in Settings, or the apps you named when you signed up. */
function guardedApps() {
  const mine = store.get("ownit.guarded", null);
  const list = (Array.isArray(mine) ? mine : S.profile?.apps || []).filter((a) => PLATFORMS[a]);
  return list.length ? list : ["tiktok"];
}
function syncGuardedApps() { if (APP) appCall("setGuardedApps", guardedApps().join(",")); }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const PLATFORMS = {
  tiktok: {
    name: "TikTok", color: "#FE2C55",
    search: (q) => "https://www.tiktok.com/search?q=" + encodeURIComponent(q),
    feed: "https://www.tiktok.com/foryou",
  },
  youtube: {
    name: "YouTube", color: "#FF0000",
    search: (q) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q),
    feed: "https://www.youtube.com/shorts",
  },
  instagram: {
    name: "Instagram", color: "#D62976",
    search: (q) => "https://www.instagram.com/explore/search/keyword/?q=" + encodeURIComponent(q),
    feed: "https://www.instagram.com/reels/",
  },
};
const SEARCH_MINUTES = [3, 5, 10, 15];
const FREE_MINUTES = [5, 10, 15, 20];
const GOAL_OPTIONS = [15, 30, 45, 60, 90, 120];

const OUTCOMES = {
  search: [["found", "Yes, I found it"], ["partly", "Sort of"], ["distracted", "No, I got distracted"]],
  free: [["found", "Yes, it was worth it"], ["partly", "Kind of"], ["distracted", "No, it pulled me in"]],
};
const OUTCOME_WORD = { found: "Found it", partly: "Sort of", distracted: "Got distracted" };

const QUESTIONS = [
  { id: "display_name", type: "text", title: "First, what should we call you?", placeholder: "Your first name", required: true },
  {
    id: "apps", type: "multi", title: "Which apps take most of your time?", sub: "Pick all that apply.",
    options: [["tiktok", "TikTok"], ["instagram", "Instagram"], ["youtube", "YouTube"], ["telegram", "Telegram"], ["facebook", "Facebook"], ["x", "X (Twitter)"], ["snapchat", "Snapchat"]],
  },
  {
    id: "daily_hours", type: "single", title: "On a normal day, how long are you on social media?",
    sub: "Not sure? Check Screen Time on iPhone or Digital Wellbeing on Android. Most people guess too low.",
    options: [["0.5", "Under 1 hour"], ["1.5", "1 to 2 hours"], ["3", "2 to 4 hours"], ["5", "4 to 6 hours"], ["7", "More than 6 hours"]],
  },
  {
    id: "autopilot", type: "single", title: "How often do you open an app without a reason?",
    sub: "Like picking up your phone and finding yourself on TikTok.",
    options: [["rarely", "Rarely"], ["sometimes", "Sometimes"], ["often", "Often"], ["always", "Almost every time"]],
  },
  {
    id: "feeling", type: "single", title: "After a long scroll, how do you usually feel?",
    options: [["better", "Better"], ["same", "About the same"], ["worse", "A bit worse"], ["drained", "Drained or guilty"]],
  },
  {
    id: "uses", type: "multi", title: "What do you actually go there for?", sub: "Pick all that apply.",
    options: [["learn", "Learning something"], ["howto", "Recipes and how-tos"], ["news", "News"], ["friends", "Friends and messages"], ["fun", "Entertainment"], ["ideas", "Ideas for work or school"], ["nothing", "Honestly, nothing specific"]],
  },
  { id: "extra_hour", type: "text", title: "If you got one extra hour every day, what would you do with it?", placeholder: "e.g. read, go to the gym, learn to code", required: false },
  { id: "daily_goal_minutes", type: "goal", title: "How much social media a day feels right to you?", sub: "This becomes your daily budget. You can change it any time." },
];

const ICONS = {
  logo: '<svg width="22" height="22" viewBox="186 268 652 488" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width="83" stroke-linecap="round"><path d="M430 351A161 161 0 1 0 591 505"/><path d="M756 351V673"/></g><circle cx="544" cy="398" r="46" fill="currentColor"/></svg>',
  search: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  arrow: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
  chart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  user: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  wave: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>',
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>',
  bolt: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  heart: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 0 0-7.1 7.1L12 21.5l8.8-8.8a5 5 0 0 0 0-7.1z"/></svg>',
  target: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  menu: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  gear: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
  book: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 1 2-2h13v2H6"/></svg>',
  mirror: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="6.500"/><path d="M12 16.500V21M8.500 21h7"/></svg>',
  down: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0-4.500-4.500M12 15l4.500-4.500M5 20h14"/></svg>',
  chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>',
  bookmark: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4.5L5 20V5a1 1 0 0 1 1-1z"/></svg>',
  bell: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>',
  clock: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  google: '<svg class="google-g" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const ms = (iso) => new Date(iso).getTime();

// ---------------------------------------------------------------------------
// Look: theme, colour, font and text size (saved on this device)
// ---------------------------------------------------------------------------
const COLOURS = {
  navy: { name: "Navy", dot: "#12224A", dot2: "#F2EFE6", light: null, dark: null },
  lagoon: {
    name: "Lagoon", dot: "#0C6B65", dot2: "#F0B155",
    light: { brand: "#0C6B65", "brand-hover": "#09554F", "brand-ink": "#FFFFFF", "brand-soft": "#D2E9E5", deep: "#0A2E2C", "deep-2": "#0F3B38", sun: "#C98118", "sun-soft": "#FBEAD0", bg: "#F3F6F5", surface: "#FFFFFF", "surface-2": "#EAF0EE", "surface-3": "#DCE5E2", line: "#D5DEDA" },
    dark: { brand: "#3FC2B2", "brand-hover": "#62D4C6", "brand-ink": "#04110F", "brand-soft": "#10332F", deep: "#0C2523", "deep-2": "#11302D", sun: "#F0B155", "sun-soft": "#3A2A13", bg: "#061513", surface: "#0C211E", "surface-2": "#112B27", "surface-3": "#183A35", line: "#1D423C" },
  },
  plum: {
    name: "Plum", dot: "#6B2346", dot2: "#C99A3B",
    light: { brand: "#6B2346", "brand-hover": "#561B38", "brand-ink": "#FFFFFF", "brand-soft": "#F1DDE6", deep: "#2E0F1F", "deep-2": "#3D1529", sun: "#A87A1F", "sun-soft": "#F7EBD2", bg: "#F7F3F4", "surface-2": "#EFE8EA", "surface-3": "#E3D9DC", line: "#DDD2D6" },
    dark: { brand: "#E08BB0", "brand-hover": "#ECA6C4", "brand-ink": "#1C0810", "brand-soft": "#3A1A28", deep: "#24101A", "deep-2": "#301522", sun: "#E9BE6A", "sun-soft": "#3A2C12", bg: "#120C0E", surface: "#1B1316", "surface-2": "#241A1E", "surface-3": "#31242A", line: "#36282E" },
  },
  forest: {
    name: "Forest", dot: "#2F6B3A", dot2: "#C47A2C",
    light: { brand: "#2F6B3A", "brand-hover": "#25552E", "brand-ink": "#FFFFFF", "brand-soft": "#DCEBDD", deep: "#12301A", "deep-2": "#183E22", sun: "#A85F1B", "sun-soft": "#F7E7D3", bg: "#F4F6F1", "surface-2": "#EBEFE6", "surface-3": "#DEE4D7", line: "#D6DDCE" },
    dark: { brand: "#7CCB8A", "brand-hover": "#98D9A4", "brand-ink": "#06170A", "brand-soft": "#17341D", deep: "#0F2414", "deep-2": "#14301B", sun: "#E5A268", "sun-soft": "#38260F", bg: "#0B100C", surface: "#131A14", "surface-2": "#1A231C", "surface-3": "#243026", line: "#28352B" },
  },
  ember: {
    name: "Ember", dot: "#A8431F", dot2: "#2E7D7A",
    light: { brand: "#A8431F", "brand-hover": "#8A3719", "brand-ink": "#FFFFFF", "brand-soft": "#F6E0D6", deep: "#3A1609", "deep-2": "#4A1D0D", sun: "#24706D", "sun-soft": "#D9EEEC", bg: "#F8F4F1", "surface-2": "#F0E9E4", "surface-3": "#E5DBD4", line: "#DFD3CB" },
    dark: { brand: "#F09A72", "brand-hover": "#F5B393", "brand-ink": "#2A0D03", "brand-soft": "#40200F", deep: "#27110A", "deep-2": "#33170D", sun: "#6CCFC8", "sun-soft": "#12322F", bg: "#120D0B", surface: "#1B1411", "surface-2": "#251B17", "surface-3": "#33261F", line: "#382A23" },
  },
};
const FONTS = {
  ownit: { name: "OwnIt", note: "Round and friendly", display: '"Baloo 2", "Figtree", system-ui, sans-serif', body: '"Figtree", "Segoe UI", system-ui, sans-serif', load: "" },
  elegant: { name: "Elegant", note: "Serif headings", display: '"Fraunces", Georgia, serif', body: '"Figtree", "Segoe UI", system-ui, sans-serif', load: "Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600" },
  clean: { name: "Clean", note: "One simple font", display: '"Figtree", "Segoe UI", system-ui, sans-serif', body: '"Figtree", "Segoe UI", system-ui, sans-serif', load: "" },
  classic: { name: "Classic", note: "Like a book", display: '"Lora", Georgia, serif', body: '"Lora", Georgia, serif', load: "Lora:wght@400;500;600;700" },
  rounded: { name: "Soft", note: "Rounded all over", display: '"Nunito", "Segoe UI", system-ui, sans-serif', body: '"Nunito", "Segoe UI", system-ui, sans-serif', load: "Nunito:wght@400;600;700;800" },
};
const SIZES = { small: ["Small", 0.92], normal: ["Normal", 1], large: ["Large", 1.12], xl: ["Extra large", 1.26] };
const LOOK_KEYS = ["brand", "brand-hover", "brand-ink", "brand-soft", "deep", "deep-2", "sun", "sun-soft", "bg", "surface", "surface-2", "surface-3", "line"];
const darkQuery = matchMedia("(prefers-color-scheme: dark)");
function look() { return { theme: "light", colour: "navy", font: "ownit", size: "normal", motion: true, contrast: false, ...store.get("ownit.look", {}) }; }
/** True when the screen is showing the dark (navy) look. */
function isDark() { const L = look(); return L.theme === "dark" || (L.theme === "system" && darkQuery.matches); }
function loadFont(id) {
  const f = FONTS[id];
  if (!f?.load || document.getElementById("font-" + id)) return;
  const l = document.createElement("link");
  l.id = "font-" + id; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=" + f.load + "&display=swap";
  document.head.appendChild(l);
}
function applyLook() {
  const L = look();
  const el = document.documentElement;
  if (L.theme === "light" || L.theme === "dark") el.dataset.theme = L.theme; else delete el.dataset.theme;
  const dark = L.theme === "dark" || (L.theme === "system" && darkQuery.matches);
  const pal = (COLOURS[L.colour] || COLOURS.navy)[dark ? "dark" : "light"];
  for (const k of LOOK_KEYS) { if (pal && pal[k]) el.style.setProperty("--" + k, pal[k]); else el.style.removeProperty("--" + k); }
  const strong = L.contrast ? (dark ? { muted: "#C3D0CC", "ink-2": "#E2EAE7", line: "#5C716B" } : { muted: "#36433F", "ink-2": "#1B2725", line: "#8FA19B" }) : null;
  for (const k of ["muted", "ink-2"]) { if (strong) el.style.setProperty("--" + k, strong[k]); else el.style.removeProperty("--" + k); }
  if (strong) el.style.setProperty("--line", strong.line);
  el.dataset.contrast = L.contrast ? "more" : "normal";
  const f = FONTS[L.font] || FONTS.ownit;
  loadFont(L.font);
  if (L.font === "ownit") { el.style.removeProperty("--display"); el.style.removeProperty("--body"); }
  else { el.style.setProperty("--display", f.display); el.style.setProperty("--body", f.body); }
  el.style.setProperty("--text-scale", String((SIZES[L.size] || SIZES.normal)[1]));
  el.dataset.motion = L.motion ? "on" : "off";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", pal?.bg || (dark ? "#12224A" : "#F2EFE6"));
}
function setLook(patch) { store.set("ownit.look", { ...look(), ...patch }); applyLook(); }
darkQuery.addEventListener?.("change", applyLook);
applyLook();
function startOfDay(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function startOfWeek(d = new Date()) { const x = startOfDay(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function fmtClock(msLeft) {
  const t = Math.max(0, Math.ceil(msLeft / 1000));
  return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0");
}
function relTime(iso) {
  const s = Math.round((Date.now() - ms(iso)) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return m + " min ago";
  const h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
  const d = Math.round(h / 24); return d === 1 ? "yesterday" : d + " days ago";
}
function initials(name, email) {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] || "?") + (name && parts[1] ? parts[1][0] : "")).toUpperCase();
}
function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
/** Minutes actually spent on a visit (open visits count up to now). */
function visitMinutes(v) {
  const end = v.ended_at ? ms(v.ended_at) : Date.now();
  return Math.max(0, Math.min((end - ms(v.started_at)) / 60000, v.planned_minutes + 60));
}
function friendlyError(msg) {
  const m = String(msg || "");
  if (/invalid login credentials/i.test(m)) return "That email and password don't match. Check them and try again.";
  if (/already registered|already exists/i.test(m)) return "An account with this email already exists. Sign in instead.";
  if (/password should be at least/i.test(m)) return "Your password needs at least 6 characters.";
  if (/email not confirmed/i.test(m)) return "Confirm your email first. We sent you a link when you signed up.";
  if (/unable to validate email|invalid email/i.test(m)) return "That email address doesn't look right.";
  if (/provider is not enabled/i.test(m)) return "Google sign-in isn't turned on yet for this site. Use email for now.";
  if (/failed to fetch|network/i.test(m)) return "Couldn't reach the server. Check your internet connection and try again.";
  if (/rate limit/i.test(m)) return "Too many tries. Wait a minute and try again.";
  return m || "Something went wrong. Try again.";
}

// ---------------------------------------------------------------------------
// Backends: preview (this browser only) and Supabase (real accounts)
// ---------------------------------------------------------------------------
function createPreviewBackend() {
  const KEY = "ownit.preview.v2";
  let mem = { users: {}, session: null };
  const read = () => store.get(KEY, null) || mem;
  const write = (d) => { mem = d; store.set(KEY, d); };
  const listeners = [];
  const current = () => { const d = read(); return d.session ? d.users[d.session] : null; };
  const toUser = (u) => (u ? { id: u.id, email: u.email, name: u.name || "", provider: u.provider, hasApp: !!u.hasApp } : null);
  const emit = (evt) => listeners.forEach((fn) => fn(evt, toUser(current())));
  const mutateUser = (fn) => { const d = read(); const u = d.users[d.session]; if (!u) throw new Error("You're signed out."); fn(u); write(d); return u; };

  return {
    preview: true,
    async init() { return toUser(current()); },
    onAuth(fn) { listeners.push(fn); },
    async signInWithGoogle() {
      const d = read();
      let u = Object.values(d.users).find((x) => x.provider === "google");
      if (!u) { u = { id: uid(), email: "preview.user@gmail.com", name: "", provider: "google", profile: null, visits: [] }; d.users[u.id] = u; }
      d.session = u.id; write(d); emit("SIGNED_IN");
    },
    async signUp(email, password, name) {
      const d = read();
      if (Object.values(d.users).some((x) => x.email === email)) throw new Error("already registered");
      if (password.length < 6) throw new Error("Password should be at least 6 characters");
      const u = { id: uid(), email, password, name, provider: "email", profile: null, visits: [] };
      d.users[u.id] = u; d.session = u.id; write(d); emit("SIGNED_IN");
      return { needsConfirm: false };
    },
    async signIn(email, password) {
      const d = read();
      const u = Object.values(d.users).find((x) => x.email === email && x.password === password);
      if (!u) throw new Error("Invalid login credentials");
      d.session = u.id; write(d); emit("SIGNED_IN");
    },
    async resetPassword() { /* nothing to send in preview mode */ },
    async updatePassword(pw) { mutateUser((u) => { u.password = pw; }); },
    async signOut() { const d = read(); d.session = null; write(d); emit("SIGNED_OUT"); },
    async getProfile() { return current()?.profile || null; },
    async saveProfile(p) { const u = mutateUser((x) => { x.profile = { ...(x.profile || {}), ...p }; }); return u.profile; },
    async listVisits(sinceIso) { return (current()?.visits || []).filter((v) => v.started_at >= sinceIso); },
    async startVisit(v) {
      const row = { id: uid(), ended_at: null, outcome: null, ...v, started_at: v.started_at || new Date().toISOString() };
      mutateUser((u) => { u.visits.unshift(row); u.visits = u.visits.slice(0, 1000); });
      return row;
    },
    async savePushSubscription() { /* preview mode has no server to send notifications */ },
    async markHasApp() { mutateUser((u) => { u.hasApp = true; }); },
    async listSaves() { return current()?.saves || []; },
    async addSave(row) {
      const out = { id: uid(), created_at: new Date().toISOString(), ...row };
      mutateUser((u) => { u.saves = [out, ...(u.saves || [])]; });
      return out;
    },
    async updateSave(id, patch) {
      let out = null;
      mutateUser((u) => { const x = (u.saves || []).find((r) => r.id === id); if (x) { Object.assign(x, patch); out = { ...x }; } });
      return out;
    },
    async deleteSave(id) { mutateUser((u) => { u.saves = (u.saves || []).filter((r) => r.id !== id); }); },
    async updateVisit(id, patch) {
      let out = null;
      mutateUser((u) => { const v = u.visits.find((x) => x.id === id); if (v) { Object.assign(v, patch); out = { ...v }; } });
      return out;
    },
  };
}

async function createSupabaseBackend() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const redirectTo = location.origin + location.pathname;
  const need = (res) => { if (res.error) throw new Error(res.error.message); return res.data; };
  const toUser = (u) => u && {
    id: u.id,
    email: u.email,
    name: u.user_metadata?.display_name || u.user_metadata?.full_name || u.user_metadata?.name || "",
    provider: u.app_metadata?.provider || "email",
    hasApp: u.user_metadata?.android_app === true,
  };
  let userId = null;

  return {
    preview: false,
    async init() { const { data } = await sb.auth.getSession(); userId = data.session?.user?.id || null; return toUser(data.session?.user); },
    onAuth(fn) { sb.auth.onAuthStateChange((evt, session) => { userId = session?.user?.id || null; fn(evt, toUser(session?.user)); }); },
    async signInWithGoogle() {
      if (APP) {
        const data = need(await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "ownit://auth", skipBrowserRedirect: true } }));
        appCall("openExternal", data.url);
        return;
      }
      need(await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo } }));
    },
    async sessionFromLink(fragment) {
      const q = new URLSearchParams(String(fragment || "").replace(/^[#?]/, ""));
      if (q.get("error_description") || q.get("error")) throw new Error(q.get("error_description") || q.get("error"));
      const access_token = q.get("access_token"), refresh_token = q.get("refresh_token");
      if (!access_token || !refresh_token) throw new Error("Sign-in didn't finish. Please try again.");
      need(await sb.auth.setSession({ access_token, refresh_token }));
    },
    async signUp(email, password, name) {
      const data = need(await sb.auth.signUp({ email, password, options: { data: { display_name: name }, emailRedirectTo: redirectTo } }));
      return { needsConfirm: !data.session };
    },
    async signIn(email, password) { need(await sb.auth.signInWithPassword({ email, password })); },
    async resetPassword(email) { need(await sb.auth.resetPasswordForEmail(email, { redirectTo })); },
    async updatePassword(pw) { need(await sb.auth.updateUser({ password: pw })); },
    async signOut() { await sb.auth.signOut(); },
    async getProfile() { return need(await sb.from("profiles").select("*").eq("id", userId).maybeSingle()); },
    async saveProfile(p) { return need(await sb.from("profiles").upsert({ id: userId, ...p }).select().single()); },
    async listVisits(sinceIso) {
      return need(await sb.from("visits").select("*").gte("started_at", sinceIso).order("started_at", { ascending: false }).limit(1000));
    },
    async startVisit(v) { return need(await sb.from("visits").insert({ ...v, user_id: userId }).select().single()); },
    async updateVisit(id, patch) { return need(await sb.from("visits").update(patch).eq("id", id).select().single()); },
    async markHasApp() { need(await sb.auth.updateUser({ data: { android_app: true } })); },
    async listSaves() { return need(await sb.from("saves").select("*").order("created_at", { ascending: false }).limit(1000)); },
    async addSave(row) { return need(await sb.from("saves").insert({ ...row, user_id: userId }).select().single()); },
    async updateSave(id, patch) { return need(await sb.from("saves").update(patch).eq("id", id).select().single()); },
    async deleteSave(id) { need(await sb.from("saves").delete().eq("id", id)); },
    async savePushSubscription(sub) {
      need(await sb.from("push_subscriptions").upsert(
        { user_id: userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        { onConflict: "endpoint" },
      ));
    },
  };
}

// ---------------------------------------------------------------------------
// Notifications: "time's up" alerts that bring you back to OwnIt
// ---------------------------------------------------------------------------
const Notify = {
  isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
  installed: matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
  canRun() { return "serviceWorker" in navigator && "Notification" in window && "PushManager" in window; },
  /** on | off | denied | ios-install | unsupported | preview */
  state() {
    if (DEMO) return "preview";
    if (this.isIOS && !this.installed) return "ios-install";
    if (!this.canRun()) return "unsupported";
    if (Notification.permission === "denied") return "denied";
    return Notification.permission === "granted" && store.get("ownit.notify", false) ? "on" : "off";
  },
  async registration() {
    if (!("serviceWorker" in navigator)) return null;
    try { return (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("sw.js")); }
    catch { return null; }
  },
  async enable() {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { store.set("ownit.notify", false); return perm; }
    await navigator.serviceWorker.register("sw.js");
    const reg = await navigator.serviceWorker.ready;
    if (cfg.vapidPublicKey) {
      const key = Uint8Array.from(atob(cfg.vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      await S.api.savePushSubscription(sub.toJSON());
    }
    store.set("ownit.notify", true);
    return "granted";
  },
  /** Shown by the page itself when its own timer runs out (the server sends one too; same tag, so you only see one). */
  async timeUp(v) {
    if (this.state() !== "on") return;
    const reg = await this.registration();
    const payload = {
      title: "Time's up",
      body: v.kind === "free" ? "Your free scroll is over. Was it worth it? Tap to check in." : `Did you find "${v.intent}"? Tap to check in.`,
      tag: "ownit-visit-" + v.id,
    };
    if (reg?.active) reg.active.postMessage({ type: "ownit-notify", payload });
  },
};

function guardCard(compact) {
  const st = appStatus();
  if (st.guardOn) return "";
  const restricted = st.restrictedSettings
    ? `<button class="quiet-link nb-help" data-action="app-info">Is it greyed out? Tap here, then ⋮ → “Allow restricted settings”.</button>` : "";
  return `<div class="notify-banner guard-banner ${compact ? "notify-wrap" : ""}">
    <span class="nb-icon">${ICONS.logo}</span>
    <div class="nb-text"><b>Turn on OwnIt Guard</b><span>It stops TikTok opening without a plan, and pulls you out when time's up.</span></div>
    <button class="btn btn-primary" data-action="guard-settings">Turn on</button>
    ${restricted}
  </div>`;
}

function notifyCard(compact) {
  if (APP) return guardCard(compact);
  const st = Notify.state();
  if (st === "on") return "";
  const text = {
    off: ["Get called back when time's up", "A notification brings you straight back here."],
    "ios-install": ["Add OwnIt to your Home Screen", "In Safari: Share, then “Add to Home Screen”. Notifications only work from there."],
    denied: ["Notifications are blocked", "Allow them for this site in your settings."],
    unsupported: ["No notifications in this browser", "Use Chrome on Android, or the Home Screen app on iPhone."],
    preview: ["Notifications come with the real website", "This preview can't send them."],
  }[st];
  const btn = st === "off" ? `<button class="btn btn-primary" data-action="enable-notify" ${S.busy ? "disabled" : ""}>Turn on</button>` : "";
  return `<div class="notify-banner ${compact ? "notify-wrap" : ""}">
    <span class="nb-icon">${ICONS.bell}</span>
    <div class="nb-text"><b>${esc(text[0])}</b><span>${esc(text[1])}</span></div>
    ${btn}
  </div>`;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
const S = {
  api: null,
  phase: "loading",          // loading | auth | recovery | onboarding | reality | app
  user: null,
  profile: null,
  visits: [],                // this week and last week, newest first
  saves: [],                 // saved videos, newest first
  draft: null,               // a link being saved (the "Where should this go?" sheet)
  tab: "home",               // home | saved | insights | menu | scroll | settings | guide | answers | account
  help: {},                  // which "How does this work?" notes are open in Settings
  guide: null,               // which Guide topic is open
  authMode: "signin",        // signin | signup | reset
  authOpen: false,           // false = show the landing story first
  authMsg: null,             // { kind: 'error' | 'info', text }
  busy: false,
  onb: { step: 0, answers: {} },
  platform: null,
  minutes: store.get("ownit.minutes", 5),
  freeMinutes: 10,
  showFree: false,
  intentError: false,
  editingGoal: false,
  toast: null,
};
const root = document.getElementById("root");

function openVisit() { return S.visits.find((v) => !v.outcome) || null; }
function visitMode(v) { return !v ? null : v.ended_at || Date.now() >= ms(v.started_at) + v.planned_minutes * 60000 ? "checkin" : "active"; }
function userApps() {
  const picked = (S.profile?.apps || []).filter((a) => PLATFORMS[a]);
  const rest = Object.keys(PLATFORMS).filter((a) => !picked.includes(a));
  return [...picked, ...rest];
}
function displayName() { return S.profile?.display_name || S.user?.name || (S.user?.email || "").split("@")[0]; }

let toastTimer, momentTimer;
function toast(text) {
  S.toast = text; render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { S.toast = null; render(); }, 3800);
}

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------
async function loadUserData() {
  const since = new Date(startOfWeek().getTime() - 7 * 86400000).toISOString();
  const [profile, visits] = await Promise.all([S.api.getProfile(), S.api.listVisits(since)]);
  S.profile = profile;
  S.visits = visits || [];
  if (!S.platform) S.platform = userApps()[0];
  syncGuardedApps();
  if (APP && S.user && !S.user.hasApp) { S.user.hasApp = true; S.api.markHasApp().catch(() => {}); }
  if (S.user?.hasApp) store.set("ownit.noApp", true);
  S.api.listSaves().then((rows) => { S.saves = rows || []; if (S.phase === "app") render(); }).catch((e) => console.warn("Saved videos didn't load", e));
}

async function afterSignIn(user) {
  S.user = user;
  S.phase = "loading"; render();
  try {
    await loadUserData();
    if (!S.profile?.onboarded_at) {
      S.onb = { step: 0, answers: { display_name: user.name || "", apps: ["tiktok"], ...(S.profile || {}) } };
      S.phase = "onboarding";
    } else {
      S.phase = "app";
      if (S.pendingShare) { const t = S.pendingShare; S.pendingShare = null; setTimeout(() => beginSave(t), 0); }
    }
  } catch (e) {
    S.phase = "auth";
    S.authMsg = { kind: "error", text: friendlyError(e.message) };
  }
  render();
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
function demoBanner() {
  return S.api?.preview
    ? '<div class="demo-banner"><strong>Preview mode.</strong> Accounts and visits are saved in this browser only.</div>'
    : "";
}

function viewLoading() {
  return '<div class="center-screen"><div class="spinner" role="status" aria-label="Loading"></div></div>';
}

function viewAuth() {
  const m = S.authMode;
  const msg = S.authMsg ? `<p class="alert alert-${S.authMsg.kind}" role="${S.authMsg.kind === "error" ? "alert" : "status"}">${esc(S.authMsg.text)}</p>` : "";
  const busy = S.busy ? "disabled" : "";

  let form;
  if (m === "reset") {
    form = `
      <div><h2>Reset your password</h2><p class="muted" style="margin-top:6px">We'll email you a link to choose a new one.</p></div>
      ${msg}
      <form class="auth-form" data-submit="reset" style="gap:14px" novalidate>
        <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required></div>
        <button class="btn btn-primary btn-block" ${busy}>${S.busy ? "Sending…" : "Send reset link"}</button>
      </form>
      <p class="fineprint"><button class="linkish" data-action="auth-mode" data-mode="signin">Back to sign in</button></p>`;
  } else {
    const signup = m === "signup";
    form = `
      <div>
        <h2>${signup ? "Create your account" : "Welcome back"}</h2>
        <p class="muted" style="margin-top:6px">${signup ? "Two minutes to set up. Then you're in control." : "Sign in to pick up where you left off."}</p>
      </div>
      <div class="tabs" role="tablist">
        <button class="tab" role="tab" aria-selected="${!signup}" data-action="auth-mode" data-mode="signin">Sign in</button>
        <button class="tab" role="tab" aria-selected="${signup}" data-action="auth-mode" data-mode="signup">Create account</button>
      </div>
      ${GOOGLE_ON ? `<button class="btn btn-outline btn-block" data-action="google" ${busy}>${ICONS.google} Continue with Google</button>
      <div class="divider">or use your email</div>` : ""}
      ${msg}
      <form class="auth-form" data-submit="${signup ? "signup" : "signin"}" style="gap:14px" novalidate>
        ${signup ? '<div class="field"><label for="name">First name</label><input class="input" id="name" name="name" autocomplete="given-name" required></div>' : ""}
        <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required></div>
        <div class="field">
          <div class="row-between"><label for="password">Password</label>${signup ? '<span class="hint">At least 6 characters</span>' : '<button type="button" class="linkish" style="font-size:14px" data-action="auth-mode" data-mode="reset">Forgot password?</button>'}</div>
          <input class="input" id="password" name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="6" required>
        </div>
        <button class="btn btn-primary btn-block" ${busy}>${S.busy ? "One moment…" : signup ? "Create account" : "Sign in"}</button>
      </form>
      <p class="fineprint">OwnIt never sees what you watch. We only save the goals you set and how your visits went.<br><a href="privacy.html" style="color:inherit">Privacy Policy</a> · <a href="terms.html" style="color:inherit">Terms of Service</a></p>`;
  }

  return `
    <div class="auth">
      <section class="auth-brand">
        <span class="logo">${WORDMARK}</span>
        <div style="display:flex;flex-direction:column;gap:18px;position:relative;z-index:1">
          <h1 class="auth-headline">Use social media. <em>Don't let it use you.</em></h1>
          <p class="auth-lede">Say what you're looking for, go straight to it, and come back out. No endless feed.</p>
        </div>
        <ul class="auth-steps">
          <li><span class="step-dot">1</span><div><b>Say what you want</b><span>"Easy injera recipe", "Python loops tutorial"</span></div></li>
          <li><span class="step-dot">2</span><div><b>Go straight to it</b><span>OwnIt opens the search results, not the For You feed.</span></div></li>
          <li><span class="step-dot">3</span><div><b>Come back out</b><span>A timer calls you back and asks if you found it.</span></div></li>
        </ul>
        <div class="phone-card" aria-hidden="true">
          <div class="pc-top"><span>Searching TikTok</span><span class="pc-time">3:06 left</span></div>
          <div class="pc-q">“easy injera recipe”</div>
          <div class="pc-bar"><i></i></div>
        </div>
      </section>
      <section class="auth-panel">
        <div class="auth-form"><button class="linkish auth-back" data-action="back-landing">← Why OwnIt?</button>${form}</div>
      </section>
    </div>`;
}

function viewRecovery() {
  const msg = S.authMsg ? `<p class="alert alert-${S.authMsg.kind}">${esc(S.authMsg.text)}</p>` : "";
  return `
    <div class="center-screen">
      <form class="auth-form card" data-submit="new-password" style="padding:28px" novalidate>
        <h2>Choose a new password</h2>
        ${msg}
        <div class="field"><label for="password">New password</label><input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="6" required></div>
        <button class="btn btn-primary btn-block" ${S.busy ? "disabled" : ""}>Save password</button>
      </form>
    </div>`;
}

function suggestedGoal(ans) {
  const hours = parseFloat(ans.daily_hours || "3");
  const half = Math.round((hours * 60) / 2 / 15) * 15;
  return Math.min(90, Math.max(15, half));
}

function viewOnboarding() {
  const { step, answers } = S.onb;
  const q = QUESTIONS[step];
  const total = QUESTIONS.length;
  const val = answers[q.id];
  let body = "";

  if (q.type === "text") {
    body = `<input class="input big-input" id="onb-text" value="${esc(val || "")}" placeholder="${esc(q.placeholder)}" maxlength="80" autocomplete="off" enterkeyhint="next">`;
  } else if (q.type === "single" || q.type === "multi") {
    const multi = q.type === "multi";
    body = `<div class="options ${q.options.length > 5 ? "two" : ""}" role="group" aria-label="${esc(q.title)}">` +
      q.options.map(([id, label]) => {
        const on = multi ? (val || []).includes(id) : val === id;
        return `<button type="button" class="option ${multi ? "" : "radio"}" aria-pressed="${on}" data-action="onb-pick" data-id="${id}"><span class="tick">${on ? ICONS.check : ""}</span>${esc(label)}</button>`;
      }).join("") + "</div>";
  } else if (q.type === "goal") {
    const g = val || suggestedGoal(answers);
    answers[q.id] = g;
    const hours = parseFloat(answers.daily_hours || "0");
    const now = Math.round(hours * 60);
    body = `
      <div class="goal-picker">
        <div class="goal-value">${g}<small>min a day</small></div>
        <div class="chips">${GOAL_OPTIONS.map((m) => `<button type="button" class="chip" aria-pressed="${m === g}" data-action="onb-goal" data-min="${m}">${m} min</button>`).join("")}</div>
        ${now ? `<p class="muted">You told us you spend about <b>${now >= 60 ? (hours + " hours") : now + " min"}</b> a day now. We suggested about half.</p>` : ""}
      </div>`;
  }

  const canNext = q.type === "text" ? (!q.required || (val || "").trim()) : q.type === "multi" ? (val || []).length > 0 : q.type === "goal" ? true : !!val;
  return `
    <div class="onb">
      <div class="onb-top">
        ${step > 0 ? `<button class="btn btn-quiet" data-action="onb-back" aria-label="Back">${ICONS.back}</button>` : `<span class="logo"><span class="logo-mark">${ICONS.logo}</span></span>`}
        <div class="progress" aria-hidden="true"><i style="width:${((step + 1) / total) * 100}%"></i></div>
        <span class="onb-count">${step + 1}/${total}</span>
      </div>
      <div class="onb-body fade-in" data-step="${step}">
        ${step === 0 ? '<p class="eyebrow">Reality check · about 1 minute</p>' : ""}
        <h1 class="onb-title">${esc(q.title)}</h1>
        ${q.sub ? `<p class="onb-sub">${esc(q.sub)}</p>` : ""}
        ${body}
      </div>
      <div class="onb-nav">
        ${q.required === false ? '<button class="btn btn-quiet" data-action="onb-skip">Skip</button>' : "<span></span>"}
        <button class="btn btn-primary" data-action="onb-next" ${canNext ? "" : "disabled"}>${step === total - 1 ? "See my reality" : "Continue"}</button>
      </div>
    </div>`;
}

function realityFacts(p) {
  const hours = parseFloat(p.daily_hours || "0");
  const yearHours = Math.round(hours * 365);
  const yearDays = Math.round(yearHours / 24);
  const goal = p.daily_goal_minutes || 45;
  const savedYearHours = Math.max(0, Math.round(((hours * 60 - goal) * 365) / 60));
  const autopilot = { rarely: 0, sometimes: 1, often: 2, always: 3 }[p.autopilot] ?? 1;
  const hoursScore = hours <= 1 ? 0 : hours <= 2 ? 1 : hours <= 4 ? 2 : 3;
  const feelScore = { better: 0, same: 0, worse: 1, drained: 2 }[p.feeling] ?? 0;
  const score = autopilot + hoursScore + feelScore;
  const label = score <= 2 ? "Mostly in control" : score <= 5 ? "Half you, half the feed" : "The feed is in charge";
  return { hours, yearHours, yearDays, goal, savedYearHours, label };
}

function realityInsights(p) {
  const out = [];
  if (p.autopilot === "often" || p.autopilot === "always")
    out.push([ICONS.bolt, "You open apps on autopilot", "That's the moment the feed takes over. OwnIt asks what you're looking for before every visit, so the reason comes first."]);
  if (p.feeling === "worse" || p.feeling === "drained")
    out.push([ICONS.heart, "Long scrolls leave you feeling worse", "Short visits with a clear goal usually feel very different. Watch how your check-ins change over the next week."]);
  if ((p.uses || []).includes("nothing"))
    out.push([ICONS.target, "Sometimes you go in for nothing specific", "That's fine now and then. Use free scroll mode for it, with a limit you choose on purpose."]);
  const real = (p.uses || []).filter((u) => u !== "nothing" && u !== "fun");
  if (real.length)
    out.push([ICONS.search, "You have real reasons to be there", "Learning, how-tos, news, friends: all good reasons. OwnIt takes you straight to them, without the detour through the feed."]);
  out.push([ICONS.clock, `Your budget: ${p.daily_goal_minutes || 45} minutes a day`, "Each visit counts toward it. You'll see the ring fill up on your home screen."]);
  return out.slice(0, 4);
}

function viewReality() {
  const p = S.profile || {};
  const f = realityFacts(p);
  const hoursText = f.hours < 1 ? "under an hour" : f.hours + " hours";
  return `
    <div class="reality fade-in">
      <span class="logo">${WORDMARK}</span>
      <section class="reality-hero">
        <p class="eyebrow">Your reality, ${esc(displayName())}</p>
        <div class="reality-big">${f.yearDays}<small>days a year</small></div>
        <p>At <strong>${hoursText} a day</strong>, you spend about <strong>${f.yearHours.toLocaleString()} hours</strong> a year on social media. That's ${f.yearDays} full days, awake and scrolling.</p>
        ${f.savedYearHours > 0 ? `<p>Sticking to your ${f.goal}-minute budget gives you back about <strong>${f.savedYearHours.toLocaleString()} hours a year</strong>.${p.extra_hour ? ` Time to ${esc(p.extra_hour.replace(/^to\s+/i, ""))}.` : ""}</p>` : ""}
        <span class="tag-pill">${esc(f.label)}</span>
      </section>
      <div class="grid-2">
        ${realityInsights(p).map(([icon, title, text]) => `
          <div class="card insight"><span class="insight-icon">${icon}</span><div><h3 style="margin-bottom:4px">${esc(title)}</h3><p>${esc(text)}</p></div></div>`).join("")}
      </div>
      <button class="btn btn-primary btn-block" data-action="finish-reality" style="min-height:56px;font-size:17px">Start using OwnIt</button>
    </div>`;
}

// ----- app shell -----
// The mark: a ring that would spin forever, held open by one dot. Every moving part of OwnIt is drawn from it.
const RING = { cx: 430, cy: 512, r: 161, arc: "M430 351A161 161 0 1 0 591 505", bar: "M756 351V673", dot: [544, 398], circle: "M430 351A161 161 0 1 1 430 673A161 161 0 1 1 430 351" };
const LOOP = {
  /** The point a given fraction (0 to 1) of the way round the ring, clockwise from the top. */
  at(f) { const a = -Math.PI / 2 + Math.min(1, Math.max(0, f)) * Math.PI * 2; return [RING.cx + RING.r * Math.cos(a), RING.cy + RING.r * Math.sin(a)]; },
};
/** Home: the mark, alive. The ring keeps trying to turn; the dot holds it still. */
function loopLive() {
  return `<svg class="loop-live" viewBox="186 268 652 488" fill="none" aria-hidden="true">
    <g class="ll-ring"><path d="${RING.arc}"/></g>
    <path class="ll-bar" d="${RING.bar}"/>
    <circle class="ll-halo" cx="${RING.dot[0]}" cy="${RING.dot[1]}" r="46"/>
    <circle class="ll-dot" cx="${RING.dot[0]}" cy="${RING.dot[1]}" r="46"/>
  </svg>`;
}
/** Timer: the ring is your time. It shortens as the minutes go, and the dot leads the way round. */
function ringDash(gone) {
  const g = Math.min(1, Math.max(0, gone));
  return { array: `${(Math.max(0, 0.83 - g) * 1000).toFixed(1)} 2000`, offset: (-(g + 0.085) * 1000).toFixed(1) };
}
function loopTimer(frac) {
  const gone = 1 - Math.min(1, Math.max(0, frac));
  const [x, y] = LOOP.at(gone);
  const d = ringDash(gone);
  return `<svg class="loop-timer" id="loop-timer" viewBox="208 290 444 444" fill="none" aria-hidden="true">
    <path class="lt-track" d="${RING.circle}"/>
    <path class="lt-bar" id="lt-bar" pathLength="1000" stroke-dasharray="${d.array}" stroke-dashoffset="${d.offset}" d="${RING.circle}"/>
    <circle class="lt-halo" id="lt-halo" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="34"/>
    <circle class="lt-dot" id="lt-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="30"/>
  </svg>`;
}
const ART = {
  /** The mark. With `draw`, the ring sweeps round and the dot drops in to stop it. */
  loop: (draw) => `<svg class="art art-loop ${draw ? "draw" : ""}" viewBox="186 268 652 488" fill="none" aria-hidden="true">
    <path class="l1" pathLength="100" d="${RING.arc}" stroke="var(--ink)" stroke-width="83" stroke-linecap="round"/>
    <path class="bar" d="${RING.bar}" stroke="var(--ink)" stroke-width="83" stroke-linecap="round"/>
    <circle class="dot" cx="${RING.dot[0]}" cy="${RING.dot[1]}" r="46" fill="var(--ink)"/></svg>`,
  /** A small stack of kept videos. */
  saved: () => `<svg class="art" viewBox="0 0 120 96" fill="none" aria-hidden="true">
    <rect x="24" y="22" width="46" height="62" rx="10" stroke="var(--line)" stroke-width="4" transform="rotate(-10 47 53)"/>
    <rect x="50" y="18" width="46" height="62" rx="10" stroke="var(--brand)" stroke-width="4" transform="rotate(8 73 49)" fill="var(--bg)"/>
    <path d="M66 26h14v20l-7-5-7 5z" fill="var(--sun)" transform="rotate(8 73 49)"/>
    <path d="M62 58h22M62 67h14" stroke="var(--brand)" stroke-width="4" stroke-linecap="round" transform="rotate(8 73 49)"/></svg>`,
  /** An empty week: the loop lying flat, waiting. */
  week: () => `<svg class="art" viewBox="0 0 120 80" fill="none" aria-hidden="true">
    <path d="M14 62h92" stroke="var(--line)" stroke-width="4" stroke-linecap="round"/>
    <path d="M26 62V46M46 62V34M66 62V50M86 62V40" stroke="var(--brand)" stroke-width="7" stroke-linecap="round" opacity=".35"/>
    <circle cx="86" cy="26" r="6.500" fill="var(--sun)"/></svg>`,
};

/** The wordmark: the ring and its dot stand in for the O, followed by "wnIt". */
const WORDMARK = `<span class="wm" role="img" aria-label="OwnIt"><svg viewBox="208 290 444 444" fill="none" aria-hidden="true"><path d="${RING.arc}" stroke="currentColor" stroke-width="83" stroke-linecap="round"/><circle cx="${RING.dot[0]}" cy="${RING.dot[1]}" r="46" fill="currentColor"/></svg><span aria-hidden="true">wnIt</span></span>`;

const PAGES = {
  home: ["Home", "Search for one thing and go", ICONS.home],
  saved: ["Saved", "Videos you kept, by category", ICONS.bookmark],
  insights: ["Insights", "How your week went", ICONS.chart],
  scroll: ["Scroll on purpose", "A timed scroll, no search", ICONS.wave],
  settings: ["Settings", "Colours, text, budget and the Guard", ICONS.gear],
  guide: ["Guide", "How to do everything, step by step", ICONS.book],
  answers: ["Reality check", "Your answers and your numbers", ICONS.mirror],
  account: ["Account", "Your name, email and sign out", ICONS.user],
};
const TABS = ["home", "saved", "insights", "menu"];
function navItems() { return TABS.map((id) => (id === "menu" ? ["menu", "Menu", ICONS.menu] : [id, PAGES[id][0], PAGES[id][2]])); }
function goTo(tab) { S.tab = tab; S.linkTest = null; S.editSave = null; render(); window.scrollTo({ top: 0 }); }
function pageHead(title, sub, back = true) {
  return `<header class="page-head">${back ? `<button class="back-link" data-action="tab" data-tab="menu">${ICONS.back} Menu</button>` : ""}<h1 class="page-title">${esc(title)}</h1>${sub ? `<p class="page-sub">${esc(sub)}</p>` : ""}</header>`;
}
// ---------------------------------------------------------------------------
// Android app: first-run setup (notifications, restricted settings, OwnIt Guard)
// ---------------------------------------------------------------------------
const SETUP = { skipped: false, shown: false, finished: false, restrictedDone: false, back: false };
function setupSteps(st) {
  const steps = [{ id: "notify", done: st.notifyOn !== false }];
  if (st.usageOn !== undefined) {
    // App 0.3+: the Guard uses "Display over other apps" + "Usage access".
    steps.push({ id: "overlay", done: !!st.overlayOn });
    steps.push({ id: "usage", done: !!st.usageOn });
    if (st.batteryOn !== undefined) steps.push({ id: "battery", done: !!st.batteryOn || store.get("ownit.batterySkip", false) });
    return steps;
  }
  if (st.restrictedSettings) steps.push({ id: "restricted", done: (st.guardOn || SETUP.restrictedDone) && !SETUP.back });
  steps.push({ id: "guard", done: !!st.guardOn });
  return steps;
}
function setupScreen() {
  if (!APP) return null;
  const st = appStatus();
  const steps = setupSteps(st);
  if (steps.every((x) => x.done)) return SETUP.shown && !SETUP.finished ? viewSetupDone() : null;
  SETUP.shown = true;
  return viewSetup(steps);
}
function viewSetup(steps) {
  const i = steps.findIndex((x) => !x.done);
  const cur = steps[i].id;
  const pf = PLATFORMS[userApps()[0]]?.name || "TikTok";
  const C = {
    notify: {
      title: "Allow notifications",
      why: "So OwnIt can tell you when your time is up, even after you've left the app.",
      how: ["Tap the button below.", "Tap <b>Allow</b> when your phone asks."],
      btn: ["Allow notifications", "setup-notify"],
    },
    restricted: {
      title: "Unlock the Guard switch",
      why: "Android locks this for apps that don't come from the Play Store. It takes 10 seconds.",
      how: ["Tap the button below. OwnIt's <b>App info</b> opens.", "Tap <b>⋮</b> at the top right.", "Tap <b>Allow restricted settings</b> and confirm.", "Come back to OwnIt."],
      note: "No ⋮ menu or no such option? Your phone doesn't need this. Just tap “Done”.",
      btn: ["Open App info", "app-info"],
      next: "Done, next step",
    },
    overlay: {
      title: "Let OwnIt cover the app",
      why: `This lets OwnIt show the full-screen “Time's up” over ${pf}, and stop it opening without a plan.`,
      how: ["Tap the button below.", "Find <b>OwnIt</b> if you see a list, and tap it.", "Switch on <b>Allow display over other apps</b>.", "OwnIt brings you back here by itself."],
      btn: ["Open the setting", "overlay-settings"],
    },
    usage: {
      title: "Let OwnIt see which app is open",
      why: `So OwnIt knows when ${pf} opens. It only sees the app's name, never what's on your screen.`,
      how: ["Tap the button below. <b>Usage access</b> opens.", "Tap <b>OwnIt</b> in the list.", "Switch on <b>Permit usage access</b>.", "OwnIt brings you back here by itself."],
      btn: ["Open Usage access", "usage-settings"],
    },
    battery: {
      title: "Keep the Guard awake",
      why: "Some phones put apps to sleep to save battery. This keeps OwnIt Guard running, so nobody can slip past it.",
      how: ["Tap the button below.", "Tap <b>Allow</b> when your phone asks.", "OwnIt brings you back here by itself."],
      note: `<button class="quiet-link" data-action="battery-skip">My phone doesn't ask anything</button>`,
      btn: ["Keep OwnIt running", "battery-settings"],
    },
    guard: {
      title: "Turn on OwnIt Guard",
      why: `This is what stops ${pf} from opening without a plan, and pulls you out when time's up. OwnIt only sees which app is open, never what's on your screen.`,
      how: ["Tap the button below. <b>Accessibility</b> opens.", "Tap <b>Installed apps</b> (or <b>Downloaded apps</b>).", "Tap <b>OwnIt Guard</b>, switch it on, then tap <b>Allow</b>.", "OwnIt brings you back here by itself."],
      note: steps.some((x) => x.id === "restricted") ? `<button class="quiet-link" data-action="setup-back">Is the switch greyed out? Go back one step.</button>` : "",
      btn: ["Open Accessibility", "guard-settings"],
    },
  }[cur];
  return `
    <div class="onb setup">
      <div class="onb-top">
        <span class="logo"><span class="logo-mark">${ICONS.logo}</span></span>
        <div class="progress" aria-hidden="true"><i style="width:${(i / steps.length) * 100 + 8}%"></i></div>
        <span class="onb-count">${i + 1}/${steps.length}</span>
      </div>
      <div class="onb-body fade-in" data-step="${cur}">
        <p class="eyebrow">Set up OwnIt on this phone</p>
        <ol class="setup-list" aria-label="Setup steps">
          ${steps.map((x, k) => `<li class="${x.done ? "done" : k === i ? "now" : ""}"><span class="dot">${x.done ? ICONS.check : k + 1}</span>${esc({ notify: "Notifications", restricted: "Unlock the switch", guard: "OwnIt Guard", overlay: "Show on top", usage: "Usage access", battery: "Stay awake" }[x.id])}</li>`).join("")}
        </ol>
        <h1 class="onb-title">${C.title}</h1>
        <p class="onb-sub">${esc(C.why)}</p>
        <ol class="setup-how">${C.how.map((h) => `<li>${h}</li>`).join("")}</ol>
        <button class="btn btn-primary btn-block setup-go" data-action="${C.btn[1]}">${C.btn[0]}</button>
        ${C.next ? `<button class="btn btn-outline btn-block" data-action="setup-restricted-done">${C.next}</button>` : ""}
        ${C.note ? `<p class="setup-note">${C.note.startsWith("<") ? C.note : esc(C.note)}</p>` : ""}
      </div>
      <p class="setup-note">OwnIt needs every step. Without them, ${esc(pf)} could still be opened directly.</p>
    </div>`;
}
function viewSetupDone() {
  const pf = PLATFORMS[userApps()[0]]?.name || "TikTok";
  return `
    <div class="onb setup">
      <div class="onb-body fade-in setup-done">
        ${ART.loop(true)}
        <h1 class="onb-title">You're protected</h1>
        <p class="onb-sub">Try it now: open ${esc(pf)} from your home screen. OwnIt will send you back here and ask what you're looking for.</p>
        <button class="btn btn-primary btn-block" data-action="setup-finish">Start using OwnIt</button>
      </div>
    </div>`;
}

function viewApp() {
  const setup = setupScreen();
  if (setup) return setup;
  const v = openVisit();
  const mode = visitMode(v);
  if (!PAGES[S.tab] && S.tab !== "menu") S.tab = "home";
  let page;
  if (mode === "active") page = viewActive(v);
  else if (mode === "checkin") page = viewCheckin(v);
  else if (S.linkTest) page = viewLinkTest();
  else page = { saved: viewSaved, insights: viewInsights, menu: viewMenu, scroll: viewScroll, settings: viewSettings, guide: viewGuide, answers: viewAnswers, account: viewAccount }[S.tab]?.() ?? viewHome();
  if (S.draft) page += viewSaveSheet(mode === "active" ? v : null);
  page += viewMomentFull();

  const current = mode ? "home" : TABS.includes(S.tab) ? S.tab : "menu";
  const tabs = navItems().map(([id, label, icon]) => `<button data-action="tab" data-tab="${id}" ${current === id ? 'aria-current="page"' : ""}>${icon}${label}</button>`).join("");
  const side = Object.entries(PAGES).map(([id, [label, , icon]]) => `<button data-action="tab" data-tab="${id}" ${!mode && S.tab === id ? 'aria-current="page"' : ""}>${icon}${label}</button>`).join("");
  return `
    <div class="shell">
      <aside class="sidebar">
        <span class="logo">${WORDMARK}</span>
        <nav class="nav" aria-label="All pages">${side}</nav>
        <div class="side-user">
          <span class="avatar">${esc(initials(displayName(), S.user?.email))}</span>
          <div><b>${esc(displayName())}</b><small>${esc(S.user?.email || "")}</small></div>
        </div>
      </aside>
      <div class="main">
        <header class="topbar">
          <span class="logo">${WORDMARK}</span>
          <button class="icon-btn" data-action="tab" data-tab="menu" aria-label="Menu">${ICONS.menu}</button>
        </header>
        <main class="content">${page}</main>
      </div>
      <nav class="tabbar" aria-label="Main">${tabs}</nav>
    </div>`;
}

function todayMinutes() {
  const start = startOfDay().getTime();
  return Math.round(S.visits.filter((v) => ms(v.started_at) >= start).reduce((a, v) => a + visitMinutes(v), 0));
}

function ringSvg(frac, r = 44) {
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, frac)));
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${r}"/><circle class="bar" cx="50" cy="50" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg>`;
}

function budgetLine() {
  const goal = S.profile?.daily_goal_minutes || 45;
  const used = todayMinutes();
  const left = goal - used;
  return `<div class="budget-line">
    <div class="budget-bar ${used >= goal ? "over" : ""}" role="img" aria-label="${used} of ${goal} minutes used today"><i style="width:${Math.min(100, (used / goal) * 100)}%"></i></div>
    <span>${left > 0 ? `<b>${left} min</b> left today` : "<b>Budget used</b> for today"}</span>
  </div>`;
}
function appPicker() {
  return `<div class="seg" role="group" aria-label="App">
    ${userApps().map((id) => `<button type="button" class="seg-btn" aria-pressed="${id === S.platform}" data-action="platform" data-id="${id}"><span class="pf-dot" style="background:${PLATFORMS[id].color}"></span>${PLATFORMS[id].name}</button>`).join("")}
  </div>`;
}
function viewMomentFull() {
  const m = S.moment; if (!m?.full) return "";
  return `<div class="moment-full m-${m.outcome}" data-action="moment-seen" role="status">
    <div class="mf-art">${ART.loop(true)}<i class="mf-ring"></i><i class="mf-ring r2"></i></div>
    <h2>${esc(m.title)}</h2>
    <p>${esc(m.text)}</p>
  </div>`;
}
function viewMoment() {
  const m = S.moment; if (!m || m.full) return "";
  return `<div class="moment m-${m.outcome}" role="status">
    ${ART.loop(true)}
    <div><b>${esc(m.title)}</b><span>${esc(m.text)}</span></div>
    <button class="moment-x" data-action="moment-close" aria-label="Close">×</button>
  </div>`;
}
function viewHome() {
  const pf = PLATFORMS[S.platform] || PLATFORMS.tiktok;
  const recent = [];
  const seen = new Set();
  for (const v of S.visits) {
    const k = (v.intent || "").toLowerCase();
    if (v.kind === "search" && v.intent && !v.saved_url && !seen.has(k)) { seen.add(k); recent.push(v); }
    if (recent.length >= 3) break;
  }
  const blocked = S.blocked && PLATFORMS[S.blocked] ? `
    <div class="blocked-card fade-in" role="alert">
      <b>You opened ${esc(PLATFORMS[S.blocked].name)} directly.</b>
      <span>Say what you're looking for first. OwnIt will take you straight to it.</span>
    </div>` : "";
  return `<div class="home">
    ${blocked}
    ${viewMoment()}
    <div class="home-loop">${loopLive()}<p class="hello">${greeting()}, ${esc(displayName())}</p></div>
    <form class="go" data-submit="go" novalidate>
      <h1 id="go-q"><span>What are you</span> looking for?</h1>
      <label class="search-box" for="intent">${ICONS.search}<input id="intent" autocomplete="off" enterkeyhint="go" maxlength="120" placeholder="easy injera recipe" aria-labelledby="go-q"></label>
      ${S.intentError ? '<p class="field-error">Type what you\'re looking for first.</p>' : ""}
      ${recent.length ? `<div class="recent" aria-label="Recent searches">${recent.map((v) => `<button type="button" class="chip chip-soft" data-action="reuse" data-q="${esc(v.intent)}">${esc(v.intent)}</button>`).join("")}</div>` : ""}
      <div class="pick"><span>On</span>${appPicker()}</div>
      <div class="pick"><span>For</span><div class="seg" role="group" aria-label="Time you need">${SEARCH_MINUTES.map((m) => `<button type="button" class="seg-btn" aria-pressed="${m === S.minutes}" data-action="minutes" data-min="${m}">${m} min</button>`).join("")}</div></div>
      <a class="btn btn-gold go-btn" data-action="go" href="${pf.search("")}" target="_blank" rel="noopener">Go to ${pf.name}<span class="go-dot" aria-hidden="true"></span></a>
    </form>
    ${budgetLine()}
  </div>`;
}

// ----- Scroll on purpose: a timed scroll without a search -----
function viewScroll() {
  const pf = PLATFORMS[S.platform] || PLATFORMS.tiktok;
  return `
    ${pageHead("Scroll on purpose", "No search this time. Pick how long, and OwnIt pulls you out when it's over.")}
    <section class="plain-form">
      <div class="pick"><span>On</span>${appPicker()}</div>
      <div class="pick"><span>For</span><div class="seg" role="group" aria-label="How long">${FREE_MINUTES.map((m) => `<button type="button" class="seg-btn" aria-pressed="${m === S.freeMinutes}" data-action="free-minutes" data-min="${m}">${m} min</button>`).join("")}</div></div>
      <a class="btn btn-gold go-btn" data-action="free-go" href="${pf.feed}" target="_blank" rel="noopener">Scroll ${pf.name} for ${S.freeMinutes} minutes</a>
    </section>
    ${budgetLine()}`;
}

// ----- Menu: every page in one place -----
function viewMenu() {
  const rows = Object.entries(PAGES).map(([id, [label, sub, icon]]) => `
    <li><button data-action="tab" data-tab="${id}"><span class="menu-ic">${icon}</span><span class="menu-tx"><b>${label}</b><small>${sub}</small></span>${ICONS.chev}</button></li>`).join("");
  return `
    ${pageHead("Menu", "", false)}
    <ul class="menu-list">${rows}</ul>
    ${wantsApp() ? `<div class="get-app">
      <span class="menu-ic">${ICONS.down}</span>
      <div class="menu-tx"><b>Get the Android app</b><small>It blocks ${esc(PLATFORMS[userApps()[0]].name)} from opening without a plan.${IS_ANDROID ? "" : " Android phones only."}</small></div>
      <a class="btn btn-primary" href="${ANDROID_APK}" download>Download</a>
      <button class="quiet-link" data-action="no-app">I already have it</button>
    </div>` : ""}
    <p class="menu-foot"><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Service</a></p>`;
}

function visitRow(v) {
  const title = v.kind === "free" ? `Free scroll on ${PLATFORMS[v.platform]?.name || v.platform}` : v.intent;
  const status = v.outcome ? OUTCOME_WORD[v.outcome] : "In progress";
  return `<li>
    <span class="outcome-dot o-${v.outcome || "open"}" role="img" aria-label="${esc(status)}"></span>
    <div class="what"><b>${esc(title)}</b><small>${esc(PLATFORMS[v.platform]?.name || "")} · ${relTime(v.started_at)} · ${esc(status)}</small></div>
    <span class="right">${Math.max(1, Math.round(visitMinutes(v)))} min</span>
  </li>`;
}

function viewActive(v) {
  const pf = PLATFORMS[v.platform] || PLATFORMS.tiktok;
  const href = v.saved_url || (v.kind === "free" ? pf.feed : searchLink(v.platform, v.intent));
  const total = v.planned_minutes * 60000;
  const left = ms(v.started_at) + total - Date.now();
  return `
    <section class="visit" aria-live="polite">
      <p class="visit-on">${v.kind === "free" ? `Scrolling ${pf.name}` : `On ${pf.name}, looking for`}</p>
      <p class="visit-intent">${v.kind === "free" ? "A scroll on purpose" : esc(v.intent)}</p>
      <div class="loop-wrap ${left < 60000 ? "low" : ""}" id="loop-wrap">
        ${loopTimer(left / total)}
        <div class="loop-in"><div class="countdown" id="countdown" role="timer">${fmtClock(left)}</div><p class="visit-of">left of ${v.planned_minutes} min</p></div>
      </div>
      <div class="visit-actions">
        <button class="btn btn-gold" data-action="done">I'm done</button>
        ${APP ? `<button class="btn btn-ghost" data-action="reopen">Back to ${pf.name}</button>` : `<a class="btn btn-ghost" href="${esc(href)}" target="_blank" rel="noopener">Back to ${pf.name}</a>`}
      </div>
      <p class="hint">${APP ? `When the ring runs out, OwnIt covers ${pf.name} and brings you back.` : Notify.state() === "on" ? "You'll get a notification when the ring runs out." : "Found it early? Tap “I'm done”. Getting out early is the whole point."}</p>
    </section>
    ${notifyCard(true)}`;
}

function viewCheckin(v) {
  const free = v.kind === "free";
  const end = v.ended_at ? ms(v.ended_at) : Date.now();
  const spent = end - ms(v.started_at);
  const over = spent - v.planned_minutes * 60000;
  const timeUp = !v.ended_at || over >= 0;
  const timing = over > 60000
    ? `You planned ${v.planned_minutes} min and came back ${Math.round(over / 60000)} min late.`
    : `You planned ${v.planned_minutes} min and came back in ${Math.max(1, Math.round(Math.min(spent, v.planned_minutes * 60000) / 60000))}.`;
  const marks = { found: ICONS.check, partly: "~", distracted: "×" };
  return `
    <section class="checkin fade-in">
      <p class="visit-on">${timeUp ? "Time's up." : "Welcome back."} ${timing}</p>
      <h1>${free ? "<span>Was that scroll</span> worth it?" : "<span>Did you</span> find it?"}</h1>
      ${free ? "" : `<p class="checkin-q">${esc(v.intent)}</p>`}
      <div class="answers">
        ${OUTCOMES[free ? "free" : "search"].map(([id, label]) => `<button class="answer a-${id}" data-action="checkin" data-outcome="${id}" ${S.busy ? "disabled" : ""}><span class="answer-mark">${marks[id]}</span>${esc(label)}</button>`).join("")}
      </div>
      <p class="hint">An honest answer makes your weekly score mean something.</p>
    </section>`;
}

function weekChart(week, goal) {
  const start = startOfWeek();
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const mins = names.map((_, i) => {
    const a = start.getTime() + i * 86400000, b = a + 86400000;
    return Math.round(week.filter((v) => ms(v.started_at) >= a && ms(v.started_at) < b).reduce((s, v) => s + visitMinutes(v), 0));
  });
  const todayIdx = (new Date().getDay() + 6) % 7;
  const W = 640, H = 220, padL = 34, padR = 12, padT = 18, padB = 28;
  const maxV = Math.max(goal * 1.25, ...mins, 10);
  const step = maxV > 120 ? 60 : maxV > 60 ? 30 : 15;
  const top = Math.ceil(maxV / step) * step;
  const y = (v) => padT + (H - padT - padB) * (1 - v / top);
  const bw = (W - padL - padR) / 7;
  let g = "";
  for (let t = 0; t <= top; t += step) g += `<line class="gridline" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`;
  const bars = mins.map((m, i) => {
    const x = padL + i * bw + bw * 0.22, w = bw * 0.56;
    const h = Math.max(m ? 3 : 0, y(0) - y(m));
    return `<rect class="${m > goal ? "bar-over" : "bar-fill"}" x="${x.toFixed(1)}" y="${(y(0) - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="5"><title>${names[i]}: ${m} min</title></rect>
      <text class="${i === todayIdx ? "today-label" : ""}" x="${(x + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${names[i]}</text>`;
  }).join("");
  const goalLine = `<line class="goal-line" x1="${padL}" x2="${W - padR}" y1="${y(goal)}" y2="${y(goal)}"/><text class="goal-label" x="${W - padR}" y="${y(goal) - 6}" text-anchor="end">Budget ${goal} min</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutes per day this week">${g}${bars}${goalLine}</svg>`;
}

/** The week as seven columns of dots, one per visit. Gold means you found what you came for. */
function dotWeek(week) {
  const start = startOfWeek().getTime();
  const todayIdx = (new Date().getDay() + 6) % 7;
  const cols = ["M", "T", "W", "T", "F", "S", "S"].map((name, i) => {
    const a = start + i * 86400000, b = a + 86400000;
    const vs = week.filter((v) => ms(v.started_at) >= a && ms(v.started_at) < b).reverse();
    const dots = vs.slice(0, 8).map((v, k) => `<i class="vd d-${v.outcome || "open"}" style="--i:${k}" title="${esc(v.intent || "Scroll")}"></i>`).join("");
    return `<div class="dw-col ${i === todayIdx ? "today" : ""} ${i > todayIdx ? "future" : ""}"><div class="dw-dots">${dots}${vs.length > 8 ? `<small>+${vs.length - 8}</small>` : ""}</div><span>${name}</span></div>`;
  }).join("");
  return `<div class="dot-week" role="img" aria-label="Your visits this week, one dot each">${cols}</div>`;
}
function viewInsights() {
  const goal = S.profile?.daily_goal_minutes || 45;
  const weekStart = startOfWeek().getTime();
  const week = S.visits.filter((v) => ms(v.started_at) >= weekStart);
  const lastWeek = S.visits.filter((v) => ms(v.started_at) < weekStart);
  const done = week.filter((v) => v.outcome);
  const found = done.filter((v) => v.outcome === "found").length;
  const rate = done.length ? Math.round((found / done.length) * 100) : null;
  const lastDone = lastWeek.filter((v) => v.outcome);
  const lastRate = lastDone.length ? Math.round((lastDone.filter((v) => v.outcome === "found").length / lastDone.length) * 100) : null;
  const minutes = Math.round(week.reduce((s, v) => s + visitMinutes(v), 0));
  const pulled = done.filter((v) => v.outcome === "distracted").length;
  const counts = { found, partly: done.filter((v) => v.outcome === "partly").length, distracted: pulled };
  const byPlatform = Object.keys(PLATFORMS).map((id) => [id, week.filter((v) => v.platform === id).length]).filter(([, n]) => n);

  if (!week.length) {
    return `
      <header class="page-head"><h1 class="page-title">Insights</h1></header>
      <section class="empty-page">
        ${ART.week()}
        <h2>Nothing to measure yet</h2>
        <p>Start a visit from Home and check in when you come back. Your week shows up here.</p>
        <button class="btn btn-primary" data-action="tab" data-tab="home">Go to Home</button>
      </section>`;
  }
  const trend = lastRate != null && rate != null && rate !== lastRate ? `${rate > lastRate ? "Up" : "Down"} from ${lastRate}% last week.` : "";
  return `
    <header class="page-head"><h1 class="page-title">Insights</h1><p class="page-sub">This week, Monday to today.</p></header>
    <section class="hero-stat">
      <b><span data-count="${rate == null ? "" : rate}">${rate == null ? "–" : rate}</span>${rate == null ? "" : "<i>%</i>"}</b>
      <p>${rate == null ? "Check in after a visit to see how many were on purpose." : "of your visits got you what you came for."} ${trend}</p>
    </section>
    <dl class="facts">
      <div><dt>${week.length === 1 ? "visit" : "visits"}</dt><dd>${week.length}</dd></div>
      <div><dt>minutes</dt><dd>${minutes}</dd></div>
      <div><dt>${pulled === 1 ? "time the feed won" : "times the feed won"}</dt><dd>${pulled}</dd></div>
    </dl>
    <section class="block">
      <div class="block-head"><h2>Every visit is a dot</h2></div>
      ${dotWeek(week)}
      <div class="legend"><span><i class="vd d-found"></i>Found it</span><span><i class="vd d-partly"></i>Sort of</span><span><i class="vd d-distracted"></i>The feed won</span></div>
    </section>
    <section class="block">
      <div class="block-head"><h2>Minutes per day</h2><span class="hint">Red means over budget</span></div>
      <div style="overflow-x:auto">${weekChart(week, goal)}</div>
    </section>
    <section class="block">
      <div class="block-head"><h2>How your visits went</h2></div>
      ${done.length ? `
        <div class="stack" role="img" aria-label="${counts.found} found, ${counts.partly} sort of, ${counts.distracted} distracted">
          ${["found", "partly", "distracted"].map((k) => counts[k] ? `<i class="o-${k}" style="width:${(counts[k] / done.length) * 100}%"></i>` : "").join("")}
        </div>
        <div class="legend">${["found", "partly", "distracted"].map((k) => `<span><i class="outcome-dot o-${k}"></i>${OUTCOME_WORD[k]}: ${counts[k]}</span>`).join("")}</div>`
        : '<p class="empty">Check in after a visit and it will show up here.</p>'}
    </section>
    ${byPlatform.length > 1 ? `<section class="block">
      <div class="block-head"><h2>Where you went</h2></div>
      <ul class="list">${byPlatform.map(([id, n]) => `<li><span class="pf-dot" style="background:${PLATFORMS[id].color}"></span><div class="what"><b>${PLATFORMS[id].name}</b></div><span class="right">${n} ${n === 1 ? "visit" : "visits"}</span></li>`).join("")}</ul>
    </section>` : ""}
    <section class="block">
      <div class="block-head"><h2>Every visit this week</h2></div>
      <ul class="list">${week.slice(0, 30).map(visitRow).join("")}</ul>
    </section>`;
}

function labelFor(qid, value) {
  const q = QUESTIONS.find((x) => x.id === qid);
  if (!q?.options) return value;
  const map = Object.fromEntries(q.options);
  return Array.isArray(value) ? value.map((v) => map[v] || v).join(", ") : map[value] || value;
}

// ---------------------------------------------------------------------------
// Saved: videos you chose to keep, sorted into your own categories
// ---------------------------------------------------------------------------
const DEFAULT_CATEGORIES = ["Learn", "Recipes", "Ideas", "Watch later"];
function linkPlatform(url) {
  let h = "";
  try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { return "link"; }
  if (/(^|\.)tiktok\.com$/.test(h)) return "tiktok";
  if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
  if (/(^|\.)youtube\.com$/.test(h) || h === "youtu.be") return "youtube";
  return "link";
}
function firstUrl(text) { const m = String(text || "").match(/https?:\/\/[^\s<>"']+/i); return m ? m[0].replace(/[).,]+$/, "") : ""; }
function categories() {
  const seen = new Map();
  for (const r of S.saves) if (r.category) seen.set(r.category, (seen.get(r.category) || 0) + 1);
  const mine = [...seen.keys()];
  const extra = [...(S.extraCats || []), ...(mine.length ? [] : DEFAULT_CATEGORIES)].filter((c) => !seen.has(c));
  return { list: [...mine, ...extra], count: seen };
}
function platformName(id) { return PLATFORMS[id]?.name || "Link"; }

/** Starts saving a link: opens the "Where should this go?" sheet and looks up the title and picture. */
function beginSave(text) {
  const url = firstUrl(text);
  if (!url) { toast("That doesn't look like a link."); return; }
  if (S.saves.some((r) => r.url === url)) { S.tab = "saved"; S.cat = null; toast("You already saved this one."); return; }
  const v = openVisit();
  const live = v && visitMode(v) === "active" && v.kind === "search" ? v.intent : "";
  const title = String(text || "").replace(url, "").replace(/\s+/g, " ").trim().slice(0, 140);
  S.draft = { key: uid(), url, platform: linkPlatform(url), title, author: "", thumb: "", note: live, category: store.get("ownit.lastCat", "") || "" };
  render();
  lookupMeta(S.draft);
}
function applyMeta(key, meta) {
  const d = S.draft; if (!d || d.key !== key || !meta) return;
  if (meta.url && linkPlatform(meta.url) === d.platform) d.url = meta.url;
  if (meta.title) d.title = String(meta.title).slice(0, 200);
  if (meta.author) d.author = String(meta.author).slice(0, 80);
  if (meta.thumb) d.thumb = String(meta.thumb);
  render();
}
function lookupMeta(d) {
  if (APP?.fetchMeta) { appCall("fetchMeta", d.url, d.key); return; }
  const ep = d.platform === "tiktok" ? "https://www.tiktok.com/oembed?url=" : d.platform === "youtube" ? "https://www.youtube.com/oembed?format=json&url=" : "";
  if (!ep) return;
  fetch(ep + encodeURIComponent(d.url)).then((r) => (r.ok ? r.json() : null))
    .then((j) => j && applyMeta(d.key, { title: j.title, author: j.author_name, thumb: j.thumbnail_url })).catch(() => {});
}

function viewSaveSheet(liveVisit) {
  const d = S.draft;
  const { list } = categories();
  const pick = d.category;
  return `
    <div class="sheet-back" data-action="draft-cancel"></div>
    <section class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
      <div class="sheet-grip" aria-hidden="true"></div>
      <div class="save-preview">
        ${d.thumb ? `<img src="${esc(d.thumb)}" alt="" referrerpolicy="no-referrer">` : `<span class="save-thumb ph">${ICONS.bookmark}</span>`}
        <div><b>${esc(d.title || "Saved from " + platformName(d.platform))}</b><small>${esc(platformName(d.platform))}${d.author ? " · " + esc(d.author) : ""}</small></div>
      </div>
      <h2 id="sheet-title">Where should this go?</h2>
      <div class="chips" role="group" aria-label="Category">
        ${list.map((c) => `<button class="chip" aria-pressed="${c === pick}" data-action="draft-cat" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
      </div>
      <form class="new-cat" data-submit="new-cat" novalidate>
        <input class="input" id="new-cat" data-keep maxlength="30" placeholder="New category" autocomplete="off" enterkeyhint="done" aria-label="New category">
        <button class="btn btn-outline" type="submit">Add</button>
      </form>
      ${d.note ? `<p class="hint">From your search: “${esc(d.note)}”</p>` : ""}
      <div class="sheet-actions">
        <button class="btn btn-quiet" data-action="draft-cancel">Cancel</button>
        <button class="btn btn-primary" data-action="draft-save" ${pick && !S.busy ? "" : "disabled"}>${pick ? "Save to " + esc(pick) : "Pick a category"}</button>
      </div>
      ${liveVisit ? `<p class="hint">Your timer is still running. You'll go back to ${esc(platformName(liveVisit.platform))} after saving.</p>` : ""}
    </section>`;
}

function saveCard(r) {
  const editing = S.editSave === r.id;
  const { list } = categories();
  const isLink = APP || r.platform === "link" || !PLATFORMS[r.platform];
  const open = isLink
    ? `<button class="cover" data-action="save-open" data-id="${r.id}">`
    : `<a class="cover" data-action="save-open" data-id="${r.id}" href="${esc(r.url)}" target="_blank" rel="noopener">`;
  const letter = esc((r.category || "?").trim().charAt(0).toUpperCase());
  return `<li class="save-card ${editing ? "editing" : ""}">
    ${open}
      ${r.thumb ? `<img src="${esc(r.thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="cover-ph" aria-hidden="true">${letter}</span>`}
      <span class="cover-pf"><i class="pf-dot" style="background:${PLATFORMS[r.platform]?.color || "var(--brand)"}"></i>${esc(platformName(r.platform))}</span>
    ${isLink ? "</button>" : "</a>"}
    <div class="save-meta">
      <b>${esc(r.title || "Saved from " + platformName(r.platform))}</b>
      <small>${r.author ? esc(r.author) + ", " : ""}${relTime(r.created_at)}</small>
      <button class="save-edit" data-action="save-edit" data-id="${r.id}" aria-expanded="${editing}" aria-label="Move or delete">${editing ? "Done" : "•••"}</button>
    </div>
    ${editing ? `<div class="save-tools">
      <div class="chips" role="group" aria-label="Move to">${list.map((c) => `<button class="chip" aria-pressed="${c === r.category}" data-action="save-move" data-id="${r.id}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <button class="btn btn-danger" data-action="save-delete" data-id="${r.id}">Delete</button>
    </div>` : ""}
  </li>`;
}

function viewSaved() {
  const { list, count } = categories();
  const used = list.filter((c) => count.has(c));
  const cat = S.cat && count.has(S.cat) ? S.cat : null;
  const rows = cat ? S.saves.filter((r) => r.category === cat) : S.saves;
  const how = APP
    ? "In TikTok, tap <b>Share</b> on a video, then choose <b>Save to OwnIt</b>. Pick a category and it lands here."
    : "In TikTok, tap <b>Share</b>, then <b>Copy link</b>. Paste it below and pick a category.";
  const paste = `<form class="paste" data-submit="paste-link" novalidate>
      <input class="input" id="paste-link" data-keep inputmode="url" autocomplete="off" placeholder="Paste a video link" aria-label="Paste a video link">
      <button class="btn btn-primary" type="submit">Save</button>
    </form>`;
  if (!S.saves.length) {
    return `
      <header class="page-head"><h1 class="page-title">Saved</h1></header>
      <section class="empty-page">
        ${ART.saved()}
        <h2>Keep the good ones, on purpose</h2>
        <p>${how}</p>
        ${paste}
      </section>`;
  }
  return `
    <header class="page-head saved-head"><h1 class="page-title">Saved</h1><span class="count">${S.saves.length}</span></header>
    ${used.length ? `<div class="chips cat-row" role="group" aria-label="Categories">
      <button class="chip" aria-pressed="${!cat}" data-action="cat" data-cat="">All <i>${S.saves.length}</i></button>
      ${used.map((c) => `<button class="chip" aria-pressed="${c === cat}" data-action="cat" data-cat="${esc(c)}">${esc(c)} <i>${count.get(c)}</i></button>`).join("")}
    </div>` : ""}
    ${cat || used.length < 2
      ? `<ul class="save-grid">${rows.map(saveCard).join("")}</ul>`
      : used.map((c) => `<section class="shelf">
          <button class="shelf-head" data-action="cat" data-cat="${esc(c)}"><h2>${esc(c)}</h2><span>${count.get(c)}</span>${ICONS.chev}</button>
          <ul class="shelf-row">${S.saves.filter((r) => r.category === c).map(saveCard).join("")}</ul>
        </section>`).join("")}
    ${paste}`;
}

// ---------------------------------------------------------------------------
// Android app: find the link style that opens search results directly
// ---------------------------------------------------------------------------
const LINK_STYLES = {
  tiktok: [
    ["web", "Style 1", "https://www.tiktok.com/search?q={q}"],
    ["app-result", "Style 2", "{scheme}://search/result?keyword={q}"],
    ["app-search", "Style 3", "{scheme}://search?keyword={q}"],
    ["web-video", "Style 4", "https://www.tiktok.com/search/video?q={q}"],
    ["discover", "Style 5", "https://www.tiktok.com/discover/{dash}"],
    ["tag", "Style 6 (hashtag page)", "https://www.tiktok.com/tag/{tag}"],
  ],
};
function fillLink(tpl, q) {
  const words = q.trim().toLowerCase().split(/\s+/);
  return tpl.replace("{q}", encodeURIComponent(q.trim())).replace("{dash}", encodeURIComponent(words.join("-"))).replace("{tag}", encodeURIComponent(words.join("")));
}
/** The link OwnIt uses for a search: the style this phone was tested with, or the standard web link. */
function searchLink(platform, q) {
  const styles = LINK_STYLES[platform];
  const chosen = styles && store.get("ownit.link." + platform, null);
  const tpl = chosen && styles.find((x) => x[0] === chosen)?.[2];
  return tpl ? fillLink(tpl, q) : PLATFORMS[platform].search(q);
}
/** Opens the app on a visit. Newer app versions take the exact link; older ones build it themselves. */
function appStartVisit(platform, kind, q, minutes, url) {
  if (APP?.startVisitUrl && url) return APP.startVisitUrl(platform, kind, q, minutes, url);
  appCall("startVisit", platform, kind, q, minutes);
  return "ok";
}
function viewLinkTest() {
  const chosen = store.get("ownit.link.tiktok", null);
  const t = S.linkTest;
  return `
    <div class="fade-in"><button class="back-link" data-action="lt-close">${ICONS.back} Settings</button><h1 class="page-title">Search link test</h1></div>
    <section class="card">
      <p class="muted">TikTok doesn't always open the search you asked for. Try each style below: OwnIt opens TikTok for one minute. Come back and say if you saw results for your search straight away.</p>
      ${APP?.startVisitUrl ? "" : '<p class="field-error">Update the OwnIt app first (Home → Download), then come back to this test.</p>'}
      <label class="field"><span>Search to test with</span><input class="input" id="lt-q" data-keep value="${esc(t.q)}" maxlength="60" autocomplete="off"></label>
    </section>
    <ul class="lt-list">
      ${LINK_STYLES.tiktok.map(([id, name]) => `<li class="card lt-item ${chosen === id ? "on" : ""}">
        <div class="card-head"><h3>${esc(name)}</h3>${chosen === id ? `<span class="lt-badge">${ICONS.check} In use</span>` : t.result[id] === "no" ? '<span class="muted">Didn\'t work</span>' : t.result[id] === "none" ? '<span class="muted">Not supported</span>' : ""}</div>
        ${t.asked === id ? `
          <p><b>Did TikTok show results for “${esc(t.q)}” right away?</b></p>
          <div class="lt-answer"><button class="btn btn-primary" data-action="lt-yes" data-id="${id}">Yes, use this</button><button class="btn btn-outline" data-action="lt-no" data-id="${id}">No</button></div>`
          : `<button class="btn btn-outline btn-block" data-action="lt-try" data-id="${id}">Try it</button>`}
      </li>`).join("")}
    </ul>
    ${chosen ? `<button class="btn btn-quiet" data-action="lt-reset">Go back to the standard link</button>` : ""}`;
}

// ---------------------------------------------------------------------------
// Settings: every setting has a short note and a "How?" guide
// ---------------------------------------------------------------------------
/** One setting: title, what it does, the control, and a guide that opens when you tap "How?". */
function setting(id, title, what, control, how) {
  const open = !!S.help[id];
  return `<div class="set">
    <div class="set-head"><div><h3>${title}</h3><p>${what}</p></div>${how ? `<button class="how-btn" data-action="help" data-id="${id}" aria-expanded="${open}">${open ? "Close" : "How?"}</button>` : ""}</div>
    ${open ? `<ol class="how">${how.map((h) => `<li>${h}</li>`).join("")}</ol>` : ""}
    ${control}
  </div>`;
}
function choice(action, options, current, attr = "id") {
  return `<div class="seg wrap" role="group">${options.map(([id, label]) => `<button type="button" class="seg-btn" aria-pressed="${String(id) === String(current)}" data-action="${action}" data-${attr}="${id}">${label}</button>`).join("")}</div>`;
}
function permRow(ok, label, action) {
  return `<li class="${ok ? "ok" : "off"}"><span class="perm-dot">${ok ? ICONS.check : "!"}</span><span>${label}</span>${ok ? "<small>On</small>" : `<button class="btn btn-primary" data-action="${action}">Turn on</button>`}</li>`;
}
function viewSettings() {
  const L = look();
  const goal = S.profile?.daily_goal_minutes || 45;
  const st = APP ? appStatus() : {};
  const guarded = guardedApps();
  const colours = `<div class="swatches" role="group" aria-label="Colour">${Object.entries(COLOURS).map(([id, c]) => `<button class="swatch" aria-pressed="${id === (COLOURS[L.colour] ? L.colour : "navy")}" data-action="look-colour" data-id="${id}"><i style="background:${c.dot}"><u style="background:${c.dot2}"></u></i>${c.name}</button>`).join("")}</div>`;
  const fonts = `<div class="font-grid" role="group" aria-label="Font">${Object.entries(FONTS).map(([id, f]) => `<button class="font-opt" aria-pressed="${id === L.font}" data-action="look-font" data-id="${id}"><b style='font-family:${f.display}'>${f.name}</b><small style='font-family:${f.body}'>${f.note}</small></button>`).join("")}</div>`;

  const lookSection = `
    <section class="set-group"><h2>Look</h2>
      ${setting("theme", "Light or dark", "Pick one, or follow your phone.", choice("look-theme", [["dark", "Dark"], ["light", "Light"], ["system", "Same as phone"]], L.theme),
        ["<b>Dark</b> is how OwnIt is designed to look.", "<b>Light</b> is easier to read in bright sunlight.", "<b>Same as phone</b> switches by itself when your phone goes dark at night.", "This only changes OwnIt on this phone or computer."])}
      ${setting("colour", "Colour", "The main colour of buttons and highlights.", colours,
        ["Tap a colour. OwnIt changes straight away.", "Don't like it? Tap another. <b>Navy</b> is OwnIt's own colour."])}
      ${setting("font", "Font", "The style of the letters.", fonts,
        ["Tap a font to try it. Each box is written in its own font.", "<b>OwnIt</b> is the original. <b>Clean</b> is the plainest to read."])}
      ${setting("size", "Text size", "Make everything bigger or smaller.", choice("look-size", Object.entries(SIZES).map(([id, [name]]) => [id, name]), L.size),
        ["Tap a size. The pages grow or shrink straight away.", "If words get cut off, go one size down."])}
      ${setting("contrast", "Stronger contrast", "Darker text and clearer lines.", choice("look-contrast", [["off", "Off"], ["on", "On"]], L.contrast ? "on" : "off"),
        ["Turn this <b>On</b> if grey text is hard to read, or if you use your phone in bright sunlight."])}
      ${setting("motion", "Animations", "Small movements when pages open.", choice("look-motion", [["on", "On"], ["off", "Off"]], L.motion ? "on" : "off"),
        ["Turn this <b>Off</b> if movement on screen bothers you or your phone feels slow."])}
    </section>`;

  const visitSection = `
    <section class="set-group"><h2>Your time</h2>
      ${setting("budget", "Daily budget", `You have ${goal} minutes a day.`, `<div class="chips">${GOAL_OPTIONS.map((m) => `<button class="chip" aria-pressed="${m === goal}" data-action="set-goal" data-min="${m}">${m} min</button>`).join("")}</div>`,
        ["This is the total time you want to spend on social apps each day.", "Every visit you start in OwnIt counts toward it.", "The bar on Home shows how much is left. Insights turns red on days you went over."])}
      ${setting("minutes", "Usual search time", "The time already selected when you open Home.", choice("default-minutes", SEARCH_MINUTES.map((m) => [m, m + " min"]), store.get("ownit.minutes", 5), "min"),
        ["Pick the time most of your searches need.", "You can still change it for a single visit on Home."])}
    </section>`;

  const guardSection = APP ? `
    <section class="set-group"><h2>OwnIt Guard</h2>
      ${setting("perms", "Permissions", "All of these must be on, or apps can be opened directly.", `<ul class="perms">
          ${permRow(st.notifyOn !== false, "Notifications", "setup-notify")}
          ${permRow(!!st.overlayOn, "Show on top of other apps", "overlay-settings")}
          ${permRow(!!st.usageOn, "See which app is open", "usage-settings")}
          ${st.batteryOn !== undefined ? permRow(!!st.batteryOn, "Keep running in the background", "battery-settings") : ""}
        </ul>`,
        ["Tap <b>Turn on</b> next to anything that is off. OwnIt opens the right page in your phone's settings.", "Find <b>OwnIt</b> in the list if you see one, and switch it on.", "OwnIt brings you back here by itself. The row turns green.", "OwnIt only sees the name of the app that is open. It never sees what is on your screen."])}
      ${setting("guarded", "Apps to guard", "These can only be opened through OwnIt.", `<div class="seg wrap" role="group">${Object.entries(PLATFORMS).map(([id, pf]) => `<button type="button" class="seg-btn" aria-pressed="${guarded.includes(id)}" data-action="toggle-guarded" data-id="${id}"><span class="pf-dot" style="background:${pf.color}"></span>${pf.name}</button>`).join("")}</div>`,
        ["Tap an app to guard it or to stop guarding it. Guarded apps are filled in.", "A guarded app shows “Not so fast” if someone opens it directly, then returns to OwnIt.", "At least one app always stays guarded."])}
      ${setting("link", "Search link", store.get("ownit.link.tiktok", null) ? "Using the link style you tested on this phone." : "If TikTok opens without your search, test which link works.", `<button class="btn btn-outline" data-action="lt-open">Test search links</button>`,
        ["Tap <b>Test search links</b>.", "Tap <b>Try it</b> on a style. TikTok opens for one minute.", "Come back to OwnIt and answer: did TikTok show results for your search?", "Tap <b>Yes, use this</b> on the first style that works. OwnIt remembers it."])}
    </section>` : `
    <section class="set-group"><h2>Time's-up alerts</h2>
      ${setting("webnotify", "Notifications", Notify.state() === "on" ? "On. OwnIt calls you back when time is up." : "Get a notification when your time is up.", notifyCard(false) || '<p class="set-ok">' + ICONS.check + " Notifications are on</p>",
        Notify.isIOS
          ? ["Open OwnIt in <b>Safari</b>.", "Tap the <b>Share</b> button, then <b>Add to Home Screen</b>.", "Open OwnIt from the new icon on your Home Screen.", "Come back to this page and tap <b>Turn on</b>, then <b>Allow</b>."]
          : ["Tap <b>Turn on</b>.", "Your browser asks for permission. Tap <b>Allow</b>.", "If nothing happens, notifications are blocked: open your browser's site settings for OwnIt and allow them."])}
    </section>`;

  return `
    ${pageHead("Settings", "Tap “How?” next to any setting for step-by-step help.")}
    ${lookSection}${visitSection}${guardSection}`;
}

// ---------------------------------------------------------------------------
// Guide: how to do everything, one topic at a time
// ---------------------------------------------------------------------------
function guideTopics() {
  const pf = PLATFORMS[userApps()[0]]?.name || "TikTok";
  return [
    ["start", "How OwnIt works", null, [
      `Open OwnIt, not ${pf}. Type what you're looking for.`,
      `Pick how many minutes you need and tap <b>Go to ${pf}</b>.`,
      "When your time is up, OwnIt calls you back and asks if you found it.",
      "That's the whole idea: you decide why you're going in, and when you come out."]],
    ["search", "Search for something", "home", [
      "Go to <b>Home</b>.", "Type what you want, for example “easy injera recipe”.",
      "Choose the app after <b>On</b> and the time after <b>For</b>.",
      `Tap <b>Go to ${pf}</b>. Found it early? Come back and tap <b>I'm done</b>.`]],
    ["timeup", "When your time is up", null, [
      "On Android, a full screen says <b>Time's up</b> and your phone buzzes.",
      "After 8 seconds it takes you back to OwnIt. You can ask for 2 more minutes, once.",
      "OwnIt asks: did you find it? Tap the honest answer. It feeds your Insights.",
      "On iPhone and computers you get a notification instead. Tap it to come back."]],
    ["save", "Save a video into a category", "saved", [
      `In ${pf}, tap <b>Share</b> on the video.`,
      "On Android choose <b>Save to OwnIt</b>. On iPhone choose <b>Copy link</b>, then paste it on the Saved page.",
      "Pick a category, or type a new one and tap <b>Add</b>.",
      "Tap <b>Save</b>. On Android, OwnIt takes you back to the video and your timer keeps running.",
      "Find it later on <b>Saved</b>. Tap <b>•••</b> on a video to move or delete it."]],
    ["scroll", "Scroll without a search", "scroll", [
      "Open <b>Menu</b>, then <b>Scroll on purpose</b>.", "Pick the app and how long.",
      "Tap the button. OwnIt pulls you out when the time is over."]],
    ["install", "Install the Android app", null, [
      "On the Android phone, open <b>carmelatesfaye85-sketch.github.io</b> in Chrome.",
      "Scroll to the bottom of the first page and tap <b>Download the Android app</b>.",
      "Open the downloaded file <b>OwnIt.apk</b>.",
      "If the phone says it can't install unknown apps: tap <b>Settings</b>, switch on <b>Allow from this source</b>, and go back.",
      "If Play Protect shows a warning: tap <b>More details</b>, then <b>Install anyway</b>.",
      "Tap <b>Install</b>, open OwnIt and sign in. The setup screen starts by itself."]],
    ["guard", "Turn on OwnIt Guard (Android)", "settings", [
      "OwnIt shows the setup steps the first time you sign in. Each step has one button.",
      "<b>Notifications:</b> tap <b>Allow</b> when the phone asks.",
      "<b>Show on top:</b> switch on <b>Allow display over other apps</b> for OwnIt.",
      "<b>Usage access:</b> tap OwnIt in the list and switch on <b>Permit usage access</b>.",
      "<b>Stay awake:</b> tap <b>Allow</b> so the phone doesn't put the Guard to sleep.",
      "After each one OwnIt comes back by itself. You can check them any time in <b>Settings</b>."]],
    ["broken", "If the Guard stops working", "settings", [
      "Open OwnIt. If a permission was turned off, the setup screen appears. Follow it.",
      "Open <b>Settings</b> and look at <b>Permissions</b>. Tap <b>Turn on</b> next to anything that is off.",
      "Check that the app is in <b>Apps to guard</b>.",
      "Still not working? Restart the phone and open OwnIt once."]],
    ["link", `If ${pf} opens without your search`, "settings", [
      "Open <b>Settings</b> and tap <b>Test search links</b>.",
      `Tap <b>Try it</b> on each style. ${pf} opens for one minute each time.`,
      "Tap <b>Yes, use this</b> on the first one that shows your results straight away.",
      "If none work, your search is still copied: paste it into the search bar."]],
    ["look", "Change colours, font and text size", "settings", [
      "Open <b>Settings</b>. The first group is <b>Look</b>.",
      "Tap a colour, a font or a text size. OwnIt changes straight away.",
      "These choices stay on this phone only."]],
    ["budget", "Daily budget and Insights", "insights", [
      "Your daily budget is the total time you want on social apps. Change it in <b>Settings</b>.",
      "The bar on <b>Home</b> shows how much is left today.",
      "<b>Insights</b> shows your week: how many visits were on purpose, and which days went over."]],
    ["iphone", "Notifications on iPhone", null, [
      "Open OwnIt in <b>Safari</b>.", "Tap <b>Share</b>, then <b>Add to Home Screen</b>.",
      "Open OwnIt from the Home Screen icon.", "Go to <b>Settings</b> and tap <b>Turn on</b> under Notifications, then <b>Allow</b>."]],
  ];
}
function viewGuide() {
  return `
    ${pageHead("Guide", "Tap a question to see the steps.")}
    <ul class="guide">${guideTopics().map(([id, title, page, steps]) => {
      const open = S.guide === id;
      return `<li class="${open ? "open" : ""}">
        <button class="guide-q" data-action="guide" data-id="${id}" aria-expanded="${open}"><span>${title}</span>${ICONS.chev}</button>
        ${open ? `<div class="guide-a"><ol class="how">${steps.map((x) => `<li>${x}</li>`).join("")}</ol>${page ? `<button class="btn btn-outline" data-action="tab" data-tab="${page}">Open ${PAGES[page][0]}</button>` : ""}</div>` : ""}
      </li>`;
    }).join("")}</ul>`;
}

// ----- Reality check: your answers -----
function viewAnswers() {
  const p = S.profile || {};
  return `
    ${pageHead("Reality check", "What you told OwnIt when you started.")}
    <dl class="kv plain">
      <div><dt>Apps</dt><dd>${esc(labelFor("apps", p.apps || []))}</dd></div>
      <div><dt>Time a day</dt><dd>${esc(labelFor("daily_hours", p.daily_hours))}</dd></div>
      <div><dt>Opens without a reason</dt><dd>${esc(labelFor("autopilot", p.autopilot))}</dd></div>
      <div><dt>After a long scroll</dt><dd>${esc(labelFor("feeling", p.feeling))}</dd></div>
      <div><dt>Goes there for</dt><dd>${esc(labelFor("uses", p.uses || []))}</dd></div>
      <div><dt>With an extra hour</dt><dd>${esc(p.extra_hour || "Not set")}</dd></div>
    </dl>
    <div class="btn-row"><button class="btn btn-primary" data-action="show-reality">See my numbers</button><button class="btn btn-outline" data-action="retake">Answer again</button></div>`;
}

// ----- Account -----
function viewAccount() {
  const provider = S.user?.provider === "google" ? "Google" : "Email and password";
  return `
    ${pageHead("Account", "")}
    <div class="profile-head">
      <span class="avatar">${esc(initials(displayName(), S.user?.email))}</span>
      <div style="min-width:0"><b>${esc(displayName())}</b><span class="muted" style="overflow-wrap:anywhere">${esc(S.user?.email || "")}</span></div>
    </div>
    <dl class="kv plain">
      <div><dt>Signed in with</dt><dd>${provider}</dd></div>
      ${APP ? `<div><dt>App version</dt><dd>${esc(appStatus().version || "")}</dd></div>` : ""}
    </dl>
    <button class="btn btn-danger" data-action="signout">Sign out</button>`;
}


// ---------------------------------------------------------------------------
// Landing story (shown to signed-out visitors before sign-in)
// ---------------------------------------------------------------------------
function loopSvg(kind) {
  const left = "M24 24c-4-5-7-8.5-11.5-8.5a8.5 8.5 0 0 0 0 17c4.5 0 7.5-3.5 11.5-8.5";
  const right = "M24 24c4-5 7-8.5 11.5-8.5a8.5 8.5 0 0 1 0 17c-4.5 0-7.5-3.5-11.5-8.5";
  if (kind === "hero") {
    return `<svg viewBox="0 0 48 48" fill="none"><path class="loop-draw" pathLength="100" d="${left.replace("M24 24", "M24 24")} ${right.replace("M24 24", "")}" stroke="#3FC2B2" stroke-width="1.1" stroke-linecap="round"/></svg>`;
  }
  return `<svg viewBox="0 0 48 48" fill="none">
    <path d="${left}" stroke="#E8F3F0" stroke-width="2.4" stroke-linecap="round"/>
    <path class="right" d="${right}" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="0" stroke="#E8F3F0" stroke-width="2.4" stroke-linecap="round"/>
    <circle class="dot" cx="43.8" cy="24.5" r="2.6" fill="#F0B155"/>
  </svg>`;
}

function feedCards() {
  const colors = ["#FE2C55", "#3FC2B2", "#F0B155", "#7C6CF0", "#25F4EE", "#E1306C", "#FF8A3D"];
  let html = "";
  for (let i = 0; i < 9; i++) {
    const c = colors[i % colors.length];
    const h = [120, 170, 140, 200, 150][i % 5];
    html += `<div class="lp-post" style="--c:${c};--h:${h}px"><div class="lp-post-top"><i></i><span></span></div><div class="lp-post-img" data-likes="${(i * 7.3 + 1.2).toFixed(1)}k"></div></div>`;
  }
  return html;
}

const LP_QUESTIONS = [
  { title: "Ever open TikTok for one video and look up three hours later?", body: "You only meant to check one thing. The clock kept moving. You didn't.", art: "clock" },
  { title: "Is it getting harder to stay focused on one thing?", body: "A page of a book, a lecture, a conversation. Your hand drifts to your phone before you even notice.", art: "focus" },
  { title: "Do other people's best moments make your own life feel smaller?", body: "Everyone else seems to be traveling, winning and glowing. You're comparing your ordinary Tuesday to their highlight reel.", art: "compare" },
  { title: "You take in more information than ever. So why don't you feel any smarter?", body: "Hundreds of posts a day, and by tonight you won't remember most of them. A lot comes in. Very little stays.", art: "overload" },
  { title: "Do you pick up your phone without even knowing why?", body: "No notification. No reason. Just a habit your thumb learned on its own.", art: "unlock" },
  { title: "Is your phone taking a seat at the family table?", body: "Everyone's together, but everyone's somewhere else. The people who matter most get what's left of your attention.", art: "table" },
];

function lpArt(kind) {
  switch (kind) {
    case "clock":
      return `<div class="lp-phone small"><div class="lp-phone-screen"><span class="lp-clock" data-clock>11:02 PM</span><div class="lp-feedtrack">${feedCards()}${feedCards()}</div></div></div>`;
    case "focus":
      return `<div class="art-focus">
        <div class="art-book"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <span class="art-ping p1">New message</span><span class="art-ping p2">3 new likes</span><span class="art-ping p3">You were tagged</span>
        <div class="art-meter"><span>Focus</span><div><i></i></div></div>
      </div>`;
    case "compare":
      return `<div class="art-compare">
        <div class="art-post a"><i></i><b>♥ 12.4k</b></div>
        <div class="art-post b"><i></i><b>♥ 8.9k</b></div>
        <div class="art-post c"><i></i><b>♥ 21k</b></div>
        <div class="art-you"><span>Your Tuesday</span><b>♥ 3</b></div>
      </div>`;
    case "overload": {
      const chips = ["Breaking news", "10 life hacks", "Top 5 gadgets", "Hot take", "Must-watch", "New trend", "Everyone's talking", "You won't believe", "Quick tip", "Viral now", "Just in", "Hidden fact"];
      return `<div class="art-overload">
        <div class="art-fall">${chips.map((c, i) => `<span style="--i:${i};--x:${(i * 37) % 80 + 5}%">${c}</span>`).join("")}</div>
        <div class="art-head"><svg viewBox="0 0 120 120" fill="none"><path d="M60 14c24 0 42 17 42 40 0 13-5 22-12 29v23H52v-12H38c-6 0-10-4-10-10V74l-9-3 9-14c0-24 11-43 32-43z" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/></svg><b data-overload>0</b><small>posts seen today</small></div>
        <p class="art-note">Remembered by tonight: <b>almost none</b></p>
      </div>`;
    }
    case "unlock":
      return `<div class="art-unlock">
        <div class="art-lock"><svg viewBox="0 0 64 64" fill="none"><rect x="14" y="28" width="36" height="28" rx="7" stroke="currentColor" stroke-width="4"/><path class="shackle" d="M22 28v-8a10 10 0 0 1 20 0" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg></div>
        <div class="art-count"><b data-unlocks>0</b><span>times you picked it up today</span></div>
      </div>`;
    case "table":
      return `<div class="art-table"><svg viewBox="0 0 240 200" fill="none">
        <ellipse cx="120" cy="100" rx="92" ry="62" fill="currentColor" fill-opacity=".06" stroke="currentColor" stroke-opacity=".2" stroke-width="2"/>
        ${[[120, 50], [200, 100], [120, 150], [40, 100]].map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="15" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-opacity=".28" stroke-width="2"/><rect class="glow g${k}" x="${x + (x > 120 ? -34 : x < 120 ? 20 : 14)}" y="${y - 10}" width="13" height="22" rx="3"/>`).join("")}
        ${[[120, 16], [228, 100], [120, 184], [12, 100]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="currentColor" fill-opacity=".2"/>`).join("")}
      </svg><p class="art-note">Together at the table. Somewhere else in their heads.</p></div>`;
    default: return "";
  }
}

const splitWords = (t) => esc(t).split(" ").map((w, i) => `<span class="sw" style="--w:${i}">${w}</span>`).join(" ");
const tickerBand = (items) => {
  const row = items.map((t) => `<span>${esc(t)}</span><i>∞</i>`).join("");
  return `<div class="lp-ticker" aria-hidden="true"><div class="lp-ticker-track">${row}${row}${row}${row}</div></div>`;
};

// The six scenes of "does this sound familiar": one big word and one colour each.
const LP_SCENES = [["3 HOURS", "#F7D774"], ["FOCUS", "#A9BCF5"], ["COMPARE", "#F5A9C0"], ["NOISE", "#8ED8C0"], ["HABIT", "#C8B0F0"], ["TOGETHER", "#F5A58C"]];

/** Dot: the dot from the OwnIt logo, as a small character. He acts out every scene of the story. */
function lpRig() {
  const N = "#12224A", M = "#F2EFE6";
  const eye = (x) => `<g class="d-eye"><ellipse cx="${x}" cy="158" rx="14" ry="16" fill="#fff"/><circle class="d-pupil" cx="${x}" cy="160" r="6.5" fill="${N}"/><rect class="d-lid" x="${x - 16}" y="140" width="32" height="20" fill="${N}"/><rect class="d-blink" x="${x - 16}" y="140" width="32" height="20" fill="${N}"/></g>`;
  const pill = (x, y, w, t, dot) => `<rect x="${x}" y="${y}" width="${w}" height="28" rx="14" fill="${N}"/>${dot ? `<circle cx="${x + 15}" cy="${y + 14}" r="5" fill="${dot}"/>` : ""}<text x="${x + (dot ? 27 : 14)}" y="${y + 18.5}" fill="#fff" font-size="12" font-weight="700">${t}</text>`;
  const photo = (x, y, r, a, b, likes) => `<g transform="rotate(${r} ${x + 36} ${y + 46})"><g class="d-float"><rect x="${x}" y="${y}" width="72" height="92" rx="12" fill="#fff"/><rect x="${x + 7}" y="${y + 7}" width="58" height="58" rx="8" fill="url(#${a})"/><text x="${x + 9}" y="${y + 82}" fill="#E1306C" font-size="11" font-weight="700">♥ ${likes}</text></g></g>`;
  const mini = (x, look) => `<g class="d-float"><circle cx="${x}" cy="214" r="30" fill="${N}"/><ellipse cx="${x - 10}" cy="208" rx="7" ry="8" fill="#fff"/><ellipse cx="${x + 10}" cy="208" rx="7" ry="8" fill="#fff"/><circle cx="${x - 10 + look}" cy="212" r="3.4" fill="${N}"/><circle cx="${x + 10 + look}" cy="212" r="3.4" fill="${N}"/><rect x="${x - 9}" y="226" width="18" height="26" rx="4" fill="#fff" stroke="${N}" stroke-width="3"/></g>`;
  const chips = ["Breaking", "Top 10", "Hot take", "Viral", "Just in", "Must-watch"];
  return `
  <svg class="rig" viewBox="0 0 320 300" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="rg-a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#FFD36E"/><stop offset="1" stop-color="#FF7A59"/></linearGradient>
      <linearGradient id="rg-b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7EE8FA"/><stop offset="1" stop-color="#3F7BD9"/></linearGradient>
      <linearGradient id="rg-c" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F9A8D4"/><stop offset="1" stop-color="#A855F7"/></linearGradient>
    </defs>
    <g class="rig-ring"><g><path d="M160 54A116 116 0 1 0 276 165" stroke="#fff" stroke-opacity=".6" stroke-width="15" stroke-linecap="round"/></g></g>

    <g class="pr s0"><circle cx="258" cy="70" r="30" fill="#fff"/><path class="d-hand-h" d="M258 70v-13" stroke="${N}" stroke-width="5" stroke-linecap="round"/><path class="d-hand-m" d="M258 70v-21" stroke="${N}" stroke-width="3.5" stroke-linecap="round"/><circle cx="258" cy="70" r="3.5" fill="${N}"/></g>
    <g class="pr s0 d2"><text class="d-zz" x="44" y="92" fill="${N}" font-size="22" font-weight="800">z</text><text class="d-zz z2" x="62" y="66" fill="${N}" font-size="30" font-weight="800">z</text></g>
    <g class="pr s2">${photo(26, 22, -12, "rg-a", "rg-b", "12.4k")}${photo(124, 2, 0, "rg-b", "rg-a", "21k")}${photo(222, 24, 11, "rg-c", "rg-a", "8.9k")}</g>
    <g class="pr s3 d-rain">${chips.map((c, i) => `<g class="d-chip" style="--i:${i}"><rect x="${[18, 196, 96, 232, 40, 150][i]}" y="-6" width="${c.length * 7 + 20}" height="24" rx="12" fill="#fff"/><text x="${[18, 196, 96, 232, 40, 150][i] + 10}" y="10" fill="${N}" font-size="11" font-weight="700">${c}</text></g>`).join("")}</g>
    <g class="pr s5">${mini(52, 2)}${mini(268, -2)}</g>

    <g class="rig-char">
      <ellipse class="d-shadow" cx="160" cy="270" rx="58" ry="8" fill="${N}" fill-opacity=".16"/>
      <path class="d-leg" d="M142 224v36h-10M178 224v36h10" stroke="${N}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <g class="d-body">
        <circle cx="160" cy="170" r="62" fill="${N}"/>
        ${eye(140)}${eye(180)}
        <path class="d-mouth m-flat" d="M149 198h22" stroke="${M}" stroke-width="4" stroke-linecap="round"/>
        <circle class="d-mouth m-o" cx="160" cy="199" r="5" stroke="${M}" stroke-width="4"/>
        <path class="d-mouth m-sad" d="M148 203q12-11 24 0" stroke="${M}" stroke-width="4" stroke-linecap="round"/>
        <path class="d-mouth m-wavy" d="M146 199q5-6 9 0t9 0 9 0" stroke="${M}" stroke-width="4" stroke-linecap="round"/>
      </g>
      <g class="d-arm l"><path d="M104 190L84 236" stroke="${N}" stroke-width="7" stroke-linecap="round"/><circle cx="84" cy="236" r="7" fill="${N}"/></g>
      <g class="d-arm r"><path d="M216 190L236 236" stroke="${N}" stroke-width="7" stroke-linecap="round"/><circle cx="236" cy="236" r="7" fill="${N}"/></g>
      <g class="pr s0 s5 d-held"><rect x="138" y="204" width="44" height="64" rx="9" fill="#fff" stroke="${N}" stroke-width="5"/><path d="M155 228l13 8-13 8z" fill="${N}"/></g>
      <g class="pr s1 d-held"><path d="M112 216l48 10 48-10v38l-48 10-48-10z" fill="#fff" stroke="${N}" stroke-width="5" stroke-linejoin="round"/><path d="M160 226v38M124 228l24 5M124 238l24 5M172 233l24-5M172 243l24-5" stroke="${N}" stroke-width="3" stroke-linecap="round"/></g>
    </g>

    <g class="pr s1 d-ping" style="--i:0">${pill(8, 96, 112, "New message", "#F28D7C")}</g>
    <g class="pr s1 d-ping" style="--i:1">${pill(206, 44, 104, "3 new likes", "#F7D774")}</g>
    <g class="pr s1 d-ping" style="--i:2">${pill(214, 118, 100, "Tagged you", "#8ED8C0")}</g>
    <g class="pr s2 d1">${pill(196, 236, 58, "♥ 3", "")}</g>
    <g class="pr s3 d1">${pill(184, 250, 128, "800+ posts today", "")}</g>
    <g class="pr s4"><g transform="rotate(14 276 244)"><rect x="258" y="216" width="36" height="56" rx="8" fill="#fff" stroke="${N}" stroke-width="5"/><circle class="d-buzz" cx="276" cy="232" r="5" fill="#F28D7C"/></g></g>
    <g class="pr s4 d1">${pill(14, 64, 98, "205× today", "")}</g>
    <g class="pr s5 d1"><ellipse cx="160" cy="284" rx="156" ry="13" fill="#fff" fill-opacity=".75"/></g>
  </svg>`;
}

/** Dot, small: peeks over the demo phone and sits on the last button. */
const dotMini = (cls = "") => `<svg class="dot-mini ${cls}" viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle class="dm-body" cx="60" cy="62" r="46"/><ellipse cx="45" cy="52" rx="11" ry="13" fill="#fff"/><ellipse cx="75" cy="52" rx="11" ry="13" fill="#fff"/><circle class="dm-p" cx="45" cy="54" r="5.5"/><circle class="dm-p" cx="75" cy="54" r="5.5"/><path class="dm-smile" d="M48 80q12 10 24 0" stroke-width="4" stroke-linecap="round"/></svg>`;

const LP_HOW = [
  ["Say what you want", "Type what you're looking for before you go in."],
  ["Go straight to it", "OwnIt opens the search results, not the feed, with a timer you choose."],
  ["Come back out", "When time's up, OwnIt calls you back and asks: did you find it?"],
];

/** A small phone that acts out one visit: type, go, time's up, back out. */
function lpHow() {
  const thumbs = ["#F28D7C", "#B9C7F5", "#F0C987", "#8FD3C1", "#C9A7F0", "#E7A6B8"];
  return `
  <div class="lp-how" id="lp-how" data-phase="0" data-step="0">
    <p class="lp-kicker lp-how-kicker reveal">How it works</p>
    <div class="lp-how-copy">
      <ol class="lp-how-steps">
        ${LP_HOW.map(([h], i) => `<li data-how="${i}" class="${i ? "" : "on"}" style="--dur:${[2.9, 3.5, 6.2][i]}s"><button type="button" class="lp-how-tab"><span class="lp-step-n">0${i + 1}</span><h3>${h}</h3></button><i class="lp-how-bar"></i></li>`).join("")}
      </ol>
    </div>
    <div class="lp-how-phone reveal zoom" aria-hidden="true"><div class="hp-peek">${dotMini()}</div><div class="hp-body"><div class="hp-tilt">
      <div class="hp-screen">
        <div class="hp-view hp-home">
          <span class="hp-mark">${ICONS.logo}</span>
          <b class="hp-q"><span>What are you</span> looking for?</b>
          <div class="hp-input"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg><span class="hp-typed" data-typed></span></div>
          <div class="hp-chips"><i class="on">TikTok</i><i>YouTube</i><i>Instagram</i></div>
          <div class="hp-go">Go to TikTok</div>
        </div>
        <div class="hp-view hp-app">
          <div class="hp-app-top"><span class="hp-pill">easy injera recipe</span><span class="hp-timer"><svg viewBox="0 0 36 36"><circle class="t" cx="18" cy="18" r="14"/><circle class="b" cx="18" cy="18" r="14"/></svg><b data-how-time>5:00</b></span></div>
          <div class="hp-grid">${thumbs.map((c, i) => `<i style="--c:${c};--i:${i}"></i>`).join("")}</div>
        </div>
        <div class="hp-view hp-check">
          <b class="hp-q"><span>Did you</span> find it?</b>
          <div class="hp-ans yes"><i>✓</i>Yes, I found it</div>
          <div class="hp-ans">Sort of</div>
          <div class="hp-ans">No, I got distracted</div>
        </div>
        <div class="hp-view hp-win"><span class="hp-mark big">${ICONS.logo}</span><b>Loop broken.</b></div>
        <div class="hp-view hp-up"><span class="hp-mark big">${ICONS.logo}</span><b>Time's up</b><small>Did you find “easy injera recipe”?</small></div>
      </div>
    </div></div></div>
  </div>`;
}

function viewLanding() {
  const words = (t) => t.split(" ").map((w, i) => `<span class="lp-w" style="--i:${i}">${esc(w)}</span>`).join(" ");
  const col = (k) => `<div class="lp-col" style="--s:${[38, 30, 44, 34, 40][k]}s;--o:${k * -7}s"><div class="lp-feedtrack">${feedCards()}${feedCards()}</div></div>`;
  const ring = `<svg viewBox="208 290 444 444" fill="none" aria-hidden="true"><path d="${RING.arc}" stroke="currentColor" stroke-width="83" stroke-linecap="round"/><circle cx="${RING.dot[0]}" cy="${RING.dot[1]}" r="46" fill="currentColor"/></svg>`;
  const band = (cls, items) => { const row = items.map((t) => `<span>${esc(t)}</span>${ring}`).join(""); return `<div class="lp-band ${cls}"><div class="lp-band-track">${row.repeat(6)}</div></div>`; };
  const scrub = (t, cls = "") => t.split(" ").map((w) => `<span class="sc ${cls}">${esc(w)}</span>`).join(" ");
  const n = LP_QUESTIONS.length;
  return `
  <div class="lp ${isDark() ? "" : "day"}" id="lp">
    <div class="lp-progress" aria-hidden="true"><i></i></div>
    <div class="lp-spot" aria-hidden="true"></div>
    <header class="lp-nav">
      <span class="logo lp-logo">${WORDMARK}</span>
      <button class="lp-signin" data-action="open-auth" data-mode="signin">Sign in</button>
    </header>

    <div class="lp-hero-wrap" id="lp-hero-wrap">
      <section class="lp-hero">
        <div class="lp-wall-wrap" aria-hidden="true"><div class="lp-wall">${[0, 1, 2, 3, 4].map(col).join("")}</div></div>
        <div class="lp-hero-text">
          <p class="lp-kicker">The average person will give</p>
          <h1 class="lp-hero-num"><b data-hero-count>0</b> <span>years</span></h1>
          <p class="lp-h-line">${words("of their life to scrolling.")}</p>
          <small class="lp-hero-src">About 141 minutes a day over 50 years (Statista, 2025)</small>
        </div>
        <div class="lp-scroll-cue" aria-hidden="true"><span></span>Scroll</div>
      </section>
    </div>

    <section class="lp-qs tap" id="lp-qs" style="--n:${n}">
      <div class="lp-qs-head reveal">
        <p class="lp-kicker">Be honest with yourself</p>
        <h2 class="lp-h2 split">${splitWords("Does any of this sound familiar?")}</h2>
      </div>
      <div class="lp-qs-scroll">
        <div class="lp-qs-pin" data-scene="0" style="--c0:${LP_SCENES[0][1]}">
          <div class="sc-bg" aria-hidden="true"><i></i><i></i></div>
          <div class="sc-words" aria-hidden="true"><div>${LP_SCENES.map(([w]) => `<span style="--k:${w.length}">${w}</span>`).join("")}</div></div>
          <div class="sc-stage">${lpRig()}</div>
          <div class="sc-copy">
            ${LP_QUESTIONS.map((q, i) => `
            <article class="sc-text ${i ? "" : "on"}">
              <span class="lp-q-n">0${i + 1} <i>/ 0${n}</i></span>
              <h3 class="lp-q-text">${esc(q.title)}</h3>
            </article>`).join("")}
          </div>
          <div class="sc-foot">
            <div class="lp-qs-nav" aria-hidden="true"><b data-qs-n>01</b><div class="lp-qs-bar"><i></i></div><span>0${n}</span></div>
            <button type="button" class="sc-next"><span class="nx-a">Next</span><span class="nx-b">Continue</span>${ICONS.arrow}</button>
          </div>
        </div>
      </div>
    </section>

    <section class="lp-solution">
      <h2 class="lp-sol-h lp-turn-h reveal">The solution is not to <span class="lp-strike">delete</span> your social media.</h2>
    </section>

    <section class="lp-meet" id="lp-meet">
      <div class="lp-meet-stage">
        <h2 class="lp-own lp-turn-h reveal">You just have to <span class="lp-under">own it<svg viewBox="0 0 200 20" preserveAspectRatio="none" aria-hidden="true"><path d="M4 13c38-9 82-11 120-6 26 3 48 5 72 0" pathLength="100"/></svg></span>.</h2>
        <div class="lp-meet-visual">
          <div class="lp-lottie" id="lp-lottie" aria-hidden="true">${ART.loop(false)}</div>
        </div>
        <div class="lp-meet-copy">
          <div class="lp-stage-b">
            <p class="lp-p">The app that adds ownership, intention and purpose to your social media use.</p>
          </div>
        </div>
      </div>
      <div class="lp-sec lp-steps-wrap">${lpHow()}</div>
    </section>

    <section class="lp-sec lp-cta">
      <canvas id="lp-sparks" aria-hidden="true"></canvas>
      <h2 class="lp-h1 lp-cta-h"><span class="lp-cta-lead reveal zoom">End the infinite scroll.</span><span class="reveal from-l">Own your social media.</span><span class="reveal from-r" style="--d:1">Own your life.</span></h2>
      <p class="lp-p reveal" style="--d:2">Free. Takes a minute to set up.</p>
      <div class="lp-cta-row reveal zoom" style="--d:3">
        <span class="lp-cta-dot" aria-hidden="true">${dotMini("happy")}</span>
        <button class="btn lp-btn magnet" data-action="open-auth" data-mode="signup">Start owning it</button>
        <button class="lp-link" data-action="open-auth" data-mode="signin">I already have an account</button>
      </div>
      ${APP || store.get("ownit.noApp", false) ? "" : `<a class="lp-android reveal" style="--d:4" href="${ANDROID_APK}" download><span>${ICONS.arrow}</span>Download the Android app<small>Free · Android phones</small></a>`}
    </section>
    <footer class="lp-foot">OwnIt · <a href="privacy.html">Privacy Policy</a> · <a href="terms.html">Terms of Service</a></footer>
  </div>`;
}

let landingCtl = null;

function destroyLanding() {
  if (!landingCtl) return;
  landingCtl.alive = false;
  cancelAnimationFrame(landingCtl.raf);
  cancelAnimationFrame(landingCtl.sparkRaf);
  landingCtl.intervals.forEach(clearInterval);
  landingCtl.observers.forEach((o) => o.disconnect());
  landingCtl.cleanups.forEach((fn) => fn());
  try { landingCtl.renderer?.dispose(); } catch { /* ignore */ }
  landingCtl = null;
}

function initLanding() {
  destroyLanding();
  const root = document.getElementById("lp");
  if (!root) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
  const ctl = { alive: true, raf: 0, sparkRaf: 0, intervals: [], observers: [], cleanups: [], renderer: null };
  landingCtl = ctl;
  // "Pinned" scenes (the page holds still while something else moves) need a newer browser. Older ones get the simple stacked story.
  const day = root.classList.contains("day");
  const pin = !reduce && !!window.CSS?.supports?.("overflow-x", "clip");
  root.classList.toggle("pin", pin);
  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const countUp = (el, target, show, dur = 1600) => {
    if (reduce) return show(target);
    const t0 = performance.now();
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); show(target * (1 - Math.pow(1 - k, 3))); if (k < 1 && ctl.alive) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const countAttr = (el) => {
    const target = Number(el.dataset.count), fmt = el.dataset.fmt, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    countUp(el, target, (v) => { el.textContent = fmt === "hm" ? `${Math.floor(v / 60) ? Math.floor(v / 60) + "h " : ""}${Math.round(v % 60)}m` : pre + Math.round(v) + suf; });
  };

  // scroll-linked motion: progress bar, hero drift, ticker speed
  const hero = root.querySelector(".lp-hero"), heroWrap = root.querySelector(".lp-hero-wrap");
  const bands = root.querySelector(".lp-bands");
  const qsScroll = root.querySelector(".lp-qs-scroll"), qsPin = root.querySelector(".lp-qs-pin");
  const qsTexts = [...root.querySelectorAll(".sc-text")], qsN = root.querySelector("[data-qs-n]"), qsBar = root.querySelector(".lp-qs-bar i");
  const scWords = root.querySelector(".sc-words > div"), scBg = [...root.querySelectorAll(".sc-bg i")], scRig = root.querySelector(".sc-stage .rig"), scRing = root.querySelector(".rig-ring");
  const scrubEl = root.querySelector("[data-scrub]"), scrubWords = scrubEl ? [...scrubEl.querySelectorAll(".sc")] : [];
  let lit = -1, qsOn = -1, qsAt = -1;
  // The questions: Dot acts out each one, and only the Next button moves to the following one.
  // The colour washes out from him, the big word slides past, and he hops into the next scene.
  const scNext = root.querySelector(".sc-next");
  let scene = 0, sceneBusy = false;
  const drawScene = (p) => {
    const n = qsTexts.length, i = Math.max(0, Math.min(n - 1, Math.floor(p))), e = clamp01(p - i), hop = Math.sin(e * Math.PI);
    if (i !== qsAt && scBg.length > 1) {
      qsAt = i;
      scBg[0].style.background = LP_SCENES[i][1];
      scBg[1].style.background = LP_SCENES[Math.min(n - 1, i + 1)][1];
    }
    if (scBg[1]) scBg[1].style.clipPath = `circle(${(e * 150).toFixed(1)}% at 50% 38%)`;
    if (scWords) scWords.style.transform = `translate3d(${(-15 - p * 130).toFixed(2)}vw,0,0)`;
    if (scRig) scRig.style.transform = `translateY(${(-hop * 38).toFixed(1)}px) rotate(${(Math.sin(e * Math.PI * 2) * 6).toFixed(2)}deg) scale(${(1 + hop * .05).toFixed(3)}, ${(1 - hop * .05).toFixed(3)})`;
    if (scRing) scRing.style.transform = `rotate(${(p * 140).toFixed(1)}deg)`;
    const on = Math.round(p);
    if (on !== qsOn) {
      qsOn = on;
      qsPin.dataset.scene = on;
      if (scNext) scNext.classList.toggle("last", on === n - 1);
      qsTexts.forEach((c, k) => { c.classList.toggle("on", k === on); c.setAttribute("aria-hidden", k === on ? "false" : "true"); });
      if (qsN) qsN.textContent = "0" + (on + 1);
    }
    if (qsBar) qsBar.style.transform = `scaleX(${((p + 1) / n).toFixed(3)})`;
  };
  if (scNext && qsPin && qsTexts.length) {
    const goNext = () => {
      if (sceneBusy) return;
      if (scene >= qsTexts.length - 1) {   // after the last one: carry on down the page
        window.scrollTo({ top: qsPin.getBoundingClientRect().bottom + (window.scrollY || 0) + 1, behavior: reduce ? "auto" : "smooth" });
        return;
      }
      const from = scene; scene += 1;
      if (reduce) return drawScene(scene);
      sceneBusy = true;
      const t0 = performance.now();
      const step = (t) => {
        if (!ctl.alive) return;
        const k = clamp01((t - t0) / 950);
        drawScene(k < 1 ? from + ease(k) : scene);
        if (k < 1) requestAnimationFrame(step); else sceneBusy = false;
      };
      requestAnimationFrame(step);
    };
    scNext.addEventListener("click", goNext);
    ctl.cleanups.push(() => scNext.removeEventListener("click", goNext));
    drawScene(0);
  }
  const howPhone = root.querySelector(".lp-how-phone");
  const measure = () => {
    if (howPhone?.clientHeight) root.style.setProperty("--hs", (howPhone.clientHeight / 540).toFixed(4));
  };
  const frame = () => {
    const y = window.scrollY || 0, vh = innerHeight, max = Math.max(1, document.documentElement.scrollHeight - vh);
    root.style.setProperty("--sp", (y / max).toFixed(4));
    // 1. the hero: you fall into the wall of feeds
    if (hero && !reduce) {
      const span = pin && heroWrap ? heroWrap.offsetHeight - vh : hero.offsetHeight;
      root.style.setProperty("--hk", clamp01(y / Math.max(1, span)).toFixed(3));
    }
    // 2. the two bands of excuses slide sideways, in opposite directions
    if (bands && !reduce) {
      const r = bands.getBoundingClientRect();
      if (r.bottom > -200 && r.top < vh + 200) root.style.setProperty("--bx", ((r.top - vh / 2) * .55).toFixed(1) + "px");
    }
    // 3. the top bar changes colour while it sits on the coloured question scene
    if (qsPin) { const r = qsPin.getBoundingClientRect(); root.classList.toggle("on-stage", r.top <= 56 && r.bottom >= 56); }
    // 4. the study: the words light up as you read down
    if (scrubWords.length && !reduce) {
      const r = scrubEl.getBoundingClientRect();
      const k = clamp01((vh * .82 - r.top) / (vh * .42 + r.height));
      const now = Math.round(k * scrubWords.length);
      if (now !== lit) { lit = now; scrubWords.forEach((w, j) => w.classList.toggle("lit", j < now)); }
    }
  };
  let ticking = false;
  const onScroll = () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { ticking = false; if (ctl.alive) frame(); });
  };
  const onResize = () => { measure(); onScroll(); };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);
  ctl.cleanups.push(() => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); });
  if (reduce) scrubWords.forEach((w) => w.classList.add("lit"));
  measure(); frame();
  setTimeout(() => { if (ctl.alive) { measure(); frame(); } }, 600);

  // cursor glow, 3D tilt and a magnetic button (mouse only)
  if (!reduce && matchMedia("(pointer: fine)").matches) {
    const onPointer = (e) => {
      root.style.setProperty("--mx", e.clientX + "px");
      root.style.setProperty("--my", e.clientY + "px");
      root.classList.add("spot-on");
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    ctl.cleanups.push(() => window.removeEventListener("pointermove", onPointer));
    root.querySelectorAll(".magnet").forEach((btn) => {
      const move = (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
        btn.style.transform = `translate(${x * .25}px, ${y * .35}px) scale(1.04)`;
      };
      const leave = () => { btn.style.transform = ""; };
      btn.addEventListener("pointermove", move); btn.addEventListener("pointerleave", leave);
      ctl.cleanups.push(() => { btn.removeEventListener("pointermove", move); btn.removeEventListener("pointerleave", leave); });
    });
  }

  // hero number: 0 -> 5 years
  const heroNum = root.querySelector("[data-hero-count]");
  if (heroNum) setTimeout(() => countUp(heroNum, 4.9, (v) => { heroNum.textContent = v >= 4.85 ? "5" : v.toFixed(1); }, 2200), 300);

  // reveal on scroll
  const onVisible = (el) => {
    el.classList.add("in");
    if (el.classList.contains("split")) el.classList.add("in");
    el.querySelectorAll?.("[data-count]").forEach(countAttr);
  };
  if ("IntersectionObserver" in window && !reduce) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { onVisible(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.2 });
    root.querySelectorAll(".reveal, .split:not(.in-when-stage)").forEach((el) => io.observe(el));
    ctl.observers.push(io);
  } else {
    root.querySelectorAll(".reveal, .split").forEach(onVisible);
  }

  // question illustrations that need a little script
  const clock = root.querySelector("[data-clock]");
  let mins = 23 * 60 + 2;
  const unlockEl = root.querySelector("[data-unlocks]"), overEl = root.querySelector("[data-overload]");
  let unlocks = 0, seen = 0;
  if (!reduce) {
    ctl.intervals.push(setInterval(() => {
      if (clock) {
        mins = (mins + 3) % (24 * 60);
        if (mins === 3 * 60 + 2 || (mins > 3 * 60 && mins < 23 * 60)) mins = 23 * 60 + 2;
        const h = Math.floor(mins / 60), m = mins % 60, h12 = ((h + 11) % 12) + 1;
        clock.textContent = `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
      }
    }, 120));
    ctl.intervals.push(setInterval(() => {
      if (unlockEl) { unlocks = unlocks >= 205 ? 0 : unlocks + 1; unlockEl.textContent = String(unlocks); }
      if (overEl) { seen = seen >= 800 ? 0 : seen + 7; overEl.textContent = seen.toLocaleString(); }
    }, 90));
  } else {
    if (unlockEl) unlockEl.textContent = "205";
    if (overEl) overEl.textContent = "800";
  }

  // "How it works": a small phone acts out one whole visit, over and over
  const how = document.getElementById("lp-how");
  if (how) {
    const typed = how.querySelector("[data-typed]"), timeEl = how.querySelector("[data-how-time]"), lis = [...how.querySelectorAll("[data-how]")];
    const TEXT = "easy injera recipe";
    let timers = [];
    const stop = () => { timers.forEach(clearTimeout); timers = []; };
    const at = (ms, fn) => timers.push(setTimeout(() => { if (ctl.alive) fn(); }, ms));
    const setPhase = (ph) => {
      const step = ph < 2 ? 0 : ph < 3 ? 1 : 2;
      how.dataset.phase = ph; how.dataset.step = step;
      lis.forEach((li, k) => li.classList.toggle("on", k === step));
    };
    const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
    const play = (from = 0) => {
      stop();
      let t = 0;
      if (from === 0) {
        typed.textContent = ""; timeEl.textContent = "5:00"; setPhase(0);
        for (let i = 0; i < TEXT.length; i++) at(500 + i * 80, () => { typed.textContent = TEXT.slice(0, i + 1); });
        t = 500 + TEXT.length * 80 + 450;
        at(t, () => setPhase(1)); t += 500;
      } else typed.textContent = TEXT;
      if (from <= 1) {
        at(t, () => { timeEl.textContent = "5:00"; setPhase(2); });
        for (let k = 1; k <= 30; k++) at(t + 400 + k * 95, () => { timeEl.textContent = clock(300 * (1 - k / 30)); });
        t += 3500;
      }
      at(t, () => { timeEl.textContent = "0:00"; setPhase(3); }); t += 1900;
      at(t, () => setPhase(4)); t += 1300;
      at(t, () => setPhase(5)); t += 1000;
      at(t, () => setPhase(6)); t += 2400;
      at(t, () => play(0));
    };
    if (reduce) { typed.textContent = TEXT; how.classList.add("static"); }
    else {
      lis.forEach((li, k) => {
        const go = () => play(k);
        li.querySelector("button")?.addEventListener("click", go);
        ctl.cleanups.push(() => li.querySelector("button")?.removeEventListener("click", go));
      });
      if ("IntersectionObserver" in window) {
        let playing = false;
        const hio = new IntersectionObserver(([e]) => {
          if (e.isIntersecting && !playing) { playing = true; play(0); }
          else if (!e.isIntersecting && playing) { playing = false; stop(); }
        }, { threshold: 0.3 });
        hio.observe(how.querySelector(".lp-how-phone"));
        ctl.observers.push(hio);
      } else play(0);
      ctl.cleanups.push(stop);
    }
  }

  // sparks rising in the final section
  const sc = document.getElementById("lp-sparks");
  if (sc && !reduce) {
    const cx = sc.getContext("2d");
    const sparks = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.8 + .6, v: Math.random() * .0012 + .0004, a: Math.random() }));
    const drawSparks = () => {
      if (!ctl.alive) return;
      const w = sc.clientWidth, h = sc.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
      if (sc.width !== Math.round(w * dpr)) { sc.width = Math.round(w * dpr); sc.height = Math.round(h * dpr); }
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.clearRect(0, 0, w, h);
      for (const p of sparks) {
        p.y -= p.v; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
        const tw = .45 + .55 * Math.sin((p.a += .03));
        cx.beginPath(); cx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        cx.fillStyle = day ? `rgba(18,34,74,${.07 + .2 * tw})` : `rgba(242,239,230,${.18 + .4 * tw})`; cx.fill();
      }
      ctl.sparkRaf = requestAnimationFrame(drawSparks);
    };
    drawSparks();
  }

  // "Meet OwnIt": the logo's own story. The ring spins like an endless scroll until the dot jumps in and stops it.
  const meet = document.getElementById("lp-meet");
  const stage = document.getElementById("lp-lottie");
  let story = null, meetStarted = false;
  const startMeet = () => {
    if (meetStarted) return;
    meetStarted = true;
    meet?.querySelector(".in-when-stage")?.classList.add("in");
    if (story && !reduce) { story.goToAndPlay(0, true); setTimeout(() => meet?.classList.add("stopped"), 3900); }
    else { story?.goToAndStop(story.totalFrames - 1, true); meet?.classList.add("stopped"); }
  };
  const watch = () => {
    if (meet && "IntersectionObserver" in window) {
      const mio = new IntersectionObserver(([e]) => { if (e.intersectionRatio > 0.45) startMeet(); }, { threshold: [0, 0.45, 0.6] });
      mio.observe(meet.querySelector(".lp-meet-stage"));
      ctl.observers.push(mio);
    } else startMeet();
  };
  // On the light page the logo film is recoloured: navy ink on the milky background.
  const near = (c, r, g, b) => Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b) < .08;
  const recolour = (o) => {
    if (Array.isArray(o)) o.forEach(recolour);
    else if (o && typeof o === "object") {
      const k = (o.ty === "fl" || o.ty === "st") && o.c && o.c.k;
      if (Array.isArray(k) && typeof k[0] === "number") {
        if (near(k, .949, .937, .902)) o.c.k = [.071, .133, .29, 1];
        else if (near(k, .071, .133, .29)) o.c.k = [.949, .937, .902, 1];
      }
      Object.values(o).forEach(recolour);
    }
    return o;
  };
  const film = day ? fetch("logo-story.json").then((r) => r.json()).then(recolour).catch(() => null) : Promise.resolve(null);
  Promise.all([loadLottie(), film]).then(([lottie, data]) => {
    if (!ctl.alive || !stage) return;
    if (day && !data) throw new Error("no film");
    stage.innerHTML = "";
    story = lottie.loadAnimation({ container: stage, renderer: "svg", loop: false, autoplay: false, ...(data ? { animationData: data } : { path: "logo-story.json" }) });
    ctl.cleanups.push(() => story?.destroy());
    story.addEventListener("DOMLoaded", watch);
    story.addEventListener("data_failed", () => { story = null; stage.innerHTML = ART.loop(false); watch(); });
  }).catch(watch);
}

/** The small player for the logo animations (kept with the site, so it works without other servers). */
function loadLottie() {
  if (window.lottie) return Promise.resolve(window.lottie);
  return new Promise((resolve, reject) => {
    const sc = document.createElement("script");
    sc.src = "lottie.js";
    sc.onload = () => (window.lottie ? resolve(window.lottie) : reject(new Error("player missing")));
    sc.onerror = reject;
    document.head.appendChild(sc);
    setTimeout(() => reject(new Error("timeout")), 8000);
  });
}

// ---------------------------------------------------------------------------
// Opening animation: plays once when the app opens
// ---------------------------------------------------------------------------
function playSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  const done = () => { el.classList.add("out"); setTimeout(() => el.remove(), 500); };
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const calm = look().motion === false || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!(APP || standalone) || calm) { el.remove(); return; }
  el.classList.add("on");
  const giveUp = setTimeout(done, 4500);
  loadLottie().then((lottie) => {
    const a = lottie.loadAnimation({ container: el.querySelector("div"), renderer: "svg", loop: false, autoplay: true, path: "splash.json" });
    a.addEventListener("complete", () => { clearTimeout(giveUp); setTimeout(done, 350); });
    a.addEventListener("data_failed", () => { clearTimeout(giveUp); done(); });
  }).catch(() => { clearTimeout(giveUp); done(); });
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
let ticker = null;
let lastPage = "";
/** Numbers marked data-count climb from zero the first time a page opens. */
function countUp() {
  if (look().motion === false) return;
  for (const el of document.querySelectorAll("[data-count]")) {
    if (el.closest(".lp")) continue;   // the story counts its own numbers
    const to = Number(el.dataset.count); if (!to) continue;
    const t0 = performance.now(), dur = 900;
    const step = (now) => {
      if (!el.isConnected) return;
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) requestAnimationFrame(step);
    };
    el.textContent = "0"; requestAnimationFrame(step);
  }
}
function render() {
  const focusedId = document.activeElement?.id;
  const intentVal = $("#intent")?.value;
  const onbVal = $("#onb-text")?.value;
  const kept = [...document.querySelectorAll("[data-keep]")].map((el) => [el.id, el.value]);

  let html;
  switch (S.phase) {
    case "auth": html = S.authOpen ? viewAuth() : viewLanding(); break;
    case "recovery": html = viewRecovery(); break;
    case "onboarding": html = viewOnboarding(); break;
    case "reality": html = viewReality(); break;
    case "app": html = viewApp(); break;
    default: html = viewLoading();
  }
  destroyLanding();
  root.innerHTML = demoBanner() + html + (S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "");

  // keep what the person was typing across re-renders
  if (intentVal != null && $("#intent")) $("#intent").value = intentVal;
  if (onbVal != null && $("#onb-text")) $("#onb-text").value = onbVal;
  for (const [id, val] of kept) { const el = document.getElementById(id); if (el && val) el.value = val; }
  if (focusedId && document.getElementById(focusedId)) document.getElementById(focusedId).focus();

  if (S.phase === "auth" && !S.authOpen) initLanding();
  const page = S.phase + ":" + S.tab;
  if (page !== lastPage) { lastPage = page; countUp(); document.querySelector(".content")?.classList.add("enter"); }
  clearInterval(ticker);
  if (S.phase === "app" && visitMode(openVisit()) === "active") ticker = setInterval(tick, 1000);
  if (S.phase === "app" && visitMode(openVisit()) === "active") tick();
}

// ---------------------------------------------------------------------------
// Timer & sound
// ---------------------------------------------------------------------------
let audio = null;
function unlockAudio() {
  try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch { audio = null; }
}
function chime() {
  if (!audio) return;
  try {
    const t = audio.currentTime;
    [660, 880].forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.5);
      o.connect(g); g.connect(audio.destination); o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.55);
    });
  } catch { /* sound is optional */ }
}
function tick() {
  const v = openVisit();
  if (!v || v.ended_at) return;
  const total = v.planned_minutes * 60000;
  const left = ms(v.started_at) + total - Date.now();
  if (left <= 0) {
    chime();
    try { navigator.vibrate?.([300, 120, 300]); } catch { /* optional */ }
    if (document.hidden) { Notify.timeUp(v); document.title = "Time's up · OwnIt"; }
    render();
    return;
  }
  const cd = $("#countdown"); if (cd) cd.textContent = fmtClock(left);
  const bar = $("#lt-bar");
  if (bar) {
    const gone = 1 - left / total;
    const d = ringDash(gone);
    bar.setAttribute("stroke-dasharray", d.array); bar.setAttribute("stroke-dashoffset", d.offset);
    const [x, y] = LOOP.at(gone);
    for (const id of ["#lt-dot", "#lt-halo"]) { const c = $(id); c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1)); }
    $("#loop-wrap")?.classList.toggle("low", left < 60000);
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function withBusy(fn) {
  if (S.busy) return;
  S.busy = true; render();
  try { await fn(); }
  catch (e) { S.authMsg = { kind: "error", text: friendlyError(e.message) }; if (S.phase === "app" || S.phase === "reality" || S.phase === "onboarding") toast(friendlyError(e.message)); }
  finally { S.busy = false; render(); }
}

async function startVisit(kind, intent, minutes, savedUrl, platform) {
  // Show the timer right away, then save in the background.
  const v = { id: "pending-" + uid(), platform: platform || S.platform, kind, intent, planned_minutes: minutes, started_at: new Date().toISOString(), ended_at: null, outcome: null, saved_url: savedUrl || "" };
  S.visits.unshift(v); render();
  try {
    const saved = await S.api.startVisit({ platform: v.platform, kind, intent, planned_minutes: minutes, started_at: v.started_at });
    v.id = saved.id;
    // If they already finished or checked in while it was saving, send that too.
    if (v.ended_at || v.outcome) await S.api.updateVisit(saved.id, { ended_at: v.ended_at, outcome: v.outcome });
  } catch (e) {
    toast("Couldn't save this visit: " + friendlyError(e.message));
  }
}

const actions = {
  "lp-answer"(el) {
    const card = el.closest(".lp-q"); if (!card || card.classList.contains("done")) return;
    const i = Number(card.dataset.i), v = Number(el.dataset.v);
    const stage = card.parentElement;
    stage.dataset.score = String(Number(stage.dataset.score || 0) + v);
    card.classList.add("done", v >= 1 ? "out-yes" : v > 0 ? "out-some" : "out-no");
    card.classList.remove("active");
    const next = stage.querySelector(`.lp-q[data-i="${i + 1}"]`);
    const dots = document.querySelectorAll(".lp-dots i");
    dots.forEach((d, k) => d.classList.toggle("on", k <= i + 1));
    if (!next) return;
    setTimeout(() => next.classList.add("active"), 180);
    if (next.classList.contains("lp-result")) {
      const score = Number(stage.dataset.score || 0), n = LP_QUESTIONS.length;
      const shown = Math.round(score);
      document.querySelector(".lp-dots")?.classList.add("hide");
      const title = score >= 2.5 ? "If these worry you, you're right." : score >= 1 ? "You're not alone in this." : "You're doing better than most.";
      const text = score >= 2.5
        ? "Most of these sound familiar. That's not a character flaw. It's what these apps are designed to do, and you can take control back."
        : score >= 1
          ? "A few of these sound familiar. Almost everyone feels this pull, and small changes make a big difference."
          : "You're mostly in control. Here's why it's still worth protecting, because the pull is strong for everyone.";
      document.getElementById("lp-result-title").textContent = title;
      document.getElementById("lp-result-text").textContent = text;
      const num = document.getElementById("lp-score-num");
      let k = 0; const tick = () => { num.textContent = String(Math.min(shown, k)); if (k++ < shown) setTimeout(tick, 160); }; setTimeout(tick, 400);
      num.nextElementSibling.textContent = `of ${n} sound like you`;
    }
  },
  "lp-go"(el) { document.getElementById(el.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" }); },
  "open-auth"(el) { S.authOpen = true; S.authMode = el.dataset.mode || "signup"; S.authMsg = null; render(); window.scrollTo({ top: 0 }); },
  "back-landing"() { S.authOpen = false; S.authMsg = null; render(); window.scrollTo({ top: 0 }); },
  "auth-mode"(el) { S.authMode = el.dataset.mode; S.authMsg = null; render(); $("#email")?.focus(); },
  google() {
    S.authMsg = null;
    withBusy(async () => { await S.api.signInWithGoogle(); });
  },
  tab(el) { S.moment = null; goTo(el.dataset.tab); },
  "moment-close"() { S.moment = null; render(); },
  "moment-seen"() { if (S.moment) { S.moment.full = false; render(); } },
  "look-contrast"(el) { setLook({ contrast: el.dataset.id === "on" }); render(); },
  help(el) { const id = el.dataset.id; S.help[id] = !S.help[id]; render(); },
  guide(el) { S.guide = S.guide === el.dataset.id ? null : el.dataset.id; render(); },
  "look-theme"(el) { setLook({ theme: el.dataset.id }); render(); },
  "look-colour"(el) { setLook({ colour: el.dataset.id }); render(); },
  "look-font"(el) { setLook({ font: el.dataset.id }); render(); },
  "look-size"(el) { setLook({ size: el.dataset.id }); render(); },
  "look-motion"(el) { setLook({ motion: el.dataset.id === "on" }); render(); },
  "default-minutes"(el) { const m = Number(el.dataset.min); store.set("ownit.minutes", m); S.minutes = m; render(); },
  "toggle-guarded"(el) {
    const id = el.dataset.id; let list = guardedApps();
    list = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    if (!list.length) { toast("At least one app stays guarded."); return; }
    store.set("ownit.guarded", list); syncGuardedApps(); render();
  },
  "battery-settings"() { appCall("openBatterySettings"); },
  "battery-skip"() { store.set("ownit.batterySkip", true); render(); },
  "no-app"() { store.set("ownit.noApp", true); render(); },

  // onboarding
  "onb-pick"(el) {
    const q = QUESTIONS[S.onb.step];
    const a = S.onb.answers;
    if (q.type === "multi") {
      const cur = new Set(a[q.id] || []);
      cur.has(el.dataset.id) ? cur.delete(el.dataset.id) : cur.add(el.dataset.id);
      a[q.id] = [...cur];
      render();
    } else {
      a[q.id] = el.dataset.id;
      render();
      setTimeout(() => { if (QUESTIONS[S.onb.step] === q) actions["onb-next"](); }, 220);
    }
  },
  "onb-goal"(el) { S.onb.answers.daily_goal_minutes = Number(el.dataset.min); render(); },
  "onb-back"() { captureOnbText(); S.onb.step = Math.max(0, S.onb.step - 1); render(); },
  "onb-skip"() { const q = QUESTIONS[S.onb.step]; S.onb.answers[q.id] = ""; S.onb.step++; render(); },
  "onb-next"() {
    captureOnbText();
    const q = QUESTIONS[S.onb.step];
    const v = S.onb.answers[q.id];
    if (q.type === "text" && q.required && !(v || "").trim()) { $("#onb-text")?.focus(); return; }
    if (S.onb.step < QUESTIONS.length - 1) { S.onb.step++; render(); $("#onb-text")?.focus(); return; }
    const a = S.onb.answers;
    withBusy(async () => {
      S.profile = await S.api.saveProfile({
        display_name: (a.display_name || "").trim(),
        apps: a.apps || [],
        daily_hours: a.daily_hours,
        autopilot: a.autopilot,
        feeling: a.feeling,
        uses: a.uses || [],
        extra_hour: (a.extra_hour || "").trim(),
        daily_goal_minutes: a.daily_goal_minutes || suggestedGoal(a),
        onboarded_at: new Date().toISOString(),
      });
      S.platform = userApps()[0];
      syncGuardedApps();
      S.phase = "reality";
      window.scrollTo({ top: 0 });
    });
  },
  "finish-reality"() { S.phase = "app"; S.tab = "home"; render(); window.scrollTo({ top: 0 }); },
  "show-reality"() { S.phase = "reality"; render(); window.scrollTo({ top: 0 }); },
  retake() { S.onb = { step: 0, answers: { ...(S.profile || {}) } }; S.phase = "onboarding"; render(); },

  // home
  platform(el) { S.platform = el.dataset.id; render(); },
  minutes(el) { S.minutes = Number(el.dataset.min); render(); },
  "free-minutes"(el) { S.freeMinutes = Number(el.dataset.min); render(); },
  "toggle-free"() { S.showFree = !S.showFree; render(); },
  reuse(el) { const i = $("#intent"); i.value = el.dataset.q; S.intentError = false; i.focus(); },
  go(el, e) {
    const q = ($("#intent")?.value || "").trim();
    if (!q) { e.preventDefault(); S.intentError = true; render(); $("#intent")?.focus(); return; }
    S.blocked = null; S.moment = null;
    if (APP) {
      e.preventDefault();
      const mins = S.minutes;
      appStartVisit(S.platform, "search", q, mins, searchLink(S.platform, q));
      S.intentError = false;
      setTimeout(() => { if ($("#intent")) $("#intent").value = ""; startVisit("search", q, mins); }, 0);
      return;
    }
    el.href = searchLink(S.platform, q);  // the link opens TikTok with this address
    unlockAudio();
    navigator.clipboard?.writeText(q).catch(() => {});
    S.intentError = false;
    const mins = S.minutes;
    setTimeout(() => { if ($("#intent")) $("#intent").value = ""; startVisit("search", q, mins); }, 0);
  },
  "free-go"(el, e) {
    S.blocked = null;
    if (APP) { e.preventDefault(); appCall("startVisit", S.platform, "free", "", S.freeMinutes); }
    unlockAudio(); const mins = S.freeMinutes; setTimeout(() => { S.showFree = false; startVisit("free", "", mins); }, 0);
  },
  reopen() {
    const v = openVisit(); if (!v) return;
    const left = ms(v.started_at) + v.planned_minutes * 60000 - Date.now();
    appStartVisit(v.platform, v.kind, v.intent || "", Math.max(1, Math.ceil(left / 60000)), v.saved_url || (v.kind === "search" ? searchLink(v.platform, v.intent) : PLATFORMS[v.platform]?.feed || ""));
  },
  "guard-settings"() { appCall("openGuardSettings"); },

  // saved
  cat(el) { S.cat = el.dataset.cat || null; S.editSave = null; render(); },
  "draft-cat"(el) { S.draft.category = el.dataset.cat; render(); },
  "draft-cancel"() { S.draft = null; render(); },
  "draft-save"() {
    const d = S.draft; if (!d || !d.category) return;
    withBusy(async () => {
      const row = await S.api.addSave({ url: d.url, platform: d.platform, title: d.title, author: d.author, thumb: d.thumb, category: d.category, note: d.note });
      S.saves.unshift(row);
      store.set("ownit.lastCat", d.category);
      S.extraCats = (S.extraCats || []).filter((c) => c !== d.category);
      S.draft = null;
      const v = openVisit();
      const live = v && visitMode(v) === "active";
      if (!live) { S.tab = "saved"; S.cat = null; }
      const back = live && APP?.resumeApp;
      setTimeout(() => toast(`Saved to ${d.category}.` + (back ? ` Taking you back to ${platformName(v.platform)}.` : live ? ` Tap “Back to ${platformName(v.platform)}” to keep going.` : "")), 0);
      if (back) setTimeout(() => { const cur = openVisit(); if (cur && visitMode(cur) === "active") appCall("resumeApp", cur.platform); }, 1100);
    });
  },
  "save-edit"(el) { S.editSave = S.editSave === el.dataset.id ? null : el.dataset.id; render(); },
  "save-move"(el) {
    const r = S.saves.find((x) => x.id === el.dataset.id); if (!r) return;
    const category = el.dataset.cat;
    withBusy(async () => { await S.api.updateSave(r.id, { category }); r.category = category; S.editSave = null; });
  },
  "save-delete"(el) {
    const id = el.dataset.id;
    withBusy(async () => { await S.api.deleteSave(id); S.saves = S.saves.filter((x) => x.id !== id); S.editSave = null; setTimeout(() => toast("Deleted."), 0); });
  },
  "save-open"(el, e) {
    const r = S.saves.find((x) => x.id === el.dataset.id); if (!r) return;
    if (!PLATFORMS[r.platform]) { if (APP) appCall("openExternal", r.url); else window.open(r.url, "_blank", "noopener"); return; }
    const mins = S.minutes;
    const label = r.title || "Saved video";
    if (APP) { e.preventDefault(); appStartVisit(r.platform, "search", label, mins, r.url); }
    setTimeout(() => startVisit("search", label, mins, r.url, r.platform), 0);
  },

  // search link test
  "lt-open"() { S.tab = "settings"; S.linkTest = { q: "injera recipe", asked: null, result: {} }; render(); window.scrollTo({ top: 0 }); },
  "lt-close"() { appCall("endVisit"); S.linkTest = null; render(); },
  "lt-try"(el) {
    const t = S.linkTest; const id = el.dataset.id;
    t.q = ($("#lt-q")?.value || "").trim() || "injera recipe";
    const tpl = LINK_STYLES.tiktok.find((x) => x[0] === id)[2];
    const res = appStartVisit("tiktok", "search", t.q, 1, fillLink(tpl, t.q));
    if (res === "none") { t.result[id] = "none"; t.asked = null; appCall("endVisit"); } else t.asked = id;
    render();
  },
  "lt-yes"(el) { appCall("endVisit"); store.set("ownit.link.tiktok", el.dataset.id); S.linkTest.asked = null; render(); setTimeout(() => toast("Done. OwnIt will open your searches this way from now on."), 0); },
  "lt-no"(el) { appCall("endVisit"); S.linkTest.result[el.dataset.id] = "no"; S.linkTest.asked = null; render(); },
  "lt-reset"() { store.set("ownit.link.tiktok", null); render(); },
  "setup-notify"() { appCall("requestNotifications"); },
  "overlay-settings"() { appCall("openOverlaySettings"); },
  "usage-settings"() { appCall("openUsageSettings"); },
  "setup-restricted-done"() { SETUP.restrictedDone = true; SETUP.back = false; render(); window.scrollTo({ top: 0 }); },
  "setup-back"() { SETUP.back = true; SETUP.restrictedDone = false; render(); window.scrollTo({ top: 0 }); },
  "setup-finish"() { SETUP.finished = true; render(); window.scrollTo({ top: 0 }); },
  "app-info"() { appCall("openAppInfo"); },
  async done() {
    const v = openVisit(); if (!v) return;
    appCall("endVisit");
    v.ended_at = new Date().toISOString(); render();
    if (!String(v.id).startsWith("pending-")) S.api.updateVisit(v.id, { ended_at: v.ended_at }).catch(() => {});
  },
  checkin(el) {
    const v = openVisit(); if (!v) return;
    const outcome = el.dataset.outcome;
    appCall("endVisit");
    const patch = { outcome, ended_at: v.ended_at || new Date().toISOString() };
    withBusy(async () => {
      if (!String(v.id).startsWith("pending-")) await S.api.updateVisit(v.id, patch);
      Object.assign(v, patch);
      const week = S.visits.filter((x) => ms(x.started_at) >= startOfWeek().getTime() && x.outcome);
      const f = week.filter((x) => x.outcome === "found").length;
      const score = `${f} of ${week.length} ${week.length === 1 ? "visit" : "visits"} this week got you what you came for.`;
      clearTimeout(momentTimer);
      momentTimer = setTimeout(() => { if (S.moment?.full) { S.moment.full = false; render(); } }, 3200);
      S.moment = {
        full: true,
        outcome,
        title: outcome === "found" ? "Loop broken." : outcome === "partly" ? "You came back out." : "The feed won this one.",
        text: outcome === "distracted" ? "Noticing it is the first step. Try a shorter time on your next visit." : score,
      };
      S.tab = "home"; S.blocked = null;
    });
  },

  "enable-notify"() {
    withBusy(async () => {
      const r = await Notify.enable();
      setTimeout(() => toast(r === "granted" ? "Notifications on. OwnIt will call you back when time's up." : "Notifications weren't allowed. You can turn them on in your browser settings."), 0);
    });
  },

  // profile
  "set-goal"(el) {
    const m = Number(el.dataset.min);
    withBusy(async () => { S.profile = await S.api.saveProfile({ daily_goal_minutes: m }); setTimeout(() => toast(`Daily budget set to ${m} minutes.`), 0); });
  },
  signout() {
    withBusy(async () => {
      await S.api.signOut();
      Object.assign(S, { user: null, profile: null, visits: [], saves: [], draft: null, phase: "auth", authMode: "signin", authOpen: true, authMsg: null, tab: "home", toast: null });
    });
  },
};

function captureOnbText() {
  const q = QUESTIONS[S.onb.step];
  if (q?.type === "text" && $("#onb-text")) S.onb.answers[q.id] = $("#onb-text").value;
}

const submits = {
  signin(f) {
    const email = f.email.value.trim(), password = f.password.value;
    if (!email || !password) { S.authMsg = { kind: "error", text: "Enter your email and password." }; render(); return; }
    withBusy(async () => { S.authMsg = null; await S.api.signIn(email, password); });
  },
  signup(f) {
    const name = f.name.value.trim(), email = f.email.value.trim(), password = f.password.value;
    if (!name || !email || !password) { S.authMsg = { kind: "error", text: "Fill in your name, email and a password." }; render(); return; }
    withBusy(async () => {
      S.authMsg = null;
      const r = await S.api.signUp(email, password, name);
      if (r.needsConfirm) { S.authMode = "signin"; S.authMsg = { kind: "info", text: `Almost done. We sent a confirmation link to ${email}. Open it, then sign in here.` }; }
    });
  },
  reset(f) {
    const email = f.email.value.trim();
    if (!email) { S.authMsg = { kind: "error", text: "Enter the email you signed up with." }; render(); return; }
    withBusy(async () => {
      await S.api.resetPassword(email);
      S.authMode = "signin";
      S.authMsg = { kind: "info", text: S.api.preview ? "Preview mode can't send emails. In the real site, a reset link would arrive now." : `If ${email} has an account, a reset link is on its way.` };
    });
  },
  "new-password"(f) {
    const pw = f.password.value;
    if (pw.length < 6) { S.authMsg = { kind: "error", text: "Your password needs at least 6 characters." }; render(); return; }
    withBusy(async () => { await S.api.updatePassword(pw); S.authMsg = null; toast("Password updated."); await afterSignIn(S.user); });
  },
  go() { $('[data-action="go"]')?.click(); },
  "paste-link"(f) { const i = f.querySelector("input"); const text = i.value.trim(); if (!text) { i.focus(); return; } i.value = ""; beginSave(text); },
  "new-cat"(f) {
    const i = f.querySelector("input"); const name = i.value.trim().replace(/\s+/g, " ").slice(0, 30);
    if (!name || !S.draft) { i.focus(); return; }
    const existing = categories().list.find((c) => c.toLowerCase() === name.toLowerCase());
    if (!existing) S.extraCats = [...(S.extraCats || []), name];
    S.draft.category = existing || name; i.value = ""; render();
  },
};

root.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) fn(el, e);
});
root.addEventListener("submit", (e) => {
  e.preventDefault();
  const fn = submits[e.target.dataset.submit];
  if (fn) fn(e.target);
});
root.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "onb-text") { e.preventDefault(); actions["onb-next"](); }
});
root.addEventListener("input", (e) => {
  if (e.target.id === "onb-text") {
    const q = QUESTIONS[S.onb.step];
    S.onb.answers[q.id] = e.target.value;
    const next = $('[data-action="onb-next"]');
    if (next) next.disabled = q.required && !e.target.value.trim();
  }
  if (e.target.id === "intent" && S.intentError) { S.intentError = false; render(); }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) { document.title = "OwnIt"; if (S.phase === "app") render(); }
});
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data?.type === "ownit-checkin" && S.phase === "app") { S.tab = "home"; render(); window.scrollTo({ top: 0 }); }
  });
}

// ---------------------------------------------------------------------------
// Hooks the Android app calls
// ---------------------------------------------------------------------------
window.ownitAuthCallback = (fragment) => {
  S.authMsg = null;
  withBusy(async () => { await S.api.sessionFromLink(fragment); });
};
window.ownitBlocked = (platform) => {
  if (PLATFORMS[platform]) { S.blocked = platform; S.platform = platform; }
  if (S.phase !== "app") return;
  S.tab = "home"; render(); window.scrollTo({ top: 0 });
  setTimeout(() => $("#intent")?.focus(), 250);
};
window.ownitTimeUp = () => {
  if (S.phase !== "app") return;
  const v = openVisit();
  if (v && !v.ended_at && visitMode(v) === "checkin") v.ended_at = new Date().toISOString();
  S.tab = "home"; render(); window.scrollTo({ top: 0 });
};
window.ownitResume = () => { if (S.phase === "app") render(); };
/** A link shared to OwnIt from another app (Share → OwnIt). */
window.ownitShare = (text) => {
  if (S.phase !== "app") { S.pendingShare = text; return; }
  beginSave(text);
};
window.ownitMeta = (key, json) => { try { applyMeta(key, typeof json === "string" ? JSON.parse(json) : json); } catch { /* details are optional */ } };

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function boot() {
  playSplash();
  render();
  if (!DEMO && !APP && "serviceWorker" in navigator) Notify.registration();
  if (location.search.includes("checkin=1")) history.replaceState(null, "", location.pathname);
  try {
    S.api = DEMO ? createPreviewBackend() : await createSupabaseBackend();
  } catch (e) {
    S.api = createPreviewBackend();
    console.warn("Supabase failed to load, using preview mode.", e);
  }
  S.api.onAuth((evt, user) => {
    if (evt === "PASSWORD_RECOVERY") { S.user = user; S.phase = "recovery"; S.authMsg = null; render(); return; }
    if (evt === "SIGNED_IN" && user && (!S.user || S.user.id !== user.id)) { S.user = user; setTimeout(() => afterSignIn(user), 0); return; }
    if (evt === "SIGNED_OUT") { Object.assign(S, { user: null, profile: null, visits: [], phase: "auth" }); render(); }
  });
  const user = await S.api.init().catch(() => null);
  if (user && S.phase !== "recovery" && S.phase === "loading" && !S.user) await afterSignIn(user);
  else if (user && S.phase === "loading" && S.user) { /* sign-in event already handling it */ }
  else if (S.phase !== "recovery") { S.phase = "auth"; render(); }
})();
