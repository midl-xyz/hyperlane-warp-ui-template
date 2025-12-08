import { TokenStandard, WarpCoreConfig } from '@hyperlane-xyz/sdk';

// A list of Warp Route token configs
// These configs will be merged with the warp routes in the configured registry
// The input here is typically the output of the Hyperlane CLI warp deploy command
export const warpRouteConfigs: WarpCoreConfig = {
  tokens: [
    {
      addressOrDenom: '0x1de294fb90e715915a124fc2661d409619933472',
      chainName: 'sepolia',
      collateralAddressOrDenom: '0xe304977108b53cf121da98b7c74d512ba6b99962',
      connections: [
        {
          token: 'ethereum|arbitrumsepolia|0xa1715961bee24036f8f9dc88ad0df3e953637bc7',
        },
      ],
      decimals: 18,
      name: 'MyToken',
      standard: TokenStandard.EvmHypCollateral,
      symbol: 'MTK',
    },
    {
      addressOrDenom: '0xa1715961bee24036f8f9dc88ad0df3e953637bc7',
      chainName: 'arbitrumsepolia',
      connections: [
        {
          token: 'ethereum|sepolia|0x1de294fb90e715915a124fc2661d409619933472',
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
