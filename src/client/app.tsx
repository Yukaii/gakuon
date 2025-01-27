import { useState, useEffect } from 'react';
import { fetchDecks, fetchDeckCards, answerCard, regenerateCard } from './api';
import type { Card } from './types';

export function App() {
  const [decks, setDecks] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>('');
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load decks on mount
  useEffect(() => {
    const loadDecks = async () => {
      try {
        const response = await fetchDecks();
        setDecks(response.decks);
        setLoading(false);
      } catch (err) {
        setError('Failed to load decks');
        setLoading(false);
      }
    };
    loadDecks();
  }, []);

  // Load cards when deck is selected
  useEffect(() => {
    if (!selectedDeck) return;

    const loadCards = async () => {
      try {
        setLoading(true);
        const cards = await fetchDeckCards(selectedDeck);
        setCards(cards);
        setCurrentCardIndex(0);
        setLoading(false);
      } catch (err) {
        setError('Failed to load cards');
        setLoading(false);
      }
    };
    loadCards();
  }, [selectedDeck]);

  const currentCard = cards[currentCardIndex];

  const handleDeckSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedDeck(event.target.value);
  };

  const handleAnswer = async (ease: number) => {
    if (!currentCard) return;

    try {
      await answerCard(currentCard.id, { ease });
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex(i => i + 1);
      } else {
        setCards([]);
        setCurrentCardIndex(0);
      }
    } catch (err) {
      setError('Failed to submit answer');
    }
  };

  const handleRegenerate = async () => {
    if (!currentCard) return;

    try {
      setLoading(true);
      const { content } = await regenerateCard(currentCard.id);
      setCards(cards.map(card =>
        card.id === currentCard.id
          ? { ...card, content }
          : card
      ));
      setLoading(false);
    } catch (err) {
      setError('Failed to regenerate card');
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
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
        {decks.map(deck => (
          <option key={deck} value={deck}>{deck}</option>
        ))}
      </select>

      {currentCard && (
        <div className="card p-4 border rounded mb-4">
          <div className="mb-4">
            <h2 className="font-bold">Content:</h2>
            {Object.entries(currentCard.content).map(([key, value]) => (
              <div key={key} className="mb-2">
                <strong>{key}:</strong> {value}
              </div>
            ))}
          </div>

          {currentCard.audioUrls.length > 0 && (
            <div className="mb-4">
              <h2 className="font-bold">Audio:</h2>
              {currentCard.audioUrls.map((url, index) => (
                <audio key={index} controls className="w-full mb-2">
                  <source src={`http://localhost:4989/api/audio/${url.replace('[sound:', '').replace(']', '')}`} type="audio/mpeg" />
                </audio>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => handleAnswer(1)}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              Again
            </button>
            <button
              onClick={() => handleAnswer(2)}
              className="bg-yellow-500 text-white px-4 py-2 rounded"
            >
              Hard
            </button>
            <button
              onClick={() => handleAnswer(3)}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Good
            </button>
            <button
              onClick={() => handleAnswer(4)}
              className="bg-blue-500 text-white px-4 py-2 rounded"
            >
              Easy
            </button>
          </div>

          <button
            onClick={handleRegenerate}
            className="mt-4 bg-gray-500 text-white px-4 py-2 rounded"
          >
            Regenerate
          </button>
        </div>
      )}

      <div className="text-sm text-gray-500">
        {cards.length > 0 && (
          <span>Card {currentCardIndex + 1} of {cards.length}</span>
        )}
      </div>
    </div>
  );
}
