// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/libraries/P256.sol";

/**
 * @title VerifyWebAuthnSig
 * @notice Test to verify a specific WebAuthn signature
 */
contract VerifyWebAuthnSigTest is Test {
    function test_VerifyRealWebAuthnSignature() public view {
        // Public key from factoryData
        bytes32 qx = 0xcd64d312c53f5d6773debcfe7031bd1074d9082b072cc71ca0fffab2735a5ec1;
        bytes32 qy = 0x8e657ad708338e9021127ae67e90f98875342d4d6c38d5f90ff7cf1841669f13;

        // Signature from console
        bytes32 r = 0xf12c42a78f0efa2d3ad69dbede63603389dc1ba944d300b087ea1cd195b98ba6;
        bytes32 s = 0xa96e19599f04290a77fc7e4ce8ef8b3dc9d3b0a6f77c74c90d96e673b6434ede;

        // Message hash (computed from authenticatorData + clientDataJSON)
        bytes32 messageHash = 0xd7cec55e322302be89b6c8052974f5266287ba60cebabdf3ce48ee31788e3a5f;

        // Verify the signature
        bool isValid = P256.verify(messageHash, r, s, qx, qy);

        console.log("Signature verification result:", isValid);
        console.log("Public key qx:", vm.toString(qx));
        console.log("Public key qy:", vm.toString(qy));
        console.log("Signature r:", vm.toString(r));
        console.log("Signature s:", vm.toString(s));
        console.log("Message hash:", vm.toString(messageHash));

        assertTrue(isValid, "Signature should be valid");
    }

    function test_VerifySignatureComponents() public view {
        // AuthenticatorData
        bytes memory authenticatorData = hex"49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97631d00000000";
        
        // ClientDataJSON
        string memory clientDataJSON = '{"type":"webauthn.get","challenge":"xk3SGdn5s_QE8zuWN3Yn33G81_DI7oLsdqO8RGwthSo","origin":"http://localhost:3000","crossOrigin":false}';
        
        // Compute hashes
        bytes32 clientDataHash = sha256(bytes(clientDataJSON));
        bytes32 messageHash = sha256(abi.encodePacked(authenticatorData, clientDataHash));
        
        console.log("ClientDataHash:", vm.toString(clientDataHash));
        console.log("MessageHash:", vm.toString(messageHash));
        
        // Expected values
        assertEq(clientDataHash, 0x37baba0da8fb389dd03b1dda7fb23dc38b730e5f3c3df56388dc72e8f22cbe7b, "ClientDataHash mismatch");
        assertEq(messageHash, 0xd7cec55e322302be89b6c8052974f5266287ba60cebabdf3ce48ee31788e3a5f, "MessageHash mismatch");
    }
}

