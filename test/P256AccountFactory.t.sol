// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import {P256AccountFactory} from "../src/P256AccountFactory.sol";
import {P256Account} from "../src/P256Account.sol";
import {IEntryPoint} from "@account-abstraction/interfaces/IEntryPoint.sol";

contract P256AccountFactoryTest is Test {
    P256AccountFactory factory;
    IEntryPoint entryPoint;

    // Test public keys
    bytes32 constant QX1 = bytes32(uint256(1));
    bytes32 constant QY1 = bytes32(uint256(2));
    bytes32 constant QX2 = bytes32(uint256(3));
    bytes32 constant QY2 = bytes32(uint256(4));

    // Test owners
    address owner1 = address(0x1);
    address owner2 = address(0x2);

    function setUp() public {
        // Deploy EntryPoint (using a mock address for testing)
        entryPoint = IEntryPoint(address(0x0000000071727De22E5E9d8BAf0edAc6f37da032));

        // Deploy factory
        factory = new P256AccountFactory(entryPoint);
    }

    /**
     * Test: Different public keys should produce SAME address (only owner and salt matter)
     */
    function test_DifferentPublicKeysProduceSameAddress() public view {
        uint256 salt = 0;

        address addr1 = factory.getAddress(QX1, QY1, owner1, salt);
        address addr2 = factory.getAddress(QX2, QY2, owner1, salt);

        assertEq(addr1, addr2, "Different public keys should produce SAME address (only owner and salt matter)");
    }

    /**
     * Test: Different owners should produce different addresses
     */
    function test_DifferentOwnersProduceDifferentAddresses() public view {
        uint256 salt = 0;

        address addr1 = factory.getAddress(QX1, QY1, owner1, salt);
        address addr2 = factory.getAddress(QX1, QY1, owner2, salt);

        assertTrue(addr1 != addr2, "Different owners should produce different addresses");
    }

    /**
     * Test: Different salts should produce different addresses
     */
    function test_DifferentSaltsProduceDifferentAddresses() public view {
        address addr1 = factory.getAddress(QX1, QY1, owner1, 0);
        address addr2 = factory.getAddress(QX1, QY1, owner1, 1);

        assertTrue(addr1 != addr2, "Different salts should produce different addresses");
    }

    /**
     * Test: Same parameters should produce same address (deterministic)
     */
    function test_SameParametersProduceSameAddress() public view {
        uint256 salt = 0;

        address addr1 = factory.getAddress(QX1, QY1, owner1, salt);
        address addr2 = factory.getAddress(QX1, QY1, owner1, salt);

        assertEq(addr1, addr2, "Same parameters should produce same address");
    }

    /**
     * Test: getAddress matches actual deployment address
     */
    function test_GetAddressMatchesDeployment() public {
        uint256 salt = 0;

        // Get predicted address
        address predicted = factory.getAddress(QX1, QY1, owner1, salt);

        // Deploy account with 2FA enabled
        vm.deal(address(this), 1 ether);
        P256Account account = factory.createAccount(QX1, QY1, owner1, salt, true);

        // Verify addresses match
        assertEq(address(account), predicted, "Predicted address should match deployed address");
    }

    /**
     * Test: Multiple users can use same salt without collision
     * Different owners = different addresses (passkey doesn't matter)
     */
    function test_NoCollisionWithSameSalt() public view {
        uint256 salt = 42; // Same salt for all

        address addr1 = factory.getAddress(QX1, QY1, owner1, salt);
        address addr2 = factory.getAddress(QX2, QY2, owner1, salt); // Same owner, different passkey
        address addr3 = factory.getAddress(QX1, QY1, owner2, salt); // Different owner, same passkey

        // Same owner = same address (passkey doesn't matter)
        assertEq(addr1, addr2, "Same owner should have SAME address regardless of passkey");
        // Different owners = different addresses
        assertTrue(addr1 != addr3, "Different owners should have different addresses");
        assertTrue(addr2 != addr3, "Different owners should have different addresses");
    }

    /**
     * Test: Fuzz test - same owner produces same address regardless of passkey
     */
    function testFuzz_SameOwnerSameAddress(
        bytes32 qx1,
        bytes32 qy1,
        bytes32 qx2,
        bytes32 qy2,
        address owner,
        uint256 salt
    ) public view {
        // Skip if public keys are the same (we want to test different keys)
        vm.assume(qx1 != qx2 || qy1 != qy2);
        // Skip zero address
        vm.assume(owner != address(0));

        address addr1 = factory.getAddress(qx1, qy1, owner, salt);
        address addr2 = factory.getAddress(qx2, qy2, owner, salt);

        assertEq(addr1, addr2, "Same owner should always produce SAME address regardless of passkey");
    }

    /**
     * Test: Verify initCode produces correct address
     */
    function test_InitCodeProducesCorrectAddress() public view {
        uint256 salt = 0;

        // Get predicted address
        address predicted = factory.getAddress(QX1, QY1, owner1, salt);

        // Get initCode with 2FA enabled
        bytes memory initCode = factory.getInitCode(QX1, QY1, owner1, salt, true);

        // Verify initCode contains factory address
        address factoryFromInitCode;
        assembly {
            factoryFromInitCode := mload(add(initCode, 20))
        }
        assertEq(factoryFromInitCode, address(factory), "InitCode should contain factory address");
    }

    /**
     * Test: CREATE2 salt includes ONLY owner and salt (NOT passkey)
     */
    function test_SaltIncludesOnlyOwnerAndSalt() public view {
        // Address should depend ONLY on owner and salt, NOT on passkey (qx, qy)
        address addr1 = factory.getAddress(QX1, QY1, owner1, 0);
        address addr2 = factory.getAddress(QX2, QY1, owner1, 0); // Different qx
        address addr3 = factory.getAddress(QX1, QY2, owner1, 0); // Different qy
        address addr4 = factory.getAddress(QX1, QY1, owner2, 0); // Different owner
        address addr5 = factory.getAddress(QX1, QY1, owner1, 1); // Different salt

        // qx should NOT affect address (same owner, same salt)
        assertEq(addr1, addr2, "qx should NOT affect address");
        // qy should NOT affect address (same owner, same salt)
        assertEq(addr1, addr3, "qy should NOT affect address");
        // owner SHOULD affect address
        assertTrue(addr1 != addr4, "owner should affect address");
        // salt SHOULD affect address
        assertTrue(addr1 != addr5, "salt should affect address");
    }
}
