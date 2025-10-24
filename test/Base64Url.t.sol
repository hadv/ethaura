// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {Base64Url} from "../src/libraries/Base64Url.sol";

contract Base64UrlTest is Test {
    function test_EncodeBytes32() public pure {
        // Test encoding a 32-byte hash
        bytes32 hash = 0xf631058a3ba1116acce12396fad0a125b5041c43f8e15723709f81aa8d5f4ccf;

        bytes memory encoded = Base64Url.encode(hash);

        // Base64url encoding of 32 bytes should be 43 characters (no padding)
        assertEq(encoded.length, 43, "Encoded length should be 43");

        // The actual encoded value (verified by the test output)
        string memory expected = "9jEFijuhEWrM4SOW-tChJbUEHEP44VcjcJ-Bqo1fTM8";
        assertEq(string(encoded), expected, "Encoded value should match expected");
    }

    function test_EncodeEmptyBytes() public pure {
        bytes memory empty = "";
        bytes memory encoded = Base64Url.encode(empty);
        
        assertEq(encoded.length, 0, "Empty bytes should encode to empty string");
    }

    function test_EncodeShortBytes() public pure {
        // Test with 1 byte (should be 2 characters, no padding)
        bytes memory data1 = hex"ff";
        bytes memory encoded1 = Base64Url.encode(data1);
        assertEq(encoded1.length, 2, "1 byte should encode to 2 characters");
        assertEq(string(encoded1), "_w", "1 byte encoding should match");

        // Test with 2 bytes (should be 3 characters, no padding)
        bytes memory data2 = hex"ffff";
        bytes memory encoded2 = Base64Url.encode(data2);
        assertEq(encoded2.length, 3, "2 bytes should encode to 3 characters");
        assertEq(string(encoded2), "__8", "2 bytes encoding should match");

        // Test with 3 bytes (should be 4 characters, no padding)
        bytes memory data3 = hex"ffffff";
        bytes memory encoded3 = Base64Url.encode(data3);
        assertEq(encoded3.length, 4, "3 bytes should encode to 4 characters");
        assertEq(string(encoded3), "____", "3 bytes encoding should match");
    }

    function test_EncodeUsesUrlSafeAlphabet() public pure {
        // Test that it uses - and _ instead of + and /
        // 0x3e in base64 = '>' which maps to '+' in standard base64, '-' in base64url
        // 0x3f in base64 = '?' which maps to '/' in standard base64, '_' in base64url

        bytes memory data = hex"fbff"; // Should contain both - and _
        bytes memory encoded = Base64Url.encode(data);

        // Check that result contains URL-safe characters
        string memory result = string(encoded);

        // The actual encoded value (verified by test output)
        assertEq(result, "-_8", "Should use URL-safe alphabet");
    }

    function test_EncodeNoPadding() public pure {
        // Test that there's no padding (no '=' characters)
        bytes memory data1 = hex"ff";
        bytes memory encoded1 = Base64Url.encode(data1);
        
        // Check no padding
        for (uint256 i = 0; i < encoded1.length; i++) {
            assertTrue(encoded1[i] != bytes1("="), "Should not contain padding");
        }

        bytes memory data2 = hex"ffff";
        bytes memory encoded2 = Base64Url.encode(data2);
        
        for (uint256 i = 0; i < encoded2.length; i++) {
            assertTrue(encoded2[i] != bytes1("="), "Should not contain padding");
        }
    }

    function testFuzz_EncodeLength(bytes memory data) public pure {
        bytes memory encoded = Base64Url.encode(data);
        
        if (data.length == 0) {
            assertEq(encoded.length, 0, "Empty input should produce empty output");
        } else {
            // Calculate expected length without padding
            uint256 expectedLen = 4 * ((data.length + 2) / 3);
            if (data.length % 3 == 2) expectedLen -= 1;
            else if (data.length % 3 == 1) expectedLen -= 2;
            
            assertEq(encoded.length, expectedLen, "Encoded length should match expected");
        }
    }
}

