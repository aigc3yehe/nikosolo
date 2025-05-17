import { atom } from 'jotai';
import { accountAtom } from './accountStore';
import { Twitter } from './imageStore'; // 导入Twitter接口
import { PRIVY_TOKEN_HEADER } from '../utils/constants';
import { getAccessToken } from '@privy-io/react-auth';
import {FlaunchStatusResponse, ModelTokenizationStateResponse} from './tokenStore';

export enum TOKENIZATION_LAUNCHPAD_TYPE {
  FLAUNCH = 'flaunch',
  VIRTUALS = 'virtuals',
}

export interface TokenMetadata {
  description?: string;
  image?: string;
  name?: string;
  symbol?: string;
  virtuals_id?: number;
}

export interface ModelToken {
  meme_token?: string;
  metadata?: TokenMetadata;
  network?: number;
  deployer?: string;
  launchpad?: TOKENIZATION_LAUNCHPAD_TYPE
}

export interface CommunityModelToken {
  id?: number;
  state?: number;
  metadata?: TokenMetadata;
  meme_token?: string;
  network?: number;
}

// 定义Model接口
export interface Model {
  name: string;
  description: string;
  tags: string[];
  creator: string;
  id: number;
  batch: number;
  cover: string;
  usage: number;
  flag: string | null;
  public?: number; // 1 为可视, 0为由所有者设置为不可视，-1则是系统管理员设置的不可见，级别最高
  model_tokenization: ModelToken | null;
  model_community_tokenization: CommunityModelToken[] | null;
  model_tran: {
    version: number;
    train_state: number; // 0: 未开始, 1: 训练中, 2: 训练完成，-1: 训练失败
    task_id: string | null; // 任务ID
    lora_name: string | null; // Lora名称
    base_model: string | null; // 基础模型
    base_model_hash: string | null; // 基础模型哈希
  }[];
  users: {
    twitter: Twitter | null;
    address: string | null;
  };
}

// 定义排序参数类型
export type OrderType = 'created_at' | 'usage';
export type OrderDirection = 'desc' | 'asc';

// 定义模型列表状态
interface ModelListState {
  models: Model[];
  totalCount: number;
  page: number;
  pageSize: number;
  order: OrderType;
  desc: OrderDirection;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

// 初始状态
const initialState: ModelListState = {
  models: [],
  totalCount: 0,
  page: 1,
  pageSize: 30,
  order: 'created_at',
  desc: 'desc',
  isLoading: false,
  error: null,
  hasMore: true
};

// 创建模型列表原子
export const modelListAtom = atom<ModelListState>(initialState);

// 获取模型列表
export const fetchModels = atom(
  null,
  async (get, set, { reset = false, ownedOnly = false, order = "created_at", view = undefined }: { reset?: boolean, ownedOnly?: boolean, order?: string, view?: boolean } = {}) => {
    const state = get(modelListAtom);
    const accountState = get(accountAtom);

    // 如果重置或者还有更多数据可加载
    if (reset || state.hasMore) {
      if (ownedOnly && reset) {
        // 重置且切换为only owner

        const ownedModels = state.models.filter(model => model.creator == accountState.did)
        // 设置为加载中
        set(modelListAtom, {
          ...state,
          models: ownedModels,
          order: order as 'created_at' | 'usage',
          isLoading: true,
          error: null,
          page: 1
        });
      } else {
        // 设置为加载中
        set(modelListAtom, {
          ...state,
          order: order as 'created_at' | 'usage',
          isLoading: true,
          error: null,
          // 如果是重置，则页码为1，否则保持当前页
          page: reset ? 1 : state.page
        });
      }

      try {
        // 构建查询参数
        const params = new URLSearchParams({
          page: reset ? '1' : state.page.toString(),
          pageSize: state.pageSize.toString(),
          order: order as 'created_at' | 'usage',
          desc: state.desc
        });

        // 如果是owned模式，添加user参数
        if (ownedOnly && accountState.did) {
          params.append('user', accountState.did);
        }

        if (view) {
          params.append('view', 'true');
        }

        // 根据owned状态选择不同的API端点
        const endpoint = ownedOnly
          ? '/studio-api/model/list/owned'
          : '/studio-api/model/list/enabled';

        // 发送请求
        const response = await fetch(`${endpoint}?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`
          }
        });

        if (!response.ok) {
          throw new Error('get models error');
        }

        const result = await response.json();

        // 更新状态
        set(modelListAtom, {
          ...state,
          models: reset ? result.data.models : [...state.models, ...result.data.models],
          totalCount: result.data.totalCount,
          page: reset ? 2 : state.page + 1, // 更新页码为下一页
          isLoading: false,
          error: null,
          hasMore: (reset ? 1 : state.page) * state.pageSize < result.data.totalCount // 判断是否还有更多数据
        });
      } catch (error) {
        // 错误处理
        set(modelListAtom, {
          ...state,
          isLoading: false,
          error: (error as Error).message
        });
      }
    }
  }
);

