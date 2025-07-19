// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

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

    error ExecuteError(uint256 index, bytes returnData);
    error EmptyCalls();
    error TooManyCalls();
    error InvalidTarget();
    error Unauthorized();

    event CallExecuted(address indexed target, uint256 value, bytes data, bool success);
    event BatchExecuted(uint256 totalCalls, uint256 successfulCalls);

    uint256 public constant MAX_BATCH_SIZE = 10;

    /**
     * @dev 実行権限をチェック
     * EIP-7702では、委任されたEOAからの呼び出しのみを許可
     */
    modifier onlyAuthorized() virtual {
        // EIP-7702では tx.origin == msg.sender の場合、EOAが自分自身のコードを実行している
        if (tx.origin != msg.sender) {
            revert Unauthorized();
        }
        _;
    }

    /**
     * @dev 複数のコントラクト呼び出しをバッチ実行
     * @param calls 実行するCall配列
     * 
     * アトミック性の保証:
     * - すべての呼び出しが成功 → 全ての状態変更がオンチェーンに永続化
     * - 一つでも失敗 → トランザクション全体がrevert、すべての変更が破棄
     * - EVMレベルでアトミック性が保証される
     */
    function executeBatch(Call[] calldata calls) external onlyAuthorized {
        uint256 callsLength = calls.length;
        
        if (callsLength == 0) {
            revert EmptyCalls();
        }
        if (callsLength > MAX_BATCH_SIZE) {
            revert TooManyCalls();
        }

        for (uint256 i = 0; i < callsLength; i++) {
            Call calldata call = calls[i];
            
            if (call.target == address(0)) {
                revert InvalidTarget();
            }

            (bool success, bytes memory returnData) = _executeCall(
                call.target,
                call.value,
                call.data
            );

            if (!success) {
                if (callsLength == 1) {
                    _revertWithReturnData(returnData);
                } else {
                    revert ExecuteError(i, returnData);
                }
            }

            emit CallExecuted(call.target, call.value, call.data, success);
        }

        emit BatchExecuted(callsLength, callsLength);
    }

    /**
     * @dev 単一のコントラクト呼び出しを実行
     * @param target 呼び出し先アドレス
     * @param value 送信するETH量
     * @param data 呼び出しデータ
     * @return success 成功フラグ
     * @return returnData 戻り値データ
     */
    function _executeCall(
        address target,
        uint256 value,
        bytes calldata data
    ) internal returns (bool success, bytes memory returnData) {
        (success, returnData) = target.call{value: value}(data);
    }

    /**
     * @dev 戻り値データと共にrevertする
     * @param returnData エラーデータ
     */
    function _revertWithReturnData(bytes memory returnData) internal pure {
        if (returnData.length > 0) {
            // 元のエラーメッセージを保持してrevert
            assembly {
                revert(add(32, returnData), mload(returnData))
            }
        } else {
            revert("Call failed");
        }
    }

    /**
     * @dev 単一呼び出し用のヘルパー関数（オプション）
     * @param target 呼び出し先
     * @param value ETH量
     * @param data 呼び出しデータ
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyAuthorized {
        Call[] memory calls = new Call[](1);
        calls[0] = Call(target, value, data);
        this.executeBatch(calls);
    }

    receive() external payable {}

    fallback() external payable {}
}