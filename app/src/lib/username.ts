/** Deja el usuario en minúsculas, sin tildes ni espacios y solo con letras y números ("María" → "maria"). */
export function normalizeUsername(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Correo con el que se registró a la persona en Supabase. La plantilla lleva `{usuario}` (por ejemplo
 * `cuenta+{usuario}@gmail.com`); si escriben un correo completo se respeta tal cual. Sin usuario válido devuelve null.
 */
export function loginEmail(input: string, template: string): string | null {
  const raw = input.trim();
  if (raw.includes("@")) return raw.toLowerCase();
  const user = normalizeUsername(raw);
  return user ? template.replace("{usuario}", user) : null;
}
