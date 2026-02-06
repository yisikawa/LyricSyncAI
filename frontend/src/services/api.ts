import type { Segment } from '../types';

const API_BASE_URL = 'http://localhost:8001';

export const api = {
    async *transcribeLive(filename: string): AsyncIterableIterator<Segment> {
        const response = await fetch(`${API_BASE_URL}/transcribe-live`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename }),
        });

        if (!response.ok) throw new Error('Transcription failed');
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
                const segment = JSON.parse(line);
                if (segment.error) throw new Error(segment.error);
                yield segment as Segment;
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

        if (!response.ok) throw new Error('Export failed');
        return await response.json();
    }
};
