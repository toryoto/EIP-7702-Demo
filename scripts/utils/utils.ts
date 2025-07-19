import { ethers } from "ethers";

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