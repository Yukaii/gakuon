# Gakuon (学音) - Project Requirements Documentation

## 1. App Overview
- **Brief Description**: Gakuon is a CLI application with PWA capabilities that enhances Anki flashcard learning through AI-powered audio generation
- **Project Goals**:
  - Enable immersive audio learning from existing Anki decks
  - Provide flexible configuration for AI-driven content generation
  - Offer both CLI and web-based interfaces for maximum accessibility

## 2. User Flow
1. **Main Operation Flow**:
   - User starts Gakuon server or CLI interface
   - Application connects to AnkiConnect API
   - User selects target deck
   - AI generates contextual text based on card content
   - Text is converted to audio via TTS
   - User consumes audio content

2. **Development Flow**:
   ```mermaid
   graph LR
   A[Anki Deck] --> B[AnkiConnect]
   B --> C[Gakuon Server]
   C --> D[AI Processing]
   D --> E[TTS Service]
   E --> F[Audio Output]
   ```

3. **Runtime Flow**:
   - Server Mode: REST API + PWA Frontend
   - CLI Mode: Terminal-based TUI interface
   - Both modes share core audio generation logic

## 3. Tech Stack & APIs
- **Core Technology Stack**:
  - Bun.js runtime environment
  - Node.js compatibility layer
  - AnkiConnect API integration
  - AI text generation service
  - TTS service integration

- **Frontend Layer**:
  - PWA framework
  - Responsive web interface
  - TUI library for CLI interface

## 4. Core Features
1. **Primary Feature Set**:
   - AnkiConnect API integration
   - AI prompt configuration system
   - Text-to-Speech pipeline
   - Audio playback controls
   - Deck selection and management

2. **Component System**:
   - Server component
   - CLI interface
   - PWA frontend
   - Audio processing pipeline
   - Configuration management

## 5. In-scope and Out-of-scope
- **In-scope Items**:
  - Anki deck reading
  - AI text generation
  - Audio conversion
  - Basic playback controls
  - Configuration management

- **Out-of-scope Items**:
  - Anki card modification
  - Direct AnkiWeb integration
  - Complex audio editing
  - Multi-user support

## 6. Non-functional Requirements
1. **Performance Requirements**:
   - Audio generation under 5 seconds
   - Smooth playback experience
   - Efficient deck processing

2. **Security Requirements**:
   - Local API key storage
   - Secure API communications
   - User data protection

## 7. Constraints & Assumptions
- **Technical Constraints**:
  - AnkiConnect availability
  - AI service rate limits
  - TTS service limitations

- **Assumptions**:
  - User has Anki installed
  - AnkiConnect is configured
  - Internet connectivity available

## 8. Known Issues & Potential Pitfalls
1. **Technical Challenges**:
   - AnkiConnect API stability
   - AI response quality
   - Audio format compatibility

2. **Performance Concerns**:
   - Large deck processing time
   - AI service latency
   - Audio file storage management
