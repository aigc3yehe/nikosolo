import { atom } from 'jotai';
import { User, Google } from '@privy-io/react-auth';
import { queryUser } from '../services/userService';
import { Twitter } from './imageStore';
import { chatAtom } from './chatStore'; // 导入聊天状态

export interface AccountState {
  user: User | null;
  twitter: Twitter | null;
  google: Google | null;
  walletAddress: string | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  error: string | null;
  credits: number;
  did: string | null;
  role: string | null;
  name: string | null;
  avatar: string | null;
}

// 初始账户状态
const initialState: AccountState = {
  user: null,
  twitter: null,
  google: null,
  walletAddress: null,
  isLoading: false,
  isLoggedIn: false,
  error: null,
  credits: 0,
  did: null,
  role: 'user',
  name: null,
  avatar: null,
};

// 创建账户状态原子
export const accountAtom = atom<AccountState>(initialState);

// 设置用户信息并查询用户数据
export const setUser = atom(
  null,
  async (get, set, user: User | null) => {
    if (!user) {
      set(accountAtom, initialState);
      return;
    }

    set(accountAtom, {
      ...get(accountAtom),
      isLoading: true
    });

    try {
      // 获取钱包地址
      const walletAddress = user?.wallet?.address || null;
      const did = user?.id || null;

      // 如果有DID，查询用户信息
      if (did) {
        const queryParams = { did };
        if (walletAddress) {
          // 如果有钱包地址，查询钱包地址
          // @ts-ignore
          queryParams.address = walletAddress;
        }

        try {
          const result = await queryUser(queryParams);

          set(accountAtom, {
            user,
            twitter: result.data.twitter,
            google: user?.google || null,
            walletAddress: result.data.address || walletAddress,
            isLoading: false,
            isLoggedIn: true,
            error: null,
            credits: result.data.credit,
            did,
            role: result.data.role || 'user',
            name: result.data.name || null,
            avatar: result.data.avatar || null,
          });
        } catch (error) {
          // 如果查询失败，仍使用本地用户信息
          set(accountAtom, {
            user,
            twitter: user?.twitter ? {
              username: user.twitter.username,
              name: user.twitter.name,
              profilePictureUrl: user.twitter.profilePictureUrl,
              subject: user.twitter.subject
            } : null,
            google: user?.google || null,
            walletAddress,
            isLoading: false,
            isLoggedIn: true,
            error: (error as Error).message,
            credits: 0,
            did,
            role: 'user',
            name: null,
            avatar: null,
          });
        }
      } else {
        // 无DID的情况
        set(accountAtom, {
          user,
          twitter: user?.twitter ? {
            username: user.twitter.username,
            name: user.twitter.name,
            profilePictureUrl: user.twitter.profilePictureUrl,
            subject: user.twitter.subject
          } : null,
          google: user?.google || null,
          walletAddress,
          isLoading: false,
          isLoggedIn: true,
          error: null,
          credits: 0,
          did,
          role: 'user',
          name: null,
          avatar: null,
        });
      }
    } catch (error) {
      set(accountAtom, {
        ...get(accountAtom),
        isLoading: false,
        error: (error as Error).message
      });
    }
  }
);

// 设置钱包地址
export const setWalletAddress = atom(
  null,
  (get, set, address: string | null) => {
    const state = get(accountAtom);

    set(accountAtom, {
      ...state,
      walletAddress: address
    });
  }
);

// 设置加载状态
export const setLoading = atom(
  null,
  (get, set, isLoading: boolean) => {
    const state = get(accountAtom);

    set(accountAtom, {
      ...state,
      isLoading
    });
  }
);

// 设置错误状态
export const setError = atom(
  null,
  (get, set, error: string | null) => {
    const state = get(accountAtom);

    set(accountAtom, {
      ...state,
      error
    });
  }
);

// 设置积分
export const setCredits = atom(
  null,
  (get, set, credits: number) => {
    const state = get(accountAtom);

    set(accountAtom, {
      ...state,
      credits
    });
  }
);

// 登出
export const logout = atom(
  null,
  (get, set) => {
    // 重置账户状态
    set(accountAtom, initialState);

    // 获取当前聊天状态
    const chatState = get(chatAtom);

    // 如果有心跳，停止心跳
    if (chatState.heartbeatId) {
      clearInterval(chatState.heartbeatId);
    }

    // 重置聊天连接状态
    set(chatAtom, {
      ...chatState,
      connection: {
        isActive: false,
        inQueue: false
      },
      heartbeatId: undefined,
      did: undefined // 确保did被清除
    });
  }
);