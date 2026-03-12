# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Open source release preparation (CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, GitHub templates)

## [0.1.0] - 2026-03-11

### Added
- Initial public release
- Paper trading engine with 6 strategies (Geopolitical, Sentiment, Momentum, Macro, Cross-Asset, Prediction Markets)
- Real-time OSINT data (32+ sources: GDELT, USGS, NASA FIRMS, ACLED, Polymarket, etc.)
- Interactive 3D globe with 12+ toggleable layers (deck.gl + MapLibre)
- Intelligence engine (Country Instability Index, convergence detection, anomaly detection)
- Leaderboard (weekly/monthly/quarterly/yearly returns)
- Auth & persistence (email/password, localStorage + Upstash Redis)
- Vercel Edge Functions for data proxies and AI (Groq LLM)
- WebSocket relay for AIS vessels and OpenSky aircraft

[Unreleased]: https://github.com/KonstantinMB/atlas/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/KonstantinMB/atlas/releases/tag/v0.1.0
