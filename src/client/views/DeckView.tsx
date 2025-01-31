import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ArrowLeft,
  ArrowRight,
  ArrowCounterClockwise,
  Gear,
} from "@phosphor-icons/react";
import useSWR from "swr";
import {
  fetchDeckConfig,
  fetchDecks,
  fetchDeckCards,
  fetchCard,
  answerCard,
  regenerateCard,
} from "../api";

import { getApiBase, setApiBase, getDefaultApiBase } from "../config";

interface AudioPlayerProps {
  audioUrls: string[];
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  currentAudioIndex: number;
  setCurrentAudioIndex: (index: number) => void;
}

function AudioPlayer({
  audioUrls,
  isPlaying,
  setIsPlaying,
  currentAudioIndex,
  setCurrentAudioIndex,
}: AudioPlayerProps) {
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const handleAudioEnd = () => {
      if (currentAudioIndex < audioUrls.length - 1) {
        setCurrentAudioIndex(currentAudioIndex + 1);
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

    audioRefs.current.forEach((audio) => {
      if (audio) {
        audio.addEventListener("ended", handleAudioEnd);
        audio.addEventListener("timeupdate", () => handleTimeUpdate(audio));
      }
    });

    return () => {
      audioRefs.current.forEach((audio) => {
        if (audio) {
          audio.removeEventListener("ended", handleAudioEnd);
          audio.removeEventListener("timeupdate", () =>
            handleTimeUpdate(audio),
          );
        }
      });
    };
  }, [currentAudioIndex, audioUrls.length, setCurrentAudioIndex, setIsPlaying]);

  const handleProgressBarClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = progressBarRef.current;
    if (!progressBar || !audioRefs.current[currentAudioIndex]) return;

    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (event.clientX - rect.left) / rect.width;
    const newTime =
      clickPosition * audioRefs.current[currentAudioIndex].duration;

    audioRefs.current[currentAudioIndex].currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (!audioUrls.length) return;

    if (isPlaying) {
      audioRefs.current[currentAudioIndex]?.pause();
      setIsPlaying(false);
    } else {
      audioRefs.current[currentAudioIndex]?.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="mb-4 bg-blue-600 dark:bg-gray-800 p-4 rounded-lg text-white">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">
              Track {currentAudioIndex + 1}/{audioUrls.length}
            </span>
          </div>
          <div className="text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>

        <div
          ref={progressBarRef}
          className="h-2 bg-white/20 dark:bg-gray-600 rounded-full cursor-pointer relative"
          onClick={handleProgressBarClick}
        >
          <div
            className="absolute h-full bg-white/50 dark:bg-blue-500 rounded-full"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>

        <div className="flex justify-center items-center gap-4">
          <button
            onClick={() => {
              if (currentAudioIndex > 0) {
                // Pause current audio
                audioRefs.current[currentAudioIndex]?.pause();
                setCurrentAudioIndex(currentAudioIndex - 1);
                // Reset current time of the new audio
                audioRefs.current[currentAudioIndex - 1].currentTime = 0;
                if (isPlaying) {
                  audioRefs.current[currentAudioIndex - 1]?.play();
                }
              }
            }}
            className="text-white hover:text-white/70 dark:hover:text-blue-400 transition"
            disabled={currentAudioIndex === 0}
            title="Previous Track"
          >
            <SkipBack size={24} weight="fill" />
          </button>
          <button
            onClick={handlePlayPause}
            className="w-12 h-12 flex items-center justify-center bg-white/25 dark:bg-blue-500 rounded-full hover:bg-white/40 dark:hover:bg-blue-600 transition transform hover:scale-105"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={24} weight="fill" />
            ) : (
              <Play size={24} weight="fill" />
            )}
          </button>
          <button
            onClick={() => {
              if (currentAudioIndex < audioUrls.length - 1) {
                // Pause current audio
                audioRefs.current[currentAudioIndex]?.pause();
                setCurrentAudioIndex(currentAudioIndex + 1);
                // Reset current time of the new audio
                audioRefs.current[currentAudioIndex + 1].currentTime = 0;
                if (isPlaying) {
                  audioRefs.current[currentAudioIndex + 1]?.play();
                }
              }
            }}
            className="text-white hover:text-blue-400 transition"
            disabled={currentAudioIndex === audioUrls.length - 1}
            title="Next Track"
          >
            <SkipForward size={24} weight="fill" />
          </button>
        </div>
      </div>

      {audioUrls.map((url, index) => (
        <audio
          key={url}
          ref={(el) => {
            if (el) audioRefs.current[index] = el;
          }}
          className="hidden"
          onCanPlay={() => {
            if (index === 0 && !isPlaying) {
              handlePlayPause();
            }
          }}
        >
          <source
            src={`${getApiBase()}/audio/${url.replace("[sound:", "").replace("]", "")}`}
          />
        </audio>
      ))}
    </div>
  );
}

