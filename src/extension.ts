import * as vscode from 'vscode';
import * as path from 'node:path';

type MoleculeFile = {
  name: string;
  extension: 'xyz' | 'trj';
  content: string;
};

const allowedExtensions = new Set(['.xyz', '.trj']);

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'reactionViewer.open',
      async (clicked?: vscode.Uri, selected?: vscode.Uri[]) => {
        try {
          const uris = await chooseFiles(clicked, selected);
          if (!uris) {
            return;
          }
          const files = await Promise.all(uris.map(readMoleculeFile));
          openViewer(context, files);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          void vscode.window.showErrorMessage(`Reaction Viewer: ${message}`);
        }
      },
    ),
  );
}

async function chooseFiles(
  clicked?: vscode.Uri,
  selected?: vscode.Uri[],
): Promise<vscode.Uri[] | undefined> {
  const explorerSelection = (selected?.length ? selected : clicked ? [clicked] : [])
    .filter((uri) => allowedExtensions.has(path.extname(uri.fsPath).toLowerCase()));

  const uris = explorerSelection.length
    ? explorerSelection
    : await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: true,
        filters: { 'XYZ trajectories': ['xyz', 'trj'] },
        openLabel: 'Compare molecules',
        title: 'Select 1–3 XYZ/TRJ files',
      });

  if (!uris) {
    return undefined;
  }
  if (uris.length < 1 || uris.length > 3) {
    throw new Error('Please select between 1 and 3 XYZ/TRJ files.');
  }
  const invalid = uris.find((uri) => !allowedExtensions.has(path.extname(uri.fsPath).toLowerCase()));
  if (invalid) {
    throw new Error(`Unsupported file: ${path.basename(invalid.fsPath)}`);
  }
  return uris;
}

async function readMoleculeFile(uri: vscode.Uri): Promise<MoleculeFile> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  const extension = path.extname(uri.fsPath).slice(1).toLowerCase() as 'xyz' | 'trj';
  return {
    name: path.basename(uri.fsPath),
    extension,
    content: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
  };
}

function openViewer(context: vscode.ExtensionContext, files: MoleculeFile[]): void {
  const panel = vscode.window.createWebviewPanel(
    'reactionViewer',
    `Reaction Viewer — ${files.map((file) => file.name).join(', ')}`,
    vscode.ViewColumn.Active,
    { enableScripts: true, retainContextWhenHidden: true },
  );

  const webview = panel.webview;
  const media = vscode.Uri.joinPath(context.extensionUri, 'media');
  const molScript = webview.asWebviewUri(vscode.Uri.joinPath(media, '3Dmol-min.js'));
  const mathScript = webview.asWebviewUri(vscode.Uri.joinPath(media, 'math.js'));
  const appScript = webview.asWebviewUri(vscode.Uri.joinPath(media, 'app.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(media, 'style.css'));
  const nonce = createNonce();
  const serialized = escapeJsonForHtml(JSON.stringify(files));

  webview.html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>Reaction Viewer</title>
</head>
<body>
  <header class="toolbar">
    <div class="brand"><strong>Reaction Viewer</strong><span id="status">Loading…</span></div>
    <div class="actions">
      <button id="centerButton" title="Remove translation independently from each molecule">Center XYZ</button>
      <button id="alignButton" title="Rigid least-squares alignment to the first molecule">Kabsch align</button>
      <button id="resetButton">Reset view</button>
      <span class="divider"></span>
      <label class="check-label" title="Show detected metal–donor contacts as thin dashed bonds"><input id="coordinationToggle" type="checkbox" checked> Coordination</label>
      <label title="Distance threshold used for automatic coordination-bond detection">Cutoff <select id="coordinationCutoff"><option value="1.20">Strict</option><option value="1.32" selected>Normal</option><option value="1.48">Wide</option></select></label>
      <label class="check-label" title="Highlight bonds and atoms that change from reactant to product"><input id="reactionCenterToggle" type="checkbox" checked disabled> Reaction center</label>
      <span class="divider"></span>
      <button id="playButton">▶ Play</button>
      <input id="frameSlider" type="range" min="0" max="0" value="0" aria-label="Trajectory frame">
      <span id="frameLabel">1 / 1</span>
      <label>Speed <select id="speedSelect"><option value="500">0.5×</option><option value="250" selected>1×</option><option value="125">2×</option><option value="62">4×</option></select></label>
    </div>
  </header>
  <section id="reactionSummary" aria-label="Reaction energetics" hidden></section>
  <main id="viewers"></main>
  <div id="error" role="alert" hidden></div>
  <script nonce="${nonce}" id="moleculeData" type="application/json">${serialized}</script>
  <script nonce="${nonce}" src="${molScript}"></script>
  <script nonce="${nonce}" src="${mathScript}"></script>
  <script nonce="${nonce}" src="${appScript}"></script>
</body>
</html>`;
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function escapeJsonForHtml(value: string): string {
  return value.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function deactivate(): void {}
