# gakuon (学音)

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

## Development

```bash
bun install

bun run start
```

## Example config

`~/.gakuon/config.toml`

```toml
[global]
ankiHost = "http://localhost:8765"

# Set environment variable OPENAI_API_KEY or use other key
openaiApiKey = "${OPENAI_API_KEY}"
# or openaiApiKey = "$OPENAI_API_KEY"
# or openaiApiKey = "sk-proj-123123123123"
ttsVoice = "alloy"

defaultDeck = "Core 2k/6k Optimized Japanese Vocabulary with Sound Part 01"

[global.cardOrder]
queueOrder = "learning_review_new"
reviewOrder = "due_date_random"
newCardOrder = "deck"

# TODO: no used for now
[global.language]
target = "Japanese"
native = "English"

[[decks]]
name = "Core 2k/6k Japanese"
pattern = "Core 2k/6k.*Japanese"
fields.front = "Vocabulary-Kanji"
fields.back = "Vocabulary-English"
fields.example = "Expression"
fields.notes = "Notes"
prompt = """
Given a Japanese vocabulary card:
- Word: ${front}
- Meaning: ${back}
- Example: ${example}
- Notes: ${notes}

Generate:
1. A natural example sentence using the word (different from the example provided)
2. A simple explanation in Japanese
3. An explanation in English

Format the response as a JSON object with properties: sentence, targetExplanation, nativeExplanation
"""
```
