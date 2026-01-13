import { supabase } from './supabase';

export const createClient = () => supabase;

export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  return { session, error };
}

export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  return { user, error };
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = '/login';
}

