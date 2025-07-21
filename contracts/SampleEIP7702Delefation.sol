pragma solidity ^0.8.0;

contract SampleEIP7702Delegation {
    struct Call {
        address to;
        uint256 value;
        bytes data;
    }
    event CallExecuted(
        address indexed sender,
        address indexed to,
        uint256 value,
        bytes data
    );
    event Executed(address value);

    function execute(Call calldata call) external payable {
        (bool success, ) = call.to.call{value: call.value}(call.data);
        require(success, "reverted");
        emit Executed(address(this));
        emit CallExecuted(msg.sender, call.to, call.value, call.data);
    }
}