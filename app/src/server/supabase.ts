import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

/** Cliente de Supabase para el servidor, con la sesión guardada en cookies. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // En componentes de servidor no se pueden escribir cookies; el proxy renueva la sesión.
        }
      },
    },
  });
}
