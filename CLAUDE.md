# MINTLE — Project Instructions

## Goal
Maintain an original, accessible, polished word guessing game that feels intentionally art-directed rather than template-generated.

## Technical constraints
- Use vanilla HTML, CSS, and JavaScript.
- Keep the app usable through VS Code Live Server without a backend or build step.
- Do not add frameworks, build tools, remote APIs, or unnecessary dependencies.
- Keep gameplay logic separate from rendering where practical.

## Design principles
- Preserve MINTLE's vintage puzzle-ticket / word-desk identity.
- Use deliberate typography, purposeful spacing, and restrained micro-interactions.
- Avoid generic gradients, excess cards, glassmorphism, and decorative clutter.
- Keep desktop and mobile layouts usable; support keyboard navigation and reduced motion.

## Engineering principles
- Correctly score duplicate letters.
- Use open-guess mode: accept any five A–Z letters, rather than rejecting guesses based on a small bundled dictionary.
- Keep daily and practice progress separate.
- Treat saved browser data as untrusted and handle storage failures gracefully.
- Do not downgrade letter status from correct to present or absent.
- Never leave placeholder buttons, unfinished TODOs, or settings that do nothing.
- Do not claim tests passed unless they were actually run.

## Workflow
Inspect before editing. Preserve working behavior. Test guess evaluation, keyboard interaction, persistence, mode switching, statistics, and responsive layout after significant changes. Prefer reliable core gameplay over unnecessary features.
