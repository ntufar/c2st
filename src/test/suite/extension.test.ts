import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import axios from 'axios';

// Import the exported functions under test
import {
  getApiKey,
  callMistral,
  runConversion,
  MAX_SELECTION_CHARS,
} from '../../extension';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fake ExtensionContext for testing. */
function makeFakeContext(
  secretValue?: string,
  settingsValue?: string
): vscode.ExtensionContext {
  return {
    secrets: {
      get: sinon.stub().resolves(secretValue),
      store: sinon.stub().resolves(),
      delete: sinon.stub().resolves(),
      onDidChange: new vscode.EventEmitter<vscode.SecretStorageChangeEvent>().event,
    },
    subscriptions: [],
    // Provide minimal stubs for everything else the functions touch
  } as unknown as vscode.ExtensionContext;
}

// ---------------------------------------------------------------------------
// getApiKey
// ---------------------------------------------------------------------------

describe('getApiKey', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should retrieve API key from VS Code settings when present', async () => {
    const getConfigStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: (key: string) => (key === 'mistralApiKey' ? 'settings-key' : undefined),
      has: () => false,
      inspect: () => undefined,
      update: async () => {},
    } as unknown as vscode.WorkspaceConfiguration);

    const ctx = makeFakeContext();
    const result = await getApiKey(ctx);

    assert.strictEqual(result, 'settings-key');
    sinon.assert.notCalled(ctx.secrets.get as sinon.SinonStub);
    getConfigStub.restore();
  });

  it('should fall back to secret storage when settings key is empty', async () => {
    const getConfigStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => '',
      has: () => false,
      inspect: () => undefined,
      update: async () => {},
    } as unknown as vscode.WorkspaceConfiguration);

    const ctx = makeFakeContext('secret-key');
    const result = await getApiKey(ctx);

    assert.strictEqual(result, 'secret-key');
    sinon.assert.calledOnce(ctx.secrets.get as sinon.SinonStub);
    getConfigStub.restore();
  });

  it('should return undefined when no key exists in settings or secrets', async () => {
    const getConfigStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => '',
      has: () => false,
      inspect: () => undefined,
      update: async () => {},
    } as unknown as vscode.WorkspaceConfiguration);

    const ctx = makeFakeContext(undefined);
    const result = await getApiKey(ctx);

    assert.strictEqual(result, undefined);
    getConfigStub.restore();
  });

  it('should trim whitespace from settings key', async () => {
    const getConfigStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => '  my-api-key  ',
      has: () => false,
      inspect: () => undefined,
      update: async () => {},
    } as unknown as vscode.WorkspaceConfiguration);

    const ctx = makeFakeContext();
    const result = await getApiKey(ctx);

    assert.strictEqual(result, 'my-api-key');
    getConfigStub.restore();
  });

  it('should trim whitespace from secret storage key', async () => {
    const getConfigStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => '',
      has: () => false,
      inspect: () => undefined,
      update: async () => {},
    } as unknown as vscode.WorkspaceConfiguration);

    const ctx = makeFakeContext('  secret-key  ');
    const result = await getApiKey(ctx);

    assert.strictEqual(result, 'secret-key');
    getConfigStub.restore();
  });
});

// ---------------------------------------------------------------------------
// callMistral
// ---------------------------------------------------------------------------

describe('callMistral', () => {
  let sandbox: sinon.SinonSandbox;
  let showErrorStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should return converted content on successful API response', async () => {
    const axiosPostStub = sandbox.stub(axios, 'post').resolves({
      data: {
        choices: [{ message: { content: 'PROGRAM main\nEND_PROGRAM' } }],
      },
    });

    const result = await callMistral('test-key', 'mistral-large-latest', 'int x = 0;');

    assert.strictEqual(result, 'PROGRAM main\nEND_PROGRAM');
    sinon.assert.calledOnce(axiosPostStub);
    sinon.assert.notCalled(showErrorStub);
  });

  it('should show error and return undefined on 401 unauthorized', async () => {
    const error = new axios.AxiosError('Unauthorized');
    error.response = { status: 401 } as never;
    sandbox.stub(axios, 'post').rejects(error);

    const result = await callMistral('bad-key', 'mistral-large-latest', 'int x = 0;');

    assert.strictEqual(result, undefined);
    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(msg.includes('401'), `Expected 401 in message, got: ${msg}`);
  });

  it('should show error and return undefined on 429 rate limit', async () => {
    const error = new axios.AxiosError('Too Many Requests');
    error.response = { status: 429 } as never;
    sandbox.stub(axios, 'post').rejects(error);

    const result = await callMistral('test-key', 'mistral-large-latest', 'int x = 0;');

    assert.strictEqual(result, undefined);
    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(msg.includes('429'), `Expected 429 in message, got: ${msg}`);
  });

  it('should show error and return undefined on ECONNABORTED timeout', async () => {
    const error = new axios.AxiosError('timeout of 60000ms exceeded');
    error.code = 'ECONNABORTED';
    sandbox.stub(axios, 'post').rejects(error);

    const result = await callMistral('test-key', 'mistral-large-latest', 'int x = 0;');

    assert.strictEqual(result, undefined);
    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(
      msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('timed out'),
      `Expected timeout in message, got: ${msg}`
    );
  });

  it('should show error and return undefined on network error (no response)', async () => {
    const error = new axios.AxiosError('Network Error');
    // No error.response = network error
    sandbox.stub(axios, 'post').rejects(error);

    const result = await callMistral('test-key', 'mistral-large-latest', 'int x = 0;');

    assert.strictEqual(result, undefined);
    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(
      msg.toLowerCase().includes('network'),
      `Expected 'network' in message, got: ${msg}`
    );
  });

  it('should show error and return undefined when Mistral returns empty response', async () => {
    sandbox.stub(axios, 'post').resolves({
      data: {
        choices: [{ message: { content: '' } }],
      },
    });

    const result = await callMistral('test-key', 'mistral-large-latest', 'int x = 0;');

    assert.strictEqual(result, undefined);
    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(
      msg.toLowerCase().includes('empty'),
      `Expected 'empty' in message, got: ${msg}`
    );
  });

  it('should show error and return undefined when choices array is missing', async () => {
    sandbox.stub(axios, 'post').resolves({
      data: {},
    });

    const result = await callMistral('test-key', 'mistral-large-latest', 'int x = 0;');

    assert.strictEqual(result, undefined);
    sinon.assert.calledOnce(showErrorStub);
  });

  it('should show generic error for unexpected non-Axios errors', async () => {
    sandbox.stub(axios, 'post').rejects(new Error('Something exploded'));

    const result = await callMistral('test-key', 'mistral-large-latest', 'int x = 0;');

    assert.strictEqual(result, undefined);
    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(msg.includes('Unexpected error'), `Expected 'Unexpected error' in message, got: ${msg}`);
  });
});

