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

