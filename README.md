# C2ST — C to IEC 61131-3 Structured Text

Convert C code to PLC Structured Text instantly using the Mistral AI API.

## Features

- Select C code → press `Ctrl+Alt+S` (or `Cmd+Alt+S` on Mac)
- Result opens in a side-by-side panel with Pascal/ST syntax highlighting
- Conversion notes appended explaining key changes and safety concerns
- Status bar indicator shown on C files
- Secure API key storage (VS Code secret storage — never written in plain text)

## Installation

### From VSIX

```bash
code --install-extension c2st-0.1.0.vsix
```

### From source

```bash
git clone <repo>
cd c2st
npm install
npm run compile
# Then press F5 in VS Code to launch the Extension Development Host
```

### Recommended VS Code extension

For better editing and highlighting of `.st` files, install **Structured Text Language Support** by **Sergey Romanov** from the VS Code Marketplace.

## Getting a Mistral API Key

1. Go to [https://console.mistral.ai/](https://console.mistral.ai/)
2. Sign up / log in
3. Navigate to **API Keys** → **Create new key**
4. Copy the key

## Setting your API key in VS Code

Run the command palette (`Ctrl+Shift+P`) and choose:

```
C2ST: Set Mistral API Key
```

Or add it to your VS Code `settings.json` (less secure, visible in plain text):

```json
{
  "c2st.mistralApiKey": "your-key-here"
}
```

## Usage

1. Open a `.c` file
2. Select the C code you want to convert
3. Press `Ctrl+Alt+S` (Windows/Linux) or `Cmd+Alt+S` (Mac)
   — or open the command palette and run **C2ST: Convert C to ST**
4. The Structured Text result opens in a panel to the right


## Settings

| Setting | Default | Description |
|---|---|---|
| `c2st.mistralApiKey` | `""` | Your Mistral API key (prefer the Set Key command) |
| `c2st.model` | `mistral-large-latest` | Model to use (`mistral-large-latest` or `open-mistral-7b`) |

## Conversion rules applied

| C | Structured Text |
|---|---|
| `=` | `:=` |
| `==` | `=` |
| `if/else {}` | `IF...ELSIF...ELSE...END_IF` |
| `for {}` | `FOR...END_FOR` |
| `switch/case/break` | `CASE...OF...ELSE...END_CASE` |
| `struct` | `TYPE...STRUCT...END_STRUCT` |
| `*ptr` param | `VAR_IN_OUT` |
| `malloc` | `ARRAY[0..N]` (static allocation) |
| `static` | `VAR RETAIN` / `VAR PERSISTENT` |

## Troubleshooting

### Extension not working / Command not found

**Problem:** "C2ST: Convert C to ST" command doesn't appear in command palette.

**Solutions:**
1. Reload VS Code window: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Check that extension is installed: `Ctrl+Shift+X` → search "C2ST"
3. Verify extension is enabled (not disabled in the Extensions panel)
4. Check VS Code version (requires 1.85.0 or higher)

---

### "No API key configured" error

**Problem:** Extension shows error about missing API key.

**Solutions:**
1. Set your API key: `Ctrl+Shift+P` → "C2ST: Set Mistral API Key"
2. Get a key from https://console.mistral.ai/ if you don't have one
3. Verify key is correctly entered (no extra spaces)
4. Check if key is stored:
   - Open Settings: `Ctrl+,` → search "c2st"
   - Or check secret storage (secure) vs settings.json (plaintext)

---

### "Invalid API key (401)" error

**Problem:** Conversion fails with 401 Unauthorized error.

**Solutions:**
1. Verify your API key is valid at https://console.mistral.ai/
2. API key may have been revoked or expired - create a new one
3. Re-enter the key: `Ctrl+Shift+P` → "C2ST: Set Mistral API Key"
4. Ensure no extra whitespace before/after the key
5. If key is in settings.json, make sure it's the full key (starts with `sk-`)

---

### "Rate limited (429)" error

**Problem:** Too many requests to Mistral API.

**Solutions:**
1. Wait 1-2 minutes before trying again
2. Check your Mistral account limits at https://console.mistral.ai/
3. Consider upgrading your Mistral plan if hitting limits frequently
4. Use `open-mistral-7b` model instead (lower rate limits but faster)

---

### "Request timeout" error

**Problem:** Conversion takes too long and times out (>60 seconds).

**Solutions:**
1. Select smaller code sections (under 10,000 characters)
2. Break large files into smaller chunks
3. Check your internet connection
4. Try again - Mistral API may be experiencing high load
5. Consider using a faster model (`open-mistral-7b`)

---

### Empty or incomplete conversion result

**Problem:** Converted ST code is missing or incomplete.

**Solutions:**
1. Check the input C code is valid and well-formed
2. Try converting smaller sections individually
3. Review conversion notes at the end of the result
4. Some complex C constructs may not convert perfectly - manual review needed
5. Try different Mistral models:
   - `mistral-large-latest`: Better quality, handles complex code
   - `open-mistral-7b`: Faster but may struggle with complex code

---

### Keyboard shortcut not working

**Problem:** `Ctrl+Alt+S` (or `Cmd+Alt+S`) doesn't trigger conversion.

**Solutions:**
1. Make sure you have C code selected (highlight it first)
2. Verify you're in a `.c` file (status bar should show "C")
3. Check for keyboard shortcut conflicts:
   - `Ctrl+Shift+P` → "Preferences: Open Keyboard Shortcuts"
   - Search for "C2ST"
   - Verify the binding or change it to avoid conflicts
4. Use command palette instead: `Ctrl+Shift+P` → "C2ST: Convert C to ST"

---

### Result file doesn't open

**Problem:** Conversion succeeds but result window doesn't appear.

**Solutions:**
1. Check for error messages in the bottom-right corner
2. Look for the `*_c2st.st` file in the same directory as your `.c` file
3. Open it manually from the Explorer panel
4. Check file permissions - ensure VS Code can write to the directory
5. View Developer Console for errors: `Help` → `Toggle Developer Tools`

---

### Poor conversion quality

**Problem:** Converted ST code has errors or doesn't match expectations.

**Solutions:**
1. Use `mistral-large-latest` model for better quality:
   - `Ctrl+,` → search "c2st.model"
   - Select `mistral-large-latest`
2. Simplify your C code before conversion:
   - Remove complex macros
   - Expand inline functions
   - Add comments explaining intent
3. Convert smaller, focused sections rather than entire files
4. Review and manually refine the output - AI conversion is a starting point
5. Check conversion notes at the end of the result for warnings

---

### "Selection too large" error

**Problem:** Selected code exceeds 10,000 character limit.

**Solutions:**
1. Select smaller code sections
2. Break your code into functions or modules
3. Convert piece by piece (functions, structs, then main logic)
4. Remove unnecessary comments or whitespace to reduce size

---

### Extension slows down VS Code

**Problem:** VS Code becomes slow or unresponsive after using C2ST.

**Solutions:**
1. Close unused `*_c2st.st` files (they accumulate in the same directory)
2. Reload VS Code window: `Ctrl+Shift+P` → "Developer: Reload Window"
3. Clear temp files manually if needed
4. Check Developer Console for errors: `Help` → `Toggle Developer Tools`

---

### Getting help

If your issue isn't listed here:

1. **Check the logs:**
   - Open VS Code Developer Console: `Help` → `Toggle Developer Tools`
   - Look for errors in the Console tab

2. **Search existing issues:**
   - Visit: https://github.com/ntufar/c2st/issues
   - Search for similar problems

3. **Report a bug:**
   - Create a new issue: https://github.com/ntufar/c2st/issues/new
   - Include:
     - VS Code version
     - C2ST version
     - Operating system
     - Error messages
     - Steps to reproduce

4. **Read the docs:**
   - [CONTRIBUTING.md](CONTRIBUTING.md) - Development guide
   - [CHANGELOG.md](CHANGELOG.md) - Version history

---

## Building a VSIX package

```bash
npm install -g @vscode/vsce
npm run compile
vsce package
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.

## License

MIT
