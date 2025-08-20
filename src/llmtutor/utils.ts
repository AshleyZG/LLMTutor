import * as vscode from "vscode";
import SocketService from './socketService';
import { EditTrackingState } from './editTrackingState';
import { RecordingState } from './recording';

const recordingState = RecordingState.getInstance();

export function getVisibleCodeWithLineNumbers(textEditor: vscode.TextEditor) {
	// get the position of the first and last visible lines
	let currentLine = textEditor.visibleRanges[0].start.line;
	const endLine = textEditor.visibleRanges[0].end.line;

	let code = '';

    const cursorPosition = textEditor.selection.active;

	// get the text from the line at the current position.
	// The line number is 0-based, so we add 1 to it to make it 1-based.
	while (currentLine < endLine) {
        const lineText = textEditor.document.lineAt(currentLine).text;

        // Check if the cursor is on the current line
        if (currentLine === cursorPosition.line) {
            // Insert the <CURSOR> token at the cursor's column position
            const lineWithCursor = 
                lineText.slice(0, cursorPosition.character) + 
                '<CURSOR>' + 
                lineText.slice(cursorPosition.character);
            code += `${currentLine + 1}: ${lineWithCursor} \n`;
        } else {
            code += `${currentLine + 1}: ${lineText} \n`;
        }

        // Move to the next line position
        currentLine++;
    }

    console.log('Visible Code: ', code);
	return code;
}


export async function sendServerQuestion(sender: string, serverQuestion: string) {
    const messageData = {
        id: vscode.env.machineId,
        sender: sender,
        question: serverQuestion,
        timestamp: Date.now(),
    };
    SocketService.getInstance().sendMessage('chat', messageData);
    recordingState.appendRecordingData({'type': 'chat', 'data': messageData});

}

export async function sendServerAnswer(quizID: string, question: string, answer: string, studentAnswer: string, type: string) {
    const messageData = {
        id: vscode.env.machineId,
        quizID: quizID,
        question: question,
        type: type,
        answer: answer,
        studentAnswer: studentAnswer,
    };
    SocketService.getInstance().sendMessage('answer', messageData);
    recordingState.appendRecordingData({'type': 'answer', 'data': messageData});
}

export function calculateContributor(event: any) {
    if (event.eventName !== 'DocumentChangeEvent') {
        return null;
    }

    const editTrackingState = EditTrackingState.getInstance();
    const matches = editTrackingState.matchEditWithTrackedEvents(event);
    
    // Check for copy-paste match
    if (matches.copyPasteMatch) {
        console.log('Copy-paste event detected with content:', matches.copyPasteMatch.content.substring(0, 100) + '...');
        return 'copy-paste';
    }
    
    // Check for autocomplete match
    if (matches.autocompleteMatch) {
        console.log('Autocomplete event detected');
        return 'autocomplete';
    }
    
    // Check for AI typing match (most specific)
    if (matches.aiTypingMatch) {
        console.log('AI-generated code being manually typed detected');
        return 'AI-typing';
    }
    
    // Check for AI message match (fallback)
    if (matches.aiMessageMatch) {
        console.log('AI-generated code detected from recent AI message');
        return 'AI';
    }

    return 'student';
}
