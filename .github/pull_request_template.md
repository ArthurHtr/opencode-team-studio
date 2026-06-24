name: Pull Request Template
description: When you have a pull request ready.
body:
  - type: markdown
    attributes:
      value: |
        **Important:** Do not include secrets, API keys, tokens, or personal data.

  - type: input
    id: summary
    attributes:
      label: Summary
      description: Brief description of the changes.
    validations:
      required: true

  - type: textarea
    id: motivation
    attributes:
      label: Motivation
      description: Why is this change needed? What problem does it solve?
    validations:
      required: true

  - type: dropdown
    id: type
    attributes:
      label: Type of change
      options:
        - New feature
        - Bug fix
        - Breaking change
        - Enhancement
        - Refactor
        - Documentation
        - Tests
        - CI / Infrastructure
      multiple: true
    validations:
      required: true

  - type: textarea
    id: tests
    attributes:
      label: Tests executed
      description: What tests have you run?
      placeholder: |
        - pnpm run typecheck
        - pnpm run lint
        - pnpm run test
        - pnpm run build
    validations:
      required: true

  - type: textarea
    id: opencode-impact
    attributes:
      label: Impact on OpenCode configurations
      description: How does this change affect OpenCode configuration files?

  - type: textarea
    id: backup-impact
    attributes:
      label: Impact on backups
      description: Does this change affect backup or restore behavior?

  - type: checkboxes
    id: security
    attributes:
      label: Security checklist
      description: Review the security implications of your changes.
      options:
        - label: No secrets or credentials are included
        - label: No personal data is included
        - label: Path validation is maintained (if filesystem changes)
        - label: No new external network calls
        - label: No shell command execution based on user input

  - type: textarea
    id: documentation
    attributes:
      label: Documentation
      description: What documentation has been updated or added?

  - type: textarea
    id: screenshots
    attributes:
      label: Screenshots (for visual changes)
      description: Before/after screenshots for UI changes.
      placeholder: Drag and drop images here
