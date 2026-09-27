// Minimal Stripe REST client: only what the agent needs (create a sellable payment link, read
// completed checkouts). Use a RESTRICTED key with just: Products write, Prices write,
// Payment Links write, Checkout Sessions read. The agent never touches payouts or refunds.

type Fetch = typeof fetch;
let fetcher: Fetch = (...a) => fetch(...a);

/** Tests inject a fake fetch. */
export function setStripeFetch(f: Fetch | null): void {
  fetcher = f ?? ((...a) => fetch(...a));
}

function form(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

async function call<T>(key: string, method: "GET" | "POST", path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = method === "GET" && Object.keys(params).length ? `?${form(params)}` : "";
  const res = await fetcher(`https://api.stripe.com/v1${path}${qs}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" ? form(params) : undefined,
  });
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Stripe ${method} ${path}: ${body.error?.message ?? res.status}`);
  return body;
}

export interface CreatedLink {
  product_id: string;
  price_id: string;
  payment_link_id: string;
  payment_link_url: string;
}

export async function createPaymentLink(
  key: string,
  opts: { name: string; description: string; amountCents: number; currency: string; redirectUrl: string; metadata: Record<string, string> },
): Promise<CreatedLink> {
  const meta = Object.fromEntries(Object.entries(opts.metadata).map(([k, v]) => [`metadata[${k}]`, v]));
  const product = await call<{ id: string }>(key, "POST", "/products", { name: opts.name, description: opts.description.slice(0, 500), ...meta });
  const price = await call<{ id: string }>(key, "POST", "/prices", { product: product.id, unit_amount: opts.amountCents, currency: opts.currency });
  const link = await call<{ id: string; url: string }>(key, "POST", "/payment_links", {
    "line_items[0][price]": price.id,
    "line_items[0][quantity]": 1,
    "after_completion[type]": "redirect",
    "after_completion[redirect][url]": opts.redirectUrl,
    ...meta,
  });
  return { product_id: product.id, price_id: price.id, payment_link_id: link.id, payment_link_url: link.url };
}

export interface CompletedCheckout {
  id: string;
  created: number;
  amount_total: number;
  currency: string;
}

/** Completed checkouts of one payment link created after `sinceUnix` (seconds). */
export async function completedCheckouts(key: string, paymentLinkId: string, sinceUnix: number): Promise<CompletedCheckout[]> {
  const out: CompletedCheckout[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 10; page++) {
    const res = await call<{ data: Array<CompletedCheckout & { status: string; payment_status: string }>; has_more: boolean }>(key, "GET", "/checkout/sessions", {
      payment_link: paymentLinkId,
      status: "complete",
      "created[gt]": sinceUnix,
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const s of res.data) if (s.payment_status === "paid") out.push({ id: s.id, created: s.created, amount_total: s.amount_total, currency: s.currency });
    if (!res.has_more || res.data.length === 0) break;
    startingAfter = res.data[res.data.length - 1]!.id;
  }
  return out;
}
