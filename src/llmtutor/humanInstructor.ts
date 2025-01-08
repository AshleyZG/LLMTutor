import * as vscode from 'vscode';
import ChatService from './chatService';


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
		ChatService.getInstance().addMessage(vscode.LanguageModelChatMessage.User(request.prompt));

		// Get chat history
		if (request.command === 'read') {
			const message = `The following message is sent to ${recipient}:\n\`\`\`\n${currentMessage}\n\`\`\``;
			
			// First send the markdown response
			stream.markdown(message);

			ChatService.getInstance().addMessage(vscode.LanguageModelChatMessage.Assistant(message, 'instructor'));
			
			if (recipient === 'tutor') {
				stream.push(new vscode.ChatResponseCommandButtonPart({
					command: 'llmtutor.promptTutorFromInstructor',
					title: 'Prompt tutor'
				}));
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