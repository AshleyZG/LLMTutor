import * as vscode from 'vscode';
import { sendServerQuestion } from './utils';

// This is for chat participant (tutor)
const BASE_PROMPT =
  'You are the human instructor. Your job is to make sure the LLM tutor is working properly. You only send instructions to the tutor chat participant.';

let currentMessage = ``;
let recipient: string | undefined = undefined;

function setCurrentMessage(newMessage: string, newRecipient: string) {
  currentMessage = newMessage;
  recipient = newRecipient;
}

const createHandler = (initPrompt: string) => {
	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	) => {
		if (request.command === 'read') {
			// Create a new message that will be processed by the tutor
			const messages = [vscode.LanguageModelChatMessage.Assistant(initPrompt)];
			messages.push(vscode.LanguageModelChatMessage.User(`@${recipient} ${currentMessage}`));
			// Send the instruction to the tutor
			const response = await request.model.sendRequest(
				messages,
				{},
				token
			);

			// Stream the response
			for await (const fragment of response.text) {
				stream.markdown(fragment);
			}
			return;
		}
		return;
	};
	return handler;
};

export {setCurrentMessage};

const humanInstructorHandler = createHandler(BASE_PROMPT);
export default humanInstructorHandler;