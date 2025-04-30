/* eslint-disable @typescript-eslint/no-explicit-any */
import { atom } from 'jotai';
import { aspectRatios, AspectRatio, CheckStatsResponse } from './chatStore'
import { ModelDetail } from './modelStore';
import { fetchImages } from './imageStore';
import { showToastAtom } from './imagesStore';
import { PRIVY_TOKEN_HEADER } from '../utils/constants';
import { getAccessToken } from "@privy-io/react-auth"

interface GeneratePopupState {
  open: boolean;
  model?: ModelDetail | null; // 选中的模型
  selectedAspectRatio: AspectRatio; // 添加选中的宽高比
  resultAspectRatio?: AspectRatio; // 生图结果的宽高比
  prompt: string; // 添加提示词
  loraWeight?: number; // 添加lora权重
  taskId?: number;
  isGenerating: boolean;
  isCompleted: boolean;
  did: string | null;
  imageUrl: string | null;
}

// 初始状态
const initialState: GeneratePopupState = {
  open: false,
  model: null,
  selectedAspectRatio: aspectRatios[0], // 默认选择第一个宽高比
  resultAspectRatio: aspectRatios[0], // 生图结果的宽高比
  prompt: '', // 默认提示词为空
  loraWeight: 0.65, // 默认lora权重为0.65
  isGenerating: false,
  isCompleted: false,
  did: null, // 默认did为null，即未登录状态
  imageUrl: null
};

// 生成弹出框状态atom
export const generatePopupAtom = atom<GeneratePopupState>(initialState);

// 显示生成弹出框
export const showGeneratePopupAtom = atom(
  null,
  (get, set, did: string | null, model: ModelDetail | null) => {
    const currentState = get(generatePopupAtom);
    set(generatePopupAtom, {
      ...currentState,
      open: true,
      model,
      did,
      imageUrl: '',
      prompt: '',
      loraWeight: 0.65,
      isGenerating: false
    });
  }
);

// 隐藏生成弹出框
export const hideGeneratePopupAtom = atom(
  null,
  (get, set) => {
    set(generatePopupAtom, {
      ...get(generatePopupAtom),
      open: false
    });
  }
); 

// 设置选中的宽高比
export const setAspectRatio = atom(
  null,
  (get, set, aspectRatio: AspectRatio) => {
    set(generatePopupAtom, {
     ...get(generatePopupAtom),
      selectedAspectRatio: aspectRatio
    });
  }
);

