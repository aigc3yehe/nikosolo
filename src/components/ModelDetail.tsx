import React, { useEffect, useRef, useCallback, useState } from 'react';
import styles from './ModelDetail.module.css';
import { useAtom, useSetAtom } from 'jotai';
import { fetchModelDetail, modelDetailAtom, clearModelDetail } from '../store/modelStore';
import { fetchImages, imageListAtom } from '../store/imageStore';
import { setCurrentModel, clearCurrentModel } from '../store/chatStore';

import ImageCard from './ImageCard';
import ModelCarousel from './ModelCarousel';
import ModelInfoPanel from './ModelInfoPanel';
import StatePrompt from './StatePrompt';
import TokenizationPanel from './TokenizationPanel';

interface ModelDetailProps {
  modelId: number;
}

const ModelDetail: React.FC<ModelDetailProps> = ({ modelId }) => {
  const [modelDetailState] = useAtom(modelDetailAtom);
  const [imageListState] = useAtom(imageListAtom);
  const fetchDetail = useSetAtom(fetchModelDetail);
  const fetchImagesList = useSetAtom(fetchImages);
  const clearDetail = useSetAtom(clearModelDetail);

  const setCurrentModelInChat = useSetAtom(setCurrentModel);
  const clearCurrentModelInChat = useSetAtom(clearCurrentModel);

  const [activeTab, setActiveTab] = useState<'description' | 'tokenization'>('description');

  const { currentModel, isLoading, error } = modelDetailState;
  const { images = [], isLoading: imagesLoading, error: imagesError, hasMore } = imageListState;

  // 图片瀑布流相关状态
  const [containerHeight, setContainerHeight] = useState(0);
  const [imagePositions, setImagePositions] = useState<{top: number, left: number, height: number}[]>([]);

  // 引用
  const observer = useRef<IntersectionObserver | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const galleryContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 加载模型详情
    fetchDetail(modelId);

    // 加载与模型相关的图片
    fetchImagesList({ reset: true, model_id: modelId });

    // 组件卸载时清除详情
    return () => {
      clearDetail();
      clearCurrentModelInChat();
    };
  }, [modelId, fetchDetail, fetchImagesList, clearDetail, clearCurrentModelInChat]);

  // 监听当前模型变化，更新聊天存储中的当前模型(模型Ready的时候才更新)
  useEffect(() => {
    if (currentModel && currentModel.model_tran?.[0]?.train_state === 2) {
      setCurrentModelInChat(currentModel);
    }
  }, [currentModel, setCurrentModelInChat]);

  // 计算瀑布流布局
  useEffect(() => {
    if (images.length === 0) return;

    // const containerWidth = 57.625; // 922px 转换为 rem (假设 16px 基准)
    const cardWidth = 13.9375; // 223px 转换为 rem
    const columnGap = 0.625; // 10px 转换为 rem

    const columnCount = 4;
    const columnHeights = Array(columnCount).fill(0);
    const positions: {top: number, left: number, height: number}[] = [];

    images.forEach((image) => {
      // 找出当前高度最小的列
      const minHeightColumn = columnHeights.indexOf(Math.min(...columnHeights));

      // 计算图片高度 (基于原始宽高比)
      const aspectRatio = image.width && image.height ? image.height / image.width : 1;
      const imageHeight = cardWidth * aspectRatio;

      // 计算位置
      const left = minHeightColumn * (cardWidth + columnGap);
      const top = columnHeights[minHeightColumn];

      // 保存位置信息
      positions.push({ top, left, height: imageHeight });

      // 更新该列的高度
      columnHeights[minHeightColumn] += imageHeight + columnGap;
    });

    // 更新容器高度为最高的列高度
    setContainerHeight(Math.max(...columnHeights));

    // 更新位置状态
    setImagePositions(positions);
  }, [images]);

  // 监听容器宽度变化
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      // 当容器大小变化时重新计算布局
      if (galleryContainerRef.current) {
        // const containerWidth = galleryContainerRef.current.clientWidth;
        // const containerWidthRem = containerWidth / 16;

        // 这里可以添加重新计算布局的逻辑，或者直接调用一个函数
        // 为了简化，我们可以依赖于 images 依赖项更改，触发上面的 useEffect
        setImagePositions([]); // 强制触发重新计算
      }
    });

    if (galleryContainerRef.current) {
      resizeObserver.observe(galleryContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 无限滚动的观察元素
  const loadMoreTriggerRef = useCallback((node: HTMLDivElement | null) => {
    if (imagesLoading) return;

    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchImagesList({ reset: false, model_id: modelId });
      }
    }, {
      root: scrollContainerRef.current,
      rootMargin: '200px',
      threshold: 0.1
    });

    if (node) observer.current.observe(node);
  }, [imagesLoading, hasMore, fetchImagesList, modelId]);

  if (isLoading) {
    return (
      <div className={styles.modelDetail} ref={scrollContainerRef}>
        <StatePrompt message="Loading Model Details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.modelDetail} ref={scrollContainerRef}>
        <StatePrompt
          message="Failed to Load Model"
          action={{
            text: 'Retry',
            onClick: () => fetchDetail(modelId)
          }}
        />
      </div>
    );
  }

  if (!currentModel) {
    return (
      <div className={styles.modelDetail} ref={scrollContainerRef}>
        <StatePrompt message="Model Not Found" />
      </div>
    );
  }

  return (
    <div className={styles.modelDetail} ref={scrollContainerRef}>
      {/* 1. 模型信息部分 - 使用新的布局 */}
      <div className={styles.infoSection}>
        {/* 左侧轮播图组件 */}
        <ModelCarousel
          images={currentModel.carousel || []}
          coverImage={currentModel.cover}
        />

        {/* 右侧信息面板 - 使用新的设计 */}
        <ModelInfoPanel model={currentModel} />
      </div>

      {/* 2. Tab 部分 */}
      <div className={styles.tabSection}>
        <div className={styles.tabHeader}>
          <button
            className={`${styles.tabButton} ${activeTab === 'description' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('description')}
          >
            Description
          </button>
          <button
              style={{
                display: 'none'
              }}
            className={`${styles.tabButton} ${activeTab === 'tokenization' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('tokenization')}
          >
            Tokenization
          </button>
        </div>

        <div className={styles.tabContent}>
          <div
            className={styles.descriptionContent}
            style={{ display: activeTab === 'description' ? 'block' : 'none' }}
          >
            <p>{currentModel.description || 'empty description'}</p>
          </div>

          <div
            className={styles.tokenizationContent}
            style={{ display: activeTab === 'tokenization' ? 'none' : 'none' }}
          >
            <TokenizationPanel model={currentModel}/>
          </div>
        </div>
      </div>

      {/* 3. Gallery 部分 */}
      <div className={styles.gallerySection}>
        <h2 className={styles.galleryTitle}>Gallery</h2>

        {images.length === 0 && !imagesLoading ? (
          <StatePrompt message="No Images Found" />
        ) : (
          <div
            className={styles.waterfallContainer}
            ref={galleryContainerRef}
            style={{ height: `${containerHeight}rem` }}
          >
            {images.map((image, index) => {
              // 确保索引有效
              if (index >= imagePositions.length) return null;

              return (
                <div
                  key={image.id}
                  className={styles.imageCardContainer}
                  style={{
                    position: 'absolute',
                    top: `${imagePositions[index].top}rem`,
                    left: `${imagePositions[index].left}rem`,
                    width: '13.9375rem', // 223px
                    height: `${imagePositions[index].height}rem`
                  }}
                >
                  <ImageCard image={image} />
                </div>
              );
            })}
          </div>
        )}

        {/* 加载更多触发元素 - 替代按钮实现自动加载 */}
        <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger}></div>

        {imagesLoading && (
          <StatePrompt message="Loading Images..." showIcon={false} />
        )}

        {imagesError && (
          <StatePrompt
            message="Failed to Load Images"
            action={{
              text: 'Retry',
              onClick: () => fetchImagesList({ reset: false, model_id: modelId })
            }}
          />
        )}
      </div>
    </div>
  );
};

export default ModelDetail;