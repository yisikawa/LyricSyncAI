export type Segment = {
    id: number;
    start: number;
    end: number;
    text: string;
};

export type UploadResult = {
    filename: string;
    filepath: string;
    message: string;
};
