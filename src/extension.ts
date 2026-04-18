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

export const MAX_SELECTION_CHARS = 10_000;

// Mistral API response schema
interface MistralResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
    index: number;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  id: string;
  model: string;
  created: number;
}

// Type guard to validate Mistral API response structure
function validateMistralResponse(data: unknown): data is MistralResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }
  
  const resp = data as any;
  
  // Check required fields
  if (!Array.isArray(resp.choices)) {
    return false;
  }
  
  if (resp.choices.length === 0) {
    return false;
  }
  
  const firstChoice = resp.choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    return false;
  }
  
  if (!firstChoice.message || typeof firstChoice.message !== 'object') {
    return false;
  }
  
  if (typeof firstChoice.message.content !== 'string') {
    return false;
  }
  
  // All required fields are present and valid
  return true;
}

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('C2ST');
  context.subscriptions.push(outputChannel);
  
  outputChannel.appendLine('[INFO] C2ST extension activated');
  outputChannel.appendLine(`[INFO] Version: ${context.extension.packageJSON.version}`);

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

  // Command to open output channel logs
  context.subscriptions.push(
    vscode.commands.registerCommand('c2st.showLogs', () => {
      outputChannel.show();
    })
  );
}

function updateStatusBar(editor: vscode.TextEditor | undefined) {
  if (editor && editor.document.languageId === 'c') {
    statusBarItem.show();
  } else {
    statusBarItem.hide();
  }
}

export async function getApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  outputChannel.appendLine('[DEBUG] Retrieving API key...');
  
  // Check VS Code settings first (user may have set it there)
  const config = vscode.workspace.getConfiguration('c2st');
  let key = config.get<string>('mistralApiKey');

  if (key && key.trim().length > 0) {
    outputChannel.appendLine('[DEBUG] API key found in VS Code settings');
    return key.trim();
  }

  // Fall back to secret storage (set via the Set Key command)
  key = await context.secrets.get('c2st.mistralApiKey');
  if (key && key.trim().length > 0) {
    outputChannel.appendLine('[DEBUG] API key found in secret storage');
    return key.trim();
  }

  outputChannel.appendLine('[WARN] No API key configured');
  return undefined;
}

export async function promptForApiKey(context: vscode.ExtensionContext): Promise<string | undefined> {
  outputChannel.appendLine('[INFO] Prompting user for API key...');
  
  const key = await vscode.window.showInputBox({
    prompt: 'Enter your Mistral API key',
    placeHolder: 'sk-...',
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? 'API key cannot be empty' : undefined),
  });

  if (!key) {
    outputChannel.appendLine('[INFO] User cancelled API key input');
    return undefined;
  }

  // Store in VS Code secret storage (never written to disk in plain text)
  await context.secrets.store('c2st.mistralApiKey', key.trim());
  outputChannel.appendLine('[INFO] API key saved to secure storage');
  vscode.window.showInformationMessage('C2ST: Mistral API key saved.');
  return key.trim();
}

export async function runConversion(context: vscode.ExtensionContext) {
  outputChannel.appendLine('[INFO] Starting conversion...');
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    outputChannel.appendLine('[ERROR] No active editor');
    vscode.window.showErrorMessage('C2ST: No active editor.');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    outputChannel.appendLine('[ERROR] No text selected');
    vscode.window.showErrorMessage('C2ST: Select some C code first.');
    return;
  }

  outputChannel.appendLine(`[DEBUG] Selection length: ${selectedText.length} characters`);

  if (selectedText.length > MAX_SELECTION_CHARS) {
    outputChannel.appendLine(`[ERROR] Selection exceeds maximum size (${selectedText.length} > ${MAX_SELECTION_CHARS})`);
    vscode.window.showErrorMessage(
      `C2ST: Selection is too large (${selectedText.length} chars). Maximum is ${MAX_SELECTION_CHARS} to avoid excessive API costs.`
    );
    return;
  }

  // Resolve API key — prompt if missing
  let apiKey = await getApiKey(context);
  if (!apiKey) {
    outputChannel.appendLine('[WARN] API key not configured, prompting user...');
    const action = await vscode.window.showWarningMessage(
      'C2ST: No Mistral API key configured. Get one at https://console.mistral.ai/',
      'Enter API Key',
      'Cancel'
    );
    if (action !== 'Enter API Key') {
      outputChannel.appendLine('[INFO] User cancelled API key setup');
      return;
    }
    apiKey = await promptForApiKey(context);
    if (!apiKey) {
      return;
    }
  }

  const model =
    vscode.workspace.getConfiguration('c2st').get<string>('model') ?? 'mistral-large-latest';
  
  outputChannel.appendLine(`[INFO] Using model: ${model}`);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Converting C to Structured Text...',
      cancellable: false,
    },
    async () => {
      const startTime = Date.now();
      const result = await callMistral(apiKey!, model, selectedText);
      const duration = Date.now() - startTime;
      
      if (result) {
        outputChannel.appendLine(`[INFO] Conversion completed successfully in ${duration}ms`);
        outputChannel.appendLine(`[DEBUG] Result length: ${result.length} characters`);
        await openResultDocument(result);
      } else {
        outputChannel.appendLine(`[ERROR] Conversion failed after ${duration}ms`);
      }
    }
  );
}

