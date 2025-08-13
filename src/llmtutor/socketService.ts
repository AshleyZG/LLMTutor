import * as vscode from 'vscode';
import { io, Socket } from 'socket.io-client';
import { setCurrentMessage, setCurrentQuiz } from './humanInstructor';
import { popUpInstructorQuestion } from './windowQuestions';

const config = vscode.workspace.getConfiguration('llmtutor');
const serverUrl = config.get('exportUrl');

export default class SocketService {
    private static instance: SocketService;
    private socket: Socket;

    private constructor() {
        console.log('Initializing Socket.IO connection to:', serverUrl);
        this.socket = io(serverUrl as string, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 3000,
            timeout: 20000,
            transports: ['websocket', 'polling'],
            auth: {
                role: 'student',
                userId: vscode.env.machineId
            },
            query: {
                role: 'student',
                userId: vscode.env.machineId
            }
        });

        this.setupSocketListeners();
    }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService();
        }
        return SocketService.instance;
    }

    private setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('✅ Socket.IO connected successfully');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('⚠️ Socket.IO disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('❌ Socket.IO connection error:', {
                message: error.message
            });
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
            console.log(`🔄 Attempting to reconnect... (attempt ${attemptNumber})`);
        });

        this.socket.on('feedback', (data) => {
            console.log('Feedback received:', data);
            setCurrentMessage(data.question, data.recipient);
            popUpInstructorQuestion();
        });

        this.socket.on('quiz', (data) => {
            console.log('Quiz received:', data);
            setCurrentQuiz(data.question, data.answer, data.type, data.quizID);
            popUpInstructorQuestion();
        });

        this.socket.on('answer_feedback', (data) => {
            console.log('Answer feedback received:', data);
            console.log('TODO: show the answer feedback in the chat panel');
            // TODO: add visual cues in the viz to indicate the correctness of the answer, and # of attempts to answer the question
            // TODO: show up the answer in student's chat panel
        });
    }

    public sendMessage(event: 'chat' | 'edit' | 'answer', data: any) {
        if (!this.socket.connected) {
            console.warn('⚠️ Socket not connected. Attempting to reconnect...');
            this.socket.connect();
            return;
        }

        try {
            console.log(`📤 Sending ${event} data through Socket.IO...`);
            this.socket.emit(event, {
                ...data,
                senderId: vscode.env.machineId
            });
            console.log('✅ Data exported successfully!');
        } catch (error: any) {
            console.error('❌ Failed to export data:', error.message);
        }
    }

    public disconnect() {
        this.socket.disconnect();
    }

    public isConnected(): boolean {
        return this.socket?.connected ?? false;
    }

    public onReconnect(callback: () => void) {
        this.socket?.on('connect', callback);
    }
} 