export async function toggleViewRequest(type: string, id: number, view_value: boolean, did?: string) {
  const API_URL = "/studio-api/model/toggle_view";

  try {
    const privyToken = await getAccessToken();
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
        [PRIVY_TOKEN_HEADER]: privyToken || "",
      },
      body: JSON.stringify({
        type,
        id,
        'public': view_value,
        user: did,
      })
    })

    if (!res.ok) {
      throw new Error(`API returned error status ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

// 获取模型列表
export const fetchToggleView = atom(
    null,
    async (get, _set, type: string, id: number, public_value: boolean) => {
      const accountState = get(accountAtom);

      try {
        const did = accountState.did || undefined;
        const response = await toggleViewRequest(type, id, public_value, did);
        console.log('result', response);
        return response; // 返回结果，以便在组件中使用Promise链
      } catch (error) {
        console.log(error);
        throw error; // 抛出错误以便在组件中捕获
      }
    }
);

// 重置
export const resetModelList = atom(
  null,
  (_, set) => {
    set(modelListAtom, initialState);
  }
);

// 定义模型详情接口
export interface ModelDetail extends Model {
  carousel: string[];
  created_at: string;
  model_vote: {
    like: number;
    dislike: number;
    state: number;
  };
}

// 创建模型详情状态原子
interface ModelDetailState {
  currentModel: ModelDetail | null;
  isLoading: boolean;
  error: string | null;
}

const initialDetailState: ModelDetailState = {
  currentModel: null,
  isLoading: false,
  error: null
};

export const modelDetailAtom = atom<ModelDetailState>(initialDetailState);

// 获取模型详情
export const fetchModelDetail = atom(
  null,
  async (get, set, modelId: number, showLoading: boolean = true) => {
    set(modelDetailAtom, {
      ...get(modelDetailAtom),
      isLoading: showLoading,
      error: null
    });

    try {
      const response = await fetch(`/studio-api/model/detail?id=${modelId}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`
        }
      });

      if (!response.ok) {
        throw new Error('get error detail error');
      }

      const result = await response.json();

      // 检查是否有未完成的社区token
      const communityTokens = result.data.model_community_tokenization;
      if (communityTokens && communityTokens.length > 0) {
        // 查找第一个state不等于2的token
        const pendingToken = communityTokens.find((token: { state: number; }) => token.state !== 2);

        // 如果找到未完成的token，直接使用set调用fetchCommunityTokenizationState
        if (pendingToken) {
          set(fetchCommunityTokenizationState, {
            modelId,
            token_tokenization_id: pendingToken.id
          });
        }
      }

      set(modelDetailAtom, {
        currentModel: result.data,
        isLoading: false,
        error: null
      });

      return result.data;
    } catch (error) {
      set(modelDetailAtom, {
        ...get(modelDetailAtom),
        isLoading: false,
        error: (error as Error).message
      });

      throw error;
    }
  }
);

// 清除模型详情
export const clearModelDetail = atom(
  null,
  (_, set) => {
    set(modelDetailAtom, initialDetailState);
  }
);

// 创建模型详情状态原子
interface ModelIdAndNameState {
  modelId: number | null;
  modelName: string | null;
}

const initialModelIdAndNameState: ModelIdAndNameState = {
  modelId: null,
  modelName: null
};

export const modelIdAndNameAtom = atom<ModelIdAndNameState>(initialModelIdAndNameState);

export const setModelIdAndName = atom(
  null,
  (_, set, { modelId, modelName }: { modelId: number, modelName: string }) => {
    set(modelIdAndNameAtom, {
      modelId,
      modelName
    });
  }
);

export const getModelIdAndName = atom(
  (get) => get(modelIdAndNameAtom)
);

export async function editCoverRequest(model_id: number, url: string, did?: string) {
  const API_URL = "/studio-api/model/edit_cover";

  try {
    const privyToken = await getAccessToken();
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
        [PRIVY_TOKEN_HEADER]: privyToken || "",
      },
      body: JSON.stringify({
        model_id,
        url,
        user: did,
      })
    })

    if (!res.ok) {
      throw new Error(`API returned error status ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.log(error);
    throw error;
  }
}

// 获取模型列表
export const fetchEditCover = atom(
    null,
    async (get, set, model_id: number, url: string) => {
      const accountState = get(accountAtom);

      try {
        const did = accountState.did || undefined;
        const response = await editCoverRequest(model_id, url, did);
        console.log('result', response);
        const result = response;
        console.log("result", result);
        if (result.data) {
          console.log('result 设置成功', result);
          const oldModelDetail = get(modelDetailAtom)
          if (oldModelDetail && oldModelDetail.currentModel) {
            oldModelDetail.currentModel.cover = url
            set(modelDetailAtom, oldModelDetail);
          }
        }
        return response; // 返回结果，以便在组件中使用Promise链
      } catch (error) {
        console.log(error);
        throw error; // 抛出错误以便在组件中捕获
      }
    }
);

// 获取社区token状态的函数
export const fetchCommunityTokenizationState = atom(
    null,
    async (_get, set, { modelId, token_tokenization_id }: { modelId: number, token_tokenization_id: number }) => {

      try {
        const params = new URLSearchParams({
          model_id: modelId.toString(),
          refreshState: 'true',
          is_community_token: 'true',
          token_tokenization_id: token_tokenization_id.toString()
        });

        const response = await fetch(`/studio-api/model/tokenization/state?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
          }
        });

        if (!response.ok) {
          throw new Error('get community tokenization state error');
        }

        const result: ModelTokenizationStateResponse = await response.json();
        const data = result.data as FlaunchStatusResponse;

        // 如果社区token已完成，重新获取模型详情
        if (data && data.state === 'completed') {
          const response = await fetch(`/studio-api/model/detail?id=${modelId}`, {
              headers: {
                'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`
              }
          });

          if (!response.ok) {
            throw new Error('get error detail error');
          }

          const result = await response.json();

          set(modelDetailAtom, {
            currentModel: result.data,
            isLoading: false,
            error: null
          });

          return result.data;
        }
      } catch (error) {
        console.error(error);
      }
    }
);
