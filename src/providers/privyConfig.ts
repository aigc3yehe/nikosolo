import type {PrivyClientConfig} from '@privy-io/react-auth';
import { base } from 'viem/chains';

// Replace this with your Privy config
export const privyConfig: PrivyClientConfig = {
  embeddedWallets: {
    createOnLogin: 'all-users',
    // requireUserPasswordOnCreate: true,
    showWalletUIs: true
    
  },
  defaultChain: base,
  supportedChains: [base],
  // 自定义登录外观
  appearance: {
    theme: 'dark',
    accentColor: '#6366F1', // 使用项目主题色
    logo: '/nyko.png', // 使用项目logo
  },
};