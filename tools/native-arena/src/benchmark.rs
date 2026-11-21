use std::{
    path::PathBuf,
    time::{Duration, Instant},
};

const WARMUP: usize = 15;
const SAMPLES: usize = 120;
pub const STEPS: u32 = 512;

pub struct Benchmark {
    output: PathBuf,
    seen: usize,
    previous: Option<Instant>,
    intervals: Vec<Duration>,
    simulation: Vec<Duration>,
    drawing: Vec<Duration>,
    framework: Vec<Duration>,
}

impl Benchmark {
    pub fn from_env() -> Option<Self> {
        Some(Self {
            output: std::env::var_os("ZOREWARS_ARENA_BENCHMARK")?.into(),
            seen: 0,
            previous: None,
            intervals: Vec::new(),
            simulation: Vec::new(),
            drawing: Vec::new(),
            framework: Vec::new(),
        })
    }

    pub fn sample(
        &mut self,
        start: Instant,
        simulation: Duration,
        drawing: Duration,
        previous_framework: Option<Duration>,
        steps: u32,
        renderer: &str,
    ) -> bool {
        let previous = self.previous.replace(start);
        self.seen += 1;
        if self.seen <= WARMUP {
            return false;
        }
        self.intervals.push(start.duration_since(previous.unwrap()));
        self.simulation.push(simulation);
        self.drawing.push(drawing);
        self.framework.extend(previous_framework);
        if self.intervals.len() < SAMPLES {
            return false;
        }
        let mut report = format!(
            "{renderer}\n{SAMPLES} frames, {STEPS} instructions/frame, {steps} total instructions\n{}\n{}\n{}\n",
            stats("frame interval", &mut self.intervals),
            stats("simulation", &mut self.simulation),
            stats("draw or UI preparation", &mut self.drawing),
        );
        if !self.framework.is_empty() {
            report.push_str(&stats(
                "eframe CPU frame (excludes vsync)",
                &mut self.framework,
            ));
            report.push('\n');
        }
        std::fs::write(&self.output, report).expect("write arena benchmark result");
        true
    }
}

fn stats(label: &str, samples: &mut [Duration]) -> String {
    samples.sort_unstable();
    let millis = |sample: Duration| sample.as_secs_f64() * 1000.0;
    let mean = samples.iter().map(|&s| millis(s)).sum::<f64>() / samples.len() as f64;
    let percentile = |p: usize| millis(samples[(samples.len() * p).div_ceil(100) - 1]);
    format!(
        "{label}\tmean {mean:.3} ms\tp50 {:.3} ms\tp95 {:.3} ms",
        percentile(50),
        percentile(95)
    )
}
