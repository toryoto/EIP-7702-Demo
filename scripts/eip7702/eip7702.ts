import { ethers } from "ethers";
import { EIP7702Helper } from "../utils/eip7702Helpers";
import { EIP7702_CONFIG, GAS_SETTINGS, TOKEN_AMOUNTS } from "../utils/constants";
import { AuthorizationTuple, EIP7702TransactionRequest } from "../utils/types";
import { MinimalEIP7702Delegate_ADDRESS, USDC_ADDRESS } from "../utils/addresses";
import { USDC_ABI } from "../utils/abis/usdc";
import dotenv from "dotenv";

dotenv.config()

async function main() {
  // プロバイダーとウォレットの設定
  const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  
  // 送信者の秘密鍵（実際の使用時は環境変数から取得）
  const senderPrivateKey = process.env.SENDER_PRIVATE_KEY!;
  const senderKey = new ethers.SigningKey(senderPrivateKey);
  const senderAddress = ethers.computeAddress(senderKey);

  // 受信者アドレス
  const receiverPrivateKey = process.env.RECEIVER_PRIVATE_KEY!;
  const receiverKey = new ethers.SigningKey(receiverPrivateKey);
  const receiverAddress = ethers.computeAddress(receiverKey);

  // 現在のEOAのナンスを取得
  const nonce = await provider.getTransactionCount(senderAddress);

  // 委任先のアドレス（EIP-7702デリゲートコントラクト）
  const delegateAddress = MinimalEIP7702Delegate_ADDRESS

  // Authorization署名を作成
  const MAGIC = "0x05";
  const authContent = ethers.encodeRlp([
    ethers.stripZerosLeft(ethers.toBeHex(EIP7702_CONFIG.CHAIN_IDS.SEPOLIA)),
    delegateAddress,
    ethers.stripZerosLeft(ethers.toBeHex(nonce))
  ]);
  const authHash = ethers.keccak256(ethers.concat([MAGIC, authContent]));
  const senderAuthSignature = senderKey.sign(authHash);

  // EIP-7702のトランザクションタイプで追加されたauthorization_list
  // ([chain_id, address, nonce, y_parity, r, s])の順に整列
  const senderAuthorizationList: AuthorizationTuple = {
    chainId: EIP7702_CONFIG.CHAIN_IDS.SEPOLIA,
    address: delegateAddress, // 委任先コントラクトアドレス
    nonce: ethers.stripZerosLeft(ethers.toBeHex(nonce)),
    yParity: ethers.stripZerosLeft(ethers.toBeHex(senderAuthSignature.yParity)),
    r: senderAuthSignature.r,
    s: senderAuthSignature.s,
  };

  // USDCのtransferのデータ準備
  const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const transferAmount = TOKEN_AMOUNTS.TRANSFER_AMOUNT;

  const transferData = usdcContract.interface.encodeFunctionData("transfer", [
    receiverAddress,
    transferAmount
  ]);

  // バッチ実行用のCallデータを作成
  const batchCalls = [
    {
      target: USDC_ADDRESS,
      value: "0", 
      data: transferData
    }
  ];

  // デリゲートコントラクトのexecuteBatch関数を呼び出すデータを作成
  const delegateInterface = new ethers.Interface([
    "function executeBatch(tuple(address target, uint256 value, bytes data)[] calls) external"
  ]);
  
  const executeBatchData = delegateInterface.encodeFunctionData("executeBatch", [batchCalls]);

  // トランザクションデータを構築
  const transactionData: EIP7702TransactionRequest = {
    chainId: EIP7702_CONFIG.CHAIN_IDS.SEPOLIA,
    nonce: nonce,
    maxPriorityFeePerGas: GAS_SETTINGS.MAX_PRIORITY_FEE_PER_GAS,
    maxFeePerGas: GAS_SETTINGS.MAX_FEE_PER_GAS,
    gasLimit: GAS_SETTINGS.GAS_LIMIT,
    to: delegateAddress,
    value: "0", // ETH送金の場合は金額を設定
    data: executeBatchData, // コントラクト呼び出しの場合はデータを設定
    accessList: [],
    authorizationList: [senderAuthorizationList],
  };

  try {
    const currentBalance = await usdcContract.balanceOf(senderAddress);
    console.log("💰 Current USDC Balance:", ethers.formatUnits(currentBalance, 6), "USDC");
    
    const currentAllowance = await usdcContract.allowance(senderAddress, delegateAddress);
    console.log("🔐 Current Allowance:", ethers.formatUnits(currentAllowance, 6), "USDC");

    // 送信者が直接署名するトランザクションを送信
    const txHash = await EIP7702Helper.sendSenderSignedTransaction(
      provider,
      senderKey,
      transactionData
    );

    console.log("\n🎉 EIP-7702 USDC batch transaction sent successfully!");
    console.log("Transaction Hash:", txHash);
    console.log("Sender Address:", senderAddress);
    console.log("Receiver Address:", receiverAddress);
    console.log("Delegate Contract:", delegateAddress);
    console.log("USDC Contract:", USDC_ADDRESS);
    // console.log("Approve Amount:", ethers.formatUnits(approveAmount, 6), "USDC");
    console.log("Transfer Amount:", ethers.formatUnits(transferAmount, 6), "USDC");
    console.log("Gas paid by sender:", "Yes");

    // トランザクションの確認を待つ
    console.log("\n⏳ Waiting for transaction confirmation...");
    const receipt = await provider.waitForTransaction(txHash);
    console.log("✅ Transaction confirmed in block:", receipt?.blockNumber);

    // 実行後の状態を確認
    const newBalance = await usdcContract.balanceOf(senderAddress);
    // const newAllowance = await usdcContract.allowance(senderAddress, delegateAddress);
    const receiverBalance = await usdcContract.balanceOf(receiverAddress);
    
    console.log("\n📊 Transaction Results:");
    console.log("New Sender Balance:", ethers.formatUnits(newBalance, 6), "USDC");
    // console.log("New Allowance:", ethers.formatUnits(newAllowance, 6), "USDC");
    console.log("Receiver Balance:", ethers.formatUnits(receiverBalance, 6), "USDC");

  } catch (error) {
    console.error("❌ Transaction failed:", error);
  }
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
}); 