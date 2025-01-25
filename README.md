# gakuon

## Prerequisite

* Setup Anki with AnkiConnect locally

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

# cache audio folder
audioDir = "~/.gakuon/audio"
ttsVoice = "alloy"

defaultDeck = "Core 2k/6k Optimized Japanese Vocabulary with Sound Part 01"

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
