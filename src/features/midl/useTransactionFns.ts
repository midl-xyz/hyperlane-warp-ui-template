import { MultiProtocolProvider } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';
import { useTransactionFns as useHyperlaneTransactionFns } from '@hyperlane-xyz/widgets';
import { useMemo } from 'react';

import { useEthereumTransactionFns } from './useEthereumTransactionFns';

export function useTransactionFns(multiProvider: MultiProtocolProvider) {
  const baseFns = useHyperlaneTransactionFns(multiProvider);
  const ethereumFns = useEthereumTransactionFns(multiProvider);

  return useMemo(
    () => ({
      ...baseFns,
      [ProtocolType.Ethereum]: ethereumFns,
    }),
    [baseFns, ethereumFns],
  );
}
