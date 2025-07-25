import { ethers } from "ethers";
import { EIP7702_CONFIG } from "./constants";
import dotenv from "dotenv";

dotenv.config();

export class EIP7702Helper {
  // EIP-7702のauthoraizationに対する署名を作成するメソッド
  // static async createAuthorizationSignature(
  //   senderKey: ethers.SigningKey,
  //   chainId: number,
  //   delegateAddress: string,
  //   nonce: number
  // ): Promise<AuthorizationTuple> {
  //   // Authorization署名の作成
  //   const authContent = ethers.encodeRlp([
  //     ethers.stripZerosLeft(ethers.toBeHex(chainId)),
  //     delegateAddress,
  //     ethers.stripZerosLeft(ethers.toBeHex(nonce)),
  //   ]);

  //   const authHash = ethers.keccak256(
  //     ethers.concat([EIP7702_CONFIG.MAGIC_PREFIX, authContent])
  //   );
    
  //   // EIP-7702のauthoraizationに署名
  //   const signature = senderKey.sign(authHash);

  //   return {
  //     chainId,
  //     address: delegateAddress,
  //     nonce,
  //     yParity: signature.yParity,
  //     r: signature.r,
  //     s: signature.s,
  //   };
  // }

  // 送信者が直接署名するEIP-7702トランザクションを作成するメソッド
  static buildSignedTransaction(
    senderKey: ethers.SigningKey,
    transactionData: any
  ): string {
    // 未署名TxをRLPエンコード
    const unsignedRLP = ethers.encodeRlp(transactionData);
    // トランザクションタイプとRLPエンコード(バイナリ化)した未署名トランザクションを連結
    const unsignedSerializedTx = ethers.concat([
      EIP7702_CONFIG.TRANSACTION_TYPE,
      unsignedRLP,
    ]);

    const txHash = ethers.keccak256(unsignedSerializedTx); // transaction message
    const senderSignature = senderKey.sign(txHash);

    // 署名データを未署名トランザクションの末尾に追加
    const signedTx = transactionData.concat([
      ethers.stripZerosLeft(ethers.toBeHex(senderSignature.yParity)),
      senderSignature.r,
      senderSignature.s,
    ]);

    // 完成したトランザクションデータを再度RLPエンコードする
    const signedRLP = ethers.encodeRlp(signedTx);
    return ethers.concat([EIP7702_CONFIG.TRANSACTION_TYPE, signedRLP]);
  }

  // 生の署名済みEIP-7702Txを送信するメソッド
  static async sendSenderSignedTransaction(
    provider: ethers.JsonRpcProvider,
    senderKey: ethers.SigningKey,
    transactionData: any
  ): Promise<string> {
    try {
      const rawTransaction = this.buildSignedTransaction(senderKey, transactionData);
      const txHash = await provider.send("eth_sendRawTransaction", [rawTransaction]);
      console.log("✅ Transaction sent successfully:", txHash);
      return txHash;
    } catch (error) {
      console.error("❌ Failed to send transaction:", error);
      throw error;
    }
  }
}