"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/server/supabase";

export type LoginState = { error: string | null };

export async function logoutAction(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Escribe tu correo y tu contraseña." };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Correo o contraseña incorrectos." };
  redirect("/mesas");
}
