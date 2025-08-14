import * as vscode from 'vscode';
import { sendServerQuestion } from './utils';
import ChatService from './chatService';
import { ToolUserPrompt } from './history';
import { renderPrompt } from '@vscode/prompt-tsx';
import { EditTrackingState } from './editTrackingState';

// This is for chat participant (tutor)
const BASE_PROMPT =
  'You are a helpful code tutor. Your job is to teach the user with simple descriptions and sample code of the concept. Respond with a guided overview of the concept in a series of messages. Do not give the user the answer directly, but guide them to find the answer themselves. If the user asks a non-programming question, politely decline to respond.';

// Helper function to extract code snippets from markdown
const extractCodeSnippets = (text: string): Array<{language: string, code: string}> => {
    const codeSnippets: Array<{language: string, code: string}> = [];
    
    // Match code blocks with backticks (```language\ncode\n```)
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    // First, extract all code blocks and track their positions
    const codeBlockPositions: Array<{start: number, end: number}> = [];
    while ((match = codeBlockRegex.exec(text)) !== null) {
        const language = match[1] || 'text';
        const code = match[2].trim();
        codeSnippets.push({ language, code });
        
        // Track the position of this code block
        codeBlockPositions.push({
            start: match.index,
            end: match.index + match[0].length
        });
    }
    
    // Reset regex for inline code search
    const inlineCodeRegex = /`([^`]+)`/g;
    
    // Check for inline code, but exclude anything that's already part of a code block
    while ((match = inlineCodeRegex.exec(text)) !== null) {
        const matchStart = match.index;
        const matchEnd = match.index + match[0].length;
        
        // Check if this inline code is inside any code block
        const isInsideCodeBlock = codeBlockPositions.some(
            block => matchStart >= block.start && matchEnd <= block.end
        );
        
        // Only add if it's NOT inside a code block
        if (!isInsideCodeBlock) {
            codeSnippets.push({ language: 'inline', code: match[1] });
        }
    }
    
    return codeSnippets;
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

		// Extract code snippets from the complete response
		const codeSnippets = extractCodeSnippets(fullResponse);
		
		// Log or process the code snippets
		if (codeSnippets.length > 0) {
			console.log('Found code snippets:', codeSnippets);
			// You can send this to your server
			await sendServerQuestion('code_snippets', JSON.stringify(codeSnippets));
			
			// Update AI tracking state
			const editTrackingState = EditTrackingState.getInstance();
			const aiMessageEvent = {
				timestamp: Date.now(),
				codeSnippets: codeSnippets.map(snippet => snippet.code),
				documentUri: vscode.window.activeTextEditor?.document.uri.toString()
			};
			editTrackingState.addAIMessageEvent(aiMessageEvent);
		}

		// Send the complete markdown response to the server
		await sendServerQuestion('bot', fullResponse);
		ChatService.getInstance().addMessage(vscode.LanguageModelChatMessage.Assistant(fullResponse, 'tutor'));
		ChatService.getInstance().addCodeSnippet(codeSnippets);

		console.log('codeSnippets', ChatService.getInstance().getCodeSnippets());

		return;
	};
	
	return handler;
};



const codeTutorHandler = createHandler(BASE_PROMPT);
export default codeTutorHandler;