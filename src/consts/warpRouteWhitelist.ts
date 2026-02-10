// A list of warp route config IDs to be included in the app
// Warp Route IDs use format `SYMBOL/chainname1-chainname2...` where chains are ordered alphabetically
// If left null, all warp routes in the configured registry will be included
// If set to a list (including an empty list), only the specified routes will be included

const onlyMidl = !!process?.env?.NEXT_PUBLIC_ONLY_MIDL;

// When MIDL-only mode, restrict to USDC routes involving ethereum.
// Add MIDL warp route ID here once deployed (e.g. 'USDC/ethereum-midl').
const midlWarpRouteWhitelist: Array<string> = [
  'USDC/ethereum-form',
];

export const warpRouteWhitelist: Array<string> | null = onlyMidl ? midlWarpRouteWhitelist : null;
