import React from 'react';
import type { UploadResult, Segment } from '../types';

interface VideoPlayerProps {
    uploadResult?: UploadResult | null;
    localFile?: File | null;
    segments: Segment[];
    currentTime: number;
    videoRef: React.Ref<HTMLVideoElement>;
    onTimeUpdate: () => void;
    compact?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    uploadResult,
    localFile,
    segments,
    currentTime,
    videoRef,
    onTimeUpdate,
    compact = false
}) => {
    const [videoSrc, setVideoSrc] = React.useState<string>('');

    React.useEffect(() => {
        let url = '';
        if (uploadResult?.filename) {
            url = `http://localhost:8001/uploads/${encodeURIComponent(uploadResult.filename)}`;
        } else if (localFile) {
            url = URL.createObjectURL(localFile);
        }

        setVideoSrc(url);

        return () => {
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        };
    }, [uploadResult, localFile]);

    if (!videoSrc) {
        return (
            <div className="w-full aspect-video bg-gray-900 rounded-2xl flex flex-col items-center justify-center border border-dashed border-gray-700 p-8">
                <div className="bg-gray-800 p-4 rounded-full mb-4">
                    <span className="text-3xl text-gray-600">🎬</span>
                </div>
                <p className="text-gray-500 font-medium">動画が選択されていません</p>
            </div>
        );
    }

    if (compact) {
        return (
            <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-lg group">
                <video
                    key={videoSrc}
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full h-auto object-contain max-h-[80vh] bg-black"
                    controls
                    onTimeUpdate={onTimeUpdate}
                />
                <div className="absolute inset-x-0 bottom-12 flex flex-col items-center justify-end px-4 pointer-events-none z-50 min-h-[4rem]">
                    {segments.map((segment) => {
                        if (currentTime >= segment.start && currentTime < segment.end) {
                            return (
                                <span
                                    key={segment.id}
                                    className="inline-block bg-black/70 text-white text-base md:text-lg font-bold px-3 py-1 rounded backdrop-blur-sm shadow-xl border border-white/10"
                                    style={{ textShadow: '1px 1px 2px black' }}
                                >
                                    {segment.text}
                                </span>
                            );
                        }
                        return null;
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="relative w-full bg-black rounded-xl overflow-hidden shadow-lg group">
                <video
                    ref={videoRef}
                    src={videoSrc}
                    className="w-full h-auto object-contain max-h-[70vh] bg-black"
                    controls
                    onTimeUpdate={onTimeUpdate}
                />

                {/* Available Subtitle Overlay */}
                <div className="absolute inset-x-0 bottom-12 flex flex-col items-center justify-end px-4 pointer-events-none z-50 min-h-[4rem]">
                    {segments.map((segment) => {
                        if (currentTime >= segment.start && currentTime < segment.end) {
                            return (
                                <span
                                    key={segment.id}
                                    className="inline-block bg-black/60 text-white text-lg md:text-xl font-bold px-3 py-1 rounded backdrop-blur-sm shadow-md"
                                    style={{ textShadow: '1px 1px 2px black' }}
                                >
                                    {segment.text}
                                </span>
                            );
                        }
                        return null;
                    })}
                </div>
            </div>
        </div>
    );
};
