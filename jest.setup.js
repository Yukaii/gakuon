/**
 * Jest setup file to configure global environment for tests
 */

// Mock environment variables needed for tests
process.env.OPENAI_API_KEY = 'test-openai-api-key';

// Mock file system functions to avoid actual file operations
// This handles cases where modules don't use direct jest mocks
if (!global.mockFs) {
  global.mockFs = {
    dirs: new Set(),
    files: new Map(),
  };
}