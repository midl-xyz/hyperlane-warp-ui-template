import { MaestroSymphonyProvider, MempoolSpaceProvider, mainnet, regtest, signet, testnet } from '@midl/core';
import { WagmiAutoConnect } from '@midl/executor-react';
import { MidlProvider } from '@midl/react';
import { SatoshiKitProvider, createMidlConfig } from '@midl/satoshi-kit';
import '@midl/satoshi-kit/styles.css';
import { PropsWithChildren, useMemo } from 'react';

const onlyMidl = !!process?.env?.NEXT_PUBLIC_ONLY_MIDL;

function initBitcoinConfig() {
  const bitcoinNetwork = process.env.NEXT_PUBLIC_BITCOIN_NETWORK || 'regtest';
  const mempoolRpcUrl = process.env.NEXT_PUBLIC_MEMPOOL_RPC || undefined;
  const runesUrl = process.env.NEXT_PUBLIC_RUNES_URL || undefined;

  let network;
  switch (bitcoinNetwork) {
    case 'mainnet':
      network = mainnet;
      break;
    case 'testnet':
      network = testnet;
      break;
    case 'signet':
      network = signet;
      break;
    case 'regtest':
    default:
      network = regtest;
      break;
  }

  const providerConfig = mempoolRpcUrl ? { [network.id]: mempoolRpcUrl } : undefined;
  const provider = providerConfig
    ? new MempoolSpaceProvider(providerConfig as any)
    : new MempoolSpaceProvider();

  const runesProvider = runesUrl
    ? new MaestroSymphonyProvider({ [network.id]: runesUrl } as any)
    : undefined;

  const config = createMidlConfig({
    networks: [network],
    persist: true,
    provider,
    ...(runesProvider && { runesProvider }),
  });

  return { config };
}

export function BitcoinWalletContext({ children }: PropsWithChildren<unknown>) {
  const { config } = useMemo(() => initBitcoinConfig(), []);

  return (
    <MidlProvider config={config}>
      {onlyMidl && <WagmiAutoConnect />}
      <SatoshiKitProvider>{children}</SatoshiKitProvider>
    </MidlProvider>
  );
}
