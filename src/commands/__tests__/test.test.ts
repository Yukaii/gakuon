import { test } from '../test';
import { AnkiService } from '../../services/anki';
import { OpenAIService } from '../../services/openai';
import { loadConfig, findDeckConfig } from '../../config/loader';
import type { Card } from '../../config/types';
import Enquirer from 'enquirer';

// Mock dependencies
jest.mock('../../services/anki', () => ({
  AnkiService: jest.fn().mockImplementation(() => ({
    findCards: jest.fn().mockResolvedValue([1, 2, 3, 4, 5]),
    getCardsInfo: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../../services/openai', () => ({
  OpenAIService: jest.fn().mockImplementation(() => ({
    generateContent: jest.fn().mockResolvedValue({
      sentence: 'This is a test sentence.',
    }),
  })),
}));

jest.mock('../../config/loader', () => ({
  loadConfig: jest.fn().mockReturnValue({
    global: {
      ankiHost: 'http://localhost:8765',
      openaiApiKey: 'test-key',
      ttsVoice: 'test-voice',
      openai: {
        baseUrl: 'https://api.test.com',
        chatModel: 'gpt-test',
        initModel: 'gpt-test-init',
        ttsModel: 'tts-test',
      },
    },
    decks: [
      {
        name: 'Test Deck',
        pattern: 'Test Deck',
        prompt: 'test prompt',
        fields: { front: 'Front' },
        responseFields: {
          sentence: {
            description: 'A sentence',
            required: true,
          },
        },
      },
    ],
  }),
  findDeckConfig: jest.fn().mockImplementation((deckName, decks) => {
    return decks.find(d => d.name === deckName || d.pattern === deckName);
  }),
}));

jest.mock('enquirer', () => ({
  prompt: jest.fn(),
}));

describe('test command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn();
    console.error = jest.fn();
  });

  it('should fail gracefully when no decks are available', async () => {
    (AnkiService as jest.Mock).mockImplementation(() => ({
      getDeckNames: jest.fn().mockResolvedValue([]),
    }));

    await test();

    expect(console.error).toHaveBeenCalled();
  });

  it('should prompt for deck selection when multiple decks are available', async () => {
    const mockDeckNames = ['Test Deck', 'Another Deck'];
    (AnkiService as jest.Mock).mockImplementation(() => ({
      getDeckNames: jest.fn().mockResolvedValue(mockDeckNames),
      findCards: jest.fn().mockResolvedValue([1, 2, 3]),
      getCardsInfo: jest.fn().mockResolvedValue([]),
    }));

    (Enquirer.prompt as jest.Mock).mockResolvedValue({ deckName: 'Test Deck' });

    await test();

    expect(Enquirer.prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'select',
        name: 'deckName',
        message: 'Select a deck to test:',
        choices: mockDeckNames,
      }),
    );
  });

  it('should use the provided deck option when available', async () => {
    const ankiServiceMock = {
      getDeckNames: jest.fn().mockResolvedValue(['Test Deck', 'Another Deck']),
      findCards: jest.fn().mockResolvedValue([1, 2, 3]),
      getCardsInfo: jest.fn().mockResolvedValue([]),
    };
    (AnkiService as jest.Mock).mockImplementation(() => ankiServiceMock);

    await test({ deck: 'Test Deck' });

    // Should not prompt for deck selection
    expect(Enquirer.prompt).not.toHaveBeenCalled();
    // Should directly use the provided deck
    expect(ankiServiceMock.findCards).toHaveBeenCalledWith('Test Deck');
  });

  it('should handle missing deck configuration', async () => {
    (AnkiService as jest.Mock).mockImplementation(() => ({
      getDeckNames: jest.fn().mockResolvedValue(['Unknown Deck']),
    }));

    (findDeckConfig as jest.Mock).mockReturnValue(undefined);

    (Enquirer.prompt as jest.Mock).mockResolvedValue({ deckName: 'Unknown Deck' });

    await test();

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('No configuration found for deck'),
    );
  });

  it('should test a sample of cards when configuration is found', async () => {
    // Mock a sample card
    const mockCard: Card = {
      cardId: 1,
      note: 1,
      deckName: 'Test Deck',
      modelName: 'Basic',
      fields: {
        Front: { value: 'Test Front', order: 0 },
        Back: { value: 'Test Back', order: 1 },
      },
      queue: 0,
      due: 0,
      interval: 0,
      factor: 0,
      reps: 0,
      lapses: 0,
    };

    // Reset findDeckConfig mock to return a configuration
    (findDeckConfig as jest.Mock).mockReturnValue({
      name: 'Test Deck',
      pattern: 'Test Deck',
      prompt: 'test prompt',
      fields: { front: 'Front' },
      responseFields: {
        sentence: {
          description: 'A sentence',
          required: true,
        },
      },
    });

    const ankiServiceMock = {
      getDeckNames: jest.fn().mockResolvedValue(['Test Deck']),
      findCards: jest.fn().mockResolvedValue([1, 2, 3, 4, 5]),
      getCardsInfo: jest.fn().mockResolvedValue([mockCard]),
    };
    (AnkiService as jest.Mock).mockImplementation(() => ankiServiceMock);

    const openaiServiceMock = {
      generateContent: jest.fn().mockResolvedValue({
        sentence: 'This is a test sentence.',
      }),
    };
    (OpenAIService as jest.Mock).mockImplementation(() => openaiServiceMock);

    // For multiple cards, mock the prompt for continuation
    (Enquirer.prompt as jest.Mock).mockResolvedValue({ 
      deckName: 'Test Deck', 
      continue: false  // Stop after first card to avoid infinite loop
    });

    // Use a custom sample size
    await test({ samples: '1' });

    // Should have called getCardsInfo with random indices
    expect(ankiServiceMock.getCardsInfo).toHaveBeenCalled();
    // Should have called generateContent
    expect(openaiServiceMock.generateContent).toHaveBeenCalled();
  });

  it('should handle errors during testing', async () => {
    (AnkiService as jest.Mock).mockImplementation(() => {
      throw new Error('Anki connection failed');
    });

    await test();

    expect(console.error).toHaveBeenCalledWith(
      'Error during testing:',
      expect.any(Error),
    );
  });

  it('should handle errors during content generation', async () => {
    // Ensure findDeckConfig returns a configuration
    (findDeckConfig as jest.Mock).mockReturnValue({
      name: 'Test Deck',
      pattern: 'Test Deck',
      prompt: 'test prompt',
      fields: { front: 'Front' },
      responseFields: {
        sentence: {
          description: 'A sentence',
          required: true,
        },
      },
    });

    const mockCard: Card = {
      cardId: 1,
      note: 1,
      deckName: 'Test Deck',
      modelName: 'Basic',
      fields: {
        Front: { value: 'Test Front', order: 0 },
      },
      queue: 0,
      due: 0,
      interval: 0,
      factor: 0,
      reps: 0,
      lapses: 0,
    };

    const ankiServiceMock = {
      getDeckNames: jest.fn().mockResolvedValue(['Test Deck']),
      findCards: jest.fn().mockResolvedValue([1]),
      getCardsInfo: jest.fn().mockResolvedValue([mockCard]),
    };
    (AnkiService as jest.Mock).mockImplementation(() => ankiServiceMock);

    const openaiServiceMock = {
      generateContent: jest.fn().mockRejectedValue(new Error('OpenAI API error')),
    };
    (OpenAIService as jest.Mock).mockImplementation(() => openaiServiceMock);

    (Enquirer.prompt as jest.Mock).mockResolvedValue({ 
      deckName: 'Test Deck',
      continue: false
    });

    await test({ samples: '1' });

    expect(console.error).toHaveBeenCalled();
    expect(openaiServiceMock.generateContent).toHaveBeenCalled();
  });
});