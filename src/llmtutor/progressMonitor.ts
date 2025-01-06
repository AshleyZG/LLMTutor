import * as vscode from 'vscode';
import * as http from 'http';
import Observable from './observableValue';
import axios from 'axios';
import { setCurrentMessage } from './humanInstructor';
import { popUpInstructorQuestion } from './windowQuestions';
import { addObserver, removeObserver } from '../telemetry/exporters';
import { EventData } from '../telemetry/types';

const config = vscode.workspace.getConfiguration('llmtutor');
const exportUrl = config.get('exportUrl');

// This is for chat participant to proactively sent a message to the user when they have not progressed in the last 5 minutes
export class ProgressMonitor {
    private _timeout: NodeJS.Timeout | undefined;
    private _server: http.Server | undefined;
    private _status: 'on' | 'off' = 'off';
    private edits: Observable<any[]> = new Observable([] as any[]);

    private _strugglingInterval: number = 0.1*60*1000; // 0.1 minutes

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
            this._timeout = setTimeout(this.proactiveTrigger, this._strugglingInterval);    
        }
    }

    private async sendEditToServer(event: any){
        // Send edit data to server
        try {
            const currentCode = vscode.window.activeTextEditor?.document.getText();
            console.log('Sending data to server');
            const response = await axios.post(`${exportUrl}/edit`, { content: JSON.stringify({
                "id": vscode.env.machineId,
                "edits": event,
                "code": currentCode
            }) });
            console.log(`Data exported successfully!`);
        } catch (error: any) {
            console.error(`Failed to export data: ${error.message}`);
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
        // pop up a notification at the cursor position
        await vscode.commands.executeCommand('llmtutor.promptQuestion');
    };


    private startServer() {
        // Set up a local server to listen on telemetry exporter
        this._server = http.createServer((req, res) => {
            if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString(); // Convert Buffer to string
                });
                req.on('end', () => {
                    if (req.url === '/teacher') {
                        console.log('Received teacher data:', JSON.parse(body));
                        const item = JSON.parse(body);
                        setCurrentMessage(item.body.question, item.body.recipient);
                        popUpInstructorQuestion();
                        // Add teacher-specific handling here
                        res.writeHead(200, { 'Content-Type': 'text/plain' });
                    } 
                });
            } else {
                res.writeHead(405, { 'Content-Type': 'text/plain' });
                res.end('Only POST requests are accepted');
            }
        });
        // Listen on an available port (e.g., 3000)
        const port = 3000;
        this._server.listen(port, () => {
            console.log(`LLMTutor's server is listening on port ${port}`);
        });
    }

    private closeServer(): void {
        this._server?.close();
    }

    async start() {
        this._status = 'on';
        this.startServer();
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: '@tutor /start' });
    }

    stop(): void {
        this._status = 'off';
        this.closeServer();
        removeObserver(this.handleEvent);
    }

    pause(): void {
        this._status = 'off';
    }

    continue(): void {
        this._status = 'on';
    }
}
