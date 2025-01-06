# llmtutor README

Make some initial changes so that the extension works.

## Install

Follow instruction from [here](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#packaging-extensions) to package the extension and run locally. Do not publish it. 

```bash
cd llmtutor
npm install -g @vscode/vsce
vsce package
code --install-extension <path-to-vsix-file>

```

**Enjoy!**
