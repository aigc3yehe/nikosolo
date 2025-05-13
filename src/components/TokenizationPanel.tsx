import React, {memo, useEffect, useState} from 'react';
import {useAtom, useSetAtom} from 'jotai';
import styles from './TokenizationPanel.module.css';
import {
    fetchTokenizationState,
    FlaunchLaunchTokenResponse,
    FlaunchStatusResponse,
    setModelFlag,
    tokenizationStateAtom,
} from '../store/tokenStore';
import StatePrompt from './StatePrompt';
import copySvg from '../assets/copy_address.svg';
import infoSvg from '../assets/info.svg';
import linkSvg from '../assets/link.svg';
import {accountAtom} from "../store/accountStore.ts";
import {ModelDetail} from '../store/modelStore';
import {showToastAtom} from "../store/imagesStore.ts";
import SwapWidgetCustom from './SwapWidgetCustom.tsx';
import { usePrivy } from '@privy-io/react-auth';
import {setModelStatus} from "../store/chatStore.ts";

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

  const setModelStatusInChat = useSetAtom(setModelStatus);
  const [onlyCommunityTokens, setOnlyCommunityTokens] = useState<boolean>(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const { user } = usePrivy();

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

  const community_tokens = model.model_community_tokenization;
  const has_community_tokens = community_tokens && community_tokens.length > 0;

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

  // 监听当前模型变化，更新聊天存储中的当前模型(模型Ready的时候才更新)
  useEffect(() => {
      const data = tokenizationState.data
      if (data) {
          setModelStatusInChat("tokenized")
      } else {
          if (status.isReady) {
              // setModelStatusInChat("not_ready")
              setModelStatusInChat("ready")
          } else {
              setModelStatusInChat("not_ready")
          }
      }

  }, [tokenizationState, setModelStatusInChat, status.isReady, isFlag]);

  // 判断是否只显示 community tokens
  useEffect(() => {
     const data = tokenizationState.data;
     if (!data) {
         setOnlyCommunityTokens((model.model_community_tokenization?.length || 0) > 0);
     } else {
         setOnlyCommunityTokens(false);
     }
  }, [tokenizationState, model.model_community_tokenization]);

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
      await setTokenizationFlag({ modelId, flag, user: user?.id || '' });

      // 立即获取最新状态
      await fetchState({modelId, refreshState: true});
    } catch (error) {
      console.error('Failed to initiate tokenization:', error);
    } finally {
      setIsInitiating(false);
    }
  };

  // 渲染community tokens
  const renderCommunityTokens = () => {
    return <div className="w-full pt-3.5 pb-3.5 pl-7 pr-7 flex flex-wrap items-center gap-5 rounded border border-[#3741514D]
                bg-gradient-to-r from-[rgba(31, 41, 55, 0.2)] to-[rgba(63, 79, 103, 0.2)] backdrop-blur-[1.25rem]">
            <div className="flex gap-1.5 items-center justify-center">
                <img
                    src={infoSvg}
                    alt="info"
                    className="w-4 h-4"
                />
                <span className="font-jura font-medium text-sm leading-none tracking-normal align-middle capitalize text-white">
                   Community token
                </span>
            </div>

            {community_tokens?.map((token) => {
                return (
                    <div className="flex gap-1 items-center justify-center cursor-pointer" onClick={() => {}}>
                        <span className="font-jura font-normal text-sm leading-none tracking-normal align-middle capitalize text-[#6366F1]">
                            ${token.metadata?.name}
                        </span>
                        <img
                            src={linkSvg}
                            alt="link"
                            className="w-3.5 h-3.5"/>
                    </div>
                )
            })}
        </div>
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
                "logoURI": statusData.collectionToken.imageIpfs,
                "isV1Token": !!statusData.collectionToken?.isV1Token
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
                    <span className={styles.tokenInfoValue}>{getDisplayName()}</span>
                  </div>
                </div>

                <div className={styles.tokenInfoDivider}></div>

                {
                  model?.model_tokenization?.deployer && (
                    <>
                    <div className={styles.tokenInfoItem}>
                      <span className={styles.tokenInfoLabel}>Deployer</span>
                      <div className={styles.addressContainer}>
                        <span className={styles.tokenInfoValue}>{model?.model_tokenization?.deployer}</span>
                      </div>
                    </div>

                    <div className={styles.tokenInfoDivider}></div>
                    </>
                  )
                }

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
                  <SwapWidgetCustom token={token} />
                    <div className="w-full flex-grow flex items-center justify-center justify-center bg-[#111827] min-h-[2.5rem]">
                        <a href='https://x.com/flaunchgg'
                           className="font-jura font-normal text-sm text-[#6366F1] underline"
                           target="_blank"
                           rel="noopener noreferrer">
                            Powered by Flaunch SDK
                        </a>
                    </div>
                </div>
            </div>
            {has_community_tokens && renderCommunityTokens()}
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

  if (onlyCommunityTokens) {
      return (
          <div className="w-full flex items-center justify-center">
              {renderCommunityTokens()}
          </div>
      )
  }

  return (
    <div className={styles.tokenizationPanel}>
      {renderTokenizationStatus()}
    </div>
  );
});

export default TokenizationPanel;