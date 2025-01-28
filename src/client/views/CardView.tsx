import { useParams, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { fetchCard, fetchDeckConfig, answerCard, regenerateCard } from "../api";
import { useState } from "react";

const API_BASE = "http://localhost:4989";

export function CardView() {
  const { deckName, cardId } = useParams();
  const navigate = useNavigate();
  const [isRegenerating, setIsRegenerating] = useState(false);

  const { data: deckConfig } = useSWR(
    deckName ? `/api/decks/${deckName}/config` : null,
    () => fetchDeckConfig(deckName!),
  );

  const { data: cardInfo, mutate: mutateCard } = useSWR(
    cardId ? `/api/cards/${cardId}` : null,
    () => fetchCard(Number(cardId!)),
    {
      refreshInterval: 0, // Disable auto-refresh
      revalidateOnFocus: false, // Disable revalidation on focus
    },
  );

  const handleAnswer = async (ease: number) => {
    if (!cardInfo) return;

    try {
      await answerCard(cardInfo.cardId, { ease });
      navigate(`/decks/${encodeURIComponent(deckName!)}`);
    } catch (err) {
      console.error("Failed to submit answer:", err);
    }
  };

  const handleRegenerate = async () => {
    if (!cardInfo || isRegenerating) return;

    try {
      setIsRegenerating(true);
      await regenerateCard(cardInfo.cardId);

      // Poll for updates
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await mutateCard();
        attempts++;
      }
    } catch (err) {
      console.error("Failed to regenerate card:", err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!cardInfo || !deckConfig) return <div>Loading...</div>;

  return (
    <div className="card p-4 border rounded mb-4">
      {/* Card content */}
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
                src={`${API_BASE}/api/audio/${url
                  .replace("[sound:", "")
                  .replace("]", "")}`}
              />
            </audio>
          ))}
        </div>
      )}

      {/* Answer buttons */}
      <div className="flex gap-2">
        {[
          { ease: 1, label: "Again", color: "red" },
          { ease: 2, label: "Hard", color: "yellow" },
          { ease: 3, label: "Good", color: "green" },
          { ease: 4, label: "Easy", color: "blue" },
        ].map(({ ease, label, color }) => (
          <button
            key={ease}
            type="button"
            onClick={() => handleAnswer(ease)}
            className={`bg-${color}-500 text-white px-4 py-2 rounded`}
          >
            {label}
          </button>
        ))}
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
  );
}
