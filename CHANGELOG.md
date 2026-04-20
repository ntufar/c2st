# Changelog

All notable changes to the "C2ST" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.12] - 2026-04-20

### Fixed
- Fixed extension activation crashing due to recursive logging.

## [0.0.10] - 2026-04-20

### Added
- Multi-provider AI support with four AI providers:
  - Mistral AI (existing, now default option)
  - OpenAI (GPT-4, GPT-3.5)
  - Anthropic (Claude)
  - Google AI (Gemini)
- New "C2ST: Configure AI Provider and API Key" command for interactive setup
  - Provider selection via quick pick menu
  - Provider-specific API key configuration
  - Secure storage of API keys per provider in VS Code secrets
- `c2st.aiProvider` configuration setting with dropdown selection
- `callAI()` router function to dynamically dispatch to the correct provider's API

### Changed
- Refactored API communication architecture:
  - `callMistral()` now complemented by `callOpenAI()`, `callAnthropic()`, `callGoogle()`
  - Unified error handling with `handleApiError()` function
  - Provider-aware API key retrieval in `getApiKey(provider)`
- `runConversion()` dynamically selects AI provider based on user configuration
- Updated test suite to pass provider argument to `getApiKey()`

### Fixed
- Test compatibility with new provider-based API key retrieval

## [0.0.9] - 2026-04-18

### Added
- Comprehensive logging/diagnostics system with VS Code output channel
  - `[INFO]`, `[DEBUG]`, `[WARN]`, `[ERROR]` log levels throughout extension
  - New "C2ST: Show Logs" command to view diagnostics
  - Logging for extension lifecycle, API key management, conversion process, API calls, and file operations
  - Performance tracking with conversion duration in milliseconds
  - Token usage logging (prompt, completion, total tokens) for cost analysis
- API response validation with TypeScript type guards
  - `MistralResponse` interface defining expected API schema
  - `validateMistralResponse()` function for pre-processing validation
  - Early detection of API format changes with detailed error logging
  - Type-safe response handling throughout codebase
  - Logs first 500 chars of invalid responses for debugging

### Changed
- `outputChannel` made optional (`OutputChannel | undefined`) to support testing
- All logging now uses `log()` helper function for safe operation
- API response handling enhanced with schema validation before field access
- Better error messages distinguishing API format errors from empty content
- Extension now logs detailed diagnostics for troubleshooting user issues

### Fixed
- All 18 tests now passing (previously failing due to undefined outputChannel)
- Test suite compatible with direct function calls without extension activation

## [0.0.8] - 2026-04-18

### Security
- Override `serialize-javascript` to `^7.0.5` to resolve two high-severity CVEs in the transitive dependency pulled in by Mocha:
  - `GHSA-5c6j-r48x-rmvq` — RCE via `RegExp.flags` / `Date.prototype.toISOString()`
  - `GHSA-qj8w-gfj5-8c6v` — CPU exhaustion DoS via crafted array-like objects

## [0.0.7] - 2026-04-18

### Added
- Full test suite with 18 passing tests covering all critical paths (`src/test/`)
  - `getApiKey`: settings lookup, secret storage fallback, undefined, whitespace trimming
  - `callMistral`: success, 401, 429, timeout, network error, empty/missing response, unexpected errors
  - `runConversion`: no editor, empty selection, whitespace-only, oversized selection, missing API key prompt
- Testing framework: `@vscode/test-electron`, Mocha, Sinon with type definitions
- `compile-tests` and `test` npm scripts for running the suite
- `lint` npm script (`tsc --noEmit`) for type-checking enforcement

### Changed
- `getApiKey`, `promptForApiKey`, `callMistral`, `runConversion`, and `MAX_SELECTION_CHARS` are now exported from `extension.ts` to enable unit testing
- CI pipeline (`ci.yml`) expanded with Lint, Security Audit, and Test steps; tests run under `xvfb-run` for headless VS Code support
- Release pipeline (`release.yml`) now runs the full quality gate (lint + audit + tests) before packaging, and automatically publishes to the VS Code Marketplace on version tags via `VSCE_PAT` secret

