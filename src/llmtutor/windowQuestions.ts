import * as vscode from 'vscode';
import { generateQuestion } from './generateQuestions';


async function handleQuestion(question: string) {
    await vscode.commands.executeCommand('workbench.action.chat.open', { query: `@tutor ${question}` });
}

export async function popUpWindowQuestions(textEditor: vscode.TextEditor) {
    
    const questions = await generateQuestion(textEditor);

    console.log('Questions:', questions);

    // Show the message with clickable options
    vscode.window.showInformationMessage(
        'Do you need help?', // The message text
        ...questions,
    ).then(selected => {
        if (selected){
            handleQuestion(selected);
        }
    });

}
