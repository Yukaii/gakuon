import {
  ArrowLeft,
  ArrowCounterClockwise,
  ArrowRight,
} from "@phosphor-icons/react";

export interface CardControlsProps {
  onPrevious: () => void;
  onNext: () => void;
  onRegenerate: () => void;
  isFirst: boolean;
  isLast: boolean;
  isRegenerating: boolean;
}

export default function CardControls({
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
