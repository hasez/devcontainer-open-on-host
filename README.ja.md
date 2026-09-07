# Open on Host (Dev Container)

Dev Container 内のファイルを、ホスト側の既定アプリで開く VS Code 拡張である。
表計算なら Excel、PDF ならプレビュー、といったふだんのアプリにそのまま渡す。

[English](README.md)

## なぜ必要か

Dev Container には GUI もデスクトップアプリもない。
そのため、既存の「既定アプリで開く」系の拡張は役に立たない。
いずれも `extensionKind` が `workspace` で、コンテナ**の中**で動いて `xdg-open` を呼ぶからである。開く相手がいない。

この拡張は `extensionKind: ["ui"]` を宣言してホスト側で動く。
ただしそれだけでは足りない。受け取るのは `/workspace/docs/report.xlsx` のようなコンテナ内パスで、ホストにそのパスは存在しないためである。
そこでパスの読み替えもあわせて行う。

Dev Container のワークスペース URI は authority が `dev-container+<hex>` になっている。
この `<hex>` は、コンテナを起動したフォルダーのホスト側パスを含む JSON を hex エンコードしたものである。
これを復号し、ワークスペースルートからの相対パスを求めて、両者をつなぎ直す。

ホスト側にファイルの実体があることが前提なので、ワークスペースがバインドマウントである必要がある。
名前付きボリュームやリモートの Docker ホストでは使えない。

## コマンド

| コマンド | 動作 |
| --- | --- |
| ホストで開く: 既定のアプリで開く | ホストの既定アプリでファイルを開く（macOS は `open`、Windows は `start`、Linux は `xdg-open`） |
| ホストで開く: ファイルマネージャーで表示 | 親フォルダーを開き、そのファイルを選択した状態にする（Finder、エクスプローラー。Linux は親フォルダーを開くだけ） |

エクスプローラーの右クリックメニューと、エディタータブの右クリックメニューに出る。
表記は VS Code の UI 言語に追従する。英語 UI では `Open on Host: Open with Default Application` などになる。

## インストール

**ホスト側の VS Code に入れる。コンテナ側ではない。**
`extensionKind: ["ui"]` を宣言してあるので、Dev Container に接続したウィンドウから入れても VS Code が自動でローカル側へ振り分ける。

[最新リリース](https://github.com/hasez/devcontainer-open-on-host/releases/latest)から `.vsix` を取得して、次を実行する。

```sh
code --install-extension devcontainer-open-on-host-0.3.0.vsix
```

自分でビルドする場合は次のとおり。

```sh
npx --yes @vscode/vsce package
```

いずれの場合も、あとで Dev Container 側のウィンドウをリロードする。

## 設定

単一フォルダーの通常の使い方なら設定は要らない。

自動判定が効かない場合（マルチルート、ワークスペース外のファイル、Dev Container 以外のリモート）は、対応を明示する。

```json
{
  "openOnHost.pathMap": {
    "/workspace": "/Users/you/projects/my-repo"
  }
}
```

キーがコンテナ側のプレフィックス、値がホスト側のプレフィックスである。
最長のプレフィックスが優先され、パスの区切りをまたぐ部分一致は拾わない。

## 制限

- macOS ホストで開発・使用している。Linux と Windows の分岐は書いてあるが未検証である。報告を歓迎する
- ワークスペースの外にあるファイルは `openOnHost.pathMap` の設定が要る
- ワークスペースがバインドマウントであること。ホスト側に実体がないと開けない

## 由来

`dev-container+<hex>` の復号は、MIT ライセンスの
[s-h-a-d-o-w/devcontainer-open-containing-folder](https://github.com/s-h-a-d-o-w/devcontainer-open-containing-folder)
による。同拡張はさらに
[sbaillou/vscode-remote-ssh-reveal-explorer](https://github.com/sbaillou/vscode-remote-ssh-reveal-explorer)
を下敷きにしている。
元の拡張はフォルダーを開くところまでで止まる。
ファイル自体を既定アプリへ渡すこと、ファイルマネージャーでの選択表示、`openOnHost.pathMap`、UI 言語への追従が、この実装で足した部分である。

## ライセンス

MIT。[LICENSE](LICENSE) を参照。
