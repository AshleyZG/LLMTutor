import * as vscode from 'vscode';
import Observable from './observableValue';
import { addObserver, removeObserver } from '../telemetry/exporters';
import { EventData } from '../telemetry/types';
import SocketService from './socketService';
import { RecordingState } from './recording';
import { calculateContributor } from './utils';

// This is for chat participant to proactively sent a message to the user when they have not progressed in the last 5 minutes
export class ProgressMonitor {
    private _timeout: NodeJS.Timeout | undefined;
    private _status: 'on' | 'off' = 'off';
    private edits: Observable<any[]> = new Observable([] as any[]);

    private recordingState = RecordingState.getInstance();

    private _strugglingInterval: number = 1*60*1000; // 1 minutes
    private _hasTriggered: boolean = false;

    // Add a message queue
    private _pendingMessages: Array<{event: 'chat' | 'edit', data: any}> = [];

    constructor() {
        this.monitorEditsStatus = this.monitorEditsStatus.bind(this);
        this.handleEvent = this.handleEvent.bind(this);
        this.processPendingMessages = this.processPendingMessages.bind(this);

        this.edits.subscribe(this.monitorEditsStatus);
        addObserver(this.handleEvent);
        
        // Add socket reconnection handler
        const socketService = SocketService.getInstance();
        socketService.onReconnect(this.processPendingMessages);
    }

    private monitorEditsStatus(newValue: any, oldValue: any){
        if (this._timeout){
            clearTimeout(this._timeout);
        }
        if (this._status === 'on'){
            console.log('edits change observed.'); 
            this._hasTriggered = false;
            this._timeout = setTimeout(this.proactiveTrigger, this._strugglingInterval);    
        }
    }

    private async processPendingMessages() {
        const socketService = SocketService.getInstance();
        while (socketService.isConnected() && this._pendingMessages.length > 0) {
            const pendingMessage = this._pendingMessages.shift();
            if (pendingMessage) {
                try {
                    socketService.sendMessage(pendingMessage.event, pendingMessage.data);
                    if (pendingMessage.event === 'edit'){
                        this.recordingState.appendRecordingData(pendingMessage.data);
                    }
                    console.log('✅ Pending message sent successfully');
                } catch (error: any) {
                    console.error('❌ Failed to send pending message:', error.message);
                    // Put the message back in the queue
                    this._pendingMessages.unshift(pendingMessage);
                    break;
                }
            }
        }
    }

    private async sendEditToServer(event: any) {
        try {
            const socketService = SocketService.getInstance();
            const currentCode = vscode.window.activeTextEditor?.document.getText();

            const contributor = calculateContributor(event);
            console.log(`Contributor: ${contributor}`);
            const messageData = {
                id: vscode.env.machineId,
                edits: event,
                code: currentCode,
                contributor: contributor, // TODO: add a contributor field to the message data
            };

            if (!socketService.isConnected()) {
                console.log('Socket not connected, queuing message...');
                this._pendingMessages.push({ event: 'edit', data: messageData });
                return;
            }

            console.log('Sending edit data through Socket.IO...');
            socketService.sendMessage('edit', messageData);
            this.recordingState.appendRecordingData(messageData);
            console.log('✅ Edit data sent successfully');

            // Replace the existing pending messages loop with the new method
            await this.processPendingMessages();
        } catch (error: any) {
            console.error('❌ Failed to send edit data:', error.message);
        }
    }

    private handleEvent(event: EventData) {
        // Handle the event data as needed
        // Once event publish from telemetry, we will add it to the edits observable, and send it to the central server
        this.edits.value = [...this.edits.value, event];
        this.sendEditToServer(event);

        // TODO: for each edit event, decide if it's AI-generated code
        console.log(`TODO: for every keystroke, decide if it\'s AI-generated code`);
    }

    // This method is to trigger proactive feedback from the LLM tutor
    async proactiveTrigger() {
        if (!this._hasTriggered) {
            this._hasTriggered = true;
            await vscode.commands.executeCommand('llmtutor.promptQuestion');
        }
    };



    async start() {
        this._status = 'on';
        this._hasTriggered = false;
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: '@tutor /start' });
    }

    stop(): void {
        this._status = 'off';
        SocketService.getInstance().disconnect();
        removeObserver(this.handleEvent);
    }

    pause(): void {
        this._status = 'off';
    }

    continue(): void {
        this._status = 'on';
    }
}
