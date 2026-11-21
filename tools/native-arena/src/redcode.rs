use std::collections::HashMap;

pub const OPS: &[&str] = &[
    "DAT", "MOV", "ADD", "SUB", "MUL", "DIV", "MOD", "JMP", "JMZ", "JMN", "DJN", "SPL", "SLT",
    "SEQ", "SNE", "NOP", "LDP", "STP",
];
pub const MODS: &[&str] = &["A", "B", "AB", "BA", "F", "X", "I"];
pub const MODES: &str = "#$*@{<}>";
pub const DIRECTIVES: &[&str] = &["ORG", "END", "EQU", "FOR", "ROF", "PIN"];
pub const OPS_88: &[&str] = &[
    "DAT", "MOV", "ADD", "SUB", "JMP", "JMZ", "JMN", "DJN", "CMP", "SPL", "SLT",
];
#[cfg(feature = "gpu")]
pub const CORE_SYMBOLS: &[&str] = &[
    "CORESIZE",
    "MAXPROCESSES",
    "MAXCYCLES",
    "MAXLENGTH",
    "MINDISTANCE",
    "CURLINE",
];

#[derive(Clone)]
pub struct Warrior {
    pub name: String,
    #[cfg(any(feature = "gpu", test))]
    pub fallback: std::sync::Arc<str>,
    #[cfg(any(feature = "gpu", test))]
    pub source: std::sync::Arc<str>,
    pub start: usize,
    pub code: Vec<[u16; 3]>,
    #[cfg(feature = "gpu")]
    pub source_lines: Vec<usize>,
    #[cfg(feature = "gpu")]
    pub warnings: Vec<String>,
}

#[derive(Clone, Copy)]
pub struct Rules {
    pub core_size: usize,
    pub cycles: u32,
    pub processes: usize,
    pub length: usize,
    pub distance: usize,
    pub pspace: bool,
    pub pspace_size: Option<usize>,
    pub icws88: bool,
}

impl Rules {
    pub const CLASSIC: Self = Self {
        core_size: 8000,
        cycles: 80_000,
        processes: 8000,
        length: 100,
        distance: 100,
        pspace: true,
        pspace_size: None,
        icws88: false,
    };
    #[cfg(any(feature = "gpu", test))]
    pub const NOP: Self = Self {
        pspace: false,
        ..Self::CLASSIC
    };
    #[cfg(any(feature = "gpu", test))]
    pub const LP: Self = Self {
        processes: 8,
        distance: 200,
        ..Self::NOP
    };

    pub fn space_size(self) -> usize {
        if !self.pspace {
            return 0;
        }
        self.pspace_size.unwrap_or_else(|| {
            let divisor = (1..=16).rev().find(|&n| self.core_size % n == 0).unwrap();
            self.core_size / divisor
        })
    }
}

type Symbols = HashMap<String, Symbol>;
enum Symbol {
    Label(i64),
    Equ(String),
}

struct Expression<'a> {
    rules: Rules,
    rest: &'a str,
    symbols: &'a Symbols,
    pc: i64,
    relative: bool,
    depth: usize,
}

impl Expression<'_> {
    fn read(&mut self, min: u8) -> Result<i64, String> {
        self.rest = self.rest.trim_start();
        let mut value = if let Some(rest) = self.rest.strip_prefix('(') {
            self.rest = rest;
            let value = self.read(0)?;
            self.rest = self
                .rest
                .trim_start()
                .strip_prefix(')')
                .ok_or("expected ')'")?;
            value
        } else if let Some(rest) = self.rest.strip_prefix('-') {
            self.rest = rest;
            self.read(6)?.checked_neg().ok_or("integer overflow")?
        } else if let Some(rest) = self.rest.strip_prefix('+') {
            self.rest = rest;
            self.read(6)?
        } else {
            let end = self
                .rest
                .find(|c: char| !c.is_ascii_alphanumeric() && c != '_')
                .unwrap_or(self.rest.len());
            let (word, rest) = self.rest.split_at(end);
            self.rest = rest;
            match word {
                "" => return Err("expected a number or symbol".into()),
                "CURLINE" => self.pc,
                "CORESIZE" => self.rules.core_size as i64,
                "MAXPROCESSES" => self.rules.processes as i64,
                "MAXCYCLES" => i64::from(self.rules.cycles),
                "MAXLENGTH" => self.rules.length as i64,
                "MINDISTANCE" => self.rules.distance as i64,
                _ => match self.symbols.get(word) {
                    Some(Symbol::Label(line)) => line - if self.relative { self.pc } else { 0 },
                    Some(Symbol::Equ(expression)) if self.depth < 32 => evaluate(
                        expression,
                        self.symbols,
                        self.pc,
                        self.relative,
                        self.depth + 1,
                        self.rules,
                    )?,
                    Some(Symbol::Equ(_)) => return Err(format!("recursive EQU {word}")),
                    None => word.parse().map_err(|_| format!("unknown symbol {word}"))?,
                },
            }
        };
        loop {
            self.rest = self.rest.trim_start();
            let Some((op, precedence)) = [
                ("||", 0),
                ("&&", 1),
                ("==", 2),
                ("!=", 2),
                ("<=", 3),
                (">=", 3),
                ("<", 3),
                (">", 3),
                ("+", 4),
                ("-", 4),
                ("*", 5),
                ("/", 5),
                ("%", 5),
            ]
            .into_iter()
            .find(|(op, _)| self.rest.starts_with(op)) else {
                break;
            };
            if precedence < min {
                break;
            }
            self.rest = &self.rest[op.len()..];
            let right = self.read(precedence + 1)?;
            value = match op {
                "+" => value.checked_add(right),
                "-" => value.checked_sub(right),
                "*" => value.checked_mul(right),
                "/" => value.checked_div(right),
                "%" => value.checked_rem(right),
                "==" => Some(i64::from(value == right)),
                "!=" => Some(i64::from(value != right)),
                "<" => Some(i64::from(value < right)),
                ">" => Some(i64::from(value > right)),
                "<=" => Some(i64::from(value <= right)),
                ">=" => Some(i64::from(value >= right)),
                "&&" => Some(i64::from(value != 0 && right != 0)),
                _ => Some(i64::from(value != 0 || right != 0)),
            }
            .ok_or("integer overflow or division by zero")?;
        }
        Ok(value)
    }
}

