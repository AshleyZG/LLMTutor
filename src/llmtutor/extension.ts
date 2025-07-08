// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import codeTutorHandler from './codeTutor';
import humanInstructorHandler from './humanInstructor';
import { ProgressMonitor } from './progressMonitor';
import { popUpWindowQuestions } from './windowQuestions';
import { RecordingState } from './recording';

// Load environment variables from .env file
import * as path from 'path';
import * as fs from 'fs';
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  const envPath = path.resolve(__dirname, '../../.env');
  console.log(`.env file loaded successfully from path: ${envPath}`);
  // Print all loaded environment variables (only those starting with LLMTUTOR_ or RECORDING_ for brevity)
  const relevantEnv = Object.keys(process.env)
    .filter(key => key.startsWith('LLMTUTOR_') || key.startsWith('RECORDING_'))
    .reduce((obj, key) => { obj[key] = process.env[key]; return obj; }, {} as Record<string, string | undefined>);
  console.log('Loaded environment variables:', relevantEnv);
} catch (e) {
  // dotenv not installed or .env not found, ignore
}

const config = vscode.workspace.getConfiguration('llmtutor');

const recordingState = RecordingState.getInstance();
recordingState.isRecording = false;
recordingState.recordingFolder = process.env.RECORDING_FOLDER_URL || (config.get('recordingFolderUrl') as string);

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	vscode.window.showInformationMessage(`Extension is now activated!`);
	context.globalState.update('extensionActive', undefined);


	let toggleStatusBarItem: vscode.StatusBarItem;
	let recordingStatusBarItem: vscode.StatusBarItem;

	// create status bar item for activating the extension itself
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

	// create status bar item for recording edits
	function createRecordingStatusBar(context: vscode.ExtensionContext) {
		recordingStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
		updateRecordingStatusBar(context);
		recordingStatusBarItem.command = 'llmtutor.toggleRecording';
		recordingStatusBarItem.show();
		context.subscriptions.push(recordingStatusBarItem);
	}
	
	function updateRecordingStatusBar(context: vscode.ExtensionContext) {
		const isRecording = recordingState.isRecording;
		recordingStatusBarItem.text = `Recording: ${isRecording ? 'ON' : 'OFF'}`;
	}
	
	// Call this when activating the extension
	createStatusBarSwitch(context);
	createRecordingStatusBar(context);

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
	humanInstructor.iconPath = vscode.Uri.joinPath(context.extensionUri, './img/stewie.png');

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

	const recordingCommand = vscode.commands.registerCommand('llmtutor.toggleRecording', async () => {
		const isRecording = recordingState.isRecording;
		const newState = !isRecording;
		recordingState.isRecording = newState;

		updateRecordingStatusBar(context);
		vscode.window.showInformationMessage(`Recording is now ${newState ? 'ON' : 'OFF'}`);

		if (newState) {
			// Clear any existing recording data when starting a new recording session
			recordingState.clearRecordingData();
		} else {
			// Only save and clear recording data when turning OFF recording
			recordingState.dumpAndClearRecordingData();
		}
	});


    context.subscriptions.push(toggleCommand);
	context.subscriptions.push(recordingCommand);

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
