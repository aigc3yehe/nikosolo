import React from "react";
import { useAtom, useSetAtom } from "jotai";
import { accountAtom } from "../store/accountStore";
import { showGeneratePopupAtom } from "../store/generatePopupStore";
import styles from "./ModelInfoPanel.module.css";
import avatarSvg from "../assets/Avatar.svg";
import twitterSvg from "../assets/twitter.svg";
import createSvg from "../assets/create.svg";
import shareSvg from "../assets/share.svg";
import coinsSvg from "../assets/coins.svg";
import dexSvg from "../assets/dex.svg";
import virtualsIcon from "../assets/virtuals.svg";
import flaunchIcon from "../assets/flaunch.png";
import codeSvg from "../assets/code.svg";
import { ModelDetail, TOKENIZATION_LAUNCHPAD_TYPE } from "../store/modelStore";
import {
  fetchTokenizationState,
  setModelFlag,
  tokenizationStateAtom,
  FlaunchStatusResponse,
} from "../store/tokenStore";
import { usePrivy } from "@privy-io/react-auth";
import { Link } from "react-router-dom";
import { GENERATE_IMAGE_SERVICE_CONFIG } from "../utils/plan";

interface ModelInfoPanelProps {
  model: ModelDetail;
}

const ModelInfoPanel: React.FC<ModelInfoPanelProps> = ({ model }) => {
  const [accountState] = useAtom(accountAtom);
  const showGeneratePopup = useSetAtom(showGeneratePopupAtom);
  const setTokenizationFlag = useSetAtom(setModelFlag);
  const fetchState = useSetAtom(fetchTokenizationState);
  const [tokenizationState] = useAtom(tokenizationStateAtom);
  const { data } = tokenizationState;
  const { user } = usePrivy();

  // 检查当前用户是否是模型创建者
  const isFlag = model.flag !== null && model.flag !== "";
  const isShowToken = accountState.did === model.creator && !isFlag;

  // 获取Twitter显示名称
  const getDisplayName = () => {
    if (model.users.twitter?.name) {
      return model.users.twitter.name;
    } else if (model.users.twitter?.username) {
      return model.users.twitter.username;
    } else {
      // 如果没有Twitter信息，显示缩略的钱包地址
      return (
        model.creator.substring(0, 6) +
        "..." +
        model.creator.substring(model.creator.length - 4)
      );
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
    return date
      .toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, ".");
  };

  // 获取LoraName
  const getLoraName = () => {
    return model.model_tran?.[0]?.lora_name || "Unknown";
  };

  // 获取训练状态
  const getTrainingStatus = () => {
    const trainState = model.model_tran?.[0]?.train_state;
    if (trainState === 2) {
      return { text: "Ready", className: styles.statusReady, isReady: true };
    } else {
      // 计算训练已经进行的时间（小时）
      const submittedTime = new Date(model.created_at);
      const currentTime = new Date();
      const elapsedHours =
        (currentTime.getTime() - submittedTime.getTime()) / (1000 * 60 * 60);

      // 根据已用时间确定训练阶段
      let statusText = "";
      if (elapsedHours <= 0.5) {
        statusText = "Processing training materials";
      } else if (elapsedHours <= 1) {
        statusText = "Generating parameter tags";
      } else {
        statusText = "Training in progress";
      }

      // 计算预估剩余时间
      const totalTrainingHours = 5; // 总训练时间为5小时
      const remainingHours = totalTrainingHours - elapsedHours;
      let etaText = "";

      if (remainingHours <= 0) {
        etaText = "(finishing)";
      } else {
        // 使用4舍5入来显示小时数
        const roundedHours = Math.round(remainingHours);

        if (roundedHours === 0) {
          etaText = "(finishing)";
        } else {
          etaText = `(ETA ${roundedHours} hour${roundedHours > 1 ? "s" : ""})`;
        }
      }

      return {
        text: statusText,
        eta: etaText,
        className: styles.statusTrain,
        isReady: false,
      };
    }
  };

  const status = getTrainingStatus();

  const handleGenerate = () => {
    // 打开生成弹窗，传入模型信息
    showGeneratePopup(accountState.did, model);
  };

  // 点击分享按钮触发x的分享
  const handleShare = () => {
    // 1. 获取当前页面URL并构建设模型链接
    const currentUrl = window.location.href;
    const modelLinkUrl = new URL(currentUrl);
    // 确保分享链接是模型详情页的基础链接，不包含其他可能存在的查询参数，然后添加模型ID和名称
    const baseUrl = `${modelLinkUrl.protocol}//${modelLinkUrl.host}${modelLinkUrl.pathname}`;
    const shareUrl = new URL(baseUrl);
    shareUrl.searchParams.set("model_id", model.id.toString());
    shareUrl.searchParams.set("model_name", model.name);
    const modelLink = shareUrl.toString();

    // 修改 renderTokenizationStatus 函数中的完成状态部分
    let symbol = "";
    if (data && "success" in data && "state" in data) {
      // 如果是 FlaunchStatusResponse
      const statusData = data as FlaunchStatusResponse;
      if (statusData.state === "completed" && statusData.collectionToken) {
        symbol = statusData.collectionToken.symbol;
      }
    }

    console.log(symbol);

    // 2. 根据是否有代币确定分享文本
    let tweetText = "";
    const modelName = model.name;

    if (symbol) {
      tweetText = `This style is insane!\n${modelName} is an amazing AI model I found on @niyoko_agent \nit even has its own token $${symbol}\nCome create and trade with me!\n${modelLink}`;
    } else {
      tweetText = `This style is insane!\n${modelName} is an amazing AI model I found on @niyoko_agent \nCome create and mine with me!\n${modelLink}`;
    }

    // 3. 构建 Twitter Intent URL
    const encodedTweetText = encodeURIComponent(tweetText);
    const twitterUrl = `https://x.com/intent/post?text=${encodedTweetText}`;

    // 4. 在新标签页中打开 Twitter 分享链接
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleToken = async () => {
    // 发起 token 化请求
    const flag = "tokenization";
    const modelId = model.id;
    await setTokenizationFlag({ modelId, flag, user: user?.id || "" });

    // 立即获取最新状态
    await fetchState({ modelId, refreshState: true });
  };

  const handleTwitterClick = () => {
    console.log("Twitter clicked");
    // 实现Twitter点击功能
    if (model.users.twitter?.username) {
      window.open(
        `https://twitter.com/${model.users.twitter?.username}`,
        "_blank"
      );
    } else {
      console.log("No Twitter username found");
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
            <img
              src={twitterSvg}
              alt="Twitter"
              className={styles.twitterIcon}
            />
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
          <span className={styles.detailValue}>
            {formatCreationTime(model.created_at)}
          </span>
        </div>

        {/* Status */}
        <div className={`${styles.detailRow} ${styles.lastRow}`}>
          <span className={styles.detailLabel}>Status</span>
          <span className={`${styles.detailValue} ${status.className}`}>
            {status.text}
          </span>
        </div>
      </div>

      {/* 按钮组 */}
      <div className={styles.actionButtonsContainer}>
        {status.isReady ? (
          <>
            {/* Ready状态下的生成按钮 */}
            <button className={styles.generateButton} onClick={handleGenerate}>
              <img
                src={createSvg}
                alt="Generate"
                className={styles.buttonIcon}
              />
              <div className="flex items-end gap-[1px]">
                <span>Generate</span>
                <span className="!text-xs">
                  ({GENERATE_IMAGE_SERVICE_CONFIG.cu} Credits)
                </span>
              </div>
            </button>

            {/* 分享按钮 */}
            <button className={styles.shareButton} onClick={handleShare}>
              <img src={shareSvg} alt="Share" className={styles.buttonIcon} />
            </button>

            {/* Token按钮 - 仅当用户是模型创建者时显示 */}
            {isShowToken && (
              <button className={styles.mintButton} onClick={handleToken}>
                <img src={coinsSvg} alt="Token" className={styles.buttonIcon} />
              </button>
            )}

            {/* Token按钮 - Dexscreener 跳转 */}
            {model?.model_tokenization?.meme_token && (
              <Link
                target="_blank"
                to={`https://dexscreener.com/base/${model.model_tokenization.meme_token}`}
              >
                <button className={styles.dexButton}>
                  <img
                    src={dexSvg}
                    alt="Dexscreener"
                    className={styles.buttonIcon}
                  />
                </button>
              </Link>
            )}
            {/* Token按钮 - Flaunch 跳转 */}
            {model?.model_tokenization?.meme_token && (
              <Link
                target="_blank"
                to={
                  model?.model_tokenization?.launchpad ==
                  TOKENIZATION_LAUNCHPAD_TYPE.VIRTUALS
                    ? `https://app.virtuals.io/virtuals/${model.model_tokenization.metadata?.virtuals_id}`
                    : `https://flaunch.gg/base/coin/${model.model_tokenization.meme_token}`
                }
              >
                <button
                  className={
                    model?.model_tokenization?.launchpad ==
                    TOKENIZATION_LAUNCHPAD_TYPE.VIRTUALS
                      ? styles.virtualsButton
                      : styles.flaunchButton
                  }
                >
                  <img
                    src={
                      model?.model_tokenization?.launchpad ==
                      TOKENIZATION_LAUNCHPAD_TYPE.VIRTUALS
                        ? virtualsIcon
                        : flaunchIcon
                    }
                    alt="Launchpad"
                    className={styles.buttonIcon}
                  />
                </button>
              </Link>
            )}
          </>
        ) : (
          <>
            {/* 训练中状态按钮 */}
            <button className={styles.trainingButton} disabled>
              <img src={codeSvg} alt="Code" className={styles.buttonIcon} />
              <span>Training... {status.eta}</span>
            </button>

            {/* 分享按钮 */}
            <button className={styles.shareButton} onClick={handleShare}>
              <img src={shareSvg} alt="Share" className={styles.buttonIcon} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ModelInfoPanel;
