import { useState, useEffect, useRef } from "react";
import { SkipBack, SkipForward, Pause, Play } from "@phosphor-icons/react";
import { getApiBase } from "../config";

export interface AudioPlayerProps {
  audioUrls: string[];
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  currentAudioIndex: number;
  setCurrentAudioIndex: (index: number) => void;
}

export default function AudioPlayer({
  audioUrls,
  isPlaying,
  setIsPlaying,
  currentAudioIndex,
  setCurrentAudioIndex,
}: AudioPlayerProps) {
  const audioRefs = useRef<HTMLAudioElement[]>([]);
  const progressBarRef = useRef<HTMLButtonElement>(null);
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
  }, [currentAudioIndex, audioUrls.length, setCurrentAudioIndex, setIsPlaying]);

  const handleProgressBarClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
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

        <button
          ref={progressBarRef}
          className="h-2 bg-white/20 dark:bg-gray-600 rounded-full cursor-pointer relative"
          onClick={handleProgressBarClick}
          style={{ background: "none", border: "none", padding: 0 }}
          type="button"
        >
          <div
            className="absolute h-full bg-white/50 dark:bg-blue-500 rounded-full"
            style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </button>

        <div className="flex justify-center items-center gap-4">
          <button
            type="button"
            onClick={() => {
              if (currentAudioIndex > 0) {
                audioRefs.current[currentAudioIndex]?.pause();
                setCurrentAudioIndex(currentAudioIndex - 1);
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
            type="button"
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
            type="button"
            onClick={() => {
              if (currentAudioIndex < audioUrls.length - 1) {
                audioRefs.current[currentAudioIndex]?.pause();
                setCurrentAudioIndex(currentAudioIndex + 1);
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
          <track default kind="captions" label="Captions" srcLang="en" src="" />
        </audio>
      ))}
    </div>
  );
}
