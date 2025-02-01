import {
  Gear,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import useSWR from "swr";
import {
  answerCard,
  fetchCard,
  fetchDeckCards,
  fetchDeckConfig,
  fetchDecks,
  regenerateCard,
  sync,
} from "../api";

import AnswerButtons from "../components/AnswerButtons";
import AudioPlayer from "../components/AudioPlayer";
import CardControls from "../components/CardControls";
import DeckSelector from "../components/DeckSelector";
import SettingsModal from "../components/SettingsModal";
import { getApiBase, setApiBase } from "../config";

export function DeckView() {
  const { deckName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: decksData, error: decksError } = useSWR(
    "/api/decks",
    fetchDecks,
  );
  const initialCardId = new URLSearchParams(location.search).get("cardId");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newApiBase, setNewApiBase] = useState(getApiBase());
  const [apiError, setApiError] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [, setCurrentTime] = useState(0);
  const [, setDuration] = useState(0);
  const audioRefs = useRef<HTMLAudioElement[]>([]);

  const { data: deckConfig, error: configError } = useSWR(
    deckName ? `/api/decks/${deckName}/config` : null,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    () => fetchDeckConfig(deckName!),
  );

  const {
    data: fetchedCards,
    mutate: mutateCards,
    error: cardsError,
  } = useSWR(
    deckName ? `/api/decks/${deckName}/cards` : null,
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    () => fetchDeckCards(deckName!),
  );

  const cards = useMemo(() => {
    if (!fetchedCards) return null;

    const storedCardIds = JSON.parse(localStorage.getItem("cardIds") || "[]");
    const currentCardIds = fetchedCards.map((card) => card.cardId);

    const areCardIdsEqual =
      storedCardIds.length === currentCardIds.length &&
      storedCardIds.every((id: number) => currentCardIds.includes(id));

    if (!areCardIdsEqual) {
      localStorage.setItem("cardIds", JSON.stringify(currentCardIds));
    }

    return fetchedCards;
  }, [fetchedCards]);

  const [currentCardIndex, setCurrentCardIndex] = useState(
    initialCardId
      ? cards?.findIndex((card) => card.cardId === Number(initialCardId)) || 0
      : 0,
  );

  const {
    data: cardInfo,
    mutate: mutateCardInfo,
    error: cardError,
  } = useSWR(
    cards ? `/api/cards/${cards[currentCardIndex]?.cardId}` : null,
    () => cards && fetchCard(cards[currentCardIndex].cardId),
  );

  const handleDeckSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedDeck = event.target.value;
    if (selectedDeck) {
      navigate(`/decks/${encodeURIComponent(selectedDeck)}`);
    } else {
      navigate("/decks");
      const newCardId = cards[currentCardIndex - 1].cardId;
      navigate(
        `/decks/${
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          encodeURIComponent(deckName!)
        }?cardId=${newCardId}`,
      );
    }
  };

  useEffect(() => {
    if (
      cardInfo &&
      (!cardInfo.audioUrls || cardInfo.audioUrls.length === 0) &&
      !configError
    ) {
      handleRegenerate();
    }
  }, [cardInfo, configError]);

  // Handle API errors and missing deck config
  useEffect(() => {
    // Handle config error separately in the alert block
    if (configError?.message === "Deck configuration not found") {
      return;
    }

    const error = decksError || cardsError || cardError;
    if (error) {
      console.error("API Error:", error);
      setApiError("Failed to fetch data. Please check your API settings.");
      setIsSettingsOpen(true);
    }
  }, [decksError, configError, cardsError, cardError]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    // Reset audio state when card changes
    setIsPlaying(false);
    setCurrentAudioIndex(0);
  }, [currentCardIndex]);

  useEffect(() => {
    const handleAudioEnd = () => {
      if (currentAudioIndex < (cardInfo?.audioUrls?.length || 0) - 1) {
        setCurrentAudioIndex((prev) => prev + 1);
        audioRefs.current[currentAudioIndex + 1]?.play();
      } else {
        setIsPlaying(false);
        setCurrentAudioIndex(0);
      }
    };

    const handleTimeUpdate = (audio: HTMLAudioElement) => {
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration);
    };

    for (const audio of audioRefs.current) {
      if (audio) {
        audio.addEventListener("ended", handleAudioEnd);
        audio.addEventListener("timeupdate", () => handleTimeUpdate(audio));
      }
    }

    return () => {
      for (const audio of audioRefs.current) {
        if (audio) {
          audio.removeEventListener("ended", handleAudioEnd);
          audio.removeEventListener("timeupdate", () =>
            handleTimeUpdate(audio),
          );
        }
      }
    };
  }, [currentAudioIndex, cardInfo?.audioUrls]);

  const handleNextCard = async () => {
    if (cards && currentCardIndex < cards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
    }
  };

  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
    }
  };

  const handleAnswer = async (ease: number) => {
    if (!cards || cards.length === 0) return;

    try {
      await answerCard(cards[currentCardIndex].cardId, { ease });
      handleNextCard();
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setApiError("Failed to submit answer. Please check your API settings.");
      setIsSettingsOpen(true);
    }
  };

  const handleRegenerate = async () => {
    if (!cards || cards.length === 0 || isRegenerating) return;

    try {
      setIsRegenerating(true);
      await regenerateCard(cards[currentCardIndex].cardId);
      await Promise.all([mutateCardInfo(), mutateCards()]);
    } catch (err) {
      console.error("Failed to regenerate card:", err);
      // Don't show API settings modal if we already know it's a config issue
      if (configError?.message === "Deck configuration not found") {
        setApiError(
          "This deck is missing configuration. Please set up the deck configuration in your config file or choose another deck.",
        );
        setIsSettingsOpen(false);
      } else {
        setApiError(
          "Failed to regenerate card. Please check your API settings.",
        );
        setIsSettingsOpen(true);
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSync = async () => {
    try {
      await sync();
      console.log("Sync successful");
    } catch (err) {
      console.error("Sync failed:", err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 bg-white dark:bg-gray-800 shadow-md rounded-lg dark:text-gray-100">
      {configError?.message === "Deck configuration not found" && (
        <div className="mb-4 p-4 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
          <p className="font-bold">Configuration Missing</p>
          <p>
            This deck is missing configuration. Please add a configuration for
            this deck in your ~/.gakuon/config.toml file or choose another deck.
            Check the{" "}
            <a
              href="https://github.com/Yukaii/gakuon?tab=readme-ov-file#configuration"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yellow-800 underline hover:text-yellow-900"
            >
              configuration documentation
            </a>{" "}
            for examples.
          </p>
        </div>
      )}

      <DeckSelector
        decks={decksData?.decks || []}
        selectedDeck={deckName}
        onSelect={handleDeckSelect}
      />

      {cards && cards.length > 0 && !configError && (
        <div className="grid gap-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg shadow-inner">
          <h2 className="text-xl font-bold">Due Cards ({cards.length})</h2>
          <div className="card p-2 sm:p-4 border dark:border-gray-600 rounded mb-4 bg-gray-100 dark:bg-gray-800 shadow overflow-hidden">
            <h2 className="font-bold">
              Card #{cards[currentCardIndex].cardId}
            </h2>

            {/* Generated content */}

            {deckConfig && cardInfo && cardInfo?.audioUrls?.length > 0 && (
              <>
                <div className="mb-4">
                  <details>
                    <summary className="font-bold">Generated Content</summary>
                    {Object.entries(deckConfig.config.responseFields).map(
                      ([field, config]) => (
                        <div key={field} className="mb-2">
                          <strong>{field}:</strong>{" "}
                          {cardInfo?.content?.[field] || "(Not generated)"}
                        </div>
                      ),
                    )}
                  </details>
                </div>

                <AudioPlayer
                  audioUrls={cardInfo.audioUrls}
                  isPlaying={isPlaying}
                  setIsPlaying={setIsPlaying}
                  currentAudioIndex={currentAudioIndex}
                  setCurrentAudioIndex={setCurrentAudioIndex}
                />
              </>
            )}

            <CardControls
              onPrevious={handlePreviousCard}
              onNext={handleNextCard}
              onRegenerate={handleRegenerate}
              isFirst={currentCardIndex === 0}
              isLast={currentCardIndex === cards.length - 1}
              isRegenerating={isRegenerating}
            />
            <AnswerButtons onAnswer={handleAnswer} />
          </div>
        </div>
      )}

      <button
        onClick={() => setIsSettingsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-500 text-white p-2 rounded-full hover:bg-gray-600 transition"
        title="Settings"
        type="button"
      >
        <Gear size={24} weight="bold" />
      </button>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        apiBase={newApiBase}
        onApiBaseChange={(value) => setNewApiBase(value)}
        onReset={() => setApiBase(null)}
        onSync={handleSync}
        errorMessage={apiError}
        onSave={() => {
          if (newApiBase !== getApiBase()) {
            setApiBase(newApiBase);
          }
          setApiError(undefined);
          setIsSettingsOpen(false);
        }}
      />
    </div>
  );
}
