// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {
    IModule,
    IValidator,
    MODULE_TYPE_VALIDATOR,
    VALIDATION_SUCCESS,
    VALIDATION_FAILED
} from "@erc7579/interfaces/IERC7579Module.sol";
import {WebAuthn} from "solady/utils/WebAuthn.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";

/**
 * @title P256MFAValidatorModule
 * @notice ERC-7579 Validator Module with Owner + Passkey MFA
 * @dev Validates owner ECDSA signature with optional passkey as additional factor (MFA)
 *      - mfaEnabled = false: Owner ECDSA signature only
 *      - mfaEnabled = true: Owner ECDSA signature + Passkey signature (MFA)
 */
contract P256MFAValidatorModule is IValidator {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice ERC-1271 magic value
    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;

    /*//////////////////////////////////////////////////////////////
                          ERC-7201 STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @custom:storage-location erc7201:ethaura.storage.P256MFAValidatorModule
    struct P256MFAValidatorStorage {
        // Per-account passkey storage
        mapping(address account => mapping(bytes32 passkeyId => PasskeyInfo)) passkeys;
        mapping(address account => bytes32[]) passkeyIds;
        mapping(address account => uint256) passkeyCount;
        // MFA settings
        mapping(address account => address) owners;
        mapping(address account => bool) mfaEnabled;
    }

    struct PasskeyInfo {
        bytes32 qx;
        bytes32 qy;
        uint256 addedAt;
        bool active;
        bytes32 deviceId;
    }

    // keccak256(abi.encode(uint256(keccak256("ethaura.storage.P256MFAValidatorModule")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_LOCATION = 0x8a0c9d8ec1d9f8b8c1a5e6f7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d600;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event OwnerSet(address indexed account, address indexed owner);
    event MFAEnabled(address indexed account);
    event MFADisabled(address indexed account);
    event PasskeyAdded(address indexed account, bytes32 indexed passkeyId, bytes32 deviceId);
    event PasskeyRemoved(address indexed account, bytes32 indexed passkeyId);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error OnlyAccount();
    error OnlyAccountOrSelf();
    error InvalidOwner();
    error InvalidPasskey();
    error PasskeyAlreadyExists();
    error PasskeyDoesNotExist();
    error PasskeyNotActive();
    error CannotRemoveLastPasskey();
    error MFARequiresPasskey();

    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyAccount() {
        // msg.sender is the account calling this module
        _;
    }

    /*//////////////////////////////////////////////////////////////
                          STORAGE ACCESS
    //////////////////////////////////////////////////////////////*/

    function _getStorage() internal pure returns (P256MFAValidatorStorage storage $) {
        bytes32 location = STORAGE_LOCATION;
        assembly {
            $.slot := location
        }
    }

    /*//////////////////////////////////////////////////////////////
                          IModule INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IModule
    function onInstall(bytes calldata data) external override {
        P256MFAValidatorStorage storage $ = _getStorage();

        // Decode: owner, qx, qy, deviceId, enableMFA
        (address owner, bytes32 qx, bytes32 qy, bytes32 deviceId, bool shouldEnableMFA) =
            abi.decode(data, (address, bytes32, bytes32, bytes32, bool));

        if (owner == address(0)) revert InvalidOwner();

        // Set owner
        $.owners[msg.sender] = owner;
        emit OwnerSet(msg.sender, owner);

        // Add passkey if provided
        if (qx != bytes32(0) && qy != bytes32(0)) {
            _addPasskeyInternal(msg.sender, qx, qy, deviceId);
        }

        // Enable MFA if requested (requires passkey)
        if (shouldEnableMFA) {
            if ($.passkeyCount[msg.sender] == 0) revert MFARequiresPasskey();
            $.mfaEnabled[msg.sender] = true;
            emit MFAEnabled(msg.sender);
        }
    }

    /// @inheritdoc IModule
    function onUninstall(bytes calldata) external override {
        P256MFAValidatorStorage storage $ = _getStorage();

        // Clear owner
        delete $.owners[msg.sender];

        // Clear MFA
        delete $.mfaEnabled[msg.sender];

        // Clear all passkeys
        bytes32[] storage ids = $.passkeyIds[msg.sender];
        for (uint256 i = 0; i < ids.length; i++) {
            delete $.passkeys[msg.sender][ids[i]];
        }
        delete $.passkeyIds[msg.sender];
        delete $.passkeyCount[msg.sender];
    }

    /// @inheritdoc IModule
    function isModuleType(uint256 moduleTypeId) external pure override returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR;
    }

    /// @inheritdoc IModule
    function isInitialized(address account) external view override returns (bool) {
        return _getStorage().owners[account] != address(0);
    }

    /*//////////////////////////////////////////////////////////////
                      IValidator INTERFACE
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IValidator
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        view
        override
        returns (uint256)
    {
        P256MFAValidatorStorage storage $ = _getStorage();
        address account = msg.sender;
        address owner = $.owners[account];
        bool mfaEnabled = $.mfaEnabled[account];

        // Signature format: [validator(20B)][actualSignature]
        // Skip first 20 bytes (validator address) - already validated by AuraAccount
        if (userOp.signature.length < 20) return VALIDATION_FAILED;
        bytes calldata sig = userOp.signature[20:];

        // Owner-only mode: no MFA required
        if (!mfaEnabled) {
            if (sig.length != 65) return VALIDATION_FAILED;
            return _verifyOwnerSignature(userOpHash, sig, owner) ? VALIDATION_SUCCESS : VALIDATION_FAILED;
        }

        // MFA mode: requires WebAuthn signature + passkeyId + owner signature
        // Minimum: authDataLen(2) + authData(37) + clientData(20) + challengeIdx(2) +
        // typeIdx(2) + r(32) + s(32) + passkeyId(32) + ownerSig(65) = 224 bytes
        if (sig.length < 224) return VALIDATION_FAILED;

        // Extract owner signature (last 65 bytes)
        bytes calldata ownerSig = sig[sig.length - 65:];

        // Extract passkeyId (32 bytes before owner signature)
        bytes32 passkeyId = bytes32(sig[sig.length - 97:sig.length - 65]);

        // Extract WebAuthn compact signature (everything except passkeyId and owner signature)
        bytes calldata webAuthnSig = sig[:sig.length - 97];

        // Verify passkey signature
        PasskeyInfo storage passkeyInfo = $.passkeys[account][passkeyId];
        if (!passkeyInfo.active || passkeyInfo.qx == bytes32(0)) return VALIDATION_FAILED;

        // Decode and verify WebAuthn signature
        WebAuthn.WebAuthnAuth memory auth = WebAuthn.tryDecodeAuthCompactCalldata(webAuthnSig);
        bytes memory challenge = abi.encodePacked(userOpHash);

        bool webAuthnValid = WebAuthn.verify(
            challenge,
            true, // requireUserVerification
            auth,
            passkeyInfo.qx,
            passkeyInfo.qy
        );

        if (!webAuthnValid) return VALIDATION_FAILED;

        // Verify owner signature
        if (!_verifyOwnerSignature(userOpHash, ownerSig, owner)) return VALIDATION_FAILED;

        return VALIDATION_SUCCESS;
    }

    /// @inheritdoc IValidator
    /// @dev Signature format: [validator(20B)][actualSignature]
    ///      Skip first 20 bytes (validator address) - already validated by AuraAccount
    function isValidSignatureWithSender(address, bytes32 hash, bytes calldata signature)
        external
        view
        override
        returns (bytes4)
    {
        // Skip first 20 bytes (validator address)
        if (signature.length < 20) return bytes4(0xffffffff);
        bytes calldata sig = signature[20:];

        P256MFAValidatorStorage storage $ = _getStorage();
        address account = msg.sender;
        address owner = $.owners[account];
        bool mfaEnabled = $.mfaEnabled[account];

        // Owner-only mode
        if (!mfaEnabled) {
            if (sig.length != 65) return bytes4(0xffffffff);
            return _verifyOwnerSignature(hash, sig, owner) ? ERC1271_MAGIC_VALUE : bytes4(0xffffffff);
        }

        // MFA mode: same format as validateUserOp
        if (sig.length < 224) return bytes4(0xffffffff);

        bytes calldata ownerSig = sig[sig.length - 65:];
        bytes32 passkeyId = bytes32(sig[sig.length - 97:sig.length - 65]);
        bytes calldata webAuthnSig = sig[:sig.length - 97];

        PasskeyInfo storage passkeyInfo = $.passkeys[account][passkeyId];
        if (!passkeyInfo.active || passkeyInfo.qx == bytes32(0)) return bytes4(0xffffffff);

        WebAuthn.WebAuthnAuth memory auth = WebAuthn.tryDecodeAuthCompactCalldata(webAuthnSig);
        bytes memory challenge = abi.encodePacked(hash);

        bool webAuthnValid = WebAuthn.verify(challenge, true, auth, passkeyInfo.qx, passkeyInfo.qy);

        if (!webAuthnValid) return bytes4(0xffffffff);
        if (!_verifyOwnerSignature(hash, ownerSig, owner)) return bytes4(0xffffffff);

        return ERC1271_MAGIC_VALUE;
    }

    /*//////////////////////////////////////////////////////////////
                        SIGNATURE VERIFICATION
    //////////////////////////////////////////////////////////////*/

    function _verifyOwnerSignature(bytes32 hash, bytes calldata signature, address owner) internal view returns (bool) {
        address recovered = ECDSA.recover(hash, signature);
        return recovered == owner;
    }

    /*//////////////////////////////////////////////////////////////
                        PASSKEY MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Add a new passkey to the account
     * @param qx Public key x-coordinate
     * @param qy Public key y-coordinate
     * @param deviceId Device identifier
     */
    function addPasskey(bytes32 qx, bytes32 qy, bytes32 deviceId) external {
        _addPasskeyInternal(msg.sender, qx, qy, deviceId);
    }

    /**
     * @notice Remove a passkey from the account
     * @param passkeyId The passkey ID to remove
     */
    function removePasskey(bytes32 passkeyId) external {
        P256MFAValidatorStorage storage $ = _getStorage();
        address account = msg.sender;

        PasskeyInfo storage info = $.passkeys[account][passkeyId];
        if (!info.active) revert PasskeyDoesNotExist();

        // Cannot remove last passkey if MFA is enabled
        if ($.mfaEnabled[account] && $.passkeyCount[account] == 1) {
            revert CannotRemoveLastPasskey();
        }

        // Deactivate passkey
        info.active = false;
        $.passkeyCount[account]--;

        // Remove from passkeyIds array
        bytes32[] storage ids = $.passkeyIds[account];
        for (uint256 i = 0; i < ids.length; i++) {
            if (ids[i] == passkeyId) {
                ids[i] = ids[ids.length - 1];
                ids.pop();
                break;
            }
        }

        emit PasskeyRemoved(account, passkeyId);
    }

    function _addPasskeyInternal(address account, bytes32 qx, bytes32 qy, bytes32 deviceId) internal {
        if (qx == bytes32(0) || qy == bytes32(0)) revert InvalidPasskey();

        P256MFAValidatorStorage storage $ = _getStorage();
        bytes32 passkeyId = keccak256(abi.encodePacked(qx, qy));

        if ($.passkeys[account][passkeyId].active) revert PasskeyAlreadyExists();

        $.passkeys[account][passkeyId] =
            PasskeyInfo({qx: qx, qy: qy, addedAt: block.timestamp, active: true, deviceId: deviceId});

        $.passkeyIds[account].push(passkeyId);
        $.passkeyCount[account]++;

        emit PasskeyAdded(account, passkeyId, deviceId);
    }

    /*//////////////////////////////////////////////////////////////
                          MFA MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Enable MFA for the account
     */
    function enableMFA() external {
        P256MFAValidatorStorage storage $ = _getStorage();
        if ($.passkeyCount[msg.sender] == 0) revert MFARequiresPasskey();
        $.mfaEnabled[msg.sender] = true;
        emit MFAEnabled(msg.sender);
    }

    /**
     * @notice Disable MFA for the account
     */
    function disableMFA() external {
        P256MFAValidatorStorage storage $ = _getStorage();
        $.mfaEnabled[msg.sender] = false;
        emit MFADisabled(msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                         OWNER MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Set a new owner for the account
     * @param newOwner The new owner address
     */
    function setOwner(address newOwner) external {
        if (newOwner == address(0)) revert InvalidOwner();
        P256MFAValidatorStorage storage $ = _getStorage();
        $.owners[msg.sender] = newOwner;
        emit OwnerSet(msg.sender, newOwner);
    }

    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getOwner(address account) external view returns (address) {
        return _getStorage().owners[account];
    }

    function isMFAEnabled(address account) external view returns (bool) {
        return _getStorage().mfaEnabled[account];
    }

    function getPasskeyCount(address account) external view returns (uint256) {
        return _getStorage().passkeyCount[account];
    }

    function getPasskey(address account, bytes32 passkeyId) external view returns (PasskeyInfo memory) {
        return _getStorage().passkeys[account][passkeyId];
    }

    function isPasskeyActive(address account, bytes32 passkeyId) external view returns (bool) {
        return _getStorage().passkeys[account][passkeyId].active;
    }

    function getPasskeyIds(address account) external view returns (bytes32[] memory) {
        return _getStorage().passkeyIds[account];
    }
}

