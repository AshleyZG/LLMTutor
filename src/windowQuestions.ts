import * as vscode from 'vscode';
import { generateQuestion } from './generateQuestions';



async function handleQuestion(question: string) {
    await vscode.commands.executeCommand('workbench.action.chat.open', { query: `@tutor ${question}` });
}

export async function popUpWindowQuestions(textEditor: vscode.TextEditor) {
    
    const questions = await generateQuestion(textEditor);

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

export async function popUpInstructorQuestion(){
    vscode.window.showInformationMessage(
        'The instructor send a message. Do you want to see it?',
        'Yes',
        'No')
    .then(selected => {
        if (selected === 'Yes'){
            vscode.commands.executeCommand('workbench.action.chat.open', { query: '@instructor /read' });
        }
    });
}
