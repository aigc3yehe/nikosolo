import React, { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import {
  fetchTopTokens,
  tokenMarqueeStateAtom,
} from "../store/tokenMarqueeStore";
import { modelIdAndNameAtom } from "../store/modelStore";
import styles from "./TokenMarquee.module.css";
import BaseChainIcon from "../assets/base.svg";
import { useNavigate } from "react-router-dom";

// 格式化价格函数
const formatPrice = (price: string): string => {
  const numValue = parseFloat(price);

  if (numValue >= 1000000) {
    return `${(numValue / 1000000).toFixed(2)}M`;
  } else if (numValue >= 1000) {
    return `${(numValue / 1000).toFixed(2)}K`;
  }

  return numValue.toFixed(2);
};

// 处理IPFS图片URL
const getImageUrl = (logoURI: string): string => {
  if (!logoURI) return "";
  if (logoURI.startsWith("ipfs://")) {
    const ipfsHash = logoURI.replace("ipfs://", "");
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  }

  const isIPFS = logoURI.startsWith("Qm");
  if (isIPFS) {
    return `https://gateway.pinata.cloud/ipfs/${logoURI}`;
  }

  return `https://ik.imagekit.io/xenoai/niyoko/${logoURI}?tr=w-32,q-90`;
};

const TokenMarquee: React.FC = () => {
  const [tokenState] = useAtom(tokenMarqueeStateAtom);
  const [, getTopTokens] = useAtom(fetchTopTokens);
  const [isHovered, setIsHovered] = useState(false);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [, setModelIdAndName] = useAtom(modelIdAndNameAtom);

  useEffect(() => {
    // 组件挂载时获取数据
    getTopTokens();

    // 每隔60秒刷新一次数据
    const interval = setInterval(() => {
      getTopTokens();
    }, 60000);

    return () => clearInterval(interval);
  }, [getTopTokens]);

  // 处理点击模型详情
  const handleTokenClick = (modelId: number | string, modelName: string) => {
    // 设置全局模型ID和名称状态
    setModelIdAndName({
      modelId:
        typeof modelId === "string"
          ? parseInt(modelId as string, 10)
          : (modelId as number),
      modelName,
    });

    // 导航到首页(确保我们在正确的路由)
    navigate("/");
  };

  // 渲染内容基于状态
  const renderContent = () => {
    // 初始加载中且没有数据
    if (tokenState.isLoading && tokenState.tokens.length === 0) {
      return <div className={styles.loadingContainer}>loading...</div>;
    }

    // 有错误且没有数据可显示
    if (tokenState.error && tokenState.tokens.length === 0) {
      return (
        <div className={styles.errorContainer}>Be right back, stay tuned!</div>
      );
    }

    // 有数据可显示（无论是否有错误或正在加载）
    return (
      <div
        className={`${styles.tokensContainer} ${
          isHovered ? styles.paused : ""
        }`}
      >
        {tokenState.tokens.map((token) => (
          <div
            key={`${token.model_id}-${token.token_symbol}`}
            className={styles.tokenItem}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => handleTokenClick(token.model_id, token.model_name)}
          >
            <div className={styles.tokenIconWrapper}>
              <img
                src={getImageUrl(token.token_base_uri)}
                alt={token.token_symbol}
                className={styles.tokenIcon}
                onError={(e) => {
                  // 图片加载失败时使用默认样式
                  (e.target as HTMLImageElement).style.background = "#37415180";
                }}
              />
              <img
                src={BaseChainIcon}
                className={styles.baseChainIcon}
                alt="base chain"
              />
            </div>
            <span className={styles.tokenSymbol}>{token.token_symbol}</span>
            <span className={styles.tokenPrice}>
              ${formatPrice(token.mc_usd)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={styles.tokenMarquee}>
      <div className={styles.titleSection}>
        <span className={styles.fireEmoji}>🔥</span>
        <span className={styles.titleText}>Top Coins</span>
      </div>

      <div className={styles.marqueeContainer} ref={marqueeRef}>
        {renderContent()}
      </div>
    </div>
  );
};

export default TokenMarquee;
