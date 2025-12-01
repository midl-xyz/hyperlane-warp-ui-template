import {
  ChainName,
  MultiProtocolProvider,
  ProviderType,
  TypedTransactionReceipt,
  WarpTypedTransaction,
} from '@hyperlane-xyz/sdk';
import { ChainTransactionFns, ethers5TxToWagmiTx, useEthereumSwitchNetwork } from '@hyperlane-xyz/widgets';
import {
  useAddTxIntention,
  useClearTxIntentions,
  useFinalizeBTCTransaction,
  useSendBTCTransactions,
  useSignIntention,
} from '@midl-xyz/midl-js-executor-react';
import { keccak256 } from 'viem';
import { useCallback } from 'react';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useConfig } from 'wagmi';

import { logger } from '../../utils/logger';
import { useMidlTxProgressActions } from './useMidlTxProgress';

export function useEthereumTransactionFns(
  multiProvider: MultiProtocolProvider,
): ChainTransactionFns {
  const config = useConfig();
  const { switchNetwork } = useEthereumSwitchNetwork(multiProvider);
  const { addTxIntentionAsync } = useAddTxIntention();
  const clearTxIntentions = useClearTxIntentions();
  const { finalizeBTCTransactionAsync } = useFinalizeBTCTransaction();
  const { signIntentionAsync } = useSignIntention();
  const { sendBTCTransactionsAsync } = useSendBTCTransactions();
  const { setStage, setError, reset } = useMidlTxProgressActions();

  const onSendTx = useCallback(
    async ({
      tx,
      chainName,
      activeChainName,
    }: {
      tx: WarpTypedTransaction;
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      try {
        reset();
        setStage('preparing');

        if (tx.type !== ProviderType.EthersV5)
          throw new Error(`Unsupported tx type: ${tx.type}`);

        if (activeChainName && activeChainName !== chainName) {
          await switchNetwork(chainName);
        }

        const chainId = multiProvider.getChainMetadata(chainName)
          .chainId as number;

        logger.debug(`Preparing Midl intention for chain ${chainName}`);
        const wagmiTx = ethers5TxToWagmiTx(tx.transaction);
        if (!wagmiTx.to) throw new Error('No tx recipient address specified');

        clearTxIntentions();

        const intention = await addTxIntentionAsync({
          reset: true,
          intention: {
            evmTransaction: {
              to: wagmiTx.to,
              data: wagmiTx.data,
              value: wagmiTx.value ?? 0n,
              gas: wagmiTx.gas,
              gasPrice: wagmiTx.gasPrice,
              maxFeePerGas: wagmiTx.maxFeePerGas,
              maxPriorityFeePerGas: wagmiTx.maxPriorityFeePerGas,
              nonce: wagmiTx.nonce,
              chainId,
            },
          },
        });

        setStage('finalizing');
        const btcTransaction = await finalizeBTCTransactionAsync();
        const btcTxId = btcTransaction?.tx?.id;
        const btcTxHex = btcTransaction?.tx?.hex;
        if (!btcTxId || !btcTxHex) {
          throw new Error('Unable to finalize BTC portion of transaction');
        }

        setStage('signing');
        const signedTx = await signIntentionAsync({
          intention,
          txId: btcTxId,
        });

        setStage('publishing');
        type SendBtcParams = Parameters<typeof sendBTCTransactionsAsync>[0];
        await sendBTCTransactionsAsync({
          serializedTransactions: [signedTx] as SendBtcParams['serializedTransactions'],
          btcTransaction: btcTxHex as SendBtcParams['btcTransaction'],
        });

        const hash = keccak256(signedTx);
        setStage('waitingReceipt');

        const confirm = (): Promise<TypedTransactionReceipt> =>
          waitForTransactionReceipt(config, {
            chainId,
            hash,
            confirmations: 1,
          })
            .then((receipt) => {
              setStage('success');
              return {
                type: ProviderType.Viem,
                receipt: { ...receipt, contractAddress: receipt.contractAddress || null },
              } as TypedTransactionReceipt;
            })
            .catch((err) => {
              setError(err?.message || 'Failed to confirm transaction');
              setStage('error');
              throw err;
            });

        return { hash, confirm };
      } catch (error: any) {
        setError(error?.message || 'Failed to send transaction');
        setStage('error');
        throw error;
      }
    },
    [
      config,
      switchNetwork,
      multiProvider,
      addTxIntentionAsync,
      clearTxIntentions,
      finalizeBTCTransactionAsync,
      signIntentionAsync,
      sendBTCTransactionsAsync,
      setStage,
      setError,
      reset,
    ],
  );

  const onMultiSendTx = useCallback(
    async ({
      txs: _,
      chainName: __,
      activeChainName: ___,
    }: {
      txs: WarpTypedTransaction[];
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      throw new Error('Multi Transactions not supported on EVM');
    },
    [],
  );

  return {
    sendTransaction: onSendTx,
    sendMultiTransaction: onMultiSendTx,
    switchNetwork,
  };
}
