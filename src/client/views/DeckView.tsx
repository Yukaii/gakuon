import { useParams, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { fetchDecks, fetchDeckCards } from "../api";

export function DeckView() {
  const { deckName } = useParams();
  const navigate = useNavigate();

  const { data: decksData } = useSWR("/api/decks", fetchDecks);
  const { data: cards } = useSWR(
    deckName ? `/api/decks/${deckName}/cards` : null,
    () => fetchDeckCards(deckName!),
  );

  const handleDeckSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDeck = event.target.value;
    if (selectedDeck) {
      navigate(`/decks/${encodeURIComponent(selectedDeck)}`);
    } else {
      navigate("/decks");
    }
  };

  const handleCardSelect = (cardId: number) => {
    navigate(`/decks/${encodeURIComponent(deckName!)}/cards/${cardId}`);
  };

  return (
    <div>
      <select
        value={deckName || ""}
        onChange={handleDeckSelect}
        className="w-full p-2 mb-4 border rounded"
      >
        <option value="">Select a deck</option>
        {decksData?.decks.map((deck) => (
          <option key={deck} value={deck}>
            {deck}
          </option>
        ))}
      </select>

      {cards && cards.length > 0 && (
        <div className="grid gap-4">
          <h2 className="text-xl font-bold">Due Cards ({cards.length})</h2>
          <div className="grid gap-2">
            {cards.map((card) => (
              <button
                key={card.cardId}
                onClick={() => handleCardSelect(card.cardId)}
                className="text-left p-4 border rounded hover:bg-gray-50"
              >
                Card #{card.cardId}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
