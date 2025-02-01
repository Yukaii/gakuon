export interface DeckSelectorProps {
  decks: string[];
  selectedDeck: string | undefined;
  onSelect: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}

export default function DeckSelector({
  decks,
  selectedDeck,
  onSelect,
}: DeckSelectorProps) {
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
