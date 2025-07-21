// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MinimalEIP7702Delegate {
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    error ExecuteError(uint256 index, bytes returnData);
    error EmptyCalls();
    error InvalidTarget();
    error CallFailed(bytes returnData);

    event CallExecuted(address indexed target, uint256 value, bytes data, bool success);
    event BatchExecuted(uint256 totalCalls);

    /**
     * @dev 単一のコントラクト呼び出しを実行
     * @param target 呼び出し先アドレス
     * @param value 送信するETH量
     * @param data 呼び出しデータ
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external {
        if (target == address(0)) {
            revert InvalidTarget();
        }

        (bool success, bytes memory returnData) = target.call{value: value}(data);
        
        if (!success) {
            revert CallFailed(returnData);
        }

        emit CallExecuted(target, value, data, success);
    }

    /**
     * @dev 複数のコントラクト呼び出しをバッチ実行
     * @param calls 実行するCall配列
     */
    function executeBatch(Call[] calldata calls) external {
        uint256 callsLength = calls.length;
        
        if (callsLength == 0) {
            revert EmptyCalls();
        }

        for (uint256 i = 0; i < callsLength; i++) {
            Call calldata call = calls[i];
            
            if (call.target == address(0)) {
                revert InvalidTarget();
            }

            (bool success, bytes memory returnData) = call.target.call{value: call.value}(call.data);

            if (!success) {
                if (callsLength == 1) {
                    revert CallFailed(returnData);
                } else {
                    revert ExecuteError(i, returnData);
                }
            }

            emit CallExecuted(call.target, call.value, call.data, success);
        }

        emit BatchExecuted(callsLength);
    }

    receive() external payable {}

    fallback() external payable {}
}