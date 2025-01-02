import * as vscode from "vscode";
import { getVisibleCodeWithLineNumbers } from "./utils";


const PROMPT = `You are a coding TA that help student complete their coding exercise. Your job is to prompt questions for the student to ask for help so that they can better understand the concepts and apply them. The user will send you the student's code snippet with a special toekn '<CURSOR>' in it indicating where the cursor is located in student's code snippet. You will then generate three questions based on your code snippet and the location of the cursor. The questions should be related to the code snippet and the concept that the student is learning. Format each question as a single JSON object. It is not necessary to wrap your response in triple backticks. Here is an example of what your response should look like:


{ "questionID": 1, "content": "Do you know how to write a for loop?" }{ "questionID": 2, "content": "The function should return 0 but it returns 5 now. What could be the reason?" }{"questionID": 3, "content": "What is the purpose of the 'return' statement in the function?" }
`;


async function parseChatResponse(chatResponse: vscode.LanguageModelChatResponse, textEditor: vscode.TextEditor) {
    let questions: string[] = [];
	let accumulatedResponse = "";

	for await (const fragment of chatResponse.text) {
		accumulatedResponse += fragment;

		// if the fragment is a }, we can try to parse the whole line
		if (fragment.includes("}")) {
			try {
				const annotation = JSON.parse(accumulatedResponse);
                questions.push(annotation.content);
				// reset the accumulator for the next line
				accumulatedResponse = "";
			}
			catch {
				// do nothing
			}
		}
	}
    return questions;
}

export async function generateQuestion(textEditor: vscode.TextEditor) {
    // Get the code with line numbers from the current editor
	const codeWithLineNumbers = getVisibleCodeWithLineNumbers(textEditor);
	// select the 4o chat model
	const [model] = await vscode.lm.selectChatModels({
		vendor: 'copilot',
		family: 'gpt-4o',
	});

	// init the chat message
	const messages = [
		vscode.LanguageModelChatMessage.User(PROMPT),
		vscode.LanguageModelChatMessage.User(codeWithLineNumbers),
	];

	// make sure the model is available
	if (model) {

		// send the messages array to the model and get the response
		const chatResponse = await model.sendRequest(messages, {}, new vscode.CancellationTokenSource().token);
		// handle chat response
		const questions = await parseChatResponse(chatResponse, textEditor);
        return questions;
    }
    return [];
}