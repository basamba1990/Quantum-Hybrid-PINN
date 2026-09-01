#include <cmath>
#include <iostream>
extern "C" {
double lh2_temperature_from_ph(double, double);
double lh2_density_from_ph(double, double);
double lh2_internal_energy_from_ph(double, double);
double lh2_quality_from_ph(double, double);
double lh2_saturation_temperature(double);
const char* lh2_last_error();
}
int main() {
    const double p = 125307.9241506429;
    const double hL = 7573.925185370878;
    const double hV = 449885.56376915454;
    for (double h : {hL, hV, 0.5*(hL+hV)}) {
        const double T = lh2_temperature_from_ph(p, h);
        const double rho = lh2_density_from_ph(p, h);
        const double u = lh2_internal_energy_from_ph(p, h);
        const double q = lh2_quality_from_ph(p, h);
        std::cout << "p=" << p << " h=" << h << " T=" << T << " rho=" << rho << " u=" << u << " q=" << q << " error=" << lh2_last_error() << "\n";
        if (!std::isfinite(T) || !std::isfinite(rho) || !std::isfinite(u)) return 2;
    }
    std::cout << "Tsat=" << lh2_saturation_temperature(p) << "\n";
    return 0;
}
