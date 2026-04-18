import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

const SYSTEM_PROMPT = `You are an expert in C and IEC 61131-3 Structured Text for PLCs.
Convert the user's C code to safe, idiomatic Structured Text.

OUTPUT FORMAT — STRICT:
- Output ONLY valid, compilable IEC 61131-3 Structured Text. No prose, no markdown, no code fences.
- Every explanation must be inside ST block comments (* ... *) or line comments //.
- Do NOT write anything outside of ST syntax. The output must be directly saveable as a .st file and compile without modification.

Conversion rules:
1. C '=' becomes ST ':=', C '==' becomes ST '='
2. Braces {} become IF...END_IF, FOR...END_FOR, CASE...OF...END_CASE
3. C structs become TYPE...STRUCT...END_STRUCT
4. Pointers *param become VAR_IN_OUT in FUNCTION_BLOCK. Flag any pointer arithmetic with a (* UNSAFE: ... *) comment.
5. No malloc/dynamic memory. Use ARRAY[0..N] with fixed bounds instead.
6. C 'switch' becomes CASE OF with ELSE for default. No break needed.
7. C 'static' becomes VAR RETAIN or VAR PERSISTENT.
8. After the converted code, append a block comment:
(*
=== C2ST Notes ===
- <bullet 1>
- <bullet 2>
- <bullet 3 to 5 as needed>
*)
with 3-5 bullets explaining the most important conversions and any safety issues.`;

const MAX_SELECTION_CHARS = 10_000;

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  // Status bar item shown when a C file is open
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.text = '$(symbol-misc) C2ST';
  statusBarItem.tooltip = 'C2ST: Convert C to Structured Text (Ctrl+Alt+S)';
  statusBarItem.command = 'c2st.convertSelection';
  context.subscriptions.push(statusBarItem);

  updateStatusBar(vscode.window.activeTextEditor);
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(updateStatusBar)
  );

  // Main conversion command
  context.subscriptions.push(
    vscode.commands.registerCommand('c2st.convertSelection', () =>
      runConversion(context)
    )
  );

  // Command to update the API key at any time
  context.subscriptions.push(
    vscode.commands.registerCommand('c2st.setApiKey', () =>
      promptForApiKey(context)
    )
  );
}

function updateStatusBar(editor: vscode.TextEditor | undefined) {
  if (editor && editor.document.languageId === 'c') {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  // Check VS Code settings first (user may have set it there)
  const config = vscode.workspace.getConfiguration('c2st');
  let key = config.get<string>('mistralApiKey');

  if (key && key.trim().length > 0) {
    return key.trim();
  }

  // Fall back to secret storage (set via the Set Key command)
  key = await context.secrets.get('c2st.mistralApiKey');
  if (key && key.trim().length > 0) {
    return key.trim();
  }

  return undefined;
}

async function promptForApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  const key = await vscode.window.showInputBox({
    prompt: 'Enter your Mistral API key',
    placeHolder: 'sk-...',
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? 'API key cannot be empty' : undefined),
  });

  if (!key) {
    return undefined;
  }

  // Store in VS Code secret storage (never written to disk in plain text)
  await context.secrets.store('c2st.mistralApiKey', key.trim());
  vscode.window.showInformationMessage('C2ST: Mistral API key saved.');
  return key.trim();
}

async function runConversion(context: vscode.ExtensionContext) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('C2ST: No active editor.');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    vscode.window.showErrorMessage('C2ST: Select some C code first.');
    return;
  }

  if (selectedText.length > MAX_SELECTION_CHARS) {
    vscode.window.showErrorMessage(
      `C2ST: Selection is too large (${selectedText.length} chars). Maximum is ${MAX_SELECTION_CHARS} to avoid excessive API costs.`
    );
    return;
  }

  // Resolve API key — prompt if missing
  let apiKey = await getApiKey(context);
  if (!apiKey) {
    const action = await vscode.window.showWarningMessage(
      'C2ST: No Mistral API key configured. Get one at https://console.mistral.ai/',
      'Enter API Key',
      'Cancel'
    );
    if (action !== 'Enter API Key') {
      return;
    }
    apiKey = await promptForApiKey(context);
    if (!apiKey) {
      return;
    }
  }

  const model =
    vscode.workspace.getConfiguration('c2st').get<string>('model') ?? 'mistral-large-latest';

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Converting C to Structured Text...',
      cancellable: false,
    },
    async () => {
      const result = await callMistral(apiKey!, model, selectedText);
      if (result) {
        await openResultDocument(result);
      }
    }
  );
}

async function callMistral(
  apiKey: string,
  model: string,
  cCode: string
): Promise<string | undefined> {
  try {
    const response = await axios.post(
      'https://api.mistral.ai/v1/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: cCode },
        ],
        temperature: 0.1, // Low temperature for deterministic code output
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      }
    );

    const content: string | undefined =
      response.data?.choices?.[0]?.message?.content;

    if (!content) {
      vscode.window.showErrorMessage('C2ST: Mistral returned an empty response.');
      return undefined;
    }

    return content;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      if (status === 401) {
        vscode.window.showErrorMessage(
          'C2ST: Invalid Mistral API key (401). Run "C2ST: Set Mistral API Key" to update it.'
        );
      } else if (status === 429) {
        vscode.window.showErrorMessage(
          'C2ST: Mistral rate limit hit (429). Wait a moment and try again.'
        );
      } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        vscode.window.showErrorMessage(
          'C2ST: Request timed out. Check your network and try again.'
        );
      } else if (!err.response) {
        vscode.window.showErrorMessage(
          'C2ST: Network error — could not reach Mistral API. Check your internet connection.'
        );
      } else {
        vscode.window.showErrorMessage(
          `C2ST: Mistral API error ${status ?? 'unknown'}: ${err.response?.data?.message ?? err.message}`
        );
      }
    } else {
      vscode.window.showErrorMessage(`C2ST: Unexpected error: ${String(err)}`);
    }
    return undefined;
  }
}

async function openResultDocument(stCode: string) {
  const editor = vscode.window.activeTextEditor;

  // Derive output path: same directory as source file, or OS temp dir for untitled
  let outPath: string;
  if (editor && !editor.document.isUntitled) {
    const src = editor.document.uri.fsPath;
    const base = path.basename(src, path.extname(src));
    outPath = path.join(path.dirname(src), `${base}_c2st.st`);
  } else {
    outPath = path.join(os.tmpdir(), `c2st_output_${Date.now()}.st`);
  }

  fs.writeFileSync(outPath, stCode, 'utf8');

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outPath));
  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
  });
}

export function deactivate() {
  statusBarItem?.dispose();
}
