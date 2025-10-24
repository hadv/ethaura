// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {P256Account} from "./P256Account.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

/**
 * @title P256AccountFactory
 * @notice Factory contract for deploying P256Account instances using CREATE2
 * @dev Allows deterministic account addresses based on public key and salt
 */
contract P256AccountFactory {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The EntryPoint contract
    IEntryPoint public immutable ENTRYPOINT;

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    event AccountCreated(address indexed account, bytes32 indexed qx, bytes32 indexed qy, address owner, uint256 salt);

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Constructor
     * @param _entryPoint The EntryPoint contract address
     */
    constructor(IEntryPoint _entryPoint) {
        ENTRYPOINT = _entryPoint;
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNT CREATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create a new P256Account
     * @param qx The x-coordinate of the P-256 public key (can be 0 for owner-only mode)
     * @param qy The y-coordinate of the P-256 public key (can be 0 for owner-only mode)
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @param enable2FA Whether to enable two-factor authentication immediately
     * @return account The address of the created account
     * @dev If qx=0 and qy=0, creates an owner-only account (no passkey)
     * @dev If qx and qy are set but enable2FA=false, passkey is registered but 2FA is not enforced
     * @dev If enable2FA=true, both qx and qy must be non-zero
     * @dev IMPORTANT: Account address depends ONLY on owner and salt, NOT on passkey (qx, qy)
     * @dev This allows users to add/change passkey later without changing the account address
     */
    function createAccount(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA) public returns (P256Account account) {
        address addr = getAddress(qx, qy, owner, salt);

        // If account already exists, return it
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return P256Account(payable(addr));
        }

        // Deploy new account using CREATE2 with salt based ONLY on owner and salt
        // NOT including qx, qy to allow passkey changes without address changes
        bytes32 finalSalt = keccak256(abi.encodePacked(owner, salt));
        account = new P256Account{salt: finalSalt}(ENTRYPOINT);

        // Initialize the account with optional 2FA
        account.initialize(qx, qy, owner, enable2FA);

        emit AccountCreated(address(account), qx, qy, owner, salt);
    }

    /**
     * @notice Get the deterministic address for an account
     * @param qx The x-coordinate of the P-256 public key (NOT used in address calculation)
     * @param qy The y-coordinate of the P-256 public key (NOT used in address calculation)
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @return The predicted address
     * @dev Address is calculated ONLY from owner and salt, NOT from passkey (qx, qy)
     * @dev This allows users to add/change passkey later without changing the account address
     */
    function getAddress(bytes32 qx, bytes32 qy, address owner, uint256 salt) public view returns (address) {
        // IMPORTANT: Only use owner and salt for address calculation
        // This allows the same address regardless of passkey choice
        // Users can receive funds first, then decide on passkey/2FA later
        bytes32 finalSalt = keccak256(abi.encodePacked(owner, salt));
        return Create2.computeAddress(
            finalSalt, keccak256(abi.encodePacked(type(P256Account).creationCode, abi.encode(ENTRYPOINT)))
        );
    }

    /**
     * @notice Create account and add initial deposit
     * @param qx The x-coordinate of the P-256 public key
     * @param qy The y-coordinate of the P-256 public key
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @param enable2FA Whether to enable two-factor authentication immediately
     * @return account The address of the created account
     */
    function createAccountWithDeposit(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA)
        external
        payable
        returns (P256Account account)
    {
        account = createAccount(qx, qy, owner, salt, enable2FA);

        // Add deposit to EntryPoint if ETH was sent
        if (msg.value > 0) {
            ENTRYPOINT.depositTo{value: msg.value}(address(account));
        }
    }

    /**
     * @notice Generate initCode for account creation
     * @dev This is used in UserOperation.initCode
     * @param qx The x-coordinate of the P-256 public key
     * @param qy The y-coordinate of the P-256 public key
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @param enable2FA Whether to enable two-factor authentication immediately
     * @return initCode The initCode bytes
     */
    function getInitCode(bytes32 qx, bytes32 qy, address owner, uint256 salt, bool enable2FA)
        external
        view
        returns (bytes memory initCode)
    {
        return abi.encodePacked(address(this), abi.encodeCall(this.createAccount, (qx, qy, owner, salt, enable2FA)));
    }
}
