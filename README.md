<div align="center">
  <h1>Solyn</h1>
  <p>A private, fully offline AI chat app for your desktop. Download models from HuggingFace. Run them locally via Ollama. No cloud, no accounts, no data leaving your machine.</p>

  <p>
    <img src="https://img.shields.io/badge/Tauri-2.x-24C8D8?style=flat-square&logo=tauri&logoColor=white" alt="Tauri" />
    <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React" />
    <img src="https://img.shields.io/badge/Rust-stable-CE422B?style=flat-square&logo=rust&logoColor=white" alt="Rust" />
    <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  </p>

  <a href="https://github.com/Keeferf/Solyn/releases/latest">
    <img src="https://img.shields.io/badge/⬇ Download-Windows Installer-20a39e?style=for-the-badge" alt="Download" />
  </a>
</div>

---

## Installation

> **For users who just want to run the app — no coding required.**

1. Go to the [**Releases**](https://github.com/Keeferf/Solyn/releases/latest) page
2. Under **Assets**, download the installer for your platform
3. Run the installer
4. Launch **Solyn** from your Start menu or desktop

That's it. No Node.js, no Rust, no terminal needed.

---

## Overview

Solyn is a native desktop AI chat application built with Tauri and React. It downloads open-weight language models directly from HuggingFace and runs them locally using Ollama — no internet connection is required after the initial model download. Chat sessions, model state, and settings are all stored on your machine.

---

## Features

- **100% local inference** — models run via Ollama; nothing is sent to a cloud API
- **Smart model downloader** — fetch GGUF models from HuggingFace with resume support, integrity verification, and real-time progress tracking
- **Multiple chat sessions** — create, switch between, and delete chat sessions from the sidebar
- **Hardware-aware** — automatically detects GPU/CPU capabilities to recommend optimal models
- **Settings & model management** — download, load, unload, and configure models with an intuitive interface
- **Streaming responses** — tokens stream into the chat window in real time
- **Fully offline** — once a model is downloaded, no network access is required

---

## Tech Stack

| Layer           | Technology                                                                                          |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Desktop shell   | [Tauri 2](https://tauri.app)                                                                        |
| Frontend        | [React 19](https://react.dev) + [Vite](https://vitejs.dev)                                          |
| Language        | [TypeScript](https://www.typescriptlang.org/)                                                       |
| Styling         | [Tailwind CSS v4](https://tailwindcss.com)                                                          |
| Persistence     | [`tauri-plugin-store`](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/store) (JSON) |
| Inference       | [Ollama](https://ollama.ai) (local subprocess)                                                      |
| Model downloads | [reqwest](https://github.com/seanmonstar/reqwest) (rustls, HTTP/1.1 with chunked transfer)          |
| UI Components   | [React-Icons](https://react-icons.github.io/react-icons/)                                           |


---