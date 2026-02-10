export interface TransferFormValues {
  origin: ChainName;
  destination: ChainName;
  tokenIndex: number | undefined;
  amount: string;
  recipient: Address;
}

export enum TransferStatus {
  Preparing = 'preparing',
  CreatingTxs = 'creating-txs',
  SigningApprove = 'signing-approve',
  SigningRevoke = 'signing-revoke',
  ConfirmingRevoke = 'confirming-revoke',
  ConfirmingApprove = 'confirming-approve',
  SigningTransfer = 'signing-transfer',
  ConfirmingTransfer = 'confirming-transfer',
  ConfirmedTransfer = 'confirmed-transfer',
  Delivered = 'delivered',
  Failed = 'failed',
  // MIDL executor statuses
  BuildingIntentions = 'building-intentions',
  FinalizingBtcTx = 'finalizing-btc-tx',
  SigningBtcTx = 'signing-btc-tx',
  BroadcastingTx = 'broadcasting-tx',
}

export const SentTransferStatuses = [TransferStatus.ConfirmedTransfer, TransferStatus.Delivered];

// Statuses considered not pending
export const FinalTransferStatuses = [...SentTransferStatuses, TransferStatus.Failed];

export interface TransferContext {
  status: TransferStatus;
  origin: ChainName;
  destination: ChainName;
  originTokenAddressOrDenom?: string;
  destTokenAddressOrDenom?: string;
  amount: string;
  sender: Address;
  recipient: Address;
  originTxHash?: string;
  msgId?: string;
  timestamp: number;
}
