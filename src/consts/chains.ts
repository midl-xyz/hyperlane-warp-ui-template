import {
  eclipsemainnet,
  eclipsemainnetAddresses,
  solanamainnet,
  solanamainnetAddresses,
  solaxy,
  solaxyAddresses,
  sonicsvm,
  sonicsvmAddresses,
  soon,
  soonAddresses,
} from '@hyperlane-xyz/registry';
import { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';
import { ProtocolType } from '@hyperlane-xyz/utils';

const onlyMidl = !!process?.env?.NEXT_PUBLIC_ONLY_MIDL;

const midlEvmRpc = process?.env?.NEXT_PUBLIC_MIDL_EVM_RPC || 'https://rpc.staging.midl.xyz';
const isMidlMainnet = process?.env?.NEXT_PUBLIC_MIDL_NETWORK === 'mainnet';

const midlChains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  midl: {
    protocol: ProtocolType.Ethereum,
    chainId: isMidlMainnet ? 1500 : 15001,
    domainId: isMidlMainnet ? 1500 : 15001,
    name: 'midl',
    displayName: 'Bitcoin',
    nativeToken: { name: 'Bitcoin', symbol: 'BTC', decimals: 18 },
    rpcUrls: [{ http: midlEvmRpc }],
    blocks: {
      confirmations: 1,
      reorgPeriod: 0,
      estimateBlockTime: 2,
    },
    logoURI: '/chains/midl/logo.svg',
  },
};

const svmChains: ChainMap<ChainMetadata & { mailbox?: Address }> = {
  solanamainnet: {
    ...solanamainnet,
    // SVM chains require mailbox addresses for the token adapters
    mailbox: solanamainnetAddresses.mailbox,
  },
  eclipsemainnet: {
    ...eclipsemainnet,
    mailbox: eclipsemainnetAddresses.mailbox,
  },
  soon: {
    ...soon,
    mailbox: soonAddresses.mailbox,
  },
  sonicsvm: {
    ...sonicsvm,
    mailbox: sonicsvmAddresses.mailbox,
  },
  solaxy: {
    ...solaxy,
    mailbox: solaxyAddresses.mailbox,
  },
};

// A map of chain names to ChainMetadata
// Chains can be defined here, in chains.json, or in chains.yaml
// Chains already in the SDK need not be included here unless you want to override some fields
// Schema here: https://github.com/hyperlane-xyz/hyperlane-monorepo/blob/main/typescript/sdk/src/metadata/chainMetadataTypes.ts
export const chains: ChainMap<ChainMetadata & { mailbox?: Address }> = onlyMidl
  ? midlChains
  : svmChains;

// rent account payment for (mostly for) SVM chains added on top of IGP,
// not exact but should be pretty close to actual payment
export const chainsRentEstimate: ChainMap<bigint> = onlyMidl
  ? {}
  : {
      eclipsemainnet: BigInt(Math.round(0.00004019 * 10 ** 9)),
      solanamainnet: BigInt(Math.round(0.00411336 * 10 ** 9)),
      sonicsvm: BigInt(Math.round(0.00411336 * 10 ** 9)),
      soon: BigInt(Math.round(0.00000355 * 10 ** 9)),
    };
