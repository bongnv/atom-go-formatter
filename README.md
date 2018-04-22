# atom-go-formatter

A plugin to format Go files for Atom.

Example configuration:
```
"go-formatter":
  formatTools: [
    {
      args: []
      cmd: "grabbyright"
      name: "grabbyright"
      onSave: true
    }
    {
      args: [
        "-e"
      ]
      cmd: "goreturns"
      name: "goreturns"
      onSave: false
    }
  ]
```
