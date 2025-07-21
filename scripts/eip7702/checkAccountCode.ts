import { ethers } from 'ethers';

/**
 * EIP-7702のdelegation designatorを解析する関数
 * @param code アドレスのcode（0x付きhex string）
 * @returns delegation情報のオブジェクト
 */
function parseDelegationCode(code: string): {
  isDelegated: boolean;
  delegatedAddress?: string;
  rawCode: string;
} {
  // 0xプレフィックスを除去
  const cleanCode = code.startsWith('0x') ? code.slice(2) : code;
  
  // 空のcodeの場合
  if (cleanCode === '' || cleanCode === '0') {
    return {
      isDelegated: false,
      rawCode: code,
    };
  }
  
  // EIP-7702のdelegation designator形式: 0xef0100 + address (20 bytes)
  // ef0100 = 3バイト, address = 20バイト, 合計23バイト = 46文字
  if (cleanCode.length === 46 && cleanCode.startsWith('ef0100')) {
    const delegatedAddress = '0x' + cleanCode.slice(6); // 'ef0100'を除いてaddress部分を取得
    
    return {
      isDelegated: true,
      delegatedAddress: delegatedAddress,
      rawCode: code,
    };
  }
  
  // その他のcode（通常のコントラクトコードなど）
  return {
    isDelegated: false,
    rawCode: code,
  };
}

/**
 * 指定したアドレスのEIP-7702 delegation状態をチェックする関数
 * @param provider ethers provider
 * @param address チェック対象のアドレス
 */
async function checkEIP7702Delegation(
  provider: ethers.Provider, 
  address: string
): Promise<void> {
  try {
    console.log(`\n=== EIP-7702 Delegation Check ===`);
    console.log(`Address: ${address}`);
    console.log('-----------------------------------');
    
    // アドレスのcodeを取得
    const code = await provider.getCode(address);
    console.log(`Raw Code: ${code}`);
    
    // delegation情報を解析
    const delegationInfo = parseDelegationCode(code);
    
    if (delegationInfo.isDelegated) {
      console.log('🔗 Status: DELEGATED');
      console.log(`📍 Delegated Address: ${delegationInfo.delegatedAddress}`);
      console.log('⚠️  This EOA has an active EIP-7702 delegation');
      
      // delegated先のcodeも確認
      if (delegationInfo.delegatedAddress) {
        try {
          const delegatedCode = await provider.getCode(delegationInfo.delegatedAddress);
          console.log(`📋 Delegated Contract Code Length: ${delegatedCode.length - 2} hex chars`);
          console.log(`📋 Has Contract Code: ${delegatedCode !== '0x'}`);
        } catch (error) {
          console.log('❌ Error fetching delegated contract code:', error);
        }
      }
    } else {
      if (code === '0x') {
        console.log('✅ Status: NORMAL EOA (No Code)');
        console.log('📝 This is a standard EOA with no delegation');
      } else {
        console.log('📜 Status: CONTRACT or UNKNOWN CODE');
        console.log(`📋 Code Length: ${code.length - 2} hex chars`);
        console.log('⚠️  This address has contract code but not EIP-7702 delegation');
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking delegation:', error);
  }
}

/**
 * メイン実行関数
 */
async function main() {
  try {
    // Ethereum mainnetに接続（RPCエンドポイントを設定）
    const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://eth.llamarpc.com';
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // ネットワーク情報を確認
    const network = await provider.getNetwork();
    console.log(`🌐 Connected to: ${network.name} (Chain ID: ${network.chainId})`);
    
    // チェック対象のアドレス（環境変数から取得するか、ここに直接記入）
    const addressToCheck = '0xE93502B3090a48099CF336C845D753d0fb34bC0C';
    
    if (!addressToCheck) {
      console.log('\n⚠️  No address specified.');
      console.log('Please set ADDRESS_TO_CHECK environment variable or modify the script.');
      console.log('\nExample usage:');
      console.log('ADDRESS_TO_CHECK=0x1234567890123456789012345678901234567890 npm run check');
      return;
    }
    
    // アドレスの形式をチェック
    if (!ethers.isAddress(addressToCheck)) {
      console.error('❌ Invalid Ethereum address format');
      return;
    }
    
    await checkEIP7702Delegation(provider, addressToCheck);
  } catch (error) {
    console.error('❌ Main execution error:', error);
  }
}

// スクリプトが直接実行された場合にmain関数を実行
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

export {
  parseDelegationCode,
  checkEIP7702Delegation,
};