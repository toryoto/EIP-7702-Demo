import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function sendSepoliaTransaction() {
  try {
    // 環境変数から送信者の秘密鍵を取得
    const senderPrivateKey = process.env.SENDER_PRIVATE_KEY;
    
    if (!senderPrivateKey) {
      throw new Error('SENDER_PRIVATE_KEYが環境変数に設定されていません');
    }

    // Sepolia RPC URLを取得
    const sepoliaRpcUrl = process.env.SEPOLIA_RPC_URL;
    
    if (!sepoliaRpcUrl) {
      throw new Error('SEPOLIA_RPC_URLが環境変数に設定されていません');
    }

    // プロバイダーとウォレットを設定
    const provider = new ethers.JsonRpcProvider(sepoliaRpcUrl);
    const wallet = new ethers.Wallet(senderPrivateKey, provider);

    // 送金先アドレス
    const receiverAddress = '0xDF2607113731755afaBA45823ce59747490e03ac';
    
    // 送金額（0.001 ETH）
    const amountInEth = '0.001';
    const amountInWei = ethers.parseEther(amountInEth);

    // 現在のガス価格を取得
    const feeData = await provider.getFeeData();
    
    // トランザクションオブジェクトを作成
    const transaction = {
      to: receiverAddress,
      value: amountInWei,
      gasLimit: 21000,
      maxFeePerGas: feeData.maxFeePerGas!,
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas!,
    };

    console.log('トランザクションを送信中...');
    console.log(`送信者: ${wallet.address}`);
    console.log(`受信者: ${receiverAddress}`);
    console.log(`送金額: ${amountInEth} ETH`);
    console.log(`ガス価格: ${ethers.formatUnits(feeData.maxFeePerGas!, 'gwei')} gwei`);

    // トランザクションを送信
    const tx = await wallet.sendTransaction(transaction);
    
    console.log(`トランザクション送信完了！`);
    console.log(`トランザクションハッシュ: ${tx.hash}`);
    console.log(`Sepolia Etherscan: https://sepolia.etherscan.io/tx/${tx.hash}`);

    // トランザクションの確認を待つ
    console.log('トランザクションの確認を待っています...');
    const receipt = await tx.wait();
    
    console.log(`トランザクション確認完了！`);
    console.log(`ブロック番号: ${receipt?.blockNumber}`);
    console.log(`ガス使用量: ${receipt?.gasUsed?.toString()}`);

  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトを実行
sendSepoliaTransaction()
  .then(() => {
    console.log('送金が完了しました！');
    process.exit(0);
  })
  .catch((error) => {
    console.error('送金に失敗しました:', error);
    process.exit(1);
  });