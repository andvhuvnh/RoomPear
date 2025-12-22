# Contributing to RoomPear

Thank you for contributing to RoomPear! This document provides guidelines and instructions for collaborating on this project.

## Getting Started

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/andvhuvnh/RoomPear.git
   cd RoomPear
   ```

2. Install dependencies (once packages are added):
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` (when available)
   - Fill in required values

## Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch (if needed)
- `feature/*` - Feature branches
- `fix/*` - Bug fix branches

### Making Changes

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes:**
   - Follow the existing code style
   - Write clear commit messages
   - Test your changes

3. **Commit your changes:**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

4. **Push and create a Pull Request:**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a PR on GitHub.

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
- `feat: add user profile creation`
- `fix: resolve chat message ordering issue`
- `docs: update architecture documentation`

## Project Structure

See `README.md` and `docs/architecture.md` for details on the monorepo structure.

## Code Style

- Use TypeScript for type safety
- Follow ESLint/Prettier configurations (when added)
- Write self-documenting code with clear variable names
- Add comments for complex logic

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Test on both mobile and web (when applicable)

## Pull Request Process

1. Ensure your branch is up to date with `main`
2. Create a clear PR description
3. Reference any related issues
4. Request review from collaborators
5. Address review feedback
6. Merge after approval

## Questions?

Feel free to open an issue or reach out to the team!

