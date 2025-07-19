// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MinimalEIP7702Delegate
 * @dev EIP-7702用の最低限機能を持つDelegateコントラクト
 */
contract MinimalEIP7702Delegate {    
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    error ExecuteError(uint256 index, bytes error);
    
    event CallExecuted(
        address indexed target,
        uint256 value,
        bytes data,
        bool success
    );

    event BatchExecuted(
        uint256 callCount,
        uint256 successCount
    );
    
    /**
     * @dev EOA自身またはEntryPointからの呼び出しのみ許可
     * EIP-7702では委譲されたEOA自身（address(this)）が呼び出し元になる
     */
    modifier onlyAuthorized() {
        require(
            msg.sender == address(this),
            "MinimalDelegate: not authorized"
        );
        _;
    }

    /**
     * @dev 単一のコントラクト呼び出しを実行
     * @param target 呼び出し先アドレス
     * @param value 送信するETH額
     * @param data 呼び出しデータ
     */
    function execute(
        address target, 
        uint256 value, 
        bytes calldata data
    ) external onlyAuthorized {
        require(target != address(0), "MinimalDelegate: invalid target");
        
        bool success = _call(target, value, data);
        if (!success) {
            revert("Call failed");
        }
        
        emit CallExecuted(target, value, data, success);
    }
    
    /**
     * @dev 複数のコントラクト呼び出しをバッチ実行
     * @param calls 実行するCall配列
     */
    function executeBatch(Call[] calldata calls) external onlyAuthorized {
        require(calls.length > 0, "MinimalDelegate: empty calls");
        require(calls.length <= 10, "MinimalDelegate: too many calls");
        
        uint256 successCount = 0;
        uint256 callsLength = calls.length;
        
        for (uint256 i = 0; i < callsLength; i++) {
            Call calldata call = calls[i];
            require(call.target != address(0), "MinimalDelegate: invalid target");
            
            bool success = _call(call.target, call.value, call.data);
            
            if (success) {
                successCount++;
            } else {
                if (callsLength == 1) {
                    revert("Call failed");
                } else {
                    revert ExecuteError(i, _getReturnData());
                }
            }
            
            emit CallExecuted(call.target, call.value, call.data, success);
        }
        
        emit BatchExecuted(callsLength, successCount);
    }
    
    /**
     * @dev 低レベルcallの実行
     * @param target 呼び出し先
     * @param value 送信ETH額
     * @param data 呼び出しデータ
     * @return success 成功フラグ
     */
    function _call(
        address target,
        uint256 value,
        bytes calldata data
    ) internal returns (bool success) {
        (success, ) = target.call{value: value}(data);
    }
    
    /**
     * @dev 戻り値を取得
     * @return data 戻り値
     */
    function _getReturnData() internal pure returns (bytes memory data) {
        return "";
    }
    
    /**
     * @dev ETHを受信可能にする
     */
    receive() external payable {}
    
    /**
     * @dev 未知の関数呼び出しを受け入れる（EOAライクな動作）
     */
    fallback() external payable {}
}