import React from 'react';
import styles from './ModelCard.module.css';
import { Model } from '../store/modelStore';
import avatarSvg from '../assets/Avatar.svg';
import usageSvg from '../assets/usage.svg';

interface ModelCardProps {
  model: Model;
}

const ModelCard: React.FC<ModelCardProps> = ({ model }) => {
  // 格式化数字，每三位添加逗号
  const formatNumber = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // 检查是否在训练中
  const isTraining = model.model_tran[0]?.train_state === 0 || model.model_tran[0]?.train_state === 1;
  // isTokenization
  // const isTokenization = model.model_tran[0]?.train_state === 2 && model.model_tokenization;

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
      // 备用方案：如果有username但没有profilePictureUrl，使用第三方服务
      return `https://unavatar.io/twitter/${model.users.twitter.username}`;
    } else {
      return avatarSvg;
    }
  };

  return (
    <div className={styles.modelCard}>
      <div className={styles.modelCover}>
        <img src={model.cover} alt={model.name} />

        <div className={styles.tagsContainer}>
          {isTraining && (
            <div className={styles.trainingTag}>
              Training
            </div>
          )}

          {/*isTokenization && (
            <>
              <div className={styles.completedTag}>${model.model_tokenization?.metadata?.name ?? 'Token'}</div>
            </>
          )*/}
        </div>
      </div>

      <div className={styles.modelInfo}>
        <h3 className={styles.modelName}>{model.name}</h3>

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
            <span className={styles.usageCount}>{formatNumber(model.usage)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelCard;