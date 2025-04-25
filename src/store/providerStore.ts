import { atom } from "jotai";
import { providers } from "ethers";
import { WalletClient } from "viem";

export const providerAtom = atom<providers.Web3Provider | null>(null); // provider 初始为 null

export const walletClientAtom = atom<WalletClient | null>(null);
