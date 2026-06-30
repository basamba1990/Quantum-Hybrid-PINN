"""
Tests unitaires pour la logique physique des moteurs de scénarios.
Valide les équations thermodynamiques et les plages de résultats.
"""

import pytest
import math
from scenario_engines import (
    run_pipeline_scenario,
    run_lh2_storage_scenario,
    run_compression_station_scenario,
    run_cryogenic_transport_scenario,
    run_pipeline_safety_scenario,
    run_port_energy_scenario,
    run_mining_scenario,
    run_rock_stress_scenario,
    R_H2, CP_H2, GAMMA_H2, LH2_BOIL, LH2_LATENT
)


class TestPipelineScenario:
    """Tests pour le scénario Pipeline Hydrogène"""
    
    def test_pipeline_basic_inputs(self):
        """Teste avec des entrées standard"""
        inputs = {
            'length': 100,
            'diameter': 0.5,
            'pressure': 80,
            'temperature': 300,
            'flowRate': 2,
            'fluid': 'H2'
        }
        result = run_pipeline_scenario(inputs)
        
        # Vérifications de cohérence physique
        assert result['pressureDrop'] > 0, "Chute de pression doit être positive"
        assert result['velocity'] > 0, "Vitesse doit être positive"
        assert result['turbulence'] >= 0 and result['turbulence'] <= 100, "Turbulence doit être entre 0 et 100%"
        assert result['leakRisk'] >= 0 and result['leakRisk'] <= 100, "Risque de fuite doit être entre 0 et 100%"
        assert result['safetyScore'] >= 0 and result['safetyScore'] <= 100, "Score sécurité doit être entre 0 et 100"
    
    def test_pipeline_pressure_drop_increases_with_length(self):
        """Teste que la chute de pression augmente avec la longueur"""
        inputs_short = {
            'length': 50,
            'diameter': 0.5,
            'pressure': 80,
            'temperature': 300,
            'flowRate': 2,
            'fluid': 'H2'
        }
        inputs_long = {
            'length': 200,
            'diameter': 0.5,
            'pressure': 80,
            'temperature': 300,
            'flowRate': 2,
            'fluid': 'H2'
        }
        
        result_short = run_pipeline_scenario(inputs_short)
        result_long = run_pipeline_scenario(inputs_long)
        
        assert result_long['pressureDrop'] > result_short['pressureDrop'], \
            "Chute de pression doit augmenter avec la longueur"
    
    def test_pipeline_velocity_increases_with_flow_rate(self):
        """Teste que la vitesse augmente avec le débit"""
        inputs_low = {
            'length': 100,
            'diameter': 0.5,
            'pressure': 80,
            'temperature': 300,
            'flowRate': 1,
            'fluid': 'H2'
        }
        inputs_high = {
            'length': 100,
            'diameter': 0.5,
            'pressure': 80,
            'temperature': 300,
            'flowRate': 5,
            'fluid': 'H2'
        }
        
        result_low = run_pipeline_scenario(inputs_low)
        result_high = run_pipeline_scenario(inputs_high)
        
        assert result_high['velocity'] > result_low['velocity'], \
            "Vitesse doit augmenter avec le débit"


class TestLH2StorageScenario:
    """Tests pour le scénario Stockage LH₂"""
    
    def test_lh2_storage_basic_inputs(self):
        """Teste avec des entrées standard"""
        inputs = {
            'volume': 50,
            'pressure': 1.2,
            'temperature': 20.3,
            'ambientTemp': 300
        }
        result = run_lh2_storage_scenario(inputs)
        
        # Vérifications de cohérence physique
        assert result['boilOffRate'] > 0, "Taux d'évaporation doit être positif"
        assert result['internalPressure'] > 0, "Pression interne doit être positive"
        assert result['stabilityScore'] >= 0 and result['stabilityScore'] <= 100, \
            "Score stabilité doit être entre 0 et 100"
    
    def test_lh2_boil_off_increases_with_ambient_temp(self):
        """Teste que l'évaporation augmente avec la température ambiante"""
        inputs_cold = {
            'volume': 50,
            'pressure': 1.2,
            'temperature': 20.3,
            'ambientTemp': 280
        }
        inputs_hot = {
            'volume': 50,
            'pressure': 1.2,
            'temperature': 20.3,
            'ambientTemp': 320
        }
        
        result_cold = run_lh2_storage_scenario(inputs_cold)
        result_hot = run_lh2_storage_scenario(inputs_hot)
        
        assert result_hot['boilOffRate'] > result_cold['boilOffRate'], \
            "Taux d'évaporation doit augmenter avec température ambiante"


