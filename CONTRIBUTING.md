# Contributing to YC Hedge Fund

Thank you for considering contributing to YC Hedge Fund! This document outlines the process and guidelines.

## Code of Conduct

This project adheres to the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold this code.

## How Can I Contribute?

### 🐛 Reporting Bugs

**Before submitting**, check existing [Issues](https://github.com/KonstantinMB/atlas/issues) to avoid duplicates.

**Bug Report Should Include**:
- Clear title (e.g., "Portfolio panel crashes when closing SHORT position")
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS version
- Console errors (if any)

Use the [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md).

### 💡 Suggesting Features

We welcome feature ideas! Please:
1. Check [Discussions](https://github.com/KonstantinMB/atlas/discussions) first
2. Open an issue with `[Feature Request]` prefix
3. Describe the problem you're solving
4. Propose a solution (UI mockups welcome!)

### 📝 Improving Documentation

Documentation PRs are highly valued:
- Fix typos, broken links, or unclear explanations
- Add examples to existing docs
- Translate docs to other languages (future)

### 🔧 Code Contributions

#### Development Setup

```bash
git clone https://github.com/KonstantinMB/atlas.git
cd atlas
npm install
cp .env.example .env
# Add your API keys to .env
npx vercel dev
```

#### Coding Conventions

**We follow the conventions in `CLAUDE.md`:**
- Vanilla TypeScript (NO React/Vue/Angular)
- camelCase for variables/functions, PascalCase for classes
- One component per file in `src/panels/`, `src/globe/layers/`
- Edge functions: `export const config = { runtime: 'edge' }`
- Use 3-tier caching (`api/_cache.ts`) for all external API calls

**Style**:
- 2-space indentation
- Single quotes for strings
- Semicolons required
- Run `npm run typecheck` before committing

#### Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `master`: `git checkout -b feature/your-feature-name`
3. **Make your changes** following coding conventions
4. **Test thoroughly**:
   ```bash
   npm run typecheck  # TypeScript checks
   npm run build      # Production build succeeds
   # Manual testing in browser
   ```
5. **Commit** with clear messages:
   ```
   fix: resolve portfolio panel crash on SHORT close

   - Add null check in portfolio-manager.ts:275
   - Fixes #123
   ```
6. **Push** to your fork: `git push origin feature/your-feature-name`
7. **Open a PR** against `master` using the [PR Template](.github/PULL_REQUEST_TEMPLATE.md)

**PR Requirements**:
- ✅ Passes `npm run typecheck`
- ✅ Builds successfully (`npm run build`)
- ✅ No merge conflicts with `master`
- ✅ Clear description of what changed and why
- ✅ Links to related issue (if applicable)

#### Areas Needing Help

🏷️ Issues labeled [`good first issue`](https://github.com/KonstantinMB/atlas/labels/good%20first%20issue) are beginner-friendly.

**Priority areas**:
- 🌍 **New data sources** - Add free OSINT APIs
- 📊 **New trading strategies** - Implement in `src/trading/signals/strategies/`
- 🧪 **Testing** - Unit tests for portfolio manager, risk manager
- 📱 **Mobile UI** - Responsive improvements for <768px
- 🌐 **i18n** - Internationalization support

## File Organization

```
src/
├── globe/          # deck.gl layers (one per file)
├── panels/         # UI panels (one per file)
├── trading/        # Paper trading engine
│   ├── engine/     # Core (execution-loop, portfolio-manager, paper-broker)
│   ├── signals/strategies/  # Trading strategies (add new ones here)
│   └── risk/       # Risk management
├── intelligence/   # Analytics (CII, convergence, anomaly)
└── lib/            # Shared utilities

api/                # Vercel Edge Functions
├── data/           # OSINT data adapters (add new sources here)
├── market/         # Financial data (Finnhub, Yahoo, etc.)
└── trading/        # Portfolio API (auth-required)
```

## Licensing

By contributing, you agree that your contributions will be licensed under **MIT**.

**Important**: All code must be:
- ✅ Original work or properly attributed
- ✅ Compatible with MIT
- ✅ Free of proprietary dependencies (free-tier APIs okay)

## Questions?

- 💬 **GitHub Discussions** for general questions
- 🐛 **GitHub Issues** for bugs or feature requests

Thank you for making YC Hedge Fund better! 🙌
