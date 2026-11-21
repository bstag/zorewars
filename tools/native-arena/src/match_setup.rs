use crate::arena::Arena;
use crate::redcode::{assemble_with_rules, Rules, Warrior};

pub const MAX_SEED: u32 = 2_147_483_646;

#[derive(Clone, Copy, Default, PartialEq, Eq)]
#[cfg_attr(feature = "gpu", derive(serde::Serialize, serde::Deserialize))]
pub enum Preset {
    #[default]
    Classic,
    NoPspace,
    Icws88,
    LimitedProcess,
    LpHill,
    Nano,
    Tiny,
    TinyLp,
    X,
    XHill,
    Icws,
    Icws64,
    SalTourney,
    SalMp,
    SalMsw,
}

impl Preset {
    pub const GROUPS: &[(&str, &[Self])] = &[
        (
            "Standard",
            &[
                Self::Classic,
                Self::NoPspace,
                Self::Icws88,
                Self::LimitedProcess,
                Self::LpHill,
            ],
        ),
        ("Small core", &[Self::Nano, Self::Tiny, Self::TinyLp]),
        (
            "Extended and historical",
            &[Self::X, Self::XHill, Self::Icws, Self::Icws64],
        ),
        ("SAL", &[Self::SalTourney, Self::SalMp, Self::SalMsw]),
    ];

    pub fn label(self) -> &'static str {
        match self {
            Self::Classic => "94 with P-space",
            Self::NoPspace => "94nop",
            Self::LimitedProcess => "LP",
            Self::Icws88 => "ICWS ’88",
            Self::LpHill => "LP hill",
            Self::Nano => "Nano",
            Self::Tiny => "Tiny",
            Self::TinyLp => "Tiny LP",
            Self::X => "94x",
            Self::XHill => "94x hill",
            Self::Icws => "ICWS",
            Self::Icws64 => "ICWS ’64-process",
            Self::SalTourney => "SAL Tournament",
            Self::SalMp => "SAL MP",
            Self::SalMsw => "SAL MSW",
        }
    }

    pub fn rules(self) -> Rules {
        match self {
            Self::Classic => Rules::CLASSIC,
            Self::NoPspace => Rules::NOP,
            Self::LimitedProcess => Rules::LP,
            Self::Icws88 => Rules {
                icws88: true,
                ..Rules::NOP
            },
            Self::LpHill => Rules {
                length: 200,
                pspace: true,
                ..Rules::LP
            },
            Self::Nano => Rules {
                core_size: 80,
                cycles: 800,
                processes: 80,
                length: 5,
                distance: 5,
                ..Rules::CLASSIC
            },
            Self::Tiny => Rules {
                core_size: 800,
                cycles: 8000,
                processes: 800,
                length: 20,
                distance: 20,
                ..Rules::CLASSIC
            },
            Self::TinyLp => Rules {
                processes: 8,
                length: 50,
                distance: 50,
                ..Self::Tiny.rules()
            },
            Self::X => Rules {
                core_size: 55440,
                cycles: 500_000,
                processes: 10_000,
                length: 200,
                distance: 200,
                ..Rules::NOP
            },
            Self::XHill => Rules {
                pspace: true,
                ..Self::X.rules()
            },
            Self::Icws => Rules {
                core_size: 8192,
                cycles: 100_000,
                ..Self::Icws88.rules()
            },
            Self::Icws64 => Rules {
                cycles: 80_000,
                processes: 64,
                ..Self::Icws.rules()
            },
            Self::SalTourney => Rules {
                core_size: 8192,
                cycles: 100_000,
                length: 300,
                distance: 300,
                ..Rules::CLASSIC
            },
            Self::SalMp => Rules {
                processes: 64,
                pspace_size: Some(1),
                ..Rules::CLASSIC
            },
            Self::SalMsw => Rules {
                cycles: 40_000,
                ..Rules::CLASSIC
            },
        }
    }

    pub fn starter(self) -> Result<Vec<Warrior>, String> {
        let rules = self.rules();
        let (dwarf, imp) = if rules.icws88 {
            (
                include_str!("../../../warriors/88/dwarf.red"),
                include_str!("../../../warriors/88/imp.red"),
            )
        } else {
            (
                include_str!("../../../warriors/dwarf.red"),
                include_str!("../../../warriors/imp.red"),
            )
        };
        Ok(vec![
            assemble_with_rules(dwarf, "Dwarf", rules)?,
            assemble_with_rules(imp, "Imp", rules)?,
        ])
    }
}

