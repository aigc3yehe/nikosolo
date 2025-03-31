import { atom } from 'jotai';
import { accountAtom } from './accountStore';
import { Twitter } from './imageStore'; // 导入Twitter接口

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
  pageSize: 20,
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
  async (get, set, { reset = false, ownedOnly = false }: { reset?: boolean, ownedOnly?: boolean } = {}) => {
    const state = get(modelListAtom);
    const accountState = get(accountAtom);
    
    // 如果重置或者还有更多数据可加载
    if (reset || state.hasMore) {
      // 设置为加载中
      set(modelListAtom, {
        ...state,
        isLoading: true,
        error: null,
        // 如果是重置，则页码为1，否则保持当前页
        page: reset ? 1 : state.page
      });
      
      try {
        // 构建查询参数
        const params = new URLSearchParams({
          page: reset ? '1' : state.page.toString(),
          pageSize: state.pageSize.toString(),
          order: state.order,
          desc: state.desc
        });
        
        // 如果是owned模式，添加user参数
        if (ownedOnly && accountState.did) {
          params.append('user', accountState.did);
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
          throw new Error('获取模型列表失败');
        }
        
        const result = await response.json();
        
        // 更新状态
        set(modelListAtom, {
          ...state,
          models: reset ? result.data.models : [...state.models, ...result.data.models],
          totalCount: result.data.totalCount,
          page: reset ? 2 : state.page + 1, // 更新页码为下一页
          isLoading: false,
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

// 更改排序方式
export const changeOrder = atom(
  null,
  (get, set, newOrder: OrderType) => {
    const state = get(modelListAtom);
    
    set(modelListAtom, {
      ...state,
      order: newOrder,
      page: 1, // 重置页码
      models: [], // 清空当前模型列表
      hasMore: true // 重置是否有更多数据
    });
    
    // 重新获取数据
    // @ts-ignore
    get(fetchModels)(true);
  }
);

// 更改排序方向
export const changeOrderDirection = atom(
  null,
  (get, set, newDirection: OrderDirection) => {
    const state = get(modelListAtom);
    
    set(modelListAtom, {
      ...state,
      desc: newDirection,
      page: 1,
      models: [],
      hasMore: true
    });
    
    // @ts-ignore
    get(fetchModels)(true);
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
  async (get, set, modelId: number) => {
    set(modelDetailAtom, {
      ...get(modelDetailAtom),
      isLoading: true,
      error: null
    });
    
    try {
      const response = await fetch(`/studio-api/model/detail?id=${modelId}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`
        }
      });
      
      if (!response.ok) {
        throw new Error('获取模型详情失败');
      }
      
      const result = await response.json();
      
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
