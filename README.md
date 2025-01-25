# gakuon

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.0. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

## Example config

`~/.gakuon/config.toml`

```toml
[global]
ankiHost = "http://localhost:8765"
openaiApiKey = "${OPENAI_API_KEY}"
audioDir = "~/.gakuon/audio"
ttsVoice = "alloy"
defaultDeck = "Core 2k/6k Optimized Japanese Vocabulary with Sound Part 01"

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
