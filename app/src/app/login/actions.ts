"use server";

import { redirect } from "next/navigation";
import { loginEmail } from "@/lib/username";
import { supabaseServer } from "@/server/supabase";

const EMAIL_TEMPLATE = process.env.LOGIN_EMAIL_TEMPLATE ?? "somosequinocciocafelibro+{usuario}@gmail.com";

export type LoginState = { error: string | null };

export async function logoutAction(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = loginEmail(String(formData.get("usuario") ?? ""), EMAIL_TEMPLATE);
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Escribe tu nombre y tu contraseña." };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Nombre o contraseña incorrectos." };
  redirect("/mesas");
}
