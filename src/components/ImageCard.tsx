import React, { useState } from 'react';
import styles from './ImageCard.module.css';
import { Image } from '../store/imageStore';
import avatarSvg from '../assets/Avatar.svg';
import showSvg from '../assets/show.svg';
import hideSvg from '../assets/hidden.svg';
import coverSvg from '../assets/cover.svg';
import { useSetAtom, useAtom } from 'jotai';
import { openImageDetails } from '../store/modalStore';
import { fetchToggleView, fetchEditCover } from '../store/modelStore';
import { showDialogAtom } from '../store/dialogStore';
import { accountAtom } from '../store/accountStore';
import { showToastAtom } from "../store/imagesStore";

interface ImageCardProps {
  image: Image;
  modelOwnerDid?: string; // 添加模型所有者的DID
  onVisibilityChange?: (updatedImage: Image) => void;
  showEditCover?: boolean;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, modelOwnerDid, onVisibilityChange, showEditCover }) => {
  const handleOpenImageDetails = useSetAtom(openImageDetails);
  const [, toggleView] = useAtom(fetchToggleView);
  const [, editCover] = useAtom(fetchEditCover);
  const showDialog = useSetAtom(showDialogAtom);
  const [accountState] = useAtom(accountAtom);
  const showToast = useSetAtom(showToastAtom);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localImage, setLocalImage] = useState(image);

  // 检查是否处理中
  const isPending = localImage.state === 0;
  // 检查是否失败
  const isFailed = localImage.state === -1;
  // 是否可见
  const isPublic = localImage.public === 1;
  // 是否被管理员隐藏
  const isAdminHidden = localImage.public === -1;

  // 检查当前用户是否有权限切换图片可见性
  // 只有管理员或图片创建者或模型所有者可以切换
  const canToggleVisibility =
    accountState.role === 'admin' ||
    (accountState.did && accountState.did === localImage.creator) ||
    (accountState.did && modelOwnerDid && accountState.did === modelOwnerDid);

  // 获取Twitter显示名称
  const getDisplayName = () => {
    if (localImage.users.twitter?.name) {
      return localImage.users.twitter.name;
    } else if (localImage.users.twitter?.username) {
      return localImage.users.twitter.username;
    } else {
      // 如果没有Twitter信息，显示缩略的钱包地址
      return localImage.creator.substring(0, 6) + '...' + localImage.creator.substring(localImage.creator.length - 4);
    }
  };

  // 获取头像URL
  const getAvatarUrl = () => {
    if (localImage.users.twitter?.profilePictureUrl) {
      return localImage.users.twitter.profilePictureUrl;
    } else if (localImage.users.twitter?.username) {
      // 备用方案：如果有username但没有profilePictureUrl，使用第三方服务
      return `https://unavatar.io/twitter/${localImage.users.twitter.username}`;
    } else {
      return avatarSvg;
    }
  };

  const getImagePublicUrl = () => {
    return isPublic ? showSvg : hideSvg;
  }

  const getScaledImageUrl = () => {
    const url = localImage.url
    return `https://ik.imagekit.io/xenoai/niyoko/${url}?tr=w-335,q-90`
  }

  // 只有当图片有URL时才能点击查看详情
  const handleImageClick = () => {
    if (localImage.url) {
      handleOpenImageDetails(localImage);
    }
  };
  const handleCoverClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发图片详情

    const url = localImage.url;
    if (isProcessing || !url) return; // 如果正在处理中，不响应点击

    showDialog({
      open: true,
      message: 'Are you sure you want to set this image as cover?',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      onConfirm: () => {
        setIsProcessing(true); // 设置处理中状态

        // 调用接口，将图片设为私有
        editCover(localImage.model_id, url)
            .then(() => {
              // 根据角色设置新的可见性状态
              const newPublicValue = accountState.role === 'admin' ? -1 : 0;

              // 更新本地图片数据
              const updatedImage = {
                ...localImage,
                public: newPublicValue
              };

              setLocalImage(updatedImage);

              // 如果提供了回调，通知父组件图片已更新
              if (onVisibilityChange) {
                onVisibilityChange(updatedImage);
              }

              // 显示成功提示
              showToast({
                message: 'The image has been successfully set as the cover',
                severity: 'success'
              });
            })
            .catch((error) => {
              console.error('Failed to change visibility:', error);
              showToast({
                message: 'Failed to set cover',
                severity: 'error'
              });
            })
            .finally(() => {
              setIsProcessing(false); // 结束处理状态
            });
      },
      onCancel: () => {},
      confirmButtonColor: '#FF3C3D',
      cancelButtonColor: '#6366F1'
    });

  }
  const handleToggleViewClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发图片详情

    if (isProcessing) return; // 如果正在处理中，不响应点击

    // 如果图片被管理员隐藏，且当前用户不是管理员
    if (isAdminHidden && accountState.role !== 'admin') {
      showDialog({
        open: true,
        message: 'This image has been hidden by administrators. Please contact our community team to restore visibility.',
        confirmText: 'OK',
        cancelText: 'Cancel',
        onConfirm: () => {},
        onCancel: () => {},
        confirmButtonColor: '#6366F1',
        cancelButtonColor: '#6366F1'
      });
      return;
    }

    // 根据当前状态确定切换后的状态
    if (isPublic) {
      showDialog({
        open: true,
        message: 'Are you sure you want to hide this image?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: () => {
          setIsProcessing(true); // 设置处理中状态

          // 调用接口，将图片设为私有
          toggleView('image', localImage.id, false)
            .then(() => {
              // 根据角色设置新的可见性状态
              const newPublicValue = accountState.role === 'admin' ? -1 : 0;

              // 更新本地图片数据
              const updatedImage = {
                ...localImage,
                public: newPublicValue
              };

              setLocalImage(updatedImage);

              // 如果提供了回调，通知父组件图片已更新
              if (onVisibilityChange) {
                onVisibilityChange(updatedImage);
              }

              // 显示成功提示
              showToast({
                message: 'Image has been hidden successfully',
                severity: 'success'
              });
            })
            .catch((error) => {
              console.error('Failed to change visibility:', error);
              showToast({
                message: 'Failed to hide the image. Please try again.',
                severity: 'error'
              });
            })
            .finally(() => {
              setIsProcessing(false); // 结束处理状态
            });
        },
        onCancel: () => {},
        confirmButtonColor: '#FF3C3D',
        cancelButtonColor: '#6366F1'
      });
    } else {
      showDialog({
        open: true,
        message: 'Are you sure you want to make this image visible?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: () => {
          setIsProcessing(true); // 设置处理中状态

          // 调用接口，将图片设为公开
          toggleView('image', localImage.id, true)
            .then(() => {
              // 设置新的可见性状态
              const updatedImage = {
                ...localImage,
                public: 1
              };

              setLocalImage(updatedImage);

              // 如果提供了回调，通知父组件图片已更新
              if (onVisibilityChange) {
                onVisibilityChange(updatedImage);
              }

              // 显示成功提示
              showToast({
                message: 'Image has been made visible successfully',
                severity: 'success'
              });
            })
            .catch((error) => {
              console.error('Failed to change visibility:', error);
              showToast({
                message: 'Failed to make the image visible. Please try again.',
                severity: 'error'
              });
            })
            .finally(() => {
              setIsProcessing(false); // 结束处理状态
            });
        },
        onCancel: () => {},
        confirmButtonColor: '#6366F1',
        cancelButtonColor: '#6366F1'
      });
    }
  }

  return (
    <div className={styles.imageCard} onClick={handleImageClick}>
      <div className={styles.imageContainer}>
        {localImage.url ? (
          <img src={getScaledImageUrl()} alt={`Image ${localImage.id}`} className={styles.image} />
        ) : (
          <div className={styles.placeholderImage}>
            {isFailed ? 'Failed' : 'Generating...'}
          </div>
        )}

        <div className={styles.tagsContainer}>
          {isPending && (
            <div className={styles.pendingTag}>Generating</div>
          )}

          {isFailed && (
            <div className={styles.failedTag}>Failed</div>
          )}
        </div>

        {/* 悬停时显示的半透明黑色遮罩和作者信息 */}
        <div className={styles.overlay}>
          {/* 可见性按钮 - 仅对有权限的用户显示 */}
          {canToggleVisibility && (
            <div className={styles.imagePublicStatus}>
              {isProcessing ? (
                <div className={styles.processingIndicator}>
                  <div className={styles.typingIndicator}>
                    <span></span><span></span><span></span>
                  </div>
                </div>
              ) : (
                <>
                  {showEditCover && (
                      <img
                          src={coverSvg}
                          alt="cover"
                          className="w-7 h-7 mr-2.5"
                          onClick={handleCoverClick}
                      />
                  )}
                  <img
                      src={getImagePublicUrl()}
                      alt={isPublic ? "Visible" : "Hidden"}
                      className={styles.imagePublic}
                      onClick={handleToggleViewClick}
                  />
                </>

              )}
            </div>
          )}
          <div className={styles.creatorInfo}>
            <img
              src={getAvatarUrl()}
              alt="Twitter Avatar"
              className={styles.creatorAvatar}
              onError={(e) => {
                (e.target as HTMLImageElement).src = avatarSvg;
              }}
            />
            <span className={styles.creatorName}>
              {getDisplayName()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCard;