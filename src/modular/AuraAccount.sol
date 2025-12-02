// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IAccount} from "@account-abstraction/interfaces/IAccount.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "@account-abstraction/interfaces/PackedUserOperation.sol";
import {Initializable} from "solady/utils/Initializable.sol";

// ERC-7579 interfaces and libraries from battle-tested reference implementation
import {IERC7579Account, Execution} from "@erc7579/interfaces/IERC7579Account.sol";
import {
    IModule,
    IValidator,
    IExecutor,
    IHook,
    IFallback,
    MODULE_TYPE_VALIDATOR,
    MODULE_TYPE_EXECUTOR,
    MODULE_TYPE_FALLBACK,
    MODULE_TYPE_HOOK
} from "@erc7579/interfaces/IERC7579Module.sol";
import {
    ModeCode,
    ModeLib,
    CallType,
    ExecType,
    CALLTYPE_SINGLE,
    CALLTYPE_BATCH,
    CALLTYPE_STATIC,
    CALLTYPE_DELEGATECALL,
    EXECTYPE_DEFAULT,
    EXECTYPE_TRY
} from "@erc7579/lib/ModeLib.sol";
import {ExecutionLib} from "@erc7579/lib/ExecutionLib.sol";

// ERC-4337 validation return values
uint256 constant VALIDATION_SUCCESS = 0;
uint256 constant VALIDATION_FAILED = 1;

/**
 * @title AuraAccount
 * @notice ERC-7579 Smart Account for EthAura
 * @dev Implements ERC-4337 Account Abstraction and ERC-7579 Modular Architecture
 *      Signature verification is delegated to validator modules (e.g., P256MFAValidatorModule)
 */
