import * as vscode from 'vscode';

export interface CopyPasteEvent {
    timestamp: number;
    content: string;
    documentUri: string;
    range?: vscode.Range;
}

export interface AutocompleteEvent {
    timestamp: number;
    content: string;
    documentUri: string;
    range?: vscode.Range;
}

export interface AIMessageEvent {
    timestamp: number;
    codeSnippets: string[];
    documentUri?: string;
}

export interface KeystrokePattern {
    timestamp: number;
    character: string;
    position: number;
    documentUri: string;
    lineNumber: number;
    lineContent: string;
}

export interface AICodeSnippet {
    content: string;
    timestamp: number;
    documentUri?: string;
    // Track how much of this snippet has been manually typed
    typedPortions: Array<{
        start: number;
        end: number;
        timestamp: number;
    }>;
}

export interface PotentialAutocomplete {
    timestamp: number;
    content: string;
    documentUri: string;
    range: vscode.Range;
}

export class EditTrackingState {
    private static instance: EditTrackingState;
    
    // Track recent copy-paste events
    private recentCopyPasteEvents: CopyPasteEvent[] = [];
    
    // Track recent autocomplete events
    private recentAutocompleteEvents: AutocompleteEvent[] = [];
    
    // Track recent AI message events
    private recentAIMessageEvents: AIMessageEvent[] = [];
    
    // Track clipboard content
    private clipboardContent: string = '';
    
    // Track keystroke patterns for manual typing detection
    private keystrokePatterns: KeystrokePattern[] = [];
    
    // Track AI code snippets with typing progress
    private aiCodeSnippets: AICodeSnippet[] = [];
    
    // Track potential autocomplete events
    private potentialAutocompleteEvents: PotentialAutocomplete[] = [];
    
    private constructor() {}
    
    public static getInstance(): EditTrackingState {
        if (!EditTrackingState.instance) {
            EditTrackingState.instance = new EditTrackingState();
        }
        return EditTrackingState.instance;
    }
    
    // Copy-paste tracking methods
    public addCopyPasteEvent(event: CopyPasteEvent) {
        this.recentCopyPasteEvents.push(event);
        // Keep only recent events (last 10)
        if (this.recentCopyPasteEvents.length > 10) {
            this.recentCopyPasteEvents.shift();
        }
        console.log('Copy-paste event tracked:', event);
    }
    
    public getRecentCopyPasteEvents(): CopyPasteEvent[] {
        return [...this.recentCopyPasteEvents];
    }
    
    public setClipboardContent(content: string) {
        this.clipboardContent = content;
        console.log('Clipboard content set:', content.substring(0, 100) + '...');
    }
    
    public getClipboardContent(): string {
        return this.clipboardContent;
    }
    
    // Autocomplete tracking methods
    public addAutocompleteEvent(event: AutocompleteEvent) {
        this.recentAutocompleteEvents.push(event);
        if (this.recentAutocompleteEvents.length > 10) {
            this.recentAutocompleteEvents.shift();
        }
        console.log('Autocomplete event tracked:', event);
    }
    
    public getRecentAutocompleteEvents(): AutocompleteEvent[] {
        return [...this.recentAutocompleteEvents];
    }
    
    // AI message tracking methods
    public addAIMessageEvent(event: AIMessageEvent) {
        // Create AI code snippets with typing tracking
        const aiSnippets: AICodeSnippet[] = event.codeSnippets.map(snippet => ({
            content: snippet,
            timestamp: event.timestamp,
            documentUri: event.documentUri,
            typedPortions: []
        }));
        
        this.aiCodeSnippets.push(...aiSnippets);
        
        // Keep only recent AI snippets (last 20)
        if (this.aiCodeSnippets.length > 20) {
            this.aiCodeSnippets = this.aiCodeSnippets.slice(-20);
        }
        
        // Also add to existing recentAIMessageEvents for backward compatibility
        this.recentAIMessageEvents.push(event);
        if (this.recentAIMessageEvents.length > 5) {
            this.recentAIMessageEvents.shift();
        }
        
        console.log('AI code snippets tracked with typing analysis:', aiSnippets.length);
    }
    
    public getRecentAIMessageEvents(): AIMessageEvent[] {
        return [...this.recentAIMessageEvents];
    }
    
