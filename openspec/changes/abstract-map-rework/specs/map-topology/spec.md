## ADDED Requirements

### Requirement: The map has exactly 18 regions
A `MapDescriptor` SHALL describe exactly 18 regions.

#### Scenario: The default map loads 18 regions
- **WHEN** the host loads its default `MapDescriptor` from map content
- **THEN** it contains exactly 18 regions

### Requirement: Region display names contain no real-world place references
Every region's `NameEn` and `NameRu` SHALL be an invented name, not the name of any real country,
city, or other real-world place, so the board reads as an abstract territory game rather than a
depiction of actual geography.

#### Scenario: Region names are not real-world places
- **WHEN** map content is loaded
- **THEN** none of its regions' `NameEn` or `NameRu` values match the name of a real country, city,
  or other real-world place
