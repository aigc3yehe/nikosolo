import { formatEther, parseEther } from "viem";

export const getAmountWithSlippage = (
  amount: bigint | undefined,
  slippage: string,
  swapType: "EXACT_IN" | "EXACT_OUT"
) => {
  if (amount == null) {
    return 0n;
  }

  const absAmount = amount < 0n ? -amount : amount;
  const slippageMultiplier =
    swapType === "EXACT_IN"
      ? BigInt(1e18) - parseEther(slippage)
      : BigInt(1e18) + parseEther(slippage);
  return (absAmount * slippageMultiplier) / BigInt(1e18);
};

export const formattedBalance = (balance: bigint) => {
  if(!balance) return "0";
  const val = Number(formatEther(balance));
  const str = val.toString();
  if (str.includes(".")) {
    const decimalPart = str.split(".")[1];
    if (decimalPart.length > 5) {
      return val.toFixed(5);
    } else {
      return str;
    }
  } else {
    return str;
  }
};
