import { ethers } from "ethers";
import { EIP7702_CONFIG } from "./constants";
import { AuthorizationTuple } from "./types";

export class EIP7702Helper {
  static async createAuthorizationSignature(
    senderKey: ethers.SigningKey,
    chainId: number,
    delegateAddress: string,
    nonce: number
  ): Promise<AuthorizationTuple> {
    // Authorization署名の作成
    const authContent = ethers.encodeRlp([
      ethers.stripZerosLeft(ethers.toBeHex(chainId)),
      delegateAddress,
      ethers.stripZerosLeft(ethers.toBeHex(nonce)),
    ]);

    const authHash = ethers.keccak256(
      ethers.concat([EIP7702_CONFIG.MAGIC_PREFIX, authContent])
    );
    
    const signature = senderKey.sign(authHash);

    return {
      chainId,
      address: delegateAddress,
      nonce,
      yParity: signature.yParity,
      r: signature.r,
      s: signature.s,
    };
  }

  static buildRawTransaction(
    sponsorKey: ethers.SigningKey,
    transactionData: any
  ): string {
    // Raw transactionの構築ロジック
    const unsignedTx = [
      ethers.toBeHex(transactionData.chainId),
      ethers.stripZerosLeft(ethers.toBeHex(transactionData.nonce)),
      ethers.stripZerosLeft(ethers.toBeHex(transactionData.maxPriorityFeePerGas)),
      ethers.stripZerosLeft(ethers.toBeHex(transactionData.maxFeePerGas)),
      ethers.stripZerosLeft(ethers.toBeHex(transactionData.gasLimit)),
      transactionData.to,
      ethers.stripZerosLeft(ethers.toBeHex(transactionData.value)),
      transactionData.data,
      transactionData.accessList,
      transactionData.authorizationList.map((auth: AuthorizationTuple) => [
        ethers.stripZerosLeft(ethers.toBeHex(auth.chainId)),
        auth.address,
        ethers.stripZerosLeft(ethers.toBeHex(auth.nonce)),
        ethers.stripZerosLeft(ethers.toBeHex(auth.yParity)),
        auth.r,
        auth.s,
      ]),
    ];

    const unsignedRLP = ethers.encodeRlp(unsignedTx);
    const unsignedSerializedTx = ethers.concat([
      EIP7702_CONFIG.TRANSACTION_TYPE,
      unsignedRLP,
    ]);

    const txHash = ethers.keccak256(unsignedSerializedTx);
    const sponsorSignature = sponsorKey.sign(txHash);

    const signedTx = unsignedTx.concat([
      ethers.stripZerosLeft(ethers.toBeHex(sponsorSignature.yParity)),
      sponsorSignature.r,
      sponsorSignature.s,
    ]);

    const signedRLP = ethers.encodeRlp(signedTx);
    return ethers.concat([EIP7702_CONFIG.TRANSACTION_TYPE, signedRLP]);
  }

  static async sendRawTransaction(
    provider: ethers.JsonRpcProvider,
    rawTransaction: string
  ): Promise<string> {
    try {
      const txHash = await provider.send("eth_sendRawTransaction", [
        rawTransaction,
      ]);
      console.log("✅ Transaction sent successfully:", txHash);
      return txHash;
    } catch (error) {
      console.error("❌ Failed to send transaction:", error);
      throw error;
    }
  }
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatAmount(amount: string, decimals: number = 6): string {
  return ethers.formatUnits(amount, decimals);
}

export async function waitForTransaction(
  provider: ethers.JsonRpcProvider,
  txHash: string
): Promise<ethers.TransactionReceipt | null> {
  console.log("⏳ Waiting for transaction confirmation...");
  const receipt = await provider.waitForTransaction(txHash);
  if (receipt) {
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
  }
  return receipt;
}