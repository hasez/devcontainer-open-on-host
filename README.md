# Open on Host (Dev Container)

Open files from inside a Dev Container with the host's default application — a
spreadsheet in Excel or Numbers, a PDF in Preview, an image in your usual viewer.

[日本語版はこちら](README.ja.md)

## Why this exists

A Dev Container has no GUI and no desktop applications, so the usual
"open with default application" extensions cannot help: they declare
`extensionKind: workspace`, which means they run *inside* the container and end
up calling `xdg-open` where there is nothing to open with.

This extension declares `extensionKind: ["ui"]`, so it runs on the host. That
alone is not enough, though — what it receives is a container path such as
`/workspace/docs/report.xlsx`, which does not exist on the host. So it also
translates the path:

A Dev Container workspace URI carries the authority `dev-container+<hex>`, and
that `<hex>` is a hex-encoded JSON object holding the host-side path of the
folder the container was started from. Decode it, take the file's path relative
to the workspace root, and rejoin the two.

Because the host must actually hold the file, this works when the workspace is a
bind mount. It cannot work when the workspace lives in a named volume or on a
remote Docker host.

## Commands

| Command | What it does |
| --- | --- |
| Open on Host: Open with Default Application | Opens the file with the host's default application (`open` on macOS, `start` on Windows, `xdg-open` on Linux) |
| Open on Host: Reveal in File Manager | Opens the containing folder with the file selected (Finder, Explorer; on Linux the parent folder is opened) |

Both appear in the explorer context menu and in the editor tab context menu.

## Installation

**Install it on the host, not in the container.** Because of
`extensionKind: ["ui"]`, VS Code routes it to the local extension host even if
you install it from a window attached to a Dev Container.

Download the `.vsix` from the [latest release](https://github.com/hasez/devcontainer-open-on-host/releases/latest), then:

```sh
code --install-extension devcontainer-open-on-host-0.3.0.vsix
```

Or build it yourself:

```sh
npx --yes @vscode/vsce package
```

Reload the Dev Container window afterwards.

## Configuration

None is needed in the usual single-folder case.

When the automatic translation cannot work — a multi-root workspace, a file
outside the workspace, or a remote that is not a Dev Container — state the
mapping explicitly:

```json
{
  "openOnHost.pathMap": {
    "/workspace": "/Users/you/projects/my-repo"
  }
}
```

Keys are container-side prefixes and values are host-side prefixes. The longest
matching prefix wins, and prefixes only match on path-segment boundaries.

## Limitations

- Developed and used on a macOS host. The Linux and Windows branches are written
  but untested; reports are welcome
- Files outside the workspace need `openOnHost.pathMap`
- The workspace must be a bind mount, so that the file exists on the host

## Credits

The `dev-container+<hex>` decoding comes from
[s-h-a-d-o-w/devcontainer-open-containing-folder](https://github.com/s-h-a-d-o-w/devcontainer-open-containing-folder)
(MIT), which in turn builds on
[sbaillou/vscode-remote-ssh-reveal-explorer](https://github.com/sbaillou/vscode-remote-ssh-reveal-explorer).
That extension stops at opening the containing folder. Handing the file itself
to the default application, selecting it in the file manager,
`openOnHost.pathMap`, and following the VS Code display language are what this
one adds.

## License

MIT. See [LICENSE](LICENSE).