    // Add keystroke tracking with line information
    public addKeystroke(character: string, position: number, documentUri: string, lineNumber: number, lineContent: string) {
        const keystroke: KeystrokePattern = {
            timestamp: Date.now(),
            character,
            position,
            documentUri,
            lineNumber,
            lineContent // Add line content to the keystroke
        };
        
        this.keystrokePatterns.push(keystroke);
        
        // Keep only recent keystrokes (last 100)
        if (this.keystrokePatterns.length > 100) {
            this.keystrokePatterns.shift();
        }
        
        // Check if this keystroke matches any AI-generated content
        this.checkKeystrokeAgainstAIContent(keystroke);
    }
        
    
    // Add potential autocomplete (text inserted after Tab)
    public addPotentialAutocomplete(event: PotentialAutocomplete) {
        this.potentialAutocompleteEvents.push(event);
        
        // Keep only recent events (last 10)
        if (this.potentialAutocompleteEvents.length > 10) {
            this.potentialAutocompleteEvents.shift();
        }
        
        console.log('Potential autocomplete tracked:', event.content.substring(0, 50) + '...');
    }
    
    // Enhanced matching method
    public matchEditWithTrackedEvents(editEvent: any): {
        copyPasteMatch?: CopyPasteEvent;
        autocompleteMatch?: PotentialAutocomplete;
        aiMessageMatch?: AIMessageEvent;
        aiTypingMatch?: AICodeSnippet;
    } {
        const currentTime = editEvent.eventTime || Date.now();
        const editContent = editEvent.value || '';
        const documentUri = editEvent.documentUri || '';
        
        // Match with copy-paste events (within 2 seconds)
        const copyPasteMatch = this.recentCopyPasteEvents.find(event => 
            event.timestamp + 2000 >= currentTime &&
            event.documentUri === documentUri &&
            (event.content === editContent || editContent.includes(event.content))
        );

        // Enhanced autocomplete matching for Tab-accepted completions
        const autocompleteMatch = copyPasteMatch? undefined : this.findTabAcceptedAutocomplete(editContent, documentUri, currentTime);
        
        // Enhanced AI matching with typing analysis
        const aiTypingMatch = this.findAITypingMatch(editContent, documentUri, currentTime);
        
        // Fallback to simple AI message matching
        const aiMessageMatch = this.recentAIMessageEvents.find(event => 
            event.timestamp + 20000 >= currentTime && // 20 seconds within the last AI message
            event.codeSnippets.some(snippet => 
                editContent.includes(snippet) || snippet.includes(editContent)
            )
        );
        
        return { 
            copyPasteMatch, 
            autocompleteMatch, 
            aiMessageMatch: aiTypingMatch ? undefined : aiMessageMatch,
            aiTypingMatch 
        };
    }
    
    // Enhanced AI typing detection
    public findAITypingMatch(editContent: string, documentUri: string, currentTime: number): AICodeSnippet | undefined {
        for (const aiSnippet of this.aiCodeSnippets) {
            if (aiSnippet.documentUri && aiSnippet.documentUri !== documentUri) {
                continue;
            }
            
            // Method 1: Check current line similarity
            const currentLineSimilarity = this.checkCurrentLineSimilarity(aiSnippet, documentUri);
            if (currentLineSimilarity > 0.8) { // 80% similarity threshold
                console.log(`AI typing detected by current line similarity: ${currentLineSimilarity}`);
                return aiSnippet;
            }
            
            // Method 2: Check recent keystrokes pattern similarity
            const recentKeystrokesSimilarity = this.checkRecentKeystrokesSimilarity(aiSnippet, documentUri, currentTime);
            if (recentKeystrokesSimilarity > 0.7) { // 70% similarity threshold
                console.log(`AI typing detected by recent keystrokes similarity: ${recentKeystrokesSimilarity}`);
                return aiSnippet;
            }
        }
        
        return undefined;
    }
    
    private checkCurrentLineSimilarity(aiSnippet: AICodeSnippet, documentUri: string): number {
        // Get the current line where the cursor is
        const currentLine = this.getCurrentLineContent(documentUri);

        if (!currentLine) return 0;
        
        // Find the best matching line in the AI snippet
        const aiLines = aiSnippet.content.split('\n');
        let bestSimilarity = 0;
        
        for (const aiLine of aiLines) {
            const similarity = this.calculateLineSimilarity(currentLine, aiLine);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
            }
        }
        