// ---------------------------------------------------------------------------
// runConversion
// ---------------------------------------------------------------------------

describe('runConversion', () => {
  let sandbox: sinon.SinonSandbox;
  let showErrorStub: sinon.SinonStub;
  let showWarningStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage');
    showWarningStub = sandbox.stub(vscode.window, 'showWarningMessage');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should show error and return when there is no active editor', async () => {
    sandbox.stub(vscode.window, 'activeTextEditor').value(undefined);

    const ctx = makeFakeContext('some-key');
    await runConversion(ctx);

    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(
      msg.toLowerCase().includes('no active editor'),
      `Expected 'no active editor' in message, got: ${msg}`
    );
  });

  it('should show error when selection is empty', async () => {
    const fakeEditor = {
      selection: new vscode.Selection(0, 0, 0, 0),
      document: {
        getText: () => '',
        languageId: 'c',
        isUntitled: false,
        uri: vscode.Uri.file('/tmp/test.c'),
      },
    } as unknown as vscode.TextEditor;

    sandbox.stub(vscode.window, 'activeTextEditor').value(fakeEditor);

    const ctx = makeFakeContext('some-key');
    await runConversion(ctx);

    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(
      msg.toLowerCase().includes('select'),
      `Expected 'select' in message, got: ${msg}`
    );
  });

  it('should show error when selection is whitespace-only', async () => {
    const fakeEditor = {
      selection: new vscode.Selection(0, 0, 0, 5),
      document: {
        getText: () => '   \n  ',
        languageId: 'c',
        isUntitled: false,
        uri: vscode.Uri.file('/tmp/test.c'),
      },
    } as unknown as vscode.TextEditor;

    sandbox.stub(vscode.window, 'activeTextEditor').value(fakeEditor);

    const ctx = makeFakeContext('some-key');
    await runConversion(ctx);

    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(
      msg.toLowerCase().includes('select'),
      `Expected 'select' in message, got: ${msg}`
    );
  });

  it('should show error when selection exceeds MAX_SELECTION_CHARS', async () => {
    const oversizedText = 'x'.repeat(MAX_SELECTION_CHARS + 1);
    const fakeEditor = {
      selection: new vscode.Selection(0, 0, 0, oversizedText.length),
      document: {
        getText: () => oversizedText,
        languageId: 'c',
        isUntitled: false,
        uri: vscode.Uri.file('/tmp/test.c'),
      },
    } as unknown as vscode.TextEditor;

    sandbox.stub(vscode.window, 'activeTextEditor').value(fakeEditor);

    const ctx = makeFakeContext('some-key');
    await runConversion(ctx);

    sinon.assert.calledOnce(showErrorStub);
    const msg = (showErrorStub.firstCall.args[0] as string);
    assert.ok(
      msg.toLowerCase().includes('too large') || msg.toLowerCase().includes('maximum'),
      `Expected size error in message, got: ${msg}`
    );
  });

  it('should prompt user for API key when none is configured', async () => {
    const fakeEditor = {
      selection: new vscode.Selection(0, 0, 0, 10),
      document: {
        getText: () => 'int x = 0;',
        languageId: 'c',
        isUntitled: false,
        uri: vscode.Uri.file('/tmp/test.c'),
      },
    } as unknown as vscode.TextEditor;

    sandbox.stub(vscode.window, 'activeTextEditor').value(fakeEditor);

    // No API key in settings or secrets
    const getConfigStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
      get: () => '',
      has: () => false,
      inspect: () => undefined,
      update: async () => {},
    } as unknown as vscode.WorkspaceConfiguration);

    const ctx = makeFakeContext(undefined); // no secret key either
    // User clicks Cancel on the warning message
    showWarningStub.resolves('Cancel');

    await runConversion(ctx);

    sinon.assert.calledOnce(showWarningStub);
    const msg = (showWarningStub.firstCall.args[0] as string);
    assert.ok(
      msg.toLowerCase().includes('api key'),
      `Expected 'api key' in warning, got: ${msg}`
    );

    getConfigStub.restore();
  });
});
