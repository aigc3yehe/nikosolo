import React, { useRef } from "react";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import styles from "./LoginButton.module.css";
import GoldIcon from "../assets/gold.svg";
import { useAtom, useSetAtom } from "jotai";
import {
  accountAtom,
  setUser,
  logout as logoutAction,
} from "../store/accountStore";
import { createUser } from "../services/userService";
import { showAccountPopupAtom } from "../store/accountPopupStore";

interface LoginButtonProps {
  className?: string;
}

const LoginButton: React.FC<LoginButtonProps> = ({ className }) => {
  const { authenticated } = usePrivy();
  const [accountState] = useAtom(accountAtom);
  const { walletAddress, credits, twitter } = accountState;
  const setUserData = useSetAtom(setUser);
  const showAccountPopup = useSetAtom(showAccountPopupAtom);
  const accountRef = useRef<HTMLDivElement>(null);
  const logoutStore = useSetAtom(logoutAction);

  const { login } = useLogin({
    onComplete: async ({ user, isNewUser }) => {
      console.log("登录成功", user);

      // 如果有用户信息，则调用用户创建API
      if (user) {
        try {
          // 准备用户数据
          const userData = {
            did: user.id,
            address: user.wallet?.address,
            username: user.twitter?.username,
            subject: user.twitter?.subject,
            name: user.twitter?.name,
            profilePictureUrl: user.twitter?.profilePictureUrl,
          };

          // 调用创建用户API
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          await createUser(userData);
          console.log("用户创建/更新成功");

          // 特别处理新用户
          if (isNewUser) {
            console.log("新用户", user);
            // 这里可以添加新用户的其他初始化逻辑
          }
        } catch (error) {
          console.error("用户创建/更新失败", error);
        }

        // 更新全局用户状态
        setUserData(user);
      }
    },
    onError: (error) => {
      console.error("登录失败", error);
    },
  });

  // const { initOAuth, loading } = useLoginWithOAuth({
  //   onComplete: async ({ user, isNewUser }) => {
  //     console.log('登录成功', user);

  //     // 如果有用户信息，则调用用户创建API
  //     if (user) {
  //       try {
  //         // 准备用户数据
  //         const userData = {
  //           did: user.id,
  //           address: user.wallet?.address,
  //           username: user.twitter?.username,
  //           subject: user.twitter?.subject,
  //           name: user.twitter?.name,
  //           profilePictureUrl: user.twitter?.profilePictureUrl
  //         };

  //         // 调用创建用户API
  //         // @ts-ignore
  //         await createUser(userData);
  //         console.log('用户创建/更新成功');

  //         // 特别处理新用户
  //         if (isNewUser) {
  //           console.log('新用户', user);
  //           // 这里可以添加新用户的其他初始化逻辑
  //         }
  //       } catch (error) {
  //         console.error('用户创建/更新失败', error);
  //       }

  //       // 更新全局用户状态
  //       setUserData(user);
  //     }
  //   },
  //   onError: (error) => {
  //     console.error('登录失败', error);
  //   }
  // });

  // 格式化钱包地址，显示前4位和后4位
  const formatAddress = (address: string | null) => {
    if (!address || address.length < 10) return address || "";
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  // 格式化数字，添加千位分隔符
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const logout = () => {
    console.log("logout success");
    logoutStore();
  };

  const handleLogin = async () => {
    try {
      // 使用Twitter作为OAuth提供者
      // await initOAuth({ provider: 'twitter' });
      login();
    } catch (error) {
      console.error("启动Twitter登录时出错:", error);
    }
  };

  // 处理账户点击
  const handleAccountClick = () => {
    // 获取当前元素位置
    const position = accountRef.current?.getBoundingClientRect() || null;

    // 显示弹窗
    showAccountPopup({
      userData: {
        name: twitter?.name || undefined,
        username: twitter?.username || undefined,
        profilePictureUrl: twitter?.profilePictureUrl || undefined,
        walletAddress: walletAddress || undefined,
      },
      anchorPosition: position,
      onLogout: logout,
    });
  };

  // 用户已登录，显示账户信息
  if (authenticated) {
    return (
      <div className={styles.loggedInContainer}>
        {/* Credits显示 */}
        <div className={styles.creditsContainer}>
          <span className={styles.creditsAmount}>{formatNumber(credits)}</span>
          <span className={styles.creditsLabel}>Credits</span>
        </div>

        {/* 账户显示 */}
        <div
          ref={accountRef}
          className={styles.accountContainer}
          onClick={handleAccountClick}
        >
          <img src={GoldIcon} alt="Account" className={styles.goldIcon} />
          <img
            src={twitter?.profilePictureUrl || ""}
            alt="Twitter Avatar"
            className={styles.avatarIcon}
          />
          <span className={styles.accountAddress}>
            {formatAddress(walletAddress)}
          </span>
        </div>
      </div>
    );
  }

  // 用户未登录，显示登录选项
  return (
    <div className={styles.loginContainer}>
      {/* Twitter登录按钮 */}
      <button
        className={`${styles.loginButton} ${className}`}
        onClick={handleLogin}
        // disabled={loading}
      >
        {/* {loading ? "Logining..." : "Login"} */}
        Login
      </button>
    </div>
  );
};

export default LoginButton;
