import { atom } from 'jotai';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// S3 配置
const S3_CONFIG = {
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
  bucketName: import.meta.env.VITE_AWS_S3_BUCKET
};

// 状态接口
interface ImageUploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  uploadedUrls: string[];
}

// 初始状态
const initialState: ImageUploadState = {
  isUploading: false,
  progress: 0,
  error: null,
  uploadedUrls: []
};

// 创建状态原子
export const imageUploadAtom = atom<ImageUploadState>(initialState);

// 创建消息通知原子
interface ToastNotification {
  message: string;
  severity: 'success' | 'error' | 'info' | 'warning';
  open: boolean;
}

export const toastAtom = atom<ToastNotification>({
  message: '',
  severity: 'info',
  open: false
});

// 上传单个文件到 S3
export const uploadFileToS3 = async (file: File): Promise<string> => {
  console.log('📝 Preparing file for upload:', file.name);
  
  try {
    const s3Client = new S3Client({
      region: S3_CONFIG.region,
      credentials: S3_CONFIG.credentials,
    });
    
    // 将 File 转换为 Blob
    const response = await fetch(URL.createObjectURL(file));
    const arrayBuffer = await response.arrayBuffer();
    const fileContent = new Uint8Array(arrayBuffer);
    
    const fileName = `images_${Date.now()}-${file.name}`;
    const key = `images/chat/${fileName}`;
    
    const command = new PutObjectCommand({
      Bucket: S3_CONFIG.bucketName,
      Key: key,
      Body: fileContent,  // 使用 Buffer 来处理二进制数据
      ContentType: file.type
    });

    console.log('🚀 Starting upload to S3:', key);
    const result = await s3Client.send(command);
    console.log("✨ Upload completed:", result);

    const fileUrl = `https://${S3_CONFIG.bucketName}.s3.amazonaws.com/${key}`;
    console.log('🔗 Generated URL:', fileUrl);
    return fileUrl;
  } catch (error) {
    console.error('⚠️ Error uploading file:', file.name, error);
    throw error;
  }
};

// 更新消息的URL列表
export const updateMessageUrlsAtom = atom(
  null,
  // @ts-ignore
  (_, set, { messageId, url, progress }: { messageId: number, url: string, progress: number }) => {
    // 更新图片上传进度
    set(imageUploadAtom, (prev) => ({
      ...prev,
      progress,
      uploadedUrls: [...prev.uploadedUrls, url]
    }));
    
    // 如果需要的话，这里可以加入更新消息的逻辑
  }
);

// 显示通知
export const showToastAtom = atom(
  null,
  (_, set, { message, severity }: { message: string, severity: 'success' | 'error' | 'info' | 'warning' }) => {
    set(toastAtom, {
      message,
      severity,
      open: true
    });
    
    // 自动关闭通知
    setTimeout(() => {
      set(toastAtom, (prev) => ({
        ...prev,
        open: false
      }));
    }, 5000);
  }
);

// 上传多个图片
export const uploadImages = async (
  messageId: number, 
  files: File[], 
  setUploadState: (state: Partial<ImageUploadState>) => void,
  updateMessageUrls: (params: { messageId: number, url: string, progress: number }) => void,
  showToast: (params: { message: string, severity: 'success' | 'error' | 'info' | 'warning' }) => void
) => {
  console.log('📤 Starting image upload process', { messageId, fileCount: files.length });
  
  // 设置上传开始状态
  setUploadState({ 
    isUploading: true, 
    progress: 0,
    error: null,
    uploadedUrls: []
  });
  
  try {
    const uploadedUrls: string[] = [];
    const totalFiles = files.length;
    let completedUploads = 0;

    // 串行上传所有文件（避免过多的并行请求）
    for (const file of files) {
      console.log('🖼️ Processing file:', file.name);
      
      try {
        // 上传单个文件
        const url = await uploadFileToS3(file);
        uploadedUrls.push(url);
        
        // 更新完成数量和进度
        completedUploads++;
        const progress = Math.round((completedUploads / totalFiles) * 100);
        
        // 更新当前已上传的URL和进度
        updateMessageUrls({ 
          messageId, 
          url,
          progress 
        });
      } catch (error) {
        console.error('Error uploading file:', file.name, error);
        // 继续处理其他文件
      }
    }

    // 更新最终状态
    setUploadState({ 
      isUploading: false,
      progress: 100,
      uploadedUrls
    });
    
    // 显示成功通知
    showToast({ message: 'Images uploaded successfully', severity: 'success' });
    console.log('✅ Upload process completed successfully');
    
    return uploadedUrls;
  } catch (error: any) {
    console.error('❌ Upload process failed:', error);
    
    // 更新错误状态
    setUploadState({ 
      isUploading: false,
      error: error.message || 'Failed to upload images'
    });
    
    // 显示错误通知
    showToast({ message: 'Failed to upload images', severity: 'error' });
    throw error;
  }
};

// 创建用于更新图片上传状态的方法
export const setImageUploadStateAtom = atom(
  null,
  (_, set, update: Partial<ImageUploadState>) => {
    set(imageUploadAtom, (prev) => ({
      ...prev,
      ...update
    }));
  }
); 