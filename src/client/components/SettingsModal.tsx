import { ArrowClockwise } from "@phosphor-icons/react";
import { getDefaultApiBase } from "../config";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiBase: string;
  onApiBaseChange: (value: string) => void;
  onReset: () => void;
  onSave: () => void;
  onSync: () => void;
  errorMessage?: string;
}

export default function SettingsModal({
  isOpen,
  onClose,
  apiBase,
  onApiBaseChange,
  onReset,
  onSave,
  onSync,
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
            onClick={onSync}
            className="px-4 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            type="button"
            title="Sync Anki"
          >
            <ArrowClockwise size={20} weight="bold" />
          </button>
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
