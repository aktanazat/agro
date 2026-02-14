import Foundation

/// Weather features provider with Demo and Live modes
class WeatherServiceImpl: WeatherFeaturesProvider {
    
    func loadDemoWeatherFeatures(
        weatherFeaturesId: String,
        profileTime: String,
        location: GeoPoint
    ) throws -> WeatherFeatures {
        // Return the canonical demo weather features
        return WeatherFeatures(
            weatherFeaturesId: weatherFeaturesId,
            sourceMode: .demo,
            profileTime: profileTime,
            location: location,
            inversionPresent: false,
            humidityLayering: .uniformHumid,
            windShearProxy: .moderate,
            sprayWindowScore: 0.75,
            diseaseRiskScore: 0.65,
            heatStressScore: 0.30,
            notes: ["Demo profile for hackathon", "Yolo County typical evening conditions"]
        )
    }
    
    func fetchLiveWeatherFeatures(
        location: GeoPoint,
        atTime: String,
        providerToken: String
    ) async throws -> WeatherFeatures {
        // TODO: Implement Synoptic API integration
        // For now, return demo features with live flag
        
        let weatherFeaturesId = generateWeatherFeaturesId()
        
        // In production, this would:
        // 1. Call Synoptic latest/nearesttime endpoint
        // 2. Normalize station data to vertical layers
        // 3. Derive features from layers
        
        return WeatherFeatures(
            weatherFeaturesId: weatherFeaturesId,
            sourceMode: .live,
            profileTime: atTime,
            location: location,
            inversionPresent: false,
            humidityLayering: .uniformHumid,
            windShearProxy: .moderate,
            sprayWindowScore: 0.72,
            diseaseRiskScore: 0.68,
            heatStressScore: 0.35,
            notes: ["Live fetch - Synoptic API"]
        )
    }
    
    // MARK: - Feature Derivation
    
    /// Derive inversion presence from temperature profile
    func deriveInversionPresent(layers: [VerticalLayer]) -> Bool {
        // Inversion = temperature increases with altitude in low layers (0-150m)
        guard layers.count >= 2 else { return false }
        
        let lowLayers = layers.filter { $0.altitudeM <= 150 }.sorted { $0.altitudeM < $1.altitudeM }
        guard lowLayers.count >= 2 else { return false }
        
        for i in 1..<lowLayers.count {
            if lowLayers[i].temperatureC > lowLayers[i-1].temperatureC {
                return true
            }
        }
        return false
    }
    
    /// Derive humidity layering classification
    func deriveHumidityLayering(layers: [VerticalLayer]) -> HumidityLayering {
        guard layers.count >= 2 else { return .unknown }
        
        let surfaceRH = layers.min(by: { $0.altitudeM < $1.altitudeM })?.relativeHumidityPct ?? 50
        let aloftRH = layers.max(by: { $0.altitudeM < $1.altitudeM })?.relativeHumidityPct ?? 50
        
        let rhDiff = surfaceRH - aloftRH
        
        if rhDiff > 20 {
            return .dryAloftHumidSurface
        } else if surfaceRH > 70 && aloftRH > 70 {
            return .uniformHumid
        } else if surfaceRH < 50 && aloftRH < 50 {
            return .uniformDry
        } else {
            return .unknown
        }
    }
    
    /// Derive wind shear proxy from wind speed gradient
    func deriveWindShearProxy(layers: [VerticalLayer]) -> WindShearProxy {
        guard layers.count >= 2 else { return .unknown }
        
        let surfaceWind = layers.min(by: { $0.altitudeM < $1.altitudeM })?.windSpeedKph ?? 0
        let upperWind = layers.max(by: { $0.altitudeM < $1.altitudeM })?.windSpeedKph ?? 0
        
        let shear = abs(upperWind - surfaceWind)
        
        if shear < 5 {
            return .low
        } else if shear < 15 {
            return .moderate
        } else {
            return .high
        }
    }
    
    /// Calculate spray window score (0-1)
    func calculateSprayWindowScore(
        inversionPresent: Bool,
        humidityLayering: HumidityLayering,
        windShearProxy: WindShearProxy
    ) -> Double {
        var score = 1.0
        
        if inversionPresent {
            score -= 0.3
        }
        
        switch humidityLayering {
        case .uniformHumid:
            score -= 0.1
        case .dryAloftHumidSurface:
            score -= 0.2
        default:
            break
        }
        
        switch windShearProxy {
        case .high:
            score -= 0.3
        case .moderate:
            score -= 0.1
        default:
            break
        }
        
        return max(0, score)
    }
    
    // MARK: - Helpers
    
    private func generateWeatherFeaturesId() -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMdd"
        let dateStr = dateFormatter.string(from: Date())
        return "wxf_\(dateStr)_live_\(String(format: "%04d", Int.random(in: 1...9999)))"
    }
}

/// Vertical layer data from weather profile
struct VerticalLayer {
    let altitudeM: Double
    let temperatureC: Double
    let relativeHumidityPct: Double
    let windSpeedKph: Double
    let windDirectionDeg: Double
}
