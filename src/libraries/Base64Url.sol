// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title Base64Url
 * @notice Library for Base64Url encoding (RFC 4648)
 * @dev Provides URL-safe base64 encoding without padding
 */
library Base64Url {
    /**
     * @notice Base64Url encode bytes (without padding)
     * @dev Uses URL-safe alphabet: A-Za-z0-9-_ (no + or /)
     *      No padding characters (=) are added
     * @param data The data to encode
     * @return result The base64url encoded bytes
     */
    function encode(bytes memory data) internal pure returns (bytes memory result) {
        // Base64url alphabet (URL-safe: uses - and _ instead of + and /)
        string memory base64Table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        bytes memory table = bytes(base64Table);

        uint256 len = data.length;
        if (len == 0) return "";

        // Calculate output length (no padding for base64url)
        uint256 encodedLen = 4 * ((len + 2) / 3);
        // Remove padding
        if (len % 3 == 2) encodedLen -= 1;
        else if (len % 3 == 1) encodedLen -= 2;

        result = new bytes(encodedLen);

        uint256 i = 0;
        uint256 j = 0;

        // Process 3-byte chunks
        for (; i + 3 <= len; i += 3) {
            uint256 n = (uint256(uint8(data[i])) << 16) | (uint256(uint8(data[i + 1])) << 8) | uint256(uint8(data[i + 2]));

            result[j++] = table[(n >> 18) & 63];
            result[j++] = table[(n >> 12) & 63];
            result[j++] = table[(n >> 6) & 63];
            result[j++] = table[n & 63];
        }

        // Handle remaining bytes (1 or 2 bytes)
        if (i < len) {
            uint256 n = uint256(uint8(data[i])) << 16;
            if (i + 1 < len) {
                n |= uint256(uint8(data[i + 1])) << 8;
            }

            result[j++] = table[(n >> 18) & 63];
            result[j++] = table[(n >> 12) & 63];
            if (i + 1 < len) {
                result[j++] = table[(n >> 6) & 63];
            }
        }

        return result;
    }

    /**
     * @notice Encode bytes32 to base64url string
     * @dev Convenience function for encoding 32-byte hashes
     * @param data The bytes32 data to encode
     * @return result The base64url encoded bytes
     */
    function encode(bytes32 data) internal pure returns (bytes memory result) {
        return encode(abi.encodePacked(data));
    }
}

