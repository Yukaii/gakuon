import { ArrowCounterClockwise, Warning, Check, Star } from "@phosphor-icons/react";

export interface AnswerButtonsProps {
  onAnswer: (ease: number) => void;
}

export default function AnswerButtons({ onAnswer }: AnswerButtonsProps) {
  const answers = [
    { ease: 1, label: "Again", icon: <ArrowCounterClockwise size={24} />, color: "red" },
    { ease: 2, label: "Hard", icon: <Warning size={24} />, color: "yellow" },
    { ease: 3, label: "Good", icon: <Check size={24} />, color: "green" },
    { ease: 4, label: "Easy", icon: <Star size={24} />, color: "blue" },
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
