// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {AuraAccount} from "../../../../src/modular/AuraAccount.sol";
import {SessionKeyExecutorModule} from "../../../../src/modular/modules/executors/SessionKeyExecutorModule.sol";
import {P256MFAValidatorModule} from "../../../../src/modular/modules/validators/P256MFAValidatorModule.sol";

import {MODULE_TYPE_EXECUTOR} from "@erc7579/interfaces/IERC7579Module.sol";
import {ModeLib} from "@erc7579/lib/ModeLib.sol";
import {ExecutionLib} from "@erc7579/lib/ExecutionLib.sol";

/**
 * @title AccountHandler
 * @notice Handler contract for invariant testing of AuraAccount
 * @dev Exposes bounded actions that can be called during invariant testing
 */
contract AccountHandler is Test {
    AuraAccount public account;
    SessionKeyExecutorModule public sessionKeyModule;
    P256MFAValidatorModule public validator;

    address public constant ENTRYPOINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    // Ghost variables for tracking state
    uint256 public totalSessionKeysCreated;
    uint256 public totalSessionKeysRevoked;
    uint256 public totalPasskeysAdded;
    uint256 public totalPasskeysRemoved;
    uint256 public totalExecutions;
    uint256 public totalValueSent;

    // Session key tracking
    address[] public sessionKeys;
    mapping(address => bool) public isActiveSessionKey;
    mapping(address => bool) public sessionKeyExists; // Track if key was ever created

    constructor(AuraAccount _account, SessionKeyExecutorModule _sessionKeyModule, P256MFAValidatorModule _validator) {
        account = _account;
        sessionKeyModule = _sessionKeyModule;
        validator = _validator;
    }

    /*//////////////////////////////////////////////////////////////
                        SESSION KEY ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a session key with bounded parameters
    function createSessionKey(
        uint256 privateKeySeed,
        uint256 validDuration,
        uint256 spendLimitPerTx,
        uint256 spendLimitTotal
    ) external {
        // Bound inputs
        privateKeySeed = bound(privateKeySeed, 1, 1000);
        validDuration = bound(validDuration, 1 hours, 30 days);
        spendLimitPerTx = bound(spendLimitPerTx, 0.01 ether, 100 ether);
        spendLimitTotal = bound(spendLimitTotal, spendLimitPerTx, 1000 ether);

        address sessionKey = vm.addr(privateKeySeed);

        // Skip if already exists
        if (isActiveSessionKey[sessionKey]) return;

        SessionKeyExecutorModule.SessionKeyPermission memory permission = SessionKeyExecutorModule.SessionKeyPermission({
            sessionKey: sessionKey,
            validAfter: uint48(block.timestamp),
            validUntil: uint48(block.timestamp + validDuration),
            allowedTargets: new address[](0),
            allowedSelectors: new bytes4[](0),
            spendLimitPerTx: spendLimitPerTx,
            spendLimitTotal: spendLimitTotal
        });

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.createSessionKey, (permission));

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));

        // Only push to array if this is a new key (not a re-creation)
        if (!sessionKeyExists[sessionKey]) {
            sessionKeys.push(sessionKey);
            sessionKeyExists[sessionKey] = true;
        }
        isActiveSessionKey[sessionKey] = true;
        totalSessionKeysCreated++;
    }

    /// @notice Revoke a session key
    function revokeSessionKey(uint256 index) external {
        if (sessionKeys.length == 0) return;

        index = bound(index, 0, sessionKeys.length - 1);
        address sessionKey = sessionKeys[index];

        if (!isActiveSessionKey[sessionKey]) return;

        bytes memory callData = abi.encodeCall(SessionKeyExecutorModule.revokeSessionKey, (sessionKey));

        vm.prank(ENTRYPOINT);
        account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(sessionKeyModule), 0, callData));

        isActiveSessionKey[sessionKey] = false;
        totalSessionKeysRevoked++;
    }

    /*//////////////////////////////////////////////////////////////
                        PASSKEY ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Add a passkey with random coordinates
    function addPasskey(bytes32 qx, bytes32 qy, bytes32 deviceId) external {
        // Ensure non-zero
        if (qx == bytes32(0) || qy == bytes32(0)) return;

        bytes memory callData = abi.encodeCall(P256MFAValidatorModule.addPasskey, (qx, qy, deviceId));

        vm.prank(ENTRYPOINT);
        try account.execute(ModeLib.encodeSimpleSingle(), ExecutionLib.encodeSingle(address(validator), 0, callData)) {
            totalPasskeysAdded++;
        } catch {
            // Passkey might already exist
        }
    }

    /*//////////////////////////////////////////////////////////////
                          GETTERS
    //////////////////////////////////////////////////////////////*/

    function getSessionKeyCount() external view returns (uint256) {
        return sessionKeys.length;
    }

    function getActiveSessionKeyCount() external view returns (uint256) {
        uint256 count;
        for (uint256 i = 0; i < sessionKeys.length; i++) {
            if (isActiveSessionKey[sessionKeys[i]]) count++;
        }
        return count;
    }
}

