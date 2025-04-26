import React, { useState } from 'react';
import styles from './ModelCard.module.css';
import { Model, fetchToggleView } from '../store/modelStore';
import avatarSvg from '../assets/Avatar.svg';
import usageSvg from '../assets/usage.svg';
import showSvg from '../assets/show.svg';
import hideSvg from '../assets/hidden.svg';
import { useSetAtom, useAtom } from 'jotai';
import { showDialogAtom } from '../store/dialogStore';
import { accountAtom } from '../store/accountStore';
import { showToastAtom } from "../store/imagesStore";

interface ModelCardProps {
  model: Model;
}

const ModelCard: React.FC<ModelCardProps> = ({ model }) => {
  const [accountState] = useAtom(accountAtom);
  const [, toggleView] = useAtom(fetchToggleView);
  const showDialog = useSetAtom(showDialogAtom);
  const showToast = useSetAtom(showToastAtom);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localModel, setLocalModel] = useState(model);

  // 从model中获取可见性状态
  const isPublic = localModel.public === 1;
  const isAdminHidden = localModel.public === -1;

  // 检查当前用户是否有权限切换模型可见性
  // 只有管理员或模型创建者可以切换
  const canToggleVisibility =
    accountState.role === 'admin' ||
    (accountState.did && accountState.did === localModel.creator);

  // 格式化数字，每三位添加逗号
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // 检查是否在训练中
  const isTraining = localModel.model_tran[0]?.train_state === 0 || localModel.model_tran[0]?.train_state === 1;
  // isTokenization
  const isTokenization = localModel.model_tran[0]?.train_state === 2 && localModel.model_tokenization;

  // 获取Twitter显示名称
  const getDisplayName = () => {
    if (localModel.users.twitter?.name) {
      return localModel.users.twitter.name;
    } else if (localModel.users.twitter?.username) {
      return localModel.users.twitter.username;
    } else {
      // 如果没有Twitter信息，显示缩略的钱包地址
      return localModel.creator.substring(0, 6) + '...' + localModel.creator.substring(localModel.creator.length - 4);
    }
  };

  // 获取头像URL
  const getAvatarUrl = () => {
    if (localModel.users.twitter?.profilePictureUrl) {
      return localModel.users.twitter.profilePictureUrl;
    } else if (localModel.users.twitter?.username) {
      // 备用方案：如果有username但没有profilePictureUrl，使用第三方服务
      return `https://unavatar.io/twitter/${localModel.users.twitter.username}`;
    } else {
      return avatarSvg;
    }
  };

  // 获取可见性图标
  const getVisibilityIcon = () => {
    return isPublic ? showSvg : hideSvg;
  };

  // 处理可见性切换事件
  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发模型点击

    if (isProcessing) return; // 如果正在处理中，不响应点击

    // 如果模型被管理员隐藏，且当前用户不是管理员
    if (isAdminHidden && accountState.role !== 'admin') {
      showDialog({
        open: true,
        message: 'This model has been hidden by administrators. Please contact our community team to restore visibility.',
        confirmText: 'OK',
        cancelText: 'Cancel',
        onConfirm: () => {},
        onCancel: () => {},
        confirmButtonColor: '#6366F1',
        cancelButtonColor: '#6366F1'
      });
      return;
    }

    if (isPublic) {
      showDialog({
        open: true,
        message: 'Are you sure you want to hide this model?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: () => {
          setIsProcessing(true); // 设置处理中状态

          // 调用接口，将模型设为私有
          toggleView('model', localModel.id, false)
            .then(() => {
              // 根据角色设置新的可见性状态
              const newPublicValue = accountState.role === 'admin' ? -1 : 0;

              // 更新本地模型数据
              setLocalModel({
                ...localModel,
                public: newPublicValue
              });

              // 显示成功提示
              showToast({
                message: 'Model has been hidden successfully',
                severity: 'success'
              });
            })
            .catch((error) => {
              console.error('Failed to change visibility:', error);
              showToast({
                message: 'Failed to hide the model. Please try again.',
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
        message: 'Are you sure you want to make this model visible?',
        confirmText: 'Confirm',
        cancelText: 'Cancel',
        onConfirm: () => {
          setIsProcessing(true); // 设置处理中状态

          // 调用接口，将模型设为公开
          toggleView('model', localModel.id, true)
            .then(() => {
              // 设置新的可见性状态
              setLocalModel({
                ...localModel,
                public: 1
              });

              // 显示成功提示
              showToast({
                message: 'Model has been made visible successfully',
                severity: 'success'
              });
            })
            .catch((error) => {
              console.error('Failed to change visibility:', error);
              showToast({
                message: 'Failed to make the model visible. Please try again.',
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
  };

  return (
    <div className={styles.modelCard}>
      <div className={styles.modelCover}>
        <img src={localModel.cover} alt={localModel.name} />

        <div className={styles.tagsContainer}>
          {isTraining && (
            <div className={styles.trainingTag}>
              Training
            </div>
          )}

          {isTokenization && (
            <>
              <div className={styles.completedTag}>${localModel.model_tokenization?.metadata?.name ?? 'Token'}</div>
            </>
          )}
        </div>
      </div>

      <div className={styles.modelInfo}>
        <h3 className={styles.modelName}>{localModel.name}</h3>

        <div className={styles.modelMeta}>
          <div className={styles.twitterInfo}>
            <img
              src={getAvatarUrl()}
              alt="Avatar"
              className={styles.twitterAvatar}
              onError={(e) => {
                (e.target as HTMLImageElement).src = avatarSvg;
              }}
            />
            <span className={styles.twitterName}>
              {getDisplayName()}
            </span>
          </div>

          <div className={styles.usageInfo}>
            <img src={usageSvg} alt="Usage" className={styles.usageIcon} />
            <span className={styles.usageCount}>{formatNumber(localModel.usage)}</span>
          </div>
        </div>
      </div>

      {/* 只有有权限的用户才能看到遮罩层和可见性控制 */}
      {canToggleVisibility && (
        <div className={`${styles.overlay} ${isProcessing ? styles.showOverlay : ''}`}>
          {/* 加载中显示在卡片正中间 */}
          {isProcessing ? (
            <div className={styles.processingIndicator}>
              <div className={styles.typingIndicator}>
                <span></span><span></span><span></span>
              </div>
            </div>
          ) : (
            /* 添加可见性切换按钮 */
            <div className={styles.visibilityControl} onClick={handleToggleVisibility}>
              <img
                src={getVisibilityIcon()}
                alt={isPublic ? "Visible" : "Hidden"}
                className={styles.visibilityIcon}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelCard;