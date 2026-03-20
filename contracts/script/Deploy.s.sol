// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Foundry deploy script — run with:
//   cd contracts && forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast

import "../src/MockWstETH.sol";
import "../src/AgentTreasury.sol";

contract Deploy {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy mock wstETH (testnet only — on mainnet use real wstETH)
        MockWstETH mock = new MockWstETH();

        // 2. Deploy AgentTreasury pointing at mock wstETH
        AgentTreasury treasury = new AgentTreasury(address(mock));

        vm.stopBroadcast();
    }

    // Foundry cheatcode interface
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
}

interface Vm {
    function envUint(string calldata) external returns (uint256);
    function startBroadcast(uint256) external;
    function stopBroadcast() external;
}
