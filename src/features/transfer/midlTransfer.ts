import { SignMessageProtocol, getDefaultAccount, waitForTransaction } from '@midl/core';
import type { Config } from '@midl/core';
import {
  addCompleteTxIntention,
  addTxIntention,
  bytes32toRuneId,
  executorAbi,
  finalizeBTCTransaction,
  getEVMAddress,
  midl as midlMainnet,
  midlRegtest,
  signIntention,
  SystemContracts,
  weiToSatoshis,
} from '@midl/executor';
import type { TransactionIntention } from '@midl/executor';
import { WarpCore } from '@hyperlane-xyz/sdk';
import { toWei } from '@hyperlane-xyz/utils';
import { type PublicClient, createPublicClient, erc20Abi, http, keccak256 } from 'viem';
import { logger } from '../../utils/logger';
import { getTokenByIndex } from '../tokens/hooks';
import { TransferFormValues, TransferStatus } from './types';

const midlEvmRpc = process.env.NEXT_PUBLIC_MIDL_EVM_RPC || 'https://rpc.staging.midl.xyz';
const midlNetwork = process.env.NEXT_PUBLIC_MIDL_NETWORK || 'regtest';
const midlChain = midlNetwork === 'mainnet' ? midlMainnet : midlRegtest;

export const midlPublicClient: PublicClient = createPublicClient({
  chain: midlChain,
  transport: http(midlEvmRpc),
}) as PublicClient;

export function getMidlSenderAddress(config: Config): `0x${string}` {
  const account = getDefaultAccount(config);
  return getEVMAddress(account, config.getState().network);
}

const ZERO_BYTES32 = `0x${'0'.repeat(64)}` as `0x${string}`;

async function getRuneId(tokenAddress: `0x${string}`): Promise<string | null> {
  const result = (await midlPublicClient.readContract({
    abi: executorAbi,
    address: SystemContracts.Executor as `0x${string}`,
    functionName: 'getRuneIdByAssetAddress',
    args: [tokenAddress],
  })) as [`0x${string}`, number];
  const bytes32RuneId = result[0];
  if (!bytes32RuneId || bytes32RuneId === ZERO_BYTES32) return null;
  return bytes32toRuneId(bytes32RuneId);
}

async function getErc20Balance(
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
): Promise<bigint> {
  return (await midlPublicClient.readContract({
    abi: erc20Abi,
    address: tokenAddress,
    functionName: 'balanceOf',
    args: [owner],
  })) as bigint;
}

export async function executeMidlTransfer({
  config,
  warpCore,
  values,
  updateStatus,
}: {
  config: Config;
  warpCore: WarpCore;
  values: TransferFormValues;
  updateStatus: (status: TransferStatus) => void;
}): Promise<{ originTxHash?: string }> {
  const { destination, tokenIndex, amount, recipient } = values;

  const originToken = getTokenByIndex(warpCore, tokenIndex);
  if (!originToken) throw new Error('No token found for transfer');

  if (!originToken.getConnectionForChain(destination))
    throw new Error('No token route found between chains');

  const sender = getMidlSenderAddress(config);
  const isNft = originToken.isNft();
  const weiAmountOrId = isNft ? amount : toWei(amount, originToken.decimals);
  const originTokenAmount = originToken.amount(weiAmountOrId);

  // 1. Get Hyperlane warp route EVM transactions
  updateStatus(TransferStatus.CreatingTxs);
  const typedTxs = await warpCore.getTransferRemoteTxs({
    originTokenAmount,
    destination,
    sender,
    recipient,
  });

  // 2. Detect rune and calculate deposit from BTC
  updateStatus(TransferStatus.BuildingIntentions);

  const collateralAddress = originToken.collateralAddressOrDenom as `0x${string}` | undefined;
  let runeId: string | null = null;
  let depositFromBtc = 0n;

  if (collateralAddress) {
    const [detectedRuneId, evmBalance] = await Promise.all([
      getRuneId(collateralAddress),
      getErc20Balance(collateralAddress, sender),
    ]);
    runeId = detectedRuneId;
    if (runeId) {
      const transferAmount = BigInt(weiAmountOrId);
      depositFromBtc = transferAmount > evmBalance ? transferAmount - evmBalance : 0n;
      logger.debug('Rune detected:', runeId, 'evmBalance:', evmBalance, 'depositFromBtc:', depositFromBtc);
    }
  }

  // 3. Build intentions from EVM transactions
  const intentions: TransactionIntention[] = [];
  let totalTxValue = 0n;

  for (let i = 0; i < typedTxs.length; i++) {
    const { to, data, value } = typedTxs[i].transaction as {
      to: `0x${string}`;
      data: `0x${string}`;
      value?: bigint;
    };

    if (value != null) totalTxValue += value;
    const isAnchor = i === typedTxs.length - 1;

    const intention = await addTxIntention(config, {
      evmTransaction: { to, data, value },
      ...(isAnchor && {
        deposit: {
          satoshis: totalTxValue > 0n ? weiToSatoshis(totalTxValue) : 0,
          runes:
            runeId && depositFromBtc > 0n
              ? [{ id: runeId, amount: depositFromBtc, address: collateralAddress }]
              : [],
        },
      }),
    });
    intentions.push(intention);
  }

  // 4. Add completeTx intention (finalizes the executor flow)
  const completeTx = await addCompleteTxIntention(config);
  intentions.push(completeTx);

  // 5. Finalize BTC transaction (builds the PSBT)
  updateStatus(TransferStatus.FinalizingBtcTx);
  const btcTx = await finalizeBTCTransaction(config, intentions, midlPublicClient as any);

  // 6. Sign each intention with Bitcoin wallet
  updateStatus(TransferStatus.SigningBtcTx);
  const signedTransactions: `0x07${string}`[] = [];
  const evmTransactionHashes: `0x${string}`[] = [];

  for (const intention of intentions) {
    const signedTx = await signIntention(config, midlPublicClient as any, intention, intentions, {
      txId: btcTx.tx.id,
      protocol: SignMessageProtocol.Bip322,
    });

    const txHash = keccak256(signedTx);
    evmTransactionHashes.push(txHash);
    signedTransactions.push(signedTx);
  }

  // 7. Broadcast BTC + EVM transactions
  updateStatus(TransferStatus.BroadcastingTx);
  await (midlPublicClient as any).sendBTCTransactions({
    btcTransaction: btcTx.tx.hex,
    serializedTransactions: signedTransactions,
  });

  logger.debug('MIDL transactions broadcast. BTC txId:', btcTx.tx.id);
  logger.debug('EVM tx hashes:', evmTransactionHashes);

  // 8. Wait for BTC confirmation (1 block)
  updateStatus(TransferStatus.ConfirmingTransfer);
  await waitForTransaction(config, btcTx.tx.id, 1, {
    maxAttempts: 60,
    intervalMs: 10_000,
  });

  // 9. Wait for EVM receipts
  await Promise.all(
    evmTransactionHashes.map((hash) =>
      midlPublicClient.waitForTransactionReceipt({ hash, confirmations: 1 }),
    ),
  );

  // The transferRemote tx is the last warp route tx (before completeTx)
  const originTxHash = typedTxs.length > 0
    ? evmTransactionHashes[typedTxs.length - 1]
    : undefined;
  return { originTxHash };
}
