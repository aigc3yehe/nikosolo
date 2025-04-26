import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import styles from './ImagesContent.module.css';
import { imageListAtom, fetchImages } from '../store/imageStore';
import ImageCard from './ImageCard';
import StatePrompt from './StatePrompt';
import { accountAtom } from '../store/accountStore';

interface ImagesContentProps {
  ownedOnly: boolean;
  onNavigateToModel?: (modelId: number, modelName: string) => void;
}

interface ImagePosition {
  top: number;
  left: number;
  height: number;
}

// 定义常量
const CARD_CONTAINER_WIDTH = 922; // 卡片容器宽度
const CARD_WIDTH_PX = 223; // 卡片宽度（像素值）
const COLUMN_GAP_PX = 10;  // 列间距（像素值）

const ImagesContent: React.FC<ImagesContentProps> = ({ ownedOnly }) => {
  const [imageListState] = useAtom(imageListAtom);
  const [accountState] = useAtom(accountAtom);
  const fetchImagesList = useSetAtom(fetchImages);

  const { images = [], isLoading, error, hasMore } = imageListState;
  const observer = useRef<IntersectionObserver | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 图片位置状态
  const [imagePositions, setImagePositions] = useState<ImagePosition[]>([]);
  // 容器高度
  const [containerHeight, setContainerHeight] = useState(0);
  // 卡片宽度
  const [card_width_px, setCardWidth] = useState(0);
  // 列间距
  const [_, setColumnGap] = useState(0);

  // 根据用户角色和ownedOnly决定view参数
  // 如果是用户自己的图片列表(ownedOnly=true)，不需要传view参数
  // 如果是admin查看所有图片，不传view参数，显示所有图片
  // 如果是普通用户查看所有图片，设置view=true，只显示可见的图片
  const viewParam = ownedOnly ? undefined : (accountState.role === 'admin' ? undefined : true);

  // 计算瀑布流布局
  const calculateLayout = useCallback(() => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.clientWidth;

    // 计算可以放置的列数 (不使用rem转换，直接使用像素计算)
    const columnCount = 4;
    const card_width_px = CARD_WIDTH_PX * containerWidth / CARD_CONTAINER_WIDTH;
    const column_gap_px = COLUMN_GAP_PX * containerWidth / CARD_CONTAINER_WIDTH;
    setCardWidth(card_width_px);
    setColumnGap(column_gap_px);

    // 初始化每列的高度
    const columnHeights = Array(columnCount).fill(0);
    const positions: ImagePosition[] = [];

    // 计算每个图片的位置
    images.forEach((image) => {
      // 找出当前高度最小的列
      const minHeightColumn = columnHeights.indexOf(Math.min(...columnHeights));

      // 计算图片高度 (基于原始宽高比)
      const aspectRatio = image.width && image.height ? image.height / image.width : 1;
      const imageHeight = card_width_px * aspectRatio;

      // 计算位置
      const left = minHeightColumn * (card_width_px + column_gap_px);
      const top = columnHeights[minHeightColumn];

      // 保存位置信息
      positions.push({ top, left, height: imageHeight });

      // 更新该列的高度
      columnHeights[minHeightColumn] += imageHeight + column_gap_px;
    });

    // 更新容器高度为最高的列高度
    setContainerHeight(Math.max(...columnHeights));

    // 更新位置状态
    setImagePositions(positions);
  }, [images]);

  // 监听容器宽度变化
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      calculateLayout();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateLayout]);

  // 初始加载和图片数据变化时重新计算布局
  useEffect(() => {
    calculateLayout();
  }, [images, calculateLayout]);

  // 初始加载
  useEffect(() => {
    fetchImagesList({ reset: true, ownedOnly, view: viewParam });
  }, [ownedOnly, fetchImagesList, viewParam]);

  // 无限滚动的观察元素
  const loadMoreTriggerRef = useCallback((node: HTMLDivElement | null) => {
    if (isLoading) return;

    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        fetchImagesList({ reset: false, ownedOnly, view: viewParam });
      }
    }, {
      root: scrollContainerRef.current,
      rootMargin: '200px',
      threshold: 0.1
    });

    if (node) observer.current.observe(node);
  }, [isLoading, hasMore, fetchImagesList, ownedOnly, viewParam]);

  return (
    <div className={styles.imagesContent} ref={scrollContainerRef}>
      {images.length === 0 && !isLoading ? (
        <StatePrompt
          message={ownedOnly ? "You Don't Own Any Images" : "No Images Found"}
        />
      ) : (
        <div
          className={styles.waterfallContainer}
          ref={containerRef}
          style={{ height: `${containerHeight}px` }}
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
                  top: `${imagePositions[index].top}px`,
                  left: `${imagePositions[index].left}px`,
                  width: `${card_width_px}px`,
                  height: `${imagePositions[index].height}px`
                }}
              >
                <ImageCard
                    image={image}
                    onVisibilityChange={(updatedImage) => {
                      // 更新本地的图片数据
                      const updatedImages = [...images];
                      updatedImages[index] = updatedImage;

                      // 重新计算布局（这里不需要调整状态，React会响应images变化）
                      imageListState.images = updatedImages;
                      calculateLayout();
                    }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* 加载更多触发元素 */}
      <div ref={loadMoreTriggerRef} className={styles.loadMoreTrigger}></div>

      {isLoading && (
        <StatePrompt message="Loading Images..." showIcon={false} />
      )}

      {error && (
        <StatePrompt
          message="Failed to Load Images"
          action={{
            text: 'Retry',
            onClick: () => fetchImagesList({ reset: false, ownedOnly, view: viewParam })
          }}
        />
      )}
    </div>
  );
};

export default ImagesContent;