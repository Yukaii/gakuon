# gakuon (学音)

[![NPM Version](https://img.shields.io/npm/v/gakuon)](https://www.npmjs.com/package/gakuon)

[Project board →](https://github.com/users/Yukaii/projects/10/views/1)

[Good First Issues →](https://github.com/users/Yukaii/projects/10/views/8)

学音 (Gakuon) is an AI-powered audio learning system for Anki that transforms your flashcard reviews into an immersive audio experience. It automatically generates contextual sentences, explanations, and natural speech for your cards, allowing you to maintain your Anki reviews through passive listening.

## Features
- Generates natural example sentences using OpenAI
- Creates explanations in both target and native languages
- Converts text to high-quality speech using OpenAI's TTS
- Caches generated content in Anki cards for reuse
- Supports configurable card ordering and review patterns
- Provides keyboard-driven interface for efficient reviews
- Works with existing Anki decks and card types

Perfect for:
- Language learners who want to maintain their Anki reviews while multitasking
- Users who prefer audio-based learning
- Anyone looking to enhance their Anki cards with AI-generated content
- Learners who want to practice listening comprehension

> [!WARNING]
> This program would add extra fields to your card type! Understand what you're doing


> [!NOTE]
> Project status: Alpha, with a working CLI program

## Prerequisite

* Setup Anki with AnkiConnect locally
* ffplayer (installed along with ffmpeg)

## Installation

```bash
npm install -g gakuon
```

## Usage

```bash
gakuon learn
```

## Commands

Gakuon provides several commands to help you manage and use your audio learning system:

### `learn`

Start an audio-based learning session:

```bash
gakuon learn              # Use default or select deck interactively
gakuon learn --deck NAME  # Use specific deck
gakuon learn --debug     # Enable debug logging
```

### `init`

Initialize deck configuration interactively:

```bash
gakuon init              # Generate config interactively
gakuon init --write      # Save generated config to file
gakuon init --debug      # Enable debug logging
```

### `serve`

Start the Gakuon HTTP server:

```bash
gakuon serve                # Start server on default port 4989
gakuon serve -p 3000        # Use custom port
gakuon serve --debug        # Enable debug logging
gakuon serve --serve-client # Also serve builtint PWA client app
```

### `test`

Test deck configuration with sample cards:

```bash
gakuon test              # Test default or selected deck
gakuon test --deck NAME  # Test specific deck
gakuon test -n 5        # Test with 5 sample cards (default: 3)
gakuon test --debug     # Enable debug logging
```

## Deployment

For production deployment using Docker Compose, see the [Docker Setup Guide](deployment/compose/README.md).

## Development

```bash
bun install

bun run start
# start server with development mode
bun run start serve -d

# start pwa client development mode
bun run dev:client
```

## Configuration

Gakuon can be configured using either environment variables (for global settings) or a TOML configuration file (for both global and deck-specific settings).

### Environment Variables

Global settings can be configured using these environment variables:

```bash
# Global Settings
GAKUON_ANKI_HOST="http://localhost:8765"  # Anki-Connect host
OPENAI_API_KEY="sk-..."                    # OpenAI API key
GAKUON_TTS_VOICE="alloy"                   # TTS voice to use
GAKUON_DEFAULT_DECK="MyDeck"               # Default deck name

GAKUON_OPENAI_CHAT_MODEL="gpt-4o" # Model for chat completions
GAKUON_OPENAI_INIT_MODEL="gpt-4o" # Model for initialization

# Card Order Settings
GAKUON_QUEUE_ORDER="learning_review_new"   # Options: learning_review_new, review_learning_new, new_learning_review, mixed
GAKUON_REVIEW_ORDER="due_date_random"      # Options: due_date_random, due_date_deck, deck_due_date, ascending_intervals, descending_intervals, ascending_ease, descending_ease, relative_overdueness
GAKUON_NEW_CARD_ORDER="deck"               # Options: deck, deck_random_notes, ascending_position, descending_position, random_notes, random_cards

# Base64 encoded full config (optional)
BASE64_GAKUON_CONFIG="..."                 # Base64 encoded TOML config
```

### TOML Configuration File

For more detailed configuration including deck-specific settings, use `~/.gakuon/config.toml`:

```toml
[global]
ankiHost = "http://localhost:8765"
openaiApiKey = "${OPENAI_API_KEY}"  # Will use OPENAI_API_KEY environment variable
ttsVoice = "alloy"
# Optional field. Using with CLI learn command
defaultDeck = "Core 2k/6k Optimized Japanese Vocabulary with Sound Part 01"

[global.openai]
baseUrl = "https://api.openai.com/v1"
chatModel = "gpt-4o"
initModel = "gpt-4o"
ttsModel = "tts-1"

[global.cardOrder]
queueOrder = "learning_review_new"
reviewOrder = "due_date_random"
newCardOrder = "deck"

[[decks]]
name = "Core 2k/6k Japanese"
pattern = "Core 2k/6k.*Japanese"
fields.word = "Vocabulary-Kanji"
fields.meaning = "Vocabulary-English"
fields.context = "Expression"

prompt = """
Given a Japanese vocabulary card:
- Word: ${word}
- Meaning: ${meaning}
- Context: ${context}

Generate helpful learning content.
"""
[decks.responseFields]
example.description = "A natural example sentence using the word"
example.required = true
example.audio = true

explanation_jp.description = "Simple explanation in Japanese"
explanation_jp.required = true
explanation_jp.audio = true

explanation_en.description = "Detailed explanation in English"
explanation_en.required = true
explanation_en.audio = true

usage_notes.description = "Additional usage notes"
usage_notes.required = false
usage_notes.audio = false
```

## References

- Thanks to [ThisIsntTheWay/headless-anki](https://github.com/ThisIsntTheWay/headless-anki) for providing the Dockerized Anki implementation that powers our headless Anki server setup
