use regex;

pub fn extract_parameter_count(filename: &str) -> Option<String> {
    let lower = filename.to_lowercase();
    
    // Common pattern matching
    if lower.contains("70b") { return Some("70B".to_string()); }
    if lower.contains("13b") { return Some("13B".to_string()); }
    if lower.contains("8x7b") { return Some("8x7B".to_string()); }
    if lower.contains("7b") { return Some("7B".to_string()); }
    if lower.contains("3b") { return Some("3B".to_string()); }
    if lower.contains("1b") { return Some("1B".to_string()); }
    if lower.contains("405b") { return Some("405B".to_string()); }
    if lower.contains("125m") { return Some("125M".to_string()); }
    if lower.contains("350m") { return Some("350M".to_string()); }
    if lower.contains("1.5b") { return Some("1.5B".to_string()); }
    if lower.contains("2.7b") { return Some("2.7B".to_string()); }
    if lower.contains("6.7b") { return Some("6.7B".to_string()); }
    if lower.contains("14b") { return Some("14B".to_string()); }
    if lower.contains("22b") { return Some("22B".to_string()); }
    if lower.contains("34b") { return Some("34B".to_string()); }
    
    let patterns = [
        r"(\d+)x(\d+)b", 
        r"(\d+\.?\d*)b",
        r"(\d+)m",
    ];
    
    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(&lower) {
                if let Some(matched) = caps.get(0) {
                    let param = matched.as_str().to_uppercase();
                    return Some(param);
                }
            }
        }
    }
    
    None
}

pub fn extract_quantization(filename: &str) -> Option<String> {
    let name = filename.replace(".gguf", "");
    let patterns = [
        r"IQ[1-4]_[XSML]?",
        r"Q[2-8]_[0-9K_][0-9K_]*",
        r"Q[2-8]_[0-9]",
        r"F[1-9][0-9]?",
        r"q4_k_m",
        r"q5_k_m",
        r"q6_k",
        r"q8_0",
        r"q4_0",
        r"q5_0",
        r"q2_k",
        r"q3_k",
        r"f16",
        r"f32",
    ];
    
    for pattern in patterns {
        if let Ok(re) = regex::Regex::new(&format!(r"(?i){}", pattern)) {
            if let Some(caps) = re.captures(&name) {
                if let Some(matched) = caps.get(0) {
                    let quant = matched.as_str().to_uppercase();
                    let normalized = match quant.as_str() {
                        "Q4_K_M" => "Q4_K_M",
                        "Q5_K_M" => "Q5_K_M",
                        "Q6_K" => "Q6_K",
                        "Q8_0" => "Q8_0",
                        "Q4_0" => "Q4_0",
                        "Q5_0" => "Q5_0",
                        "Q2_K" => "Q2_K",
                        "Q3_K" => "Q3_K",
                        "F16" => "F16",
                        "F32" => "F32",
                        _ => &quant,
                    };
                    return Some(normalized.to_string());
                }
            }
        }
    }
    
    None
}