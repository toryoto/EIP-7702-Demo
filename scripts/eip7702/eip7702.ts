import { ethers } from "ethers";
import { EIP7702Helper } from "../utils/eip7702Helpers";
import { EIP7702_CONFIG, TOKEN_AMOUNTS } from "../utils/constants";
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
  const senderAuthorizationList = [
    ethers.stripZerosLeft(ethers.toBeHex(EIP7702_CONFIG.CHAIN_IDS.SEPOLIA)),
    delegateAddress, // 委任先コントラクトアドレス
    ethers.stripZerosLeft(ethers.toBeHex(nonce)),
    ethers.stripZerosLeft(ethers.toBeHex(senderAuthSignature.yParity)),
    senderAuthSignature.r,
    senderAuthSignature.s,
  ];

  const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const transferData = usdcContract.interface.encodeFunctionData("transfer", [
    receiverAddress,
    ethers.parseUnits("10", 6),
  ]);

  // Delegate Contractのexecuteを呼び出すためのインターフェース
  const delegationInterface = new ethers.Interface([
    "function execute((address to, uint256 value, bytes data) call) external payable",
  ]);

  // Delegate Contractのexecuteを呼び出す際に渡すデータ
  const executeCallData = delegationInterface.encodeFunctionData("execute", [
    {
        to: USDC_ADDRESS,
        value: ethers.parseEther("0"),
        data: transferData
    }
  ]);

  // ガス代情報を取得
  const feeData = await provider.getFeeData();

  // トランザクションデータを構築
  const transactionData: ethers.RlpStructuredDataish = [
    ethers.toBeHex(EIP7702_CONFIG.CHAIN_IDS.SEPOLIA),
    ethers.stripZerosLeft(ethers.toBeHex(nonce)),
    ethers.stripZerosLeft(ethers.toBeHex(feeData.maxPriorityFeePerGas!)), // maxPriorityFeePerGas
    ethers.stripZerosLeft(ethers.toBeHex(feeData.maxFeePerGas!)), // maxFeePerGas
    ethers.stripZerosLeft(ethers.toBeHex(1000000)), // gasLimit
    senderAddress,
    ethers.stripZerosLeft(ethers.toBeHex(0)), // value
    executeCallData, // data
    [], // accessList
    [senderAuthorizationList], // authorizationList
  ];

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