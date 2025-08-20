// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import codeTutorHandler from './codeTutor';
import humanInstructorHandler from './humanInstructor';
import { ProgressMonitor } from './progressMonitor';
import { RecordingState } from './recording';
import { EditTrackingState } from './editTrackingState';


// Load environment variables from .env file
import * as path from 'path';

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
  console.log('envPath not found');
}

const config = vscode.workspace.getConfiguration('llmtutor');

const recordingState = RecordingState.getInstance();
recordingState.isRecording = false;
recordingState.recordingFolder = process.env.RECORDING_FOLDER_URL || (config.get('recordingFolderUrl') as string);

const editTrackingState = EditTrackingState.getInstance();

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
	context.subscriptions.push(promptTutorFromInstructor);
	context.subscriptions.push({
        dispose: () => progressMonitor.stop(),
    });

	const selector: vscode.DocumentSelector = { scheme: 'file', language: '*' };

	const copyPasteProvider: any = {
	  // Fires **after a copy/cut**. You can add metadata or just log.
	  async prepareDocumentPaste(doc: vscode.TextDocument, _ranges: vscode.Range[], dataTransfer: vscode.DataTransfer) {
		console.log('COPY from', doc.uri.fsPath);
		
		// Get clipboard content
		const clipboardItem = dataTransfer.get('text/plain');
		if (clipboardItem) {
		  clipboardItem.asString().then((content: string) => {
			editTrackingState.setClipboardContent(content);
			console.log('Clipboard content captured:', content.substring(0, 100) + '...');
		  });
		}
	  },
  
	  // Fires **on every paste** into an editor your selector matches.
	  async provideDocumentPasteEdits(doc: vscode.TextDocument, ranges: vscode.Range[], dataTransfer: vscode.DataTransfer, _context: any) {
		console.log('PASTE into', doc.uri.fsPath);
		
		// Get the pasted content
		const clipboardItem = dataTransfer.get('text/plain');
		if (clipboardItem) {
		  clipboardItem.asString().then((content: string) => {
			const pasteEvent = {
			  timestamp: Date.now(),
			  content: content,
			  documentUri: doc.uri.toString(),
			  range: ranges[0] // Use the first range
			};
			
			editTrackingState.addCopyPasteEvent(pasteEvent);
			console.log('Paste event tracked with content:', content.substring(0, 100) + '...');
		  });
		}
		
		return undefined;
	  }
	};
  
	context.subscriptions.push(
	  (vscode.languages as any).registerDocumentPasteEditProvider(
		selector,
		copyPasteProvider,
		{ pasteMimeTypes: ['text/plain'] }      // handle plain‑text pastes
	  )
	);

	// Track undo/redo operations
	let isUndoRedoOperation = false;

	// Listen for undo/redo commands
	context.subscriptions.push(
	    vscode.commands.registerCommand('undo', () => {
	        isUndoRedoOperation = true;
	        setTimeout(() => { isUndoRedoOperation = false; }, 100); // Reset after 100ms
	        return vscode.commands.executeCommand('default:undo');
	    })
	);

	context.subscriptions.push(
	    vscode.commands.registerCommand('redo', () => {
	        isUndoRedoOperation = true;
	        setTimeout(() => { isUndoRedoOperation = false; }, 100); // Reset after 100ms
	        return vscode.commands.executeCommand('default:redo');
	    })
	);

	// Add Tab key tracking for inline autocomplete
	context.subscriptions.push(
	    vscode.workspace.onDidChangeTextDocument((e) => {
	        if (e.contentChanges.length > 0) {
	            const change = e.contentChanges[0];
	            
	            // Track single character keystrokes
	            if (change.text.length === 1) {
					const editTrackingState = EditTrackingState.getInstance();
	                
	                // Get line information from the change
	                const lineNumber = e.document.lineAt(change.range.start.line).lineNumber;
	                const lineContent = e.document.lineAt(change.range.start.line).text;
	                
	                editTrackingState.addKeystroke(
	                    change.text,
	                    change.rangeOffset,
	                    e.document.uri.toString(),
	                    lineNumber,
	                    lineContent
	                );
	            }
	            
	            // Track Tab-accepted autocomplete (multiple characters inserted/replaced)
	            // Exclude undo/redo operations
	            if (change.text.trim() !== '' && 
	                change.text.length > 1 && 
	                !isUndoRedoOperation) {
	                
	                const editTrackingState = EditTrackingState.getInstance();
	                editTrackingState.addPotentialAutocomplete({
	                    timestamp: Date.now(),
	                    content: change.text,
	                    documentUri: e.document.uri.toString(),
	                    range: change.range
	                });
	            }
	        }
	    })
	);

}


// This method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
	context.globalState.update('extensionActive', undefined);
}
