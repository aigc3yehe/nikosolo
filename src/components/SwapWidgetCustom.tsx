import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { walletClientAtom } from "../store/providerStore";
import { TokenInfo } from "@uniswap/widgets";
import EthIcon from "../assets/eth.svg";
import { Settings, SwapVert, Close } from "@mui/icons-material";
import TokenIcon from "./TokenIcon";
import DefaultIcon from "../assets/token_default.svg";
import { viemAdapter } from "@delvtech/drift-viem";
import { base } from "viem/chains";
import { ReadWriteFlaunchSDK } from "@flaunch/sdk";
import { createDrift } from "@delvtech/drift";
import { publicClient } from "../providers/wagmiConfig";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, formatEther, Hex, parseEther } from "viem";
import { getAmountWithSlippage } from "../utils/format";

interface Props {
  token: TokenInfo;
}

const SwapWidgetCustom = ({ token }: Props) => {
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [showSettings, setShowSettings] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout>();
  const [inputAmount, setInputAmount] = useState("");
  const [outputAmount, setOutputAmount] = useState("");
  const [slippage, setSlippage] = useState("5");
  const [loading, setLoading] = useState(false);
  const { wallets } = useWallets();
  const [walletClient, setWalletClient] = useAtom(walletClientAtom);
  const { authenticated, ready, login } = usePrivy();
  const [txType, setTxType] = useState<"EXACT_IN" | "EXACT_OUT" | "SELL">(
    "EXACT_IN"
  );

  const flaunchWrite = useMemo(() => {
    if (walletClient) {
      const drift = createDrift({
        adapter: viemAdapter({
          publicClient: publicClient as never,
          walletClient,
        }),
      });
      return new ReadWriteFlaunchSDK(base.id, drift as never);
    }
  }, [walletClient]);

  useEffect(() => {
    const initWalletClient = async () => {
      const wallet = wallets.find(
        (wallet) => wallet.walletClientType === "privy"
      );
      if (wallet) {
        await wallet.switchChain(base.id);
        const privyProvider = await wallet.getEthereumProvider();
        const walletClient = createWalletClient({
          account: wallet.address as Hex,
          chain: base,
          transport: custom(privyProvider),
        });
        setWalletClient(walletClient);
      }
    };

    initWalletClient();
  }, [wallets, setWalletClient]);

  const handleSwitchDirection = () => {
    setDirection((prev) => (prev === "buy" ? "sell" : "buy"));
    setInputAmount("");
    setOutputAmount("");
  };

  // 防抖处理函数
  const handleAmountChange = (
    flag: "from" | "to",
    value: string,
    isInput: boolean
  ) => {
    if (debounceTimer) clearTimeout(debounceTimer);
    const newTimer = setTimeout(() => {
      if (direction === "buy" || isInput) {
        fetchRate(value, isInput);
        if (flag == "from") {
          setTxType("EXACT_IN");
        } else {
          setTxType("EXACT_OUT");
        }
      }
      if (direction === "sell") {
        setTxType("SELL");
      }
    }, 1200);
    setDebounceTimer(newTimer);
  };

  const handleNumberValueChange = (
    value: string,
    setFunc: (value: string) => void
  ) => {
    const val = parseInt(value, 10);
    if (val < 0) {
      setFunc("0");
    } else {
      setFunc(value);
    }
  };

  const estimatedInOrOutputValue = async (
    type: "EXACT_IN" | "EXACT_OUT" | "SELL",
    amount: string
  ) => {
    if (type === "EXACT_IN") {
      const data = await flaunchWrite?.readQuoter?.getBuyQuoteExactInput(
        token.address as `0x${string}`,
        parseEther(amount)
      );
      const amountOutMin = getAmountWithSlippage(
        data,
        (parseFloat(slippage) / 100).toFixed(18).toString(),
        "EXACT_IN"
      );
      console.debug("[FLAUNCH]:", type, data, amountOutMin);
      setOutputAmount(formatEther(amountOutMin ?? 0n));
    }
    if (type === "EXACT_OUT") {
      const data = await flaunchWrite?.readQuoter?.getBuyQuoteExactOutput(
        token.address as `0x${string}`,
        parseEther(amount)
      );
      const amountOutMin = getAmountWithSlippage(
        data,
        (parseFloat(slippage) / 100).toFixed(18).toString(),
        "EXACT_OUT"
      );
      console.debug("[FLAUNCH]:", type, data, amountOutMin);
      setInputAmount(formatEther(amountOutMin ?? 0n));
    }
    if (type === "SELL") {
      const data = await flaunchWrite?.readQuoter?.getSellQuoteExactInput(
        token.address as `0x${string}`,
        parseEther(amount)
      );
      const ethOutMin = getAmountWithSlippage(
        data,
        (parseFloat(slippage) / 100).toFixed(18).toString(),
        "EXACT_OUT"
      );
      console.debug("[FLAUNCH]:", "EXACT_IN", data, ethOutMin);
      setOutputAmount(formatEther(ethOutMin ?? 0n));
    }
  };

  const fetchRate = async (amount: string, isInput: boolean) => {
    if (!amount || !amount.length) return;
    setLoading(true);
    try {
      const flag =
        direction === "buy" ? (isInput ? "EXACT_IN" : "EXACT_OUT") : "SELL";
      await estimatedInOrOutputValue(flag, amount);
    } catch (error) {
      console.error("Failed to fetch rate:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (loading) return;
    try {
      if (authenticated && ready) {
        if (direction === "buy" && txType == "EXACT_IN") {
          const hash = await flaunchWrite?.buyCoin({
            coinAddress: token.address as `0x${string}`,
            slippagePercent: parseFloat(slippage),
            swapType: txType,
            amountIn: parseEther(inputAmount),
          });
          if (hash) {
            const receipt = await flaunchWrite?.drift.waitForTransaction({
              hash,
            });
            console.log("Transaction receipt:", receipt);
            alert(`Transaction successful: ${receipt?.transactionHash}`);
          }
        }
        if (direction === "buy" && txType == "EXACT_OUT") {
          const hash = await flaunchWrite?.buyCoin({
            coinAddress: token.address as `0x${string}`,
            slippagePercent: parseFloat(slippage),
            swapType: txType,
            amountOut: parseEther(inputAmount),
          });
          if (hash) {
            const receipt = await flaunchWrite?.drift.waitForTransaction({
              hash,
            });
            console.log("Transaction receipt:", receipt);
            alert(`Transaction successful: ${receipt?.transactionHash}`);
          }
        }
        if (direction === "sell") {
          const hash = await flaunchWrite?.sellCoin({
            coinAddress: token.address as `0x${string}`,
            amountIn: parseEther(inputAmount),
            slippagePercent: parseFloat(slippage),
          });
          if (hash) {
            const receipt = await flaunchWrite?.drift.waitForTransaction({
              hash,
            });
            console.log("Transaction receipt:", receipt);
            alert(`Transaction successful: ${receipt?.transactionHash}`);
          }
        }
      }
      login();
    } catch (error) {
      console.error("Failed to swap:", error);
    }
  };

  return (
    <div className="bg-[#0E111B] p-4 rounded-lg">
      {/* 标题 */}
      <div className="flex justify-between items-center mb-4 relative">
        <h2 className="text-xl font-semibold">Swap Tokens</h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-gray-800 rounded"
        >
          <Settings sx={{ fontSize: 20, color: "white" }} />
        </button>

        {/* 设置弹窗 */}
        {showSettings && (
          <div className="absolute top-12 right-0 bg-gray-900 p-4 rounded-lg z-10 w-64 border border-[#3741514D]">
            <div className="flex justify-between items-center mb-4">
              <span>Slippage Tolerance</span>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white"
              >
                <Close sx={{ fontSize: 20 }} />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                value={slippage}
                onChange={(e) =>
                  handleNumberValueChange(e.target.value, setSlippage)
                }
                className="bg-gray-800 p-2 rounded flex-1 outline-none no-spinner"
                step={1}
                min={1}
                max={100}
              />
              <button
                onClick={() => setShowSettings(false)}
                className="bg-[#6366F1] px-4 py-2 rounded-lg hover:brightness-125"
              >
                OK
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Input Section */}
      {/* 输入Token */}
      <div className="flex flex-col items-center relative w-full">
        <div className="space-y-4 w-full">
          <div className="bg-gray-900 p-3 rounded">
            <div className="flex justify-between items-center mb-2">
              <span>{direction === "buy" ? "From" : "Sell"}</span>
              <div className="flex items-center gap-2">
                <TokenIcon
                  logoURI={
                    direction === "buy" ? EthIcon : token.logoURI || DefaultIcon
                  }
                />
                <span>{direction === "buy" ? "ETH" : token.symbol}</span>
              </div>
            </div>
            <div className="relative">
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  handleNumberValueChange(e.target.value, setInputAmount);
                  handleAmountChange("from", value, true);
                }}
                className="w-full bg-transparent text-xl pr-12 outline-none no-spinner"
                placeholder="0.0"
                disabled={loading}
              />
            </div>
          </div>

          {/* 买入卖出方向切换 */}
          <button
            onClick={handleSwitchDirection}
            className="absolute top-[41%] -translate-x-1/2 -translate-y-1/2 bg-gray-800 w-9 h-9 rounded-xl hover:bg-gray-700 border border-[#3741514D]"
          >
            <SwapVert sx={{ fontSize: 20, color: "white" }} />
          </button>

          {/* 输出Token */}
          <div className="bg-gray-900 p-3 rounded w-full">
            <div className="flex justify-between items-center mb-2">
              <span>{direction === "buy" ? "To" : "Receive"}</span>
              <div className="flex items-center gap-2">
                <TokenIcon
                  logoURI={
                    direction === "buy" ? token.logoURI || DefaultIcon : EthIcon
                  }
                />
                <span>{direction === "buy" ? token.symbol : "ETH"}</span>
              </div>
            </div>
            <input
              type="number"
              value={outputAmount}
              onChange={(e) => {
                if (direction === "sell") return;
                const value = e.target.value;
                handleNumberValueChange(e.target.value, setOutputAmount);
                handleAmountChange("to", value, false);
              }}
              className="w-full bg-transparent text-xl outline-none no-spinner"
              placeholder="0.0"
              disabled={direction === "sell" || loading}
            />
          </div>
        </div>
      </div>

      {/* Swap Button */}
      <button
        disabled={loading}
        className={`w-full py-2 mt-6 rounded-lg hover:brightness-125 ${
          loading ? "grayscale" : ""
        } bg-[#6366F1] text-white`}
        onClick={handleSwap}
      >
        {authenticated && ready
          ? loading
            ? "Calculating..."
            : "Swap"
          : "Login"}
      </button>
    </div>
  );
};

export default SwapWidgetCustom;
