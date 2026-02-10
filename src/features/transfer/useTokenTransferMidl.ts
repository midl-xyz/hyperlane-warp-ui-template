import { useClearTxIntentions } from '@midl/executor-react';
import { useMidlContext } from '@midl/react';
import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { toastTxSuccess } from '../../components/toast/TxSuccessToast';
import { logger } from '../../utils/logger';
import { useMultiProvider } from '../chains/hooks';
import { getChainDisplayName } from '../chains/utils';
import { useStore } from '../store';
import { getTokenByIndex, useWarpCore } from '../tokens/hooks';
import { TransferFormValues, TransferStatus } from './types';
import { executeMidlTransfer, getMidlSenderAddress } from './midlTransfer';

export function useTokenTransferMidl(onDone?: () => void) {
  const { transfers, addTransfer, updateTransferStatus } = useStore((s) => ({
    transfers: s.transfers,
    addTransfer: s.addTransfer,
    updateTransferStatus: s.updateTransferStatus,
  }));
  const transferIndex = transfers.length;

  const warpCore = useWarpCore();
  const multiProvider = useMultiProvider();
  const { config } = useMidlContext();
  const clearTxIntentions = useClearTxIntentions();

  const [isLoading, setIsLoading] = useState(false);

  const triggerTransactions = useCallback(
    async (values: TransferFormValues) => {
      logger.debug('Preparing MIDL transfer transaction(s)');
      setIsLoading(true);
      let transferStatus: TransferStatus = TransferStatus.Preparing;
      updateTransferStatus(transferIndex, transferStatus);

      const { origin, destination, tokenIndex, amount, recipient } = values;

      try {
        const originToken = getTokenByIndex(warpCore, tokenIndex);
        const connection = originToken?.getConnectionForChain(destination);
        if (!originToken || !connection) throw new Error('No token route found between chains');

        const sender = getMidlSenderAddress(config);

        addTransfer({
          timestamp: new Date().getTime(),
          status: TransferStatus.Preparing,
          origin,
          destination,
          originTokenAddressOrDenom: originToken.addressOrDenom,
          destTokenAddressOrDenom: connection.token.addressOrDenom,
          sender,
          recipient,
          amount,
        });

        const updateStatus = (status: TransferStatus) => {
          transferStatus = status;
          updateTransferStatus(transferIndex, status);
        };

        clearTxIntentions();

        const { originTxHash } = await executeMidlTransfer({
          config,
          warpCore,
          values,
          updateStatus,
        });

        updateTransferStatus(transferIndex, TransferStatus.ConfirmedTransfer, { originTxHash });
        toastTxSuccess('Transfer transaction sent!', originTxHash || '', origin);
      } catch (error: any) {
        logger.error(`Error at MIDL transfer stage ${transferStatus}`, error);
        updateTransferStatus(transferIndex, TransferStatus.Failed);

        const errorMsg = error.message || error.toString();
        if (errorMsg.includes('User rejected') || errorMsg.includes('user rejected')) {
          toast.error('Transaction rejected by wallet.');
        } else {
          toast.error(
            midlErrorMessages[transferStatus] ||
              `Unable to transfer tokens via MIDL. ${getChainDisplayName(multiProvider, origin)} may be busy.`,
          );
        }
      }

      setIsLoading(false);
      if (onDone) onDone();
    },
    [warpCore, config, clearTxIntentions, transferIndex, addTransfer, updateTransferStatus, multiProvider, onDone],
  );

  return { isLoading, triggerTransactions };
}

const midlErrorMessages: Partial<Record<TransferStatus, string>> = {
  [TransferStatus.Preparing]: 'Error while preparing the transfer.',
  [TransferStatus.CreatingTxs]: 'Error while creating warp route transactions.',
  [TransferStatus.BuildingIntentions]: 'Error building MIDL transaction intentions.',
  [TransferStatus.FinalizingBtcTx]: 'Error preparing Bitcoin transaction.',
  [TransferStatus.SigningBtcTx]: 'Error signing with Bitcoin wallet.',
  [TransferStatus.BroadcastingTx]: 'Error broadcasting transactions.',
  [TransferStatus.ConfirmingTransfer]: 'Error confirming transfer.',
};