fn evaluate(
    text: &str,
    symbols: &Symbols,
    pc: i64,
    relative: bool,
    depth: usize,
    rules: Rules,
) -> Result<i64, String> {
    if text.len() > 512 {
        return Err("expression exceeds 512 bytes".into());
    }
    let mut parser = Expression {
        rules,
        rest: text,
        symbols,
        pc,
        relative,
        depth,
    };
    let value = parser.read(0)?;
    if !parser.rest.is_empty() {
        return Err(format!("unexpected '{}'", parser.rest));
    }
    Ok(value)
}

pub fn token(text: &str) -> (&str, &str) {
    let end = text.find(char::is_whitespace).unwrap_or(text.len());
    (&text[..end], text[end..].trim_start())
}

pub fn opcode(word: &str) -> Option<usize> {
    let base = word.split('.').next()?;
    OPS.iter()
        .position(|&op| op == if base == "CMP" { "SEQ" } else { base })
}

pub fn directive(word: &str) -> bool {
    DIRECTIVES.contains(&word) || word == "TRN"
}

fn line_parts(code: &str) -> (Option<&str>, &str, &str) {
    let (first, rest) = token(code);
    if first.is_empty() || opcode(first).is_some() || directive(first) {
        (None, first, rest)
    } else {
        let (word, fields) = token(rest);
        (Some(first.trim_end_matches(':')), word, fields)
    }
}

fn macro_word(raw: &str) -> String {
    let code = raw
        .split(';')
        .next()
        .unwrap_or_default()
        .trim()
        .trim_start_matches('\u{feff}');
    line_parts(&code.to_ascii_uppercase()).1.to_owned()
}

struct MacroExpander {
    rules: Rules,
    symbols: Symbols,
    counters: Vec<(String, i64)>,
    output: Vec<(usize, String)>,
    pc: i64,
    remaining: usize,
}

