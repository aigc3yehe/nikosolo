import { atom } from 'jotai';
import { PRIVY_TOKEN_HEADER } from '../utils/constants';
import { getAccessToken } from '@privy-io/react-auth';

// 定义响应类型
export type ModelTokenizationStateResponse = {
  message: string;
  data?:
    | JobStateResponse
    | FlaunchLaunchTokenResponse
    | FlaunchStatusResponse;
};

// 任务进入队列, 但是还未执行
export type JobStateResponse = {
  state?: string; // waiting / failed / active 
};

// 任务开始执行, 并且已经发送给 Flaunch API
export type FlaunchLaunchTokenResponse = {
  success: boolean;
  message?: string;
  jobId?: string;

  // Queue status will show how long the expected flaunch time should be. The
  // `estimatedWaitSeconds` can offset the initial "Check Launch Status" delay.
  queueStatus?: {
    position?: number;
    waitingJobs?: number;
    activeJobs?: number;
    estimatedWaitSeconds?: number;
  };

  // Privy data will vary depending on the `creatorType` specified
  privy?: {
    type?: string;
    address?: string;
  };
};

// 任务执行完毕
export type FlaunchStatusResponse = {
  success: boolean;
  state?: string;
  queuePosition?: number;
  estimatedWaitTime: number;
  transactionHash?: string;
  collectionToken?: {
    address: string;
    imageIpfs: string;
    name: string;
    symbol: string;
    tokenURI: string;
    creator: string;
  };
  error?: string;
};

// 定义 token 化响应类型
export type ModelTokenizationResponse = {
  message: string;
  data: {
    task_id: string;
    token_tokenization_id: number;
  };
};

// 定义 Metadata 类型
export interface Metadata {
  name: string;
  symbol: string;
  description?: string;
  image: string;
  websiteUrl?: string;
  discordUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
}

// 定义 TokenizationConfig 类型
export interface TokenizationConfig {
  creator: string; // 模型的创建者地址, privy生成的钱包地址
  network?: number; // 默认是8453, 测试时可以使用84532
  method?: 'flaunch_api'; 
  useOriginImage?: boolean; // 是否要利用 flaunch 的 api 将图片上传到ipfs
}

// 定义 token 化状态接口
interface TokenizationState {
  data: JobStateResponse | FlaunchLaunchTokenResponse | FlaunchStatusResponse | null;
  isLoading: boolean;
  error: string | null;
}

// 初始状态
const initialTokenizationState: TokenizationState = {
  data: null,
  isLoading: false,
  error: null
};

// 创建 token 化状态原子
export const tokenizationStateAtom = atom<TokenizationState>(initialTokenizationState);

// 获取 token 化状态
export const fetchTokenizationState = atom(
  null,
  async (get, set, { modelId, refreshState = true }: { modelId: number, refreshState?: boolean }) => {
    set(tokenizationStateAtom, {
      ...get(tokenizationStateAtom),
      isLoading: true,
      error: null
    });
    
    try {
      const params = new URLSearchParams({
        model_id: modelId.toString(),
        refreshState: refreshState.toString()
      });
      const response = await fetch(`/studio-api/model/tokenization/state?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
        }
      });
      
      if (!response.ok) {
        throw new Error('获取 token 化状态失败');
      }
      
      const result: ModelTokenizationStateResponse = await response.json();
      
      set(tokenizationStateAtom, {
        data: result.data || null,
        isLoading: false,
        error: null
      });
      
      return result;
    } catch (error) {
      set(tokenizationStateAtom, {
        ...get(tokenizationStateAtom),
        isLoading: false,
        error: (error as Error).message
      });
      
      throw error;
    }
  }
);

// 清除 token 化状态
export const clearTokenizationState = atom(
  null,
  (_, set) => {
    set(tokenizationStateAtom, initialTokenizationState);
  }
);

// 获取当前 token 化状态
export const getTokenizationState = atom(
  (get) => get(tokenizationStateAtom)
);

// 检查 token 化是否完成
export const isTokenizationCompleted = atom(
  (get) => {
    const state = get(tokenizationStateAtom);
    if (!state.data) return false;
    
    // 检查是否是 FlaunchStatusResponse 类型
    const data = state.data as FlaunchStatusResponse;
    return data.state === 'completed' && !!data.collectionToken;
  }
);

// 获取 token 地址
export const getTokenAddress = atom(
  (get) => {
    const state = get(tokenizationStateAtom);
    if (!state.data) return null;
    
    // 检查是否是 FlaunchStatusResponse 类型且已完成
    const data = state.data as FlaunchStatusResponse;
    if (data.state === 'completed' && data.collectionToken) {
      return data.collectionToken.address;
    }
    
    return null;
  }
);

// 模型 token 化接口
export const tokenizeModel = atom(
  null,
  async (_, set, { modelId, metadata, config }: { modelId: number, metadata: Metadata, config: TokenizationConfig }) => {
    try {
      const privyToken = await getAccessToken();
      const response = await fetch('/studio-api/model/tokenization', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
          [PRIVY_TOKEN_HEADER]: privyToken || '',
        },
        body: JSON.stringify({
          model_id: modelId,
          metadata,
          config
        })
      });
      
      if (!response.ok) {
        throw new Error('模型 token 化失败');
      }
      
      const result: ModelTokenizationResponse = await response.json();
      return result;
    } catch (error) {
      set(tokenizationStateAtom, {
        ...initialTokenizationState,
        error: (error as Error).message
      });
      
      throw error;
    }
  }
);

// 模型 token 化重试接口
export const retryTokenization = atom(
  null,
  async (_, set, { modelId, creator }: { modelId: number, creator: string }) => {
    try {
      const privyToken = await getAccessToken();
      const response = await fetch('/studio-api/model/tokenization/retry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
          [PRIVY_TOKEN_HEADER]: privyToken || '',
        },
        body: JSON.stringify({
          model_id: modelId,
          config: {
            creator
          }
        })
      });
      
      if (!response.ok) {
        throw new Error('模型 token 化重试失败');
      }
      
      const result: ModelTokenizationResponse = await response.json();
      return result;
    } catch (error) {
      set(tokenizationStateAtom, {
        ...initialTokenizationState,
        error: (error as Error).message
      });
      
      throw error;
    }
  }
);

// 添加 FlagResponse 类型定义
export type FlagResponse = {
  message: string;
  data: boolean;
};

// 添加设置模型标识的原子
export const setModelFlag = atom(
  null,
  async (_, __, { modelId, flag, user }: { modelId: number, flag: string, user: string }) => {
    try {
      const privyToken = await getAccessToken();
      const response = await fetch('/studio-api/model/flag', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
          [PRIVY_TOKEN_HEADER]: privyToken || '',
        },
        body: JSON.stringify({
          model_id: modelId,
          flag,
          user,
        })
      });
      
      if (!response.ok) {
        throw new Error('设置模型标识失败');
      }
      
      const result: FlagResponse = await response.json();
      return result;
    } catch (error) {
      console.error('设置模型标识错误:', error);
      throw error;
    }
  }
);