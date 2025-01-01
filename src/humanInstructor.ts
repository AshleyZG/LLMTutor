import * as vscode from 'vscode';
import { sendServerQuestion } from './utils';

// This is for chat participant (tutor)
const BASE_PROMPT =
  'You are the human instructor. Your job is to make sure the LLM tutor is working properly. You only send instructions to the tutor chat participant.';

let currentMessage = ``;

function setCurrentMessage(newMessage: string) {
  currentMessage = newMessage;
}

const createHandler = (initPrompt: string) => {


	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	) => {
        if (request.command === 'read'){
            stream.markdown(`${currentMessage}`);
            return;
        }
		return;
	};
	return handler;
};

export {setCurrentMessage};

const humanInstructorHandler = createHandler(BASE_PROMPT);
export default humanInstructorHandler;