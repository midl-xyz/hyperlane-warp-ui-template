import { Modal } from '@hyperlane-xyz/widgets';
import { useEffect } from 'react';
import { SolidButton } from '../../components/buttons/SolidButton';
import { useMidlTxProgressActions, useMidlTxProgressState, MidlTxStage } from './useMidlTxProgress';

const STEP_ORDER: MidlTxStage[] = [
  'preparing',
  'finalizing',
  'signing',
  'publishing',
  'waitingReceipt',
];

const STAGE_LABELS: Record<MidlTxStage, string> = {
  idle: '',
  preparing: 'Preparing transaction',
  finalizing: 'Finalizing BTC transaction',
  signing: 'Signing intention',
  publishing: 'Publishing on-chain',
  waitingReceipt: 'Waiting for confirmation',
  success: 'Transfer confirmed',
  error: 'Transfer failed',
};

function getCurrentIndex(stage: MidlTxStage) {
  if (stage === 'idle') return -1;
  if (stage === 'success') return STEP_ORDER.length;
  return Math.min(STEP_ORDER.indexOf(stage as (typeof STEP_ORDER)[number]), STEP_ORDER.length - 1);
}

export function MidlTxProgressModal() {
  const { stage, error, lastStage } = useMidlTxProgressState();
  const { reset } = useMidlTxProgressActions();
  const isOpen = stage !== 'idle';

  useEffect(() => {
    if (stage === 'success') {
      const timer = setTimeout(() => reset(), 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [stage, reset]);

  if (!isOpen) return null;

  const displayStage = stage === 'error' && lastStage ? lastStage : stage;
  const activeIndex = getCurrentIndex(displayStage);

  return (
    <Modal
      isOpen
      close={() => {
        if (stage === 'error' || stage === 'success') {
          reset();
        }
      }}
      title="Sending transaction with Midl"
      panelClassname="flex flex-col gap-6 p-6"
    >
      <div className="flex flex-col gap-4">
        {STEP_ORDER.map((step, index) => {
          const status =
            stage === 'error'
              ? index < activeIndex
                ? 'completed'
                : index === activeIndex
                  ? 'error'
                  : 'pending'
              : index < activeIndex
                ? 'completed'
                : index === activeIndex
                  ? 'active'
                  : 'pending';
          return (
            <div key={step} className="flex items-center gap-3 text-sm">
              <StepIndicator status={status} />
              <span className="text-gray-900">{STAGE_LABELS[step]}</span>
            </div>
          );
        })}
      </div>

      {stage === 'success' && (
        <p className="text-center text-sm text-green-700">Transaction confirmed on destination chain.</p>
      )}

      {stage === 'error' && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-sm text-red-600">{error || 'An error occurred while sending the transaction.'}</p>
          <SolidButton color="gray" className="px-4 py-1" onClick={reset}>
            Close
          </SolidButton>
        </div>
      )}
    </Modal>
  );
}

function StepIndicator({ status }: { status: 'completed' | 'active' | 'pending' | 'error' }) {
  if (status === 'completed') {
    return <span className="h-3 w-3 rounded-full bg-green-500" />;
  }
  if (status === 'active') {
    return (
      <span className="h-3 w-3 animate-pulse rounded-full border-2 border-primary-500" />
    );
  }
  if (status === 'error') {
    return <span className="h-3 w-3 rounded-full bg-red-500" />;
  }
  return <span className="h-3 w-3 rounded-full bg-gray-300" />;
}