class TestCompressionStationScenario:
    """Tests pour le scénario Station de Compression H₂"""
    
    def test_compression_basic_inputs(self):
        """Teste avec des entrées standard"""
        inputs = {
            'pressure_in': 10,
            'pressure_out': 60,
            'temperature_in': 290,
            'temperature_out': 570, # Température de sortie plus réaliste pour une efficacité isentropique dans la plage
            'flowRate': 5,
            'power': 2.5,
            'efficiency': 0.85
        }
        result = run_compression_station_scenario(inputs)
        
        # Vérifications de cohérence physique
        assert result['compressionRatio'] > 1, "Rapport de compression doit être > 1"
        assert result['isentropicEfficiency'] > 0 and result['isentropicEfficiency'] < 100, \
            "Efficacité isentropique doit être entre 0 et 100%"
        assert result['thermalDelta'] > 0, "Delta thermique doit être positif (T_out > T_in)"
        assert result['coherenceScore'] >= 0 and result['coherenceScore'] <= 100, \
            "Score cohérence doit être entre 0 et 100"
    
    def test_compression_temperature_increases(self):
        """Teste que la température augmente lors de la compression"""
        inputs = {
            'pressure_in': 10,
            'pressure_out': 60,
            'temperature_in': 290,
            'temperature_out': 380,
            'flowRate': 5,
            'power': 2.5,
            'efficiency': 0.85
        }
        result = run_compression_station_scenario(inputs)
        
        assert result['thermalDelta'] > 0, \
            "La compression doit augmenter la température (2e loi thermodynamique)"
    
    def test_compression_anomaly_detection(self):
        """Teste la détection d'anomalies physiques"""
        # Cas anomal : T_out < T_in (impossible)
        inputs_anomaly = {
            'pressure_in': 10,
            'pressure_out': 60,
            'temperature_in': 380,  # Inversé
            'temperature_out': 290,  # Inversé
            'flowRate': 5,
            'power': 2.5,
            'efficiency': 0.85
        }
        result = run_compression_station_scenario(inputs_anomaly)
        
        assert result['status'] == 'ANOMALIE', "Doit détecter anomalie si T_out < T_in"
        assert result['coherenceScore'] < 60, "Score cohérence doit être faible en cas d'anomalie"


class TestCryogenicTransportScenario:
    """Tests pour le scénario Transport Cryogénique"""
    
    def test_cryogenic_basic_inputs(self):
        """Teste avec des entrées standard"""
        inputs = {
            'cargoType': 'LH2',
            'transitTime': 48
        }
        result = run_cryogenic_transport_scenario(inputs)
        
        # Vérifications de cohérence physique
        assert result['thermalLoss'] > 0, "Perte thermique doit être positive"
        assert result['evaporationLoss'] >= 0, "Perte évaporation doit être positive"
        assert result['containerSafety'] >= 0 and result['containerSafety'] <= 100, \
            "Sécurité conteneur doit être entre 0 et 100"
    
    def test_cryogenic_longer_transit_increases_loss(self):
        """Teste que la perte augmente avec le temps de transit"""
        inputs_short = {
            'cargoType': 'LH2',
            'transitTime': 24
        }
        inputs_long = {
            'cargoType': 'LH2',
            'transitTime': 72
        }
        
        result_short = run_cryogenic_transport_scenario(inputs_short)
        result_long = run_cryogenic_transport_scenario(inputs_long)
        
        assert result_long['evaporationLoss'] > result_short['evaporationLoss'], \
            "Perte d'évaporation doit augmenter avec le temps de transit"


class TestPipelineSafetyScenario:
    """Tests pour le scénario Sécurité Pipeline"""
    
    def test_pipeline_safety_basic_inputs(self):
        """Teste avec des entrées standard"""
        inputs = {
            'length': 200,
            'sensorInterval': 5
        }
        result = run_pipeline_safety_scenario(inputs)
        
        # Vérifications de cohérence physique
        assert result['detectionTime'] > 0, "Temps de détection doit être positif"
        assert result['predictionAccuracy'] >= 0 and result['predictionAccuracy'] <= 100, \
            "Précision prédiction doit être entre 0 et 100%"
        assert result['riskReduction'] >= 0 and result['riskReduction'] <= 100, \
            "Réduction risque doit être entre 0 et 100%"
    
    def test_pipeline_safety_closer_sensors_faster_detection(self):
        """Teste que les capteurs rapprochés détectent plus vite"""
        inputs_far = {
            'length': 200,
            'sensorInterval': 20
        }
        inputs_close = {
            'length': 200,
            'sensorInterval': 2
        }
        
        result_far = run_pipeline_safety_scenario(inputs_far)
        result_close = run_pipeline_safety_scenario(inputs_close)
        
        assert result_close['detectionTime'] < result_far['detectionTime'], \
            "Capteurs rapprochés doivent détecter plus vite"


