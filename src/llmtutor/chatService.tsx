import * as vscode from 'vscode';

class ChatService {
	private static instance: ChatService;
	private chatHistory: Array<vscode.LanguageModelChatMessage>;

	private constructor() {
		this.chatHistory = [];
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

	public clearHistory(): void {
		this.chatHistory = [];
	}

}

export default ChatService;