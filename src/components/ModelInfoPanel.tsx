import React from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { accountAtom } from '../store/accountStore';
import { showGeneratePopupAtom } from '../store/generatePopupStore';
import styles from './ModelInfoPanel.module.css';
import avatarSvg from '../assets/Avatar.svg';
import twitterSvg from '../assets/twitter.svg';
import createSvg from '../assets/create.svg';
import shareSvg from '../assets/share.svg';
import coinsSvg from '../assets/coins.svg';
import codeSvg from '../assets/code.svg';
import { ModelDetail } from '../store/modelStore';
import {
  fetchTokenizationState,
  setModelFlag
} from '../store/tokenStore';
import {showToastAtom} from "../store/imagesStore.ts";

interface ModelInfoPanelProps {
  model: ModelDetail;
}

const ModelInfoPanel: React.FC<ModelInfoPanelProps> = ({ model }) => {
  const [accountState] = useAtom(accountAtom);
  const showToast = useSetAtom(showToastAtom);
  const showGeneratePopup = useSetAtom(showGeneratePopupAtom);
  const setTokenizationFlag = useSetAtom(setModelFlag);
  const fetchState = useSetAtom(fetchTokenizationState);

  // 检查当前用户是否是模型创建者
  // const isFlag = model.flag !== null && model.flag !== ""
  // const isShowToken = accountState.did === model.creator && !isFlag;
  const isShowToken = false;

  // 获取Twitter显示名称
  const getDisplayName = () => {
    if (model.users.twitter?.name) {
      return model.users.twitter.name;
    } else if (model.users.twitter?.username) {
      return model.users.twitter.username;
    } else {
      // 如果没有Twitter信息，显示缩略的钱包地址
      return model.creator.substring(0, 6) + '...' + model.creator.substring(model.creator.length - 4);
    }
  };

  // 获取头像URL
  const getAvatarUrl = () => {
    if (model.users.twitter?.profilePictureUrl) {
      return model.users.twitter.profilePictureUrl;
    } else if (model.users.twitter?.username) {
      // 备用方案
      return `https://unavatar.io/twitter/${model.users.twitter.username}`;
    } else {
      return avatarSvg;
    }
  };

  // 格式化时间
  const formatCreationTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).replace(/\//g, '.');
  };

  // 获取LoraName
  const getLoraName = () => {
    return model.model_tran?.[0]?.lora_name || 'Unknown';
  };

  // 获取训练状态
  const getTrainingStatus = () => {
    const trainState = model.model_tran?.[0]?.train_state;
    if (trainState === 2) {
      return { text: 'Ready', className: styles.statusReady, isReady: true };
    } else {
      return { text: 'Training', className: styles.statusTrain, isReady: false };
    }
  };

  const status = getTrainingStatus();

  const handleGenerate = () => {
    // 打开生成弹窗，传入模型信息
    showGeneratePopup(accountState.did, model);
  };

  const handleShare = () => {
    // 获取当前页面URL
    const currentUrl = window.location.href;

    // 确保URL包含模型ID和名称参数
    const url = new URL(currentUrl);
    url.searchParams.set('model_id', model.id.toString());
    url.searchParams.set('model_name', model.name);

    // 复制到剪贴板
    navigator.clipboard.writeText(url.toString())
      .then(() => {
        // 显示英文提示
        showToast({
          message: 'Link copied to clipboard! You can now share it with others.',
          severity: 'success'
        });
      })
      .catch(err => {
        console.error('Failed to copy URL: ', err);
        showToast({
          message: 'Failed to copy link. Please try again.',
          severity: 'error'
        });
      });
  };

  const handleToken = async () => {
    // 发起 token 化请求
    const flag = 'tokenization'
    const modelId = model.id;
    await setTokenizationFlag({ modelId, flag});

    // 立即获取最新状态
    await fetchState({modelId, refreshState: true});
  };

  const handleTwitterClick = () => {
    console.log('Twitter clicked');
    // 实现Twitter点击功能
    if (model.users.twitter?.username) {
      window.open(`https://twitter.com/${model.users.twitter?.username}`, '_blank');
    } else {
      console.log('No Twitter username found');
    }
  };

  return (
    <div className={styles.infoPanel}>
      {/* 第一行: 创建者信息 */}
      <div className={styles.creatorHeader}>
        <div className={styles.creatorInfo}>
          <img
            src={getAvatarUrl()}
            alt="Creator Avatar"
            className={styles.creatorAvatar}
            onError={(e) => {
              (e.target as HTMLImageElement).src = avatarSvg;
            }}
          />
          <span className={styles.creatorName}>{getDisplayName()}</span>
        </div>

        {model.users.twitter && (
          <button className={styles.twitterButton} onClick={handleTwitterClick}>
            <img src={twitterSvg} alt="Twitter" className={styles.twitterIcon} />
          </button>
        )}
      </div>

      {/* 第二行: 模型详细信息 */}
      <div className={styles.modelDetailsContainer}>
        {/* Type */}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Type</span>
          <span className={styles.detailValue}>Lora</span>
        </div>

        {/* Keyword (Lora Name) */}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Keyword</span>
          <span className={styles.detailValue}>{getLoraName()}</span>
        </div>

        {/* Used */}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Used</span>
          <span className={styles.detailValue}>{model.usage}</span>
        </div>

        {/* Published */}
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Published</span>
          <span className={styles.detailValue}>{formatCreationTime(model.created_at)}</span>
        </div>

        {/* Status */}
        <div className={`${styles.detailRow} ${styles.lastRow}`}>
          <span className={styles.detailLabel}>Status</span>
          <span className={`${styles.detailValue} ${status.className}`}>{status.text}</span>
        </div>
      </div>

      {/* 按钮组 */}
      <div className={styles.actionButtonsContainer}>
        {status.isReady ? (
          <>
            {/* Ready状态下的生成按钮 */}
            <button
              className={styles.generateButton}
              onClick={handleGenerate}
            >
              <img src={createSvg} alt="Generate" className={styles.buttonIcon} />
              <span>Generate</span>
            </button>

            {/* 分享按钮 */}
            <button
              className={styles.shareButton}
              onClick={handleShare}
            >
              <img src={shareSvg} alt="Share" className={styles.buttonIcon} />
            </button>

            {/* Token按钮 - 仅当用户是模型创建者时显示 */}
            {isShowToken && (
              <button
                className={styles.mintButton}
                onClick={handleToken}
              >
                <img src={coinsSvg} alt="Token" className={styles.buttonIcon} />
              </button>
            )}
          </>
        ) : (
          <>
            {/* 训练中状态按钮 */}
            <button
              className={styles.trainingButton}
              disabled
            >
              <img src={codeSvg} alt="Code" className={styles.buttonIcon} />
              <span>Training...</span>
            </button>

            {/* 分享按钮 */}
            <button
              className={styles.shareButton}
              onClick={handleShare}
            >
              <img src={shareSvg} alt="Share" className={styles.buttonIcon} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelInfoPanel;