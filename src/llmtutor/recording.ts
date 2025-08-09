import * as vscode from 'vscode';

export class RecordingState {
    private static instance: RecordingState;
    private _recordingData: any = [];
    private _isRecording: boolean = false;
    private _recordingFolder: string = '';
    
    private constructor() {}


    public static getInstance(): RecordingState {
        if (!RecordingState.instance) {
            RecordingState.instance = new RecordingState();

        }
        return RecordingState.instance;
    }


    public get recordingData(): any {
        return this._recordingData;
    }

    public set recordingData(value: any) {
        this._recordingData = value;
    }

    public get recordingFolder(): string {
        return this._recordingFolder;
    }

    public set recordingFolder(value: string) {
        console.log('set recording folder, ', value);
        this._recordingFolder = value;
    }

    public appendRecordingData(data: any) {
        this._recordingData.push(data);
    }

    public clearRecordingData() {
        this._recordingData = [];
    }

    public get isRecording(): boolean {
        return this._isRecording;
    }

    public set isRecording(value: boolean) {
        this._isRecording = value;
    }

    public async dumpAndClearRecordingData(){

		const recordingSessionID = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;		
		const filePath = vscode.Uri.joinPath(vscode.Uri.file(this._recordingFolder), `${recordingSessionID}.json`);
        // create a document
        await vscode.workspace.fs.writeFile(filePath, 
            Buffer.from(JSON.stringify(this._recordingData, null, 2))
        );

        // log if write file successfully
        console.log('✅ File written successfully');
        // clear the recording data
        this.clearRecordingData();
    }
}
