import * as vscode from 'vscode';

class ChatService {
	private static instance: ChatService;
	private chatHistory: Array<vscode.LanguageModelChatMessage>;
	private codeSnippets: Array<{language: string, code: string}>;

	private constructor() {
		this.chatHistory = [];
		this.codeSnippets = [];
	}

	public static getInstance(): ChatService {
		if (!ChatService.instance) {
			ChatService.instance = new ChatService();
		}
		return ChatService.instance;
	}

	public addMessage(message: vscode.LanguageModelChatMessage): void {
		this.chatHistory.push(message);
	}

	public getChatHistory(): Array<vscode.LanguageModelChatMessage> {
		return [...this.chatHistory];
	}

	public addCodeSnippet(snippets: Array<{language: string, code: string}>): void {
		this.codeSnippets = [...this.codeSnippets, ...snippets];
	}

	public getCodeSnippets(): Array<{language: string, code: string}> {
		return [...this.codeSnippets];
	}

	public clearHistory(): void {
		this.chatHistory = [];
	}

}

export default ChatService;