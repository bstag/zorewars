use crate::{arena::Arena, match_setup::MatchSetup, redcode::assemble_with_rules};
use serde::{Deserialize, Serialize};
use std::{env, fs, io, path::PathBuf};

#[derive(Clone, PartialEq, Serialize, Deserialize)]
pub struct Draft {
    pub side: Option<usize>,
    pub fallback: String,
    pub source: String,
}

#[derive(PartialEq, Serialize, Deserialize)]
pub struct Workspace {
    pub setup: MatchSetup,
    pub roster: Vec<(String, String)>,
    #[serde(default)]
    pub drafts: Vec<Draft>,
    pub warrior: usize,
    pub inspector_width: f32,
    pub debugger_height: f32,
    pub show_inspector: bool,
    pub show_debugger: bool,
}

impl Workspace {
    pub fn arena(&self) -> Result<Arena, String> {
        if !(1..=crate::arena::MAX_WARRIORS).contains(&self.roster.len())
            || !(1..=1000).contains(&self.setup.rounds)
            || !(1..=crate::match_setup::MAX_SEED).contains(&self.setup.seed)
        {
            return Err("Invalid saved roster or match settings".into());
        }
        let rules = self.setup.preset.rules();
        let warriors = self
            .roster
            .iter()
            .map(|(name, source)| assemble_with_rules(source, name, rules))
            .collect::<Result<Vec<_>, _>>()?;
        self.setup.start(&warriors)
    }

    pub fn path() -> Option<PathBuf> {
        let base = if cfg!(windows) {
            PathBuf::from(env::var_os("LOCALAPPDATA")?)
        } else if cfg!(target_os = "macos") {
            PathBuf::from(env::var_os("HOME")?).join("Library/Application Support")
        } else {
            env::var_os("XDG_CONFIG_HOME")
                .map(PathBuf::from)
                .or_else(|| env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))?
        };
        Some(base.join("ZoreWars").join("workspace.json"))
    }

    pub fn read(path: &std::path::Path) -> io::Result<Self> {
        Ok(serde_json::from_slice(&fs::read(path)?)?)
    }

    pub fn write(&self, path: &std::path::Path) -> io::Result<()> {
        fs::create_dir_all(path.parent().expect("workspace directory"))?;
        let temp = path.with_extension(format!("{}.tmp", std::process::id()));
        fs::write(&temp, serde_json::to_vec(self)?)?;
        if let Err(error) = fs::rename(&temp, path) {
            let _ = fs::remove_file(&temp);
            return Err(error);
        }
        Ok(())
    }
}

#[cfg(test)]
#[test]
fn workspace_round_trip_restores_local_sources_and_unassembled_draft() {
    use crate::match_setup::Preset;
    let path = std::env::temp_dir().join(format!(
        "zorewars-workspace-{}-{:?}.json",
        std::process::id(),
        std::thread::current().id()
    ));
    let mut original = Workspace {
        setup: MatchSetup {
            preset: Preset::Nano,
            rounds: 4,
            ..Default::default()
        },
        roster: vec![("Fallback".into(), ";name Restored\nMOV 0, 1".into())],
        drafts: vec![Draft {
            side: Some(0),
            fallback: "Fallback".into(),
            source: "MOV #unfinished".into(),
        }],
        warrior: 0,
        inspector_width: 280.0,
        debugger_height: 155.0,
        show_inspector: false,
        show_debugger: true,
    };
    original.write(&path).unwrap();
    original.setup.rounds = 7;
    original.write(&path).unwrap();
    let restored = Workspace::read(&path).unwrap();
    fs::remove_file(path).unwrap();
    assert!(restored == original);
    let arena = restored.arena().unwrap();
    assert_eq!(arena.rules.core_size, 80);
    assert_eq!(arena.warriors[0].name, "Restored");
}
