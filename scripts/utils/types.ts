export interface AuthorizationTuple {
  chainId: number;
  address: string; // 実行委託先のスマートコントラクトアドレス
  nonce: number;
  yParity: number;
  r: string;
  s: string;
}

// EIP-7702のトランザクションの型は従来のEthereumのトランザクションプ＋authorizationList
export interface EIP7702TransactionRequest {
  chainId: number;
  nonce: number;
  maxPriorityFeePerGas: string;
  maxFeePerGas: string;
  gasLimit: number;
  to: string;
  value: string;
  data: string;
  accessList: any[];
  authorizationList: AuthorizationTuple[];
}

export interface TransferCall {
  to: string;
  value: string;
  data: string;
}

export interface DemoConfig {
  sponsorAddress: string;
  senderAddress: string;
  receiverAddress: string;
  delegateContractAddress: string;
  erc20ContractAddress: string;
}