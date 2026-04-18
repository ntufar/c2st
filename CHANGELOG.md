# Changelog

All notable changes to the "C2ST" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ntufar/c2st/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/ntufar/c2st/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/ntufar/c2st/releases/tag/v0.0.5
[0.0.3]: https://github.com/ntufar/c2st/releases/tag/v0.0.3
[0.0.2]: https://github.com/ntufar/c2st/releases/tag/v0.0.2
[0.0.1]: https://github.com/ntufar/c2st/releases/tag/v0.0.1
