// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev ERC-20 interface for the yield-bearing token
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @dev ERC-4626 vault interface — only need convertToAssets for rate
interface IERC4626 {
    function convertToAssets(uint256 shares) external view returns (uint256);
}

/// @title AgentTreasuryCelo — yield-only spending for AI agents on Celo
/// @notice Human deposits stataUSDC (Aave static aToken). Agent spends only accrued yield.
/// @dev Uses ERC-4626 convertToAssets() for exchange rate instead of Chainlink oracle.
///      stataUSDC is non-rebasing — its value in USDC increases as Aave lending yield accrues.
///      Same yield math as Base version (wstETH), different yield source (USDC lending vs ETH staking).
contract AgentTreasuryCelo {
    IERC20 public immutable yieldToken;      // stataUSDC on Celo
    IERC4626 public immutable rateSource;    // same address — stataUSDC IS the ERC4626 vault
    address public owner;
    address public agent;

    uint256 public depositedAmount;    // total stataUSDC deposited (principal baseline)
    uint256 public initialRate;        // convertToAssets(1e18) at first deposit
    uint256 public totalSpent;         // cumulative stataUSDC spent by agent
    uint256 public perTxCap;           // max stataUSDC per spend (0 = no cap)

    mapping(address => bool) public isRecipient;

    event Deposited(address indexed owner, uint256 amount, uint256 rate);
    event YieldSpent(address indexed agent, address indexed to, uint256 amount);
    event PrincipalWithdrawn(address indexed owner, uint256 amount);
    event AgentSet(address indexed agent);
    event RecipientAdded(address indexed to);
    event RecipientRemoved(address indexed to);
    event PerTxCapSet(uint256 cap);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "not agent");
        _;
    }

    /// @param _yieldToken stataUSDC address on Celo (also the ERC4626 vault)
    constructor(address _yieldToken) {
        yieldToken = IERC20(_yieldToken);
        rateSource = IERC4626(_yieldToken);  // same contract — stataUSDC implements ERC4626
        owner = msg.sender;
    }

    // --- Owner functions ---

    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "zero amount");
        require(yieldToken.transferFrom(msg.sender, address(this), amount), "transfer failed");

        if (depositedAmount == 0) {
            initialRate = _getRate();
        }
        depositedAmount += amount;

        emit Deposited(msg.sender, amount, _getRate());
    }

    function withdrawPrincipal() external onlyOwner {
        uint256 principalNow = _principalInShares();
        require(principalNow > 0, "nothing to withdraw");

        depositedAmount = 0;
        initialRate = 0;
        totalSpent = 0;

        require(yieldToken.transfer(msg.sender, principalNow), "transfer failed");
        emit PrincipalWithdrawn(msg.sender, principalNow);
    }

    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
        emit AgentSet(_agent);
    }

    function addRecipient(address to) external onlyOwner {
        isRecipient[to] = true;
        emit RecipientAdded(to);
    }

    function removeRecipient(address to) external onlyOwner {
        isRecipient[to] = false;
        emit RecipientRemoved(to);
    }

    function setPerTxCap(uint256 cap) external onlyOwner {
        perTxCap = cap;
        emit PerTxCapSet(cap);
    }

    // --- Agent functions ---

    function spendYield(address to, uint256 amount) external onlyAgent {
        require(isRecipient[to], "recipient not whitelisted");
        require(amount > 0, "zero amount");
        require(perTxCap == 0 || amount <= perTxCap, "exceeds per-tx cap");

        uint256 yield_ = availableYield();
        require(amount <= yield_, "exceeds available yield");

        totalSpent += amount;
        require(yieldToken.transfer(to, amount), "transfer failed");

        emit YieldSpent(msg.sender, to, amount);
    }

    // --- View functions ---

    function availableYield() public view returns (uint256) {
        if (depositedAmount == 0 || initialRate == 0) return 0;

        uint256 currentRate = _getRate();
        if (currentRate <= initialRate) return 0;

        // yield = deposited - (deposited * initialRate / currentRate)
        uint256 principalInShares = (depositedAmount * initialRate) / currentRate;
        uint256 totalYield = depositedAmount - principalInShares;

        if (totalYield <= totalSpent) return 0;
        return totalYield - totalSpent;
    }

    function principal() external view returns (uint256) {
        return _principalInShares();
    }

    function _principalInShares() internal view returns (uint256) {
        if (depositedAmount == 0) return 0;
        uint256 balance = yieldToken.balanceOf(address(this));
        uint256 yield_ = availableYield();
        return balance > yield_ ? balance - yield_ : 0;
    }

    /// @dev Reads exchange rate from ERC4626 vault — convertToAssets(1e18)
    ///      Uses 1e18 as the input regardless of token decimals to get high-precision rate.
    ///      Both initialRate and currentRate use same scale, so yield math stays consistent.
    function _getRate() internal view returns (uint256) {
        // Use 1e18 for precision — ratio math cancels out the scale
        uint256 rate = rateSource.convertToAssets(1e18);
        require(rate > 0, "invalid rate");
        return rate;
    }
}