## [0.0.6] - 2026-04-18

### Added
- Comprehensive improvement plan documentation in `docs/improvement-plan.md`
- `.vscodeignore` file to reduce package size by 80% (1.1MB → 222KB)
- `CHANGELOG.md` for version tracking (follows Keep a Changelog format)
- `CONTRIBUTING.md` with comprehensive contributor guidelines (467 lines)
- Troubleshooting section in README.md covering 11 common scenarios
- Progress tracking system with checkboxes in improvement plan
- Documentation of all versions from 0.0.1 onwards

### Changed
- Package size reduced from 1.1MB (390 files) to 222KB (8 files) - 80% reduction
- README.md expanded from 98 to 284 lines with troubleshooting guide
- Improved documentation structure with links between docs

### Fixed
- Package now only includes essential runtime files (excludes source, tests, samples)

## [0.0.5] - 2024

### Changed
- Updated package.json metadata with publisher information
- Changed extension dependencies configuration
- Updated package-lock.json with license information

## [0.0.3] - 2024

### Added
- Extension icon (images/icon.png)
- Dependencies configuration in package.json

### Changed
- Version bumped to 0.0.3

## [0.0.2] - 2024

### Fixed
- Reverted version number to maintain proper versioning

## [0.0.1] - 2024

### Added
- Initial release of C2ST extension
- AI-powered C to IEC 61131-3 Structured Text conversion using Mistral API
- Keyboard shortcut support (`Ctrl+Alt+S` / `Cmd+Alt+S`)
- Side-by-side result panel with Pascal/ST syntax highlighting
- Conversion notes explaining key changes and safety concerns
- Secure API key storage using VS Code secret storage
- Status bar indicator for C files
- Configuration settings for API key and model selection
- Support for two Mistral models:
  - `mistral-large-latest` (best quality, higher cost)
  - `open-mistral-7b` (faster, lower cost)

### Features
- Converts C syntax to Structured Text:
  - Assignment operators (`=` → `:=`)
  - Equality operators (`==` → `=`)
  - Control structures (`if/else` → `IF...END_IF`)
  - Loops (`for` → `FOR...END_FOR`)
  - Switch statements (`switch/case` → `CASE...OF...END_CASE`)
  - Struct definitions → `TYPE...STRUCT...END_STRUCT`
  - Pointer parameters → `VAR_IN_OUT`
  - Dynamic allocation (`malloc`) → Static arrays
  - Static variables → `VAR RETAIN` / `VAR PERSISTENT`

### Security
- Encrypted API key storage via VS Code secrets API
- Password-masked input for API key entry
- No credentials stored in plain text by default

### Documentation
- Comprehensive README with installation and usage instructions
- Sample C code and converted ST output
- Configuration guide for Mistral API key setup

### CI/CD
- GitHub Actions workflow for continuous integration
- Automated compilation and VSIX packaging
- Release workflow for tagged versions
- Artifact storage (14-day retention)

[Unreleased]: https://github.com/ntufar/c2st/compare/v0.0.10...HEAD
[0.0.10]: https://github.com/ntufar/c2st/compare/v0.0.9...v0.0.10
[0.0.9]: https://github.com/ntufar/c2st/compare/v0.0.8...v0.0.9
[0.0.8]: https://github.com/ntufar/c2st/compare/v0.0.7...v0.0.8
[0.0.7]: https://github.com/ntufar/c2st/compare/v0.0.6...v0.0.7
[0.0.6]: https://github.com/ntufar/c2st/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/ntufar/c2st/releases/tag/v0.0.5
[0.0.3]: https://github.com/ntufar/c2st/releases/tag/v0.0.3
[0.0.2]: https://github.com/ntufar/c2st/releases/tag/v0.0.2
[0.0.1]: https://github.com/ntufar/c2st/releases/tag/v0.0.1
