import { useEffect, useMemo, useState } from "react";
import { useAtom, useSetAtom } from "jotai";
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
import { formattedBalance, getAmountWithSlippage } from "../utils/format";
import { getEthBalance, getTokenBalance } from "../store/alchemyStore";
import { showToastAtom } from "../store/imagesStore.ts";
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
  const [ethBalance, setEthBalance] = useState<bigint>(0n);
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);
  const { wallets } = useWallets();
  const [walletClient, setWalletClient] = useAtom(walletClientAtom);
  const { authenticated, ready, login } = usePrivy();
  const [txType, setTxType] = useState<"EXACT_IN" | "EXACT_OUT" | "SELL">(
    "EXACT_IN"
  );
  const [, fetchEthBalance] = useAtom(getEthBalance);
  const [, fetchTokenBalance] = useAtom(getTokenBalance);
  const [txLoading, setTxLoading] = useState(false);
  const showToast = useSetAtom(showToastAtom);

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
        fetchRate(value, isInput);
        setTxType("SELL");
      }
    }, 1000);
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
        "EXACT_IN"
      );
      console.debug("[FLAUNCH]:", "SELL", data, ethOutMin);
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

  // 获取余额
  const fetchBalances = async () => {
    if (!walletClient?.account?.address) return;

    const address = walletClient.account.address;

    try {
      if (direction === "buy") {
        const ethBalance = await fetchEthBalance({ addressOrName: address });
        setEthBalance(parseEther(ethBalance));
        const tokenBalance = await fetchTokenBalance({
          addressOrName: address,
          contractAddress: token.address,
        });
        setTokenBalance(parseEther(tokenBalance));
      } else {
        const tokenBalance = await fetchTokenBalance({
          addressOrName: address,
          contractAddress: token.address,
        });
        setTokenBalance(parseEther(tokenBalance));
        const ethBalance = await fetchEthBalance({ addressOrName: address });
        setEthBalance(parseEther(ethBalance));
      }
    } catch (error) {
      console.error("Failed to fetch balances:", error);
    }
  };

  // 初始化获取余额
  useEffect(() => {
    if (walletClient?.account?.address) {
      fetchBalances();
    }
  }, [walletClient?.account?.address, direction]);

  const clearInputState = () => {
    setInputAmount("");
    setOutputAmount("");
  };

  // 处理Max按钮点击
  const handleMaxClick = () => {
    if (direction === "buy") {
      if (!ethBalance) return;
      const maxValue = formatEther(ethBalance - (ethBalance / 100n) * 5n); // 保留5%作为gas费
      setInputAmount(maxValue);
      handleAmountChange("from", maxValue, true);
    }
    if (direction === "sell") {
      if (!tokenBalance) return;
      const maxValue = formatEther(tokenBalance);
      setInputAmount(maxValue);
      console.debug("[FLAUNCH] MAX", tokenBalance.toString(), maxValue);
      handleAmountChange("from", maxValue, false);
    }
  };

  const handleSwap = async () => {
    if (loading || txLoading) return;
    // 提取公共变量
    const isBuy = direction === "buy";
    const requiredAmount = parseEther(inputAmount || "0");
    const currentBalance = isBuy ? ethBalance : tokenBalance;
    const assetName = isBuy ? "ETH" : token.symbol;

    if (currentBalance < requiredAmount) {
      showToast({
        message: `${assetName} balance is insufficient.`,
        severity: "error",
      });
      return;
    }

    if (requiredAmount == 0n) {
      showToast({
        message: "Invalid amount.",
        severity: "error",
      });
      return;
    }

    try {
      if (authenticated && ready) {
        setTxLoading(true);
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
            showToast({
              message: `Transaction successful: ${receipt?.transactionHash}`,
              severity: "success",
            });
            setTxLoading(false);
            await fetchBalances(); // 交易成功后刷新余额
            clearInputState();
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
            showToast({
              message: `Transaction successful: ${receipt?.transactionHash}`,
              severity: "success",
            });
            setTxLoading(false);
            await fetchBalances(); // 交易成功后刷新余额
            clearInputState();
          }
        }
        if (direction === "sell") {
          if (flaunchWrite && token.address) {
            const { allowance } =
              await flaunchWrite.getPermit2AllowanceAndNonce(
                token.address as `0x${string}`
              );
            if (allowance < parseEther(inputAmount)) {
              const { typedData, permitSingle } =
                await flaunchWrite.getPermit2TypedData(
                  token.address as `0x${string}`
                );
              const signature = await walletClient?.signTypedData({
                ...typedData,
                account: walletClient.account?.address as `0x${string}`,
              });
              const hash = await flaunchWrite.sellCoin({
                coinAddress: token.address as `0x${string}`,
                amountIn: parseEther(inputAmount),
                slippagePercent: parseFloat(slippage),
                permitSingle,
                signature,
              });
              if (hash) {
                const receipt = await flaunchWrite?.drift.waitForTransaction({
                  hash,
                });
                console.log("Transaction receipt:", receipt);
                showToast({
                  message: `Transaction successful: ${receipt?.transactionHash}`,
                  severity: "success",
                });
                setTxLoading(false);
                await fetchBalances(); // 交易成功后刷新余额
                clearInputState();
              }
            }
          } else {
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
              showToast({
                message: `Transaction successful: ${receipt?.transactionHash}`,
                severity: "success",
              });
              setTxLoading(false);
              await fetchBalances(); // 交易成功后刷新余额
              clearInputState();
            }
          }
        }
      }
      login();
    } catch (error) {
      console.error("Failed to swap:", error);
      setLoading(false);
      setTxLoading(false);
    }
  };

  // 公共余额检查逻辑
  const isBuy = direction === "buy";
  const requiredAmount = parseEther(inputAmount || "0");
  const currentBalance = isBuy ? ethBalance : tokenBalance;
  const assetName = isBuy ? "ETH" : token.symbol;
  const isInsufficient = currentBalance < requiredAmount;

  const btnLabel = () => {
    if (authenticated && ready) {
      if (loading) return "Calculating...";
      if (txLoading) return "Swapping...";
      if (isInsufficient) return `Insufficient ${assetName}`;
      if (requiredAmount == 0n) return "Invalid amount";
      return "Swap";
    }
    return "Login";
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
                onChange={(e) => {
                  handleNumberValueChange(e.target.value, setSlippage);
                }}
                className="bg-gray-800 p-2 rounded flex-1 outline-none no-spinner"
                step={1}
                min={1}
                max={100}
              />
              <button
                onClick={() => {
                  clearInputState();
                  setShowSettings(false);
                }}
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
                className="w-full bg-transparent text-xl pr-[100px] outline-none no-spinner"
                placeholder="0.0"
                disabled={loading || txLoading}
              />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[12px]">
                <button
                  onClick={() => handleMaxClick()}
                  className="bg-gray-700 px-1 rounded hover:bg-gray-600"
                >
                  Max
                </button>
                <span>
                  {direction === "buy"
                    ? formattedBalance(ethBalance)
                    : formattedBalance(tokenBalance)}
                </span>
              </div>
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
              disabled={direction === "sell" || loading || txLoading}
            />
          </div>
        </div>
      </div>

      {/* Swap Button */}
      <button
        disabled={
          loading || txLoading || isInsufficient || requiredAmount == 0n
        }
        className={`w-full py-2 mt-6 rounded-lg hover:brightness-125 ${
          loading || txLoading || isInsufficient || requiredAmount == 0n
            ? "grayscale"
            : ""
        } bg-[#6366F1] text-white`}
        onClick={handleSwap}
      >
        {btnLabel()}
      </button>
    </div>
  );
};

export default SwapWidgetCustom;