impl MacroExpander {
    fn expand(&mut self, lines: &[(usize, &str)], depth: usize) -> Result<bool, String> {
        let mut i = 0;
        while i < lines.len() {
            let (line, raw) = lines[i];
            let error = |message: &str| format!("line {}: {message}", line + 1);
            self.remaining = self
                .remaining
                .checked_sub(1)
                .ok_or_else(|| error("FOR expansion is too large"))?;
            let raw = substitute_counters(raw, &self.counters);
            let code = raw
                .split(';')
                .next()
                .unwrap_or_default()
                .trim()
                .trim_start_matches('\u{feff}')
                .to_ascii_uppercase();
            let (label, word, fields) = line_parts(&code);
            match word {
                "FOR" => {
                    if depth >= 32 {
                        return Err(error("FOR nesting exceeds 32 levels"));
                    }
                    let mut pending = 1;
                    let end = (i + 1..lines.len())
                        .find(|&index| {
                            match macro_word(lines[index].1).as_str() {
                                "FOR" => pending += 1,
                                "ROF" => pending -= 1,
                                _ => {}
                            }
                            pending == 0
                        })
                        .ok_or_else(|| error("FOR without a matching ROF"))?;
                    let times = evaluate(fields, &self.symbols, self.pc, true, 0, self.rules)
                        .map_err(|message| error(&message))?;
                    if times > 10_000 {
                        return Err(error("FOR count exceeds 10000"));
                    }
                    for n in 1..=times {
                        self.remaining = self
                            .remaining
                            .checked_sub(1)
                            .ok_or_else(|| error("FOR expansion is too large"))?;
                        if let Some(label) = label {
                            self.counters.push((label.into(), n));
                        }
                        let done = self.expand(&lines[i + 1..end], depth + 1)?;
                        if label.is_some() {
                            self.counters.pop();
                        }
                        if done {
                            return Ok(true);
                        }
                    }
                    i = end;
                }
                "ROF" => return Err(error("ROF without a matching FOR")),
                _ => {
                    if let Some(label) = label {
                        let symbol = if word == "EQU" {
                            Symbol::Equ(fields.into())
                        } else {
                            Symbol::Label(self.pc)
                        };
                        self.symbols.insert(label.into(), symbol);
                    }
                    if opcode(word).is_some() {
                        self.pc += 1;
                        if self.pc as usize > self.rules.length {
                            return Err(error(&format!(
                                "warrior exceeds {} instructions",
                                self.rules.length
                            )));
                        }
                    }
                    let done = word == "END";
                    self.output.push((line, raw));
                    if done {
                        return Ok(true);
                    }
                }
            }
            i += 1;
        }
        Ok(false)
    }
}

