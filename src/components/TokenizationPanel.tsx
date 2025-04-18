import React, {memo, useEffect, useState} from 'react';
import {useAtom, useSetAtom} from 'jotai';
import styles from './TokenizationPanel.module.css';
import {
    fetchTokenizationState,
    FlaunchLaunchTokenResponse,
    FlaunchStatusResponse,
    retryTokenization,
    setModelFlag,
    tokenizationStateAtom,
} from '../store/tokenStore';
import StatePrompt from './StatePrompt';
import copySvg from '../assets/copy_address.svg';
import {accountAtom} from "../store/accountStore.ts";
import {ModelDetail} from '../store/modelStore';
import {showToastAtom} from "../store/imagesStore.ts";
import UniswapWidget from './UniswapWidge.tsx';

interface TokenizationPanelProps {
  model: ModelDetail;
}

// 修改：使用 memo 包装组件，避免不必要的重新渲染
const TokenizationPanel: React.FC<TokenizationPanelProps> = memo(({
   model
}) => {
  const [accountState] = useAtom(accountAtom);
  const showToast = useSetAtom(showToastAtom);
  const [tokenizationState] = useAtom(tokenizationStateAtom);
  const fetchState = useSetAtom(fetchTokenizationState);
  const setTokenizationFlag = useSetAtom(setModelFlag);
  const retryTokenize = useSetAtom(retryTokenization);

  const [isInitiating, setIsInitiating] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const isFlag = model.flag !== null && model.flag !== ""
  const isShowToken = accountState.did === model.creator && !isFlag;

  // 获取训练状态
  const getTrainingStatus = () => {
      const trainState = model.model_tran?.[0]?.train_state;
      if (trainState === 2) {
          return { text: 'Ready', className: styles.statusReady, isReady: true };
      } else {
          return { text: 'Train', className: styles.statusTrain, isReady: false };
      }
  };

  const status = getTrainingStatus();

  // 定期检查 token 化状态
  useEffect(() => {
    // 首次加载时获取状态
    const modelId = model.id
    fetchState({ modelId })
  }, [fetchState, model]);

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
        showToast({
            message: `${label} copy successfully.`,
            severity: 'success'
        });
    });
  };

  // 处理 token 化请求
  const handleTokenize = async () => {
    try {
      setIsInitiating(true);
      // 发起 token 化请求
      const flag = 'tokenization'
      const modelId = model.id
      await setTokenizationFlag({ modelId, flag});

      // 立即获取最新状态
      await fetchState({modelId, refreshState: true});
    } catch (error) {
      console.error('Failed to initiate tokenization:', error);
    } finally {
      setIsInitiating(false);
    }
  };

  // 处理重试请求
  const handleRetry = async () => {
    try {
      setIsRetrying(true);

      // 发起重试请求
      const modelId = model.id
      await retryTokenize({
        modelId,
        creator: "" // 这里可能需要从用户信息中获取
      });

      // 立即获取最新状态
      fetchState({ modelId, refreshState: true });
    } catch (error) {
      console.error('Failed to retry tokenization:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // 渲染 token 化状态
  const renderTokenizationStatus = () => {
    const { data, isLoading, error } = tokenizationState;

    if (isLoading && !data) {
      return <StatePrompt message="Loading tokenization status..." />;
    }

    if (error) {
      return (
        <StatePrompt
          message={`Error: ${error}`}
          action={{
            text: 'Retry',
            onClick: () => fetchState({ modelId: model.id, refreshState: true })
          }}
        />
      );
    }

    // 如果没有数据，显示开始 token 化按钮
    if (!data) {
      if (!status.isReady) {
          return (
              <div className={styles.emptyState}>
                  <p>The model has not yet been trained.</p>
              </div>
          );
      }
      if (isFlag) {
        return (
            <div className={styles.emptyState}>
              <p>This model has been registered, please wait patiently.</p>
            </div>
        );
      }
      if (isShowToken) {
        return (
            <div className={styles.emptyState}>
              <p>This model has not been tokenized yet.</p>
              <button
                  className={styles.tokenizeButton}
                  onClick={handleTokenize}
                  disabled={isInitiating}
              >
                {isInitiating ? 'Initiating...' : 'Tokenize Model'}
              </button>
            </div>
        );
      }
      return (
        <div className={styles.emptyState}>
          <p>This model has not been tokenized yet.</p>
        </div>
      );
    }

    // 检查任务状态
    if ('state' in data && (data.state === 'waiting' || data.state === 'active')) {
      return (
        <div className={styles.processingState}>
          <div className={styles.statusIcon}>
            <div className={styles.spinner}></div>
          </div>
          <h3>Tokenization in Queue</h3>
          <p>Your model is waiting to be tokenized. This process may take some time.</p>
          <div className={styles.statusDetail}>
            <span>Status: {data.state}</span>
          </div>
        </div>
      );
    }

    // 检查是否失败
    if ('state' in data && data.state === 'failed') {
      return (
        <div className={styles.failedState}>
          <div className={styles.statusIcon}>
            <span className={styles.errorIcon}>!</span>
          </div>
          <h3>Tokenization Failed</h3>
          <p>There was an error during the tokenization process.</p>
          <button
            className={styles.retryButton}
            onClick={handleTokenize}
            disabled={isRetrying}
          >
            {isRetrying ? 'Retrying...' : 'Retry Tokenization'}
          </button>
        </div>
      );
    }

    // 检查 Flaunch 状态
    if ('success' in data) {
      // 如果是 FlaunchLaunchTokenResponse
      const fltData = data as FlaunchLaunchTokenResponse;
      if (fltData.jobId) {
        return (
          <div className={styles.processingState}>
            <div className={styles.statusIcon}>
              <div className={styles.spinner}></div>
            </div>
            <h3>Tokenization Processing</h3>
            <p>Your model is being tokenized. This process may take some time.</p>
            {fltData.queueStatus && (
              <div className={styles.queueInfo}>
                <p>Queue Position: {fltData.queueStatus.position || 'Unknown'}</p>
                <p>Waiting Jobs: {fltData.queueStatus.waitingJobs || 'Unknown'}</p>
                <p>Estimated Wait: {fltData.queueStatus.estimatedWaitSeconds ? `${Math.round(fltData.queueStatus.estimatedWaitSeconds / 60)} minutes` : 'Unknown'}</p>
              </div>
            )}
          </div>
        );
      }

      // 如果是 FlaunchStatusResponse
      const statusData = data as FlaunchStatusResponse;

      // 修改 renderTokenizationStatus 函数中的完成状态部分
      if (statusData.state === 'completed' && statusData.collectionToken) {
        const token = 
            {
                "name": statusData.collectionToken.name,
                "address": statusData.collectionToken.address,
                "symbol": statusData.collectionToken.symbol,
                "decimals": 18,
                "chainId": 8453,
                "logoURI": statusData.collectionToken.imageIpfs
            }
        console.log(token);
        return (
          <div className={styles.completedState}>
            <div className={styles.tokenInfo}>
              <div className={styles.tokenInfoContent}>
                <div className={styles.tokenInfoItem}>
                  <span className={styles.tokenInfoLabel}>Name</span>
                  <span className={styles.tokenInfoValue}>{statusData.collectionToken.name}</span>
                </div>

                <div className={styles.tokenInfoDivider}></div>

                <div className={styles.tokenInfoItem}>
                  <span className={styles.tokenInfoLabel}>Symbol</span>
                  <span className={styles.tokenInfoValue}>{statusData.collectionToken.symbol}</span>
                </div>

                <div className={styles.tokenInfoDivider}></div>

                <div className={styles.tokenInfoItem}>
                  <span className={styles.tokenInfoLabel}>Creator</span>
                  <div className={styles.addressContainer}>
                    <span className={styles.tokenInfoValue}>{formatAddress(statusData.collectionToken.creator)}</span>
                    <img
                      src={copySvg}
                      alt="Copy"
                      className={styles.copyIcon}
                      onClick={() => copyToClipboard(statusData?.collectionToken?.creator ?? "", "Creator address")}
                    />
                  </div>
                </div>

                <div className={styles.tokenInfoDivider}></div>

                <div className={styles.tokenInfoItem}>
                  <span className={styles.tokenInfoLabel}>Address</span>
                  <div className={styles.addressContainer}>
                    <span className={styles.tokenInfoValue}>{formatAddress(statusData.collectionToken.address)}</span>
                    <img
                      src={copySvg}
                      alt="Copy"
                      className={styles.copyIcon}
                      onClick={() => copyToClipboard(statusData?.collectionToken?.address ?? "", "Token address")}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 添加两个 iframe 容器 */}
            <div className={styles.iframeContainer}>
                <div className={styles.leftIframeWrapper}>
                    <iframe
                        height="100%" width="100%"
                        id="geckoterminal-embed"
                        title="GeckoTerminal Embed"
                        src={`https://www.geckoterminal.com/base/pools/${statusData.collectionToken.address}?embed=1&info=0&swaps=0&grayscale=0&light_chart=0&chart_type=price&resolution=15m`}
                        frameBorder="0"
                        allow="clipboard-write"
                        allowFullScreen>
                    </iframe>
                </div>
                <div className={`${styles.rightIframeWrapper} Uniswap`}>
                   <UniswapWidget token={token} />
                </div>
            </div>
          </div>
        );
      }

        if (statusData.state === 'processing' || !statusData.state) {
            return (
                <div className={styles.processingState}>
                <div className={styles.statusIcon}>
              <div className={styles.spinner}></div>
            </div>
            <h3>Tokenization Processing</h3>
            <p>Your model is being tokenized on the blockchain.</p>
            {statusData.queuePosition !== undefined && (
              <p>Queue Position: {statusData.queuePosition}</p>
            )}
            {statusData.estimatedWaitTime !== undefined && (
              <p>Estimated Wait: {Math.round(statusData.estimatedWaitTime / 60)} minutes</p>
            )}
          </div>
        );
      }

      if (statusData.error) {
        return (
          <div className={styles.failedState}>
            <div className={styles.statusIcon}>
              <span className={styles.errorIcon}>!</span>
            </div>
            <h3>Tokenization Failed</h3>
            <p>{statusData.error}</p>
            <button
              className={styles.retryButton}
              onClick={handleRetry}
              disabled={isRetrying}
            >
              {isRetrying ? 'Retrying...' : 'Retry Tokenization'}
            </button>
          </div>
        );
      }
    }

    // 默认状态
    return (
      <div className={styles.unknownState}>
        <p>Tokenization status: Unknown</p>
        <button
          className={styles.refreshButton}
          onClick={() => fetchState({ modelId: model.id, refreshState: true })}
        >
          Refresh Status
        </button>
      </div>
    );
  };

  return (
    <div className={styles.tokenizationPanel}>
      {renderTokenizationStatus()}
    </div>
  );
});

export default TokenizationPanel;