export async function callMistral(
  apiKey: string,
  model: string,
  cCode: string
): Promise<string | undefined> {
  outputChannel.appendLine('[INFO] Calling Mistral API...');
  outputChannel.appendLine(`[DEBUG] Model: ${model}, Input length: ${cCode.length} chars`);
  
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

    outputChannel.appendLine(`[DEBUG] API response status: ${response.status}`);

    // Validate response structure
    if (!validateMistralResponse(response.data)) {
      outputChannel.appendLine('[ERROR] Invalid API response structure');
      outputChannel.appendLine(`[DEBUG] Response data: ${JSON.stringify(response.data, null, 2).substring(0, 500)}...`);
      vscode.window.showErrorMessage('C2ST: Received invalid response from Mistral API. The API response format may have changed.');
      return undefined;
    }

    const content = response.data.choices[0].message.content;

    if (!content || content.trim().length === 0) {
      outputChannel.appendLine('[ERROR] API returned empty content');
      vscode.window.showErrorMessage('C2ST: Mistral returned an empty response.');
      return undefined;
    }

    outputChannel.appendLine('[INFO] API call successful');
    outputChannel.appendLine(`[DEBUG] Response tokens - prompt: ${response.data.usage?.prompt_tokens ?? 'N/A'}, completion: ${response.data.usage?.completion_tokens ?? 'N/A'}, total: ${response.data.usage?.total_tokens ?? 'N/A'}`);
    return content;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      outputChannel.appendLine(`[ERROR] API call failed: ${err.message}`);
      
      if (status === 401) {
        outputChannel.appendLine('[ERROR] Authentication failed (401)');
        vscode.window.showErrorMessage(
          'C2ST: Invalid Mistral API key (401). Run "C2ST: Set Mistral API Key" to update it.'
        );
      } else if (status === 429) {
        outputChannel.appendLine('[ERROR] Rate limit exceeded (429)');
        vscode.window.showErrorMessage(
          'C2ST: Mistral rate limit hit (429). Wait a moment and try again.'
        );
      } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        outputChannel.appendLine(`[ERROR] Request timeout (${err.code})`);
        vscode.window.showErrorMessage(
          'C2ST: Request timed out. Check your network and try again.'
        );
      } else if (!err.response) {
        outputChannel.appendLine('[ERROR] Network error - no response from server');
        vscode.window.showErrorMessage(
          'C2ST: Network error — could not reach Mistral API. Check your internet connection.'
        );
      } else {
        outputChannel.appendLine(`[ERROR] API error ${status}: ${err.response?.data?.message ?? err.message}`);
        vscode.window.showErrorMessage(
          `C2ST: Mistral API error ${status ?? 'unknown'}: ${err.response?.data?.message ?? err.message}`
        );
      }
    } else {
      outputChannel.appendLine(`[ERROR] Unexpected error: ${String(err)}`);
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

  outputChannel.appendLine(`[INFO] Writing result to: ${outPath}`);

  fs.writeFileSync(outPath, stCode, 'utf8');
  outputChannel.appendLine('[INFO] File written successfully');

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outPath));
  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
  });
  
  outputChannel.appendLine('[INFO] Result document opened');
}

export function deactivate() {
  outputChannel?.appendLine('[INFO] C2ST extension deactivated');
  statusBarItem?.dispose();
  outputChannel?.dispose();
}
