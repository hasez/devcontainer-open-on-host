// Open files from inside a Dev Container with the host's default application.
//
// This extension declares `extensionKind: ["ui"]`, so it runs in the local
// extension host, on the machine where the GUI lives. The paths it is handed,
// however, are container paths (`/workspace/...`). Translating those to host
// paths before handing them to the OS is what this extension is really about.
//
// The authority-decoding trick comes from
// s-h-a-d-o-w/devcontainer-open-containing-folder (MIT). See LICENSE.

const path = require("node:path");
const { spawn } = require("node:child_process");
const vscode = require("vscode");

const DEV_CONTAINER_PREFIX = "dev-container+";

/**
 * A Dev Container workspace URI carries the authority `dev-container+<hex>`,
 * where <hex> is a hex-encoded JSON object holding the host-side path.
 *
 * @param {import("vscode").Uri} folderUri
 * @returns {string | undefined} the host-side workspace root
 */
function decodeHostWorkspaceRoot(folderUri) {
  const { authority } = folderUri;
  if (!authority || !authority.startsWith(DEV_CONTAINER_PREFIX)) {
    return undefined;
  }
  try {
    const decoded = JSON.parse(
      Buffer.from(authority.slice(DEV_CONTAINER_PREFIX.length), "hex").toString("utf8"),
    );
    // VS Code writes hostPath; Cursor writes workspacePath.
    return decoded.hostPath ?? decoded.workspacePath;
  } catch {
    return undefined;
  }
}

/**
 * Explicit translation via the `openOnHost.pathMap` setting.
 * Takes precedence over the automatic authority decoding.
 *
 * @param {string} containerPath
 * @returns {string | undefined}
 */
function applyPathMap(containerPath) {
  const map = vscode.workspace.getConfiguration("openOnHost").get("pathMap") ?? {};
  // Try the longest prefix first, so that both /workspace and /workspace/docs
  // can be mapped and the more specific one wins.
  const prefixes = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (containerPath === prefix || containerPath.startsWith(prefix + "/")) {
      return path.join(map[prefix], containerPath.slice(prefix.length));
    }
  }
  return undefined;
}

/**
 * Translate a container path into the corresponding host path.
 * In a window that is not connected to a remote, the path is returned as is.
 *
 * @param {string} containerPath
 * @returns {string}
 * @throws {Error} when no translation can be determined
 */
function toHostPath(containerPath) {
  const mapped = applyPathMap(containerPath);
  if (mapped) {
    return mapped;
  }

  const { remoteName } = vscode.env;
  if (!remoteName) {
    return containerPath;
  }
  if (remoteName !== "dev-container") {
    throw new Error(
      vscode.l10n.t(
        'Remote type "{0}" is not supported. Set the path mapping in openOnHost.pathMap.',
        remoteName,
      ),
    );
  }

  const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(containerPath))
    ?? vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error(vscode.l10n.t("Could not determine the workspace folder."));
  }

  const hostRoot = decodeHostWorkspaceRoot(folder.uri);
  if (!hostRoot) {
    throw new Error(
      vscode.l10n.t(
        "Could not extract the host path from the Dev Container authority. Set the mapping in openOnHost.pathMap.",
      ),
    );
  }

  const relative = path.relative(folder.uri.fsPath, containerPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      vscode.l10n.t(
        "{0} is outside the workspace, so its host path cannot be determined.",
        containerPath,
      ),
    );
  }
  return path.join(hostRoot, relative);
}

/**
 * Fire off a host OS command and forget about it.
 * Only the launch itself is checked; the application's lifetime is not tracked.
 */
function launch(command, args) {
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.on("error", (error) => {
    vscode.window.showErrorMessage(
      vscode.l10n.t("Failed to launch {0}: {1}", command, error.message),
    );
  });
  child.unref();
}

function openWithDefaultApp(hostPath) {
  switch (process.platform) {
    case "darwin":
      return launch("open", [hostPath]);
    case "win32":
      // `start` swallows its first argument as the window title, so pass an empty one.
      return launch("cmd", ["/c", "start", "", hostPath]);
    default:
      return launch("xdg-open", [hostPath]);
  }
}

function revealInFileManager(hostPath) {
  switch (process.platform) {
    case "darwin":
      return launch("open", ["-R", hostPath]);
    case "win32":
      // explorer expects /select,<path> as a single token.
      return launch("explorer", [`/select,${hostPath}`]);
    default:
      // Linux file managers share no common "reveal" flag, so open the parent folder.
      return launch("xdg-open", [path.dirname(hostPath)]);
  }
}

/**
 * The command argument (a Uri, when invoked from the explorer), or else the active editor's file.
 */
function resolveTarget(arg) {
  if (arg instanceof vscode.Uri) {
    return arg.fsPath;
  }
  const editor = vscode.window.activeTextEditor;
  if (editor && editor.document.uri.scheme !== "untitled") {
    return editor.document.uri.fsPath;
  }
  return undefined;
}

function register(context, commandId, action) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, (arg) => {
      const containerPath = resolveTarget(arg);
      if (!containerPath) {
        vscode.window.showErrorMessage(vscode.l10n.t("Could not determine the target file."));
        return;
      }
      try {
        action(toHostPath(containerPath));
      } catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      }
    }),
  );
}

function activate(context) {
  register(context, "openOnHost.openFile", openWithDefaultApp);
  register(context, "openOnHost.revealInFileManager", revealInFileManager);
}

function deactivate() {}

module.exports = { activate, deactivate };
