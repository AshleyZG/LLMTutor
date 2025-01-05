// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import codeTutorHandler from './codeTutor';
import humanInstructorHandler from './humanInstructor';
import { ProgressMonitor } from './progressMonitor';
import { popUpWindowQuestions } from './windowQuestions';


// This is for annotation in code
const ANNOTATION_PROMPT = `You are a code tutor who helps students learn how to write better code. Your job is to evaluate a block of code that the user gives you and then annotate any lines that could be improved with a brief suggestion and the reason why you are making that suggestion. Only make suggestions when you feel the severity is enough that it will impact the readability and maintainability of the code. Be friendly with your suggestions and remember that these are students so they need gentle guidance. Format each suggestion as a single JSON object. It is not necessary to wrap your response in triple backticks. Here is an example of what your response should look like:

{ "line": 1, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }{ "line": 12, "suggestion": "I think you should use a for loop instead of a while loop. A for loop is more concise and easier to read." }
`;
const SUGGEST_QUESTIONS = ['Do you understand for loop?', 'Do you know how to approach the problem?', 'How to write a for loop?'];



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
		toggleStatusBarItem.text = `Extension: ${isActive ? 'ON' : 'OFF'}`;
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
	context.subscriptions.push({
        dispose: () => progressMonitor.stop(),
    });
}


// This method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
	context.globalState.update('extensionActive', undefined);
}
