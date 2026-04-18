# Contributing to C2ST

Thank you for your interest in contributing to C2ST! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

## Code of Conduct

This project follows a code of conduct to ensure a welcoming environment for all contributors. Please be respectful, constructive, and professional in all interactions.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/c2st.git
   cd c2st
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ntufar/c2st.git
   ```

## Development Setup

### Prerequisites

- **Node.js** 20.x or higher
- **VS Code** 1.85.0 or higher
- **npm** (comes with Node.js)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your Mistral API key for testing:
   - Get a key from https://console.mistral.ai/
   - Open VS Code and run command: `C2ST: Set Mistral API Key`
   - Or add to settings.json (less secure):
     ```json
     {
       "c2st.mistralApiKey": "your-test-key"
     }
     ```

### Building the Extension

Compile TypeScript to JavaScript:
```bash
npm run compile
```

Watch mode for development (auto-recompile on changes):
```bash
npm run watch
```

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch the Extension Development Host
3. A new VS Code window will open with the extension loaded
4. Open a `.c` file, select some code, and press `Ctrl+Alt+S` (or `Cmd+Alt+S` on Mac)

### Packaging

To create a `.vsix` package:
```bash
npm run package
```

This creates `c2st-x.x.x.vsix` which can be installed with:
```bash
code --install-extension c2st-x.x.x.vsix
```

## Development Workflow

### Creating a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### Keeping Your Fork Updated

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

### Making Changes

1. Make your changes in your feature branch
2. Test thoroughly (see [Testing](#testing))
3. Commit with clear, descriptive messages (see [Commit Messages](#commit-messages))
4. Push to your fork
5. Create a pull request

## Coding Standards

### TypeScript Style

- **Strict mode enabled**: All TypeScript strict checks are enforced
- **Use async/await**: Prefer async/await over callbacks or raw promises
- **Type everything**: Avoid `any` types; use proper type annotations
- **Use const/let**: Never use `var`
- **Arrow functions**: Prefer arrow functions for callbacks

### Code Organization

```typescript
// 1. Imports
import * as vscode from 'vscode';
import * as path from 'path';

// 2. Constants
const MAX_SELECTION_CHARS = 10_000;

// 3. Interfaces/Types
interface ConversionResult {
  success: boolean;
  code?: string;
}

// 4. Functions
async function myFunction(): Promise<void> {
  // Implementation
}

// 5. Exports
export function activate(context: vscode.ExtensionContext) {
  // Activation logic
}
```

### Naming Conventions

- **Variables/Functions**: `camelCase`
- **Classes/Interfaces**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private members**: prefix with `_` (e.g., `_privateMethod`)
- **Files**: `kebab-case.ts`

### Error Handling

Always handle errors gracefully:

```typescript
// Good
try {
  await riskyOperation();
} catch (err) {
  if (err instanceof SpecificError) {
    // Handle specific error
    vscode.window.showErrorMessage('User-friendly message');
  } else {
    // Handle unknown error
    console.error('Unexpected error:', err);
    vscode.window.showErrorMessage('An unexpected error occurred');
  }
}

// Bad
try {
  await riskyOperation();
} catch (err) {
  // Silent failure - never do this!
}
```

### User-Facing Messages

- **Error messages**: Clear, actionable, with suggested fixes
  ```typescript
  vscode.window.showErrorMessage(
    'C2ST: Invalid API key (401). Run "C2ST: Set Mistral API Key" to update it.'
  );
  ```

- **Progress indicators**: For operations taking >1 second
  ```typescript
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "C2ST: Converting...",
    cancellable: false
  }, async (progress) => {
    // Long operation
  });
  ```

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring (no feature/bug changes)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (deps, config, etc.)

**Examples:**
```
feat(conversion): add support for do-while loops

Adds conversion logic for C do-while loops to ST REPEAT...UNTIL
constructs. Includes handling for break/continue statements.

Closes #123
```

```
fix(api): handle Mistral API timeout gracefully

