import React, {useEffect, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import styles from './ActivityContent.module.css';
import BackIcon from '../assets/back.svg';
import ReactMarkdown from 'react-markdown';

// 示例 Markdown 内容
const markdownContent = `
# What is Project Primedata S1?

Project Primedata S1 marks the launch phase of NYKO, a 12-week incentive program running from May 6 UTC 12:00  to July 30 UTC 12:00. It rewards users who contribute valuable data (by using creative components) and help amplify NYKO mindshare (by sharing on X) with $NYKO tokens.

## How to Participate

- Get Premium Access

  Deposit 75,000 $NYKO into the [Plan&Pricing](/pricing) page.
- Earn Generation Rewards

  Create images using NYKO AI image generation service.
- Earn Mindshare Rewards

  Share your creative outputs from the platform on X, or simply mention @niyoko_agent or $NYKO.

## Reward Structure

- 30 million $NYKO distributed totally based on user points.

## Reward Calculation

Generation Points = GENI × EF × Cooldown

- GENI (AI Creator Score): Currently fixed at 1.
- EF (EpochFlow): 2 if you created something yesterday, otherwise 1.
- Cooldown: After 3 generations in a single day, value becomes 0; otherwise 1. Reset to 1 every 24h.

Mindshare Points = GENI × IF × Cooldown_X

- GENI (AI Creator Score): Currently fixed at 1.
- IF (Influence Factor): 5~20, depends on the social influence of your tweets.
- Cooldown_X: Every day, we select the most influential tweet for pointing.
`;

const ActivityContent: React.FC = () => {
  const navigate = useNavigate();

  // 滚动相关状态
  const [scrollHeight, setScrollHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);

  const contentRef = useRef<HTMLDivElement>(null);
  const customScrollbarRef = useRef<HTMLDivElement>(null);

  // 返回首页
  const handleBack = () => {
    navigate('/');
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const CustomLink = ({ node, href, children, ...props}: any) => {
    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();

      if (href && href.startsWith('/')) {
        navigate(href);
      } else if (href){
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    }
    return (
      <a href={href} onClick={handleClick} {...props}>
        {children}
      </a>
    );
  };

  // 根据条件确定要显示的周信息
  const weekInfo = { week: 'Week 2 (5.13-5.19)', rewards: '2,500,000' }

  // 更新滚动状态
  useEffect(() => {
    const updateScrollInfo = () => {
      if (contentRef.current) {
        setScrollHeight(contentRef.current.scrollHeight);
        setClientHeight(contentRef.current.clientHeight);
        setScrollTop(contentRef.current.scrollTop);
      }
    };

    // 初始更新
    updateScrollInfo();

    // 添加滚动事件监听器
    const container = contentRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollInfo);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', updateScrollInfo);
      }
    };
  }, []);

  // 处理自定义滚动条拖动
  const handleScrollThumbDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();

    const startY = e.clientY;
    const startScrollTop = scrollTop;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (contentRef.current) {
        const deltaY = moveEvent.clientY - startY;
        const scrollRatio = deltaY / clientHeight;
        contentRef.current.scrollTop = startScrollTop + scrollRatio * scrollHeight;
        setScrollTop(contentRef.current.scrollTop);
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 计算滚动条高度和位置
  const getScrollThumbHeight = () => {
    if (scrollHeight <= clientHeight) return 0;
    return Math.max(30, (clientHeight / scrollHeight) * clientHeight);
  };

  const getScrollThumbTop = () => {
    if (scrollHeight <= clientHeight) return 0;
    return (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - getScrollThumbHeight());
  };

  // 显示自定义滚动条的条件
  const showCustomScrollbar = scrollHeight > clientHeight;

  return (
    <div className={styles.activityContent}>
      <div className={styles.contentScrollArea}>
        <div
          ref={contentRef}
          className={`${styles.scrollContainer} ${styles.hideScrollbar}`}
        >
          <div className={styles.contentWrapper}>
            {/* 顶部导航栏 */}
            <div className={styles.topNav}>
              <button className={styles.backButton} onClick={handleBack}>
                <img src={BackIcon} alt="Back" />
                <span>Back</span>
              </button>
            </div>

            {/* Banner 区域 */}
            <div className={styles.bannerArea}>
              <div className={styles.bannerTitle}>
                <h1 className={styles.mainTitle}>Project Primedata</h1>
                <p className={styles.subTitle}>season one</p>
              </div>

              <div className={styles.tagsGroup}>
                <div className={styles.tagItem}>{weekInfo.week}</div>
                <div className={styles.tagItem}>Rewards: {weekInfo.rewards} $NYKO</div>
              </div>
            </div>

            {/* 内容区域 */}
            <div className={styles.markdownContent}>
              <ReactMarkdown components={{
                a: CustomLink,
              }}>
                {markdownContent}
              </ReactMarkdown>
            </div>
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
                top: `${getScrollThumbTop()}px`
              }}
              onMouseDown={handleScrollThumbDrag}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityContent;
