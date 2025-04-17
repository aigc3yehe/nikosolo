import React from 'react';
import Header from './Header';
import ContentDisplay from './ContentDisplay';
import ChatWindow from './ChatWindow';
import { useAtom } from 'jotai';
import { accountAtom } from '../store/accountStore';
import styles from './MainLayout.module.css';

const MainLayout: React.FC = () => {
  // 生成一个随机的UUID作为用户标识
  // 在实际应用中，这应该从用户认证系统获取或使用更可靠的方法生成
  const uuid = React.useMemo(() => {
    return 'user-' + Math.random().toString(36).substring(2, 15);
  }, []);

  // 从accountStore获取用户信息
  const [accountState] = useAtom(accountAtom);
  const { did , twitter} = accountState;
  let userUuid = twitter && twitter.subject
  if (!userUuid) {
     userUuid = uuid;
  }

  return (
    <div className={styles.mainLayout}>
      <Header />
      <div className={styles.contentContainer}>
        <div className={styles.contentSection}>
          <ContentDisplay />
        </div>
        <div className={styles.chatSection}>
          <ChatWindow 
            uuid={userUuid} 
            did={did || undefined} 
          />
        </div>
      </div>
    </div>
  );
};

export default MainLayout;