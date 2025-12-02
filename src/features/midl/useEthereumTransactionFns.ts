import {
  ChainName,
  MultiProtocolProvider,
  ProviderType,
  TypedTransactionReceipt,
  WarpTypedTransaction,
} from '@hyperlane-xyz/sdk';
import {
  ChainTransactionFns,
  ethers5TxToWagmiTx,
  useEthereumSwitchNetwork,
} from '@hyperlane-xyz/widgets';
import { TransactionIntention } from '@midl-xyz/midl-js-executor';
import {
  useAddTxIntention,
  useClearTxIntentions,
  useFinalizeBTCTransaction,
  useSendBTCTransactions,
  useSignIntention,
} from '@midl-xyz/midl-js-executor-react';
import { waitForTransactionReceipt } from '@wagmi/core';
import { useCallback } from 'react';
import { keccak256 } from 'viem';
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

        if (tx.type !== ProviderType.EthersV5) throw new Error(`Unsupported tx type: ${tx.type}`);

        if (activeChainName && activeChainName !== chainName) {
          await switchNetwork(chainName);
        }

        const chainId = multiProvider.getChainMetadata(chainName).chainId as number;
        logger.debug('Resolved chain metadata', { chainName, chainId });

        logger.debug(`Preparing Midl intention for chain ${chainName}`);
        const wagmiTx = ethers5TxToWagmiTx(tx.transaction);
        if (!wagmiTx.to) throw new Error('No tx recipient address specified');

        clearTxIntentions();

        // TODO: once asset configs include rune/BTC metadata, extend this intention with
        // deposit/withdraw instructions so Midl can move the underlying asset alongside the EVM tx.
        const intention = await addTxIntentionAsync({
          reset: true,
          intention: {
            evmTransaction: {
              to: wagmiTx.to,
              data: wagmiTx.data,
              value: wagmiTx.value ?? 0n,
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
      txs,
      chainName,
      activeChainName,
    }: {
      txs: WarpTypedTransaction[];
      chainName: ChainName;
      activeChainName?: ChainName;
    }) => {
      try {
        if (!txs.length) throw new Error('No transactions to send');
        reset();
        setStage('preparing');

        if (activeChainName && activeChainName !== chainName) {
          await switchNetwork(chainName);
        }

        const chainId = multiProvider.getChainMetadata(chainName).chainId as number;
        logger.debug('Resolved chain metadata for batch', { chainName, chainId });

        logger.debug(`Preparing Midl batch intention for chain ${chainName}`);
        clearTxIntentions();

        const intentions: TransactionIntention[] = [];
        for (const [index, tx] of txs.entries()) {
          if (tx.type !== ProviderType.EthersV5) throw new Error(`Unsupported tx type: ${tx.type}`);
          const wagmiTx = ethers5TxToWagmiTx(tx.transaction);
          if (!wagmiTx.to) throw new Error('No tx recipient address specified');

          // TODO: Inject rune/BTC deposit or withdrawal metadata here once we know which
          // asset is being bridged for each tx in the batch.
          const intention = await addTxIntentionAsync({
            reset: index === 0,
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
          intentions.push(intention);
        }

        setStage('finalizing');
        const btcTransaction = await finalizeBTCTransactionAsync();
        const btcTxId = btcTransaction?.tx?.id;
        const btcTxHex = btcTransaction?.tx?.hex;
        if (!btcTxId || !btcTxHex) {
          throw new Error('Unable to finalize BTC portion of transaction');
        }

        setStage('signing');
        const signedTxs: `0x${string}`[] = [];
        for (const intention of intentions) {
          const signedTx = await signIntentionAsync({
            intention,
            txId: btcTxId,
          });
          signedTxs.push(signedTx);
        }

        setStage('publishing');
        type SendBtcParams = Parameters<typeof sendBTCTransactionsAsync>[0];
        await sendBTCTransactionsAsync({
          serializedTransactions: signedTxs as SendBtcParams['serializedTransactions'],
          btcTransaction: btcTxHex as SendBtcParams['btcTransaction'],
        });

        const hashes = signedTxs.map((signedTx) => keccak256(signedTx));
        const hash = hashes.at(-1);
        if (!hash) throw new Error('Failed to compute transaction hash');

        setStage('waitingReceipt');

        const confirm = async (): Promise<TypedTransactionReceipt> => {
          try {
            let lastReceipt: TypedTransactionReceipt['receipt'] | null = null;
            for (const currentHash of hashes) {
              const receipt = await waitForTransactionReceipt(config, {
                chainId,
                hash: currentHash,
                confirmations: 1,
              });
              lastReceipt = {
                ...receipt,
                contractAddress: receipt.contractAddress || null,
              };
            }
            if (!lastReceipt) throw new Error('Failed to fetch transaction receipt');
            setStage('success');
            return {
              type: ProviderType.Viem,
              receipt: lastReceipt,
            };
          } catch (err: any) {
            setError(err?.message || 'Failed to confirm transaction');
            setStage('error');
            throw err;
          }
        };

        return { hash, confirm };
      } catch (error: any) {
        setError(error?.message || 'Failed to send transaction');
        setStage('error');
        throw error;
      }
    },
    [
      reset,
      setStage,
      switchNetwork,
      multiProvider,
      clearTxIntentions,
      addTxIntentionAsync,
      finalizeBTCTransactionAsync,
      signIntentionAsync,
      sendBTCTransactionsAsync,
      config,
      setError,
    ],
  );

  return {
    sendTransaction: onSendTx,
    sendMultiTransaction: onMultiSendTx,
    switchNetwork,
  };
}
