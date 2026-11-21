use crate::redcode::{
    directive, is_label, opcode, token, Rules, CORE_SYMBOLS, DIRECTIVES, MODS, OPS, OPS_88,
};
use std::ops::Range;

pub struct Completions {
    pub replace: Range<usize>,
    pub words: Vec<String>,
}

fn is_command(word: &str) -> bool {
    opcode(word).is_some() || directive(word)
}

pub fn suggestions(source: &str, cursor_chars: usize, rules: Rules) -> Option<Completions> {
    let cursor = source
        .char_indices()
        .nth(cursor_chars)
        .map_or(source.len(), |(i, _)| i);
    let line_start = source[..cursor].rfind('\n').map_or(0, |i| i + 1);
    let left = &source[line_start..cursor];
    if left.contains(';') {
        return None;
    }

    let word_byte = |b: u8| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'.');
    let start = cursor - left.bytes().rev().take_while(|&b| word_byte(b)).count();
    let end = cursor
        + source[cursor..]
            .bytes()
            .take_while(|&b| word_byte(b))
            .count();
    let prefix = &source[start..cursor];
    if prefix.is_empty() || source[end..].starts_with(':') {
        return None;
    }
    let before = source[line_start..start].trim_start().to_ascii_uppercase();
    let (first, rest) = token(&before);
    let command_position = first.is_empty()
        || !is_command(first) && rest.is_empty() && is_label(first.trim_end_matches(':'));
    let mut replace = start..end;
    let mut words = Vec::new();
    let mut add_matches = |candidates: &[&str], prefix: &str, original: &str| {
        let prefix = prefix.to_ascii_uppercase();
        for &word in candidates {
            if word.to_ascii_uppercase().starts_with(&prefix)
                && !word.eq_ignore_ascii_case(original)
                && !words
                    .iter()
                    .any(|existing: &String| existing.eq_ignore_ascii_case(word))
                && words.len() < 8
            {
                words.push(word.to_owned());
            }
        }
    };
    if command_position {
        if let Some((base, modifier)) = prefix.split_once('.') {
            let base = base.to_ascii_uppercase();
            if rules.icws88 || !allowed_opcode(&base, rules) {
                return None;
            }
            replace.start += base.len() + 1;
            add_matches(MODS, modifier, &source[replace.clone()]);
        } else {
            let commands: Vec<_> = (if rules.icws88 { OPS_88 } else { OPS })
                .iter()
                .copied()
                .chain(["CMP"])
                .filter(|word| allowed_opcode(word, rules))
                .chain(DIRECTIVES.iter().copied())
                .filter(|word| !rules.icws88 || *word != "ORG")
                .collect();
            add_matches(&commands, prefix, &source[replace.clone()]);
        }
    } else if is_label(prefix) {
        add_matches(CORE_SYMBOLS, prefix, &source[replace.clone()]);
        for line in source.lines() {
            let code = line
                .split(';')
                .next()
                .unwrap()
                .trim()
                .trim_start_matches('\u{feff}');
            let (first, rest) = token(code);
            let upper = first.to_ascii_uppercase();
            let label = first.trim_end_matches(':');
            if upper == "END" || !is_command(&upper) && token(rest).0.eq_ignore_ascii_case("END") {
                break;
            }
            if !is_command(&upper) && is_label(label) {
                add_matches(&[label], prefix, &source[replace.clone()]);
            }
        }
    }
    (!words.is_empty()).then_some(Completions { replace, words })
}

fn allowed_opcode(word: &str, rules: Rules) -> bool {
    opcode(word).is_some() && (rules.pspace || !matches!(word, "LDP" | "STP"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn complete_at_marker(marked: &str, rules: Rules) -> Option<Completions> {
        let (left, right) = marked.split_once('|').unwrap();
        suggestions(&format!("{left}{right}"), left.chars().count(), rules)
    }

    #[test]
    fn suggests_commands_and_modifiers_at_the_instruction() {
        let commands = complete_at_marker("loop: mo| 0, 1", Rules::CLASSIC).unwrap();
        assert_eq!(commands.words, ["MOV", "MOD"]);
        assert_eq!(commands.replace, 6..8);
        let modifiers = complete_at_marker("loop mov.|", Rules::CLASSIC).unwrap();
        assert!(modifiers.words.contains(&"I".into()));
        assert_eq!(modifiers.replace, 9..9);
        assert_eq!(
            complete_at_marker("OR|", Rules::CLASSIC).unwrap().words,
            ["ORG"]
        );
        assert!(complete_at_marker("LD|", Rules::NOP).is_none());
    }

    #[test]
    fn suggests_symbols_from_later_lines_and_skips_comments() {
        assert!(complete_at_marker(
            "; café\nMOV #sp|eed, >loop\nspeed EQU 4\nloop JMP 0",
            Rules::CLASSIC
        )
        .is_none());
        let symbols = complete_at_marker(
            "; café\nMOV #spe|d, >loop\nspeed EQU 4\nloop JMP 0",
            Rules::CLASSIC,
        )
        .unwrap();
        assert_eq!(symbols.words, ["speed"]);
        let source = "; café\nMOV #sped, >loop\nspeed EQU 4\nloop JMP 0";
        assert_eq!(&source[symbols.replace], "sped");
        assert_eq!(
            complete_at_marker("MOV #CORE|, $0", Rules::CLASSIC)
                .unwrap()
                .words,
            ["CORESIZE"]
        );
        assert!(complete_at_marker("MOV #0, 1 ; mo|", Rules::CLASSIC).is_none());
    }
}
