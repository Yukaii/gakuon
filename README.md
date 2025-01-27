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

# optional setup
# defaultDeck = "Core 2k/6k Optimized Japanese Vocabulary with Sound Part 01"

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