class TestPortEnergyScenario:
    """Tests pour le scénario Optimisation Portuaire"""
    
    def test_port_energy_basic_inputs(self):
        """Teste avec des entrées standard"""
        inputs = {
            'portLocation': 'Dakar',
            'energyDemand': 10,
            'coolingLoad': 500
        }
        result = run_port_energy_scenario(inputs)
        
        # Vérifications de cohérence physique
        assert result['energyEfficiency'] > 100, "Efficacité énergétique doit être > 100% (avec récupération)"
        assert result['costReduction'] >= 0 and result['costReduction'] <= 100, \
            "Réduction coûts doit être entre 0 et 100%"
        assert result['carbonFootprint'] >= 0, "Empreinte carbone doit être positive"


class TestMiningScenario:
    """Tests pour le scénario Ventilation Minière"""
    
    def test_mining_basic_inputs(self):
        """Teste avec des entrées standard"""
        inputs = {
            'mineType': 'Cobalt',
            'depth': 500,
            'ventilationRate': 100
        }
        result = run_mining_scenario(inputs)
        
        # Vérifications de cohérence physique
        assert result['airQuality'] >= 0 and result['airQuality'] <= 100, \
            "Qualité air doit être entre 0 et 100"
        assert result['thermalComfort'] > 0, "Confort thermique doit être positif"
        assert result['gasSafety'] >= 0 and result['gasSafety'] <= 100, \
            "Sécurité gaz doit être entre 0 et 100"
    
    def test_mining_better_ventilation_improves_safety(self):
        """Teste que meilleure ventilation améliore la sécurité"""
        inputs_poor = {
            'mineType': 'Cobalt',
            'depth': 500,
            'ventilationRate': 10
        }
        inputs_good = {
            'mineType': 'Cobalt',
            'depth': 500,
            'ventilationRate': 200
        }
        
        result_poor = run_mining_scenario(inputs_poor)
        result_good = run_mining_scenario(inputs_good)
        
        assert result_good['gasSafety'] > result_poor['gasSafety'], \
            "Meilleure ventilation doit améliorer la sécurité gaz"


class TestRockStressScenario:
    """Tests pour le scénario Géomécanique Rocheuse"""
    
    def test_rock_stress_basic_inputs(self):
        """Teste avec des entrées standard"""
        inputs = {
            'depth': 1000,
            'rockType': 'generic_rock'
        }
        result = run_rock_stress_scenario(inputs)
        
        # Vérifications de cohérence physique
        assert result['lithostaticPressure'] > 0, "Pression lithostatique doit être positive"
        assert result['maxStress'] > result['lithostaticPressure'], \
            "Contrainte max doit être > pression lithostatique"
        assert result['damageIndex'] >= 0 and result['damageIndex'] <= 1, \
            "Indice endommagement doit être entre 0 et 1"
    
    def test_rock_stress_increases_with_depth(self):
        """Teste que la contrainte augmente avec la profondeur"""
        inputs_shallow = {
            'depth': 500,
            'rockType': 'generic_rock'
        }
        inputs_deep = {
            'depth': 2000,
            'rockType': 'generic_rock'
        }
        
        result_shallow = run_rock_stress_scenario(inputs_shallow)
        result_deep = run_rock_stress_scenario(inputs_deep)
        
        assert result_deep['lithostaticPressure'] > result_shallow['lithostaticPressure'], \
            "Pression lithostatique doit augmenter avec la profondeur"


class TestPhysicalConstants:
    """Tests pour les constantes physiques"""
    
    def test_hydrogen_constants(self):
        """Teste les constantes physiques de l'hydrogène"""
        # Constante des gaz pour H₂
        assert R_H2 > 4000 and R_H2 < 4200, "Constante gaz H₂ doit être ~4124 J/(kg·K)"
        
        # Chaleur spécifique
        assert CP_H2 > 14000 and CP_H2 < 14500, "Cp H₂ doit être ~14300 J/(kg·K)"
        
        # Gamma
        assert GAMMA_H2 > 1.3 and GAMMA_H2 < 1.5, "Gamma H₂ doit être ~1.4"


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
