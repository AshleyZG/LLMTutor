import * as vscode from 'vscode';
import ChatService from './chatService';
import { sendServerAnswer, sendServerQuestion } from './utils';


// This is for chat participant (tutor)
const BASE_PROMPT =
  'You are the human instructor. Your job is to make sure the LLM tutor is working properly. You only send instructions to the tutor chat participant.';

let currentMessage = ``;
let recipient: string | undefined = undefined;

let currentQuiz: string | undefined = undefined;
let currentQuizID: string | undefined = undefined;
let currentQuizAnswer: string | undefined = undefined;
let currentQuizType: string | undefined = undefined;

function setCurrentMessage(newMessage: string, newRecipient: string) {
	currentMessage = newMessage;
	recipient = newRecipient;
}

function setCurrentQuiz(question: string, answer: string, type: string, quizID: string){
	currentMessage = question;
	currentQuiz = question;
	currentQuizAnswer = answer;
	currentQuizType = type;
	currentQuizID = quizID;
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
		else if(request.command === 'answer'){
			const answerContent = request.prompt;
			console.log('answerContent', answerContent);
			// await sendServerQuestion('answer', answerContent);
			await sendServerAnswer(currentQuizID!, currentQuiz!, currentQuizAnswer!, answerContent, currentQuizType!,);
			stream.markdown(`Thank yoou! Your answer has been sent to the instructor.`);
		}
		return;
	};
	return handler;
};

export {setCurrentMessage, setCurrentQuiz};

const humanInstructorHandler = createHandler(BASE_PROMPT);
export default humanInstructorHandler;