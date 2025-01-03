import * as vscode from 'vscode';
import { sendServerQuestion } from './utils';

// This is for chat participant (tutor)
const BASE_PROMPT =
  'You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. Respond with a guided overview of the concept in a series of messages. Do not give the user the answer directly, but guide them to find the answer themselves. If the user asks a non-programming question, politely decline to respond.';


const getPreviousMessages = (context: vscode.ChatContext) => {
	let messages: Array<any> = [];
	// get all the previous participant messages
	const previousMessages = context.history.filter(
		h => h instanceof vscode.ChatResponseTurn || h instanceof vscode.ChatRequestTurn
	);

	// add the previous messages to the messages array
	previousMessages.forEach(m => {
		if (m instanceof vscode.ChatResponseTurn) {
			// For bot responses
			const markdown = m.response
				.map(r => (r as vscode.ChatResponseMarkdownPart).value.value)
				.join('\n');
			messages.push(vscode.LanguageModelChatMessage.Assistant(markdown));
		} else if (m instanceof vscode.ChatRequestTurn) {
			// For user messages
			messages.push(vscode.LanguageModelChatMessage.User(m.prompt));
		}
	});

	return messages;
};


const createHandler = (initPrompt: string) => {

    let _interval: NodeJS.Timeout | undefined; 

	const handler: vscode.ChatRequestHandler = async (
		request: vscode.ChatRequest,
		context: vscode.ChatContext,
		stream: vscode.ChatResponseStream,
		token: vscode.CancellationToken
	) => {
        if (request.command === 'end'){
            if (_interval){
                clearInterval(_interval);
            }
            stream.markdown(`The chat has ended.`);
            return;
        }else if (request.command === 'start'){
            stream.markdown(`The conversation has started. From now on, the LLM tutor will provide help for you when requested or no progress detected.`);
			return;
        }

		// initialize the prompt
		let prompt = initPrompt;

		// initialize the messages array with the prompt
		const messages = [vscode.LanguageModelChatMessage.User(prompt)];

		const previousMessages = getPreviousMessages(context);

		messages.push(...previousMessages);

		// add in the user's message
		messages.push(vscode.LanguageModelChatMessage.User(request.prompt));

		// Get the full markdown content before sending to server
		const userMessage = request.prompt;
		await sendServerQuestion('user', userMessage);

		// send the request
		const chatResponse = await request.model.sendRequest(messages, {}, token);

		let fullResponse = '';
		// stream the response
		for await (const fragment of chatResponse.text) {
			stream.markdown(fragment);
			fullResponse += fragment;
		}

		// Send the complete markdown response to the server
		await sendServerQuestion('bot', fullResponse);

		return;
	};
	return handler;
};



const codeTutorHandler = createHandler(BASE_PROMPT);
export default codeTutorHandler;