<div align="center">
  <img src="synapse-color.svg" alt="Synapse Logo" width="80" height="80">
  <h1 align="center">Synapse</h1>
  <p align="center">
    <strong>AI-Powered Jira Delivery Intelligence & Dependency Visualization</strong>
  </p>
</div>

<p align="center">
  Synapse is a modern, lightweight frontend application designed to transform complex Jira Epic hierarchies into clear, interactive dependency graphs and generate AI-driven delivery insights.
</p>

---

## 🚀 Overview

Engineering teams often struggle to parse massive Jira Epics packed with nested sub-tasks, blocked dependencies, and buried acceptance criteria. **Synapse** solves this by fetching Jira hierarchies and turning them into visual, interactive maps. 

This repository contains the **Demo Version** of the application, featuring an interactive mock dataset to demonstrate the UI, UX, and AI insight capabilities without requiring a live Jira API connection.

## ✨ Key Features

- **Interactive Dependency Graph:** Visualize parent-child relationships and blocked issues in a clean, drag-and-drop canvas.
- **AI Delivery Insights:** Automated risk analysis that reads ticket descriptions and comments to identify scope creep, missing criteria, and technical blockers.
- **Release Note Generator:** A specialized module that trims raw Jira JSON payloads and formulates user-facing release notes explaining *what* changed and *why* it matters.
- **Zero-Friction UI:** Keyboard navigable ticket list, seamless light/dark mode, and responsive sidebar management.

## 🛠️ Built With

- **HTML5, CSS3, JavaScript (Vanilla ES6+)**
- **No Build Tools Required:** Pure client-side application for maximum portability and zero setup time.
- **CSS Variables & Flexbox/Grid:** Modern layout techniques ensuring a responsive, fluid design.
- **Custom SVG Rendering:** For the interactive dependency mapping canvas.

## 📁 Project Structure

```text
├── index.html        # Main dashboard and dependency graph viewer
├── tools.html        # AI Release Notes Generator & JSON Trimmer tool
├── app.js            # Core logic, state management, and graph rendering
├── tools.js          # Logic for the Release Note formulation UI
├── data.js           # Mock dataset and JSON parser for Demo Mode
├── Code.gs           # Secure Google Apps Script backend proxy template
├── styles.css        # Global styles, theming, and layout definitions
└── *.svg             # Application branding and vector assets
```

## 💻 Running Locally

Because this application relies entirely on client-side technologies, getting it running is instantaneous:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/synapse-demo.git
   ```
2. Open the directory and double-click `index.html` to open it in any modern browser.
3. *Alternatively*, use a simple local server (like VS Code Live Server) for the best experience.

## 🔌 Production Architecture (Connecting to Live Jira)

While this repository is configured in **Demo Mode** for public portfolio viewing, the full production architecture connects directly to live Atlassian Jira instances.

To bypass browser CORS restrictions securely without exposing API tokens in the frontend, the live application utilizes a **Google Apps Script (GAS) Proxy Architecture**:
1. The frontend (`app.js`) sends a `POST` request containing the Epic Key to a deployed Google Apps Script Web App URL.
2. The GAS proxy retrieves securely stored Atlassian API tokens from its environment properties.
3. The proxy constructs the JQL (Jira Query Language) and securely queries the Atlassian REST API (`/rest/api/2/search`).
4. The proxy returns the hierarchical JSON payload to the frontend for parsing, graph rendering, and AI analysis.

To activate live fetching in your own fork:
1. Open the included `Code.gs` file and follow the deployment instructions at the top to host it on Google Apps Script.
2. Define your new `GOOGLE_SCRIPT_URL` at the top of `app.js`.
3. Re-enable the `fetchEpicData()` proxy calls in the frontend router.

## 🌐 Live Demo

Check out the live interactive demo here: **https://synapse-alpha-beige.vercel.app/**

---

*Designed and engineered with a focus on developer experience and delivery predictability.*
