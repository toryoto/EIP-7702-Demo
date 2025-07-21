import { ethers } from "ethers";
import dotenv from "dotenv";
import { USDC_ABI } from "../utils/abis/usdc";
import { USDC_ADDRESS, SampleEIP7702Delegate_ADDRESS } from "../utils/addresses";
import { EIP7702_CONFIG } from "../utils/constants";

dotenv.config()

const SPONSOR_ADDRESS: string = "0xDF2607113731755afaBA45823ce59747490e03ac"; // dev-sub
const SPONSOR_KEY: string = process.env.SPONSOR_PRIVATE_KEY!;
const sponsorKey = new ethers.SigningKey(SPONSOR_KEY);

const SENDER_ADDRESS: string = "0xE93502B3090a48099CF336C845D753d0fb34bC0C"; // Account3
const SENDER_KEY: string = process.env.SENDER_PRIVATE_KEY!;
const senderKey = new ethers.SigningKey(SENDER_KEY);

const RECEIVER_ADDRESS: string = "0x25b61126EED206F6470533C073DDC3B4157bb6d1"; // dev-main

const chainId = EIP7702_CONFIG.CHAIN_IDS.SEPOLIA;

const DELEGATE_CONTRACT_ADDRESS = SampleEIP7702Delegate_ADDRESS;
const ERC20_CONTRACT_ADDRESS = USDC_ADDRESS;

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL, {
  name: "sepolia",
  chainId: chainId,
});

const main = async () => {
    // 送信者のナンスを取得
  const senderNonce = await provider.getTransactionCount(SENDER_ADDRESS);

  // MAGIC(固定値)とethers.encodeRlp([chainId, Delegate Contractのアドレス, SenderのNonce])を連結してRLPエンコード
  const MAGIC = "0x05";
  const authContent = ethers.encodeRlp([
    ethers.stripZerosLeft(ethers.toBeHex(chainId)),
    DELEGATE_CONTRACT_ADDRESS,
    ethers.stripZerosLeft(ethers.toBeHex(senderNonce)),
  ]);

  // Hashを計算しSenderの秘密鍵で署名
  const authHash = ethers.keccak256(ethers.concat([MAGIC, authContent]));
  const senderSignature = senderKey.sign(authHash);

  // [chain_id, address, nonce, y_parity, r, s]の順に整列
  const senderAuthorizationList = [
    ethers.stripZerosLeft(ethers.toBeHex(chainId)),
    DELEGATE_CONTRACT_ADDRESS, // 委任先コントラクトアドレス
    ethers.stripZerosLeft(ethers.toBeHex(senderNonce)),
    ethers.stripZerosLeft(ethers.toBeHex(senderSignature.yParity)),
    senderSignature.r,
    senderSignature.s,
  ];

  // ERC-20トークンのtransfer用のデータの作成
  const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
  const transferData = usdcContract.interface.encodeFunctionData("transfer", [
    RECEIVER_ADDRESS,
    ethers.parseUnits("10", 6),
  ]);

  // Delegate Contractのexecuteを呼び出すためのインターフェース
  const delegationInterface = new ethers.Interface([
    "function execute((address to, uint256 value, bytes data) calldata calls) external payable",
  ]);

  // Delegate Contractのexecuteを呼び出す際に渡すデータ
  const executeCallData = delegationInterface.encodeFunctionData("execute", [
    {
        to: ERC20_CONTRACT_ADDRESS,
        value: ethers.parseEther("0"),
        data: transferData
    }
  ]);

  const sponsorNonce = await provider.getTransactionCount(SPONSOR_ADDRESS);
  const feeData = await provider.getFeeData();

  const unsignedTx: ethers.RlpStructuredDataish = [
    ethers.toBeHex(chainId),
    ethers.stripZerosLeft(ethers.toBeHex(sponsorNonce)), // SponsorのEOAのnonce
    ethers.stripZerosLeft(ethers.toBeHex(feeData.maxPriorityFeePerGas!)), // maxPriorityFeePerGas
    ethers.stripZerosLeft(ethers.toBeHex(feeData.maxFeePerGas!)), // maxFeePerGas
    ethers.stripZerosLeft(ethers.toBeHex(1000000)), // gasLimit
    SENDER_ADDRESS, // SenderのEOAのアドレス
    ethers.stripZerosLeft(ethers.toBeHex(0)), // value: ETHは送らないので0を指定
    executeCallData, // Delegate Contractのexecuteに渡すcalldata
    [], // Access List
    [senderAuthorizationList], // Authorization List
  ];

  // トランザクションタイプ(EIP-7702は4)
  const txType = "0x04";

  // トランザクションタイプとRLPエンコード(バイナリ化)した未署名トランザクションを連結
  const unsignedRLP = ethers.encodeRlp(unsignedTx);
  const unsignedSerializedTx = ethers.concat([txType, unsignedRLP]);

  // Hashを計算しSponsorの秘密鍵で署名
  const txHash = ethers.keccak256(unsignedSerializedTx);
  const sponsorSignature = sponsorKey.sign(txHash);

  // Sponsorの署名を未署名トランザクションの末尾に追加
  const signedTx = unsignedTx.concat([
    ethers.stripZerosLeft(ethers.toBeHex(sponsorSignature.yParity)),
    sponsorSignature.r,
    sponsorSignature.s,
  ]);

  // RLPエンコードしてトランザクションタイプを付与したトランザクションを生成
  const signedRLP = ethers.encodeRlp(signedTx);
  const rawTx = ethers.concat([txType, signedRLP]);
  console.log("Raw EIP 7702 Transaction:", rawTx);

  // ethersの6.13.7はまだEIP-7702に対応していないので
  // ethersのsendメソッドを使用してEIP-7702のトランザクションを送信
  const tx = await provider.send("eth_sendRawTransaction", [rawTx]);
  console.log("Transaction Hash:", tx);
  
  // トランザクションの状態を確認
  console.log("\n⏳ Checking transaction status...");
  
  try {
    const txReceipt = await provider.getTransactionReceipt(tx);
    if (txReceipt) {
      console.log("✅ Transaction confirmed!");
      console.log("Block Number:", txReceipt.blockNumber);
      console.log("Gas Used:", txReceipt.gasUsed.toString());
      console.log("Status:", txReceipt.status === 1 ? "Success" : "Failed");
    } else {
      console.log("⏳ Transaction pending...");
      
      const txDetails = await provider.getTransaction(tx);
      if (txDetails) {
        console.log("Transaction found in mempool");
        console.log("From:", txDetails.from);
        console.log("To:", txDetails.to);
        console.log("Nonce:", txDetails.nonce);
      } else {
        console.log("❌ Transaction not found in mempool");
      }
    }
  } catch (error) {
    console.log("❌ Error checking transaction:", error);
  }
};

main();