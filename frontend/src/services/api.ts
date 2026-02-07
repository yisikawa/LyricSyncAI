import type { Segment } from '../types';

const API_BASE_URL = 'http://localhost:8001';

export const api = {
    async uploadVideo(file: File): Promise<any> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            let errorMsg = 'Upload failed';
            try {
                const errorData = await response.json();
                if (errorData.detail) errorMsg = errorData.detail;
            } catch { }
            throw new Error(errorMsg);
        }
        return await response.json();
    },

    async separateAudio(filename: string): Promise<any> {
        const response = await fetch(`${API_BASE_URL}/separate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
        });

        if (!response.ok) {
            let errorMsg = 'Separation failed';
            try {
                const errorData = await response.json();
                if (errorData.detail) errorMsg = errorData.detail;
            } catch { }
            throw new Error(errorMsg);
        }
        return await response.json();
    },

    async *transcribeLive(filename: string): AsyncIterableIterator<Segment> {
        const response = await fetch(`${API_BASE_URL}/transcribe-live`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
        });

        if (!response.ok) {
            let errorMsg = 'Transcription failed';
            try {
                const errorData = await response.json();
                if (errorData.detail) errorMsg = errorData.detail;
            } catch { }
            throw new Error(errorMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Response body is null');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const segment = JSON.parse(line);
                    if (segment.error) throw new Error(segment.error);
                    yield segment as Segment;
                } catch (e) {
                    console.error('Error parsing JSON line:', line, e);
                }
            }
        }
    },

    async exportVideo(filename: string, segments: Segment[]): Promise<{ url: string; filename: string }> {
        const response = await fetch(`${API_BASE_URL}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                video_filename: filename,
                segments: segments,
            }),
        });

        if (!response.ok) {
            let errorMsg = 'Export failed';
            try {
                const errorData = await response.json();
                if (errorData.detail) errorMsg = errorData.detail;
            } catch { }
            throw new Error(errorMsg);
        }
        return await response.json();
    }
};
