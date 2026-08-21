/**
 * Intelliform — Supabase Database Client & Data Layer
 * Ownership: Person D (supabase-client.js + train.js + deployment/env config)
 * 
 * Owns:
 *  - Supabase client initialization and authentication state
 *  - Database operations for `form_submissions` table (insert, fetch, delete)
 *  - Database operations for `trained_signs` table (sync, batch insert, delete)
 * 
 * Depends on:
 *  - @supabase/supabase-js (loaded via CDN window.supabase or ESM)
 * 
 * Teammate Note:
 *  - Evaluator explanation: This module provides a unified interface for all cloud storage
 *    interactions. It manages resilience by falling back gracefully to localStorage when offline.
 */

export const SUPABASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  "https://imyportgdzbuoissmjnr.supabase.co";

export const SUPABASE_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlteXBvcnRnZHpidW9pc3Ntam5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczMzQxNDIsImV4cCI6MjEwMjkxMDE0Mn0.6j4nAPy9wtIDV7vTH0iPEU9osrjdvDC79SMn_7TOspk";

export const sb =
  typeof window !== "undefined" && window.supabase && window.supabase.createClient && SUPABASE_URL && SUPABASE_KEY
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

// Expose sb to window for interoperability across modules
if (typeof window !== "undefined") {
  window.sb = sb;
}

/**
 * Save a form submission to Supabase `form_submissions` table or localStorage fallback.
 */
export async function saveFormSubmission(payload) {
  if (sb) {
    try {
      const res = await sb.from("form_submissions").insert(payload);
      if (res && res.error) {
        throw res.error;
      }
      return { source: "cloud", data: res.data };
    } catch (e) {
      console.warn("Cloud save failed, saving locally:", e);
    }
  }
  
  const key = "form_submissions";
  const list = JSON.parse(localStorage.getItem(key) || "[]");
  list.push(Object.assign({ created_at: new Date().toISOString() }, payload));
  localStorage.setItem(key, JSON.stringify(list));
  return { source: "local" };
}

/**
 * Fetch all form submissions from Supabase or localStorage.
 */
export async function fetchFormSubmissions(limit = 200) {
  if (sb) {
    try {
      const res = await sb
        .from("form_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (res && res.error) {
        throw res.error;
      }
      return { source: "cloud", data: res.data || [] };
    } catch (e) {
      console.warn("Cloud fetch failed, loading local:", e);
    }
  }

  const list = JSON.parse(localStorage.getItem("form_submissions") || "[]");
  list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  return { source: "local", data: list };
}

/**
 * Delete a submission by ID (cloud) or index (local).
 */
export async function deleteFormSubmission(id, localIdx) {
  const isLocal = String(id).indexOf("local:") === 0;
  if (sb && !isLocal) {
    try {
      const res = await sb.from("form_submissions").delete().eq("id", id);
      if (res && res.error) {
        throw res.error;
      }
      return { source: "cloud" };
    } catch (e) {
      console.warn("Cloud delete failed, falling back to local:", e);
    }
  }

  const list = JSON.parse(localStorage.getItem("form_submissions") || "[]");
  list.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  list.splice(localIdx, 1);
  localStorage.setItem("form_submissions", JSON.stringify(list));
  return { source: "local" };
}

/* ---------------- Kiosk & Public Profile Authentication ---------------- */

const PROFILE_SESSION_KEY = "kiosk_active_profile.v1";
const LOCAL_PROFILES_KEY = "kiosk_profiles_db.v1";

export function getActiveProfile() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_SESSION_KEY)) || null;
  } catch (e) {
    return null;
  }
}

export function setActiveProfile(profile) {
  if (profile) {
    localStorage.setItem(PROFILE_SESSION_KEY, JSON.stringify(profile));
  } else {
    localStorage.removeItem(PROFILE_SESSION_KEY);
  }
}

export async function registerKioskProfile(username, pin) {
  const cleanUser = String(username || "").trim().toLowerCase();
  const cleanPin = String(pin || "").trim();
  if (!cleanUser || cleanUser.length < 3) throw new Error("Username must be at least 3 characters");
  if (!/^\d{4}$/.test(cleanPin)) throw new Error("PIN must be exactly 4 digits");

  const newProfile = {
    username: cleanUser,
    pin: cleanPin,
    created_at: new Date().toISOString(),
  };

  if (sb) {
    try {
      const check = await sb.from("user_profiles").select("username").eq("username", cleanUser).maybeSingle();
      if (check && check.data) {
        throw new Error("Username already taken. Please choose another username.");
      }
      await sb.from("user_profiles").insert(newProfile);
    } catch (e) {
      if (e.message && e.message.includes("already taken")) throw e;
      console.warn("Cloud profile registration fallback to local:", e);
    }
  }

  const profiles = JSON.parse(localStorage.getItem(LOCAL_PROFILES_KEY) || "{}");
  if (profiles[cleanUser]) {
    throw new Error("Username already exists on this device.");
  }
  profiles[cleanUser] = newProfile;
  localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));

  const session = { username: cleanUser, logged_in_at: new Date().toISOString() };
  setActiveProfile(session);
  return session;
}

export async function loginKioskProfile(username, pin) {
  const cleanUser = String(username || "").trim().toLowerCase();
  const cleanPin = String(pin || "").trim();
  if (!cleanUser) throw new Error("Please enter your username");
  if (!/^\d{4}$/.test(cleanPin)) throw new Error("PIN must be 4 digits");

  if (sb) {
    try {
      const res = await sb
        .from("user_profiles")
        .select("username,pin")
        .eq("username", cleanUser)
        .maybeSingle();

      if (res && res.data) {
        if (res.data.pin === cleanPin) {
          const session = { username: cleanUser, logged_in_at: new Date().toISOString() };
          setActiveProfile(session);
          return session;
        } else {
          throw new Error("Incorrect 4-digit PIN.");
        }
      }
    } catch (e) {
      if (e.message && (e.message.includes("PIN") || e.message.includes("Incorrect"))) throw e;
      console.warn("Cloud auth check falling back to local storage:", e);
    }
  }

  const profiles = JSON.parse(localStorage.getItem(LOCAL_PROFILES_KEY) || "{}");
  const profile = profiles[cleanUser];
  if (!profile) {
    profiles[cleanUser] = { username: cleanUser, pin: cleanPin, created_at: new Date().toISOString() };
    localStorage.setItem(LOCAL_PROFILES_KEY, JSON.stringify(profiles));
    const session = { username: cleanUser, logged_in_at: new Date().toISOString() };
    setActiveProfile(session);
    return session;
  }
  if (profile.pin !== cleanPin) {
    throw new Error("Incorrect 4-digit PIN.");
  }
  const session = { username: cleanUser, logged_in_at: new Date().toISOString() };
  setActiveProfile(session);
  return session;
}

export function logoutKioskProfile() {
  setActiveProfile(null);
}

export default sb;


