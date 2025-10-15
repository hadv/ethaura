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
     * @param qx The x-coordinate of the P-256 public key
     * @param qy The y-coordinate of the P-256 public key
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @return account The address of the created account
     */
    function createAccount(bytes32 qx, bytes32 qy, address owner, uint256 salt) public returns (P256Account account) {
        address addr = getAddress(qx, qy, owner, salt);

        // If account already exists, return it
        uint256 codeSize = addr.code.length;
        if (codeSize > 0) {
            return P256Account(payable(addr));
        }

        // Deploy new account using CREATE2
        account = new P256Account{salt: bytes32(salt)}(ENTRYPOINT);

        // Initialize the account
        account.initialize(qx, qy, owner);

        emit AccountCreated(address(account), qx, qy, owner, salt);
    }

    /**
     * @notice Get the deterministic address for an account
     * @param qx The x-coordinate of the P-256 public key
     * @param qy The y-coordinate of the P-256 public key
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @return The predicted address
     */
    function getAddress(bytes32 qx, bytes32 qy, address owner, uint256 salt) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt), keccak256(abi.encodePacked(type(P256Account).creationCode, abi.encode(ENTRYPOINT)))
        );
    }

    /**
     * @notice Create account and add initial deposit
     * @param qx The x-coordinate of the P-256 public key
     * @param qy The y-coordinate of the P-256 public key
     * @param owner The owner address for the account
     * @param salt A salt for CREATE2 deployment
     * @return account The address of the created account
     */
    function createAccountWithDeposit(bytes32 qx, bytes32 qy, address owner, uint256 salt)
        external
        payable
        returns (P256Account account)
    {
        account = createAccount(qx, qy, owner, salt);

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
     * @return initCode The initCode bytes
     */
    function getInitCode(bytes32 qx, bytes32 qy, address owner, uint256 salt)
        external
        view
        returns (bytes memory initCode)
    {
        return abi.encodePacked(address(this), abi.encodeCall(this.createAccount, (qx, qy, owner, salt)));
    }
}
