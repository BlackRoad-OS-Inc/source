# Lucidia CLI

[![CI](https://github.com/blackboxprogramming/lucidia-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/blackboxprogramming/lucidia-cli/actions/workflows/ci.yml)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-3776AB.svg)](https://python.org)
[![License](https://img.shields.io/badge/license-Proprietary-9c27b0)](LICENSE)

A terminal operating system built on Textual and Rich. Multi-tab TUI with a web browser, sandboxed filesystem, AI agents, mini applications, and background process management.

## Components

### Web Engine
Terminal web browser with HTML-to-Rich markup parser, link extraction and navigation, browsing history, and DuckDuckGo search integration.

### Virtual Filesystem
Sandboxed at `~/.lucidia/vfs`. Standard operations: `ls`, `cd`, `cat`, `write`, `mkdir`, `rm`. Persistent across sessions.

### AI Agents
Ollama-powered agents with distinct personalities: lucidia, alice, octavia, cece, operator. Council mode runs multi-agent discussions where agents debate and synthesize answers.

### Mini Apps
- `calc` -- safe expression evaluator
- `btc` / `eth` -- live crypto prices
- `weather` -- wttr.in integration
- `fortune` -- random wisdom
- `time` / `date` / `unix` -- clock utilities
- `whoami` / `neofetch` -- system info

### Process Manager
Async background task spawning with PID tracking. `ps` to list, `kill` to stop.

## Architecture

```
lucidia.py (main TUI)
    |
    +-- components/
    |       web_engine.py     HTML parser + browser
    |       virtual_fs.py     Sandboxed filesystem
    |       agents.py         Ollama AI integration
    |       apps.py           Calculator, crypto, weather
    |       process_mgr.py    Background task manager
    |
    +-- config/
            settings.json     User preferences
```

## Keybindings

| Key | Action |
|-----|--------|
| Ctrl+1 | Shell |
| Ctrl+2 | Web browser |
| Ctrl+3 | Files |
| Ctrl+4 | AI Agents |
| Ctrl+5 | Apps |
| Ctrl+Q | Quit |

## Install and Run

```bash
pip install textual rich
python lucidia.py
```

For AI agents, Ollama must be running locally.

## Development

```bash
pip install -r requirements.txt
pytest tests/ -v
```

## License

Proprietary -- BlackRoad OS, Inc.
