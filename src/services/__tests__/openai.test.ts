import { OpenAIService } from '../openai';
import { Card, DeckConfig, PromptError, AudioGenerationError, TtsMethod } from '../../config/types';

// Mock OpenAI module
jest.mock('openai', () => {
  // Create a mock constructor
  const mockOpenAIConstructor = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
    audio: {
      speech: {
        create: jest.fn(),
      },
    },
  }));
  
  return mockOpenAIConstructor;
});

// Mock fs/promises to avoid actual file writes
jest.mock('node:fs/promises', () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

// Mock EdgeSpeechTTS
jest.mock('@lobehub/tts', () => ({
  EdgeSpeechTTS: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({
      arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
    }),
  })),
}));

describe('OpenAIService', () => {
  let openaiService: OpenAIService;
  const mockApiKey = 'test-api-key';
  
  beforeEach(() => {
    openaiService = new OpenAIService(mockApiKey, 'https://test.openai.api', 'gpt-test', 'tts-test');
    jest.clearAllMocks();
  });
  
  describe('constructor', () => {
    it('should initialize with the provided parameters', () => {
      expect(openaiService).toBeInstanceOf(OpenAIService);
      expect(openaiService['apiKey']).toBe(mockApiKey);
      expect(openaiService['baseUrl']).toBe('https://test.openai.api');
      expect(openaiService['chatModel']).toBe('gpt-test');
      expect(openaiService['ttsModel']).toBe('tts-test');
    });
  });
  
  describe('validateFields', () => {
    it('should validate that all required fields are present', () => {
      const card: Card = {
        cardId: 1,
        note: 1,
        fields: {
          Word: { value: 'test', order: 0 },
          Definition: { value: 'a test', order: 1 },
        },
        modelName: 'Test',
        deckName: 'Test',
        queue: 0,
        due: 0,
        interval: 0,
        factor: 0,
        reps: 0,
        lapses: 0,
      };
      
      const deckConfig: DeckConfig = {
        name: 'Test Deck',
        pattern: 'Test',
        prompt: 'Create a sentence with the word ${word}',
        fields: {
          word: 'Word',
        },
        responseFields: {
          sentence: {
            description: 'A sentence',
            required: true,
          },
        },
      };
      
      // Should not throw an error
      expect(() => openaiService['validateFields'](card, deckConfig)).not.toThrow();
    });
    
    it('should throw an error when fields are missing from the card', () => {
      const card: Card = {
        cardId: 1,
        note: 1,
        fields: {
          // Missing 'Word' field
          Definition: { value: 'a test', order: 1 },
        },
        modelName: 'Test',
        deckName: 'Test',
        queue: 0,
        due: 0,
        interval: 0,
        factor: 0,
        reps: 0,
        lapses: 0,
      };
      
      const deckConfig: DeckConfig = {
        name: 'Test Deck',
        pattern: 'Test',
        prompt: 'Create a sentence with the word ${word}',
        fields: {
          word: 'Word',
        },
        responseFields: {
          sentence: {
            description: 'A sentence',
            required: true,
          },
        },
      };
      
      expect(() => openaiService['validateFields'](card, deckConfig)).toThrow(PromptError);
    });
    
    it('should throw an error when field mappings are invalid', () => {
      const card: Card = {
        cardId: 1,
        note: 1,
        fields: {
          Word: { value: 'test', order: 0 },
        },
        modelName: 'Test',
        deckName: 'Test',
        queue: 0,
        due: 0,
        interval: 0,
        factor: 0,
        reps: 0,
        lapses: 0,
      };
      
      const deckConfig: DeckConfig = {
        name: 'Test Deck',
        pattern: 'Test',
        prompt: 'Create a sentence with the word ${word} and ${nonExistentField}',
        fields: {
          word: 'Word',
          // Missing mapping for nonExistentField
        },
        responseFields: {
          sentence: {
            description: 'A sentence',
            required: true,
          },
        },
      };
      
      expect(() => openaiService['validateFields'](card, deckConfig)).toThrow(PromptError);
    });
  });
  
  describe('generateContent', () => {
    const mockCard: Card = {
      cardId: 1,
      note: 1,
      fields: {
        Word: { value: 'test', order: 0 },
      },
      modelName: 'Test',
      deckName: 'Test',
      queue: 0,
      due: 0,
      interval: 0,
      factor: 0,
      reps: 0,
      lapses: 0,
    };
    
    const mockDeckConfig: DeckConfig = {
      name: 'Test Deck',
      pattern: 'Test',
      prompt: 'Create a sentence with the word ${word}',
      fields: {
        word: 'Word',
      },
      responseFields: {
        sentence: {
          description: 'A sentence',
          required: true,
        },
      },
    };
    
    it('should generate content successfully', async () => {
      // Setup OpenAI mock response
      const mockResponse = { 
        choices: [
          { 
            message: { 
              content: JSON.stringify({ sentence: 'This is a test sentence.' }) 
            } 
          }
        ] 
      };
      
      openaiService.client.chat.completions.create = jest.fn().mockResolvedValue(mockResponse);
      
      const result = await openaiService.generateContent(mockCard, mockDeckConfig);
      
      expect(result).toEqual({ sentence: 'This is a test sentence.' });
      expect(openaiService.client.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-test',
          messages: expect.any(Array),
          response_format: { type: 'json_object' },
        })
      );
    });
    
    it('should throw PromptError when field validation fails', async () => {
      const invalidCard: Card = {
        ...mockCard,
        fields: {}, // Empty fields will cause validation to fail
      };
      
      await expect(openaiService.generateContent(invalidCard, mockDeckConfig))
        .rejects
        .toThrow(PromptError);
    });
    
    it('should retry up to max attempts when required fields are missing', async () => {
      // Setup OpenAI mock responses - all missing the required 'sentence' field
      const mockIncompleteResponse = { 
        choices: [{ message: { content: JSON.stringify({ other: 'Not the required field' }) } }]
      };
      
      openaiService.client.chat.completions.create = jest.fn()
        .mockResolvedValue(mockIncompleteResponse);
      
      await expect(openaiService.generateContent(mockCard, mockDeckConfig))
        .rejects
        .toThrow(AudioGenerationError);
      
      // Should have tried 5 times (MAX_ATTEMPTS)
      expect(openaiService.client.chat.completions.create).toHaveBeenCalledTimes(5);
    });
    
    it('should throw AudioGenerationError on OpenAI API error', async () => {
      openaiService.client.chat.completions.create = jest.fn()
        .mockRejectedValue(new Error('OpenAI API error'));
      
      await expect(openaiService.generateContent(mockCard, mockDeckConfig))
        .rejects
        .toThrow(AudioGenerationError);
    });
  });
  
  describe('generateAudio', () => {
    it('should generate audio using OpenAI TTS', async () => {
      const mockAudioBuffer = {
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
      };
      
      openaiService.client.audio.speech.create = jest.fn().mockResolvedValue(mockAudioBuffer);
      
      const result = await openaiService.generateAudio(
        'Test text',
        '/path/to/output.mp3',
        'alloy'
      );
      
      expect(result).toBe('/path/to/output.mp3');
      expect(openaiService.client.audio.speech.create).toHaveBeenCalledWith({
        model: 'tts-test',
        voice: 'alloy',
        input: 'Test text',
      });
    });
    
    it('should generate audio using EdgeSpeechTTS when ttsMethod is EDGE_TTS', async () => {
      const edgeTTSService = new OpenAIService(
        mockApiKey,
        'https://test.openai.api',
        'gpt-test',
        'tts-test',
        TtsMethod.EDGE_TTS
      );
      
      const result = await edgeTTSService.generateAudio(
        'Test text',
        '/path/to/output.mp3',
        'alloy'
      );
      
      expect(result).toBe('/path/to/output.mp3');
      // OpenAI TTS should not be called
      expect(edgeTTSService.client.audio.speech.create).not.toHaveBeenCalled();
    });
    
    it('should throw AudioGenerationError on TTS failure', async () => {
      openaiService.client.audio.speech.create = jest.fn()
        .mockRejectedValue(new Error('TTS error'));
      
      await expect(openaiService.generateAudio(
        'Test text',
        '/path/to/output.mp3',
        'alloy'
      ))
        .rejects
        .toThrow(AudioGenerationError);
    });
  });
});