interface DeckSelectorProps {
  decks: string[];
  selectedDeck: string | undefined;
  onSelect: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

function DeckSelector({ decks, selectedDeck, onSelect }: DeckSelectorProps) {
  return (
    <select
      value={selectedDeck || ""}
      onChange={onSelect}
      className="w-full p-2 mb-4 border rounded bg-gray-100 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
    >
      <option value="">Select a deck</option>
      {decks?.map((deck) => (
        <option key={deck} value={deck}>
          {deck}
        </option>
      ))}
    </select>
  );
}

interface CardControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  onRegenerate: () => void;
  isFirst: boolean;
  isLast: boolean;
  isRegenerating: boolean;
}

function CardControls({
  onPrevious,
  onNext,
  onRegenerate,
  isFirst,
  isLast,
  isRegenerating,
}: CardControlsProps) {
  return (
    <div className="flex gap-2 justify-center items-center mt-4">
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirst}
        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
        title="Previous Card"
      >
        <ArrowLeft size={20} weight="bold" />
      </button>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={isRegenerating}
        className={`${
          isRegenerating ? "bg-gray-300" : "bg-gray-500"
        } text-white p-2 rounded hover:bg-gray-600 transition transform hover:scale-105`}
        title="Regenerate card content and audio"
      >
        <ArrowCounterClockwise size={20} weight="bold" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={isLast}
        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
        title="Next Card"
      >
        <ArrowRight size={20} weight="bold" />
      </button>
    </div>
  );
}

interface AnswerButtonsProps {
  onAnswer: (ease: number) => void;
}

function AnswerButtons({ onAnswer }: AnswerButtonsProps) {
  const answers = [
    { ease: 1, label: "Again", icon: "↻", color: "red" },
    { ease: 2, label: "Hard", icon: "⚠", color: "yellow" },
    { ease: 3, label: "Good", icon: "✓", color: "green" },
    { ease: 4, label: "Easy", icon: "⭐", color: "blue" },
  ];

  return (
    <div className="flex gap-2 mt-4 justify-center">
      {answers.map(({ ease, label, icon, color }) => (
        <button
          key={ease}
          type="button"
          onClick={() => onAnswer(ease)}
          className={`${
            color === "red"
              ? "bg-red-500 hover:bg-red-600"
              : color === "yellow"
                ? "bg-yellow-500 hover:bg-yellow-600"
                : color === "green"
                  ? "bg-green-500 hover:bg-green-600"
                  : "bg-blue-500 hover:bg-blue-600"
          } text-white px-3 sm:px-4 py-2 rounded-full shadow-md transition transform hover:scale-105 min-w-[40px] sm:min-w-fit`}
          title={label}
        >
          <span className="block sm:hidden">{icon}</span>
          <span className="hidden sm:block">{label}</span>
        </button>
      ))}
    </div>
  );
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBase: string;
  onApiBaseChange: (value: string) => void;
  onReset: () => void;
  onSave: () => void;
  errorMessage?: string;
}

function SettingsModal({
  isOpen,
  onClose,
  apiBase,
  onApiBaseChange,
  onReset,
  onSave,
  errorMessage,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
        <h2 className="text-xl font-bold mb-4 dark:text-white">Settings</h2>
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {errorMessage}
          </div>
        )}

        <div className="mb-4">
          <div className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            API Base URL
          </div>
          <input
            type="text"
            value={apiBase}
            onChange={(e) => onApiBaseChange(e.target.value)}
            placeholder={getDefaultApiBase()}
            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            type="button"
          >
            Reset to Default
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            type="button"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

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

      {/* Settings Button */}
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
