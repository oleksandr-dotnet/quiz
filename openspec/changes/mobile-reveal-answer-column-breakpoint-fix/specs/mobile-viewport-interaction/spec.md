## ADDED Requirements

### Requirement: A reveal row's answer text stays legible across the project's full phone range
The client SHALL apply the Reveal overlay's narrow-column layout (the one that favors the answer
text's share of row width) on every viewport width within the project's documented phone range, not
only the narrowest phones, so that an ordinary-length answer (e.g. a date or a multi-word place name)
remains distinguishable rather than collapsing to one or two characters.

#### Scenario: A date answer remains distinguishable on a mid-range phone width
- **WHEN** a Reveal overlay's ranked list shows answer text such as a full date on a viewport around
  420px wide
- **THEN** enough of the answer renders before truncation that different players' answers remain
  visually distinguishable from one another, not all collapsed to the same one or two leading
  characters
