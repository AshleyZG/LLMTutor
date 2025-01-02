import * as vscode from 'vscode';
import { activate as activateExtLLMT, deactivate as deactivateExtLLMT } from './llmtutor/extension';
import { activate as activateExtTelem, deactivate as deactivateExtTelem } from './telemetry/extension';

export function activate(context: vscode.ExtensionContext) {
    activateExtLLMT(context);
    activateExtTelem(context);
}

export function deactivate(context: vscode.ExtensionContext) {
    deactivateExtLLMT(context);
    deactivateExtTelem();
}
