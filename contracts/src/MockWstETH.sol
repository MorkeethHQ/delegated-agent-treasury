// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockWstETH — testnet mock with controllable yield accrual
/// @notice Same interface as real wstETH but owner can bump the rate to simulate yield
contract MockWstETH {
    string public constant name = "Mock Wrapped stETH";
    string public constant symbol = "wstETH";
    uint8 public constant decimals = 18;

    address public owner;
    uint256 public totalSupply;
    uint256 private _rate; // stETH per wstETH, 18 decimals

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event RateUpdated(uint256 newRate);

    constructor() {
        owner = msg.sender;
        _rate = 1.15e18; // start at ~1.15 stETH per wstETH (realistic current rate)
    }

    function stEthPerToken() external view returns (uint256) {
        return _rate;
    }

    /// @notice Simulate yield accrual by increasing the exchange rate
    function simulateYield(uint256 basisPoints) external {
        require(msg.sender == owner, "not owner");
        // e.g. 100 bps = 1% increase
        _rate = _rate * (10000 + basisPoints) / 10000;
        emit RateUpdated(_rate);
    }

    /// @notice Mint mock wstETH to any address (testnet faucet)
    function mint(address to, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient balance");
        require(allowance[from][msg.sender] >= amount, "insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }

    // Stubs for interface compatibility
    function wrap(uint256) external pure returns (uint256) { revert("mock: use mint"); }
    function unwrap(uint256) external pure returns (uint256) { revert("mock: not implemented"); }
}
