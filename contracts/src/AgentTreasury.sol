// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IWstETH.sol";

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

/// @title AgentTreasury — yield-only spending for AI agents
/// @notice Human deposits wstETH. Agent spends only accrued yield. Principal is locked.
/// @dev Uses Chainlink oracle for wstETH/stETH exchange rate on L2 (Base),
///      since bridged wstETH does not expose stEthPerToken().
contract AgentTreasury {
    IWstETH public immutable wstETH;
    AggregatorV3Interface public immutable rateOracle;
    address public owner;
    address public agent;

    uint256 public depositedWstETH;    // total wstETH deposited (principal baseline)
    uint256 public initialRate;         // stEthPerToken at first deposit
    uint256 public totalSpent;          // cumulative wstETH spent by agent
    uint256 public perTxCap;            // max wstETH per spend (0 = no cap)

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

    constructor(address _wstETH, address _rateOracle) {
        wstETH = IWstETH(_wstETH);
        rateOracle = AggregatorV3Interface(_rateOracle);
        owner = msg.sender;
    }

    // --- Owner functions ---

    function deposit(uint256 amount) external onlyOwner {
        require(amount > 0, "zero amount");
        require(wstETH.transferFrom(msg.sender, address(this), amount), "transfer failed");

        if (depositedWstETH == 0) {
            initialRate = _getRate();
        }
        depositedWstETH += amount;

        emit Deposited(msg.sender, amount, _getRate());
    }

    function withdrawPrincipal() external onlyOwner {
        uint256 principalNow = _principalInWstETH();
        require(principalNow > 0, "nothing to withdraw");

        depositedWstETH = 0;
        initialRate = 0;
        totalSpent = 0;

        require(wstETH.transfer(msg.sender, principalNow), "transfer failed");
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

        uint256 yield = availableYield();
        require(amount <= yield, "exceeds available yield");

        totalSpent += amount;
        require(wstETH.transfer(to, amount), "transfer failed");

        emit YieldSpent(msg.sender, to, amount);
    }

    // --- View functions ---

    function availableYield() public view returns (uint256) {
        if (depositedWstETH == 0 || initialRate == 0) return 0;

        uint256 currentRate = _getRate();
        if (currentRate <= initialRate) return 0;

        // yieldWstETH = deposited - (deposited * initialRate / currentRate)
        // This is the wstETH amount that represents pure yield
        uint256 principalInWstETH = (depositedWstETH * initialRate) / currentRate;
        uint256 totalYield = depositedWstETH - principalInWstETH;

        if (totalYield <= totalSpent) return 0;
        return totalYield - totalSpent;
    }

    function principal() external view returns (uint256) {
        return _principalInWstETH();
    }

    function _principalInWstETH() internal view returns (uint256) {
        if (depositedWstETH == 0) return 0;
        uint256 balance = wstETH.balanceOf(address(this));
        uint256 yield = availableYield();
        // Principal = whatever is in the contract minus unspent yield
        return balance > yield ? balance - yield : 0;
    }

    /// @dev Reads wstETH/stETH exchange rate from Chainlink oracle (18 decimals)
    function _getRate() internal view returns (uint256) {
        (, int256 answer,,,) = rateOracle.latestRoundData();
        require(answer > 0, "invalid oracle rate");
        return uint256(answer);
    }
}
