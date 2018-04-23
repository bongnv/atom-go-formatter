import { CompositeDisposable, TextEditor } from 'atom'
import { spawnSync } from 'child_process'

interface FormatTool {
  name: string
  cmd: string
  args: Array<string>
  onSave: boolean
}

class Formatter {
  subscriptions: CompositeDisposable
  commandsSubscriptions: CompositeDisposable | null
  config: any

  constructor() {
    this.subscriptions = new CompositeDisposable()
    this.commandsSubscriptions = null
    this.config = require('./config-schema.json')
  }

  activate () {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable()

    this.subscriptions.add(atom.config.observe('go-formatter.formatTools', (formatTools) => {
      this.registerFormatTools(formatTools)
    }))
  }

  deactivate () {
    this.subscriptions.dispose()
    if (this.commandsSubscriptions) {
      this.commandsSubscriptions.dispose()
    }
  }

  registerFormatTools (formatTools: Array<FormatTool>) {
    if (this.commandsSubscriptions) {
      this.commandsSubscriptions.dispose()
    }
    this.commandsSubscriptions = new CompositeDisposable()
    for (let formatTool of formatTools) {
      this.commandsSubscriptions.add(atom.commands.add('atom-text-editor[data-grammar~="go"]', 'golang:'+formatTool.name, () => {
        this.format(atom.workspace.getActiveTextEditor(), formatTool)
      }))
      if (formatTool.onSave) {
        this.commandsSubscriptions.add(atom.workspace.observeTextEditors((editor) => {
          if (!editor || !editor.getBuffer() || !this.commandsSubscriptions) {
            return
          }

          let bufferSubscriptions = new CompositeDisposable()
          bufferSubscriptions.add(editor.getBuffer().onWillSave(() => {
            this.format(editor, formatTool)
          }))
          bufferSubscriptions.add(editor.getBuffer().onDidDestroy(() => {
            bufferSubscriptions.dispose()
          }))
          this.commandsSubscriptions.add(bufferSubscriptions)
        }))
      }
    }
  }

  format (editor: TextEditor | undefined, tool: FormatTool) {
    if (!editor || !this.isValidEditor(editor) || !editor.getBuffer()) {
      return
    }

    let options = {
      encoding: 'utf8',
      env: process.env,
      input: editor.getText()
    }

    let r = spawnSync(tool.cmd, tool.args, options)
    if (r.stderr && r.stderr.length > 0) {
      console.log('go-formatter: (stderr) ' + r.stderr)
      return
    }
    if (r.status === 0 && r.stdout && r.stdout.length > 0) {
      editor.getBuffer().setTextViaDiff(r.stdout.toString())
      return
    }
    console.log('go-formatter: skipped ' + r.status)
  }

  isValidEditor (editor: TextEditor): boolean {
    if (!editor.getGrammar()) {
      return false
    }

    return editor.getGrammar().scopeName === 'source.go'
  }
}

module.exports = new Formatter()
