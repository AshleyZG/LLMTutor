import * as vscode from "vscode";
import SocketService from './socketService';

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
    SocketService.getInstance().sendMessage('chat', {
        id: vscode.env.machineId,
        sender: sender,
        question: serverQuestion,
        timestamp: Date.now(),
    });
}

export async function sendServerAnswer(question: string, answer: string, studentAnswer: string, type: string) {
    SocketService.getInstance().sendMessage('answer', {
        id: vscode.env.machineId,
        question: question,
        type: type,
        answer: answer,
        studentAnswer: studentAnswer,
    });
}

export function calculateContributor(event: any) {
    // calculate the contributor of an edit event
    
    // if the edit event insert a big part of the code, it's likely to be AI-generated
    console.log(event.operation, event.value.length);
    if (event.eventName !== 'DocumentChangeEvent') {
        return null; // Not a document change event
    }

    if ((event.operation === 'add' || event.operation === 'replace') && event.value.length > 1) {
        console.log('AI-generated code detected');
        return 'AI'; 
    }

    // TODO:
    // otherwise, compare the edit event with the previous AI-generated code
    // if the edit event is similar to the previous AI-generated code, it's likely to be AI-generated.
    // of if the the edit event is close enough to the last AI message, it's likely to be AI-generated.
    console.log('TODO: calculate the contributor of every keystroke--------');
    return 'student';
}