import { useState } from "react";
import useSWR from "swr";
import {
  fetchDecks,
  fetchCard,
  fetchDeckCards,
  fetchDeckConfig,
  answerCard,
  regenerateCard,
} from "./api";

const API_BASE = "http://localhost:4989/api";

export function App() {
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Fetch decks
  const { data: decksData, error: decksError } = useSWR(
    "/api/decks",
    fetchDecks,
  );

  // Fetch cards for selected deck
  const {
    data: cards,
    error: cardsError,
    mutate: mutateCards,
  } = useSWR(selectedDeck ? `/api/decks/${selectedDeck}/cards` : null, () =>
    fetchDeckCards(selectedDeck),
  );

  // Fetch deck config
  const { data: deckConfig, error: configError } = useSWR(
    selectedDeck ? `/api/decks/${selectedDeck}/config` : null,
    () => fetchDeckConfig(selectedDeck),
  );

  const currentCard = cards?.[currentCardIndex];

  const { data: cardInfo } = useSWR(
    currentCard ? `/api/cards/${currentCard.cardId}` : null,
    () => fetchCard(currentCard.cardId),
  );

  const handleDeckSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDeck(event.target.value);
    setCurrentCardIndex(0);
  };

  const handleAnswer = async (ease: number) => {
    if (!currentCard || !cards) return;

    try {
      await answerCard(currentCard.cardId, { ease });
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex((i) => i + 1);
      } else {
        // Refresh cards list
        mutateCards();
        setCurrentCardIndex(0);
      }
    } catch (err) {
      console.error("Failed to submit answer:", err);
    }
  };

  const handleRegenerate = async () => {
    if (!currentCard || !cards || isRegenerating) return;

    try {
      setIsRegenerating(true);
      await regenerateCard(currentCard.cardId);

      // Wait for content to be ready
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const response = await fetch(`${API_BASE}/cards/${currentCard.cardId}`);
        const updatedCard = await response.json();

        if (Object.keys(updatedCard.content || {}).length > 0) {
          // Update the card in the list
          const updatedCards = cards.map((card) =>
            card.cardId === currentCard.cardId ? updatedCard : card,
          );
          await mutateCards(updatedCards, false);
          break;
        }

        attempts++;
      }
    } catch (err) {
      console.error("Failed to regenerate card:", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (decksError || cardsError || configError) {
    return <div>Error loading data</div>;
  }

  if (!decksData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Gakuon Web</h1>

      <select
        value={selectedDeck}
        onChange={handleDeckSelect}
        className="w-full p-2 mb-4 border rounded"
      >
        <option value="">Select a deck</option>
        {decksData.decks.map((deck) => (
          <option key={deck} value={deck}>
            {deck}
          </option>
        ))}
      </select>

      {cardInfo && deckConfig && (
        <div className="card p-4 border rounded mb-4">
          {/* Original fields */}
          <div className="mb-4">
            <h2 className="font-bold">Card Fields:</h2>
            {Object.entries(deckConfig.config.responseFields).map(
              ([field, fieldValue]) => (
                <div key={field} className="mb-2">
                  <strong>
                    {field}: {fieldValue.description}
                  </strong>
                </div>
              ),
            )}
          </div>

          {/* Generated content */}
          <div className="mb-4">
            <h2 className="font-bold">Generated Content:</h2>
            {Object.entries(deckConfig.config.responseFields).map(
              ([field, config]) => (
                <div key={field} className="mb-2">
                  <strong>{config.description}:</strong>{" "}
                  {cardInfo.content?.[field] || "(Not generated)"}
                </div>
              ),
            )}
          </div>

          {/* Audio player */}
          {cardInfo.audioUrls?.length > 0 && (
            <div className="mb-4">
              <h2 className="font-bold">Audio:</h2>
              {cardInfo.audioUrls.map((url, index) => (
                <audio key={index} controls className="w-full mb-2">
                  <source
                    src={`${API_BASE}/audio/${url.replace("[sound:", "").replace("]", "")}`}
                  />
                </audio>
              ))}
            </div>
          )}

          {/* Answer buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAnswer(1)}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              Again
            </button>
            <button
              type="button"
              onClick={() => handleAnswer(2)}
              className="bg-yellow-500 text-white px-4 py-2 rounded"
            >
              Hard
            </button>
            <button
              type="button"
              onClick={() => handleAnswer(3)}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Good
            </button>
            <button
              type="button"
              onClick={() => handleAnswer(4)}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Easy
            </button>
          </div>

          {/* Regenerate button */}
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className={`mt-4 ${
              isRegenerating ? "bg-gray-300" : "bg-gray-500"
            } text-white px-4 py-2 rounded`}
          >
            {isRegenerating ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      )}

      {/* Progress indicator */}
      <div className="text-sm text-gray-500">
        {cards && cards.length > 0 && (
          <span>
            Card {currentCardIndex + 1} of {cards.length}
          </span>
        )}
      </div>
    </div>
  );
}