        return bestSimilarity;
    }
    
    private checkRecentKeystrokesSimilarity(aiSnippet: AICodeSnippet, documentUri: string, currentTime: number): number {
        // Get recent keystrokes (last 20 keystrokes within 30 seconds)
        const recentKeystrokes = this.keystrokePatterns
            .filter(k => k.documentUri === documentUri && 
                        k.timestamp > currentTime - 30000) // Last 30 seconds
            .slice(-20);
        
        if (recentKeystrokes.length === 0) return 0;
        
        // Get unique lines from recent keystrokes using the stored lineContent
        const linesFromKeystrokes = this.getLinesFromRecentKeystrokes(recentKeystrokes);
        
        // Compare each line with AI snippet lines
        const aiLines = aiSnippet.content.split('\n');
        let totalSimilarity = 0;
        let lineCount = 0;
        
        for (const lineContent of linesFromKeystrokes) {
            let bestLineSimilarity = 0;
            
            for (const aiLine of aiLines) {
                const similarity = this.calculateLineSimilarity(lineContent, aiLine);
                if (similarity > bestLineSimilarity) {
                    bestLineSimilarity = similarity;
                }
            }
            
            totalSimilarity += bestLineSimilarity;
            lineCount++;
        }
        
        return lineCount > 0 ? totalSimilarity / lineCount : 0;
    }
    
    private getLinesFromRecentKeystrokes(keystrokes: KeystrokePattern[]): string[] {
        // Group keystrokes by line number and get the most recent lineContent for each line
        const lineMap = new Map<number, string>();
        
        for (const keystroke of keystrokes) {
            // Use the most recent lineContent for each line number
            lineMap.set(keystroke.lineNumber, keystroke.lineContent);
        }
        
        // Convert to array of line contents, sorted by line number
        const lines: string[] = [];
        const sortedLineNumbers = Array.from(lineMap.keys()).sort((a, b) => a - b);
        
        for (const lineNumber of sortedLineNumbers) {
            const lineContent = lineMap.get(lineNumber);
            if (lineContent && lineContent.trim() !== '') {
                lines.push(lineContent);
            }
        }
        
        return lines;
    }
    
    private getCurrentLineContent(documentUri: string): string {
        // This is a simplified version - in practice you'd get the actual document
        // For now, we'll reconstruct from recent keystrokes
        
        const recentKeystrokes = this.keystrokePatterns
            .filter(k => k.documentUri === documentUri)
            .slice(-50); // Last 50 keystrokes
        
        return recentKeystrokes.map(k => k.character).join('');
    }
    
    private reconstructLinesFromKeystrokes(keystrokes: KeystrokePattern[]): string[] {
        // Group keystrokes by line number and reconstruct lines
        const linesMap = new Map<number, string[]>();
        
        for (const keystroke of keystrokes) {
            const lineNum = keystroke.lineNumber || 0;
            if (!linesMap.has(lineNum)) {
                linesMap.set(lineNum, []);
            }
            linesMap.get(lineNum)!.push(keystroke.character);
        }
        
        // Convert to array of lines
        const lines: string[] = [];
        for (const [lineNum, chars] of linesMap) {
            lines[lineNum] = chars.join('');
        }
        
        return lines.filter(line => line && line.trim() !== '');
    }
    
    private calculateLineSimilarity(line1: string, line2: string): number {
        // Normalize lines for comparison
        const normalizedLine1 = line1.trim().toLowerCase();
        const normalizedLine2 = line2.trim().toLowerCase();
        
        if (normalizedLine1 === normalizedLine2) return 1.0;
        
        // Use Levenshtein distance for similarity
        const distance = this.levenshteinDistance(normalizedLine1, normalizedLine2);
        const maxLength = Math.max(normalizedLine1.length, normalizedLine2.length);
        
        return maxLength > 0 ? 1 - (distance / maxLength) : 0;
    }
    
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1, // deletion
                    matrix[j - 1][i] + 1, // insertion
                    matrix[j - 1][i - 1] + indicator // substitution
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    private checkKeystrokeAgainstAIContent(keystroke: KeystrokePattern) {
        for (const aiSnippet of this.aiCodeSnippets) {
            if (aiSnippet.documentUri && aiSnippet.documentUri !== keystroke.documentUri) {
                continue; // Different document
            }
            
            // Check if this keystroke is part of the AI snippet
            const snippetContent = aiSnippet.content;
            const currentTypedContent = this.getCurrentTypedContent(keystroke.documentUri);
            
            // Find where in the AI snippet this keystroke would fit
            const matchIndex = this.findBestMatchPosition(currentTypedContent + keystroke.character, snippetContent);
            
            if (matchIndex !== -1) {
                // This keystroke is part of the AI snippet
                const startPos = matchIndex - currentTypedContent.length;
                const endPos = matchIndex;
                
                // Check if this portion hasn't been tracked yet
                const isNewPortion = !aiSnippet.typedPortions.some(portion => 
                    portion.start <= startPos && portion.end >= endPos
                );
                if (isNewPortion) {
                    aiSnippet.typedPortions.push({
                        start: startPos,
                        end: endPos,
                        timestamp: keystroke.timestamp
                    });
                    
                    console.log(`AI snippet typing detected: "${snippetContent.substring(startPos, endPos + 1)}"`);
                }
            }
        }
    }
    
    private getCurrentTypedContent(documentUri: string): string {
        // Get recent keystrokes for this document (last 50 keystrokes)
        const recentKeystrokes = this.keystrokePatterns
            .filter(k => k.documentUri === documentUri)
            .slice(-50);
        
        return recentKeystrokes.map(k => k.character).join('');
    }
    
    private findBestMatchPosition(typedContent: string, aiContent: string): number {
        // Use sliding window to find the best match
        const windowSize = Math.min(typedContent.length, 20); // Look at last 20 characters
        const searchContent = typedContent.slice(-windowSize);
        
        // Find the best match position in AI content
        let bestMatchIndex = -1;
        let bestMatchScore = 0;
        
        for (let i = 0; i <= aiContent.length - searchContent.length; i++) {
            const aiSubstring = aiContent.substring(i, i + searchContent.length);
            const similarity = this.calculateSimilarity(searchContent, aiSubstring);
            
            if (similarity > bestMatchScore && similarity > 0.8) { // 80% similarity threshold
                bestMatchScore = similarity;
                bestMatchIndex = i + searchContent.length - 1;
            }
        }
        
        return bestMatchIndex;
    }
    
    private calculateSimilarity(str1: string, str2: string): number {
        if (str1.length !== str2.length) return 0;
        
        let matches = 0;
        for (let i = 0; i < str1.length; i++) {
            if (str1[i] === str2[i]) matches++;
        }
        
        return matches / str1.length;
    }
    
    private findTabAcceptedAutocomplete(editContent: string, documentUri: string, currentTime: number): PotentialAutocomplete | undefined {
        // Look for autocomplete events that happened shortly after a Tab press
        return this.potentialAutocompleteEvents.find(event => {
            const timeAfterAutocomplete = currentTime - event.timestamp;
            
            // Check if this edit matches the autocomplete content
            const contentMatches = event.content === editContent || 
                                 editContent.includes(event.content) || 
                                 event.content.includes(editContent);
            
            // Check timing: should be within 500ms of Tab press and 100ms of autocomplete event
            const isRecentAutocomplete = timeAfterAutocomplete >= 0 && timeAfterAutocomplete < 100;
            const isSameDocument = event.documentUri === documentUri;
            return contentMatches && isRecentAutocomplete && isSameDocument;
        });
    }
    
    // Clear old events (older than 30 seconds)
    public cleanupOldEvents() {
        const currentTime = Date.now();
        const thirtySecondsAgo = currentTime - 30000;
        
        this.recentCopyPasteEvents = this.recentCopyPasteEvents.filter(
            event => event.timestamp > thirtySecondsAgo
        );
        
        this.recentAutocompleteEvents = this.recentAutocompleteEvents.filter(
            event => event.timestamp > thirtySecondsAgo
        );
        
        this.recentAIMessageEvents = this.recentAIMessageEvents.filter(
            event => event.timestamp > thirtySecondsAgo
        );
    }
} 