import { ChainMap, ChainMetadata } from '@hyperlane-xyz/sdk';
import { ChainSearchMenu, ChainSearchMenuProps, Modal } from '@hyperlane-xyz/widgets';
import { useMemo } from 'react';
import { config } from '../../consts/config';
import { useStore } from '../store';

const onlyMidl = !!process?.env?.NEXT_PUBLIC_ONLY_MIDL;
const MIDL_ALLOWED_CHAINS = ['ethereum', 'midl'];

export function ChainSelectListModal({
  isOpen,
  close,
  onSelect,
  customListItemField,
  showChainDetails,
}: {
  isOpen: boolean;
  close: () => void;
  onSelect: (chain: ChainName) => void;
  customListItemField?: ChainSearchMenuProps['customListItemField'];
  showChainDetails?: ChainSearchMenuProps['showChainDetails'];
}) {
  const { chainMetadata, chainMetadataOverrides, setChainMetadataOverrides } = useStore((s) => ({
    chainMetadata: s.chainMetadata,
    chainMetadataOverrides: s.chainMetadataOverrides,
    setChainMetadataOverrides: s.setChainMetadataOverrides,
  }));

  const filteredChainMetadata = useMemo(() => {
    if (!onlyMidl) return chainMetadata;
    return Object.fromEntries(
      Object.entries(chainMetadata).filter(([name]) => MIDL_ALLOWED_CHAINS.includes(name)),
    ) as ChainMap<ChainMetadata>;
  }, [chainMetadata]);

  const onSelectChain = (chain: ChainMetadata) => {
    onSelect(chain.name);
    close();
  };

  return (
    <Modal isOpen={isOpen} close={close} panelClassname="bg-[#f8f8ff] p-4 sm:p-5 max-w-lg min-h-[40vh] rounded-3xl">
      <ChainSearchMenu
        chainMetadata={filteredChainMetadata}
        onClickChain={onSelectChain}
        overrideChainMetadata={chainMetadataOverrides}
        onChangeOverrideMetadata={setChainMetadataOverrides}
        customListItemField={customListItemField}
        defaultSortField="custom"
        showChainDetails={showChainDetails}
        shouldDisableChains={config.shouldDisableChains}
        showAddChainButton={config.showAddChainButton}
      />
    </Modal>
  );
}
