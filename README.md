# atom-go-formatter

TODO

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
