import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import useSWR from "swr";
import { fetchDecks, fetchDeckCards } from "../api";

export function DeckView() {
  const { deckName } = useParams();
  const navigate = useNavigate();

  const { data: decksData } = useSWR("/api/decks", fetchDecks);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
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

  const handleNextCard = () => {
    if (cards && currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
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
          <div className="card p-4 border rounded mb-4">
            <h2 className="font-bold">Card #{cards[currentCardIndex].cardId}</h2>
            {/* Display card details here */}
            <div className="mb-4">
              <h2 className="font-bold">Card Fields:</h2>
              {Object.entries(cards[currentCardIndex].fields).map(([field, fieldData]) => (
                <div key={field} className="mb-2">
                  <strong>{field}: {fieldData.value}</strong>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePreviousCard}
                disabled={currentCardIndex === 0}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={handleNextCard}
                disabled={currentCardIndex === cards.length - 1}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
