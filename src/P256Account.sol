// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IAccount} from "@account-abstraction/interfaces/IAccount.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {P256} from "./libraries/P256.sol";

/**
 * @title P256Account
 * @notice ERC-4337 Account Abstraction wallet with P-256/secp256r1 signature support
 * @dev Supports both raw P-256 signatures and WebAuthn/Passkey signatures
 */
contract P256Account is IAccount, IERC1271, Ownable {
    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice EIP-1271 magic value for valid signature
    bytes4 internal constant MAGICVALUE = 0x1626ba7e;

    /// @notice The EntryPoint contract
    IEntryPoint public immutable ENTRYPOINT;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The P-256 public key x-coordinate
    bytes32 public qx;

    /// @notice The P-256 public key y-coordinate
    bytes32 public qy;

    /// @notice Nonce for replay protection (in addition to EntryPoint nonce)
    uint256 public nonce;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event PublicKeyUpdated(bytes32 indexed qx, bytes32 indexed qy);
    event P256AccountInitialized(IEntryPoint indexed entryPoint, bytes32 qx, bytes32 qy);

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error OnlyEntryPoint();
    error OnlyEntryPointOrOwner();
    error InvalidSignature();
    error InvalidSignatureLength();
    error CallFailed(bytes result);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Constructor for P256Account
     * @param _entryPoint The EntryPoint contract address
     */
    constructor(IEntryPoint _entryPoint) Ownable(msg.sender) {
        ENTRYPOINT = _entryPoint;
    }

    /**
     * @notice Initialize the account with a P-256 public key
     * @param _qx The x-coordinate of the public key
     * @param _qy The y-coordinate of the public key
     * @param _owner The owner of the account
     */
    function initialize(bytes32 _qx, bytes32 _qy, address _owner) external {
        require(qx == bytes32(0) && qy == bytes32(0), "Already initialized");
        qx = _qx;
        qy = _qy;
        _transferOwnership(_owner);
        emit P256AccountInitialized(ENTRYPOINT, _qx, _qy);
    }

    /*//////////////////////////////////////////////////////////////
                          ERC-4337 FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Validate a user operation
     * @param userOp The user operation to validate
     * @param userOpHash The hash of the user operation
     * @param missingAccountFunds The amount of funds missing from the account
     * @return validationData Packed validation data (sigFailed, validUntil, validAfter)
     */
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        returns (uint256 validationData)
    {
        if (msg.sender != address(ENTRYPOINT)) {
            revert OnlyEntryPoint();
        }

        // Verify the signature
        validationData = _validateSignature(userOp, userOpHash);

        // Pay the EntryPoint if needed
        _payPrefund(missingAccountFunds);
    }

    /**
     * @notice Validate the signature of a user operation
     * @param userOp The user operation
     * @param userOpHash The hash of the user operation
     * @return validationData 0 if valid, 1 if invalid
     */
    function _validateSignature(PackedUserOperation calldata userOp, bytes32 userOpHash)
        internal
        view
        returns (uint256 validationData)
    {
        // Signature format: r (32 bytes) || s (32 bytes)
        bytes calldata sig = userOp.signature;

        if (sig.length != 64) {
            return 1; // SIG_VALIDATION_FAILED
        }

        bytes32 r;
        bytes32 s;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
        }

        // Use SHA-256 for the message hash (compatible with P-256 ecosystem)
        bytes32 messageHash = sha256(abi.encodePacked(userOpHash));

        // Verify the P-256 signature
        bool isValid = P256.verify(messageHash, r, s, qx, qy);

        return isValid ? 0 : 1;
    }

    /**
     * @notice Pay the EntryPoint the required prefund
     * @param missingAccountFunds The amount to pay
     */
    function _payPrefund(uint256 missingAccountFunds) internal {
        if (missingAccountFunds != 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            require(success, "Prefund failed");
        }
    }

    /*//////////////////////////////////////////////////////////////
                          EIP-1271 FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Verify a signature according to EIP-1271
     * @param hash The hash of the data to verify
     * @param signature The signature to verify (r || s, 64 bytes)
     * @return magicValue The EIP-1271 magic value if valid
     */
    function isValidSignature(bytes32 hash, bytes calldata signature)
        external
        view
        override
        returns (bytes4 magicValue)
    {
        if (signature.length != 64) {
            revert InvalidSignatureLength();
        }

        bytes32 r;
        bytes32 s;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
        }

        // Use SHA-256 for consistency with validateUserOp
        bytes32 messageHash = sha256(abi.encodePacked(hash));
        bool isValid = P256.verify(messageHash, r, s, qx, qy);

        return isValid ? MAGICVALUE : bytes4(0);
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNT MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update the P-256 public key
     * @param _qx The new x-coordinate
     * @param _qy The new y-coordinate
     */
    function updatePublicKey(bytes32 _qx, bytes32 _qy) external onlyOwner {
        qx = _qx;
        qy = _qy;
        emit PublicKeyUpdated(_qx, _qy);
    }

    /**
     * @notice Execute a call from this account
     * @param dest The destination address
     * @param value The amount of ETH to send
     * @param func The calldata
     */
    function execute(address dest, uint256 value, bytes calldata func) external {
        _requireFromEntryPointOrOwner();
        _call(dest, value, func);
    }

    /**
     * @notice Execute a batch of calls from this account
     * @param dest Array of destination addresses
     * @param value Array of ETH amounts
     * @param func Array of calldata
     */
    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external {
        _requireFromEntryPointOrOwner();
        require(dest.length == func.length && dest.length == value.length, "Length mismatch");

        for (uint256 i = 0; i < dest.length; i++) {
            _call(dest[i], value[i], func[i]);
        }
    }

    /**
     * @notice Internal function to execute a call
     * @param target The target address
     * @param value The amount of ETH to send
     * @param data The calldata
     */
    function _call(address target, uint256 value, bytes memory data) internal {
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            revert CallFailed(result);
        }
    }

    /**
     * @notice Require the caller to be the EntryPoint or the owner
     */
    function _requireFromEntryPointOrOwner() internal view {
        if (msg.sender != address(ENTRYPOINT) && msg.sender != owner()) {
            revert OnlyEntryPointOrOwner();
        }
    }

    /*//////////////////////////////////////////////////////////////
                              RECEIVE
    //////////////////////////////////////////////////////////////*/

    /// @notice Allow the account to receive ETH
    receive() external payable {}

    /**
     * @notice Get the current deposit in the EntryPoint
     */
    function getDeposit() public view returns (uint256) {
        return ENTRYPOINT.balanceOf(address(this));
    }

    /**
     * @notice Add deposit to the EntryPoint
     */
    function addDeposit() public payable {
        ENTRYPOINT.depositTo{value: msg.value}(address(this));
    }

    /**
     * @notice Withdraw deposit from the EntryPoint
     * @param withdrawAddress The address to withdraw to
     * @param amount The amount to withdraw
     */
    function withdrawDepositTo(address payable withdrawAddress, uint256 amount) public onlyOwner {
        ENTRYPOINT.withdrawTo(withdrawAddress, amount);
    }
}
