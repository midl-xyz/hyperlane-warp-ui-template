import { create } from 'zustand';

export type MidlTxStage =
  | 'idle'
  | 'preparing'
  | 'finalizing'
  | 'signing'
  | 'publishing'
  | 'waitingReceipt'
  | 'success'
  | 'error';

type MidlTxProgressState = {
  stage: MidlTxStage;
  lastStage?: MidlTxStage;
  error?: string;
  setStage: (stage: MidlTxStage) => void;
  setError: (error?: string) => void;
  reset: () => void;
};

const useMidlTxProgressStore = create<MidlTxProgressState>((set) => ({
  stage: 'idle',
  lastStage: undefined,
  error: undefined,
  setStage: (stage) =>
    set((state) => ({
      stage,
      error: stage === 'idle' ? undefined : state.error,
      lastStage: stage !== 'error' && stage !== 'idle' ? stage : state.lastStage,
    })),
  setError: (error) => set({ error }),
  reset: () => set({ stage: 'idle', error: undefined, lastStage: undefined }),
}));

export function useMidlTxProgressState() {
  return useMidlTxProgressStore((state) => ({
    stage: state.stage,
    error: state.error,
    lastStage: state.lastStage,
  }));
}

export function useMidlTxProgressActions() {
  const setStage = useMidlTxProgressStore((state) => state.setStage);
  const setError = useMidlTxProgressStore((state) => state.setError);
  const reset = useMidlTxProgressStore((state) => state.reset);
  return { setStage, setError, reset };
}
