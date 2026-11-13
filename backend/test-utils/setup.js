// Loaded with `node --import` before every test file: quiet logs, no real AI calls.
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';
