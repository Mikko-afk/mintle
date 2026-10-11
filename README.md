# MINTLE — A little word game

A standalone Wordle-inspired game built with vanilla HTML, CSS, and JavaScript.

## Run in VS Code

1. Extract `mintle-project.zip`.
2. Open the `mintle` folder in Visual Studio Code.
3. Install the **Live Server** extension if it is not already installed.
4. Right-click `index.html` and choose **Open with Live Server**.
5. Start guessing. You can also type with your physical keyboard.

No Node.js installation, build process, backend, external fonts, or internet connection is required to play after the files are available locally.

## Features

- Six attempts to guess a five-letter word. Open-guess mode accepts any five A–Z letters so uncommon words are not incorrectly rejected by a limited dictionary.
- Duplicate-letter-aware tile evaluation.
- Daily and Practice modes.
- Saved progress in the browser's `localStorage`.
- Daily statistics and streak tracking.
- Spoiler-free result sharing.
- Help and settings dialogs, hard mode, and high-contrast mode.
- Responsive layout and reduced-motion support.

## Project files

- `index.html` — semantic game structure and dialogs.
- `style.css` — visual design, responsive rules, tile states, and animations.
- `script.js` — game rules, answer lists, persistence, statistics, and interactions.
- `CLAUDE.md` — project conventions for future Claude Code sessions.

## Notes

- The bundled answer list is a practical subset rather than a comprehensive dictionary. Guesses are not restricted to that list: any five letters A–Z are accepted, which prevents valid but uncommon guesses from being blocked. This also means nonsense letter combinations can be submitted.
- The daily answer is deterministic and selected in the browser. As with other client-side games, it is not designed to be secret against someone inspecting the source code.
- Progress and statistics stay in this browser unless you clear site data.

## Important: if the page looks unstyled or the board is missing

If you see plain text, default gray buttons, a blue underlined title, or no letter board, the HTML is being opened in a file preview that is not loading `style.css` and/or running `script.js`. This is not the intended game appearance. Keep all project files together and open the page through a web server (Live Server), not the ZIP preview or a document/file preview.

## Open on your phone

The layout is responsive for mobile browsers. To open the live game on a phone while your computer runs VS Code:

1. Connect your phone and computer to the same Wi-Fi network.
2. In VS Code, open the `mintle` folder and start Live Server from `index.html`.
3. Find your computer's local IPv4 address (Windows: run `ipconfig` and look for `IPv4 Address`).
4. On your phone, open a browser and visit `http://YOUR-COMPUTER-IP:5500` (replace the example with your computer's address). If Live Server uses another port, use that port instead.
5. If it does not load, allow VS Code/Live Server through your computer's firewall and confirm both devices are on the same Wi-Fi.

For access when your computer is off or when you are away from the same Wi-Fi, publish the folder to a static hosting service such as GitHub Pages or Netlify.
