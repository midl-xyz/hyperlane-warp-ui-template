import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    {
      addressOrDenom: '0x3843f27f7c5d85536396fcca7c18d65fedf3299b',
      chainName: 'sepolia',
      collateralAddressOrDenom: '0xe304977108b53cf121da98b7c74d512ba6b99962',
      connections: [
        {
          token: 'ethereum|arbitrumsepolia|0x3843f27f7c5d85536396fcca7c18d65fedf3299b',
        },
      ],
      decimals: 18,
      name: 'MyToken',
      standard: TokenStandard.EvmHypCollateral,
      symbol: 'MTK',
    },
    {
      addressOrDenom: '0x3843f27f7c5d85536396fcca7c18d65fedf3299b',
      chainName: 'arbitrumsepolia',
      connections: [
        {
          token: 'ethereum|sepolia|0x3843f27f7c5d85536396fcca7c18d65fedf3299b',
        },
      ],
      decimals: 18,
      name: 'MyToken',
      standard: TokenStandard.EvmHypSynthetic,
      symbol: 'MTK',
    },
  ],
  options: {},
};
