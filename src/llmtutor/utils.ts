import * as vscode from "vscode";
import axios from 'axios';

const config = vscode.workspace.getConfiguration('llmtutor');
const exportUrl = config.get('exportUrl');

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
    try {
        console.log('Sending question to server');
        const response = await axios.post(`${exportUrl}/chat`, { content: JSON.stringify({
            // get vscode machine ID as ID field
            "id": vscode.env.machineId,
            "sender": sender,
            "question": serverQuestion,
        }) });
        console.log(`Data exported successfully!`);
    } catch (error: any) {
        console.error(`Failed to export data: ${error.message}`);
    }

}