import { CompositeDisposable, Range, TextEditor } from "atom";
import { IndieDelegate, Message} from "atom/linter";
import { spawnSync } from "child_process";

interface IFormatTool {
  name: string;
  cmd: string;
  args: string[];
  onSave: boolean;
}

class Formatter {
  public config: any;

  private subscriptions: CompositeDisposable;
  private linter: IndieDelegate | null;

  constructor() {
    this.subscriptions = new CompositeDisposable();
    this.config = require("./config-schema.json");
    this.linter = null;
  }

  public activate() {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();
    this.subscriptions.add(atom.config.observe("go-formatter.formatTools", (formatTools) => {
      this.registerFormatTools(formatTools);
    }));
  }

  public deactivate() {
    this.subscriptions.dispose();
  }

  public consumeIndie(register: (opts: {name: string}) => IndieDelegate) {
    this.linter = register({
      name: "go-formatter",
    });
    this.subscriptions.add(this.linter);
  }

  private registerFormatTools(formatTools: IFormatTool[]) {
    const commandsSubscriptions = new CompositeDisposable();
    this.subscriptions.add(commandsSubscriptions);
    for (const formatTool of formatTools) {
      commandsSubscriptions.add(atom.commands.add(
        "atom-text-editor[data-grammar~=\"go\"]",
        "golang:" + formatTool.name, () => {
          this.format(atom.workspace.getActiveTextEditor(), formatTool);
        },
      ));

      if (formatTool.onSave) {
        commandsSubscriptions.add(atom.workspace.observeTextEditors((editor) => {
          if (!editor || !editor.getBuffer()) {
            return;
          }

          const bufferSubscriptions = new CompositeDisposable();
          bufferSubscriptions.add(editor.getBuffer().onWillSave(() => {
            this.format(editor, formatTool);
          }));
          bufferSubscriptions.add(editor.getBuffer().onDidDestroy(() => {
            bufferSubscriptions.dispose();
          }));
          commandsSubscriptions.add(bufferSubscriptions);
        }));
      }
    }
  }

  private format(editor: TextEditor | undefined, tool: IFormatTool) {
    if (!editor || !this.isValidEditor(editor) || !editor.getBuffer()) {
      return;
    }

    const options = {
      encoding: "utf8",
      env: process.env,
      input: editor.getText(),
    };

    if (this.linter) {
      this.linter.clearMessages();
    }

    const r = spawnSync(tool.cmd, tool.args, options);
    if (r.stderr && r.stderr.length > 0) {
      if (this.linter) {
        this.linter.setAllMessages(this.parseErrors(editor.getPath(), r.stderr));
      }
      return;
    }
    if (r.status === 0 && r.stdout && r.stdout.length > 0) {
      editor.getBuffer().setTextViaDiff(r.stdout.toString());
      return;
    }
  }

  private parseErrors(file: string | undefined, stderr: Buffer): Message[] {
    if (!file) {
      return [];
    }
    const pattern = /^<.*>:(\d+):(\d+):(.*)?$/img;
    const messages: Message[] = [];
    while (true) {
      const match = pattern.exec(stderr.toString());
      if (!match) {
        break;
      }
      if (match.length < 4) {
        continue;
      }
      const line = parseInt(match[1], 10);
      const offset = parseInt(match[2], 10);
      messages.push({
        excerpt: match[3],
        location: {
          file,
          position: new Range([line - 1, offset - 1], [line - 1, offset]),
        },
        severity: "error",
      });
    }
    return messages;
  }

  private isValidEditor(editor: TextEditor): boolean {
    if (!editor.getGrammar()) {
      return false;
    }

    return editor.getGrammar().scopeName === "source.go";
  }
}

module.exports = new Formatter();