contract AuraAccount is IAccount, IERC7579Account, Initializable {
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice ERC-4337 EntryPoint v0.7
    IEntryPoint public constant ENTRYPOINT = IEntryPoint(0x0000000071727De22E5E9d8BAf0edAc6f37da032);

    /// @notice ERC-1271 magic value
    bytes4 internal constant ERC1271_MAGIC_VALUE = 0x1626ba7e;

    /// @notice Account implementation ID
    string public constant ACCOUNT_ID = "ethaura.aura.0.1.0";

    /// @notice Sentinel address for linked list
    address internal constant SENTINEL = address(0x1);

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice Installed validators (linked list)
    mapping(address => address) internal _validators;
    uint256 internal _validatorCount;

    /// @notice Installed executors
    mapping(address => bool) internal _executors;

    /// @notice Fallback handlers (selector => handler)
    mapping(bytes4 => address) internal _fallbackHandlers;

    /// @notice Global hook (single hook, can be MultiHook wrapper)
    address internal _globalHook;

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    error OnlyEntryPoint();
    error OnlyEntryPointOrSelf();
    error OnlyExecutorModule();
    error InvalidModule(address module);
    error ModuleAlreadyInstalled(address module);
    error ModuleNotInstalled(address module);
    error UnsupportedModuleType(uint256 moduleTypeId);
    error UnsupportedExecutionMode(ModeCode mode);
    error ExecutionFailed();
    error InvalidValidator();
    error NoValidatorInstalled();

    /*//////////////////////////////////////////////////////////////
                               MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyEntryPoint() {
        if (msg.sender != address(ENTRYPOINT)) revert OnlyEntryPoint();
        _;
    }

    modifier onlyEntryPointOrSelf() {
        if (msg.sender != address(ENTRYPOINT) && msg.sender != address(this)) {
            revert OnlyEntryPointOrSelf();
        }
        _;
    }

    modifier onlyExecutorModule() {
        if (!_executors[msg.sender]) revert OnlyExecutorModule();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                             CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() {
        _disableInitializers();
    }

    /*//////////////////////////////////////////////////////////////
                            INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Initialize the account with a default validator
     * @param defaultValidator The default validator module address
     * @param validatorData Initialization data for the validator
     * @param hook The global hook address (optional, address(0) for none)
     * @param hookData Initialization data for the hook
     */
    function initialize(address defaultValidator, bytes calldata validatorData, address hook, bytes calldata hookData)
        external
        initializer
    {
        // Initialize validator linked list
        _validators[SENTINEL] = SENTINEL;

        // Install default validator
        if (defaultValidator != address(0)) {
            _installValidator(defaultValidator, validatorData);
        }

        // Install hook if provided
        if (hook != address(0)) {
            _installHook(hook, hookData);
        }
    }

    /*//////////////////////////////////////////////////////////////
                              RECEIVE ETH
    //////////////////////////////////////////////////////////////*/

    receive() external payable {}

    /*//////////////////////////////////////////////////////////////
                            ERC-4337
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Validate a user operation (ERC-4337)
     * @dev Uses signature-based validator selection:
     *      - First 20 bytes of signature = validator address
     *      - Remaining bytes = actual signature for the validator
     *      This approach prevents validator injection attacks since the validator
     *      must be installed and the signature format is validator-specific.
     * @param userOp The user operation
     * @param userOpHash The hash of the user operation
     * @param missingAccountFunds Funds to prefund
     * @return validationData Packed validation data
     */
    function validateUserOp(PackedUserOperation calldata userOp, bytes32 userOpHash, uint256 missingAccountFunds)
        external
        onlyEntryPoint
        returns (uint256 validationData)
    {
        // Extract validator address from signature prefix (first 20 bytes)
        if (userOp.signature.length < 20) {
            revert InvalidValidator();
        }
        address validator = address(bytes20(userOp.signature[0:20]));

        // CRITICAL: Verify validator is installed to prevent malicious validator injection
        if (_validators[validator] == address(0)) {
            revert InvalidValidator();
        }

        // Delegate validation to the selected validator module
        // The validator is responsible for extracting its own signature format from signature[20:]
        validationData = IValidator(validator).validateUserOp(userOp, userOpHash);

        // Pay prefund
        if (missingAccountFunds > 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            (success); // Silence unused variable warning
        }
    }

    /*//////////////////////////////////////////////////////////////
                            EXECUTION
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IERC7579Account
    function execute(ModeCode mode, bytes calldata executionCalldata) external payable onlyEntryPointOrSelf {
        _executeWithHook(mode, executionCalldata);
    }

    /// @inheritdoc IERC7579Account
    function executeFromExecutor(ModeCode mode, bytes calldata executionCalldata)
        external
        payable
        onlyExecutorModule
        returns (bytes[] memory returnData)
    {
        returnData = _executeWithHook(mode, executionCalldata);
    }

    /**
     * @notice Execute with hook pre/post checks
     */
    function _executeWithHook(ModeCode mode, bytes calldata executionCalldata)
        internal
        returns (bytes[] memory returnData)
    {
        // Pre-check hook
        bytes memory hookData;
        if (_globalHook != address(0)) {
            hookData = IHook(_globalHook).preCheck(msg.sender, msg.value, executionCalldata);
        }

        // Execute
        returnData = _execute(mode, executionCalldata);

        // Post-check hook
        if (_globalHook != address(0)) {
            IHook(_globalHook).postCheck(hookData);
        }
    }

    /**
     * @notice Internal execution logic
     */
    function _execute(ModeCode mode, bytes calldata executionCalldata) internal returns (bytes[] memory returnData) {
        (CallType callType, ExecType execType,,) = ModeLib.decode(mode);

        if (callType == CALLTYPE_SINGLE) {
            returnData = _executeSingle(executionCalldata, execType);
        } else if (callType == CALLTYPE_BATCH) {
            returnData = _executeBatch(executionCalldata, execType);
        } else if (callType == CALLTYPE_STATIC) {
            returnData = _executeStatic(executionCalldata);
        } else if (callType == CALLTYPE_DELEGATECALL) {
            returnData = _executeDelegatecall(executionCalldata, execType);
        } else {
            revert UnsupportedExecutionMode(mode);
        }
    }

    /**
     * @notice Execute a single call
     */
    function _executeSingle(bytes calldata executionCalldata, ExecType execType)
        internal
        returns (bytes[] memory returnData)
    {
        (address target, uint256 value, bytes calldata data) = ExecutionLib.decodeSingle(executionCalldata);

        returnData = new bytes[](1);

        bool success;
        (success, returnData[0]) = target.call{value: value}(data);

        if (execType == EXECTYPE_DEFAULT && !success) {
            revert ExecutionFailed();
        }
    }

    /**
     * @notice Execute a batch of calls
     */
    function _executeBatch(bytes calldata executionCalldata, ExecType execType)
        internal
        returns (bytes[] memory returnData)
    {
        Execution[] calldata executions = ExecutionLib.decodeBatch(executionCalldata);
        returnData = new bytes[](executions.length);

        for (uint256 i = 0; i < executions.length; i++) {
            bool success;
            (success, returnData[i]) = executions[i].target.call{value: executions[i].value}(executions[i].callData);

            if (execType == EXECTYPE_DEFAULT && !success) {
                revert ExecutionFailed();
            }
        }
    }

    /**
     * @notice Execute a static call (view only)
     */
    function _executeStatic(bytes calldata executionCalldata) internal view returns (bytes[] memory returnData) {
        (address target,, bytes calldata data) = ExecutionLib.decodeSingle(executionCalldata);

        returnData = new bytes[](1);
        bool success;
        (success, returnData[0]) = target.staticcall(data);

        if (!success) {
            revert ExecutionFailed();
        }
    }

    /**
     * @notice Execute a delegate call (DANGEROUS - use with care)
     */
    function _executeDelegatecall(bytes calldata executionCalldata, ExecType execType)
        internal
        returns (bytes[] memory returnData)
    {
        (address target,, bytes calldata data) = ExecutionLib.decodeSingle(executionCalldata);

        // TODO: Add whitelist check for delegatecall targets

        returnData = new bytes[](1);
        bool success;
        (success, returnData[0]) = target.delegatecall(data);

        if (execType == EXECTYPE_DEFAULT && !success) {
            revert ExecutionFailed();
        }
    }

    /*//////////////////////////////////////////////////////////////
                          MODULE MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IERC7579Account
    function installModule(uint256 moduleTypeId, address module, bytes calldata initData)
        external
        payable
        onlyEntryPointOrSelf
    {
        if (module == address(0)) revert InvalidModule(module);

        if (moduleTypeId == MODULE_TYPE_VALIDATOR) {
            _installValidator(module, initData);
        } else if (moduleTypeId == MODULE_TYPE_EXECUTOR) {
            _installExecutor(module, initData);
        } else if (moduleTypeId == MODULE_TYPE_FALLBACK) {
            _installFallback(module, initData);
        } else if (moduleTypeId == MODULE_TYPE_HOOK) {
            _installHook(module, initData);
        } else {
            revert UnsupportedModuleType(moduleTypeId);
        }

        emit ModuleInstalled(moduleTypeId, module);
    }

    /// @inheritdoc IERC7579Account
    function uninstallModule(uint256 moduleTypeId, address module, bytes calldata deInitData)
        external
        payable
        onlyEntryPointOrSelf
    {
        if (module == address(0)) revert InvalidModule(module);

        if (moduleTypeId == MODULE_TYPE_VALIDATOR) {
            _uninstallValidator(module, deInitData);
        } else if (moduleTypeId == MODULE_TYPE_EXECUTOR) {
            _uninstallExecutor(module, deInitData);
        } else if (moduleTypeId == MODULE_TYPE_FALLBACK) {
            _uninstallFallback(module, deInitData);
        } else if (moduleTypeId == MODULE_TYPE_HOOK) {
            _uninstallHook(module, deInitData);
        } else {
            revert UnsupportedModuleType(moduleTypeId);
        }

        emit ModuleUninstalled(moduleTypeId, module);
    }

    /*//////////////////////////////////////////////////////////////
                       VALIDATOR MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function _installValidator(address validator, bytes calldata data) internal {
        if (_validators[validator] != address(0)) {
            revert ModuleAlreadyInstalled(validator);
        }

        // Add to linked list (insert at head)
        _validators[validator] = _validators[SENTINEL];
        _validators[SENTINEL] = validator;
        _validatorCount++;

        // Call onInstall
        IValidator(validator).onInstall(data);
    }

    function _uninstallValidator(address validator, bytes calldata data) internal {
        if (_validators[validator] == address(0)) {
            revert ModuleNotInstalled(validator);
        }

        // Find previous in linked list
        address prev = SENTINEL;
        address current = _validators[SENTINEL];
        while (current != SENTINEL && current != validator) {
            prev = current;
            current = _validators[current];
        }

        if (current != validator) {
            revert ModuleNotInstalled(validator);
        }

        // Remove from linked list
        _validators[prev] = _validators[validator];
        _validators[validator] = address(0);
        _validatorCount--;

        // Call onUninstall
        IValidator(validator).onUninstall(data);
    }

    /*//////////////////////////////////////////////////////////////
                       EXECUTOR MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function _installExecutor(address executor, bytes calldata data) internal {
        if (_executors[executor]) {
            revert ModuleAlreadyInstalled(executor);
        }

        _executors[executor] = true;
        IExecutor(executor).onInstall(data);
    }

    function _uninstallExecutor(address executor, bytes calldata data) internal {
        if (!_executors[executor]) {
            revert ModuleNotInstalled(executor);
        }

        _executors[executor] = false;
        IExecutor(executor).onUninstall(data);
    }

    /*//////////////////////////////////////////////////////////////
                       FALLBACK MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function _installFallback(address handler, bytes calldata data) internal {
        // Decode selector from data
        bytes4 selector = bytes4(data[:4]);
        bytes calldata initData = data[4:];

        if (_fallbackHandlers[selector] != address(0)) {
            revert ModuleAlreadyInstalled(handler);
        }

        _fallbackHandlers[selector] = handler;
        IFallback(handler).onInstall(initData);
    }

    function _uninstallFallback(address handler, bytes calldata data) internal {
        bytes4 selector = bytes4(data[:4]);
        bytes calldata deInitData = data[4:];

        if (_fallbackHandlers[selector] != handler) {
            revert ModuleNotInstalled(handler);
        }

        _fallbackHandlers[selector] = address(0);
        IFallback(handler).onUninstall(deInitData);
    }

    /*//////////////////////////////////////////////////////////////
                         HOOK MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function _installHook(address hook, bytes calldata data) internal {
        if (_globalHook != address(0)) {
            revert ModuleAlreadyInstalled(hook);
        }

        _globalHook = hook;
        IHook(hook).onInstall(data);
    }

    function _uninstallHook(address hook, bytes calldata data) internal {
        if (_globalHook != hook) {
            revert ModuleNotInstalled(hook);
        }

        _globalHook = address(0);
        IHook(hook).onUninstall(data);
    }

    /*//////////////////////////////////////////////////////////////
                            ERC-1271
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IERC7579Account
    /// @dev Uses signature-based validator selection (same as validateUserOp):
    ///      - First 20 bytes = validator address
    ///      - Remaining bytes = actual signature for the validator
    function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4) {
        // Extract validator from signature prefix
        if (signature.length < 20) {
            return bytes4(0xffffffff);
        }
        address validator = address(bytes20(signature[0:20]));

        // Verify validator is installed
        if (_validators[validator] == address(0)) {
            return bytes4(0xffffffff);
        }

        // Delegate to validator (validator extracts its signature format from signature[20:])
        return IValidator(validator).isValidSignatureWithSender(msg.sender, hash, signature);
    }

    /*//////////////////////////////////////////////////////////////
                          ACCOUNT CONFIG
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IERC7579Account
    function supportsExecutionMode(ModeCode mode) external pure returns (bool) {
        (CallType callType, ExecType execType,,) = ModeLib.decode(mode);

        // Support single, batch, static calls
        if (callType == CALLTYPE_SINGLE || callType == CALLTYPE_BATCH || callType == CALLTYPE_STATIC) {
            // Support default and try exec types
            return execType == EXECTYPE_DEFAULT || execType == EXECTYPE_TRY;
        }

        // Delegatecall is optional and dangerous
        if (callType == CALLTYPE_DELEGATECALL) {
            return execType == EXECTYPE_DEFAULT || execType == EXECTYPE_TRY;
        }

        return false;
    }

    /// @inheritdoc IERC7579Account
    function supportsModule(uint256 moduleTypeId) external pure returns (bool) {
        return moduleTypeId == MODULE_TYPE_VALIDATOR || moduleTypeId == MODULE_TYPE_EXECUTOR
            || moduleTypeId == MODULE_TYPE_FALLBACK || moduleTypeId == MODULE_TYPE_HOOK;
    }

    /// @inheritdoc IERC7579Account
    function isModuleInstalled(uint256 moduleTypeId, address module, bytes calldata additionalContext)
        external
        view
        returns (bool)
    {
        (additionalContext); // Silence unused variable warning

        if (moduleTypeId == MODULE_TYPE_VALIDATOR) {
            return _validators[module] != address(0);
        } else if (moduleTypeId == MODULE_TYPE_EXECUTOR) {
            return _executors[module];
        } else if (moduleTypeId == MODULE_TYPE_FALLBACK) {
            // Check if module is handler for any selector
            // For specific selector check, use additionalContext
            if (additionalContext.length >= 4) {
                bytes4 selector = bytes4(additionalContext[:4]);
                return _fallbackHandlers[selector] == module;
            }
            return false;
        } else if (moduleTypeId == MODULE_TYPE_HOOK) {
            return _globalHook == module;
        }

        return false;
    }

    /// @inheritdoc IERC7579Account
    function accountId() external pure returns (string memory) {
        return ACCOUNT_ID;
    }

    /*//////////////////////////////////////////////////////////////
                            FALLBACK
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Fallback function to route unknown selectors to fallback handlers
     */
    fallback() external payable {
        address handler = _fallbackHandlers[msg.sig];
        if (handler == address(0)) {
            revert("No fallback handler");
        }

        // Forward call to handler
        assembly {
            // Copy calldata
            calldatacopy(0, 0, calldatasize())

            // Delegatecall to handler
            let result := delegatecall(gas(), handler, 0, calldatasize(), 0, 0)

            // Copy return data
            returndatacopy(0, 0, returndatasize())

            // Return or revert
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Get the number of installed validators
     */
    function getValidatorCount() external view returns (uint256) {
        return _validatorCount;
    }

    /**
     * @notice Get the global hook address
     */
    function getGlobalHook() external view returns (address) {
        return _globalHook;
    }

    /**
     * @notice Get the fallback handler for a selector
     */
    function getFallbackHandler(bytes4 selector) external view returns (address) {
        return _fallbackHandlers[selector];
    }
}
