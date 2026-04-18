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

## Building a VSIX package

```bash
npm install -g @vscode/vsce
npm run compile
vsce package
```

## License

MIT
