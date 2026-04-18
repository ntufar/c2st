# AGENTS.md - AI Agent Development Guide for C2ST

This guide provides essential information for AI coding agents (like Claude, Copilot, Cursor) working on the C2ST VS Code extension.

## Project Overview

**C2ST** is a VS Code extension that converts C code to IEC 61131-3 Structured Text (PLC programming) using Mistral AI.

- **Language**: TypeScript (strict mode, ES2020 target, CommonJS modules)
- **Runtime**: Node.js 20.x+, VS Code 1.85.0+
- **Build System**: esbuild (fast bundler, NOT webpack)
- **Test Framework**: Mocha + Sinon + @vscode/test-electron
- **Package Manager**: npm (use `npm`, not yarn/pnpm)

## Build & Test Commands

### Compilation & Testing
```bash
npm run compile          # Build extension (esbuild)
npm run watch           # Auto-recompile on file changes
npm run compile-tests   # Compile tests (tsc)
npm run lint            # Type-check only (tsc --noEmit, NO ESLint)
npm test                # Run all tests (Mocha)
npm run package         # Create .vsix package
```

**Run single test**: Not directly supported. Use VS Code's test explorer or modify `src/test/runTests.ts`.  
**Manual testing**: Press `F5` in VS Code to launch Extension Development Host.

## Code Style Guidelines

### TypeScript Standards

**Strict Mode**: All TypeScript strict checks enforced (`strict: true`).

- NEVER use `any` - always provide proper types
- Prefer explicit return types on exported functions
- Use `const`/`let` - NEVER `var`
- Prefer async/await over callbacks or raw promises
- Use arrow functions for callbacks: `items.map(x => x.value)`
- Use template literals: `` `Hello ${name}` ``

### Import Organization

```typescript
// 1. Node built-ins and VS Code API
import * as vscode from 'vscode';
import * as path from 'path';

// 2. External packages
import axios from 'axios';

// 3. Internal modules (when they exist)
// import { helper } from './utils';
```

### Code Organization

```typescript
// 1. Imports
// 2. Constants (UPPER_SNAKE_CASE)
// 3. Types/Interfaces (PascalCase)
// 4. Module-level variables
// 5. Functions (exported first, then internal helpers)
```

### Naming Conventions

- **Variables/Functions**: `camelCase` (e.g., `getUserInput`)
- **Classes/Interfaces**: `PascalCase` (e.g., `ConversionResult`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_SELECTION_CHARS`)
- **Private members**: `_prefixed` (e.g., `_internalState`)
- **Files**: `kebab-case.ts` (e.g., `api-client.ts`)

### Formatting (Manual - No ESLint/Prettier)

- **Indentation**: 2 spaces (NOT tabs)
- **Line length**: ~100 chars (soft limit)
- **Semicolons**: Required
- **Quotes**: Single quotes `'text'` (except template literals)
- **Trailing commas**: Recommended in multi-line objects/arrays

### Error Handling

ALWAYS handle errors gracefully - never let exceptions crash the extension:

```typescript
// ✅ GOOD
try {
  await riskyOperation();
} catch (err) {
  if (err instanceof SpecificError) {
    vscode.window.showErrorMessage(
      'C2ST: Operation failed. Please check your API key.'
    );
  } else {
    console.error('Unexpected error:', err);
    vscode.window.showErrorMessage('C2ST: An unexpected error occurred');
  }
}

// ❌ BAD - Silent failure or generic messages
```

**Error message format**: Prefix with `C2ST:` and provide actionable guidance.

### Progress Indicators

Use for operations taking >1 second:
```typescript
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: "C2ST: Converting...",
  cancellable: false
}, async (progress) => {
  // Long operation
});
```

## Testing Guidelines

### Test Structure (Mocha + Sinon)

```typescript
describe('functionName', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should do something specific', async () => {
    // Arrange
    const stub = sandbox.stub(vscode.workspace, 'getConfiguration');
    
    // Act
    const result = await functionName();
    
    // Assert
    assert.strictEqual(result, expectedValue);
    sinon.assert.calledOnce(stub);
  });
});
```

### Test Patterns

- **Stub VS Code API**: Always use Sinon stubs for `vscode.*` calls
- **Stub axios**: Mock HTTP requests with `sandbox.stub(axios, 'post')`
- **Test behavior AND messages**: Verify both function results and user-facing error messages
- **Export functions for testing**: Mark functions as `export` to test them (see `src/extension.ts`)

## Git Workflow

### Commit Messages (Conventional Commits)

```
<type>(<scope>): <subject>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples**:
```
feat(conversion): add support for do-while loops
fix(api): handle Mistral API timeout gracefully
```

## Key Architecture Notes

### Main Files

- **`src/extension.ts`** (255 lines): Main extension logic
  - `activate()`: Extension entry point, registers commands
  - `runConversion()`: Main orchestration logic
  - `callMistral()`: Mistral API communication via axios
  - `getApiKey()`: Retrieves API key from settings/secrets
  - `promptForApiKey()`: UI for API key input
  - `updateStatusBar()`: Shows/hides status bar on C files

- **`src/test/suite/extension.test.ts`** (400 lines): Unit tests (18 tests)

### VS Code API Patterns

**Commands**: `vscode.commands.registerCommand('c2st.convertSelection', ...)`  
**Configuration**: `vscode.workspace.getConfiguration('c2st').get<string>('mistralApiKey')`  
**Secrets**: `await context.secrets.store('c2st.mistralApiKey', key)`  
**Status Bar**: `vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100)`

## Common Pitfalls

1. **File Operations**: Currently uses synchronous `fs.writeFileSync` - when refactoring, use `fs.promises.writeFile` instead.
2. **No ESLint**: Only TypeScript type-checking via `npm run lint`. Follow manual style conventions above.
3. **Test Environment**: Tests run in `@vscode/test-electron`, not Node.js directly. Use `xvfb-run` in CI for headless testing.
4. **API Key Security**: NEVER commit API keys. Store in VS Code secrets (secure) or settings (plaintext, user's choice).
5. **Error Messages**: ALWAYS prefix with `C2ST:` for brand consistency and clarity.

## External Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Mistral AI API Docs](https://docs.mistral.ai/)
- [IEC 61131-3 Structured Text](https://en.wikipedia.org/wiki/Structured_text)

---

*This file is for AI agents. For human contributors, see [CONTRIBUTING.md](CONTRIBUTING.md).*