fn substitute_counters(raw: &str, counters: &[(String, i64)]) -> String {
    if counters.is_empty() {
        return raw.to_owned();
    }
    let (mut code, comment) = raw.find(';').map_or((raw, ""), |index| raw.split_at(index));
    let mut output = String::new();
    while let Some(first) = code.chars().next() {
        let paste = first == '&' && !code.starts_with("&&") && !output.ends_with('&');
        let offset = usize::from(paste);
        let len = code[offset..]
            .bytes()
            .take_while(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
            .count();
        if len == 0 {
            output.push(first);
            code = &code[first.len_utf8()..];
            continue;
        }
        let name = &code[offset..offset + len];
        if let Some((_, n)) = counters
            .iter()
            .rev()
            .find(|(counter, _)| !output.ends_with('.') && name.eq_ignore_ascii_case(counter))
        {
            output.push_str(&if paste {
                format!("{n:02}")
            } else {
                n.to_string()
            });
        } else {
            output.push_str(&code[..offset + len]);
        }
        code = &code[offset + len..];
    }
    output.push_str(comment);
    output
}

pub fn is_label(label: &str) -> bool {
    !label.is_empty()
        && label
            .chars()
            .enumerate()
            .all(|(i, c)| c.is_ascii_alphabetic() || c == '_' || i > 0 && c.is_ascii_digit())
}

fn operand(text: &str, symbols: &Symbols, pc: i64, rules: Rules) -> Result<(u16, u16), String> {
    let text = text.trim();
    let mode = text.chars().next().and_then(|c| MODES.find(c));
    let value = evaluate(
        if mode.is_some() { &text[1..] } else { text },
        symbols,
        pc,
        true,
        0,
        rules,
    )?;
    Ok((
        mode.unwrap_or(1) as u16,
        value.rem_euclid(rules.core_size as i64) as u16,
    ))
}

pub fn assemble(source: &str, fallback: &str) -> Result<Warrior, String> {
    assemble_with_rules(source, fallback, Rules::CLASSIC)
}

pub fn assemble_with_rules(source: &str, fallback: &str, rules: Rules) -> Result<Warrior, String> {
    let mut name = fallback.to_owned();
    let mut symbols = Symbols::new();
    let mut lines = Vec::new();
    let mut start = None;
    let mut assertions = Vec::new();
    #[cfg(feature = "gpu")]
    let mut warnings = Vec::new();
    let input = source.lines().enumerate().collect::<Vec<_>>();
    let mut macros = MacroExpander {
        rules,
        symbols: Symbols::new(),
        counters: Vec::new(),
        output: Vec::new(),
        pc: 0,
        remaining: 20_000,
    };
    macros.expand(&input, 0)?;
    for (i, raw) in macros.output {
        let raw = raw.trim().trim_start_matches('\u{feff}');
        if let Some(assertion) = raw.strip_prefix(";assert ") {
            assertions.push((
                i,
                lines.len() as i64,
                assertion.split(';').next().unwrap().to_ascii_uppercase(),
            ));
        }
        if let Some(value) = raw.strip_prefix(";name ") {
            name = value.trim().into();
        }
        let text = raw.split(';').next().unwrap().trim().to_ascii_uppercase();
        let (label, word, fields) = line_parts(&text);
        if label.is_none() && word.is_empty() {
            continue;
        }
        let error = |message: &str| format!("line {}: {message}", i + 1);
        if let Some(label) = label {
            if !is_label(label) {
                return Err(error("invalid label"));
            }
            let value = if word == "EQU" {
                Symbol::Equ(fields.into())
            } else {
                Symbol::Label(lines.len() as i64)
            };
            if symbols.insert(label.into(), value).is_some() {
                return Err(error("duplicate label"));
            }
        }
        match word {
            "" | "EQU" if label.is_some() => {}
            "ORG" if rules.icws88 => return Err(error("ICWS'88 uses END for the entry point")),
            "ORG" | "END" => {
                if !fields.is_empty() {
                    start = Some((i, fields.to_owned()));
                }
                if word == "END" {
                    break;
                }
            }
            "PIN" => {
                #[cfg(feature = "gpu")]
                warnings.push(format!(
                    "line {}: PIN uses private P-space in this arena",
                    i + 1
                ));
            }
            "TRN" => {
                return Err(error(&format!(
                    "{word} is outside the desktop assembler subset"
                )))
            }
            _ if opcode(word).is_some() => lines.push((i, word.to_owned(), fields.to_owned())),
            _ => return Err(error(&format!("unknown opcode or directive {word}"))),
        }
    }
    for (line, pc, assertion) in assertions {
        let result = evaluate(&assertion, &symbols, pc, true, 0, rules)
            .map_err(|e| format!("line {}: {e}", line + 1))?;
        if result == 0 {
            return Err(format!(
                "line {}: assertion failed for the desktop arena rules",
                line + 1
            ));
        }
    }
    if lines.is_empty() || lines.len() > rules.length {
        return Err(format!("a warrior needs 1–{} instructions", rules.length));
    }
    let start = match start {
        Some((i, expression)) => evaluate(&expression, &symbols, 0, false, 0, rules)
            .map_err(|e| format!("line {}: {e}", i + 1))?,
        None => 0,
    };
    if !(0..lines.len() as i64).contains(&start) {
        return Err("entry point is outside the warrior".into());
    }
    #[cfg(feature = "gpu")]
    let source_lines = lines.iter().map(|(line, _, _)| line + 1).collect();
    let code = lines
        .into_iter()
        .enumerate()
        .map(|(pc, (line, word, fields))| {
            let result = (|| {
                let op = opcode(&word).unwrap();
                if rules.icws88 {
                    let base = word.split('.').next().unwrap();
                    if !OPS_88.contains(&base) {
                        return Err(format!("{base} is not an ICWS'88 opcode"));
                    }
                    if word.contains('.') {
                        return Err("ICWS'88 does not accept explicit modifiers".into());
                    }
                }
                if matches!(op, 16 | 17) && !rules.pspace {
                    return Err(format!("{word} requires P-space"));
                }
                let (a, b) = match fields.split_once(',') {
                    Some((a, b)) => (
                        operand(a, &symbols, pc as i64, rules)?,
                        operand(b, &symbols, pc as i64, rules)?,
                    ),
                    None if fields.is_empty() && matches!(op, 0 | 15) => ((1, 0), (1, 0)),
                    None if op == 0 => ((0, 0), operand(&fields, &symbols, pc as i64, rules)?),
                    None => (operand(&fields, &symbols, pc as i64, rules)?, (1, 0)),
                };
                if rules.icws88 && [a.0, b.0].iter().any(|mode| !matches!(mode, 0 | 1 | 3 | 5)) {
                    return Err("ICWS'88 accepts only #, $, @, and < addressing".into());
                }
                let modifier = match word.split_once('.') {
                    Some((_, m)) => MODS
                        .iter()
                        .position(|&x| x == m)
                        .ok_or_else(|| format!("unknown modifier {m}"))?,
                    None => match op {
                        0 | 15 => 4,
                        1 | 13 | 14 => {
                            if a.0 == 0 {
                                2
                            } else if b.0 == 0 {
                                1
                            } else {
                                6
                            }
                        }
                        2..=6 => {
                            if a.0 == 0 {
                                2
                            } else if b.0 == 0 {
                                1
                            } else {
                                4
                            }
                        }
                        12 | 16 | 17 if a.0 == 0 => 2,
                        _ => 1,
                    },
                };
                Ok([
                    op as u16 | (modifier as u16) << 5 | a.0 << 8 | b.0 << 11,
                    a.1,
                    b.1,
                ])
            })();
            result.map_err(|e: String| format!("line {}: {e}", line + 1))
        })
        .collect::<Result<_, _>>()?;
    Ok(Warrior {
        name,
        #[cfg(any(feature = "gpu", test))]
        fallback: fallback.into(),
        #[cfg(any(feature = "gpu", test))]
        source: source.into(),
        start: start as usize,
        code,
        #[cfg(feature = "gpu")]
        source_lines,
        #[cfg(feature = "gpu")]
        warnings,
    })
}
