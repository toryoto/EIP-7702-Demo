export const EIP7702_CONFIG = {
  TRANSACTION_TYPE: "0x04",
  MAGIC_PREFIX: "0x05",
  CHAIN_IDS: {
    LOCALHOST: 31337,
    SEPOLIA: 11155111,
  },
} as const;

export const GAS_SETTINGS = {
  GAS_LIMIT: 1000000,
  MAX_FEE_PER_GAS: "20000000000", // 20 gwei
  MAX_PRIORITY_FEE_PER_GAS: "2000000000", // 2 gwei
} as const;

export const TOKEN_AMOUNTS = {
  TRANSFER_AMOUNT: "10000000", // 10 USDC (6 decimals)
  BATCH_AMOUNTS: ["500000", "300000", "200000"], // Multiple transfers
} as const;