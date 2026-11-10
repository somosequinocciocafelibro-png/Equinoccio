export interface SearchParts {
  qty: number;
  text: string;
}

const WITH_QTY = /^(\d{1,2})(?:\s*[*x×]\s*|\s+)(.+)$/i;

/** "3 latte", "3*latte" y "3x latte" piden tres; sin cantidad (o con una inválida) vale uno. */
export function parseSearch(q: string): SearchParts {
  const m = q.match(WITH_QTY);
  if (m) {
    const qty = parseInt(m[1], 10);
    if (qty >= 1) return { qty, text: m[2] };
  }
  return { qty: 1, text: q };
}

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function matchProducts<T extends { name: string; category: string }>(
  products: T[],
  text: string,
  category: string,
): T[] {
  const needle = normalize(text);
  return products.filter(
    (p) => (category === "Todos" || p.category === category) && (!needle || normalize(p.name).includes(needle)),
  );
}
