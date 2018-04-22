// @flow

import path from 'path';
import { CompositeDisposable } from 'atom';
import { spawnSync } from 'child_process';
import configSchema from './config-schema.json';

type FormatTool = {
  name: string,
  cmd: string,
  args: Array<string>,
  onSave: bool,
}

export default {
  subscriptions: null,
  commandsSubscriptions: null,
  config: configSchema,

  activate() {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    this.subscriptions.add(atom.config.observe('gofmt.formatTools', (formatTools) => {
      this.registerFormatTools(formatTools);
    }))
  },

  deactivate() {
    this.subscriptions.dispose();
    if (this.saveSubscriptions) {
      this.saveSubscriptions.dispose();
    }
    if (this.commandsSubscriptions) {
      this.commandsSubscriptions.dispose();
    }
  },

  registerFormatTools(formatTools: Array<FormatTool>) {
    if (this.commandsSubscriptions) {
      this.commandsSubscriptions.dispose();
    }
    this.commandsSubscriptions = new CompositeDisposable();
    formatTools.forEach((formatTool: FormatTool) => {
      this.commandsSubscriptions.add(atom.commands.add('atom-text-editor[data-grammar~="go"]', 'golang:'+formatTool.name, () => {
        this.format(this.getEditor(), formatTool);
      }));
      if (formatTool.onSave) {
        this.commandsSubscriptions.add(atom.workspace.observeTextEditors((editor) => {
          if (!editor || !editor.getBuffer()) {
            return
          }

          let bufferSubscriptions = new CompositeDisposable()
          bufferSubscriptions.add(editor.getBuffer().onWillSave((filePath) => {
            let p = editor.getPath()
            if (filePath && filePath.path) {
              p = filePath.path
            }
            this.format(editor, formatTool, p)
          }))
          bufferSubscriptions.add(editor.getBuffer().onDidDestroy(() => {
            bufferSubscriptions.dispose()
          }))
          this.commandsSubscriptions.add(bufferSubscriptions)
        }));
      }
    });
  },

  getEditor (): ?atom$TextEditor {
    if (!atom || !atom.workspace) {
      return null
    }
    let editor = atom.workspace.getActiveTextEditor()
    if (!this.isValidEditor(editor)) {
      return null
    }

    return editor
  },

  projectPath (editor: atom$TextEditor): ?string {
    if (editor) {
      let result = atom.project.relativizePath(editor.getPath())
      if (result && result.projectPath) {
        return result.projectPath
      }
    }
    let paths = atom.project.getPaths()
    if (paths && paths.length) {
      for (let p of paths) {
        if (p && !p.includes('://')) {
          return p
        }
      }
    }

    return null
  },

  getExecutorOptions (editor: atom$TextEditor = this.getEditor()): child_process$spawnSyncOpts {
    let options = {}
    let p = this.projectPath(editor)
    if (p) {
      options.cwd = p
    }

    if (!options.env) {
      options.env = process.env
    }
    return options
  },

  execSync (command: string, args: Array<string>, options: child_process$spawnSyncOpts) {
    options.encoding = 'utf8'
    let done = spawnSync(command, args, options)
    let stdout = ''
    if (done.stdout && done.stdout.length > 0) {
      stdout = done.stdout
    }
    let stderr = ''
    if (done.stderr && done.stderr.length > 0) {
      stderr = done.stderr
    }

    return {exitcode: done.status, stdout: stdout, stderr: stderr, error: done.error}
  },

  format (editor: atom$TextEditor, tool: FormatTool, filePath: ?string) {
    if (!this.isValidEditor(editor) || !editor.getBuffer()) {
      return
    }

    if (!filePath) {
      filePath = editor.getPath()
    }

    let options = this.getExecutorOptions(editor)
    options.input = editor.getText()

    // let r = config.executor.execSync(cmd, args, options)
    let r = this.execSync(tool.cmd, tool.args, options)
    if (r.stderr && r.stderr.trim() !== '') {
      console.log('gofmt: (stderr) ' + r.stderr)
      return
    }
    if (r.exitcode === 0 && r.stdout && r.stdout.trim() !== '') {
      editor.getBuffer().setTextViaDiff(r.stdout)
      return
    }
    console.log('gofmt: skipped ' + r.exitcode);
  },

  isValidEditor (editor: atom$TextEditor): bool {
    if (!editor || !editor.getGrammar()) {
      return false
    }

    return editor.getGrammar().scopeName === 'source.go'
  }
};