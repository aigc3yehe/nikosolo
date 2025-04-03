import { Twitter } from "../store/imageStore";

// 创建用户响应接口
export interface CreateUserResponse {
  message: string;
  data: boolean;
}

// 查询用户响应接口
export interface QueryUserResponse {
  message: string;
  data: {
    address: string;
    did: string;
    twitter: Twitter;
    credit: number; // 查询时可用的credit点
  };
}

// 创建用户
export const createUser = async (userData: {
  did: string;
  address?: string;
  username?: string;
  subject?: string;
  name?: string;
  profilePictureUrl?: string;
}): Promise<CreateUserResponse> => {
  if (!userData.did || !userData.address) {
    throw new Error("Create user failed, missing did or address");
  }
  try {
    const response = await fetch("/studio-api/users/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      throw new Error("创建用户失败");
    }

    return await response.json();
  } catch (error) {
    console.error("创建用户API错误:", error);
    throw error;
  }
};

// 查询用户
export const queryUser = async (params: {
  did: string;
  address?: string;
}): Promise<QueryUserResponse> => {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append("did", params.did);

    if (params.address) {
      queryParams.append("address", params.address);
    }

    const response = await fetch(
      `/studio-api/users/query?${queryParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("查询用户失败");
    }

    return await response.json();
  } catch (error) {
    console.error("查询用户API错误:", error);
    throw error;
  }
};
