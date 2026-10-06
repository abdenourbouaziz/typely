# Typely

Typely is a focused typing test and practice app built as a lightweight offline-first web app. It helps users improve typing speed and accuracy in English, French, and Arabic, with support for custom text, history tracking, and simulated race challenges.

## Features

- Typing speed test with live WPM and accuracy tracking
- Supported languages:
  - English
  - French
  - Arabic
- Multiple time-based and word-based test modes
- Difficulty levels: easy, medium, hard
- Session history with charting and CSV export
- Custom text entry with saved snippets
- File import for .txt content
- Shareable custom text links
- Simulated racing/competition panel with bot and ghost-style comparison
- Fully client-side browser app with no backend required

## Project structure

- `index.html` — landing page for the project
- `app/index.html` — main Typely app interface
- `app/app.css` — app styles
- `js/engine.js` — core typing logic and test engine
- `js/history.js` — session history and chart rendering
- `js/custom.js` — custom text handling and import/share flow
- `js/competition.js` — race simulation and leaderboard logic
- `js/keyboard.js` — virtual keyboard rendering and keyboard behavior
- `js/texts.js` — language text corpus
- `tokens.css` — design tokens and shared styling variables

## Local usage

Because this project is a static web app, you can run it by opening the HTML files directly in a browser, or by serving the folder locally.

### Option 1: Open directly

- Open `index.html` in your browser

### Option 2: Serve locally

From the project root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Notes

- The app stores history and custom data in the browser using `localStorage`
- It is designed to work offline after load, with no server-side dependencies
- The app is intentionally lightweight and dependency-free

## License

This project does not currently declare a license in the repository root.

## Contributing

Contributions are welcome. If you want to improve the app:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Open a pull request with a clear summary

## Roadmap ideas

- Daily challenge mode
- More languages and keyboard layouts
- Better analytics and trends
- Real-time multiplayer typing races
- PWA install support
- Achievement and progression system
