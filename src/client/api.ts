import type { DecksResponse, Card, CardAnswer, DeckConfigResponse } from "./types";

const API_BASE = "http://localhost:4989/api";

export async function fetchDecks(): Promise<DecksResponse> {
  const response = await fetch(`${API_BASE}/decks`);
  if (!response.ok) throw new Error("Failed to fetch decks");
  return response.json();
}

export async function fetchDeckCards(deckName: string): Promise<Card[]> {
  const response = await fetch(
    `${API_BASE}/decks/${encodeURIComponent(deckName)}/cards`,
  );
  if (!response.ok) throw new Error("Failed to fetch deck cards");
  return response.json();
}

export async function fetchCard(cardId: number): Promise<Card> {
  const response = await fetch(`${API_BASE}/cards/${cardId}`);
  if (!response.ok) throw new Error("Failed to fetch card");
  return response.json();
}

export async function answerCard(
  cardId: number,
  answer: CardAnswer,
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/cards/${cardId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answer),
  });
  if (!response.ok) throw new Error("Failed to submit answer");
  return response.json();
}

export async function regenerateCard(
  cardId: number,
): Promise<{ content: Record<string, string> }> {
  const response = await fetch(`${API_BASE}/cards/${cardId}/regenerate`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to regenerate card");
  return response.json();
}

export async function fetchDeckConfig(deckName: string): Promise<DeckConfigResponse> {
  const response = await fetch(`${API_BASE}/decks/${encodeURIComponent(deckName)}/config`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Deck configuration not found');
    }
    throw new Error('Failed to fetch deck configuration');
  }
  return response.json();
}
