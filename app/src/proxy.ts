import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Renueva la sesión de Supabase y manda a /login a quien no la tenga. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) response.cookies.set(name, value, options);
        },
      },
    },
  );
  const { data } = await supabase.auth.getUser();
  const enLogin = request.nextUrl.pathname.startsWith("/login");
  if (!data.user && !enLogin) return NextResponse.redirect(new URL("/login", request.url));
  if (data.user && enLogin) return NextResponse.redirect(new URL("/mesas", request.url));
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
