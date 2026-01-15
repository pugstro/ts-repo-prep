export type DetailLevel = 'lite' | 'structure' | 'signatures' | 'detailed';

export interface FileSummary {
    path: string;
    mtime: number;
    classification?: string;
    summary?: string;
    // Optional because 'lite' level won't have them
    exports?: any[];
    imports?: any[];
    chunks?: any[];
}

export interface ProjectNode {
    name: string;
    type: 'file' | 'directory';
    path: string;
    children?: ProjectNode[];
    summary?: {
        classification?: string;
        summaryText?: string;
        exports?: any[];
        imports?: any[];
        chunks?: any[];
    };
}
