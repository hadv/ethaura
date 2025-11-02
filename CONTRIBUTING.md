# Contributing to ΞTHΛURΛ

Thank you for your interest in contributing to ΞTHΛURΛ! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect differing viewpoints
- Report unacceptable behavior

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce**
- **Expected vs actual behavior**
- **Environment details** (OS, browser, network)
- **Screenshots or logs** if applicable

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

- **Clear use case**
- **Detailed description**
- **Potential implementation approach**
- **Alternatives considered**

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make your changes**
4. **Add tests** for new functionality
5. **Ensure tests pass** (`make test`)
6. **Format code** (`make format`)
7. **Commit changes** with clear messages
8. **Push to branch** (`git push origin feature/amazing-feature`)
9. **Open a Pull Request**

#### PR Guidelines

- Follow existing code style
- Write clear commit messages
- Add tests for new features
- Update documentation
- Keep PRs focused and small
- Reference related issues

#### Commit Message Format

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

Example:
```
feat(account): add multi-device support

Implement support for multiple public keys per account
with configurable weights and threshold.

Closes #123
```

## Development Setup

### Prerequisites

- Foundry
- Node.js >= 18
- Git

### Setup Steps

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/ethaura.git
cd ethaura

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/ethaura.git

# Install dependencies
make install

# Build contracts
make build

# Run tests
make test
```

### Development Workflow

1. **Sync with upstream**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

3. **Make changes and test**
   ```bash
   # Edit files
   make test
   make format
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat: your feature"
   git push origin feature/your-feature
   ```

5. **Create Pull Request**
   - Go to GitHub
   - Click "New Pull Request"
   - Fill in template
   - Submit for review

## Code Style

### Solidity

- Follow [Solidity Style Guide](https://docs.soliditylang.org/en/latest/style-guide.html)
- Use NatSpec comments for all public functions
- Keep functions small and focused
- Use descriptive variable names
- Add events for state changes

Example:
```solidity
/**
 * @notice Update the public key for this account
 * @param _qx The new x-coordinate of the public key
 * @param _qy The new y-coordinate of the public key
 */
function updatePublicKey(bytes32 _qx, bytes32 _qy) external onlyOwner {
    qx = _qx;
    qy = _qy;
    emit PublicKeyUpdated(_qx, _qy);
}
```

### JavaScript/React

- Use ES6+ features
- Follow Airbnb style guide
- Use functional components
- Add JSDoc comments
- Handle errors gracefully

Example:
```javascript
/**
 * Sign a message with passkey
 * @param {Object} credential - The credential info
 * @param {Uint8Array} message - The message to sign
 * @returns {Promise<Object>} Signature data
 */
export async function signWithPasskey(credential, message) {
  // Implementation
}
```

## Testing

### Smart Contracts

```bash
# Run all tests
forge test

# Run specific test
forge test --match-test testFunctionName

# Run with verbosity
forge test -vvv

# Run with gas report
forge test --gas-report

# Run with coverage
forge coverage
```

### Test Structure

```solidity
contract MyContractTest is Test {
    MyContract public myContract;
    
    function setUp() public {
        // Setup
    }
    
    function test_FeatureName() public {
        // Test implementation
    }
    
    function testFuzz_FeatureName(uint256 input) public {
        // Fuzz test
    }
}
```

### Frontend

```bash
cd frontend
npm test
npm run lint
```

## Documentation

- Update README.md for user-facing changes
- Update ARCHITECTURE.md for technical changes
- Add inline comments for complex logic
- Update DEPLOYMENT.md for deployment changes

## Review Process

1. **Automated checks** must pass
   - Tests
   - Linting
   - Build

2. **Code review** by maintainers
   - Code quality
   - Test coverage
   - Documentation

3. **Approval** required before merge

4. **Squash and merge** for clean history

## Release Process

1. Update version in package.json
2. Update CHANGELOG.md
3. Create release tag
4. Deploy to testnet
5. Announce release

## Getting Help

- **Discord**: Join our [Discord server](https://discord.gg/ethaura)
- **GitHub Discussions**: Ask questions
- **Documentation**: Check docs first
- **Issues**: Search existing issues

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Eligible for bounties (if applicable)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Feel free to reach out:
- Open a GitHub Discussion
- Join our Discord
- Email: contribute@ethaura.example.com

Thank you for contributing to ΞTHΛURΛ! 🚀

