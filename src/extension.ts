import * as path from "path";
import { commands, ExtensionContext, workspace } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";
import { TERM_PAIRS } from "./rules/term-pairs";

let client: LanguageClient;

export const activate = (context: ExtensionContext) => {
  const serverModule = context.asAbsolutePath(path.join("out", "server.js"));
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [
      { scheme: "file", language: "html" },
      { scheme: "file", language: "latex" },
      { scheme: "file", language: "review" },
      { scheme: "file", language: "plaintext" },
      { scheme: "file", language: "markdown" },
    ],
    synchronize: {
      // Notify the server about file changes to '.clientrc files contain in the workspace
      fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
    },
  };
  client = new LanguageClient(
    "languageServerTextlint",
    "Language Server Textlint",
    serverOptions,
    clientOptions,
  );
  client.start();

  // 優先表記を設定するコマンド
  context.subscriptions.push(
    commands.registerCommand(
      "japanese-proofreading.setPreferredTerm",
      async (args: { original: string; preferred: string }) => {
        const config = workspace.getConfiguration("japanese-proofreading");
        const current = config.get<Record<string, string>>("preferredTerms") ?? {};
        const pair = TERM_PAIRS.find(p => p.a === args.original);
        const defaultPreferred = pair?.b ?? args.original;
        if (args.preferred === defaultPreferred) {
          const { [args.original]: _, ...rest } = current;
          await config.update("preferredTerms", rest, true);
        } else {
          await config.update("preferredTerms", { ...current, [args.original]: args.preferred }, true);
        }
      }
    )
  );

  // ルールを無効にするコマンド
  context.subscriptions.push(
    commands.registerCommand(
      "japanese-proofreading.disableRule",
      async (args: { ruleName: string; ruleId: string }) => {
        const config = workspace.getConfiguration("japanese-proofreading");
        await config.update(`textlint.${args.ruleName}`, false, true);
      }
    )
  );

  // エラーを無視するコマンド
  context.subscriptions.push(
    commands.registerCommand(
      "japanese-proofreading.ignoreError",
      async (args: { errorMessage: string; isGlobal: boolean }) => {
        const config = workspace.getConfiguration("japanese-proofreading");
        const current = config.get<string[]>("ignoreErrors") ?? [];
        if (!current.includes(args.errorMessage)) {
          const scope = args.isGlobal ? true : false;
          await config.update("ignoreErrors", [...current, args.errorMessage], scope);
        }
      }
    )
  );
};

export const deactivate = (): Thenable<void> | undefined => {
  if (!client) {
    return undefined;
  }
  return client.stop();
};
