import React, { useEffect, useRef, useState } from "react";
import styles from "./ActivitySidebar.module.css";
import { useAtom } from "jotai";
import {
  activityAtom,
  fetchCurrentPoints,
  fetchRewardsHistory,
  setDid,
} from "../store/activityStore";
import { accountAtom } from "../store/accountStore";
import TwitterIcon from "../assets/twitter.svg";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { getCurrentPointsRewards } from "../utils/season";

const ActivitySidebar: React.FC = () => {
  const [activityState] = useAtom(activityAtom);
  const [accountState] = useAtom(accountAtom);
  const [, getPoints] = useAtom(fetchCurrentPoints);
  // const [, getPointsHistory] = useAtom(fetchPointsHistory);
  const [, getRewardsHistory] = useAtom(fetchRewardsHistory);
  const [, setUserDid] = useAtom(setDid);
  const { isLoading, error } = activityState;

  // 滚动相关状态
  const [scrollHeight, setScrollHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);

  const sidebarRef = useRef<HTMLDivElement>(null);
  const customScrollbarRef = useRef<HTMLDivElement>(null);

  const { authenticated } = usePrivy();
  const { login } = useLogin({
    onComplete: async ({ user }) => {
      console.log("login success", user);

      // 如果有用户信息，则调用用户创建API
      if (user) {
        await setUserDid({
          did: user.id,
        });
      }
    },
    onError: (error) => {
      console.error("login failed", error);
    },
  });

  // 获取积分数据
  useEffect(() => {
    if (authenticated && accountState.did) {
      getPoints(accountState.did);
      getRewardsHistory(accountState.did);
    }
  }, [authenticated, accountState.did, getPoints, getRewardsHistory]);

  const handleLogin = async () => {
    try {
      login();
    } catch (error) {
      console.error("login Twitter failed:", error);
    }
  };

  // 更新滚动状态
  useEffect(() => {
    const updateScrollInfo = () => {
      if (sidebarRef.current) {
        setScrollHeight(sidebarRef.current.scrollHeight);
        setClientHeight(sidebarRef.current.clientHeight);
        setScrollTop(sidebarRef.current.scrollTop);
      }
    };

    // 初始更新
    updateScrollInfo();

    // 添加滚动事件监听器
    const container = sidebarRef.current;
    if (container) {
      container.addEventListener("scroll", updateScrollInfo);
    }

    return () => {
      if (container) {
        container.removeEventListener("scroll", updateScrollInfo);
      }
    };
  }, []);

  // 处理自定义滚动条拖动
  const handleScrollThumbDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();

    const startY = e.clientY;
    const startScrollTop = scrollTop;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (sidebarRef.current) {
        const deltaY = moveEvent.clientY - startY;
        const scrollRatio = deltaY / clientHeight;
        sidebarRef.current.scrollTop =
          startScrollTop + scrollRatio * scrollHeight;
        setScrollTop(sidebarRef.current.scrollTop);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // 计算滚动条高度和位置
  const getScrollThumbHeight = () => {
    if (scrollHeight <= clientHeight) return 0;
    return Math.max(30, (clientHeight / scrollHeight) * clientHeight);
  };

  const getScrollThumbTop = () => {
    if (scrollHeight <= clientHeight) return 0;
    return (
      (scrollTop / (scrollHeight - clientHeight)) *
      (clientHeight - getScrollThumbHeight())
    );
  };

  // 显示自定义滚动条的条件
  const showCustomScrollbar = scrollHeight > clientHeight;

  return (
    <div className={styles.activitySidebar}>
      <div className={styles.sidebarScrollArea}>
        <div
          ref={sidebarRef}
          className={`${styles.scrollContainer} ${styles.hideScrollbar}`}
        >
          {!authenticated || !accountState.did ? (
            <div className={styles.emptyHistory}>
              <div className={styles.loginRequired}>
                <p>Please log in first</p>
                <button className={styles.loginButton} onClick={handleLogin}>
                  Login
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 用户推特信息卡片 */}
              <div className={styles.twitterCard}>
                <div className={styles.avatar}>
                  <img
                    src={
                      accountState.twitter?.profilePictureUrl ||
                      "/default-avatar.png"
                    }
                    alt="avatar"
                  />
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.nameRow}>
                    <span className={styles.name}>
                      {accountState.twitter?.name ||
                        accountState.name ||
                        "User"}
                    </span>
                    <img
                      src={TwitterIcon}
                      alt="Twitter"
                      className={styles.twitterIcon}
                    />
                  </div>
                  <span className={styles.username}>
                    @{accountState.twitter?.username || "Unlink X"}
                  </span>
                </div>
              </div>

              {/* 本周积分卡片 - 从API获取数据 */}
              {isLoading ? (
                <div className={styles.loadingState}>Loading ...</div>
              ) : error ? (
                <div className={styles.errorState}>{error}</div>
              ) : (
                <>
                  <div className={styles.listCard}>
                    <div className={styles.keyValuePair}>
                      <span className={styles.keyTitle}>
                        Points Of This Week
                      </span>
                      <span className={styles.valueHighlight}>
                        {activityState.currentPoints?.points || 0}
                      </span>
                  </div>

                  {/* 添加积分兑换比例信息 */}
                  <div className={styles.divider}></div>
                     <div className={styles.keyValuePair}>
                        <span className={styles.keyTitle}>
                            Currently: 1 Point ={" "}
                            {getCurrentPointsRewards(
                              activityState.currentPoints?.current_season_total_points || 0
                            )}{" "}
                        $NYKO</span>
                     </div>
                  </div>

                  {/* 模型使用情况卡片 */}
                  <div className={styles.listCard}>
                    <div className={styles.keyValuePair}>
                      <span className={styles.keyTitle}>GENI</span>
                      <span className={styles.valueText}>
                        x{activityState.currentPoints?.geni || 0}
                      </span>
                    </div>
                    <div className={styles.divider}></div>
                    <div className={styles.keyValuePair}>
                      <span className={styles.keyTitle}>EpochFlow</span>
                      <span className={styles.valueText}>
                        x{activityState.currentPoints?.ef || 0}
                      </span>
                    </div>
                  </div>

                  {/* 赛季积分历史卡片 */}
                  {activityState.rewardsHistory.length > 0 && (
                    <div className={styles.listCard}>
                      <div className={styles.keyValuePair}>
                        <span className={styles.keyTitle}>Award History</span>
                        <span className={styles.valueText}>
                          {activityState.rewardsHistory.length}
                        </span>
                      </div>

                      {activityState.rewardsHistory.map((record, index) => (
                        <React.Fragment key={index}>
                          <div className={styles.divider}></div>
                          <div className={styles.keyValuePair}>
                            <span className={styles.keyTitle}>
                              Week {record.season || index + 1}
                            </span>
                            <span className={styles.valueText}>
                              {record.reward || 0} $NYKO
                            </span>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 自定义滚动条 */}
      {showCustomScrollbar && (
        <div className={styles.scrollbarTrack}>
          <div
            ref={customScrollbarRef}
            className={styles.scrollbarThumb}
            style={{
              height: `${getScrollThumbHeight()}px`,
              top: `${getScrollThumbTop()}px`,
            }}
            onMouseDown={handleScrollThumbDrag}
          />
        </div>
      )}
    </div>
  );
};

export default ActivitySidebar;
