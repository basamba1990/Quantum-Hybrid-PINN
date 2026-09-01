#include <cstdlib>
#include <iostream>
#include <stdexcept>
#include <string>
#include "CoolProp/CoolPropLib.h"

static double props(const char* out, const char* n1, double v1,
                    const char* n2, double v2, const char* fluid)
{
    const double value = PropsSI(out, n1, v1, n2, v2, fluid);
    char err[2048] = {};
    get_global_param_string("errstring", err, sizeof(err));
    if (err[0] != '\0') {
        throw std::runtime_error(err);
    }
    return value;
}

int main()
{
    const char* fluid = "ParaHydrogen";
    const double T = 21.01;
    const double p = props("P", "T", T, "Q", 0.0, fluid);
    const double rhoL = props("D", "T", T, "Q", 0.0, fluid);
    const double rhoV = props("D", "T", T, "Q", 1.0, fluid);
    const double hL = props("H", "T", T, "Q", 0.0, fluid);
    const double hV = props("H", "T", T, "Q", 1.0, fluid);
    std::cout << "fluid=" << fluid << " T_K=" << T << " p_sat_Pa=" << p
              << " rho_liquid=" << rhoL << " rho_vapor=" << rhoV
              << " h_liquid_J_kg=" << hL << " h_vapor_J_kg=" << hV << "\n";
    return 0;
}