#[derive(Clone, Copy, Default, PartialEq, Eq)]
#[cfg_attr(feature = "gpu", derive(serde::Serialize, serde::Deserialize))]
pub enum Placement {
    #[default]
    Even,
    Seeded,
    Fixed,
}

#[derive(Clone, PartialEq, Eq)]
#[cfg_attr(feature = "gpu", derive(serde::Serialize, serde::Deserialize))]
pub struct MatchSetup {
    pub preset: Preset,
    pub placement: Placement,
    pub seed: u32,
    pub fixed: String,
    pub rounds: u32,
}

impl Default for MatchSetup {
    fn default() -> Self {
        Self {
            preset: Preset::Classic,
            placement: Placement::Even,
            seed: 1,
            fixed: String::new(),
            rounds: 1,
        }
    }
}

impl MatchSetup {
    pub fn start(&self, warriors: &[Warrior]) -> Result<Arena, String> {
        let rules = self.preset.rules();
        let positions = self.positions(warriors.len(), 1)?;
        let warriors = warriors
            .iter()
            .map(|w| {
                assemble_with_rules(&w.source, &w.fallback, rules)
                    .map_err(|error| format!("{}: {error}", w.name))
            })
            .collect::<Result<_, _>>()?;
        Ok(Arena::round(warriors, rules, positions, 0))
    }

    pub fn positions(&self, count: usize, round: u32) -> Result<Vec<usize>, String> {
        let rules = self.preset.rules();
        let size = rules.core_size;
        let sep = rules.distance;
        match self.placement {
            Placement::Even => Ok((0..count).map(|side| side * size / count).collect()),
            Placement::Seeded => {
                let mut seed = self.seed;
                let mut positions = Vec::new();
                for _ in 0..round {
                    positions = seeded_positions(count, size, sep, &mut seed);
                }
                Ok(positions)
            }
            Placement::Fixed => {
                let positions = self
                    .fixed
                    .split(|c: char| c == ',' || c.is_whitespace())
                    .filter(|part| !part.is_empty())
                    .map(|part| part.parse::<usize>().ok().filter(|&address| address < size))
                    .collect::<Option<Vec<_>>>()
                    .ok_or_else(|| format!("Addresses must be integers from 0 to {}", size - 1))?;
                if positions.len() != count {
                    return Err(format!("Enter one address per warrior ({count} total)"));
                }
                for (i, &address) in positions.iter().enumerate() {
                    if !separated(&positions[..i], address, size, sep) {
                        return Err(format!(
                            "Keep starting addresses at least {sep} cells apart around the ring"
                        ));
                    }
                }
                Ok(positions)
            }
        }
    }
}

fn separated(positions: &[usize], address: usize, size: usize, sep: usize) -> bool {
    positions.iter().all(|&other| {
        let gap = other.abs_diff(address);
        gap.min(size - gap) >= sep
    })
}

fn advance_seed(seed: &mut u32) {
    *seed = ((u64::from(*seed) * 16807) % 2_147_483_647) as u32;
}

fn seeded_positions(count: usize, size: usize, sep: usize, seed: &mut u32) -> Vec<usize> {
    let spread = size + 1 - 2 * sep;
    let mut positions = vec![0];
    if count <= 1 {
        return positions;
    }
    if count == 2 {
        positions.push(sep + *seed as usize % spread);
        advance_seed(seed);
        return positions;
    }
    for _ in 1..count {
        let found = (0..1000).find_map(|_| {
            advance_seed(seed);
            let candidate = sep + *seed as usize % spread;
            separated(&positions, candidate, size, sep).then_some(candidate)
        });
        if let Some(address) = found {
            positions.push(address);
        } else {
            advance_seed(seed);
            let gap = size / count;
            let shift = *seed as usize % (gap - sep + 1);
            positions.truncate(1);
            positions.extend((1..count).map(|side| side * gap + shift));
            break;
        }
    }
    positions
}
