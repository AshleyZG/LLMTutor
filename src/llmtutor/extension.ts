// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import codeTutorHandler from './codeTutor';
import humanInstructorHandler from './humanInstructor';
import { ProgressMonitor } from './progressMonitor';
import { popUpWindowQuestions } from './windowQuestions';


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	vscode.window.showInformationMessage(`Extension is now activated!`);
	context.globalState.update('extensionActive', undefined);


	let toggleStatusBarItem: vscode.StatusBarItem;

	function createStatusBarSwitch(context: vscode.ExtensionContext) {
		toggleStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		updateStatusBar(context);
		toggleStatusBarItem.command = 'llmtutor.toggleActivation';
		toggleStatusBarItem.show();
		context.subscriptions.push(toggleStatusBarItem);
	}
	
	function updateStatusBar(context: vscode.ExtensionContext) {
		const isActive = context.globalState.get<boolean>('extensionActive', true);
		toggleStatusBarItem.text = `LLMTutor: ${isActive ? 'ON' : 'OFF'}`;
	}
	
	// Call this when activating the extension
	createStatusBarSwitch(context);

	// create participant
	const tutor = vscode.chat.createChatParticipant('chat-tutorial.code-tutor', codeTutorHandler);
	// tutor should first send a message to the participant
	context.subscriptions.push(
		tutor,
	);
	// add icon to participant
	tutor.iconPath = vscode.Uri.joinPath(context.extensionUri, './img/tutor.png');


	// create human instructor
	const humanInstructor = vscode.chat.createChatParticipant('chat-tutorial.human-instructor', humanInstructorHandler);
	// human instructor should first send a message to the participant
	context.subscriptions.push(
		humanInstructor,
	);
	// add icon to participant
	humanInstructor.iconPath = vscode.Uri.joinPath(context.extensionUri, './img/instructor.png');

	const progressMonitor = new ProgressMonitor();
	progressMonitor.start();

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	const disposable = vscode.commands.registerTextEditorCommand('llmtutor.proactiveMode', async (textEditor: vscode.TextEditor) => {
		console.log('testing********************************');
	});

	const disposableProactiveTrigger = vscode.commands.registerTextEditorCommand('llmtutor.promptQuestion', async (textEditor: vscode.TextEditor) => {
		// Show window messages for potential questions
		popUpWindowQuestions(textEditor);
	});

	const promptTutorFromInstructor = vscode.commands.registerCommand('llmtutor.promptTutorFromInstructor', async () => {
		vscode.commands.executeCommand('workbench.action.chat.open', { query: '@tutor what did instructor just send?' });
	});

	const toggleCommand = vscode.commands.registerCommand('llmtutor.toggleActivation', () => {
        const isActive = context.globalState.get<boolean>('extensionActive', true);
        const newState = !isActive;

        context.globalState.update('extensionActive', newState);
		updateStatusBar(context);
        vscode.window.showInformationMessage(`Extension is now ${newState ? 'ON' : 'OFF'}`);
        if (newState) {
            activateFeatures(context);
        } else {
            deactivateFeatures();
        }
    });

	const activateFeatures = (context: vscode.ExtensionContext) => {
		progressMonitor.continue();
	};

	const deactivateFeatures = () => {
		progressMonitor.pause();
	};

    context.subscriptions.push(toggleCommand);


	context.subscriptions.push(disposable);
	context.subscriptions.push(disposableProactiveTrigger);
	context.subscriptions.push(promptTutorFromInstructor);
	context.subscriptions.push({
        dispose: () => progressMonitor.stop(),
    });
}


// This method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
	context.globalState.update('extensionActive', undefined);
}
