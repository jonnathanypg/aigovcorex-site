/**
 * KindiCore AI — Onboarding Store (Zustand + Persist)
 * Adapted from EnpiAI/PymAI onboarding pattern.
 * Tracks welcome modal, guided tour, and setup checklist state.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface OnboardingState {
    isTourActive: boolean;
    tourStepIndex: number;
    completedSteps: string[];
    hasSeenWelcome: boolean;
    checklistExpanded: boolean;

    startTour: (stepIndex?: number) => void;
    stopTour: () => void;
    nextTourStep: () => void;
    prevTourStep: () => void;
    completeStep: (step: string) => void;
    setHasSeenWelcome: (seen: boolean) => void;
    setChecklistExpanded: (expanded: boolean) => void;
    setCompletedSteps: (steps: string[]) => void;
    reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
    persist(
        (set) => ({
            isTourActive: false,
            tourStepIndex: 0,
            completedSteps: [],
            hasSeenWelcome: false,
            checklistExpanded: false,

            startTour: (stepIndex = 0) =>
                set({ isTourActive: true, tourStepIndex: stepIndex, checklistExpanded: false }),
            stopTour: () => set({ isTourActive: false }),
            nextTourStep: () =>
                set((state) => ({ tourStepIndex: state.tourStepIndex + 1 })),
            prevTourStep: () =>
                set((state) => ({ tourStepIndex: Math.max(0, state.tourStepIndex - 1) })),
            completeStep: (step) =>
                set((state) => {
                    if (state.completedSteps.includes(step)) return {};
                    return { completedSteps: [...state.completedSteps, step] };
                }),
            setHasSeenWelcome: (seen) => set({ hasSeenWelcome: seen }),
            setChecklistExpanded: (expanded) => set({ checklistExpanded: expanded }),
            setCompletedSteps: (steps) => set({ completedSteps: steps }),
            reset: () =>
                set({
                    isTourActive: false,
                    tourStepIndex: 0,
                    completedSteps: [],
                    hasSeenWelcome: false,
                    checklistExpanded: false,
                }),
        }),
        {
            name: 'kindicore-onboarding-store',
        }
    )
);
