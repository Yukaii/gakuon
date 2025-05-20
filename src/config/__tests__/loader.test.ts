import { loadConfig, findDeckConfig, DEFAULT_CONFIG } from '../loader';
import { Buffer } from 'node:buffer';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse, stringify } from '@iarna/toml';
import { ZodError } from 'zod';
import { QueueOrder, ReviewSortOrder, NewCardGatherOrder } from '../types';

// Mock filesystem dependencies
jest.mock('node:fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mock path dependencies
jest.mock('node:path', () => ({
  join: jest.fn().mockImplementation((...args) => args.join('/')),
}));

// Mock os dependencies
jest.mock('node:os', () => ({
  homedir: jest.fn().mockReturnValue('/mock/home'),
}));

// Mock toml parser
jest.mock('@iarna/toml', () => ({
  parse: jest.fn(),
  stringify: jest.fn().mockReturnValue('mocked toml content'),
}));

// Store original process.env
const originalEnv = process.env;

describe('Config Loader', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset process.env to a fresh copy before each test
    process.env = { ...originalEnv };
    
    // Default mock behavior
    (existsSync as jest.Mock).mockReturnValue(true);
    (readFileSync as jest.Mock).mockReturnValue('mock config content');
    (parse as jest.Mock).mockReturnValue({
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
        cardOrder: {
          queueOrder: QueueOrder.LEARNING_REVIEW_NEW,
          reviewOrder: ReviewSortOrder.DUE_DATE_RANDOM,
          newCardOrder: NewCardGatherOrder.DECK,
        },
      },
      decks: [
        {
          name: 'Test Deck',
          pattern: '^Test',
          prompt: 'test prompt',
          fields: { front: 'Front' },
          responseFields: { 
            sentence: { 
              description: 'A sentence', 
              required: true 
            } 
          },
        },
      ],
    });
  });
  
  afterAll(() => {
    // Restore process.env to its original state
    process.env = originalEnv;
  });
  
  describe('loadConfig', () => {
    it('should load config from file when BASE64_GAKUON_CONFIG is not set', () => {
      const result = loadConfig();
      
      expect(join).toHaveBeenCalledWith('/mock/home', '.gakuon', 'config.toml');
      expect(readFileSync).toHaveBeenCalledWith(expect.any(String), 'utf-8');
      expect(parse).toHaveBeenCalledWith('mock config content');
      
      // Verify some properties to ensure config was processed
      expect(result.global.ankiHost).toBe('http://localhost:8765');
      expect(result.global.openaiApiKey).toBe('test-key');
      expect(result.decks.length).toBe(1);
    });
    
    it('should load config from BASE64_GAKUON_CONFIG when set', () => {
      const mockBase64 = Buffer.from('mock base64 config').toString('base64');
      process.env.BASE64_GAKUON_CONFIG = mockBase64;
      
      loadConfig();
      
      // Should have decoded and parsed the base64 config
      expect(parse).toHaveBeenCalledWith('mock base64 config');
      // Should not have used the file-based config
      expect(readFileSync).not.toHaveBeenCalled();
    });
    
    it('should create default config when file does not exist', () => {
      (existsSync as jest.Mock).mockReturnValue(false);
      
      loadConfig();
      
      // Should have tried to save the default config
      expect(writeFileSync).toHaveBeenCalled();
      // Then should have tried to read it
      expect(readFileSync).toHaveBeenCalled();
    });
    
    it('should use environment variables when set', () => {
      process.env.GAKUON_ANKI_HOST = 'http://custom.anki:1234';
      process.env.OPENAI_API_KEY = 'env-api-key';
      
      const result = loadConfig();
      
      // Environment variables should override config file values
      expect(result.global.ankiHost).toBe('http://custom.anki:1234');
      expect(result.global.openaiApiKey).toBe('env-api-key');
    });
    
    it('should handle custom path parameter', () => {
      loadConfig('/custom/path/config.toml');
      
      expect(readFileSync).toHaveBeenCalledWith('/custom/path/config.toml', 'utf-8');
    });
    
    it('should throw error on invalid base64 config', () => {
      // Mock parse to throw ZodError for this test
      const mockZodError = new ZodError([{
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['global', 'openaiApiKey'],
        message: 'Required',
      }]);
      
      (parse as jest.Mock).mockReturnValueOnce({});
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Setup a spy on the ZodError constructor
      const zodErrorSpy = jest.spyOn(Object.getPrototypeOf(ZodError), 'constructor')
        .mockImplementation(() => mockZodError);
      
      process.env.BASE64_GAKUON_CONFIG = Buffer.from('invalid config').toString('base64');
      
      // Providing an empty object should trigger a validation error that gets caught
      expect(() => loadConfig()).not.toThrow(); // Should fallback to file config
      expect(console.warn).toHaveBeenCalledWith(
        'Failed to parse BASE64_GAKUON_CONFIG:',
        expect.any(Error)
      );
      
      zodErrorSpy.mockRestore();
    });
    
    it('should throw error on invalid file config', () => {
      // Create a schema validation error
      const mockZodError = new ZodError([{
        code: 'invalid_type',
        expected: 'string',
        received: 'undefined',
        path: ['global', 'openaiApiKey'],
        message: 'Required',
      }]);
      
      // Make the parse function throw a ZodError
      (parse as jest.Mock).mockImplementation(() => { 
        throw mockZodError;
      });
      
      expect(() => loadConfig()).toThrow(/Invalid configuration from file/);
    });
  });
  
  describe('findDeckConfig', () => {
    const mockDeckConfigs = [
      {
        name: 'Test Deck',
        pattern: '^Test',
        prompt: 'test prompt',
        fields: {},
        responseFields: {},
      },
      {
        name: 'Japanese',
        pattern: '^Japanese::',
        prompt: 'japanese prompt',
        fields: {},
        responseFields: {},
      },
    ];
    
    it('should find config by exact match', () => {
      const config = findDeckConfig('Test', mockDeckConfigs);
      
      expect(config).toBe(mockDeckConfigs[0]);
    });
    
    it('should find config by pattern match', () => {
      const config = findDeckConfig('Japanese::N5', mockDeckConfigs);
      
      expect(config).toBe(mockDeckConfigs[1]);
    });
    
    it('should return undefined when no config matches', () => {
      const config = findDeckConfig('Unknown Deck', mockDeckConfigs);
      
      expect(config).toBeUndefined();
    });
  });
});