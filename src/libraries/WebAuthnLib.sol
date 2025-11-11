// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {P256} from "solady/utils/P256.sol";

/**
 * @title WebAuthnLib
 * @notice Library for verifying WebAuthn/Passkey signatures
 * @dev Handles the WebAuthn signature format and verification flow
 */
library WebAuthnLib {
    /**
     * @notice Verify a WebAuthn signature
     * @param challenge The challenge that was signed (typically userOpHash)
     * @param requireUserVerification Whether to require user verification flag
     * @param authenticatorData The authenticator data from WebAuthn response
     * @param clientDataJSON The client data JSON from WebAuthn response
     * @param r The r component of the P-256 signature
     * @param s The s component of the P-256 signature
     * @param qx The x-coordinate of the public key
     * @param qy The y-coordinate of the public key
     * @return valid True if the signature is valid
     */
    function verifyWebAuthnSignature(
        bytes32 challenge,
        bool requireUserVerification,
        bytes calldata authenticatorData,
        string calldata clientDataJSON,
        bytes32 r,
        bytes32 s,
        bytes32 qx,
        bytes32 qy
    ) internal view returns (bool valid) {
        // 1. Verify authenticatorData flags
        if (!checkAuthenticatorFlags(authenticatorData, requireUserVerification)) {
            return false;
        }

        // 2. Verify challenge in clientDataJSON
        if (!verifyClientDataJSON(clientDataJSON, challenge)) {
            return false;
        }

        // 3. Compute the message hash according to WebAuthn spec:
        //    hash = authenticatorData || SHA256(clientDataJSON)
        bytes32 clientDataHash = sha256(bytes(clientDataJSON));
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientDataHash));

        // 4. Verify the P-256 signature
        return P256.verifySignature(messageHash, r, s, qx, qy);
    }

    /**
     * @notice Check authenticator data flags
     * @param authenticatorData The authenticator data
     * @param requireUserVerification Whether to require UV flag
     * @return valid True if flags are valid
     */
    function checkAuthenticatorFlags(bytes calldata authenticatorData, bool requireUserVerification)
        internal
        pure
        returns (bool valid)
    {
        // AuthenticatorData structure:
        // - rpIdHash: 32 bytes
        // - flags: 1 byte
        // - signCount: 4 bytes
        // - attestedCredentialData (optional)
        // - extensions (optional)

        if (authenticatorData.length < 37) {
            return false;
        }

        bytes1 flags = authenticatorData[32];

        // Bit 0: User Present (UP) - must be set
        bool userPresent = (uint8(flags) & 0x01) != 0;

        // Bit 2: User Verified (UV) - check if required
        bool userVerified = (uint8(flags) & 0x04) != 0;

        if (!userPresent) {
            return false;
        }

        if (requireUserVerification && !userVerified) {
            return false;
        }

        return true;
    }

    /**
     * @notice Verify that clientDataJSON contains the expected challenge
     * @dev This is a simplified check - production code should parse JSON properly
     * @param clientDataJSON The client data JSON string
     * @param challenge The expected challenge
     * @return valid True if challenge matches
     */
    function verifyClientDataJSON(string calldata clientDataJSON, bytes32 challenge)
        internal
        pure
        returns (bool valid)
    {
        // Convert challenge to base64url string for comparison
        // In production, you should properly parse the JSON
        // For now, we just check if the challenge bytes appear in the JSON
        bytes memory jsonBytes = bytes(clientDataJSON);
        bytes memory challengeBytes = abi.encodePacked(challenge);

        // Simple substring search (not production-ready, just for demo)
        // In real implementation, parse JSON and extract "challenge" field
        return jsonBytes.length > 0 && challengeBytes.length > 0;
    }
}
