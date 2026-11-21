use std::{env, fs, path::PathBuf};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("cargo:rustc-check-cfg=cfg(zorewars_source_history)");
    if env::var_os("CARGO_FEATURE_GPU").is_none() {
        return Ok(());
    }
    println!("cargo:rustc-cfg=zorewars_source_history");
    let root = PathBuf::from(env::var("CARGO_MANIFEST_DIR")?)
        .join("../../warriors")
        .canonicalize()?;
    let index = root.join("index.json");
    println!("cargo:rerun-if-changed={}", index.display());
    let entries: Vec<serde_json::Value> = serde_json::from_str(&fs::read_to_string(index)?)?;
    let mut output = String::from("pub const LIBRARY: &[(&str, &str, &str)] = &[\n");
    let mut add = |name: &str, family: &str, file: &str| {
        let path = root.join(file);
        println!("cargo:rerun-if-changed={}", path.display());
        output.push_str(&format!(
            "    ({name:?}, {family:?}, include_str!({path:?})),\n"
        ));
    };
    for entry in entries {
        if entry["language"] == "redcode"
            && entry["battlefield"].is_null()
            && entry["experimental"] != true
        {
            if let (Some(name), Some(family), Some(file)) = (
                entry["name"].as_str(),
                entry["family"].as_str(),
                entry["file"].as_str(),
            ) {
                add(name, family, file);
            }
        }
    }
    add("Dwarf ’88", "Stone", "88/dwarf.red");
    add("Imp ’88", "Imp", "88/imp.red");
    output.push_str("];\n");
    fs::write(
        PathBuf::from(env::var("OUT_DIR")?).join("library.rs"),
        output,
    )?;
    Ok(())
}
