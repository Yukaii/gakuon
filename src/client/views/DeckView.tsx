import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo, useRef } from "react";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward,
  ArrowLeft,
  ArrowRight,
  ArrowCounterClockwise
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

const API_BASE = "http://localhost:4989";

export function DeckView() {
  const { deckName } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: decksData } = useSWR("/api/decks", fetchDecks);
  const initialCardId = new URLSearchParams(location.search).get("cardId");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const { data: deckConfig } = useSWR(
    deckName ? `/api/decks/${deckName}/config` : null,
    () => fetchDeckConfig(deckName!),
  );

  const { data: fetchedCards, mutate: mutateCards } = useSWR(
    deckName ? `/api/decks/${deckName}/cards` : null,
    () => fetchDeckCards(deckName!),
  );

  const cards = useMemo(() => {
    if (!fetchedCards) return null;

    const storedCardIds = JSON.parse(localStorage.getItem("cardIds") || "[]");
    const currentCardIds = fetchedCards.map((card) => card.cardId);

    const areCardIdsEqual =
      storedCardIds.length === currentCardIds.length &&
      storedCardIds.every((id) => currentCardIds.includes(id));

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

  const { data: cardInfo, mutate: mutateCardInfo } = useSWR(
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
      navigate(`/decks/${encodeURIComponent(deckName!)}?cardId=${newCardId}`);
    }
  };

  useEffect(() => {
    if (cardInfo && (!cardInfo.audioUrls || cardInfo.audioUrls.length === 0)) {
      handleRegenerate();
    }
  }, [cardInfo]);

  useEffect(() => {
    // Reset audio state when card changes
    setIsPlaying(false);
    setCurrentAudioIndex(0);
  }, [currentCardIndex]);

  useEffect(() => {
    const handleAudioEnd = () => {
      if (currentAudioIndex < (cardInfo?.audioUrls?.length || 0) - 1) {
        setCurrentAudioIndex(prev => prev + 1);
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

    audioRefs.current.forEach(audio => {
      if (audio) {
        audio.addEventListener('ended', handleAudioEnd);
        audio.addEventListener('timeupdate', () => handleTimeUpdate(audio));
      }
    });

    return () => {
      audioRefs.current.forEach(audio => {
        if (audio) {
          audio.removeEventListener('ended', handleAudioEnd);
          audio.removeEventListener('timeupdate', () => handleTimeUpdate(audio));
        }
      });
    };
  }, [currentAudioIndex, cardInfo?.audioUrls]);

  const handleProgressBarClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = progressBarRef.current;
    if (!progressBar || !audioRefs.current[currentAudioIndex]) return;

    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (event.clientX - rect.left) / rect.width;
    const newTime = clickPosition * audioRefs.current[currentAudioIndex].duration;
    
    audioRefs.current[currentAudioIndex].currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!cardInfo?.audioUrls?.length) return;

    if (isPlaying) {
      audioRefs.current[currentAudioIndex]?.pause();
      setIsPlaying(false);
    } else {
      audioRefs.current[currentAudioIndex]?.play();
      setIsPlaying(true);
    }
  };

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
    } finally {
      setIsRegenerating(false);
    }
  };
  return (
    <div className="max-w-2xl mx-auto p-4 bg-white shadow-md rounded-lg">
      <select
        value={deckName || ""}
        onChange={handleDeckSelect}
        className="w-full p-2 mb-4 border rounded bg-gray-100"
      >
        <option value="">Select a deck</option>
        {decksData?.decks.map((deck) => (
          <option key={deck} value={deck}>
            {deck}
          </option>
        ))}
      </select>

      {cards && cards.length > 0 && (
        <div className="grid gap-4 bg-gray-50 p-4 rounded-lg shadow-inner">
          <h2 className="text-xl font-bold">Due Cards ({cards.length})</h2>
          <div className="card p-4 border rounded mb-4 bg-gray-100 shadow">
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

                <div className="mb-4 bg-gray-800 p-4 rounded-lg text-white">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          Track {currentAudioIndex + 1}/{cardInfo.audioUrls.length}
                        </span>
                      </div>
                      <div className="text-sm">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                    </div>

                    <div 
                      ref={progressBarRef}
                      className="h-2 bg-gray-600 rounded-full cursor-pointer relative"
                      onClick={handleProgressBarClick}
                    >
                      <div 
                        className="absolute h-full bg-blue-500 rounded-full"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      />
                    </div>

                    <div className="flex justify-center items-center gap-4">
                      <button
                        onClick={() => {
                          if (currentAudioIndex > 0) {
                            setCurrentAudioIndex(prev => prev - 1);
                            setIsPlaying(true);
                            audioRefs.current[currentAudioIndex - 1]?.play();
                          }
                        }}
                        className="text-white hover:text-blue-400 transition"
                        disabled={currentAudioIndex === 0}
                        title="Previous Track"
                      >
                        <SkipBack size={24} weight="fill" />
                      </button>
                      <button
                        onClick={handlePlayPause}
                        className="w-12 h-12 flex items-center justify-center bg-blue-500 rounded-full hover:bg-blue-600 transition transform hover:scale-105"
                        title={isPlaying ? "Pause" : "Play"}
                      >
                        {isPlaying ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" />}
                      </button>
                      <button
                        onClick={() => {
                          if (currentAudioIndex < cardInfo.audioUrls.length - 1) {
                            setCurrentAudioIndex(prev => prev + 1);
                            setIsPlaying(true);
                            audioRefs.current[currentAudioIndex + 1]?.play();
                          }
                        }}
                        className="text-white hover:text-blue-400 transition"
                        disabled={currentAudioIndex === cardInfo.audioUrls.length - 1}
                        title="Next Track"
                      >
                        <SkipForward size={24} weight="fill" />
                      </button>
                    </div>
                  </div>

                  {cardInfo.audioUrls.map((url, index) => (
                    <audio
                      key={index}
                      ref={el => {
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
                        src={`${API_BASE}/api/audio/${url.replace("[sound:", "").replace("]", "")}`}
                      />
                    </audio>
                  ))}
                </div>
              </>
            )}

            <div className="flex gap-2 justify-between items-center mt-4">
              <button
                type="button"
                onClick={handlePreviousCard}
                disabled={currentCardIndex === 0}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
                title="Previous Card"
              >
                <ArrowLeft size={20} weight="bold" className="mr-1" />
                Previous
              </button>
              <button
                type="button"
                onClick={handleNextCard}
                disabled={currentCardIndex === cards.length - 1}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition"
                title="Next Card"
              >
                Next
                <ArrowRight size={20} weight="bold" className="ml-1" />
              </button>
            </div>
            <div className="flex gap-2 mt-4 justify-center">
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
                  className={`${
                    color === "red"
                      ? "bg-red-500 hover:bg-red-600"
                      : color === "yellow"
                        ? "bg-yellow-500 hover:bg-yellow-600"
                        : color === "green"
                          ? "bg-green-500 hover:bg-green-600"
                          : "bg-blue-500 hover:bg-blue-600"
                  } text-white px-4 py-2 rounded-full shadow-md transition transform hover:scale-105`}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className={`mt-4 ${
                isRegenerating ? "bg-gray-300" : "bg-gray-500"
              } text-white px-4 py-2 rounded-full shadow-md hover:bg-gray-600 transition transform hover:scale-105`}
              title="Regenerate card content and audio"
            >
              <div className="flex items-center justify-center gap-2">
                <ArrowCounterClockwise size={20} weight="bold" />
                {isRegenerating ? "Regenerating..." : "Regenerate"}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
