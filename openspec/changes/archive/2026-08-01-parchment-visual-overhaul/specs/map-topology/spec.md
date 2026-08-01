## MODIFIED Requirements

### Requirement: Map descriptor structure
A `MapDescriptor` SHALL describe a fixed set of regions, each with a unique id, a display name, a
point value, a rendering payload (an SVG path or equivalent), a label anchor position for rendering
the region's name and value, and an adjacency relation between region ids.

#### Scenario: Region ids are unique
- **WHEN** a `MapDescriptor` is constructed with two regions sharing the same `RegionId`
- **THEN** `MapValidator` reports a validation failure naming the duplicate id

#### Scenario: Region values are one of the two allowed denominations
- **WHEN** a `MapDescriptor` is constructed with a region whose point value is not 200 or 400
- **THEN** `MapValidator` reports a validation failure naming the offending region

#### Scenario: A region missing a display name fails to load
- **WHEN** map content is loaded and a region entry has no display name
- **THEN** the host fails startup naming the region missing its name, the same way it already fails
  startup on other malformed map content
