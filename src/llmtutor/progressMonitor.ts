import * as vscode from 'vscode';
import Observable from './observableValue';
import { addObserver, removeObserver } from '../telemetry/exporters';
import { EventData } from '../telemetry/types';
import SocketService from './socketService';


// This is for chat participant to proactively sent a message to the user when they have not progressed in the last 5 minutes
export class ProgressMonitor {
    private _timeout: NodeJS.Timeout | undefined;
    private _status: 'on' | 'off' = 'off';
    private edits: Observable<any[]> = new Observable([] as any[]);

    private _strugglingInterval: number = 1*60*1000; // 1 minutes
    private _hasTriggered: boolean = false;

    constructor() {
        this.monitorEditsStatus = this.monitorEditsStatus.bind(this);
        this.handleEvent = this.handleEvent.bind(this);

        this.edits.subscribe(this.monitorEditsStatus);
        addObserver(this.handleEvent);
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

    private async sendEditToServer(event: any) {
        try {
            const currentCode = vscode.window.activeTextEditor?.document.getText();
            console.log('Sending edit data through Socket.IO...');
            SocketService.getInstance().sendMessage('edit', {
                id: vscode.env.machineId,
                edits: event,
                code: currentCode
            });
            console.log('✅ Edit data sent successfully');
        } catch (error: any) {
            console.error('❌ Failed to send edit data:', error.message);
        }
    }

    private handleEvent(event: EventData) {
        // Handle the event data as needed
        // Once event publish from telemetry, we will add it to the edits observable, and send it to the central server
        this.edits.value = [...this.edits.value, event];
        this.sendEditToServer(event);
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