Previously, timeout errors would crash the extension. Now displays
user-friendly message and suggests increasing timeout setting.
```

## Testing

### Manual Testing

1. Launch Extension Development Host (`F5`)
2. Test the following scenarios:
   - Convert simple C code (variables, assignments)
   - Convert complex C code (structs, pointers, loops)
   - Test with empty selection (should show error)
   - Test with oversized selection >10K chars (should show error)
   - Test without API key (should prompt)
   - Test with invalid API key (should show error)
   - Test with rate limiting (if possible)

### Automated Testing

**Note**: Automated tests are planned but not yet implemented. See [improvement plan](docs/improvement-plan.md) for details.

When tests are added, run with:
```bash
npm test
```

### Test Checklist

Before submitting a PR, verify:
- [ ] Extension activates without errors
- [ ] Command appears in command palette
- [ ] Keyboard shortcut works (`Ctrl+Alt+S` / `Cmd+Alt+S`)
- [ ] Status bar indicator appears on C files
- [ ] Conversion produces valid ST code
- [ ] Error messages are clear and helpful
- [ ] No console errors or warnings
- [ ] Code compiles without TypeScript errors
- [ ] VSIX package builds successfully

## Submitting Changes

### Pull Request Process

1. **Update documentation**: If your change affects user-facing behavior, update README.md
2. **Update CHANGELOG.md**: Add your changes under `[Unreleased]`
3. **Test thoroughly**: Follow the [Test Checklist](#test-checklist)
4. **Create PR**: Submit a pull request to the `main` branch
5. **Describe changes**: Provide a clear description of what and why
6. **Link issues**: Reference related issues (e.g., "Closes #123")
7. **Be responsive**: Address review feedback promptly

### PR Title Format

Use the same format as commit messages:
```
feat: add support for inline comments in conversion
fix: prevent crash when API returns malformed response
docs: update troubleshooting section with common errors
```

### PR Description Template

```markdown
## Description
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Testing
Describe how you tested your changes.

## Checklist
- [ ] Code compiles without errors
- [ ] Tested in Extension Development Host
- [ ] Updated documentation (if applicable)
- [ ] Updated CHANGELOG.md
- [ ] No console errors or warnings

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Related Issues
Closes #123
```

## Reporting Bugs

### Before Reporting

1. **Check existing issues**: Search for similar issues
2. **Try latest version**: Ensure you're using the latest release
3. **Verify API key**: Confirm your Mistral API key is valid
4. **Check logs**: Look for errors in VS Code Developer Console (`Help > Toggle Developer Tools`)

### Bug Report Template

Create a new issue with the following information:

```markdown
**Description**
Clear description of the bug.

**To Reproduce**
Steps to reproduce:
1. Open a .c file
2. Select code: `int x = 5;`
3. Press Ctrl+Alt+S
4. See error: ...

**Expected Behavior**
What you expected to happen.

**Actual Behavior**
What actually happened.

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS: [e.g., macOS 14.2, Windows 11, Ubuntu 22.04]
- VS Code Version: [e.g., 1.85.0]
- C2ST Version: [e.g., 0.0.5]
- Mistral Model: [e.g., mistral-large-latest]

**Error Messages**
```
Paste any error messages from Developer Console
```

**Additional Context**
Any other relevant information.
```

## Suggesting Features

### Feature Request Template

```markdown
**Feature Description**
Clear description of the feature.

**Use Case**
Describe the problem this feature would solve.

**Proposed Solution**
How you envision the feature working.

**Alternatives Considered**
Other approaches you've thought about.

**Additional Context**
Any other relevant information, mockups, or examples.
```

## Project Structure

```
c2st/
├── .github/
│   └── workflows/       # CI/CD workflows
├── .vscode/             # VS Code workspace settings
├── docs/                # Documentation
│   └── improvement-plan.md
├── images/              # Extension icons and images
├── out/                 # Compiled JavaScript (generated)
├── samples/             # Example C and ST files
├── src/
│   └── extension.ts     # Main extension code
├── .gitignore
├── .vscodeignore        # Files excluded from package
├── CHANGELOG.md         # Version history
├── CONTRIBUTING.md      # This file
├── LICENSE.txt          # MIT License
├── package.json         # Extension manifest
├── package-lock.json    # Dependency lock file
├── README.md            # User documentation
└── tsconfig.json        # TypeScript configuration
```

## Key Files

- **`src/extension.ts`**: Main extension logic (255 lines)
  - `activate()`: Extension activation
  - `runConversion()`: Main conversion orchestration
  - `callMistral()`: API communication
  - `getApiKey()`: Configuration retrieval
  - `openResultDocument()`: File handling

- **`package.json`**: Extension manifest
  - Commands, keybindings, configuration
  - Dependencies and scripts
  - Metadata (name, version, publisher)

- **`tsconfig.json`**: TypeScript configuration
  - Strict mode enabled
  - Target: ES2020
  - Source maps enabled

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Mistral AI API Documentation](https://docs.mistral.ai/)
- [IEC 61131-3 Structured Text](https://en.wikipedia.org/wiki/Structured_text)

## Questions?

If you have questions not covered in this guide:
1. Check the [README.md](README.md)
2. Search [existing issues](https://github.com/ntufar/c2st/issues)
3. Create a new issue with the `question` label

## License

By contributing to C2ST, you agree that your contributions will be licensed under the [MIT License](LICENSE.txt).

---

Thank you for contributing to C2ST! 🚀
