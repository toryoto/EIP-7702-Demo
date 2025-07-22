// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./EIP7702Delegate.sol";

contract ERC4337CompatibleDelegate is MinimalEIP7702Delegate {
    
    // EntryPoint v0.7アドレス（固定）
    address public constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
        
    /**
     * @dev 承認された送信者からの実行を許可
     * EIP-7702では委譲されたEOA自身、ERC-4337ではEntryPointからの呼び出しを許可
     */
    modifier onlyAuthorized() override {
        require(
            msg.sender == address(this) ||  // EIP-7702: 委譲されたEOA自身
            msg.sender == ENTRY_POINT,      // ERC-4337: EntryPoint
            "ERC4337Delegate: not authorized"
        );
        _;
    }
    
    /**
     * @dev UserOperationの署名検証（簡素化版）
     * @param userOpHash UserOperationのハッシュ
     * @param signature 署名データ
     * @return validationData 検証結果（0=成功、1=失敗）
     */
    function validateUserOp(
        bytes calldata, // userOp（未使用）
        bytes32 userOpHash,
        bytes calldata signature,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        require(msg.sender == ENTRY_POINT, "ERC4337Delegate: not from EntryPoint");
        
        validationData = 0; // SIG_VALIDATION_SUCCESS
        
        // 不足しているガス代をEntryPointに支払い
        if (missingAccountFunds > 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "ERC4337Delegate: payment failed");
        }
    }
    
    /**
     * @dev 現在のnonce取得
     * @return nonce 現在のnonce値
     */
    function getNonce() external view returns (uint256 nonce) {
        // 簡素化：常に0を返す（実際の実装ではEntryPointから取得）
        return 0;
    }
}