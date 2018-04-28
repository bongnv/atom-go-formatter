# atom-go-formatter

[![Greenkeeper badge](https://badges.greenkeeper.io/bongnv/atom-go-formatter.svg)](https://greenkeeper.io/)

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
