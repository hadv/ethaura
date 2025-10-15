// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title P256
 * @notice Library for verifying ECDSA signatures on the secp256r1 (P-256) curve
 * @dev Uses EIP-7951 precompile at address 0x0100 (available on Sepolia after Fusaka upgrade)
 */
library P256 {
    /// @notice Address of the P256VERIFY precompile
    address internal constant P256VERIFY = address(uint160(0x0100));

    /// @notice secp256r1 curve order
    uint256 internal constant N = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551;

    /**
     * @notice Verify an ECDSA signature on the secp256r1 curve
     * @param hash The 32-byte message hash that was signed
     * @param r The r component of the signature (32 bytes)
     * @param s The s component of the signature (32 bytes)
     * @param qx The x-coordinate of the public key (32 bytes)
     * @param qy The y-coordinate of the public key (32 bytes)
     * @return ok True if the signature is valid, false otherwise
     */
    function verify(bytes32 hash, bytes32 r, bytes32 s, bytes32 qx, bytes32 qy) internal view returns (bool ok) {
        // Check for malleability: s must be in lower half of curve order
        // This prevents signature malleability attacks
        if (uint256(s) > N / 2) {
            return false;
        }

        // Prepare input: hash || r || s || qx || qy (160 bytes total)
        bytes memory input = abi.encodePacked(hash, r, s, qx, qy);

        // Call the precompile
        (bool success, bytes memory output) = P256VERIFY.staticcall(input);

        // Check if call succeeded and returned the expected success value
        // Output should be 32 bytes with value 0x01 for valid signature
        if (!success || output.length != 32) {
            return false;
        }

        return bytes32(output) == bytes32(uint256(1));
    }

    /**
     * @notice Verify an ECDSA signature without malleability check
     * @dev Use this only if you need to accept high-s signatures
     * @param hash The 32-byte message hash that was signed
     * @param r The r component of the signature (32 bytes)
     * @param s The s component of the signature (32 bytes)
     * @param qx The x-coordinate of the public key (32 bytes)
     * @param qy The y-coordinate of the public key (32 bytes)
     * @return ok True if the signature is valid, false otherwise
     */
    function verifyNoMalleabilityCheck(bytes32 hash, bytes32 r, bytes32 s, bytes32 qx, bytes32 qy)
        internal
        view
        returns (bool ok)
    {
        bytes memory input = abi.encodePacked(hash, r, s, qx, qy);
        (bool success, bytes memory output) = P256VERIFY.staticcall(input);

        if (!success || output.length != 32) {
            return false;
        }

        return bytes32(output) == bytes32(uint256(1));
    }

    /**
     * @notice Check if the precompile is available
     * @dev Useful for testing on networks that may not have the precompile
     * @return available True if the precompile is available
     */
    function isPrecompileAvailable() internal view returns (bool available) {
        // Try to call with dummy data
        bytes memory input = new bytes(160);
        (bool success,) = P256VERIFY.staticcall(input);
        return success;
    }
}
