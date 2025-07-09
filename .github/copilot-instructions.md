# GitHub Copilot Instructions

## Project Context

This is the **Pixels Roll20 Chrome Extension** project - a browser extension that integrates Pixels dice with Roll20 virtual tabletop platform.

## Code Style and Standards

- Use **camelCase** for JavaScript file and directory names
- Follow JavaScript/Chrome Extension best practices
- Maintain separation of concerns (HTML/CSS/JS)
- Use comprehensive error handling with try/catch blocks
- Write robust, testable code with Jest test coverage

## File Organization

- Place core content scripts in `src/content/`
- Organize UI components in `src/content/modifierBox/`
- Keep common utilities in `src/content/common/`
- Maintain stable tests in `tests/jest/`
- Keep experimental/legacy tests in `tests/jest/experimental/`

## Documentation Requirements

When creating summary documents, analysis reports, progress reports, or any documentation files:

### 📁 **IMPORTANT: All summary documents must be placed in the `Copilot-Feedback/` directory**

Examples of documents that should go in `Copilot-Feedback/`:

- Progress reports
- Analysis summaries
- Refactoring summaries
- Test reports
- Code review summaries
- Architecture decisions
- Performance analysis
- Any `.md` files created during development assistance

### Document Naming Convention

Use descriptive names with dates:

- `YYYY-MM-DD-feature-name-summary.md`
- `YYYY-MM-DD-analysis-topic.md`
- `YYYY-MM-DD-refactoring-report.md`

### Document Structure

Include these sections in summary documents:

- **Summary** - Brief overview
- **Key Accomplishments** - What was completed
- **Technical Details** - Implementation specifics
- **Impact** - Effects on codebase/functionality
- **Next Steps** - Future recommendations (if applicable)

## Testing Guidelines

- Maintain 100% pass rate for stable tests (currently 141 tests passing)
- Keep experimental tests isolated in `tests/jest/experimental/`
- Update tests when modifying functionality
- Use descriptive test names and proper mocking

## Extension Development

- Follow Chrome Extension Manifest V3 standards
- Test compatibility with Roll20 platform
- Maintain Bluetooth integration for Pixels dice
- Ensure proper content script injection and communication

## Error Handling

- Use comprehensive try/catch blocks
- Handle Chrome API errors gracefully
- Provide fallbacks for missing dependencies
- Log errors appropriately for debugging

## Dependencies

- Keep dependencies minimal and well-justified
- Update package.json when adding new dependencies
- Maintain compatibility with existing Chrome extension APIs
