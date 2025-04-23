import { atom } from "jotai";
import { providers } from "ethers";

export const providerAtom = atom<providers.Web3Provider | null>(null); // provider 初始为 null
