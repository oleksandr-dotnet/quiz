## ADDED Requirements

### Requirement: The suite pins its own UI language regardless of the app's default
The E2E suite SHALL fix the client's UI language to a known value before any test interacts with
the page, rather than relying on whichever language the app would otherwise default to. The app's
own default locale is a product decision that may change independently of this suite.

#### Scenario: A test asserting UI text is unaffected by the app's real default locale
- **WHEN** any test navigates to the landing page through the suite's shared navigation helper
- **THEN** the page renders in the language the suite pinned, regardless of what the app would have
  defaulted to on a fresh visit with no stored preference
