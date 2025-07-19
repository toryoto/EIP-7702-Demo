# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build and Compile
```bash
npm run compile  # Compile Solidity contracts and generate TypeScript types
```

### Testing
```bash
npm run test  # Run all tests
npx hardhat test test/EIP7702Delegate.test.ts  # Run specific test file
```

### Network Operations
```bash
npx hardhat node  # Start local Hardhat network
npx hardhat run scripts/eip7702/eip7702.ts --network localhost  # Run scripts on local network
npx hardhat run scripts/eip7702/eip7702.ts --network sepolia  # Run scripts on Sepolia testnet
```

## Architecture Overview

This is an EIP-7702 demonstration project that showcases how Externally Owned Accounts (EOAs) can temporarily delegate their functionality to smart contracts.

### Core Components

1. **Smart Contracts** (`contracts/`)
   - `EIP7702Delegate.sol`: Minimal delegate contract with authorization checks and execute functions
   - `ERC4337CompatibleDelegate.sol`: Extended delegate with ERC-4337 account abstraction support

2. **Scripts** (`scripts/`)
   - `utils/helpers.ts`: Core EIP-7702 utilities for creating authorizations and building transactions
   - `utils/constants.ts`: Network-specific addresses and gas settings
   - `eip7702/eip7702.ts`: Example implementation of EIP-7702 delegation

3. **Type System**
   - TypeChain generates TypeScript types from contracts in `typechain-types/`
   - Custom types defined in `scripts/utils/types.ts`

### Key Patterns

- **Authorization Flow**: EOAs sign authorization to delegate to contract address using `createAuthorizationTuple()`
- **Transaction Building**: Use `buildRawEIP7702Transaction()` to create properly formatted transactions
- **Delegate Execution**: Contracts expose `execute()` and `executeBatch()` for transaction execution

### Environment Variables

Required in `.env`:
```
SEPOLIA_RPC_URL=<Sepolia RPC endpoint>
SPONSOR_PRIVATE_KEY=<Sponsor account private key>
SENDER_PRIVATE_KEY=<Sender account private key>
ETHERSCAN_API_KEY=<For contract verification>
```

### Development Workflow

1. Make contract changes in `contracts/`
2. Run `npm run compile` to rebuild and regenerate types
3. Test changes with `npm run test`
4. Deploy contracts using scripts in `scripts/deploy/` (to be created)
5. Interact with deployed contracts using scripts in `scripts/eip7702/`