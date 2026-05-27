import React from 'react';
import type { Step } from '../types';

interface StepNavigationProps {
    currentStep: Step;
    onStepChange: (step: Step, options?: { ctrlKey: boolean }) => void;
    unlockedSteps: Step[];
}

export const StepNavigation: React.FC<StepNavigationProps> = ({
    currentStep,
    onStepChange,
    unlockedSteps
}) => {
    const steps: { key: Step; label: string; icon: string; color: string; borderColor: string; underlineColor: string }[] = [
        { key: 'upload',          label: '動画選択',   icon: '📤', color: 'rgba(37,99,235,0.2)',   borderColor: 'rgba(59,130,246,0.5)',   underlineColor: '#3b82f6' },
        { key: 'vocal',           label: '音声分離',   icon: '🎙️', color: 'rgba(37,99,235,0.2)',   borderColor: 'rgba(59,130,246,0.5)',   underlineColor: '#3b82f6' },
        { key: 'transcribe',      label: '文字おこし', icon: '✍️', color: 'rgba(37,99,235,0.2)',   borderColor: 'rgba(59,130,246,0.5)',   underlineColor: '#3b82f6' },
        { key: 'edit',            label: '字幕編集',   icon: '✏️', color: 'rgba(37,99,235,0.2)',   borderColor: 'rgba(59,130,246,0.5)',   underlineColor: '#3b82f6' },
        { key: 'export-original', label: '字幕動画',   icon: '🎬', color: 'rgba(37,99,235,0.2)',   borderColor: 'rgba(59,130,246,0.5)',   underlineColor: '#3b82f6' },
        { key: 'export-ai',       label: 'AI動画',     icon: '🤖', color: 'rgba(109,40,217,0.2)',  borderColor: 'rgba(139,92,246,0.5)',   underlineColor: '#8b5cf6' },
    ];

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'row',
                width: '100%',
                backgroundColor: 'rgba(17, 24, 39, 0.6)',
                padding: '8px',
                borderRadius: '16px',
                border: '1px solid rgba(75, 85, 99, 0.4)',
                marginBottom: '32px',
                gap: '8px',
                boxSizing: 'border-box',
                justifyContent: 'space-between',
                alignItems: 'stretch'
            }}
        >
            {steps.map((step) => {
                const isActive = currentStep === step.key;
                const isUnlocked = unlockedSteps.includes(step.key);

                return (
                    <div
                        key={step.key}
                        onClick={() => isUnlocked && onStepChange(step.key)}
                        style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '12px 4px',
                            borderRadius: '12px',
                            cursor: isUnlocked ? 'pointer' : 'not-allowed',
                            transition: 'all 0.3s ease',
                            backgroundColor: isActive ? step.color : 'transparent',
                            border: isActive ? `1px solid ${step.borderColor}` : '1px solid transparent',
                            opacity: isUnlocked ? 1 : 0.3,
                            minWidth: 0,
                            overflow: 'hidden'
                        }}
                    >
                        <span style={{
                            fontSize: '20px',
                            marginBottom: '4px',
                            filter: isActive ? `drop-shadow(0 0 8px ${step.underlineColor})` : 'none',
                            transform: isActive ? 'scale(1.1)' : 'scale(1)',
                            transition: 'transform 0.3s'
                        }}>
                            {step.icon}
                        </span>
                        <span style={{
                            fontSize: '10px',
                            fontWeight: '800',
                            color: isActive ? step.underlineColor : '#9ca3af',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            width: '100%'
                        }}>
                            {step.label}
                        </span>
                        {isActive && (
                            <div style={{
                                width: '20px',
                                height: '2px',
                                backgroundColor: step.underlineColor,
                                marginTop: '4px',
                                borderRadius: '2px'
                            }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};
