import React, { useState, useEffect } from 'react';
import styles from './ContentDisplay.module.css';
import ContentHeader from './ContentHeader';
import ModelsContent from './ModelsContent';
import ImagesContent from './ImagesContent';
import ModelDetail from './ModelDetail';
import { useAtom, useSetAtom } from 'jotai';
import { clearModelDetail, modelDetailAtom, modelIdAndNameAtom } from '../store/modelStore';

const ContentDisplay: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'models' | 'images'>('models');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [sortOption, setSortOption] = useState<'New Model' | 'Popular'>('New Model');
  const [viewingModelId, setViewingModelId] = useState<number | null>(null);
  const [viewingModelName, setViewingModelName] = useState<string | null>(null);
  const [modelDetailState] = useAtom(modelDetailAtom);
  const clearDetail = useSetAtom(clearModelDetail);
  const [modelIdAndName] = useAtom(modelIdAndNameAtom);

  // 处理查看模型详情
  const handleViewModelDetail = (modelId: number, modelName: string) => {
    setViewingModelId(modelId);
    setViewingModelName(modelName);
    
    // 更新URL，不刷新页面
    const url = new URL(window.location.href);
    url.searchParams.set('model_id', modelId.toString());
    url.searchParams.set('model_name', modelName);
    window.history.pushState({}, '', url);
  };
  
  // 处理返回到模型列表
  const handleBackToList = () => {
    setViewingModelId(null);
    clearDetail();
    
    // 清除URL参数
    const url = new URL(window.location.href);
    url.searchParams.delete('model_id');
    url.searchParams.delete('model_name');
    window.history.pushState({}, '', url);
  };

  // 从URL参数中获取model_id和model_name
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const modelId = searchParams.get('model_id');
    const modelName = searchParams.get('model_name');
    
    if (modelId && modelName) {
      handleViewModelDetail(parseInt(modelId), modelName);
    }
  }, []);

  useEffect(() => {
    if (modelIdAndName.modelId && modelIdAndName.modelName) {
      handleViewModelDetail(modelIdAndName.modelId, modelIdAndName.modelName);
    }
  }, [modelIdAndName]);
  
  return (
    <div className={styles.contentDisplay}>
      <div className={styles.contentContainer}>
        {viewingModelId ? (
          <>
            <ContentHeader 
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              ownedOnly={ownedOnly}
              setOwnedOnly={setOwnedOnly}
              sortOption={sortOption}
              setSortOption={setSortOption}
              isDetailMode={true}
              modelName={modelDetailState.currentModel?.name || viewingModelName || 'Loading...'}
              onBackClick={handleBackToList}
            />
            
            <div className={styles.contentBody}>
              <ModelDetail modelId={viewingModelId} />
            </div>
          </>
        ) : (
          <>
            <ContentHeader 
              activeTab={activeTab} 
              setActiveTab={setActiveTab}
              ownedOnly={ownedOnly}
              setOwnedOnly={setOwnedOnly}
              sortOption={sortOption}
              setSortOption={setSortOption}
            />
            
            <div className={styles.contentBody}>
              {activeTab === 'models' ? (
                <ModelsContent 
                  ownedOnly={ownedOnly} 
                  sortOption={sortOption}
                  onModelClick={handleViewModelDetail}
                />
              ) : (
                <ImagesContent ownedOnly={ownedOnly} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ContentDisplay;