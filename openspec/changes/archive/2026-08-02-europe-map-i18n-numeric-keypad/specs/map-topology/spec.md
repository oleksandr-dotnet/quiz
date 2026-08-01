## MODIFIED Requirements

### Requirement: Map descriptor structure
A `MapDescriptor` SHALL describe a fixed set of regions, each with a unique id, a localized display
name (an English name and a Russian name, both required and non-empty), a point value, a graph node
position (a center coordinate and a radius used to render the region as a node) from which its
rendering payload is derived, a label anchor position for rendering the region's name and value, and
an adjacency relation between region ids.

#### Scenario: Region ids are unique
- **WHEN** a `MapDescriptor` is constructed with two regions sharing the same `RegionId`
- **THEN** `MapValidator` reports a validation failure naming the duplicate id

#### Scenario: Region values are one of the two allowed denominations
- **WHEN** a `MapDescriptor` is constructed with a region whose point value is not 200 or 400
- **THEN** `MapValidator` reports a validation failure naming the offending region

#### Scenario: A region missing a display name in either language fails to load
- **WHEN** map content is loaded and a region entry has no English display name or no Russian display
  name
- **THEN** the host fails startup naming the region and the missing language, the same way it already
  fails startup on other malformed map content

### Requirement: Adjacency is symmetric
`AdjacencyIndex` SHALL treat "A borders B" and "B borders A" as the same fact. A map where region A
lists B as a neighbor but B does not list A back is invalid, because it produces asymmetric attack
legality that is confusing from the UI and violates the game's adjacency rule.

#### Scenario: Asymmetric adjacency is rejected
- **WHEN** a `MapDescriptor` lists region A as adjacent to region B, but region B's adjacency list
  omits A
- **THEN** `MapValidator` reports a validation failure identifying the asymmetric pair

#### Scenario: Symmetric adjacency validates
- **WHEN** every adjacency pair in a `MapDescriptor` is listed on both sides
- **THEN** `MapValidator` reports no adjacency errors

### Requirement: The map graph is fully connected
Every region SHALL be reachable from every other region by following adjacency edges. A
disconnected graph produces an unfillable land-grab pool (a player can be stranded with no legal
adjacent pick) and is rejected outright.

#### Scenario: Disconnected graph is rejected
- **WHEN** a `MapDescriptor`'s adjacency graph has two or more regions with no path between them
- **THEN** `MapValidator` reports a validation failure identifying the disconnected region(s)

### Requirement: Adjacency-distance queries
`AdjacencyIndex` SHALL answer "what is the shortest hop-distance between region A and region B?" and
"which regions are within N hops of region A?", since base placement and bot heuristics both need
this without recomputing a graph search.

#### Scenario: Hop distance between adjacent regions is 1
- **WHEN** region A and region B are directly adjacent
- **THEN** `AdjacencyIndex` reports a hop-distance of 1 between them

#### Scenario: Hop distance between the same region is 0
- **WHEN** querying the hop-distance from a region to itself
- **THEN** `AdjacencyIndex` reports 0

## ADDED Requirements

### Requirement: The default map is a 16-country European graph starting from Spain
The bundled default `MapDescriptor` SHALL contain exactly 16 regions, each named after a real European
country, with the first region in declaration order named Spain, laid out with node positions that
loosely correspond to those countries' real relative geographic positions.

#### Scenario: The default map loads as 16 European countries
- **WHEN** the host loads the default map content
- **THEN** the resulting `MapDescriptor` has 16 regions, and its first region's English name is
  "Spain"
