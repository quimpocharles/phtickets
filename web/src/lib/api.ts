import type { Game, PurchasePayload, PurchaseResponse, CartOrderResponse } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function getGames(): Promise<Game[]> {
  const res = await fetch(`${API_URL}/games`, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error('Failed to load games.');
  const json = await res.json();
  return json.data as Game[];
}

export async function getGame(gameId: string): Promise<Game | null> {
  const games = await getGames();
  return games.find((g) => g._id === gameId) ?? null;
}

export async function purchaseTickets(payload: PurchasePayload): Promise<PurchaseResponse> {
  const res = await fetch(`${API_URL}/tickets/purchase`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json: PurchaseResponse = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'Purchase failed.');
  return json;
}

export async function getCartOrder(cartId: string): Promise<CartOrderResponse> {
  const res = await fetch(`${API_URL}/tickets/order/cart/${cartId}`);
  return res.json();
}
