import { useEffect } from "react";
import { useAtom } from "jotai";
import {
  darkTheme,
  SwapWidget,
  Theme,
  SupportedChainId,
  TokenInfo,
} from "@uniswap/widgets";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { uniswapJsonRpcUrlMap } from "../store/alchemyStore";
import { providerAtom } from "../store/providerStore";
import { ethers } from "ethers";
import { base } from "viem/chains";
import '@uniswap/widgets/fonts.css'

const theme: Theme = {
  ...darkTheme,
  container: "#0E111B",
  borderRadius: {
    large: 0.25,
    medium: 0.25,
    small: 0.25,
    xsmall: 0.25,
  },
};

const UniswapWidget = ({ token }: { token: TokenInfo }) => {
  const { wallets } = useWallets();
  const [provider, setProvider] = useAtom(providerAtom);
  const { login } = usePrivy();

  useEffect(() => {
    const initProvider = async () => {
      const wallet = wallets.find(
        (wallet) => wallet.walletClientType === "privy"
      );
      if (wallet) {
        await wallet.switchChain(base.id);
        const privyProvider = await wallet.getEthereumProvider();
        const walletProvider = new ethers.providers.Web3Provider(privyProvider);
        setProvider(walletProvider);
      }
    };

    initProvider();
  }, [wallets, setProvider]);

  return (
    <SwapWidget
      width="100%"
      provider={provider}
      theme={theme}
      onConnectWalletClick={login}
      jsonRpcUrlMap={uniswapJsonRpcUrlMap}
      tokenList={[token] as TokenInfo[]}
      defaultOutputTokenAddress={{ [SupportedChainId.BASE]: token.address }}
      defaultInputTokenAddress={"NATIVE"}
    />
  );
};

export default UniswapWidget;
