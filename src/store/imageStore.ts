/* eslint-disable @typescript-eslint/ban-ts-comment */
import { atom } from 'jotai';
import { accountAtom } from './accountStore';

// 定义Twitter接口
export interface Twitter {
  subject?: string;
  username?: string | null;
  name?: string | null;
  profilePictureUrl?: string | null;
}

// 定义Image接口
export interface Image {
  id: number;
  url: string | null;
  model_id: number;
  creator: string;
  version: number;
  task_id: string;
  width: number;
  height: number;
  state: number; // -1: 失败, 0: 待处理, 1: 成功
  public: number; // 1 为可见的 0是相关人员关闭了的
  users: {
    twitter: Twitter | null;
    address: string | null;
  };
}

// 定义排序参数类型
export type ImageOrderType = 'created_at' | 'updated_at' | 'id';
export type OrderDirection = 'desc' | 'asc';
export type ImageState = 'success' | 'pending';

// 定义图片列表状态
interface ImageListState {
  images: Image[];
  totalCount: number;
  page: number;
  pageSize: number;
  order: ImageOrderType;
  desc: OrderDirection;
  model_id?: number;
  state?: ImageState;
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
}

// 初始状态
const initialState: ImageListState = {
  images: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  order: 'created_at',
  desc: 'desc',
  isLoading: false,
  error: null,
  hasMore: true
};

// 创建图片列表原子
export const imageListAtom = atom<ImageListState>(initialState);

// 获取图片列表
export const fetchImages = atom(
  null,
  async (get, set, {
    reset = false,
    ownedOnly = false,
    model_id,
    state,
    view
  }: {
    reset?: boolean,
    ownedOnly?: boolean,
    model_id?: number,
    state?: ImageState,
    view?: boolean
  } = {}) => {
    const imageState = get(imageListAtom);
    const accountState = get(accountAtom);

    // 如果重置或者还有更多数据可加载
    if (reset || imageState.hasMore) {
      // 设置为加载中
      set(imageListAtom, {
        ...imageState,
        isLoading: true,
        error: null,
        // 如果是重置，则页码为1，否则保持当前页
        page: reset ? 1 : imageState.page,
        // 更新过滤条件
        model_id,
        state
      });

      try {
        // 构建查询参数
        const params = new URLSearchParams({
          page: reset ? '1' : imageState.page.toString(),
          pageSize: imageState.pageSize.toString(),
          order: imageState.order,
          desc: imageState.desc
        });

        // 如果是owned模式，添加user参数
        if (ownedOnly && accountState.did) {
          params.append('user', accountState.did);
        }

        // 添加可选的model_id参数
        if (model_id !== undefined) {
          params.append('model_id', model_id.toString());
        }

        // 添加可选的state参数
        if (state) {
          params.append('state', state);
        }

        if (view) {
          params.append('view', view.toString());
        }

        // 发送请求
        const response = await fetch(`/studio-api/model/list/gallery?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`
          }
        });

        if (!response.ok) {
          throw new Error('获取图片列表失败');
        }

        const result = await response.json();

        // 更新状态
        set(imageListAtom, {
          ...imageState,
          images: reset ? result.data.images : [...imageState.images, ...result.data.images],
          totalCount: result.data.totalCount,
          page: reset ? 2 : imageState.page + 1, // 更新页码为下一页
          isLoading: false,
          hasMore: (reset ? 1 : imageState.page) * imageState.pageSize < result.data.totalCount // 判断是否还有更多数据
        });
      } catch (error) {
        // 错误处理
        set(imageListAtom, {
          ...imageState,
          isLoading: false,
          error: (error as Error).message
        });
      }
    }
  }
);

// 更改排序方式
export const changeImageOrder = atom(
  null,
  (get, set, newOrder: ImageOrderType) => {
    const state = get(imageListAtom);

    set(imageListAtom, {
      ...state,
      order: newOrder,
      page: 1, // 重置页码
      images: [], // 清空当前图片列表
      hasMore: true // 重置是否有更多数据
    });

    // 重新获取数据
    // @ts-ignore
    get(fetchImages)({ reset: true });
  }
);

// 更改排序方向
export const changeImageOrderDirection = atom(
  null,
  (get, set, newDirection: OrderDirection) => {
    const state = get(imageListAtom);

    set(imageListAtom, {
      ...state,
      desc: newDirection,
      page: 1,
      images: [],
      hasMore: true
    });

    // @ts-ignore
    get(fetchImages)({ reset: true });
  }
);

// 按模型ID筛选
export const filterByModelId = atom(
  null,
  (get, set, model_id?: number) => {
    const state = get(imageListAtom);

    set(imageListAtom, {
      ...state,
      model_id,
      page: 1,
      images: [],
      hasMore: true
    });

    // @ts-ignore
    get(fetchImages)({ reset: true, model_id });
  }
);

// 按状态筛选
export const filterByState = atom(
  null,
  (get, set, state?: ImageState) => {
    const imageState = get(imageListAtom);

    set(imageListAtom, {
      ...imageState,
      state,
      page: 1,
      images: [],
      hasMore: true
    });

    // @ts-ignore
    get(fetchImages)({ reset: true, state });
  }
);

// 重置
export const resetImageList = atom(
  null,
  (_, set) => {
    set(imageListAtom, initialState);
  }
);

// 定义详细图片信息接口
export interface ImageDetail {
  models: {
    id: number;
    name: string;
  };
  users: {
    did: string;
    twitter: Twitter | null;
  };
  url: string;
  task_id: string;
  created_at: string;
  height: number;
  width: number;
  state: number;
}

// 获取图片详情
export const fetchImageDetail = async (imageId: number): Promise<ImageDetail> => {
  try {

    const response = await fetch(`/studio-api/aigc/image?image_id=${imageId}`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`获取图片详情失败: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.data) {
      throw new Error('图片详情数据格式无效');
    }

    return result.data;
  } catch (error) {
    console.error('获取图片详情出错:', error);
    throw error;
  }
};