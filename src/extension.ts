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

export type AIProvider = 'mistral' | 'openai' | 'anthropic' | 'google';

export const PROVIDER_NAMES: Record<AIProvider, string> = {
  mistral: 'Mistral AI',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI (Gemini)'
};

let statusBarItem: vscode.StatusBarItem;
let outputChannel: vscode.OutputChannel | undefined;

// Helper function to safely log to output channel (handles cases where tests call functions directly)
function log(message: string): void {
  if (outputChannel) {
    outputChannel.appendLine(message);
  }
}

export function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('C2ST');
  context.subscriptions.push(outputChannel);
  
  log('[INFO] C2ST extension activated');
  log(`[INFO] Version: ${context.extension.packageJSON.version}`);

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

  // Command to update the AI provider and API key
  context.subscriptions.push(
    vscode.commands.registerCommand('c2st.configureProvider', () =>
      configureProvider(context)
    )
  );

  // Command to open output channel logs
  context.subscriptions.push(
    vscode.commands.registerCommand('c2st.showLogs', () => {
      if (outputChannel) {
        outputChannel.show();
      }
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

export async function getApiKey(context: vscode.ExtensionContext, provider: AIProvider): Promise<string | undefined> {
  log(`[DEBUG] Retrieving API key for ${provider}...`);

  // Check VS Code settings first (user may have set it there)
  const config = vscode.workspace.getConfiguration('c2st');
  let key = config.get<string>(`${provider}ApiKey`);

  if (key && key.trim().length > 0) {
    log('[DEBUG] API key found in VS Code settings');
    return key.trim();
  }

  // Fall back to secret storage
  const secretKey = `c2st.${provider}ApiKey`;
  key = await context.secrets.get(secretKey);
  if (key && key.trim().length > 0) {
    log('[DEBUG] API key found in secret storage');
    return key.trim();
  }

  log(`[WARN] No API key configured for ${provider}`);
  return undefined;
}

export async function promptForApiKey(context: vscode.ExtensionContext, provider: AIProvider): Promise<string | undefined> {
  const providerName = PROVIDER_NAMES[provider];
  log(`[INFO] Prompting user for ${providerName} API key...`);
  const key = await vscode.window.showInputBox({
    prompt: `Enter your ${providerName} API key`,
    placeHolder: 'API Key...',
    password: true,
    ignoreFocusOut: true,
    validateInput: (v) => (v.trim().length === 0 ? 'API key cannot be empty' : undefined),
  });

  if (!key) {
    log('[INFO] User cancelled API key input');
    return undefined;
  }

  // Store in VS Code secret storage (never written to disk in plain text)
  await context.secrets.store(`c2st.${provider}ApiKey`, key.trim());
  log(`[INFO] ${providerName} API key saved to secure storage`);
  vscode.window.showInformationMessage(`C2ST: ${providerName} API key saved.`);
  return key.trim();
}

export async function configureProvider(context: vscode.ExtensionContext): Promise<AIProvider | undefined> {
  const providerKeys = Object.keys(PROVIDER_NAMES) as AIProvider[];
  const items = providerKeys.map(key => ({
    label: PROVIDER_NAMES[key],
    providerId: key
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select the AI provider to use for conversion',
    ignoreFocusOut: true
  });

  if (!selected) {
    return undefined;
  }

  const provider = selected.providerId;
  await vscode.workspace.getConfiguration('c2st').update('aiProvider', provider, vscode.ConfigurationTarget.Global);

  await promptForApiKey(context, provider);
  return provider;
}

export async function runConversion(context: vscode.ExtensionContext) {
  log('[INFO] Starting conversion...');
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    log('[ERROR] No active editor');
    vscode.window.showErrorMessage('C2ST: No active editor.');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    log('[ERROR] No text selected');
    vscode.window.showErrorMessage('C2ST: Select some C code first.');
    return;
  }

  log(`[DEBUG] Selection length: ${selectedText.length} characters`);

  if (selectedText.length > MAX_SELECTION_CHARS) {
    log(`[ERROR] Selection exceeds maximum size (${selectedText.length} > ${MAX_SELECTION_CHARS})`);
    vscode.window.showErrorMessage(
      `C2ST: Selection is too large (${selectedText.length} chars). Maximum is ${MAX_SELECTION_CHARS} to avoid excessive API costs.`
    );
    return;
  }

  let provider = vscode.workspace.getConfiguration('c2st').get<AIProvider>('aiProvider');

  // Validate that the provider is one of the allowed enums, default to mistral if not set
  if (!provider || !Object.keys(PROVIDER_NAMES).includes(provider)) {
    provider = 'mistral';
  }

  let apiKey = await getApiKey(context, provider);

  if (!apiKey) {
    const providerName = PROVIDER_NAMES[provider];
    log(`[WARN] ${providerName} API key not configured, prompting user...`);
    const action = await vscode.window.showWarningMessage(
      `C2ST: No ${providerName} API key configured.`,
      'Configure Provider/Key',
      'Cancel'
    );
    if (action !== 'Configure Provider/Key') {
      log('[INFO] User cancelled provider/API key setup');
      return;
    }
    const newProvider = await configureProvider(context);
    if (!newProvider) {
      return; // User cancelled
    }
    provider = newProvider;
    apiKey = await getApiKey(context, provider);
    if (!apiKey) {
      return;
    }
  }

  const model = vscode.workspace.getConfiguration('c2st').get<string>('model');
  if (model) {
    log(`[INFO] Using configured model: ${model}`);
  }
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Converting C to Structured Text (${PROVIDER_NAMES[provider]})...`,
      cancellable: false,
    },
    async () => {
      const startTime = Date.now();
      const result = await callAI(provider!, apiKey!, selectedText, model);
      const duration = Date.now() - startTime;
      if (result) {
        log(`[INFO] Conversion completed successfully in ${duration}ms`);
        log(`[DEBUG] Result length: ${result.length} characters`);
        await openResultDocument(result);
      } else {
        log(`[ERROR] Conversion failed after ${duration}ms`);
      }
    }
  );
}

export async function callAI(
  provider: AIProvider,
  apiKey: string,
  cCode: string,
  customModel?: string
): Promise<string | undefined> {
  log(`[INFO] Calling ${PROVIDER_NAMES[provider]} API...`);
  log(`[DEBUG] Input length: ${cCode.length} chars`);

  switch (provider) {
    case 'mistral':
      return callMistral(apiKey, cCode, customModel);
    case 'openai':
      return callOpenAI(apiKey, cCode, customModel);
    case 'anthropic':
      return callAnthropic(apiKey, cCode, customModel);
    case 'google':
      return callGoogle(apiKey, cCode, customModel);
    default:
      vscode.window.showErrorMessage(`C2ST: Unsupported AI provider: ${provider}`);
      return undefined;
  }
}

export async function callMistral(apiKey: string, cCode: string, customModel?: string): Promise<string | undefined> {
  const model = customModel && customModel.trim().length > 0 ? customModel : 'mistral-large-latest';
  log(`[DEBUG] Model: ${model}`);
  return callGenericOpenAIEndpoint(
    'https://api.mistral.ai/v1/chat/completions',
    apiKey,
    model,
    cCode,
    'Mistral'
  );
}

export async function callOpenAI(apiKey: string, cCode: string, customModel?: string): Promise<string | undefined> {
  const model = customModel && customModel.trim().length > 0 ? customModel : 'gpt-4o';
  log(`[DEBUG] Model: ${model}`);
  return callGenericOpenAIEndpoint(
    'https://api.openai.com/v1/chat/completions',
    apiKey,
    model,
    cCode,
    'OpenAI'
  );
}

export async function callAnthropic(apiKey: string, cCode: string, customModel?: string): Promise<string | undefined> {
  const model = customModel && customModel.trim().length > 0 ? customModel : 'claude-3-5-sonnet-20241022';
  log(`[DEBUG] Model: ${model}`);
  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: cCode },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 60_000,
      }
    );

    const content: string | undefined = response.data?.content?.[0]?.text;
    if (!content) {
      vscode.window.showErrorMessage('C2ST: Anthropic returned an empty response.');
      return undefined;
    }
    return content;
  } catch (err) {
    handleApiError(err, 'Anthropic');
    return undefined;
  }
}

export async function callGoogle(apiKey: string, cCode: string, customModel?: string): Promise<string | undefined> {
  const model = customModel && customModel.trim().length > 0 ? customModel : 'gemini-1.5-pro';
  log(`[DEBUG] Model: ${model}`);
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }]
        },
        contents: [{
          parts: [{ text: cCode }]
        }],
        generationConfig: {
          temperature: 0.1,
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        timeout: 60_000,
      }
    );

    const content: string | undefined = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      vscode.window.showErrorMessage('C2ST: Google AI returned an empty response.');
      return undefined;
    }
    return content;
  } catch (err) {
    handleApiError(err, 'Google AI');
    return undefined;
  }
}

async function callGenericOpenAIEndpoint(url: string, apiKey: string, model: string, cCode: string, providerName: string): Promise<string | undefined> {
  try {
    const response = await axios.post(
      url,
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: cCode },
        ],
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      }
    );

    log(`[DEBUG] API response status: ${response.status}`);

    // For Mistral, validate response structure more strictly
    if (providerName === 'Mistral') {
      if (!validateMistralResponse(response.data)) {
        log('[ERROR] Invalid API response structure');
        log(`[DEBUG] Response data: ${JSON.stringify(response.data, null, 2).substring(0, 500)}...`);
        vscode.window.showErrorMessage('C2ST: Received invalid response from Mistral API. The API response format may have changed.');
        return undefined;
      }
    }

    const content: string | undefined = response.data?.choices?.[0]?.message?.content;

    if (!content || content.trim().length === 0) {
      log('[ERROR] API returned empty content');
      vscode.window.showErrorMessage(`C2ST: ${providerName} returned an empty response.`);
      return undefined;
    }

    log('[INFO] API call successful');
    log(`[DEBUG] Response tokens - prompt: ${response.data.usage?.prompt_tokens ?? 'N/A'}, completion: ${response.data.usage?.completion_tokens ?? 'N/A'}, total: ${response.data.usage?.total_tokens ?? 'N/A'}`);
    return content;
  } catch (err: unknown) {
    handleApiError(err, providerName);
    return undefined;
  }
}

function handleApiError(err: unknown, providerName: string) {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    log(`[ERROR] ${providerName} API call failed: ${err.message}`);

    if (status === 401) {
      log(`[ERROR] Authentication failed (401) for ${providerName}`);
      vscode.window.showErrorMessage(
        `C2ST: Invalid ${providerName} API key (401). Run "C2ST: Configure AI Provider and API Key" to update it.`
      );
    } else if (status === 429) {
      log(`[ERROR] Rate limit exceeded (429) for ${providerName}`);
      vscode.window.showErrorMessage(
        `C2ST: ${providerName} rate limit hit (429). Wait a moment and try again.`
      );
    } else if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      log(`[ERROR] Request timeout (${err.code}) for ${providerName}`);
      vscode.window.showErrorMessage(
        `C2ST: Request timed out. Check your network and try again.`
      );
    } else if (!err.response) {
      log(`[ERROR] Network error - no response from ${providerName} server`);
      vscode.window.showErrorMessage(
        `C2ST: Network error — could not reach ${providerName} API. Check your internet connection.`
      );
    } else {
      let message = err.response?.data?.message || err.response?.data?.error?.message || err.message;
      log(`[ERROR] API error ${status}: ${message}`);
      vscode.window.showErrorMessage(
        `C2ST: ${providerName} API error ${status ?? 'unknown'}: ${message}`
      );
    }
  } else {
    log(`[ERROR] Unexpected error: ${String(err)}`);
    vscode.window.showErrorMessage(`C2ST: Unexpected error: ${String(err)}`);
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

  log(`[INFO] Writing result to: ${outPath}`);

  fs.writeFileSync(outPath, stCode, 'utf8');
  log('[INFO] File written successfully');

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(outPath));
  await vscode.window.showTextDocument(doc, {
    viewColumn: vscode.ViewColumn.Beside,
    preserveFocus: false,
  });
  
  log('[INFO] Result document opened');
}

export function deactivate() {
  log('[INFO] C2ST extension deactivated');
  statusBarItem?.dispose();
  outputChannel?.dispose();
}
