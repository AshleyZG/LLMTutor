import * as vscode from 'vscode';
import { sendServerQuestion } from './utils';
import ChatService from './chatService';
import { ToolUserPrompt } from './history';
import { renderPrompt } from '@vscode/prompt-tsx';

// This is for chat participant (tutor)
const BASE_PROMPT =
  'You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. Respond with a guided overview of the concept in a series of messages. Do not give the user the answer directly, but guide them to find the answer themselves. If the user asks a non-programming question, politely decline to respond.';


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

		// Get the full markdown content before sending to server
		const userMessage = request.prompt;
		await sendServerQuestion('user', userMessage);

		const results = await renderPrompt(
			ToolUserPrompt,
			{
				request: request,
				context: context,			
			},
			{modelMaxPromptTokens: request.model.maxInputTokens},
			request.model,
		) 
		// send the request

		const chatResponse = await request.model.sendRequest(results.messages, {}, token);

		let fullResponse = '';
		// stream the response
		for await (const fragment of chatResponse.text) {
			stream.markdown(fragment);
			fullResponse += fragment;
		}

		// Send the complete markdown response to the server
		await sendServerQuestion('bot', fullResponse);
		ChatService.getInstance().addMessage(vscode.LanguageModelChatMessage.Assistant(fullResponse, 'tutor'));

		return;
	};
	
	return handler;
};



const codeTutorHandler = createHandler(BASE_PROMPT);
export default codeTutorHandler;