// 查询图片生成状态的API
export async function checkGenerationStatus(task_id: string): Promise<CheckStatsResponse> {
  try {
    const response = await fetch(`/studio-api/model/aigc/state?task_id=${task_id}&refreshState=true`, {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Status check failed with status code ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('查询图片生成状态出错:', error);
    throw error;
  }
}

// 简化的轮询函数 - 使用 for 循环
export async function pollGenerationTask(taskId: string, set: any, get: any): Promise<void> {
  console.log('===== 开始轮询任务:', taskId);
  
  // 最大轮询次数和间隔时间
  const MAX_POLL_COUNT = 60; // 最多轮询60次
  const POLL_INTERVAL = 5000; // 每次间隔5秒
  
  for (let pollCount = 0; pollCount < MAX_POLL_COUNT; pollCount++) {
    try {
      console.log(`===== 轮询任务 ${taskId} 第 ${pollCount + 1} 次`);
      
      // 等待一段时间再查询
      if (pollCount > 0) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      }
      
      // 查询任务状态
      const statusResponse = await checkGenerationStatus(taskId);
      console.log('===== 查询任务状态响应:', statusResponse);
      
      // 获取当前状态
      const generateState = get(generatePopupAtom);
      
      // 如果没有状态信息，继续轮询
      if (!statusResponse?.data?.status) {
        console.log('===== 响应中没有状态信息，继续轮询');
        continue;
      }
      
      const status = statusResponse.data.status.toLowerCase();
      console.log('===== 任务状态:', status);
      
      // 处理不同状态
      if (status === 'completed') {
        console.log('===== 任务完成');
        
        // 获取生成的图片
        const generatedImages = statusResponse.data.upscaled_urls || [];
        console.log('===== 获取到生成的图片:', generatedImages);
        
        if (generatedImages.length > 0) {
          const generatedImage = generatedImages[0];
          console.log('===== 获取到生成的图片:', generatedImage);
          // 更新状态
          set(generatePopupAtom, {
           ...generateState,
            imageUrl: generatedImage,
            isGenerating: false,
            isCompleted: true
          });
          
          // 显示成功通知
          set(showToastAtom, {
            message: 'Image generation completed',
            severity: 'success'
          });

          // 如果有当前模型，重新加载与模型相关的图片
          if (generateState.model?.id) {
            console.log('===== 重新加载与模型相关的图片，模型ID:', generateState.model?.id);
            // 使用 fetchImages 重新加载图片
            set(fetchImages, { reset: true, model_id: generateState.model?.id });
          }
        } else {
          console.log('===== 未获取到生成的图片');
          // 更新状态
          set(generatePopupAtom, {
            ...generateState,
             isGenerating: false,
             isCompleted: false,
             imageUrl: null
           });
        }
        
        // 任务完成，退出轮询
        console.log('===== 任务完成，退出轮询');
        return;
      } else if (status === 'failed' || status === 'error') {
        console.log('===== 任务失败');
        // 更新状态
        set(generatePopupAtom, {
          ...generateState,
           isGenerating: false,
           isCompleted: false,
           imageUrl: null
         });

        // 显示失败通知
        set(showToastAtom, {
          message: 'Image generation failed',
          severity: 'error' 
        })
        
        // 任务失败，退出轮询
        console.log('===== 任务失败，退出轮询');
        return;
      }
      
      // 如果是其他状态（处理中、等待中），继续轮询
      console.log('===== 任务仍在进行中，继续轮询');
      
    } catch (error) {
      console.error('===== 轮询任务状态出错:', error);
      
      // 发生错误时，增加轮询间隔时间，但继续轮询
      const waitTime = Math.min(30000, POLL_INTERVAL * Math.min(5, Math.floor(pollCount / 5) + 1));
      console.log(`===== 发生错误，等待 ${waitTime}ms 后继续轮询`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  // 达到最大轮询次数，添加超时消息
  console.log('===== 达到最大轮询次数，任务可能超时');
  // 获取当前状态
  const generateState = get(generatePopupAtom);

  // 更新状态
  set(generatePopupAtom, {
   ...generateState,
    isGenerating: false,
    isCompleted: false,
    imageUrl: null 
  });

  // 显示超时通知
  set(showToastAtom, {
    message: 'Image generation timed out',
    severity: 'warning'
  });
}

// 与后端通信的API
export async function generateRequest(prompt: string, creator?: string,
  model_id?: number, width?: number, height?: number, lora_name?: string, lora_weight?: number
) {
  const API_URL = '/studio-api/model/aigc';
  
  try {
    const privyToken = await getAccessToken();
    const full_prompt = ` ${lora_name}, <lora:${lora_name}:${lora_weight}>, ${prompt},`
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_BEARER_TOKEN}`,
        [PRIVY_TOKEN_HEADER]: privyToken || "",
      },
      body: JSON.stringify({
        model_id,
        creator,
        prompt: full_prompt,
        width,
        height
      }),
    });

    if (!response.ok) {
      throw new Error(`API请求失败，状态码 ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('发送消息时出错:', error);
    throw error;
  }
}

// 
export const generate = atom(
  null,
  async (get, set, prompt: string, loraWeight: number) => {
    if (!prompt.trim()) return;

    const currentState = get(generatePopupAtom);

    set(generatePopupAtom, {
      ...currentState,
      prompt,
      isGenerating: true,
      isCompleted: false,
      imageUrl: null,
      loraWeight: loraWeight,
      resultAspectRatio: currentState.selectedAspectRatio
    });

    try {
      // 获取当前选择的宽高比
      const { width, height } = currentState.selectedAspectRatio || aspectRatios[0];
      
      // 获取当前模型的lora_name
      const lora_name = currentState.model?.model_tran?.[0]?.lora_name || '';

      // 获取当前模型的model_id
      const model_id = currentState.model?.id;

      // 获取当前用户的did
      const did = currentState.did || undefined;

      // 发送生成请求
      const response = await generateRequest(prompt, did, model_id, width, height, lora_name, loraWeight);
      console.log('生成请求响应:', response);

      const task_id = response.data.task_id;
      console.log('任务ID:', task_id);
      if (task_id) {
        // 轮询任务状态
        pollGenerationTask(task_id, set, get).catch(error => {
          console.error('轮询任务状态出错:', error)
          // 显示错误通知
          set(showToastAtom, {
            message: 'Image generation failed',
            severity: 'error'
          });
        }); 
      }
      
    } catch (error) {
      console.error('Error generating image:', error); 

      // 更新错误状态
      set(generatePopupAtom, {
        ...currentState,
        isGenerating: false,
        isCompleted: false,
        imageUrl: null
      });
    }
  } 
)